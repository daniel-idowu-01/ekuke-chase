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
  private facing: number = 0;

  private isGrounded: boolean = false;
  private isAttacking: boolean = false;
  private isHit: boolean = false;
  private hitStunTimer: number = 0;

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

    this.updateAIState();

    this.isAttacking = this.attackComponent.getIsAttacking();
    const speed = this.velocity.length();
    this.animationStateMachine.update(
      this.currentState === EnemyState.CHASE,
      false,
      !this.isGrounded,
      this.isAttacking,
      speed
    );

    if (
      this.currentState === EnemyState.CHASE ||
      this.currentState === EnemyState.ATTACK
    ) {
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
          this.model.quaternion.slerp(targetQuaternion, 0.1);
        }
      }
    }
  }

  private updateAIState(): void {
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
        this.updateIdle(distanceToTarget);
        break;
      case EnemyState.CHASE:
        this.updateChase(distanceToTarget);
        break;
      case EnemyState.ATTACK:
        this.updateAttack(distanceToTarget);
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

  private updateIdle(distanceToTarget: number): void {
    this.physicsWorld.setVelocity(this.bodyHandle, new THREE.Vector3(0, this.velocity.y, 0));
    this.velocity = new THREE.Vector3(0, this.velocity.y, 0);

    if (this.target && distanceToTarget < ENEMY.DETECTION_RADIUS) {
      this.currentState = EnemyState.CHASE;
    }
  }

  private updateChase(distanceToTarget: number): void {
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

    const move = dirToTarget.clone().multiplyScalar(ENEMY.SPEED * 0.65 * (1 / 60));
    const nextPosition = this.model.position.clone().add(move);
    const halfArena = SCENE.ARENA_SIZE / 2 - 1;
    nextPosition.x = THREE.MathUtils.clamp(nextPosition.x, -halfArena, halfArena);
    nextPosition.z = THREE.MathUtils.clamp(nextPosition.z, -halfArena, halfArena);

    this.model.position.copy(nextPosition);
    this.physicsWorld.setPosition(this.bodyHandle, nextPosition);
    this.velocity.copy(dirToTarget).multiplyScalar(ENEMY.SPEED * 0.65);
    this.physicsWorld.setVelocity(this.bodyHandle, this.velocity);
  }

  private updateAttack(distanceToTarget: number): void {
    if (!this.target) {
      this.currentState = EnemyState.IDLE;
      return;
    }

    this.physicsWorld.setVelocity(this.bodyHandle, new THREE.Vector3(0, this.velocity.y, 0));
    this.velocity = new THREE.Vector3(0, this.velocity.y, 0);

    if (distanceToTarget > ENEMY.ATTACK_RANGE + 2) {
      this.currentState = EnemyState.CHASE;
      return;
    }

    if (this.attackComponent.canAttack()) {
      this.performAttack();
    }
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
