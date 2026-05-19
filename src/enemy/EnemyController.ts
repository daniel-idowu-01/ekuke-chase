import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { AnimationManager, CharacterAnimationStateMachine } from '../animation/AnimationManager';
import type { DamageInfo } from '../combat/CombatSystem';
import { AttackComponent, HealthComponent } from '../combat/CombatSystem';
import { COMBAT, ENEMY, SCENE } from '../utils/Constants';

const EnemyState = {
  IDLE: 'idle',
  CHASE: 'chase',
  ATTACK: 'attack',
  HIT: 'hit',
  DEAD: 'dead',
} as const;

type EnemyStateType = typeof EnemyState[keyof typeof EnemyState];


export class EnemyController {
  private model: THREE.Object3D;
  private physicsWorld: PhysicsWorld;
  private bodyHandle: RAPIER.RigidBodyHandle;
  private animationManager: AnimationManager;
  private animationStateMachine: CharacterAnimationStateMachine;
  private healthComponent: HealthComponent;
  private attackComponent: AttackComponent;

  private currentState: EnemyStateType = EnemyState.IDLE;
  private target: any = null;
  private velocity: THREE.Vector3 = new THREE.Vector3();
  private desiredVelocity: THREE.Vector3 = new THREE.Vector3();
  private facing: number = 0;

  private isGrounded: boolean = false;
  private isAttacking: boolean = false;
  private isHit: boolean = false;
  private hitStunTimer: number = 0;
  private attackWindupTimer: number = 0;

  constructor(
    model: THREE.Object3D,
    position: THREE.Vector3,
    physicsWorld: PhysicsWorld,
    animationManager: AnimationManager
  ) {
    this.model = model;
    this.physicsWorld = physicsWorld;
    this.animationManager = animationManager;
    this.animationStateMachine = new CharacterAnimationStateMachine(animationManager);

    this.bodyHandle = physicsWorld.createDynamicBody(position, ENEMY.MASS, 'capsule');
    physicsWorld.linkBody(model, this.bodyHandle);

    this.healthComponent = new HealthComponent(ENEMY.MAX_HEALTH);
    this.healthComponent.onDeath(() => this.onDeath());

    this.attackComponent = new AttackComponent(
      ENEMY.ATTACK_RANGE,
      ENEMY.ATTACK_DAMAGE,
      ENEMY.ATTACK_KNOCKBACK,
      ENEMY.ATTACK_COOLDOWN,
      0.5
    );
  }

  setTarget(target: any): void {
    this.target = target;
  }

  update(deltaTime: number): void {
    this.animationManager.update(deltaTime);
    this.attackComponent.update();

    this.isGrounded = this.physicsWorld.isGrounded(this.bodyHandle);

    if (this.isHit) {
      this.hitStunTimer -= deltaTime;
      if (this.hitStunTimer <= 0) {
        this.isHit = false;
      }
    }

    this.updateAIState(deltaTime);

    this.isAttacking = this.attackComponent.getIsAttacking();
    const speed = this.velocity.length();
    this.animationStateMachine.update(
      this.currentState === EnemyState.CHASE,
      false,
      !this.isGrounded,
      this.isAttacking,
      speed
    );

    if (this.currentState === EnemyState.CHASE || this.currentState === EnemyState.ATTACK) {
      if (this.target) {
        const dirToTarget = this.target
          .getWorldPosition()
          .clone()
          .sub(this.model.position);
        dirToTarget.y = 0;

        if (dirToTarget.length() > 0.1) {
          this.facing = Math.atan2(dirToTarget.x, dirToTarget.z);
          const targetQuaternion = new THREE.Quaternion();
          targetQuaternion.setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            this.facing
          );
          this.model.quaternion.slerp(targetQuaternion, 1 - Math.exp(-ENEMY.ROTATION_SPEED * deltaTime));
        }
      }
    }
  }

  private updateAIState(deltaTime: number): void {
    if (this.healthComponent.getIsDead()) {
      this.currentState = EnemyState.DEAD;
      return;
    }

    if (this.isHit) {
      this.currentState = EnemyState.HIT;
      return;
    }

    const distanceToTarget = this.target
      ? this.model.position.distanceTo(this.target.getWorldPosition())
      : Infinity;

    switch (this.currentState) {
      case EnemyState.IDLE:
        this.updateIdle(distanceToTarget, deltaTime);
        break;
      case EnemyState.CHASE:
        this.updateChase(distanceToTarget, deltaTime);
        break;
      case EnemyState.ATTACK:
        this.updateAttack(distanceToTarget, deltaTime);
        break;
      case EnemyState.HIT:
        if (!this.isHit) {
          this.currentState = EnemyState.CHASE;
        }
        break;
      case EnemyState.DEAD:
        break;
    }
  }

  private updateIdle(distanceToTarget: number, deltaTime: number): void {
    this.applyHorizontalVelocity(new THREE.Vector3(), deltaTime, ENEMY.DECELERATION);

    if (this.target && distanceToTarget < ENEMY.DETECTION_RADIUS) {
      this.currentState = EnemyState.CHASE;
    }
  }

  private updateChase(distanceToTarget: number, deltaTime: number): void {
    if (!this.target) {
      this.currentState = EnemyState.IDLE;
      return;
    }

    if (distanceToTarget < ENEMY.ATTACK_RANGE + 0.5) {
      this.currentState = EnemyState.ATTACK;
      return;
    }

    const dirToTarget = this.target
      .getWorldPosition()
      .clone()
      .sub(this.model.position);
    dirToTarget.y = 0;
    dirToTarget.normalize();

    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.model.quaternion);
    forward.y = 0;
    forward.normalize();
    const alignment = THREE.MathUtils.clamp((forward.dot(dirToTarget) + 1) * 0.5, 0.25, 1);
    this.desiredVelocity.copy(dirToTarget).multiplyScalar(ENEMY.SPEED * alignment);
    this.applyHorizontalVelocity(this.desiredVelocity, deltaTime, ENEMY.ACCELERATION);
  }

  private updateAttack(distanceToTarget: number, deltaTime: number): void {
    if (!this.target) {
      this.currentState = EnemyState.IDLE;
      return;
    }

    this.applyHorizontalVelocity(new THREE.Vector3(), deltaTime, ENEMY.DECELERATION);

    if (distanceToTarget > ENEMY.ATTACK_RANGE + 2) {
      this.currentState = EnemyState.CHASE;
      this.attackWindupTimer = 0;
      return;
    }

    if (this.attackComponent.canAttack()) {
      this.attackWindupTimer += deltaTime;
      if (this.attackWindupTimer >= ENEMY.ATTACK_WINDUP) {
        this.performAttack();
        this.attackWindupTimer = 0;
      }
    } else {
      this.attackWindupTimer = 0;
    }
  }

  private applyHorizontalVelocity(targetVelocity: THREE.Vector3, deltaTime: number, response: number): void {
    const currentVelocity = this.physicsWorld.getVelocity(this.bodyHandle);
    const horizontalVelocity = new THREE.Vector3(currentVelocity.x, 0, currentVelocity.z);
    horizontalVelocity.lerp(targetVelocity, 1 - Math.exp(-response * deltaTime));

    const halfArena = SCENE.ARENA_SIZE / 2 - 1;
    const position = this.physicsWorld.getPosition(this.bodyHandle);
    if (Math.abs(position.x) > halfArena || Math.abs(position.z) > halfArena) {
      position.x = THREE.MathUtils.clamp(position.x, -halfArena, halfArena);
      position.z = THREE.MathUtils.clamp(position.z, -halfArena, halfArena);
      this.physicsWorld.setPosition(this.bodyHandle, position);
      horizontalVelocity.multiplyScalar(0.35);
    }

    this.velocity.set(horizontalVelocity.x, 0, horizontalVelocity.z);
    this.physicsWorld.setVelocity(
      this.bodyHandle,
      new THREE.Vector3(horizontalVelocity.x, currentVelocity.y, horizontalVelocity.z)
    );
  }

  private performAttack(): void {
    this.attackComponent.performAttack();
    this.isAttacking = true;
    this.animationStateMachine.playAction('attack');

    if (this.target) {
      const distanceToTarget = this.model.position.distanceTo(
        this.target.getWorldPosition()
      );

      if (distanceToTarget < this.attackComponent.getAttackRange()) {
        const knockbackDir = this.target
          .getWorldPosition()
          .clone()
          .sub(this.model.position)
          .normalize();

        const damageInfo: DamageInfo = {
          damage: this.attackComponent.getAttackDamage(),
          knockback: this.attackComponent.getAttackKnockback(),
          knockbackDirection: knockbackDir,
          stun: COMBAT.HITSTUN_DURATION,
        };

        this.target.takeDamage(damageInfo);
      }
    }
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
    knockbackForce.y = 0;
    this.physicsWorld.applyImpulse(this.bodyHandle, knockbackForce);
  }

  private onDeath(): void {
    console.log('Enemy defeated!');
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

  getCurrentState(): string {
    return this.currentState;
  }
}
