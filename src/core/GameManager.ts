import * as THREE from 'three';
import { Renderer } from '../core/Renderer';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { PlayerController } from '../player/PlayerController';
import { EnemyController } from '../enemy/EnemyController';
import { CameraController } from '../systems/CameraController';
import { UISystem } from '../systems/UISystem';
import { AnimationManager } from '../animation/AnimationManager';
import { ArenaScene } from '../scenes/ArenaScene';
import { GAME, PHYSICS } from '../utils/Constants';


export class GameManager {
  private renderer: Renderer;
  private physicsWorld: PhysicsWorld;
  private player: PlayerController | null = null;
  private enemy: EnemyController | null = null;
  private cameraController: CameraController;
  private uiSystem: UISystem;
  private arenaScene: ArenaScene;
  private gameOver: boolean = false;
  private survivalTimeRemaining: number = GAME.SURVIVAL_TIME;

  private lastFrameTime: number = 0;
  private fixedTimestep: number = PHYSICS.FIXED_TIMESTEP;
  private physicsAccumulator: number = 0;

  constructor() {
    this.renderer = new Renderer();
    this.physicsWorld = new PhysicsWorld();
    this.cameraController = new CameraController(this.renderer.getCamera());
    this.uiSystem = new UISystem();
    this.arenaScene = new ArenaScene(this.renderer, this.physicsWorld);
  }

  async init(): Promise<void> {
    console.log('Initializing game...');

    this.arenaScene.setup();
    this.createObstacleCourse();

    this.createPlayer();

    this.createEnemy();

    this.cameraController.setTarget(this.player!.getModel());

    console.log('Game initialized!');
    this.start();
  }

  private createPlayer(): void {
    const playerMesh = this.createHumanModel();
    playerMesh.position.set(0, 1, -8);

    this.renderer.add(playerMesh);

    const animations = this.createPlaceholderAnimations();
    const animationManager = new AnimationManager(playerMesh, animations);

    this.player = new PlayerController(
      playerMesh,
      playerMesh.position.clone(),
      this.physicsWorld,
      animationManager,
      this.renderer.getCamera()
    );
  }

  private createEnemy(): void {
    const enemyMesh = this.createDogModel();
    enemyMesh.position.set(0, 0.8, 8);

    this.renderer.add(enemyMesh);

    const animations = this.createPlaceholderAnimations();
    const animationManager = new AnimationManager(enemyMesh, animations);

    this.enemy = new EnemyController(
      enemyMesh,
      enemyMesh.position.clone(),
      this.physicsWorld,
      animationManager
    );

    this.enemy.setTarget(this.player);
  }

  private createHumanModel(): THREE.Group {
    const human = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0xffc28b, roughness: 0.6 });
    const shirt = new THREE.MeshStandardMaterial({ color: 0x1e88ff, roughness: 0.7 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x202842, roughness: 0.8 });
    const shoe = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.75, 6, 12), shirt);
    torso.position.y = 0.65;
    human.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), skin);
    head.position.y = 1.35;
    human.add(head);

    this.addLimb(human, new THREE.Vector3(-0.24, 0.7, 0), new THREE.Vector3(0.1, 0.55, 0.1), skin);
    this.addLimb(human, new THREE.Vector3(0.24, 0.7, 0), new THREE.Vector3(0.1, 0.55, 0.1), skin);
    this.addLimb(human, new THREE.Vector3(-0.12, 0.05, 0), new THREE.Vector3(0.12, 0.7, 0.12), pants);
    this.addLimb(human, new THREE.Vector3(0.12, 0.05, 0), new THREE.Vector3(0.12, 0.7, 0.12), pants);
    this.addLimb(human, new THREE.Vector3(-0.12, -0.34, -0.04), new THREE.Vector3(0.18, 0.08, 0.28), shoe);
    this.addLimb(human, new THREE.Vector3(0.12, -0.34, -0.04), new THREE.Vector3(0.18, 0.08, 0.28), shoe);

    human.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    return human;
  }

  private createDogModel(): THREE.Group {
    const dog = new THREE.Group();
    const fur = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.75 });
    const darkFur = new THREE.MeshStandardMaterial({ color: 0x3a2414, roughness: 0.8 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.38, 0.42), fur);
    body.position.y = 0.25;
    dog.add(body);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.32, 0.32), fur);
    head.position.set(0, 0.42, -0.48);
    dog.add(head);

    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.22), darkFur);
    snout.position.set(0, 0.38, -0.74);
    dog.add(snout);

    this.addLimb(dog, new THREE.Vector3(-0.32, -0.08, -0.2), new THREE.Vector3(0.12, 0.42, 0.12), fur);
    this.addLimb(dog, new THREE.Vector3(0.32, -0.08, -0.2), new THREE.Vector3(0.12, 0.42, 0.12), fur);
    this.addLimb(dog, new THREE.Vector3(-0.32, -0.08, 0.22), new THREE.Vector3(0.12, 0.42, 0.12), fur);
    this.addLimb(dog, new THREE.Vector3(0.32, -0.08, 0.22), new THREE.Vector3(0.12, 0.42, 0.12), fur);

    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.38, 4, 8), fur);
    tail.position.set(0, 0.42, 0.52);
    tail.rotation.x = Math.PI / 3;
    dog.add(tail);

    dog.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    return dog;
  }

  private addLimb(
    parent: THREE.Object3D,
    position: THREE.Vector3,
    scale: THREE.Vector3,
    material: THREE.Material
  ): void {
    const limb = new THREE.Mesh(new THREE.BoxGeometry(scale.x, scale.y, scale.z), material);
    limb.position.copy(position);
    parent.add(limb);
  }

  private createObstacleCourse(): void {
    const material = new THREE.MeshStandardMaterial({
      color: 0x70757f,
      roughness: 0.85,
      metalness: 0.05,
    });

    const obstacles = [
      { position: new THREE.Vector3(-4, 0.6, -4), size: { width: 1.4, height: 1.2, depth: 5 } },
      { position: new THREE.Vector3(4, 0.6, -2), size: { width: 1.4, height: 1.2, depth: 5 } },
      { position: new THREE.Vector3(-3, 0.6, 3), size: { width: 5, height: 1.2, depth: 1.2 } },
      { position: new THREE.Vector3(5.5, 0.6, 4.5), size: { width: 4, height: 1.2, depth: 1.2 } },
      { position: new THREE.Vector3(-7, 0.6, 6), size: { width: 1.2, height: 1.2, depth: 4 } },
      { position: new THREE.Vector3(0, 0.6, 0), size: { width: 1.6, height: 1.2, depth: 1.6 } },
    ];

    obstacles.forEach(({ position, size }) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.width, size.height, size.depth), material);
      mesh.position.copy(position);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.renderer.add(mesh);
      this.physicsWorld.createStaticBody(position, 'box', size);
    });
  }

  private createPlaceholderAnimations(): THREE.AnimationClip[] {
    const animations: THREE.AnimationClip[] = [];

    const animationNames = ['idle', 'run', 'sprint', 'jump', 'attack', 'hit', 'death'];

    animationNames.forEach((name) => {
      const scaleTrack = new THREE.VectorKeyframeTrack(
        '.scale',
        [0, 0.5, 1],
        [1, 1, 1, 1.04, 0.96, 1.04, 1, 1, 1]
      );

      const clip = new THREE.AnimationClip(name, 1, [scaleTrack]);
      animations.push(clip);
    });

    return animations;
  }

  private start(): void {
    this.lastFrameTime = performance.now();
    this.gameLoop();
  }

  private gameLoop = (): void => {
    requestAnimationFrame(this.gameLoop);

    const currentTime = performance.now();
    // Clamp delta time so tab switches or frame stalls do not explode movement.
    const deltaTime = Math.min((currentTime - this.lastFrameTime) / 1000, 0.016);
    this.lastFrameTime = currentTime;

    this.physicsAccumulator += deltaTime;
    while (this.physicsAccumulator >= this.fixedTimestep) {
      this.updatePhysics();
      this.physicsAccumulator -= this.fixedTimestep;
    }

    this.update(deltaTime);

    this.render();
  };

  private updatePhysics(): void {
    this.physicsWorld.update();
  }

  private update(deltaTime: number): void {
    if (!this.player || !this.enemy) return;
    if (this.gameOver) return;

    this.survivalTimeRemaining -= deltaTime;

    this.player.update(deltaTime, [this.enemy]);

    this.enemy.update(deltaTime);

    this.cameraController.update(this.player.getModel().position);

    const playerHealth = this.player.getHealth();
    const enemyHealth = this.enemy.getHealth();

    this.uiSystem.updatePlayerHealth(
      playerHealth.getCurrentHealth(),
      playerHealth.getMaxHealth()
    );

    this.uiSystem.updateEnemyHealth(
      enemyHealth.getCurrentHealth(),
      enemyHealth.getMaxHealth()
    );

    this.uiSystem.updateFPS(deltaTime);
    this.uiSystem.updateSurvivalTimer(this.survivalTimeRemaining);

    if (this.survivalTimeRemaining <= 0) {
      this.endGame(true);
    } else if (playerHealth.getIsDead()) {
      this.endGame(false);
    }
  }

  private render(): void {
    this.renderer.render();
  }

  private endGame(playerWon: boolean): void {
    this.gameOver = true;

    this.uiSystem.showGameOver(playerWon, () => {
      this.restart();
    });
  }

  private restart(): void {
    console.log('Restarting game...');

    if (this.player) {
      this.renderer.remove(this.player.getModel());
      this.player.cleanup();
    }
    if (this.enemy) {
      this.renderer.remove(this.enemy.getModel());
    }

    this.gameOver = false;
    this.survivalTimeRemaining = GAME.SURVIVAL_TIME;

    this.createPlayer();
    this.createEnemy();

    this.cameraController.setTarget(this.player!.getModel());

    this.uiSystem.hideGameOver();
  }
}
