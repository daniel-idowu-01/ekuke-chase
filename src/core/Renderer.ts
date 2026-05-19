import * as THREE from 'three';
import { SCENE } from '../utils/Constants';


export class Renderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private directionalLight: THREE.DirectionalLight;
  private ambientLight: THREE.AmbientLight;
  private width: number;
  private height: number;

  constructor() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SCENE.BACKGROUND_COLOR);
    this.scene.fog = new THREE.FogExp2(0x1c2430, 0.035);

    this.camera = new THREE.PerspectiveCamera(
      75,
      this.width / this.height,
      0.1,
      1000
    );
    this.camera.position.set(0, 3, 5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    const app = document.querySelector<HTMLDivElement>('#app');
    (app || document.body).appendChild(this.renderer.domElement);

    this.ambientLight = new THREE.AmbientLight(
      0x9eb1c8,
      SCENE.AMBIENT_INTENSITY
    );
    this.scene.add(this.ambientLight);

    this.directionalLight = new THREE.DirectionalLight(
      0xffc982,
      SCENE.LIGHT_INTENSITY
    );
    this.directionalLight.position.set(-12, 18, 10);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.mapSize.width = SCENE.SHADOW_MAP_SIZE;
    this.directionalLight.shadow.mapSize.height = SCENE.SHADOW_MAP_SIZE;
    this.directionalLight.shadow.camera.far = SCENE.SHADOW_CAMERA_FAR;
    this.directionalLight.shadow.camera.left = -30;
    this.directionalLight.shadow.camera.right = 30;
    this.directionalLight.shadow.camera.top = 30;
    this.directionalLight.shadow.camera.bottom = -30;
    this.directionalLight.shadow.bias = -0.0001;
    this.scene.add(this.directionalLight);

    window.addEventListener('resize', () => this.onWindowResize());
  }

  getScene(): THREE.Scene {
    return this.scene;
  }

  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  setCameraPosition(x: number, y: number, z: number): void {
    this.camera.position.set(x, y, z);
  }

  setCameraTarget(x: number, y: number, z: number): void {
    this.camera.lookAt(x, y, z);
  }

  add(object: THREE.Object3D): void {
    this.scene.add(object);
  }

  remove(object: THREE.Object3D): void {
    this.scene.remove(object);
  }

  getDirectionalLight(): THREE.DirectionalLight {
    return this.directionalLight;
  }

  enableShadows(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }

  private onWindowResize(): void {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(this.width, this.height);
  }

  getSize(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  getCanvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }
}
