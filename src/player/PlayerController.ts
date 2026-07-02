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
  private autoSprint: boolean = false;
  // External (touch) analog input. When touchActive, the joystick vector drives
  // movement instead of the keyboard booleans. x = strafe, forward = +towards.
  private touchActive: boolean = false;
  private touchMoveX: number = 0;
  private touchMoveForward: number = 0;
  private velocity: THREE.Vector3 = new THREE.Vector3();
  private desiredVelocity: THREE.Vector3 = new THREE.Vector3();
  // Face into the screen (-z) at spawn so we see the robot's back, not its face.
  private facing: number = Math.PI;
  // Heading the player auto-runs along (auto-run mode); steered left/right.
  private runHeading: number = Math.PI;
  // Mouse steering for auto-run: cursor offset from screen centre, [-1, 1].
  private mouseSteer: number = 0;
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

    // Mouse steering for auto-run: how far the cursor sits left/right of the
    // screen centre (with a small deadzone); halfway to an edge = full turn.
    document.addEventListener('mousemove', (e) => {
      const raw = (e.clientX / window.innerWidth - 0.5) * 2;
      const dead = 0.06;
      const steer = Math.abs(raw) <= dead
        ? 0
        : (raw - Math.sign(raw) * dead) / (0.5 - dead);
      this.mouseSteer = THREE.MathUtils.clamp(steer, -1, 1);
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
    // Tight ground probe: just past the capsule's feet (centre-to-feet + a
    // small tolerance), so we only count as grounded when actually landed.
    this.isGrounded = this.physicsWorld.isGrounded(
      this.bodyHandle,
      PLAYER.CAPSULE_HALF_HEIGHT + PLAYER.CAPSULE_RADIUS + 0.12
    );
    if (!this.wasGrounded && this.isGrounded) {
      this.onLand();
    }

    // Auto-run: move forward along a steerable heading. Otherwise: normal
    // camera-relative WASD/joystick movement.
    const inputDirection = this.autoSprint
      ? this.getAutoRunDirection(deltaTime)
      : this.getInputDirection();

    // Sprint is granted while moving, grounded, and with stamina. Holding
    // sprint OR auto-run both count as wanting to sprint; the stamina
    // component returns whether sprint is truly active (else a jog).
    const wantSprint =
      (this.inputState.sprint || this.autoSprint) &&
      this.isGrounded &&
      inputDirection.lengthSq() > 0;
    this.isSprinting = this.stamina.update(deltaTime, wantSprint);

    this.updateMovement(inputDirection, deltaTime);

    if (this.inputState.jump) {
      // Only jump from the ground and when not already rising — prevents
      // stacking impulses mid-air to climb onto rooftops.
      const verticalVelocity = this.physicsWorld.getVelocity(this.bodyHandle).y;
      if (this.isGrounded && verticalVelocity <= 0.1) {
        this.jump();
      }
      this.inputState.jump = false;
    }

    const speed = this.velocity.length();
    this.animationStateMachine.update(
      this.autoSprint || inputDirection.length() > 0.1,
      this.isSprinting,
      !this.isGrounded,
      speed
    );

    if (this.autoSprint) {
      // Heading is authoritative in auto-run; face it directly.
      this.facing = this.runHeading;
      this.applyFacing(deltaTime);
    } else if (this.velocity.lengthSq() > 0.05) {
      this.facing = Math.atan2(this.velocity.x, this.velocity.z);
      this.applyFacing(deltaTime);
    }

    this.updateFootsteps(deltaTime);
  }

  /**
   * Auto-run steering: left/right input rotates the run heading; the player
   * always moves forward along it. Returns the world-space move direction.
   */
  private getAutoRunDirection(deltaTime: number): THREE.Vector3 {
    let steer = 0;
    if (this.touchActive) {
      steer = this.touchMoveX;
    } else {
      if (this.inputState.moveLeft) steer -= 1;
      if (this.inputState.moveRight) steer += 1;
      // With no keys held, the mouse steers (move cursor left/right of centre).
      if (steer === 0) steer = this.mouseSteer;
    }

    // Steering toward screen-right decreases the heading angle. Flip the sign
    // here if left/right ever feel reversed.
    this.runHeading -= steer * PLAYER.TURN_RATE * deltaTime;

    return new THREE.Vector3(Math.sin(this.runHeading), 0, Math.cos(this.runHeading));
  }

  private applyFacing(deltaTime: number): void {
    const targetQuaternion = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      this.facing
    );
    this.model.quaternion.slerp(targetQuaternion, 1 - Math.exp(-PLAYER.ROTATION_SPEED * deltaTime));
  }

  private getInputDirection(): THREE.Vector3 {
    const direction = new THREE.Vector3();

    if (this.touchActive) {
      // Joystick: forward (+) is "away from camera", matching the keyboard's
      // moveForward = -z convention below.
      direction.x = this.touchMoveX;
      direction.z = -this.touchMoveForward;
    } else {
      if (this.inputState.moveForward) direction.z -= 1;
      if (this.inputState.moveBackward) direction.z += 1;
      if (this.inputState.moveLeft) direction.x -= 1;
      if (this.inputState.moveRight) direction.x += 1;
    }

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

  /** Current facing angle (radians) for the auto-follow camera to trail. */
  getHeading(): number {
    return this.facing;
  }

  /** Feed analog movement from an external source (touch joystick). */
  setMoveInput(x: number, forward: number): void {
    this.touchActive = true;
    this.touchMoveX = x;
    this.touchMoveForward = forward;
  }

  setSprintInput(active: boolean): void {
    this.inputState.sprint = active;
  }

  setAutoSprint(enabled: boolean): void {
    // Seed the run heading from the current facing so enabling auto-run
    // continues in the direction the player is already pointing.
    if (enabled && !this.autoSprint) this.runHeading = this.facing;
    this.autoSprint = enabled;
  }

  requestJump(): void {
    this.inputState.jump = true;
  }

  isExhausted(): boolean {
    return this.stamina.getIsExhausted();
  }

  cleanup(): void {
  }
}
