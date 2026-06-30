import * as THREE from 'three';
import { Renderer } from '../core/Renderer';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { PlayerController } from '../player/PlayerController';
import { EnemyController } from '../enemy/EnemyController';
import { CameraController } from '../systems/CameraController';
import { UISystem } from '../systems/UISystem';
import { AnimationManager } from '../animation/AnimationManager';
import { CityScene } from '../scenes/CityScene';
import { GAME, PHYSICS } from '../utils/Constants';


export class GameManager {
  private renderer: Renderer;
  private physicsWorld: PhysicsWorld;
  private player: PlayerController | null = null;
  private enemy: EnemyController | null = null;
  private cameraController: CameraController;
  private uiSystem: UISystem;
  private cityScene: CityScene;
  private gameOver: boolean = false;
  private survivalTimeRemaining: number = GAME.SURVIVAL_TIME;

  private lastFrameTime: number = 0;
  private fixedTimestep: number = PHYSICS.FIXED_TIMESTEP;
  private physicsAccumulator: number = 0;

  constructor() {
    this.renderer = new Renderer();
    this.physicsWorld = new PhysicsWorld();
    this.cameraController = new CameraController(this.renderer.getCamera(), this.physicsWorld);
    this.uiSystem = new UISystem();
    this.cityScene = new CityScene(this.renderer, this.physicsWorld);
  }

  async init(): Promise<void> {
    console.log('Initializing game...');

    this.cityScene.setup();

    this.createPlayer();

    this.createEnemy();

    this.cameraController.setTarget(this.player!.getModel());

    console.log('Game initialized!');
    this.start();
  }

  private createPlayer(): void {
    const playerMesh = this.createHumanModel();
    playerMesh.position.set(0, 0.7, -8);

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
    enemyMesh.position.set(0, 0.45, 8);

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
    torso.name = 'torso';
    torso.position.y = 0.65;
    human.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), skin);
    head.name = 'head';
    head.position.y = 1.35;
    human.add(head);

    this.addLimb(human, 'leftArm', new THREE.Vector3(-0.26, 0.67, 0), new THREE.Vector3(0.1, 0.52, 0.1), skin);
    this.addLimb(human, 'rightArm', new THREE.Vector3(0.26, 0.67, 0), new THREE.Vector3(0.1, 0.52, 0.1), skin);
    this.addLimb(human, 'leftLeg', new THREE.Vector3(-0.11, 0.05, 0), new THREE.Vector3(0.11, 0.62, 0.11), pants);
    this.addLimb(human, 'rightLeg', new THREE.Vector3(0.11, 0.05, 0), new THREE.Vector3(0.11, 0.62, 0.11), pants);
    this.addLimb(human, 'leftFoot', new THREE.Vector3(-0.11, -0.3, -0.04), new THREE.Vector3(0.16, 0.07, 0.24), shoe);
    this.addLimb(human, 'rightFoot', new THREE.Vector3(0.11, -0.3, -0.04), new THREE.Vector3(0.16, 0.07, 0.24), shoe);

    human.scale.setScalar(0.72);

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
    body.name = 'dogBody';
    body.position.y = 0.25;
    dog.add(body);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.32, 0.32), fur);
    head.name = 'dogHead';
    head.position.set(0, 0.42, -0.48);
    dog.add(head);

    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.22), darkFur);
    snout.name = 'dogSnout';
    snout.position.set(0, 0.38, -0.74);
    dog.add(snout);

    this.addLimb(dog, 'frontLeftLeg', new THREE.Vector3(-0.32, -0.08, -0.2), new THREE.Vector3(0.1, 0.36, 0.1), fur);
    this.addLimb(dog, 'frontRightLeg', new THREE.Vector3(0.32, -0.08, -0.2), new THREE.Vector3(0.1, 0.36, 0.1), fur);
    this.addLimb(dog, 'backLeftLeg', new THREE.Vector3(-0.32, -0.08, 0.22), new THREE.Vector3(0.1, 0.36, 0.1), fur);
    this.addLimb(dog, 'backRightLeg', new THREE.Vector3(0.32, -0.08, 0.22), new THREE.Vector3(0.1, 0.36, 0.1), fur);

    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.38, 4, 8), fur);
    tail.name = 'dogTail';
    tail.position.set(0, 0.42, 0.52);
    tail.rotation.x = Math.PI / 3;
    dog.add(tail);

    dog.scale.setScalar(0.62);

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
    name: string,
    position: THREE.Vector3,
    scale: THREE.Vector3,
    material: THREE.Material
  ): void {
    const limb = new THREE.Mesh(new THREE.BoxGeometry(scale.x, scale.y, scale.z), material);
    limb.name = name;
    limb.position.copy(position);
    parent.add(limb);
  }

  private createPlaceholderAnimations(): THREE.AnimationClip[] {
    const animations: THREE.AnimationClip[] = [];

    const animationNames = ['idle', 'walk', 'run', 'sprint', 'jump'];

    animationNames.forEach((name) => {
      animations.push(this.createProceduralClip(name));
    });

    return animations;
  }

  private createProceduralClip(name: string): THREE.AnimationClip {
    const times = [0, 0.25, 0.5, 0.75, 1];
    const rest = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const walkA = [0.42, 0, -0.42, 0, 0.42];
    const walkB = [-0.42, 0, 0.42, 0, -0.42];
    const runA = [0.72, 0, -0.72, 0, 0.72];
    const runB = [-0.72, 0, 0.72, 0, -0.72];
    const dogA = [0.5, -0.2, -0.5, 0.2, 0.5];
    const dogB = [-0.5, 0.2, 0.5, -0.2, -0.5];
    const tracks: THREE.KeyframeTrack[] = [];

    const addRotation = (target: string, values: number[]) => {
      tracks.push(new THREE.NumberKeyframeTrack(`${target}.rotation[x]`, times, values));
    };

    const moving = name === 'walk' || name === 'run' || name === 'sprint';
    const attack = name === 'attack';
    const hit = name === 'hit';
    const death = name === 'death';
    const ampA = name === 'walk' ? walkA : runA;
    const ampB = name === 'walk' ? walkB : runB;

    if (moving) {
      addRotation('leftLeg', ampA);
      addRotation('rightLeg', ampB);
      addRotation('leftArm', ampB.map((value) => value * 0.75));
      addRotation('rightArm', ampA.map((value) => value * 0.75));
      addRotation('frontLeftLeg', dogA);
      addRotation('backRightLeg', dogA);
      addRotation('frontRightLeg', dogB);
      addRotation('backLeftLeg', dogB);
      tracks.push(new THREE.NumberKeyframeTrack('torso.position[y]', times, [0.65, 0.68, 0.65, 0.68, 0.65]));
      tracks.push(new THREE.NumberKeyframeTrack('dogBody.position[y]', times, [0.25, 0.29, 0.25, 0.29, 0.25]));
      addRotation('dogTail', [0.75, 0.9, 0.75, 0.6, 0.75]);
    } else if (attack) {
      addRotation('leftArm', [-0.3, -0.8, -0.2, 0, -0.3]);
      addRotation('rightArm', [-0.2, -0.9, -0.25, 0, -0.2]);
      addRotation('dogHead', [0, -0.35, 0.18, 0, 0]);
    } else if (hit) {
      tracks.push(new THREE.NumberKeyframeTrack('.rotation[z]', times, [0, 0.08, -0.05, 0.02, 0]));
    } else if (death) {
      tracks.push(new THREE.NumberKeyframeTrack('.rotation[x]', times, [0, 0.5, 1.15, 1.35, 1.35]));
    } else {
      addRotation('leftLeg', rest);
      addRotation('rightLeg', rest);
      addRotation('leftArm', rest);
      addRotation('rightArm', rest);
      addRotation('frontLeftLeg', rest);
      addRotation('frontRightLeg', rest);
      addRotation('backLeftLeg', rest);
      addRotation('backRightLeg', rest);
      tracks.push(new THREE.NumberKeyframeTrack('torso.position[y]', times, [0.65, 0.67, 0.65, 0.66, 0.65]));
      tracks.push(new THREE.NumberKeyframeTrack('dogBody.position[y]', times, [0.25, 0.27, 0.25, 0.26, 0.25]));
    }

    return new THREE.AnimationClip(name, 1, tracks);
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

    this.player.update(deltaTime);

    this.enemy.update(deltaTime);

    this.cameraController.update(this.player.getModel().position, this.player.getSprintRatio());

    this.uiSystem.updateStamina(this.player.getStaminaRatio(), this.player.isExhausted());

    this.uiSystem.updateFPS(deltaTime);
    this.uiSystem.updateSurvivalTimer(this.survivalTimeRemaining);

    if (this.survivalTimeRemaining <= 0) {
      this.endGame(true);
    } else if (this.enemy.hasCaughtPlayer()) {
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
      this.physicsWorld.destroyLinkedBody(this.player.getModel());
      this.renderer.remove(this.player.getModel());
      this.player.cleanup();
    }
    if (this.enemy) {
      this.physicsWorld.destroyLinkedBody(this.enemy.getModel());
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
