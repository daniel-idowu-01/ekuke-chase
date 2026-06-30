import * as THREE from 'three';
import { Renderer } from '../core/Renderer';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { PlayerController } from '../player/PlayerController';
import { EnemyController } from '../enemy/EnemyController';
import { CameraController } from '../systems/CameraController';
import { UISystem } from '../systems/UISystem';
import { AnimationManager } from '../animation/AnimationManager';
import { CityScene } from '../scenes/CityScene';
import { CharacterModel, remapAnimationClips, fitToHeight } from '../utils/ModelLoader';
import { GAME, PHYSICS, PLAYER, ENEMY } from '../utils/Constants';

// Maps the player GLB's own clip names onto the game's state vocabulary.
// RobotExpressive.glb (CC0, Tomás Laulhé / Don McCurdy) ships Idle/Walking/
// Running/Jump; run + sprint share "Running" (sprint is just played faster).
const PLAYER_ANIM_MAP: Record<string, string> = {
  idle: 'Idle',
  walk: 'Walking',
  run: 'Running',
  sprint: 'Running',
  jump: 'Jump',
};

// Maps the wolf GLB's clip names onto the game's state vocabulary.
// Wolf.glb (CC0, Quaternius via Poly Pizza) ships Idle/Walk/Gallop/Attack/...
// Gallop is the fast gait (run + chase); Attack is the one-shot catch lunge.
const ENEMY_ANIM_MAP: Record<string, string> = {
  idle: 'Idle',
  walk: 'Walk',
  run: 'Gallop',
  sprint: 'Gallop',
  jump: 'Jump_ToIdle',
  attack: 'Attack',
};


export class GameManager {
  private renderer: Renderer;
  private physicsWorld: PhysicsWorld;
  private player: PlayerController | null = null;
  private enemy: EnemyController | null = null;
  private cameraController: CameraController;
  private uiSystem: UISystem;
  private cityScene: CityScene;
  private playerModel: CharacterModel = new CharacterModel('/models/RobotExpressive.glb');
  private enemyModel: CharacterModel = new CharacterModel('/models/Wolf.glb');
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

    await Promise.all([this.playerModel.preload(), this.enemyModel.preload()]);

    await this.createPlayer();

    await this.createEnemy();

    this.cameraController.setTarget(this.player!.getModel());

    console.log('Game initialized!');
    this.start();
  }

  private async createPlayer(): Promise<void> {
    const gltf = await this.playerModel.instantiate();
    const character = gltf.scene;
    character.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    // Fit the model to the physics capsule: total capsule height, feet resting
    // at the capsule's bottom relative to the (centre-aligned) body origin.
    const capsuleHalf = PLAYER.CAPSULE_HALF_HEIGHT + PLAYER.CAPSULE_RADIUS;
    fitToHeight(character, capsuleHalf * 2, -capsuleHalf);

    // RobotExpressive faces +Z by default, which matches our facing convention
    // (forward = +Z). Flip to Math.PI here if a model ends up facing backward.
    character.rotation.y = 0;

    // Parent group is what physics drives + the controller rotates.
    const root = new THREE.Group();
    root.add(character);
    root.position.set(0, capsuleHalf, -8);
    this.renderer.add(root);

    const clips = remapAnimationClips(gltf.animations, PLAYER_ANIM_MAP);
    const animationManager = new AnimationManager(character, clips);

    this.player = new PlayerController(
      root,
      root.position.clone(),
      this.physicsWorld,
      animationManager,
      this.renderer.getCamera()
    );
  }

  private async createEnemy(): Promise<void> {
    const gltf = await this.enemyModel.instantiate();
    const character = gltf.scene;
    character.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    // The box collider's vertical half-extent equals half the target height.
    const halfHeight = ENEMY.MODEL_HEIGHT / 2;
    fitToHeight(character, ENEMY.MODEL_HEIGHT, -halfHeight);

    // Derive horizontal collider half-extents from the scaled bounds, trimmed
    // a little so the long snout/tail don't snag the wolf on obstacles.
    character.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(character).getSize(new THREE.Vector3());
    const dims = {
      hx: (size.x / 2) * 0.85,
      hy: halfHeight,
      hz: (size.z / 2) * 0.85,
    };

    // Quaternius animals face +Z, matching our forward convention. Flip to
    // Math.PI here if the wolf ends up running backward.
    character.rotation.y = 0;

    const root = new THREE.Group();
    root.add(character);
    root.position.set(0, halfHeight, 8);
    this.renderer.add(root);

    const clips = remapAnimationClips(gltf.animations, ENEMY_ANIM_MAP);
    const animationManager = new AnimationManager(character, clips);

    this.enemy = new EnemyController(
      root,
      root.position.clone(),
      this.physicsWorld,
      animationManager,
      dims
    );

    this.enemy.setTarget(this.player);
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
      void this.restart();
    });
  }

  private async restart(): Promise<void> {
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

    await this.createPlayer();
    await this.createEnemy();

    this.cameraController.setTarget(this.player!.getModel());

    this.uiSystem.hideGameOver();
  }
}
