import * as THREE from 'three';
import { Renderer } from '../core/Renderer';
import { SCENE } from '../utils/Constants';

/**
 * Collectible coins scattered around the map. Coins spin + bob; when the
 * player touches one it's collected and relocated elsewhere, so the field
 * stays populated for an endless run. Purely presentational + proximity —
 * no physics bodies.
 */
export class CoinField {
  private renderer: Renderer;
  private group: THREE.Group;
  private geometry: THREE.CylinderGeometry;
  private material: THREE.MeshStandardMaterial;
  private coins: THREE.Group[] = [];
  private elapsed: number = 0;

  private readonly baseY = 0.9;
  private readonly collectRadius = 1.1;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
    this.group = new THREE.Group();
    this.renderer.add(this.group);

    this.geometry = new THREE.CylinderGeometry(0.34, 0.34, 0.08, 18);
    this.material = new THREE.MeshStandardMaterial({
      color: 0xffcf3f,
      metalness: 0.7,
      roughness: 0.28,
      emissive: 0x6a4a00,
      emissiveIntensity: 0.45,
    });
  }

  private outerSampler?: () => THREE.Vector2;
  private outerShare = 0;

  spawn(count: number): void {
    this.clear();
    for (let i = 0; i < count; i++) {
      const coin = new THREE.Group();
      const disc = new THREE.Mesh(this.geometry, this.material);
      disc.rotation.x = Math.PI / 2; // stand the coin vertical
      disc.castShadow = true;
      coin.add(disc);
      coin.userData.phase = Math.random() * Math.PI * 2;
      this.placeRandomly(coin);
      this.group.add(coin);
      this.coins.push(coin);
    }
  }

  /**
   * Advance animation and collect any coins the player is touching. Returns
   * how many were collected this frame.
   */
  update(deltaTime: number, playerPos: THREE.Vector3): number {
    this.elapsed += deltaTime;
    let collected = 0;

    for (const coin of this.coins) {
      coin.rotation.y += deltaTime * 3.2;
      coin.position.y = this.baseY + Math.sin(this.elapsed * 2.2 + coin.userData.phase) * 0.12;

      const dx = coin.position.x - playerPos.x;
      const dz = coin.position.z - playerPos.z;
      if (dx * dx + dz * dz < this.collectRadius * this.collectRadius) {
        collected++;
        this.placeRandomly(coin); // relocate so the field stays full
      }
    }

    return collected;
  }

  /** Optional extra spawn area (e.g. the outer district) used for a share of coins. */
  setOuterSampler(sampler: () => THREE.Vector2, share: number): void {
    this.outerSampler = sampler;
    this.outerShare = share;
  }

  private placeRandomly(coin: THREE.Group): void {
    if (this.outerSampler && Math.random() < this.outerShare) {
      const p = this.outerSampler();
      coin.position.set(p.x, this.baseY, p.y);
      return;
    }
    const half = SCENE.ARENA_SIZE / 2 - 4;
    coin.position.set(
      (Math.random() * 2 - 1) * half,
      this.baseY,
      (Math.random() * 2 - 1) * half
    );
  }

  clear(): void {
    for (const coin of this.coins) this.group.remove(coin);
    this.coins = [];
  }
}
