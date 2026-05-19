import * as THREE from 'three';
import { CAMERA } from '../utils/Constants';
import { VectorUtils } from '../utils/VectorUtils';


export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private targetPosition: THREE.Vector3 = new THREE.Vector3();
  private targetLookAt: THREE.Vector3 = new THREE.Vector3();
  private targetDistance: number = CAMERA.DISTANCE;
  private currentDistance: number = CAMERA.DISTANCE;
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

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
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
        case 'arrowleft':
        case 'q':
          this.keyState.rotateLeft = true;
          break;
        case 'arrowright':
        case 'e':
          this.keyState.rotateRight = true;
          break;
        case 'arrowup':
          this.keyState.tiltUp = true;
          break;
        case 'arrowdown':
          this.keyState.tiltDown = true;
          break;
      }
    });

    document.addEventListener('keyup', (e) => {
      switch (e.key.toLowerCase()) {
        case 'arrowleft':
        case 'q':
          this.keyState.rotateLeft = false;
          break;
        case 'arrowright':
        case 'e':
          this.keyState.rotateRight = false;
          break;
        case 'arrowup':
          this.keyState.tiltUp = false;
          break;
        case 'arrowdown':
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

  update(playerPos?: THREE.Vector3): void {
    if (!this.targetPlayer && !playerPos) {
      return;
    }

    const followPos = playerPos || this.targetPlayer!.position;

    this.updateKeyboardOrbit();

    const cameraOffset = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch) * this.currentDistance,
      CAMERA.HEIGHT + Math.abs(Math.sin(this.pitch)) * this.currentDistance,
      Math.cos(this.yaw) * Math.cos(this.pitch) * this.currentDistance
    );

    this.targetPosition = followPos.clone().add(cameraOffset);

    const lookAheadDir = new THREE.Vector3(
      Math.sin(this.yaw),
      0,
      Math.cos(this.yaw)
    );
    this.targetLookAt = followPos
      .clone()
      .addScaledVector(lookAheadDir, -CAMERA.LOOK_AHEAD)
      .add(new THREE.Vector3(0, CAMERA.HEIGHT * 0.5, 0));

    this.camera.position.lerp(this.targetPosition, CAMERA.SMOOTHING);
    this.camera.lookAt(this.targetLookAt);

    this.currentDistance = THREE.MathUtils.lerp(
      this.currentDistance,
      this.targetDistance,
      CAMERA.SMOOTHING
    );

    this.updateShake();
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
