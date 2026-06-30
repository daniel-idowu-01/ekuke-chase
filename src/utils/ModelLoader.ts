import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Loads a GLB once into memory, then hands out fresh, independent instances
 * (own scene graph + own animation clips) via `instantiate()`. Parsing from a
 * cached ArrayBuffer keeps restarts cheap and avoids skinned-mesh clone
 * pitfalls, since each parse builds a clean skeleton.
 */
export class CharacterModel {
  private static loader = new GLTFLoader();
  private url: string;
  private buffer: ArrayBuffer | null = null;

  constructor(url: string) {
    this.url = url;
  }

  async preload(): Promise<void> {
    if (this.buffer) return;
    const response = await fetch(this.url);
    if (!response.ok) {
      throw new Error(`Failed to load model "${this.url}": ${response.status} ${response.statusText}`);
    }
    this.buffer = await response.arrayBuffer();
  }

  instantiate(): Promise<GLTF> {
    if (!this.buffer) {
      return Promise.reject(new Error(`Model "${this.url}" not preloaded; call preload() first.`));
    }
    // Parse a copy so repeated instantiations never share/consume a buffer.
    const data = this.buffer.slice(0);
    return new Promise<GLTF>((resolve, reject) => {
      CharacterModel.loader.parse(data, '', resolve, reject);
    });
  }
}

/**
 * Remap a GLB's own clip names onto the game's animation-state vocabulary
 * (idle/walk/run/sprint/jump/...). Clips are cloned so two states can safely
 * reuse one source clip (e.g. run + sprint both driven by "Running").
 */
export function remapAnimationClips(
  source: THREE.AnimationClip[],
  mapping: Record<string, string>
): THREE.AnimationClip[] {
  const byName = new Map(source.map((clip) => [clip.name, clip]));
  const out: THREE.AnimationClip[] = [];

  for (const [state, clipName] of Object.entries(mapping)) {
    const clip = byName.get(clipName);
    if (!clip) {
      console.warn(`[ModelLoader] clip "${clipName}" for state "${state}" not found in GLB.`);
      continue;
    }
    const renamed = clip.clone();
    renamed.name = state;
    out.push(renamed);
  }

  return out;
}

/**
 * Uniformly scale `object` to a target height (world units) and offset it so
 * its feet sit at `feetY` and it is centred horizontally on its origin. Used
 * to fit a loaded character onto its physics capsule.
 */
export function fitToHeight(object: THREE.Object3D, targetHeight: number, feetY: number): number {
  object.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(object);
  const height = box.max.y - box.min.y;
  const scale = targetHeight / height;
  object.scale.setScalar(scale);

  object.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  object.position.x -= center.x;
  object.position.z -= center.z;
  object.position.y += feetY - box.min.y;

  return scale;
}
