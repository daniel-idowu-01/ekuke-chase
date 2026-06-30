import * as THREE from 'three';
import { Renderer } from '../core/Renderer';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { SCENE } from '../utils/Constants';

type BoxSize = { width: number; height: number; depth: number };

/**
 * Stylized city district (Subway-Surfers-leaning) sized to the play area.
 *
 * Two wide avenues cross at the centre and act as clear running lanes,
 * dividing the map into four large, mostly-open themed blocks the player can
 * freely roam and use for evasion:
 *   - NW: a park (fountain to circle, trees, benches) — lots of open ground
 *   - NE: a building block with a dead-end alley (dumpsters, crates, fence)
 *   - SW: a market plaza (stalls, planters, crates)
 *   - SE: a parking lot + loading dock with a ramp (verticality)
 * Cover is clustered toward block interiors so the streets stay open. Rim
 * buildings form the world boundary. Every solid prop gets a static collider;
 * pure decoration does not. Everything scales off SCENE.ARENA_SIZE.
 */
export class CityScene {
  private renderer: Renderer;
  private physicsWorld: PhysicsWorld;

  private readonly HALF = SCENE.ARENA_SIZE / 2;
  private readonly AVENUE_HALF = 4.5;   // vertical avenue: x in [-4.5, 4.5]
  private readonly CROSS_HALF = 4.5;    // horizontal avenue: z in [-4.5, 4.5]
  // Quadrant centre distance from origin.
  private readonly Q = (4.5 + SCENE.ARENA_SIZE / 2) / 2;

  private materials = {
    asphalt: new THREE.MeshStandardMaterial({ color: 0x44474f, roughness: 0.95 }),
    sidewalk: new THREE.MeshStandardMaterial({ color: 0x9a9da3, roughness: 0.92 }),
    plaza: new THREE.MeshStandardMaterial({ color: 0xc2a06a, roughness: 0.9 }),
    grass: new THREE.MeshStandardMaterial({ color: 0x5a9e44, roughness: 0.97 }),
    water: new THREE.MeshStandardMaterial({ color: 0x4ea3d6, roughness: 0.25, metalness: 0.1 }),
    curb: new THREE.MeshStandardMaterial({ color: 0xd9dbdf, roughness: 0.85 }),
    lineYellow: new THREE.MeshStandardMaterial({ color: 0xf2c23e, roughness: 0.6 }),
    lineWhite: new THREE.MeshStandardMaterial({ color: 0xeef1f4, roughness: 0.6 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x55585f, roughness: 0.9 }),
    parapet: new THREE.MeshStandardMaterial({ color: 0x6e7178, roughness: 0.9 }),
    metalDark: new THREE.MeshStandardMaterial({ color: 0x2c3036, roughness: 0.6, metalness: 0.3 }),
    metalLight: new THREE.MeshStandardMaterial({ color: 0xb6bcc4, roughness: 0.5, metalness: 0.4 }),
    dumpster: new THREE.MeshStandardMaterial({ color: 0x3f8f5a, roughness: 0.6, metalness: 0.2 }),
    dumpsterLid: new THREE.MeshStandardMaterial({ color: 0x2f6f44, roughness: 0.6, metalness: 0.2 }),
    crate: new THREE.MeshStandardMaterial({ color: 0xc89352, roughness: 0.85 }),
    crateEdge: new THREE.MeshStandardMaterial({ color: 0x8a5e2c, roughness: 0.85 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x7a5234, roughness: 0.86 }),
    bark: new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.9 }),
    foliage: new THREE.MeshStandardMaterial({ color: 0x4f9a3f, roughness: 0.95 }),
    planter: new THREE.MeshStandardMaterial({ color: 0x7b5440, roughness: 0.9 }),
    glassDark: new THREE.MeshStandardMaterial({ color: 0x9fd4e6, roughness: 0.25, metalness: 0.1 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.9 }),
    lampPost: new THREE.MeshStandardMaterial({ color: 0x33373d, roughness: 0.7, metalness: 0.4 }),
    lampGlow: new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffe9a0, emissiveIntensity: 0.6, roughness: 0.4 }),
  };

  private facadeMaterials: THREE.MeshStandardMaterial[] = [];
  private carColors = [0xe2574c, 0x4b86e2, 0xf2b134, 0x57b36b, 0xece7df, 0x9b5de5];

  constructor(renderer: Renderer, physicsWorld: PhysicsWorld) {
    this.renderer = renderer;
    this.physicsWorld = physicsWorld;
    this.buildFacadeMaterials();
  }

  setup(): void {
    this.createGround();
    this.createStreetMarkings();
    this.createParkBlock(-this.Q, -this.Q);       // NW
    this.createAlleyBlock(this.Q, -this.Q);       // NE
    this.createMarketBlock(-this.Q, this.Q);      // SW
    this.createParkingBlock(this.Q, this.Q);      // SE
    this.createPerimeter();
    this.createStreetLamps();
  }

  // ---------------------------------------------------------------- ground

  private createGround(): void {
    const scene = this.renderer.getScene();
    const size = SCENE.ARENA_SIZE;

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(size + 10, 1, size + 10),
      this.materials.sidewalk
    );
    base.position.set(0, -0.5, 0);
    base.receiveShadow = true;
    scene.add(base);
    // Single flat floor collider (top at y = 0).
    this.physicsWorld.createStaticBody(new THREE.Vector3(0, -0.5, 0), 'plane');

    // Two wide avenues crossing at the centre.
    this.addFlat(this.materials.asphalt, 0, 0.02, 0, this.AVENUE_HALF * 2, size);
    this.addFlat(this.materials.asphalt, 0, 0.025, 0, size, this.CROSS_HALF * 2);
  }

  /** A thin flat quad (used for road surfaces, plazas, lawns and paint). */
  private addFlat(
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    width: number,
    depth: number
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.04, depth), material);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    this.renderer.add(mesh);
    return mesh;
  }

  private createStreetMarkings(): void {
    // Dashed centre lines down both avenues, skipping the intersection.
    for (let z = -this.HALF + 1.5; z < this.HALF; z += 3) {
      if (Math.abs(z) < this.CROSS_HALF + 1) continue;
      this.addFlat(this.materials.lineYellow, 0, 0.05, z, 0.2, 1.4);
    }
    for (let x = -this.HALF + 1.5; x < this.HALF; x += 3) {
      if (Math.abs(x) < this.AVENUE_HALF + 1) continue;
      this.addFlat(this.materials.lineYellow, x, 0.05, 0, 1.4, 0.2);
    }

    this.createCrosswalk(0, -this.CROSS_HALF - 1, true);
    this.createCrosswalk(0, this.CROSS_HALF + 1, true);
    this.createCrosswalk(-this.AVENUE_HALF - 1, 0, false);
    this.createCrosswalk(this.AVENUE_HALF + 1, 0, false);
  }

  private createCrosswalk(cx: number, cz: number, horizontal: boolean): void {
    const stripes = 7;
    for (let i = 0; i < stripes; i++) {
      const offset = (i - stripes / 2 + 0.5) * 0.5;
      if (horizontal) {
        this.addFlat(this.materials.lineWhite, cx + offset, 0.05, cz, 0.32, 1.6);
      } else {
        this.addFlat(this.materials.lineWhite, cx, 0.05, cz + offset, 1.6, 0.32);
      }
    }
  }

  // ---------------------------------------------------------------- blocks

  /** NW: open park with a central fountain to circle. */
  private createParkBlock(cx: number, cz: number): void {
    this.addFlat(this.materials.grass, cx, 0.03, cz, 17, 17);

    this.createFountain(cx, cz);

    const treeSpots = [
      [-6.5, -6.5], [6.5, -6.5], [-6.5, 6.5], [6.5, 6.5],
      [-7.5, 0.5], [7.5, -0.5], [0.5, -7.5], [-0.5, 7.5],
    ];
    for (const [ox, oz] of treeSpots) this.createTree(cx + ox, cz + oz);

    // Benches around the fountain (low, walkable-around cover).
    this.createLowWall(cx - 3.4, cz, 0.5, 1.8, 0.45);
    this.createLowWall(cx + 3.4, cz, 0.5, 1.8, 0.45);
    this.createPlanter(cx - 4.5, cz + 4.5);
    this.createPlanter(cx + 4.5, cz - 4.5);
  }

  /** NE: building block with a dead-end alley. */
  private createAlleyBlock(cx: number, cz: number): void {
    this.createBuilding(cx - 5.5, cz - 1, 5.5, 9, 9);
    this.createBuilding(cx + 5.5, cz, 5, 10.5, 11);
    this.createBuilding(cx, cz - 6.5, 7, 3.5, 8); // caps the back of the alley

    this.addFlat(this.materials.asphalt, cx, 0.03, cz + 1, 3, 9);

    this.createDumpster(cx - 0.9, cz + 3, Math.PI / 2);
    this.createDumpster(cx + 1.0, cz - 1.5, Math.PI / 2);
    this.createCrateStack(cx, cz - 3.5);
    this.createFence(cx, cz + 5.2, 3, true);

    // A little open-yard cover near the block's outer corner.
    this.createCrate(cx + 6, cz + 6, 1.0, 0.5);
    this.createPlanter(cx - 6, cz + 5.5);
  }

  /** SW: market plaza. */
  private createMarketBlock(cx: number, cz: number): void {
    this.addFlat(this.materials.plaza, cx, 0.03, cz, 16, 16);

    this.createMarketStall(cx - 5, cz - 3, 0, this.carColors[0]);
    this.createMarketStall(cx + 0.5, cz - 5, Math.PI / 2, this.carColors[1]);
    this.createMarketStall(cx + 4.5, cz - 1, 0, this.carColors[3]);
    this.createMarketStall(cx - 2, cz + 4.5, Math.PI / 2, this.carColors[2]);

    this.createPlanter(cx + 5.5, cz + 5);
    this.createPlanter(cx - 6, cz + 1);
    this.createCrateStack(cx + 2, cz + 3);

    this.createBuilding(cx - 6.5, cz + 7, 5, 5, 9);
  }

  /** SE: parking lot + loading dock with a ramp (verticality). */
  private createParkingBlock(cx: number, cz: number): void {
    this.addFlat(this.materials.asphalt, cx, 0.03, cz, 16, 16);

    // Bay lines + parked cars.
    for (let i = 0; i < 4; i++) {
      this.addFlat(this.materials.lineWhite, cx - 5 + i * 2.6, 0.05, cz - 4, 0.12, 4.4);
    }
    this.createParkedCar(cx - 5, cz - 4, 0, this.carColors[0]);
    this.createParkedCar(cx - 2.4, cz - 4, 0, this.carColors[1]);
    this.createParkedCar(cx + 0.2, cz - 4, 0, this.carColors[3]);
    this.createParkedCar(cx + 5, cz + 5, Math.PI, this.carColors[2]);

    this.createLowWall(cx, cz - 7.6, 14, 0.4, 0.6);

    // Loading dock at the back: building + raised platform + ramp.
    this.createBuilding(cx, cz + 7.6, 13, 4.5, 9);

    const platTop = 1.0;
    const platCx = cx - 2;
    const platCz = cz + 4;
    const platW = 8;
    const platD = 4;
    const platform = new THREE.Mesh(
      new THREE.BoxGeometry(platW, platTop, platD),
      this.materials.parapet
    );
    platform.position.set(platCx, platTop / 2, platCz);
    platform.castShadow = true;
    platform.receiveShadow = true;
    this.renderer.add(platform);
    this.physicsWorld.createStaticBody(
      new THREE.Vector3(platCx, platTop / 2, platCz),
      'box',
      { width: platW, height: platTop, depth: platD }
    );

    this.createRamp(platCx + platW / 2 + 1.6, platCz, 2.4, 3.8, platTop);
    this.createCrateStack(platCx - 2.4, platCz + 0.4);
    this.createCrate(platCx + 1.8, platCz - 0.2, 1.0, platTop + 0.5);
  }

  // ------------------------------------------------------------ structures

  private createBuilding(x: number, z: number, w: number, d: number, h: number): void {
    const group = new THREE.Group();
    const facade = this.facadeMaterials[Math.floor(Math.random() * this.facadeMaterials.length)];

    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), facade);
    body.position.y = h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.98, 0.3, d * 0.98), this.materials.roof);
    roof.position.y = h + 0.1;
    roof.castShadow = true;
    group.add(roof);

    const parapetH = 0.45;
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(w, parapetH, d), this.materials.parapet);
    parapet.position.y = h + parapetH / 2;
    group.add(parapet);

    group.position.set(x, 0, z);
    this.renderer.add(group);

    this.physicsWorld.createStaticBody(
      new THREE.Vector3(x, h / 2, z),
      'box',
      { width: w, height: h, depth: d }
    );
  }

  private createTree(x: number, z: number): void {
    const group = new THREE.Group();

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 1.9, 8), this.materials.bark);
    trunk.position.y = 0.95;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);

    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1), this.materials.foliage);
    crown.position.y = 2.6;
    crown.scale.set(1.1, 1.25, 1.1);
    crown.castShadow = true;
    group.add(crown);

    group.position.set(x, 0, z);
    this.renderer.add(group);

    this.physicsWorld.createStaticBody(
      new THREE.Vector3(x, 0.95, z),
      'box',
      { width: 0.7, height: 1.9, depth: 0.7 }
    );
  }

  private createFountain(x: number, z: number): void {
    const group = new THREE.Group();
    const radius = 2.3;

    const basin = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.5, 18), this.materials.curb);
    basin.position.y = 0.25;
    basin.castShadow = true;
    basin.receiveShadow = true;
    group.add(basin);

    const water = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.82, radius * 0.82, 0.1, 18), this.materials.water);
    water.position.y = 0.46;
    group.add(water);

    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 1.1, 10), this.materials.curb);
    spout.position.y = 0.95;
    spout.castShadow = true;
    group.add(spout);

    group.position.set(x, 0, z);
    this.renderer.add(group);

    // Slightly smaller box than the basin so you can brush the rim, not snag on corners.
    const c = radius * 1.3;
    this.physicsWorld.createStaticBody(new THREE.Vector3(x, 0.25, z), 'box', { width: c, height: 0.5, depth: c });
  }

  private createMarketStall(x: number, z: number, rotationY: number, awningColor: number): void {
    const group = new THREE.Group();

    const table = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 1.2), this.materials.wood);
    table.position.y = 0.9;
    table.castShadow = true;
    table.receiveShadow = true;
    group.add(table);

    const postGeo = new THREE.BoxGeometry(0.1, 0.95, 0.1);
    for (const [ox, oz] of [[-1.0, -0.5], [1.0, -0.5], [-1.0, 0.5], [1.0, 0.5]]) {
      const post = new THREE.Mesh(postGeo, this.materials.wood);
      post.position.set(ox, 0.47, oz);
      post.castShadow = true;
      group.add(post);
    }

    const awningMat = new THREE.MeshStandardMaterial({ color: awningColor, roughness: 0.8 });
    const awningMatAlt = new THREE.MeshStandardMaterial({ color: 0xf3f3f3, roughness: 0.8 });
    for (let i = 0; i < 5; i++) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.04, 1.5), i % 2 ? awningMat : awningMatAlt);
      stripe.position.set(-1.0 + i * 0.5, 1.55, 0);
      stripe.rotation.x = -0.32;
      stripe.castShadow = true;
      group.add(stripe);
    }

    for (let i = 0; i < 3; i++) {
      const good = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), i % 2 ? this.materials.crate : this.materials.foliage);
      good.position.set(-0.7 + i * 0.7, 1.12, 0);
      good.castShadow = true;
      group.add(good);
    }

    group.position.set(x, 0, z);
    group.rotation.y = rotationY;
    this.renderer.add(group);

    const size: BoxSize = rotationY % Math.PI === 0
      ? { width: 2.2, height: 1.0, depth: 1.2 }
      : { width: 1.2, height: 1.0, depth: 2.2 };
    this.physicsWorld.createStaticBody(new THREE.Vector3(x, 0.5, z), 'box', size);
  }

  private createDumpster(x: number, z: number, rotationY: number): void {
    const group = new THREE.Group();

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.95, 1.0), this.materials.dumpster);
    body.position.y = 0.55;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.12, 1.04), this.materials.dumpsterLid);
    lid.position.y = 1.06;
    lid.rotation.z = 0.05;
    lid.castShadow = true;
    group.add(lid);

    const wheelGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.1, 10);
    for (const ox of [-0.6, 0.6]) {
      for (const oz of [-0.35, 0.35]) {
        const wheel = new THREE.Mesh(wheelGeo, this.materials.tire);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(ox, 0.1, oz);
        group.add(wheel);
      }
    }

    group.position.set(x, 0, z);
    group.rotation.y = rotationY;
    this.renderer.add(group);

    const size: BoxSize = Math.abs(rotationY % Math.PI) < 0.01
      ? { width: 1.6, height: 1.1, depth: 1.0 }
      : { width: 1.0, height: 1.1, depth: 1.6 };
    this.physicsWorld.createStaticBody(new THREE.Vector3(x, 0.55, z), 'box', size);
  }

  private createCrate(x: number, z: number, size: number, baseY: number): void {
    const group = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), this.materials.crate);
    box.castShadow = true;
    box.receiveShadow = true;
    group.add(box);

    const frameT = size * 0.12;
    const edge = new THREE.Mesh(new THREE.BoxGeometry(size * 1.02, frameT, size * 1.02), this.materials.crateEdge);
    edge.position.y = size / 2 - frameT / 2;
    group.add(edge);
    const edge2 = edge.clone();
    edge2.position.y = -size / 2 + frameT / 2;
    group.add(edge2);

    group.position.set(x, baseY, z);
    group.rotation.y = (Math.random() - 0.5) * 0.4;
    this.renderer.add(group);

    this.physicsWorld.createStaticBody(
      new THREE.Vector3(x, baseY, z),
      'box',
      { width: size, height: size, depth: size }
    );
  }

  private createCrateStack(x: number, z: number): void {
    this.createCrate(x, z, 1.0, 0.5);
    this.createCrate(x + 0.55, z + 0.2, 0.7, 0.35);
    this.createCrate(x - 0.1, z + 0.1, 0.8, 1.4);
  }

  private createParkedCar(x: number, z: number, rotationY: number, color: number): void {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.35 });

    const lower = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 3.6), bodyMat);
    lower.position.y = 0.55;
    lower.castShadow = true;
    lower.receiveShadow = true;
    group.add(lower);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 1.9), bodyMat);
    cabin.position.set(0, 1.05, -0.2);
    cabin.castShadow = true;
    group.add(cabin);

    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.5, 1.8), this.materials.glassDark);
    glass.position.set(0, 1.06, -0.2);
    group.add(glass);

    const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.26, 12);
    for (const ox of [-0.92, 0.92]) {
      for (const oz of [-1.2, 1.2]) {
        const wheel = new THREE.Mesh(wheelGeo, this.materials.tire);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(ox, 0.32, oz);
        wheel.castShadow = true;
        group.add(wheel);
      }
    }

    group.position.set(x, 0, z);
    group.rotation.y = rotationY;
    this.renderer.add(group);

    const size: BoxSize = Math.abs(rotationY % Math.PI) < 0.01
      ? { width: 1.9, height: 1.2, depth: 3.6 }
      : { width: 3.6, height: 1.2, depth: 1.9 };
    this.physicsWorld.createStaticBody(new THREE.Vector3(x, 0.6, z), 'box', size);
  }

  private createLowWall(x: number, z: number, width: number, depth: number, height: number = 0.7): void {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), this.materials.curb);
    wall.position.set(x, height / 2, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    this.renderer.add(wall);
    this.physicsWorld.createStaticBody(new THREE.Vector3(x, height / 2, z), 'box', { width, height, depth });
  }

  private createFence(x: number, z: number, length: number, alongX: boolean): void {
    const group = new THREE.Group();
    const posts = Math.max(2, Math.round(length / 0.8));

    for (let i = 0; i <= posts; i++) {
      const t = (i / posts - 0.5) * length;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.1), this.materials.metalDark);
      post.position.set(alongX ? t : 0, 0.45, alongX ? 0 : t);
      post.castShadow = true;
      group.add(post);
    }
    for (const ry of [0.32, 0.66]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(alongX ? length : 0.06, 0.06, alongX ? 0.06 : length),
        this.materials.metalLight
      );
      rail.position.y = ry;
      group.add(rail);
    }

    group.position.set(x, 0, z);
    this.renderer.add(group);

    this.physicsWorld.createStaticBody(
      new THREE.Vector3(x, 0.45, z),
      'box',
      { width: alongX ? length : 0.16, height: 0.9, depth: alongX ? 0.16 : length }
    );
  }

  private createPlanter(x: number, z: number): void {
    const group = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 1.1), this.materials.planter);
    box.position.y = 0.3;
    box.castShadow = true;
    box.receiveShadow = true;
    group.add(box);

    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), this.materials.foliage);
    bush.position.y = 0.85;
    bush.scale.set(1.0, 0.85, 1.0);
    bush.castShadow = true;
    group.add(bush);

    group.position.set(x, 0, z);
    this.renderer.add(group);
    this.physicsWorld.createStaticBody(new THREE.Vector3(x, 0.3, z), 'box', { width: 1.1, height: 0.6, depth: 1.1 });
  }

  private createRamp(x: number, z: number, width: number, length: number, height: number): void {
    const angle = Math.atan2(height, length);
    const slabLen = Math.sqrt(height * height + length * length) + 0.2;
    const thickness = 0.25;

    // Rotate about Z so the -X (platform-side) end lifts to platform height
    // while the +X (street-side) end meets the ground.
    const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -angle);

    const ramp = new THREE.Mesh(new THREE.BoxGeometry(slabLen, thickness, width), this.materials.parapet);
    ramp.position.set(x, height / 2, z);
    ramp.quaternion.copy(quat);
    ramp.castShadow = true;
    ramp.receiveShadow = true;
    this.renderer.add(ramp);

    this.physicsWorld.createStaticBody(
      new THREE.Vector3(x, height / 2, z),
      'box',
      { width: slabLen, height: thickness, depth: width },
      quat
    );
  }

  private createStreetLamps(): void {
    const a = this.AVENUE_HALF + 0.8;
    const c = this.CROSS_HALF + 0.8;
    const spots = [
      [-a, -c], [a, -c], [-a, c], [a, c],          // intersection corners
      [a, -this.Q], [-a, this.Q],                   // along the avenue
      [-this.Q, c], [this.Q, -c],                   // along the cross street
      [a, this.HALF - 3], [-a, -this.HALF + 3],
    ];
    for (const [x, z] of spots) this.createStreetLamp(x, z);
  }

  private createStreetLamp(x: number, z: number): void {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.2, 8), this.materials.lampPost);
    pole.position.y = 1.6;
    pole.castShadow = true;
    group.add(pole);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.08), this.materials.lampPost);
    arm.position.set(0.3, 3.15, 0);
    group.add(arm);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), this.materials.lampGlow);
    head.position.set(0.55, 3.05, 0);
    group.add(head);

    group.position.set(x, 0, z);
    this.renderer.add(group);

    this.physicsWorld.createStaticBody(new THREE.Vector3(x, 1.6, z), 'box', { width: 0.24, height: 3.2, depth: 0.24 });
  }

  /**
   * Rim buildings forming the world boundary, leaving gaps where the two
   * avenues exit the map so it reads as a continuing city. The player is
   * clamped to ~HALF-1, so these sit just outside reach.
   */
  private createPerimeter(): void {
    const edge = this.HALF + 1.5;
    const along = [-this.Q - 4, -this.Q + 4, this.Q - 4, this.Q + 4];

    for (const t of along) {
      // North & south rows (skip the vertical-avenue gap near x = 0).
      this.createBuilding(t, -edge, 7, 4, 11 + Math.random() * 4);
      this.createBuilding(t, edge, 7, 4, 11 + Math.random() * 4);
      // East & west rows (skip the cross-avenue gap near z = 0).
      this.createBuilding(-edge, t, 4, 7, 12 + Math.random() * 4);
      this.createBuilding(edge, t, 4, 7, 12 + Math.random() * 4);
    }
  }

  // ------------------------------------------------------------- materials

  private buildFacadeMaterials(): void {
    const palettes: Array<[number, number]> = [
      [0xd98c5f, 0x2b3a45],
      [0x6fa8c9, 0x24323a],
      [0xe6c45c, 0x3a3320],
      [0xb98bd1, 0x2e2438],
      [0xcf5f5f, 0x33201f],
      [0x8fb98f, 0x223026],
    ];
    for (const [base, glass] of palettes) {
      const texture = this.makeFacadeTexture(base, glass);
      this.facadeMaterials.push(new THREE.MeshStandardMaterial({ map: texture, roughness: 0.88 }));
    }
  }

  private makeFacadeTexture(base: number, glass: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

    ctx.fillStyle = hex(base);
    ctx.fillRect(0, 0, 256, 256);

    const cols = 4;
    const rows = 5;
    const marginX = 22;
    const marginY = 20;
    const gapX = 14;
    const gapY = 16;
    const cellW = (256 - marginX * 2 - gapX * (cols - 1)) / cols;
    const cellH = (256 - marginY * 2 - gapY * (rows - 1) - 40) / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = marginX + c * (cellW + gapX);
        const wy = marginY + r * (cellH + gapY);
        const lit = Math.random() < 0.18;
        ctx.fillStyle = lit ? '#ffe9a8' : hex(glass);
        ctx.fillRect(wx, wy, cellW, cellH);
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 2;
        ctx.strokeRect(wx, wy, cellW, cellH);
      }
    }

    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, 256 - 36, 256, 36);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
  }
}
