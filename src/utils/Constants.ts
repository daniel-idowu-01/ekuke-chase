
export const PLAYER = {
  WALK_SPEED: 4,
  SPEED: 7,
  SPRINT_SPEED: 11,
  ACCELERATION: 18,
  DECELERATION: 14,
  ROTATION_SPEED: 10,
  JUMP_FORCE: 12,
  GROUND_DRAG: 0.1,
  AIR_DRAG: 0.02,
  MASS: 1,
  // Capsule collider sized to the GLB model. Half-height kept at the old
  // value so vertical movement/jump feel is unchanged; radius widened a
  // little to match the humanoid footprint. Total height = 2*(hh + r).
  CAPSULE_HALF_HEIGHT: 0.45,
  CAPSULE_RADIUS: 0.28,
};

// Sprint stamina. Drain/regen are in stamina-units per second; MAX is the
// pool size, so MAX / DRAIN ~ seconds of continuous sprint.
// Tuned for escapability: ~6.7s of sprint, quick recovery so the player can
// repeatedly open a gap instead of being permanently winded.
export const STAMINA = {
  MAX: 100,
  DRAIN_RATE: 15,
  REGEN_RATE: 26,
  REGEN_DELAY: 0.4,
  RECOVER_THRESHOLD: 0.15,
};

export const ENEMY = {
  // Chase speed sits just under the player's base run (PLAYER.SPEED 7), so
  // jogging holds even-to-slightly-ahead and a sprint (11) clearly escapes.
  // The dog is still a threat on turns/obstacles where the player loses speed.
  SPEED: 6.8,
  PATROL_SPEED: 2.6,
  ACCELERATION: 13,
  DECELERATION: 9,
  ROTATION_SPEED: 7,
  MASS: 1,
  // Target visual height (world units) the wolf GLB is scaled to. Its box
  // collider is derived from the scaled bounding box at load time.
  MODEL_HEIGHT: 0.85,
  // Behaviour radii (world units). The arena spans roughly -25..25.
  DETECTION_RADIUS: 15,
  // Reachable lose-interest: break ~18 units away for 2.5s and the dog gives
  // up and returns to patrol, granting a real breather in the larger map.
  LOSE_INTEREST_RADIUS: 18,
  CATCH_RADIUS: 0.9,
  // State timings (seconds).
  IDLE_DURATION: 1.8,
  ALERT_DURATION: 0.65,
  LOSE_INTEREST_TIME: 2.5,
  PATROL_REACH_DISTANCE: 1.2,
  PATROL_REPICK_TIME: 6,
};

export const GAME = {
  SURVIVAL_TIME: 60,
};

export const PHYSICS = {
  GRAVITY: -9.81,
  FIXED_TIMESTEP: 1 / 60,
  MAX_VELOCITY: 50,
};

export const CAMERA = {
  DISTANCE: 5.4,
  SPRINT_DISTANCE: 6.7,
  HEIGHT: 2.4,
  LOOK_AHEAD: 1.5,
  SMOOTHING: 0.08,
  MIN_PITCH: -Math.PI / 3,
  MAX_PITCH: Math.PI / 4,
  ROTATION_SENSITIVITY: 0.005,
  SHAKE_INTENSITY: 0.15,
  SHAKE_DURATION: 0.1,
};

export const ANIMATION = {
  FADE_DURATION: 0.18,
  IDLE_SPEED: 1,
  WALK_SPEED: 1,
  RUN_SPEED: 1.5,
  SPRINT_SPEED: 2,
  JUMP_SPEED: 1,
  ATTACK_SPEED: 1.2,
  HIT_SPEED: 1,
  DEATH_SPEED: 0.8,
};

export const SCENE = {
  ARENA_SIZE: 50,
  GROUND_HEIGHT: -0.5,
  LIGHT_INTENSITY: 2.6,
  AMBIENT_INTENSITY: 0.7,
  SHADOW_MAP_SIZE: 2048,
  SHADOW_CAMERA_FAR: 50,
  BACKGROUND_COLOR: 0x1c2430,
};

export const UI = {
  HEALTH_BAR_WIDTH: 200,
  HEALTH_BAR_HEIGHT: 20,
  PADDING: 16,
  FONT_SIZE: 16,
};

export const INPUT = {
  MOVE_FORWARD: 'w',
  MOVE_BACKWARD: 's',
  MOVE_LEFT: 'a',
  MOVE_RIGHT: 'd',
  SPRINT: 'Shift',
  JUMP: ' ',
  ATTACK: 'Mouse0',
};
