# Mini Game - Third-Person Combat Game

A small, polished third-person combat game built with TypeScript, Three.js, Rapier Physics, and Vite.

## Features

- **Third-Person Camera**: Smooth, responsive camera follow with mouse orbit control
- **Player Controller**: Fluid WASD movement, sprinting, and jumping with physics-based locomotion
- **Combat System**: Melee attacks with combo system, knockback, and hit effects
- **Enemy AI**: State machine-based AI with Chase, Attack, and Idle states
- **Animation System**: Smooth animation blending and state transitions
- **Physics**: Realistic character movement and collision with Rapier physics engine
- **Polish**: Health bars, FPS counter, game over screen, camera shake on hits

## Project Structure

```
src/
├── core/
│   ├── Renderer.ts          # Three.js renderer setup
│   └── GameManager.ts       # Main game coordinator
├── physics/
│   └── PhysicsWorld.ts      # Rapier physics wrapper
├── player/
│   └── PlayerController.ts  # Player character logic
├── enemy/
│   └── EnemyController.ts   # Enemy AI logic
├── combat/
│   └── CombatSystem.ts      # Combat, damage, health
├── animation/
│   └── AnimationManager.ts  # Animation state machine
├── systems/
│   ├── CameraController.ts  # Third-person camera
│   └── UISystem.ts          # HUD and UI
├── scenes/
│   └── ArenaScene.ts        # Arena environment
├── utils/
│   ├── Constants.ts         # Game constants and config
│   └── VectorUtils.ts       # Math utility functions
├── assets/                  # Game assets
└── main.ts                  # Entry point
```

## Architecture

### Core Systems

#### 1. **Renderer** (`core/Renderer.ts`)
- Manages Three.js scene, camera, and renderer
- Handles lights (directional + ambient) and shadows
- Manages window resizing and viewport

#### 2. **Physics World** (`physics/PhysicsWorld.ts`)
- Wraps Rapier physics engine
- Creates and manages dynamic/static rigid bodies
- Handles raycast and collision detection

#### 3. **Game Manager** (`core/GameManager.ts`)
- Coordinates all game systems
- Manages game loop with fixed physics timestep
- Handles win/lose conditions and restart logic

### Character Systems

#### 4. **Player Controller** (`player/PlayerController.ts`)
- Input handling (WASD, Space, Mouse)
- Movement with acceleration and friction
- Combat state (attacking, hit stun)
- Integration with physics, animation, and combat systems

#### 5. **Enemy Controller** (`enemy/EnemyController.ts`)
- State machine (Idle → Chase → Attack → Hit → Dead)
- Autonomous movement and target detection
- Attack behavior with cooldowns
- Knockback and hit reactions

#### 6. **Combat System** (`combat/CombatSystem.ts`)
- `HealthComponent`: Health tracking and death
- `AttackComponent`: Attack cooldowns, combos, damage
- `DamageInfo`: Damage, knockback, stun data structure

### Animation System

#### 7. **Animation Manager** (`animation/AnimationManager.ts`)
- `AnimationManager`: Low-level animation mixing and fading
- `CharacterAnimationStateMachine`: High-level state transitions
- Smooth blending between animation states
- Animation speed scaling

### Camera & Input

#### 8. **Camera Controller** (`systems/CameraController.ts`)
- Third-person follow camera with smooth interpolation
- Mouse-based orbit controls (right-click + drag)
- Scroll wheel for distance adjustment
- Camera shake on hit impacts
- Pitch and yaw constraints

#### 9. **UI System** (`systems/UISystem.ts`)
- Player and enemy health bars
- FPS counter
- Game over screen with restart
- Simple DOM-based UI

### Environment

#### 10. **Arena Scene** (`scenes/ArenaScene.ts`)
- Procedurally creates arena ground
- Boundary walls
- Environmental props (pillars, platforms)
- Static physics colliders for environment

## Gameplay

### Controls

| Key | Action |
|-----|--------|
| W | Move Forward |
| A | Move Left |
| S | Move Backward |
| D | Move Right |
| Shift | Sprint |
| Space | Jump |
| Left Click | Attack |
| Right Click + Drag | Rotate Camera |
| Scroll Wheel | Zoom Camera |

### Game Flow

1. **Start**: Player and enemy spawn in arena
2. **Exploration**: Player moves around with WASD
3. **Combat**: Enemy detects player and pursues
   - When close enough: Enemy attacks
   - Player can attack with left click
   - Hits cause knockback and brief stun
4. **Win/Lose**: Game ends when either health reaches 0
5. **Restart**: Click restart button to play again

## Configuration

All game constants are defined in `src/utils/Constants.ts`:

```typescript
// Player stats
PLAYER.SPEED = 8
PLAYER.SPRINT_SPEED = 15
PLAYER.JUMP_FORCE = 12
PLAYER.MAX_HEALTH = 100

// Combat
COMBAT.ATTACK_RANGE = 2
COMBAT.ATTACK_DAMAGE = 20
COMBAT.ATTACK_KNOCKBACK = 8
COMBAT.ATTACK_COOLDOWN = 0.5

// Enemy stats
ENEMY.SPEED = 6
ENEMY.DETECTION_RADIUS = 20
ENEMY.MAX_HEALTH = 60

// Physics
PHYSICS.GRAVITY = -9.81
PHYSICS.FIXED_TIMESTEP = 1/60 // 60 Hz

// Camera
CAMERA.DISTANCE = 4
CAMERA.HEIGHT = 2
CAMERA.SMOOTHING = 0.1
```

## Design Decisions

### Architecture Patterns

1. **Separation of Concerns**: Each system (rendering, physics, animation, combat) is independent
2. **Composition over Inheritance**: Characters compose multiple components (Health, Attack, Animation)
3. **State Machines**: AI and animation use explicit state machines for clarity
4. **Entity Coordinates**: Game manager maintains references to player/enemy and syncs systems

### Physics Integration

- **Fixed Timestep**: Physics updates at fixed 60Hz regardless of frame rate
- **Accumulator Pattern**: Prevents physics drift and ensures stability
- **Dynamic Bodies**: Player and enemy use dynamic rigid bodies
- **Static Colliders**: Environment uses static bodies

### Animation

- **Blend-in/Fade-out**: Smooth animation transitions with fade duration
- **One-time Actions**: Attack, hit animations use `LoopOnce`
- **Continuous States**: Idle, run use `LoopRepeat`
- **Speed Scaling**: Animation speed adjusts based on movement speed

### Combat

- **Impulse-Based Knockback**: Instant velocity changes for impact feel
- **Hit Confirmation**: Attacks only damage each enemy once per swing
- **Combo System**: 20% damage increase per combo hit (max 3)
- **Stun Duration**: Brief hit stun prevents animation interruption

## Future Enhancements

- **Model Loading**: Load Mixamo character models and animations from GLB
- **Particles**: Hit spark effects, blood splats
- **Sound**: Attack sounds, hit sounds, UI sounds
- **Multiple Enemies**: Wave system with increasing difficulty
- **Weapon Variety**: Different attack types and weapons
- **Movement**: Wall-running, wall-climbing mechanics
- **Blocking**: Defensive stance to reduce damage
- **Combos**: More complex attack chains
- **Abilities**: Special moves with cooldowns
- **Difficulty Levels**: Adjustable enemy AI difficulty
- **Leaderboard**: Score system and leaderboard

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Vite will start a development server at `http://localhost:5173/`

### Build

```bash
npm run build
```

Creates optimized production build in `dist/`

### Preview

```bash
npm run preview
```

Serves the built version locally

## Technical Stack

- **TypeScript**: Static typing for reliability
- **Three.js**: 3D rendering engine
- **Rapier**: Physics engine (WASM-based)
- **Vite**: Fast build tool and dev server

## Performance Considerations

- **Delta Time Capping**: Prevents large timesteps causing physics instability
- **Physics Timestep**: Fixed 60Hz for deterministic behavior
- **Vector Reuse**: Minimizes garbage collection in hot paths
- **Frustum Culling**: Three.js handles camera culling automatically
- **Shadow Optimization**: PCFShadowShadowMap for performance

## Browser Support

- Modern browsers with WebGL and WebAssembly support
- Chrome/Edge/Firefox/Safari (latest versions)

## License

MIT

## Contributing

This is a learning/portfolio project. Feel free to fork and extend!

## Notes

- This is a prototype/demo showcasing game architecture
- Models currently use procedural geometry (replace with Mixamo GLB models)
- Sound system is a placeholder
- Physics may need tuning for different game feels
- Can be easily extended with more enemies, weapons, levels

Enjoy the game! 🎮
