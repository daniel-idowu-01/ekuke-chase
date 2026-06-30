import * as THREE from 'three';
import { Renderer } from '../core/Renderer';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { PlayerController } from '../player/PlayerController';
import { EnemyController } from '../enemy/EnemyController';
import { CameraController } from '../systems/CameraController';
import { UISystem } from '../systems/UISystem';
import { TouchControls } from '../systems/TouchControls';
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
  private enemies: EnemyController[] = [];
  private dogCount: number = 1;
  private autoSprint: boolean = false;
  private static readonly AUTO_SPRINT_KEY = 'ekuke-chase:auto-sprint';
  private cameraController: CameraController;
  private uiSystem: UISystem;
  private touchControls: TouchControls;
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
    this.touchControls = new TouchControls();
    this.cityScene = new CityScene(this.renderer, this.physicsWorld);

    try {
      this.autoSprint = localStorage.getItem(GameManager.AUTO_SPRINT_KEY) === '1';
    } catch {
      this.autoSprint = false;
    }
  }

  private setAutoSprint(enabled: boolean): void {
    this.autoSprint = enabled;
    try {
      localStorage.setItem(GameManager.AUTO_SPRINT_KEY, enabled ? '1' : '0');
    } catch {
      // storage unavailable; keep the in-memory value
    }
    this.player?.setAutoSprint(enabled);
    this.uiSystem.setAutoSprintDisplay(enabled);
  }

  async init(): Promise<void> {
    console.log('Initializing game...');

    this.cityScene.setup();

    await Promise.all([this.playerModel.preload(), this.enemyModel.preload()]);

    await this.createPlayer();

    this.cameraController.setTarget(this.player!.getModel());

    // Auto-sprint toggle: HUD chip, the "T" key, and persisted preference.
    this.uiSystem.bindAutoSprint(() => this.setAutoSprint(!this.autoSprint));
    this.uiSystem.setAutoSprintDisplay(this.autoSprint);
    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 't') this.setAutoSprint(!this.autoSprint);
    });

    // Frame the player once so the scene shows behind the start menu, then let
    // the player choose how many dogs before the chase begins.
    this.cameraController.update(this.player!.getModel().position, 0);
    this.renderer.render();

    console.log('Game initialized!');
    this.uiSystem.showStartMenu((count) => {
      void this.beginGame(count);
    });
  }

  private async beginGame(count: number): Promise<void> {
    this.dogCount = count;
    await this.createEnemies(count);
    this.survivalTimeRemaining = GAME.SURVIVAL_TIME;
    this.gameOver = false;
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
    root.position.set(0, capsuleHalf, -18);
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
    this.player.setAutoSprint(this.autoSprint);
  }

  private async createEnemies(count: number): Promise<void> {
    this.enemies = [];
    const spawns = this.dogSpawnPositions(count);
    for (const spawn of spawns) {
      const enemy = await this.createOneEnemy(spawn.x, spawn.z);
      enemy.setTarget(this.player);
      this.enemies.push(enemy);
    }
  }

  /** Spread the dogs across the far side of the map so they fan out on you. */
  private dogSpawnPositions(count: number): Array<{ x: number; z: number }> {
    if (count <= 1) return [{ x: 0, z: 18 }];
    if (count === 2) return [{ x: -9, z: 18 }, { x: 9, z: 18 }];
    if (count === 3) return [{ x: 0, z: 20 }, { x: -13, z: 15 }, { x: 13, z: 15 }];

    // 4+: fan evenly along the far side.
    const positions: Array<{ x: number; z: number }> = [];
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      positions.push({ x: (t - 0.5) * 32, z: 14 + (i % 2) * 5 });
    }
    return positions;
  }

  private async createOneEnemy(spawnX: number, spawnZ: number): Promise<EnemyController> {
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

    // Catch fires on contact: the closest the dog's (axis-locked) box can get
    // to the player capsule is its largest horizontal half-extent + the
    // capsule radius, plus a small grace so it always registers.
    const catchRadius = Math.max(dims.hx, dims.hz) + PLAYER.CAPSULE_RADIUS + 0.2;

    // Quaternius animals face +Z, matching our forward convention. Flip to
    // Math.PI here if the wolf ends up running backward.
    character.rotation.y = 0;

    const root = new THREE.Group();
    root.add(character);
    root.position.set(spawnX, halfHeight, spawnZ);
    this.renderer.add(root);

    const clips = remapAnimationClips(gltf.animations, ENEMY_ANIM_MAP);
    const animationManager = new AnimationManager(character, clips);

    return new EnemyController(
      root,
      root.position.clone(),
      this.physicsWorld,
      animationManager,
      dims,
      catchRadius
    );
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
    if (!this.player) return;
    if (this.gameOver) return;

    this.survivalTimeRemaining -= deltaTime;

    // Feed touch input (if a touch device) into the same pipeline as keyboard.
    const onTouch = this.touchControls.isActive();
    if (onTouch) {
      const move = this.touchControls.getMove();
      this.player.setMoveInput(move.x, move.forward);
      this.player.setSprintInput(this.touchControls.isSprinting());
      if (this.touchControls.consumeJump()) this.player.requestJump();
      const pinch = this.touchControls.consumePinch();
      if (pinch !== 0) this.cameraController.zoomBy(pinch);
    }

    this.player.update(deltaTime);

    let caught = false;
    for (const enemy of this.enemies) {
      enemy.update(deltaTime);
      if (enemy.hasCaughtPlayer()) caught = true;
    }

    // Camera auto-follows the player's heading on touch and in auto-run mode
    // (so steering reads naturally); otherwise manual mouse/keyboard orbit.
    const followHeading = (onTouch || this.autoSprint) ? this.player.getHeading() : undefined;
    this.cameraController.update(
      this.player.getModel().position,
      this.player.getSprintRatio(),
      followHeading
    );

    this.uiSystem.updateStamina(this.player.getStaminaRatio(), this.player.isExhausted());

    this.uiSystem.updateFPS(deltaTime);
    this.uiSystem.updateSurvivalTimer(this.survivalTimeRemaining);

    if (this.survivalTimeRemaining <= 0) {
      this.endGame(true);
    } else if (caught) {
      this.endGame(false);
    }
  }

  private render(): void {
    this.renderer.render();
  }

  private endGame(playerWon: boolean): void {
    this.gameOver = true;

    const survived = Math.min(
      GAME.SURVIVAL_TIME,
      Math.max(0, GAME.SURVIVAL_TIME - this.survivalTimeRemaining)
    );

    this.uiSystem.showGameOver(playerWon, survived, () => {
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
    for (const enemy of this.enemies) {
      this.physicsWorld.destroyLinkedBody(enemy.getModel());
      this.renderer.remove(enemy.getModel());
    }
    this.enemies = [];

    this.gameOver = false;
    this.survivalTimeRemaining = GAME.SURVIVAL_TIME;

    await this.createPlayer();
    await this.createEnemies(this.dogCount);

    this.cameraController.setTarget(this.player!.getModel());

    this.uiSystem.hideGameOver();
  }
}
