// NOTE: This file used to hold the combat system (Health/Attack/damage).
// The game pivoted to a pure survive/evade chase, so combat was stripped.
// The depletable-resource component pattern is repurposed here as the
// player's sprint stamina. The folder name is kept for now to limit churn;
// it can be renamed (e.g. to `components/`) in a later pass.

/**
 * Drives the player's sprint stamina: drains while sprinting, regenerates
 * after a short delay when not. Once fully drained the player becomes
 * "exhausted" and cannot sprint again until stamina recovers past a
 * threshold — this stops sprint from being tapped on/off every frame at 0.
 */
export class StaminaComponent {
  private max: number;
  private current: number;
  private drainRate: number;
  private regenRate: number;
  private regenDelay: number;
  private recoverThreshold: number;
  private timeSinceDrain: number = 0;
  private exhausted: boolean = false;

  constructor(
    max: number,
    drainRate: number,
    regenRate: number,
    regenDelay: number,
    recoverThreshold: number
  ) {
    this.max = max;
    this.current = max;
    this.drainRate = drainRate;
    this.regenRate = regenRate;
    this.regenDelay = regenDelay;
    this.recoverThreshold = recoverThreshold;
  }

  /** Whether sprinting is currently allowed (has stamina and not exhausted). */
  canSprint(): boolean {
    return !this.exhausted && this.current > 0;
  }

  /**
   * Advance stamina one step. `wantSprint` is the raw player intent; the
   * returned boolean is whether the player is *actually* sprinting after
   * stamina gating, so callers should use it to pick movement speed.
   */
  update(deltaTime: number, wantSprint: boolean): boolean {
    const sprinting = wantSprint && this.canSprint();

    if (sprinting) {
      this.current = Math.max(0, this.current - this.drainRate * deltaTime);
      this.timeSinceDrain = 0;
      if (this.current <= 0) {
        this.exhausted = true;
      }
    } else {
      this.timeSinceDrain += deltaTime;
      if (this.timeSinceDrain >= this.regenDelay) {
        this.current = Math.min(this.max, this.current + this.regenRate * deltaTime);
      }
      if (this.exhausted && this.current >= this.max * this.recoverThreshold) {
        this.exhausted = false;
      }
    }

    return sprinting;
  }

  getRatio(): number {
    return this.current / this.max;
  }

  getIsExhausted(): boolean {
    return this.exhausted;
  }

  reset(): void {
    this.current = this.max;
    this.exhausted = false;
    this.timeSinceDrain = 0;
  }
}
