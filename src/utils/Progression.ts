/**
 * Persistent player progression (coins wallet + owned/selected skins) backed
 * by localStorage. All access is guarded so private-mode / storage failures
 * degrade gracefully to in-session defaults.
 */
const COINS_KEY = 'ekuke-chase:coins';
const OWNED_KEY = 'ekuke-chase:skins-owned';
const SELECTED_KEY = 'ekuke-chase:skin';

export const Progression = {
  getCoins(): number {
    try {
      const n = parseInt(localStorage.getItem(COINS_KEY) ?? '0', 10);
      return Number.isFinite(n) ? Math.max(0, n) : 0;
    } catch {
      return 0;
    }
  },

  setCoins(value: number): void {
    try {
      localStorage.setItem(COINS_KEY, String(Math.max(0, Math.floor(value))));
    } catch {
      // storage unavailable
    }
  },

  addCoins(amount: number): void {
    this.setCoins(this.getCoins() + amount);
  },

  getOwnedSkins(): string[] {
    try {
      const parsed = JSON.parse(localStorage.getItem(OWNED_KEY) ?? '[]');
      const owned = Array.isArray(parsed) ? (parsed as string[]) : [];
      return owned.includes('default') ? owned : ['default', ...owned];
    } catch {
      return ['default'];
    }
  },

  ownsSkin(id: string): boolean {
    return this.getOwnedSkins().includes(id);
  },

  ownSkin(id: string): void {
    const owned = this.getOwnedSkins();
    if (!owned.includes(id)) {
      owned.push(id);
      try {
        localStorage.setItem(OWNED_KEY, JSON.stringify(owned));
      } catch {
        // storage unavailable
      }
    }
  },

  getSelectedSkin(): string {
    try {
      return localStorage.getItem(SELECTED_KEY) ?? 'default';
    } catch {
      return 'default';
    }
  },

  setSelectedSkin(id: string): void {
    try {
      localStorage.setItem(SELECTED_KEY, id);
    } catch {
      // storage unavailable
    }
  },
};
