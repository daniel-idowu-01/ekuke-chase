import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { AnimationManager, CharacterAnimationStateMachine } from '../animation/AnimationManager';
import { ENEMY, SCENE } from '../utils/Constants';

const EnemyState = {
  IDLE: 'idle',
  PATROL: 'patrol',
  ALERT: 'alert',
  CHASE: 'chase',
  CAUGHT: 'caught',
} as const;

type EnemyStateType = typeof EnemyState[keyof typeof EnemyState];


export class EnemyController {
  private model: THREE.Object3D;
  private physicsWorld: PhysicsWorld;
  private bodyHandle: RAPIER.RigidBodyHandle;
  private animationManager: AnimationManager;
  private animationStateMachine: CharacterAnimationStateMachine;

  private currentState: EnemyStateType = EnemyState.IDLE;
  private target: any = null;
  private velocity: THREE.Vector3 = new THREE.Vector3();
  private desiredVelocity: THREE.Vector3 = new THREE.Vector3();
  private facing: number = 0;

  private isGrounded: boolean = false;
  private catchRadius: number = ENEMY.CATCH_RADIUS;
  private stateTimer: number = 0;
  private patrolTimer: number = 0;
  private loseInterestTimer: number = 0;
  private patrolTarget: THREE.Vector3 = new THREE.Vector3();

  constructor(
    model: THREE.Object3D,
    position: THREE.Vector3,
    physicsWorld: PhysicsWorld,
    animationManager: AnimationManager,
    colliderDims?: { hx: number; hy: number; hz: number },
    catchRadius?: number
  ) {
    this.model = model;
    this.physicsWorld = physicsWorld;
    this.animationManager = animationManager;
    this.animationStateMachine = new CharacterAnimationStateMachine(animationManager);

    this.bodyHandle = physicsWorld.createDynamicBody(position, ENEMY.MASS, 'dog', colliderDims);
    physicsWorld.linkBody(model, this.bodyHandle);

    if (catchRadius !== undefined) this.catchRadius = catchRadius;
  }

  setTarget(target: any): void {
    this.target = target;
  }

  update(deltaTime: number): void {
    this.animationManager.update(deltaTime);
    this.isGrounded = this.physicsWorld.isGrounded(this.bodyHandle);

    this.updateAIState(deltaTime);

    // While caught, let the one-shot lunge/bite play instead of locomotion.
    if (this.currentState !== EnemyState.CAUGHT) {
      const speed = this.velocity.length();
      const isChasing = this.currentState === EnemyState.CHASE;
      this.animationStateMachine.update(
        speed > 0.3,
        isChasing,
        !this.isGrounded,
        speed
      );
    }
  }

  private setState(next: EnemyStateType): void {
    this.currentState = next;
    this.stateTimer = 0;
  }

  private updateAIState(deltaTime: number): void {
    this.stateTimer += deltaTime;

    const distanceToTarget = this.target
      ? this.model.position.distanceTo(this.target.getWorldPosition())
      : Infinity;

    switch (this.currentState) {
      case EnemyState.IDLE:
        this.updateIdle(distanceToTarget, deltaTime);
        break;
      case EnemyState.PATROL:
        this.updatePatrol(distanceToTarget, deltaTime);
        break;
      case EnemyState.ALERT:
        this.updateAlert(distanceToTarget, deltaTime);
        break;
      case EnemyState.CHASE:
        this.updateChase(distanceToTarget, deltaTime);
        break;
      case EnemyState.CAUGHT:
        this.stop(deltaTime);
        break;
    }
  }

  private updateIdle(distanceToTarget: number, deltaTime: number): void {
    this.stop(deltaTime);

    if (distanceToTarget < ENEMY.DETECTION_RADIUS) {
      this.setState(EnemyState.ALERT);
      return;
    }

    if (this.stateTimer >= ENEMY.IDLE_DURATION) {
      this.pickPatrolTarget();
      this.setState(EnemyState.PATROL);
    }
  }

  private updatePatrol(distanceToTarget: number, deltaTime: number): void {
    if (distanceToTarget < ENEMY.DETECTION_RADIUS) {
      this.setState(EnemyState.ALERT);
      return;
    }

    const toTarget = this.patrolTarget.clone().sub(this.model.position);
    toTarget.y = 0;
    const distance = toTarget.length();

    this.patrolTimer += deltaTime;
    if (distance < ENEMY.PATROL_REACH_DISTANCE || this.patrolTimer >= ENEMY.PATROL_REPICK_TIME) {
      this.setState(EnemyState.IDLE);
      return;
    }

    const dir = toTarget.normalize();
    this.faceTowards(dir, deltaTime);
    this.desiredVelocity.copy(dir).multiplyScalar(ENEMY.PATROL_SPEED);
    this.applyHorizontalVelocity(this.desiredVelocity, deltaTime, ENEMY.ACCELERATION);
  }

  private updateAlert(distanceToTarget: number, deltaTime: number): void {
    this.stop(deltaTime);

    // Lost sight before committing — give up and wander again.
    if (distanceToTarget > ENEMY.DETECTION_RADIUS * 1.4) {
      this.setState(EnemyState.PATROL);
      this.pickPatrolTarget();
      return;
    }

    if (this.target) {
      const dir = this.directionToTarget();
      this.faceTowards(dir, deltaTime);
    }

    if (this.stateTimer >= ENEMY.ALERT_DURATION) {
      this.setState(EnemyState.CHASE);
    }
  }

  private updateChase(distanceToTarget: number, deltaTime: number): void {
    if (!this.target) {
      this.setState(EnemyState.IDLE);
      return;
    }

    if (distanceToTarget <= this.catchRadius) {
      this.setState(EnemyState.CAUGHT);
      this.animationStateMachine.playAction('attack'); // lunge/bite on the catch
      this.stop(deltaTime);
      return;
    }

    // Track how long the player has stayed out of reach; eventually give up.
    if (distanceToTarget > ENEMY.LOSE_INTEREST_RADIUS) {
      this.loseInterestTimer += deltaTime;
      if (this.loseInterestTimer >= ENEMY.LOSE_INTEREST_TIME) {
        this.loseInterestTimer = 0;
        this.setState(EnemyState.PATROL);
        this.pickPatrolTarget();
        return;
      }
    } else {
      this.loseInterestTimer = 0;
    }

    const dir = this.directionToTarget();
    this.faceTowards(dir, deltaTime);
    this.desiredVelocity.copy(dir).multiplyScalar(ENEMY.SPEED);
    this.applyHorizontalVelocity(this.desiredVelocity, deltaTime, ENEMY.ACCELERATION);
  }

  private stop(deltaTime: number): void {
    this.applyHorizontalVelocity(new THREE.Vector3(), deltaTime, ENEMY.DECELERATION);
  }

  private directionToTarget(): THREE.Vector3 {
    const dir = this.target.getWorldPosition().clone().sub(this.model.position);
    dir.y = 0;
    if (dir.lengthSq() > 0.0001) dir.normalize();
    return dir;
  }

  private pickPatrolTarget(): void {
    const half = SCENE.ARENA_SIZE / 2 - 2;
    this.patrolTarget.set(
      (Math.random() * 2 - 1) * half,
      this.model.position.y,
      (Math.random() * 2 - 1) * half
    );
    this.patrolTimer = 0;
  }

  private faceTowards(dir: THREE.Vector3, deltaTime: number): void {
    if (dir.lengthSq() < 0.0001) return;
    this.facing = Math.atan2(dir.x, dir.z);
    const targetQuaternion = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      this.facing
    );
    this.model.quaternion.slerp(targetQuaternion, 1 - Math.exp(-ENEMY.ROTATION_SPEED * deltaTime));
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

  hasCaughtPlayer(): boolean {
    return this.currentState === EnemyState.CAUGHT;
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

  getCurrentState(): string {
    return this.currentState;
  }
}
