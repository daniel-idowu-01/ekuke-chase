import * as THREE from 'three';

export interface Skin {
  id: string;
  name: string;
  cost: number;
  /** Paint colour applied to the model, or null for the model's default look. */
  color: number | null;
}

// Player skins. "default" is free and owned from the start; the rest are
// bought with coins. Colours are a flat repaint of the robot's materials.
export const PLAYER_SKINS: Skin[] = [
  { id: 'default', name: 'Classic', cost: 0, color: null },
  { id: 'crimson', name: 'Crimson', cost: 20, color: 0xe2574c },
  { id: 'azure', name: 'Azure', cost: 35, color: 0x4b86e2 },
  { id: 'emerald', name: 'Emerald', cost: 45, color: 0x36d07b },
  { id: 'gold', name: 'Gold', cost: 70, color: 0xf2b134 },
  { id: 'violet', name: 'Violet', cost: 90, color: 0x9b5de5 },
];

export function getSkin(id: string): Skin {
  return PLAYER_SKINS.find((s) => s.id === id) ?? PLAYER_SKINS[0];
}

/**
 * Repaint a loaded character to a skin colour. Clones each material so the
 * shared/cached GLB materials aren't mutated. A null colour leaves the model
 * as-is (default skin).
 */
export function applySkin(model: THREE.Object3D, color: number | null): void {
  if (color === null) return;
  const tint = new THREE.Color(color);

  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const paint = (mat: THREE.Material): THREE.Material => {
      const cloned = mat.clone() as THREE.MeshStandardMaterial;
      if (cloned.color) cloned.color.copy(tint);
      return cloned;
    };
    child.material = Array.isArray(child.material)
      ? child.material.map(paint)
      : paint(child.material);
  });
}
