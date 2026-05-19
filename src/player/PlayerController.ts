import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { AnimationManager, CharacterAnimationStateMachine } from '../animation/AnimationManager';
import type { DamageInfo } from '../combat/CombatSystem';
import { AttackComponent, HealthComponent } from '../combat/CombatSystem';
import { PLAYER, COMBAT, SCENE } from '../utils/Constants';
import { VectorUtils } from '../utils/VectorUtils';


export class PlayerController {
  private model: THREE.Object3D;
  private physicsWorld: PhysicsWorld;
  private bodyHandle: RAPIER.RigidBodyHandle;
  private animationManager: AnimationManager;
  private animationStateMachine: CharacterAnimationStateMachine;
  private healthComponent: HealthComponent;
  private attackComponent: AttackComponent;

  private inputState = {
    moveForward: false,
    moveBackward: false,
    moveLeft: false,
    moveRight: false,
    sprint: false,
    jump: false,
    attack: false,
  };

  private isGrounded: boolean = false;
  private isAttacking: boolean = false;
  private isHit: boolean = false;
  private hitStunTimer: number = 0;
  private velocity: THREE.Vector3 = new THREE.Vector3();
  private facing: number = 0;
  private worldCamera: THREE.Camera | null = null;

  private lastHitTargets: Set<any> = new Set();

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

    this.bodyHandle = physicsWorld.createDynamicBody(position, PLAYER.MASS, 'capsule');
    physicsWorld.linkBody(model, this.bodyHandle);

    this.healthComponent = new HealthComponent(PLAYER.MAX_HEALTH);
    this.healthComponent.onDeath(() => this.onDeath());

    this.attackComponent = new AttackComponent(
      COMBAT.ATTACK_RANGE,
      COMBAT.ATTACK_DAMAGE,
      COMBAT.ATTACK_KNOCKBACK,
      COMBAT.ATTACK_COOLDOWN,
      COMBAT.ATTACK_DURATION
    );

    this.setupInputListeners();
  }

  private setupInputListeners(): void {
    document.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      switch (key) {
        case 'w':
          this.inputState.moveForward = true;
          break;
        case 's':
          this.inputState.moveBackward = true;
          break;
        case 'a':
          this.inputState.moveLeft = true;
          break;
        case 'd':
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
          this.inputState.moveForward = false;
          break;
        case 's':
          this.inputState.moveBackward = false;
          break;
        case 'a':
          this.inputState.moveLeft = false;
          break;
        case 'd':
          this.inputState.moveRight = false;
          break;
        case 'shift':
          this.inputState.sprint = false;
          break;
      }
    });

    document.addEventListener('click', () => {
      this.inputState.attack = true;
    });
  }

  update(deltaTime: number, allCharacters?: any[]): void {
    this.animationManager.update(deltaTime);
    this.attackComponent.update();

    this.isGrounded = this.physicsWorld.isGrounded(this.bodyHandle);

    if (this.isHit) {
      this.hitStunTimer -= deltaTime;
      if (this.hitStunTimer <= 0) {
        this.isHit = false;
      }
    }

    const inputDirection = this.getInputDirection();

    this.updateMovement(inputDirection, deltaTime);

    if (this.inputState.jump && this.isGrounded) {
      this.jump();
      this.inputState.jump = false;
    }

    if (this.inputState.attack && !this.isHit && !this.isAttacking) {
      this.performAttack(allCharacters || []);
      this.inputState.attack = false;
    }

    this.isAttacking = this.attackComponent.getIsAttacking();

    const speed = this.velocity.length();
    this.animationStateMachine.update(
      inputDirection.length() > 0.1,
      this.inputState.sprint && this.isGrounded,
      !this.isGrounded,
      this.isAttacking,
      speed
    );

    if (inputDirection.length() > 0.1) {
      this.facing = Math.atan2(inputDirection.x, inputDirection.z);
      const targetQuaternion = new THREE.Quaternion();
      targetQuaternion.setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        this.facing
      );
      this.model.quaternion.slerp(targetQuaternion, PLAYER.ROTATION_SPEED);
    }
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
    const targetSpeed = this.inputState.sprint
      ? PLAYER.SPRINT_SPEED
      : PLAYER.SPEED;

    const move = direction.clone().multiplyScalar(targetSpeed * deltaTime);
    const nextPosition = this.model.position.clone().add(move);
    const halfArena = SCENE.ARENA_SIZE / 2 - 1;
    nextPosition.x = VectorUtils.clamp(nextPosition.x, -halfArena, halfArena);
    nextPosition.z = VectorUtils.clamp(nextPosition.z, -halfArena, halfArena);

    this.model.position.copy(nextPosition);
    this.physicsWorld.setPosition(this.bodyHandle, nextPosition);

    this.velocity.set(
      direction.x * targetSpeed,
      0,
      direction.z * targetSpeed
    );
    this.physicsWorld.setVelocity(this.bodyHandle, this.velocity);
  }

  private jump(): void {
    const jumpForce = new THREE.Vector3(0, PLAYER.JUMP_FORCE, 0);
    this.physicsWorld.applyImpulse(this.bodyHandle, jumpForce);
  }

  private performAttack(allCharacters: any[]): void {
    if (!this.attackComponent.canAttack()) return;

    this.attackComponent.performAttack();
    this.isAttacking = true;

    this.animationStateMachine.playAction('attack');

    const playerPos = this.model.position;
    const attackRange = this.attackComponent.getAttackRange();

    allCharacters.forEach((character) => {
      if (character === this) return;

      const targetPos = character.getWorldPosition();
      const distance = playerPos.distanceTo(targetPos);

      if (distance < attackRange && !this.lastHitTargets.has(character)) {
        const knockbackDir = targetPos
          .clone()
          .sub(playerPos)
          .normalize();
        const damageInfo: DamageInfo = {
          damage: this.attackComponent.getAttackDamage() * this.attackComponent.getComboMultiplier(),
          knockback: this.attackComponent.getAttackKnockback(),
          knockbackDirection: knockbackDir,
          stun: COMBAT.HITSTUN_DURATION,
        };

        character.takeDamage(damageInfo);
        this.lastHitTargets.add(character);

        this.onHitTarget(character);
      }
    });

    setTimeout(() => {
      this.lastHitTargets.clear();
    }, this.attackComponent.getAttackRange() * 100);
  }

  private onHitTarget(target: any): void {
    console.log('Hit target!', target);
  }

  takeDamage(damageInfo: DamageInfo): void {
    this.healthComponent.takeDamage(damageInfo.damage);
    this.applyKnockback(damageInfo.knockbackDirection, damageInfo.knockback);

    this.isHit = true;
    this.hitStunTimer = damageInfo.stun;

    this.animationStateMachine.playAction('hit');
  }

  private applyKnockback(direction: THREE.Vector3, magnitude: number): void {
    const knockbackForce = direction.clone().multiplyScalar(magnitude);
    // Keep knockback horizontal so hits do not launch characters upward.
    knockbackForce.y = 0;
    this.physicsWorld.applyImpulse(this.bodyHandle, knockbackForce);
  }

  private onDeath(): void {
    console.log('Player defeated!');
    this.animationStateMachine.playAction('death');
  }

  getWorldPosition(): THREE.Vector3 {
    return this.model.position.clone();
  }

  getHealth(): HealthComponent {
    return this.healthComponent;
  }

  getModel(): THREE.Object3D {
    return this.model;
  }

  getBodyHandle(): RAPIER.RigidBodyHandle {
    return this.bodyHandle;
  }

  cleanup(): void {
  }
}
