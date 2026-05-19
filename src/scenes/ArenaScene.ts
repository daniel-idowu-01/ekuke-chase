import * as THREE from 'three';
import { Renderer } from '../core/Renderer';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { SCENE } from '../utils/Constants';

type BoxSize = { width: number; height: number; depth: number };

export class ArenaScene {
  private renderer: Renderer;
  private physicsWorld: PhysicsWorld;
  private materials = {
    grass: new THREE.MeshStandardMaterial({ color: 0x4f7a3b, roughness: 0.95 }),
    dirt: new THREE.MeshStandardMaterial({ color: 0x6a4b32, roughness: 0.98 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x74716b, roughness: 0.9 }),
    darkStone: new THREE.MeshStandardMaterial({ color: 0x4d4d48, roughness: 0.92 }),
    bark: new THREE.MeshStandardMaterial({ color: 0x5a3825, roughness: 0.9 }),
    leaves: new THREE.MeshStandardMaterial({ color: 0x2f5f35, roughness: 0.95 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x7a5234, roughness: 0.86 }),
    grassBlade: new THREE.MeshStandardMaterial({ color: 0x6f9d4b, roughness: 1 }),
  };

  constructor(renderer: Renderer, physicsWorld: PhysicsWorld) {
    this.renderer = renderer;
    this.physicsWorld = physicsWorld;
  }

  setup(): void {
    this.createTerrain();
    this.createBoundaries();
    this.createRuinedTrainingGrounds();
    this.createInstancedGrass();
    this.createInstancedStones();
    this.createTreeLine();
  }

  private createTerrain(): void {
    const scene = this.renderer.getScene();
    const size = SCENE.ARENA_SIZE;
    const segments = 80;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2);

    const colors: number[] = [];
    const grass = new THREE.Color(0x486f36);
    const worn = new THREE.Color(0x735138);
    const shadowGrass = new THREE.Color(0x314f2f);
    const position = geometry.attributes.position;

    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const z = position.getZ(i);
      const hill = Math.sin(x * 0.33) * Math.cos(z * 0.27) * 0.28
        + Math.sin((x + z) * 0.18) * 0.22;
      const path = Math.abs(Math.sin(z * 0.36 + x * 0.08)) < 0.22 || Math.abs(x) < 1.15;
      const edgeDark = Math.max(Math.abs(x), Math.abs(z)) / (size / 2);
      position.setY(i, hill - 0.18);

      const color = path
        ? worn.clone().lerp(grass, Math.min(Math.abs(x) / 7, 0.55))
        : grass.clone().lerp(shadowGrass, Math.max(0, edgeDark - 0.62));
      colors.push(color.r, color.g, color.b);
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      roughness: 0.96,
      metalness: 0.02,
      vertexColors: true,
    });
    const terrain = new THREE.Mesh(geometry, material);
    terrain.receiveShadow = true;
    scene.add(terrain);

    const vertices = new Float32Array(position.array);
    const indexArray = geometry.index
      ? new Uint32Array(geometry.index.array)
      : new Uint32Array();
    this.physicsWorld.createStaticTrimesh(vertices, indexArray);
  }

  private createBoundaries(): void {
    const size = SCENE.ARENA_SIZE;
    const fenceHeight = 1.6;
    const layouts = [
      { position: new THREE.Vector3(0, 0.4, -size / 2), size: { width: size, height: fenceHeight, depth: 0.55 } },
      { position: new THREE.Vector3(0, 0.4, size / 2), size: { width: size, height: fenceHeight, depth: 0.55 } },
      { position: new THREE.Vector3(size / 2, 0.4, 0), size: { width: 0.55, height: fenceHeight, depth: size } },
      { position: new THREE.Vector3(-size / 2, 0.4, 0), size: { width: 0.55, height: fenceHeight, depth: size } },
    ];

    layouts.forEach(({ position, size }) => {
      this.createWoodBarricade(position, size);
    });
  }

  private createRuinedTrainingGrounds(): void {
    const obstacles = [
      { position: new THREE.Vector3(-4, 0.35, -4), size: { width: 1.2, height: 1.25, depth: 5.2 }, type: 'stone' },
      { position: new THREE.Vector3(4, 0.35, -2), size: { width: 1.2, height: 1.1, depth: 4.7 }, type: 'wood' },
      { position: new THREE.Vector3(-3, 0.3, 3), size: { width: 5.2, height: 1.05, depth: 1.15 }, type: 'stone' },
      { position: new THREE.Vector3(5.5, 0.3, 4.5), size: { width: 4, height: 1.1, depth: 1.1 }, type: 'ruin' },
      { position: new THREE.Vector3(-7, 0.25, 6), size: { width: 1.1, height: 1, depth: 4 }, type: 'log' },
      { position: new THREE.Vector3(0, 0.3, 0), size: { width: 1.8, height: 1.1, depth: 1.8 }, type: 'stump' },
    ];

    obstacles.forEach(({ position, size, type }) => {
      if (type === 'wood') this.createWoodBarricade(position, size);
      else if (type === 'log') this.createLogPile(position, size);
      else if (type === 'stump') this.createTreeStump(position);
      else this.createStoneRuin(position, size, type === 'ruin');
    });
  }

  private createStoneRuin(position: THREE.Vector3, size: BoxSize, broken: boolean = false): void {
    const group = new THREE.Group();
    const blocks = broken ? 5 : 4;
    for (let i = 0; i < blocks; i++) {
      const block = new THREE.Mesh(
        new THREE.BoxGeometry(size.width / blocks * 0.9, size.height * (0.65 + Math.random() * 0.45), size.depth),
        i % 2 ? this.materials.darkStone : this.materials.stone
      );
      block.position.set(
        (i - blocks / 2 + 0.5) * (size.width / blocks),
        block.geometry.parameters.height / 2 - 0.35,
        (Math.random() - 0.5) * 0.18
      );
      block.rotation.y = (Math.random() - 0.5) * 0.2;
      block.castShadow = true;
      block.receiveShadow = true;
      group.add(block);
    }
    group.position.copy(position);
    this.renderer.add(group);
    this.physicsWorld.createStaticBody(position, 'box', size);
  }

  private createWoodBarricade(position: THREE.Vector3, size: BoxSize): void {
    const group = new THREE.Group();
    const railCount = size.width > size.depth ? 3 : 8;
    for (let i = 0; i < railCount; i++) {
      const horizontal = size.width > size.depth;
      const plank = new THREE.Mesh(
        new THREE.BoxGeometry(horizontal ? size.width / railCount * 0.82 : 0.16, 0.16, horizontal ? 0.22 : size.depth / railCount * 0.82),
        this.materials.wood
      );
      plank.position.set(
        horizontal ? (i - railCount / 2 + 0.5) * (size.width / railCount) : 0,
        0.15 + (i % 3) * 0.3,
        horizontal ? 0 : (i - railCount / 2 + 0.5) * (size.depth / railCount)
      );
      plank.rotation.z = (Math.random() - 0.5) * 0.12;
      plank.castShadow = true;
      plank.receiveShadow = true;
      group.add(plank);
    }
    group.position.copy(position);
    this.renderer.add(group);
    this.physicsWorld.createStaticBody(position, 'box', size);
  }

  private createLogPile(position: THREE.Vector3, size: BoxSize): void {
    const group = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, size.depth * 0.85, 8), this.materials.bark);
      log.rotation.x = Math.PI / 2;
      log.rotation.z = (Math.random() - 0.5) * 0.25;
      log.position.set((i - 1) * 0.23, i * 0.17, 0);
      log.castShadow = true;
      log.receiveShadow = true;
      group.add(log);
    }
    group.position.copy(position);
    this.renderer.add(group);
    this.physicsWorld.createStaticBody(position, 'box', size);
  }

  private createTreeStump(position: THREE.Vector3): void {
    const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.9, 10), this.materials.bark);
    stump.position.copy(position);
    stump.castShadow = true;
    stump.receiveShadow = true;
    this.renderer.add(stump);
    this.physicsWorld.createStaticBody(position, 'box', { width: 1.2, height: 0.9, depth: 1.2 });
  }

  private createInstancedGrass(): void {
    const count = 420;
    const geometry = new THREE.PlaneGeometry(0.12, 0.55);
    geometry.translate(0, 0.25, 0);
    const grass = new THREE.InstancedMesh(geometry, this.materials.grassBlade, count);
    const matrix = new THREE.Matrix4();
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      let x = (Math.random() - 0.5) * SCENE.ARENA_SIZE * 0.9;
      let z = (Math.random() - 0.5) * SCENE.ARENA_SIZE * 0.9;
      if (Math.abs(x) < 1.4 || Math.random() < 0.22) {
        x += Math.sign(x || 1) * 2.4;
        z += (Math.random() - 0.5) * 2;
      }
      dummy.position.set(x, -0.25, z);
      dummy.rotation.y = Math.random() * Math.PI;
      const scale = 0.65 + Math.random() * 0.75;
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      matrix.copy(dummy.matrix);
      grass.setMatrixAt(i, matrix);
    }

    grass.instanceMatrix.needsUpdate = true;
    grass.castShadow = false;
    grass.receiveShadow = true;
    this.renderer.add(grass);
  }

  private createInstancedStones(): void {
    const count = 90;
    const geometry = new THREE.DodecahedronGeometry(0.18, 0);
    const stones = new THREE.InstancedMesh(geometry, this.materials.darkStone, count);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      dummy.position.set(
        (Math.random() - 0.5) * SCENE.ARENA_SIZE * 0.85,
        -0.18,
        (Math.random() - 0.5) * SCENE.ARENA_SIZE * 0.85
      );
      dummy.rotation.set(Math.random(), Math.random(), Math.random());
      dummy.scale.setScalar(0.4 + Math.random() * 1.1);
      dummy.updateMatrix();
      stones.setMatrixAt(i, dummy.matrix);
    }

    stones.instanceMatrix.needsUpdate = true;
    stones.castShadow = true;
    stones.receiveShadow = true;
    this.renderer.add(stones);
  }

  private createTreeLine(): void {
    const positions = [
      [-12, -10], [-9, -13], [-4, -13], [6, -12], [12, -9],
      [-13, 2], [13, 1], [-11, 11], [-5, 12], [8, 12], [12, 7],
    ];

    positions.forEach(([x, z]) => {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 2.4, 8), this.materials.bark);
      trunk.position.set(x, 0.8, z);
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      this.renderer.add(trunk);

      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35, 1), this.materials.leaves);
      crown.position.set(x, 2.35, z);
      crown.scale.set(1.1, 1.25, 1.1);
      crown.castShadow = true;
      crown.receiveShadow = true;
      this.renderer.add(crown);

      this.physicsWorld.createStaticBody(new THREE.Vector3(x, 0.6, z), 'box', { width: 0.75, height: 1.8, depth: 0.75 });
    });
  }
}
