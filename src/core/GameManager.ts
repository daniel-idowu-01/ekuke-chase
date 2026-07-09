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
import { GAME, PHYSICS, PLAYER, ENEMY, SCENE } from '../utils/Constants';

const PLAYER_ANIM_MAP: Record<string, string> = {
  idle: 'Idle',
  walk: 'Walking',
  run: 'Running',
  sprint: 'Running',
  jump: 'Jump',
};

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
  private elapsedTime: number = 0;
  private nextDogSpawnTime: number = GAME.EXTRA_DOG_INTERVAL;
  private spawningDog: boolean = false;

  // Close-call feedback state.
  private nearMissArmed: boolean = false;
  private nearMissCooldown: number = 0;
  private slowMoTimer: number = 0;
  private timeScale: number = 1;

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

    this.uiSystem.bindAutoSprint(() => this.setAutoSprint(!this.autoSprint));
    this.uiSystem.setAutoSprintDisplay(this.autoSprint);
    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 't') this.setAutoSprint(!this.autoSprint);
    });

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
    this.resetRunState();
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

  private dogSpawnPositions(count: number): Array<{ x: number; z: number }> {
    if (count <= 1) return [{ x: 0, z: 18 }];
    if (count === 2) return [{ x: -9, z: 18 }, { x: 9, z: 18 }];
    if (count === 3) return [{ x: 0, z: 20 }, { x: -13, z: 15 }, { x: 13, z: 15 }];

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
    const realDelta = Math.min((currentTime - this.lastFrameTime) / 1000, 0.016);
    this.lastFrameTime = currentTime;

    // Slow-mo: ease the time scale toward its target (0.4 during a near-miss)
    // and feed the scaled dt into physics + gameplay for a juicy hitch.
    this.slowMoTimer = Math.max(0, this.slowMoTimer - realDelta);
    const targetScale = this.slowMoTimer > 0 ? 0.4 : 1;
    this.timeScale += (targetScale - this.timeScale) * Math.min(1, realDelta * 12);
    const deltaTime = realDelta * this.timeScale;

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

    this.elapsedTime += deltaTime;
    this.updateDifficulty();

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

    const playerPos = this.player.getModel().position;
    let caught = false;
    let nearest = Infinity;
    for (const enemy of this.enemies) {
      enemy.update(deltaTime);
      if (enemy.hasCaughtPlayer()) caught = true;
      nearest = Math.min(nearest, playerPos.distanceTo(enemy.getWorldPosition()));
    }

    this.updateDangerFeedback(nearest, deltaTime);

    const followHeading = (onTouch || this.autoSprint) ? this.player.getHeading() : undefined;
    this.cameraController.update(
      this.player.getModel().position,
      this.player.getSprintRatio(),
      followHeading
    );

    this.uiSystem.updateStamina(this.player.getStaminaRatio(), this.player.isExhausted());

    this.uiSystem.updateFPS(deltaTime);
    this.uiSystem.updateScore(this.elapsedTime);

    if (caught) {
      this.endGame();
    }
  }

  /** Ramp dog speed and periodically add a dog as the run goes on. */
  private updateDifficulty(): void {
    const rampT = Math.max(0, this.elapsedTime - GAME.ESCALATION_START);
    const mult = Math.min(GAME.MAX_SPEED_MULT, 1 + rampT * GAME.SPEED_RAMP_PER_SEC);
    for (const enemy of this.enemies) enemy.setSpeedMultiplier(mult);

    if (
      this.elapsedTime >= this.nextDogSpawnTime &&
      this.enemies.length < GAME.MAX_DOGS &&
      !this.spawningDog
    ) {
      this.nextDogSpawnTime += GAME.EXTRA_DOG_INTERVAL;
      void this.spawnExtraDog(mult);
    }
  }

  /**
   * Danger vignette scales with the nearest dog's proximity; a near-miss
   * (a dog got very close then the player escaped) fires shake + slow-mo +
   * a flash.
   */
  private updateDangerFeedback(nearest: number, deltaTime: number): void {
    const near = 1.2;
    const far = GAME.NEAR_MISS_DISTANCE + 2.2;
    const level = THREE.MathUtils.clamp((far - nearest) / (far - near), 0, 1);
    this.uiSystem.setDangerLevel(level);

    // Sustained low rumble that grows as a dog closes in.
    if (level > 0.35) this.cameraController.shake(0.05 + level * 0.12);

    this.nearMissCooldown = Math.max(0, this.nearMissCooldown - deltaTime);
    if (nearest < GAME.NEAR_MISS_DISTANCE) {
      this.nearMissArmed = true;
    } else if (
      this.nearMissArmed &&
      nearest > GAME.NEAR_MISS_DISTANCE + 0.8 &&
      this.nearMissCooldown <= 0
    ) {
      this.nearMissArmed = false;
      this.nearMissCooldown = 1.5;
      this.cameraController.shake(0.35);
      this.uiSystem.flashDanger();
      this.slowMoTimer = 0.16;
    }
  }

  private async spawnExtraDog(speedMultiplier: number): Promise<void> {
    this.spawningDog = true;
    // Spawn at the arena corner farthest from the player so it doesn't pop in
    // on top of them.
    const p = this.player!.getModel().position;
    const edge = SCENE.ARENA_SIZE / 2 - 3;
    let best = { x: -edge, z: -edge };
    let bestDist = -1;
    for (const x of [-edge, edge]) {
      for (const z of [-edge, edge]) {
        const d = (p.x - x) ** 2 + (p.z - z) ** 2;
        if (d > bestDist) {
          bestDist = d;
          best = { x, z };
        }
      }
    }
    const enemy = await this.createOneEnemy(best.x, best.z);
    enemy.setTarget(this.player);
    enemy.setSpeedMultiplier(speedMultiplier);
    if (!this.gameOver) this.enemies.push(enemy);
    this.spawningDog = false;
  }

  private render(): void {
    this.renderer.render();
  }

  private endGame(): void {
    this.gameOver = true;
    this.uiSystem.setDangerLevel(0);
    this.slowMoTimer = 0;
    this.timeScale = 1;

    this.uiSystem.showGameOver(this.elapsedTime, () => {
      void this.restart();
    });
  }

  private resetRunState(): void {
    this.elapsedTime = 0;
    this.nextDogSpawnTime = GAME.EXTRA_DOG_INTERVAL;
    this.spawningDog = false;
    this.nearMissArmed = false;
    this.nearMissCooldown = 0;
    this.slowMoTimer = 0;
    this.timeScale = 1;
    this.uiSystem.setDangerLevel(0);
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
    this.resetRunState();

    await this.createPlayer();
    await this.createEnemies(this.dogCount);

    this.cameraController.setTarget(this.player!.getModel());

    this.uiSystem.hideGameOver();
  }
}
