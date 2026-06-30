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
    // Bright sunny-day mood: vertical gradient sky + light atmospheric haze
    // tinted to the horizon colour so distant geometry fades cleanly.
    this.scene.background = this.createSkyTexture();
    this.scene.fog = new THREE.FogExp2(0xcfe7ff, 0.014);

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
    this.renderer.toneMappingExposure = 1.05;
    const app = document.querySelector<HTMLDivElement>('#app');
    (app || document.body).appendChild(this.renderer.domElement);

    // Sky-tinted ambient fill keeps shadows from going muddy under the sun.
    this.ambientLight = new THREE.AmbientLight(
      0xbfd4ff,
      SCENE.AMBIENT_INTENSITY
    );
    this.scene.add(this.ambientLight);

    // Hemisphere light fakes bounced light: warm sky from above, cool ground
    // bounce from below. Cheap and sells the stylized daytime look.
    const hemiLight = new THREE.HemisphereLight(0xeaf4ff, 0x8a8f7a, 0.55);
    this.scene.add(hemiLight);

    this.directionalLight = new THREE.DirectionalLight(
      0xfff1d0,
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

  private createSkyTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0.0, '#2f7fe0'); // zenith
    gradient.addColorStop(0.55, '#7fb4ef');
    gradient.addColorStop(1.0, '#d6ecff'); // horizon haze
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2, 256);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
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
