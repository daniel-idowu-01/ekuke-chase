import * as THREE from 'three';
import { ANIMATION } from '../utils/Constants';

export interface AnimationState {
  name: string;
  weight: number;
  speed: number;
  loop: typeof THREE.LoopOnce | typeof THREE.LoopRepeat | typeof THREE.LoopPingPong;
  clampWhenFinished?: boolean;
}


export class AnimationManager {
  private mixer: THREE.AnimationMixer;
  private animations: Map<string, THREE.AnimationAction> = new Map();
  private currentState: string = 'idle';
  private transitionDuration: number = ANIMATION.FADE_DURATION;
  private activeAction: THREE.AnimationAction | null = null;

  constructor(model: THREE.Object3D, animations: THREE.AnimationClip[]) {
    this.mixer = new THREE.AnimationMixer(model);

    for (const clip of animations) {
      const action = this.mixer.clipAction(clip);
      this.animations.set(clip.name, action);
    }
  }

  play(
    stateName: string,
    speed: number = 1,
    loop: typeof THREE.LoopOnce | typeof THREE.LoopRepeat | typeof THREE.LoopPingPong = THREE.LoopRepeat,
    fadeIn: boolean = true
  ): void {
    if (this.currentState === stateName) {
      this.setSpeed(stateName, speed);
      return;
    }

    const action = this.animations.get(stateName);
    if (!action) {
      console.warn(`Animation '${stateName}' not found`);
      return;
    }

    if (fadeIn && this.activeAction && this.activeAction !== action) {
      this.activeAction.fadeOut(this.transitionDuration);
    } else if (!fadeIn) {
      this.mixer.stopAllAction();
    }

    action.reset();
    action.loop = loop;
    action.clampWhenFinished = loop === THREE.LoopOnce;
    action.timeScale = speed;
    action.enabled = true;
    action.setEffectiveWeight(1);

    if (fadeIn) {
      action.fadeIn(this.transitionDuration);
    } else {
      action.reset();
    }

    action.play();
    this.activeAction = action;
    this.currentState = stateName;
  }

  getCurrentState(): string {
    return this.currentState;
  }

  isAnimationFinished(stateName: string): boolean {
    const action = this.animations.get(stateName);
    if (!action) return false;

    return action.timeScale > 0
      ? action.time >= action.getClip().duration
      : false;
  }

  setSpeed(stateName: string, speed: number): void {
    const action = this.animations.get(stateName);
    if (action) {
      action.timeScale = speed;
    }
  }

  getAnimationDuration(stateName: string): number {
    const action = this.animations.get(stateName);
    if (action) {
      return action.getClip().duration;
    }
    return 0;
  }

  getAnimationTime(stateName: string): number {
    const action = this.animations.get(stateName);
    if (action) {
      return action.time;
    }
    return 0;
  }

  stop(stateName: string, fade: boolean = true): void {
    const action = this.animations.get(stateName);
    if (action) {
      if (fade) {
        action.fadeOut(this.transitionDuration);
      } else {
        action.stop();
      }
      if (this.activeAction === action) {
        this.activeAction = null;
      }
    }
  }

  stopAll(): void {
    this.mixer.stopAllAction();
    this.activeAction = null;
  }

  update(deltaTime: number): void {
    this.mixer.update(deltaTime);
  }

  setTransitionDuration(duration: number): void {
    this.transitionDuration = duration;
  }

  getMixer(): THREE.AnimationMixer {
    return this.mixer;
  }

  getAvailableAnimations(): string[] {
    return Array.from(this.animations.keys());
  }
}


export class CharacterAnimationStateMachine {
  private animationManager: AnimationManager;
  private currentState: string = 'idle';

  constructor(animationManager: AnimationManager) {
    this.animationManager = animationManager;
  }

  update(
    isMoving: boolean,
    isSprinting: boolean,
    isJumping: boolean,
    isAttacking: boolean,
    speed: number
  ): void {
    let nextState = this.currentState;

    if (isAttacking) {
      nextState = 'attack';
    } else if (isJumping) {
      nextState = 'jump';
    } else if (isMoving) {
      if (isSprinting || speed > 7.5) {
        nextState = 'sprint';
      } else if (speed > 3.25) {
        nextState = 'run';
      } else {
        nextState = 'walk';
      }
    } else {
      nextState = 'idle';
    }

    if (nextState !== this.currentState) {
      this.transitionTo(nextState);
    }

    if (nextState === 'walk' || nextState === 'run' || nextState === 'sprint') {
      const maxSpeed = isSprinting ? 11 : 7;
      const speedRatio = Math.min(speed / maxSpeed, 1);
      const baseSpeed = nextState === 'walk'
        ? ANIMATION.WALK_SPEED
        : nextState === 'sprint'
          ? ANIMATION.SPRINT_SPEED
          : ANIMATION.RUN_SPEED;
      this.animationManager.setSpeed(
        nextState,
        THREE.MathUtils.clamp(baseSpeed * (0.75 + speedRatio * 0.45), 0.75, 2.25)
      );
    }
  }

  private transitionTo(state: string): void {
    this.currentState = state;
    this.animationManager.play(state);
  }

  playAction(action: string, speed: number = 1): void {
    this.animationManager.play(action, speed, THREE.LoopOnce, true);
  }

  getCurrentState(): string {
    return this.currentState;
  }
}
