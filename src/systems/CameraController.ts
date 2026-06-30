import * as THREE from 'three';
import { CAMERA } from '../utils/Constants';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { VectorUtils } from '../utils/VectorUtils';


export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private physicsWorld: PhysicsWorld;
  private targetPosition: THREE.Vector3 = new THREE.Vector3();
  private targetLookAt: THREE.Vector3 = new THREE.Vector3();
  private currentLookAt: THREE.Vector3 = new THREE.Vector3();
  private targetDistance: number = CAMERA.DISTANCE;
  private currentDistance: number = CAMERA.DISTANCE;
  private manualZoom: number = 0;
  private pitch: number = -0.35;
  private yaw: number = 0;
  private isMousePressed: boolean = false;
  private keyState = {
    rotateLeft: false,
    rotateRight: false,
    tiltUp: false,
    tiltDown: false,
  };
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;
  private targetPlayer: THREE.Object3D | null = null;
  private shakeIntensity: number = 0;
  private shakeTimer: number = 0;

  constructor(camera: THREE.PerspectiveCamera, physicsWorld: PhysicsWorld) {
    this.camera = camera;
    this.physicsWorld = physicsWorld;
    this.setupMouseInput();
  }

  setTarget(target: THREE.Object3D): void {
    this.targetPlayer = target;
  }

  private setupMouseInput(): void {
    document.addEventListener('mousedown', (e) => {
      if (e.button === 0 || e.button === 2) {
        this.isMousePressed = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (this.isMousePressed) {
        const deltaX = e.clientX - this.lastMouseX;
        const deltaY = e.clientY - this.lastMouseY;

        this.yaw -= deltaX * CAMERA.ROTATION_SENSITIVITY;
        this.pitch = VectorUtils.clamp(
          this.pitch - deltaY * CAMERA.ROTATION_SENSITIVITY,
          CAMERA.MIN_PITCH,
          CAMERA.MAX_PITCH
        );

        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      }
    });

    document.addEventListener('mouseup', (e) => {
      if (e.button === 0 || e.button === 2) {
        this.isMousePressed = false;
      }
    });

    document.addEventListener('keydown', (e) => {
      switch (e.key.toLowerCase()) {
        case 'q':
          this.keyState.rotateLeft = true;
          break;
        case 'e':
          this.keyState.rotateRight = true;
          break;
        case 'r':
          this.keyState.tiltUp = true;
          break;
        case 'f':
          this.keyState.tiltDown = true;
          break;
      }
    });

    document.addEventListener('keyup', (e) => {
      switch (e.key.toLowerCase()) {
        case 'q':
          this.keyState.rotateLeft = false;
          break;
        case 'e':
          this.keyState.rotateRight = false;
          break;
        case 'r':
          this.keyState.tiltUp = false;
          break;
        case 'f':
          this.keyState.tiltDown = false;
          break;
      }
    });

    document.addEventListener('wheel', (e) => {
      e.preventDefault();
      const wheelDelta = e.deltaY > 0 ? 1 : -1;
      this.targetDistance = VectorUtils.clamp(
        this.targetDistance + wheelDelta * 0.5,
        1,
        10
      );
    });

    document.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  update(playerPos?: THREE.Vector3, sprintRatio: number = 0, followHeading?: number): void {
    if (!this.targetPlayer && !playerPos) {
      return;
    }

    const followPos = playerPos || this.targetPlayer!.position;

    if (followHeading !== undefined) {
      // Auto-follow (touch): swing the camera to sit behind the player's
      // heading (yaw = heading + PI) using a shortest-arc lerp.
      const targetYaw = followHeading + Math.PI;
      let diff = ((targetYaw - this.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (diff < -Math.PI) diff += Math.PI * 2;
      this.yaw += diff * 0.08;
    } else {
      this.updateKeyboardOrbit();
    }

    this.targetDistance = THREE.MathUtils.clamp(
      THREE.MathUtils.lerp(CAMERA.DISTANCE, CAMERA.SPRINT_DISTANCE, sprintRatio) + this.manualZoom,
      2,
      11
    );

    const cameraOffset = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch) * this.currentDistance,
      CAMERA.HEIGHT + Math.abs(Math.sin(this.pitch)) * this.currentDistance,
      Math.cos(this.yaw) * Math.cos(this.pitch) * this.currentDistance
    );

    this.targetPosition = followPos.clone().add(cameraOffset);
    this.targetPosition = this.resolveCameraCollision(followPos, this.targetPosition);

    const lookAheadDir = new THREE.Vector3(
      Math.sin(this.yaw),
      0,
      Math.cos(this.yaw)
    );
    this.targetLookAt = followPos
      .clone()
      .addScaledVector(lookAheadDir, -CAMERA.LOOK_AHEAD)
      .add(new THREE.Vector3(0, CAMERA.HEIGHT * 0.5, 0));

    this.camera.position.lerp(this.targetPosition, 1 - Math.exp(-7 * CAMERA.SMOOTHING));
    this.currentLookAt.lerp(this.targetLookAt, 0.12);
    this.camera.lookAt(this.currentLookAt);

    this.currentDistance = THREE.MathUtils.lerp(
      this.currentDistance,
      this.targetDistance,
      CAMERA.SMOOTHING
    );

    if (sprintRatio > 0.65) {
      this.shakeIntensity = Math.max(this.shakeIntensity, CAMERA.SHAKE_INTENSITY * 0.35 * sprintRatio);
      this.shakeTimer = Math.max(this.shakeTimer, 0.08);
    }

    this.updateShake();
  }

  /** Pinch-to-zoom: positive = zoom out, negative = zoom in. */
  zoomBy(delta: number): void {
    this.manualZoom = VectorUtils.clamp(this.manualZoom + delta, -2.5, 4.5);
  }

  shake(intensity: number = CAMERA.SHAKE_INTENSITY): void {
    this.shakeIntensity = intensity;
    this.shakeTimer = CAMERA.SHAKE_DURATION;
  }

  private updateShake(): void {
    if (this.shakeTimer > 0) {
      this.shakeTimer -= 1 / 60;

      const shakeAmount = (this.shakeTimer / CAMERA.SHAKE_DURATION) * this.shakeIntensity;

      const shake = new THREE.Vector3(
        (Math.random() - 0.5) * shakeAmount,
        (Math.random() - 0.5) * shakeAmount,
        (Math.random() - 0.5) * shakeAmount
      );

      this.camera.position.add(shake);
    }
  }

  private updateKeyboardOrbit(): void {
    const rotateSpeed = 0.035;
    const tiltSpeed = 0.025;

    if (this.keyState.rotateLeft) this.yaw += rotateSpeed;
    if (this.keyState.rotateRight) this.yaw -= rotateSpeed;
    if (this.keyState.tiltUp) {
      this.pitch = VectorUtils.clamp(this.pitch + tiltSpeed, CAMERA.MIN_PITCH, CAMERA.MAX_PITCH);
    }
    if (this.keyState.tiltDown) {
      this.pitch = VectorUtils.clamp(this.pitch - tiltSpeed, CAMERA.MIN_PITCH, CAMERA.MAX_PITCH);
    }
  }

  private resolveCameraCollision(followPos: THREE.Vector3, desiredPosition: THREE.Vector3): THREE.Vector3 {
    const origin = followPos.clone().add(new THREE.Vector3(0, 1, 0));
    const toCamera = desiredPosition.clone().sub(origin);
    const distance = toCamera.length();
    if (distance <= 0.01) return desiredPosition;

    const direction = toCamera.normalize();
    const hit = this.physicsWorld.raycast(origin, direction, distance);
    if (!hit || hit.toi > distance) return desiredPosition;

    return origin.add(direction.multiplyScalar(Math.max(1.2, hit.toi - 0.25)));
  }

  setPitch(pitch: number): void {
    this.pitch = VectorUtils.clamp(
      pitch,
      CAMERA.MIN_PITCH,
      CAMERA.MAX_PITCH
    );
  }

  setYaw(yaw: number): void {
    this.yaw = yaw;
  }

  getPitch(): number {
    return this.pitch;
  }

  getYaw(): number {
    return this.yaw;
  }

  getPosition(): THREE.Vector3 {
    return this.camera.position.clone();
  }

  getDirection(): THREE.Vector3 {
    return new THREE.Vector3(0, 0, -1)
      .applyQuaternion(this.camera.quaternion);
  }
}
