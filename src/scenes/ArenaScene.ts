import * as THREE from 'three';
import { Renderer } from '../core/Renderer';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { SCENE } from '../utils/Constants';


export class ArenaScene {
  private renderer: Renderer;
  private physicsWorld: PhysicsWorld;

  constructor(renderer: Renderer, physicsWorld: PhysicsWorld) {
    this.renderer = renderer;
    this.physicsWorld = physicsWorld;
  }

  setup(): void {

    this.createGround();

    this.createBoundaries();

    this.createEnvironment();
  }

  private createGround(): void {
    const scene = this.renderer.getScene();

    const groundGeometry = new THREE.PlaneGeometry(SCENE.ARENA_SIZE, SCENE.ARENA_SIZE);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a5c2a,
      roughness: 0.7,
      metalness: 0.1,
    });
    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = SCENE.GROUND_HEIGHT;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    const groundPos = new THREE.Vector3(0, SCENE.GROUND_HEIGHT, 0);
    this.physicsWorld.createStaticBody(groundPos, 'plane');

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#2a5c2a';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#1a3a1a';
    ctx.lineWidth = 2;

    for (let i = 0; i <= 16; i++) {
      const x = (i / 16) * 256;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 256);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, x);
      ctx.lineTo(256, x);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.repeat.set(4, 4);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    groundMaterial.map = texture;
    groundMaterial.needsUpdate = true;
  }

  private createBoundaries(): void {
    const scene = this.renderer.getScene();
    const size = SCENE.ARENA_SIZE;
    const height = 3;
    const thickness = 0.5;

    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x444444,
      roughness: 0.8,
      metalness: 0.2,
    });

    this.createWall(
      new THREE.Vector3(0, height / 2, -size / 2),
      size,
      height,
      thickness,
      wallMaterial,
      scene
    );

    this.createWall(
      new THREE.Vector3(0, height / 2, size / 2),
      size,
      height,
      thickness,
      wallMaterial,
      scene
    );

    this.createWall(
      new THREE.Vector3(size / 2, height / 2, 0),
      thickness,
      height,
      size,
      wallMaterial,
      scene
    );

    this.createWall(
      new THREE.Vector3(-size / 2, height / 2, 0),
      thickness,
      height,
      size,
      wallMaterial,
      scene
    );
  }

  private createWall(
    position: THREE.Vector3,
    width: number,
    height: number,
    depth: number,
    material: THREE.Material,
    scene: THREE.Scene
  ): void {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    this.physicsWorld.createStaticBody(
      position,
      'box',
      { width, height, depth }
    );
  }

  private createEnvironment(): void {
    const scene = this.renderer.getScene();

    this.createPillar(new THREE.Vector3(-8, 0, -8), scene);
    this.createPillar(new THREE.Vector3(8, 0, -8), scene);
    this.createPillar(new THREE.Vector3(-8, 0, 8), scene);
    this.createPillar(new THREE.Vector3(8, 0, 8), scene);

    this.createPlatform(new THREE.Vector3(0, 0.3, 0), 4, 0.3, 4, scene);
  }

  private createPillar(
    position: THREE.Vector3,
    scene: THREE.Scene
  ): void {
    const geometry = new THREE.CylinderGeometry(0.4, 0.5, 2, 8);
    const material = new THREE.MeshStandardMaterial({
      color: 0x666666,
      roughness: 0.7,
      metalness: 0.3,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.position.y += 1;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    this.physicsWorld.createStaticBody(
      new THREE.Vector3(position.x, position.y + 1, position.z),
      'box',
      { width: 0.4, height: 2, depth: 0.4 }
    );
  }

  private createPlatform(
    position: THREE.Vector3,
    width: number,
    height: number,
    depth: number,
    scene: THREE.Scene
  ): void {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshStandardMaterial({
      color: 0x3a5c3a,
      roughness: 0.6,
      metalness: 0.2,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    this.physicsWorld.createStaticBody(position, 'box', { width, height, depth });
  }
}
