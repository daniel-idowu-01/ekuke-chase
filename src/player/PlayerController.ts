import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { AnimationManager, CharacterAnimationStateMachine } from '../animation/AnimationManager';
import { StaminaComponent } from '../combat/CombatSystem';
import { PLAYER, STAMINA, SCENE } from '../utils/Constants';
import { VectorUtils } from '../utils/VectorUtils';


export class PlayerController {
  private model: THREE.Object3D;
  private physicsWorld: PhysicsWorld;
  private bodyHandle: RAPIER.RigidBodyHandle;
  private animationManager: AnimationManager;
  private animationStateMachine: CharacterAnimationStateMachine;
  private stamina: StaminaComponent;

  private inputState = {
    moveForward: false,
    moveBackward: false,
    moveLeft: false,
    moveRight: false,
    sprint: false,
    jump: false,
  };

  private isGrounded: boolean = false;
  private wasGrounded: boolean = false;
  private isSprinting: boolean = false;
  private velocity: THREE.Vector3 = new THREE.Vector3();
  private desiredVelocity: THREE.Vector3 = new THREE.Vector3();
  private facing: number = 0;
  private worldCamera: THREE.Camera | null = null;
  private footstepTimer: number = 0;

  constructor(
    model: THREE.Object3D,
    position: THREE.Vector3,
    physicsWorld: PhysicsWorld,
    animationManager: AnimationManager,
    camera: THREE.Camera
  ) {
    this.model = model;
    this.physicsWorld = physicsWorld;
    this.animationManager = animationManager;
    this.animationStateMachine = new CharacterAnimationStateMachine(animationManager);
    this.worldCamera = camera;

    this.bodyHandle = physicsWorld.createDynamicBody(position, PLAYER.MASS, 'capsule', {
      halfHeight: PLAYER.CAPSULE_HALF_HEIGHT,
      radius: PLAYER.CAPSULE_RADIUS,
    });
    physicsWorld.linkBody(model, this.bodyHandle);

    this.stamina = new StaminaComponent(
      STAMINA.MAX,
      STAMINA.DRAIN_RATE,
      STAMINA.REGEN_RATE,
      STAMINA.REGEN_DELAY,
      STAMINA.RECOVER_THRESHOLD
    );

    this.setupInputListeners();
  }

  private setupInputListeners(): void {
    document.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      switch (key) {
        case 'w':
        case 'arrowup':
          this.inputState.moveForward = true;
          break;
        case 's':
        case 'arrowdown':
          this.inputState.moveBackward = true;
          break;
        case 'a':
        case 'arrowleft':
          this.inputState.moveLeft = true;
          break;
        case 'd':
        case 'arrowright':
          this.inputState.moveRight = true;
          break;
        case 'shift':
          this.inputState.sprint = true;
          break;
        case ' ':
          this.inputState.jump = true;
          e.preventDefault();
          break;
      }
    });

    document.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      switch (key) {
        case 'w':
        case 'arrowup':
          this.inputState.moveForward = false;
          break;
        case 's':
        case 'arrowdown':
          this.inputState.moveBackward = false;
          break;
        case 'a':
        case 'arrowleft':
          this.inputState.moveLeft = false;
          break;
        case 'd':
        case 'arrowright':
          this.inputState.moveRight = false;
          break;
        case 'shift':
          this.inputState.sprint = false;
          break;
      }
    });
  }

  update(deltaTime: number): void {
    this.animationManager.update(deltaTime);

    this.wasGrounded = this.isGrounded;
    this.isGrounded = this.physicsWorld.isGrounded(this.bodyHandle);
    if (!this.wasGrounded && this.isGrounded) {
      this.onLand();
    }

    const inputDirection = this.getInputDirection();

    // Sprint is only granted if the player is moving, grounded, and has
    // stamina. The stamina component returns whether sprint is truly active.
    const wantSprint = this.inputState.sprint && this.isGrounded && inputDirection.lengthSq() > 0;
    this.isSprinting = this.stamina.update(deltaTime, wantSprint);

    this.updateMovement(inputDirection, deltaTime);

    if (this.inputState.jump && this.isGrounded) {
      this.jump();
      this.inputState.jump = false;
    }

    const speed = this.velocity.length();
    this.animationStateMachine.update(
      inputDirection.length() > 0.1,
      this.isSprinting,
      !this.isGrounded,
      speed
    );

    if (this.velocity.lengthSq() > 0.05) {
      this.facing = Math.atan2(this.velocity.x, this.velocity.z);
      const targetQuaternion = new THREE.Quaternion();
      targetQuaternion.setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        this.facing
      );
      this.model.quaternion.slerp(targetQuaternion, 1 - Math.exp(-PLAYER.ROTATION_SPEED * deltaTime));
    }

    this.updateFootsteps(deltaTime);
  }

  private getInputDirection(): THREE.Vector3 {
    const direction = new THREE.Vector3();

    if (this.inputState.moveForward) direction.z -= 1;
    if (this.inputState.moveBackward) direction.z += 1;
    if (this.inputState.moveLeft) direction.x -= 1;
    if (this.inputState.moveRight) direction.x += 1;

    if (direction.length() > 0) {
      direction.normalize();

      if (this.worldCamera) {
        const cameraDirection = new THREE.Vector3(0, 0, -1)
          .applyQuaternion(this.worldCamera.quaternion);
        cameraDirection.y = 0;
        cameraDirection.normalize();

        const cameraRight = new THREE.Vector3(1, 0, 0)
          .applyQuaternion(this.worldCamera.quaternion);
        cameraRight.y = 0;
        cameraRight.normalize();

        const moveDir = new THREE.Vector3()
          .addScaledVector(cameraRight, direction.x)
          .addScaledVector(cameraDirection, -direction.z);

        direction.copy(moveDir.normalize());
      }
    }

    return direction;
  }

  private updateMovement(direction: THREE.Vector3, deltaTime: number): void {
    const targetSpeed = this.isSprinting
      ? PLAYER.SPRINT_SPEED
      : PLAYER.SPEED;

    const currentVelocity = this.physicsWorld.getVelocity(this.bodyHandle);
    const horizontalVelocity = new THREE.Vector3(currentVelocity.x, 0, currentVelocity.z);
    this.desiredVelocity.copy(direction).multiplyScalar(targetSpeed);
    const response = direction.lengthSq() > 0
      ? PLAYER.ACCELERATION
      : PLAYER.DECELERATION;

    horizontalVelocity.lerp(
      this.desiredVelocity,
      1 - Math.exp(-response * deltaTime)
    );

    const halfArena = SCENE.ARENA_SIZE / 2 - 1;
    const position = this.physicsWorld.getPosition(this.bodyHandle);
    if (Math.abs(position.x) > halfArena || Math.abs(position.z) > halfArena) {
      position.x = VectorUtils.clamp(position.x, -halfArena, halfArena);
      position.z = VectorUtils.clamp(position.z, -halfArena, halfArena);
      this.physicsWorld.setPosition(this.bodyHandle, position);
      horizontalVelocity.multiplyScalar(0.35);
    }

    this.velocity.set(horizontalVelocity.x, 0, horizontalVelocity.z);
    this.physicsWorld.setVelocity(
      this.bodyHandle,
      new THREE.Vector3(horizontalVelocity.x, currentVelocity.y, horizontalVelocity.z)
    );
  }

  private jump(): void {
    const jumpForce = new THREE.Vector3(0, PLAYER.JUMP_FORCE, 0);
    this.physicsWorld.applyImpulse(this.bodyHandle, jumpForce);
  }

  private updateFootsteps(deltaTime: number): void {
    const speed = this.velocity.length();
    if (!this.isGrounded || speed < 1.2) {
      this.footstepTimer = 0;
      return;
    }

    this.footstepTimer -= deltaTime * speed;
    if (this.footstepTimer <= 0) {
      this.onFootstep();
      this.footstepTimer = this.isSprinting ? 2.4 : 3.2;
    }
  }

  private onFootstep(): void {
  }

  private onLand(): void {
  }

  getWorldPosition(): THREE.Vector3 {
    return this.model.position.clone();
  }

  getModel(): THREE.Object3D {
    return this.model;
  }

  getBodyHandle(): RAPIER.RigidBodyHandle {
    return this.bodyHandle;
  }

  getSpeed(): number {
    return this.velocity.length();
  }

  getSprintRatio(): number {
    return this.isSprinting ? THREE.MathUtils.clamp(this.getSpeed() / PLAYER.SPRINT_SPEED, 0, 1) : 0;
  }

  getStaminaRatio(): number {
    return this.stamina.getRatio();
  }

  isExhausted(): boolean {
    return this.stamina.getIsExhausted();
  }

  cleanup(): void {
  }
}
