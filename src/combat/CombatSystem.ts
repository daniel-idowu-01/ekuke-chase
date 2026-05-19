import * as THREE from 'three';
import { COMBAT } from '../utils/Constants';

export interface CombatEvent {
  type: 'attack' | 'hit' | 'kill';
  attacker: any;
  defender: any;
  damage: number;
  knockback?: THREE.Vector3;
}

export interface DamageInfo {
  damage: number;
  knockback: number;
  knockbackDirection: THREE.Vector3;
  stun: number;
}


export class CombatSystem {
  private combatEventListeners: ((event: CombatEvent) => void)[] = [];

  onCombatEvent(callback: (event: CombatEvent) => void): void {
    this.combatEventListeners.push(callback);
  }

  private emitEvent(event: CombatEvent): void {
    this.combatEventListeners.forEach((callback) => callback(event));
  }

  attack(): void {
    const targets = this.findTargetsInRange();

    targets.forEach((target) => {
      const damage: DamageInfo = {
        damage: 0,
        knockback: 0,
        knockbackDirection: new THREE.Vector3(0, 0, 1),
        stun: COMBAT.HITSTUN_DURATION,
      };

      target.takeDamage(damage);

      this.emitEvent({
        type: 'hit',
        attacker: null,
        defender: target,
        damage: 0,
        knockback: damage.knockbackDirection,
      });
    });
  }

  private findTargetsInRange(): any[] {
    return [];
  }

  applyDamage(character: any, damageInfo: DamageInfo): void {
    character.takeDamage(damageInfo);
  }
}


export class HealthComponent {
  private maxHealth: number;
  private currentHealth: number;
  private isDead: boolean = false;
  private deathCallbacks: (() => void)[] = [];
  private damageCallbacks: ((damage: number) => void)[] = [];

  constructor(maxHealth: number) {
    this.maxHealth = maxHealth;
    this.currentHealth = maxHealth;
  }

  takeDamage(amount: number): void {
    if (this.isDead) return;

    this.currentHealth = Math.max(0, this.currentHealth - amount);

    this.damageCallbacks.forEach((cb) => cb(amount));

    if (this.currentHealth <= 0) {
      this.die();
    }
  }

  heal(amount: number): void {
    this.currentHealth = Math.min(this.maxHealth, this.currentHealth + amount);
  }

  private die(): void {
    if (this.isDead) return;
    this.isDead = true;
    this.deathCallbacks.forEach((cb) => cb());
  }

  getIsDead(): boolean {
    return this.isDead;
  }

  getHealthRatio(): number {
    return this.currentHealth / this.maxHealth;
  }

  getCurrentHealth(): number {
    return this.currentHealth;
  }

  getMaxHealth(): number {
    return this.maxHealth;
  }

  onDeath(callback: () => void): void {
    this.deathCallbacks.push(callback);
  }

  onDamage(callback: (damage: number) => void): void {
    this.damageCallbacks.push(callback);
  }

  revive(): void {
    this.isDead = false;
    this.currentHealth = this.maxHealth;
  }
}


export class AttackComponent {
  private attackRange: number;
  private attackDamage: number;
  private attackKnockback: number;
  private attackCooldown: number;
  private lastAttackTime: number = 0;
  private isAttacking: boolean = false;
  private attackDuration: number;
  private attackStartTime: number = 0;
  private comboCount: number = 0;
  private lastComboTime: number = 0;

  constructor(
    range: number = COMBAT.ATTACK_RANGE,
    damage: number = COMBAT.ATTACK_DAMAGE,
    knockback: number = COMBAT.ATTACK_KNOCKBACK,
    cooldown: number = COMBAT.ATTACK_COOLDOWN,
    attackDuration: number = COMBAT.ATTACK_DURATION
  ) {
    this.attackRange = range;
    this.attackDamage = damage;
    this.attackKnockback = knockback;
    this.attackCooldown = cooldown;
    this.attackDuration = attackDuration;
  }

  canAttack(): boolean {
    return Date.now() - this.lastAttackTime > this.attackCooldown * 1000;
  }

  performAttack(): void {
    if (!this.canAttack()) return;

    this.lastAttackTime = Date.now();
    this.isAttacking = true;
    this.attackStartTime = Date.now();

    const timeSinceLastCombo = (Date.now() - this.lastComboTime) / 1000;
    if (timeSinceLastCombo > COMBAT.COMBO_WINDOW) {
      this.comboCount = 1;
    } else {
      this.comboCount = Math.min(
        this.comboCount + 1,
        COMBAT.MAX_COMBO
      );
    }
    this.lastComboTime = Date.now();
  }

  getIsAttacking(): boolean {
    const attackElapsed =
      (Date.now() - this.attackStartTime) / 1000;
    if (attackElapsed > this.attackDuration) {
      this.isAttacking = false;
    }
    return this.isAttacking;
  }

  getAttackRange(): number {
    return this.attackRange;
  }

  getAttackDamage(): number {
    return this.attackDamage;
  }

  getAttackKnockback(): number {
    return this.attackKnockback;
  }

  getComboCount(): number {
    return this.comboCount;
  }

  getComboMultiplier(): number {
    return 1 + (this.comboCount - 1) * 0.2;
  }

  update(): void {
    if (this.isAttacking) {
      const elapsed = (Date.now() - this.attackStartTime) / 1000;
      if (elapsed > this.attackDuration) {
        this.isAttacking = false;
      }
    }
  }
}
