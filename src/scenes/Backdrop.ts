import * as THREE from 'three';
import { Renderer } from '../core/Renderer';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { SCENE } from '../utils/Constants';

/**
 * Everything beyond the playable arena: a shader sky (gradient, sun, drifting
 * volumetric-looking clouds + cirrus), two mountain ranges, a layered skyline
 * with procedural windows and blinking aircraft-warning lights, a few landmark
 * towers, avenues that run on to the horizon, bird flocks and a blimp.
 *
 * The first skyline ring is a walkable outer district (colliders, coins,
 * fenced at SCENE.PLAY_HALF); everything further out is scenery. Distant geometry fades into the same haze colour
 * the scene fog uses so the city melts into the horizon instead of ending at
 * a wall. Call update() every frame (menu included) to animate it.
 */
export const SKY_COLORS = {
  zenith: new THREE.Color(0x1f63c9),
  horizon: new THREE.Color(0xcfe3f5),
  ground: new THREE.Color(0xa9bccb),
  sun: new THREE.Color(0xfff0cf),
  cloud: new THREE.Color(0xffffff),
  cloudShade: new THREE.Color(0x93a8c0),
};

export const FOG_DENSITY = 0.0085;

const NOISE_GLSL = /* glsl */ `
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
               mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 5; i++) {
      v += a * vnoise(p);
      p = m * p;
      a *= 0.5;
    }
    return v;
  }
`;

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  uniform vec3 uSunColor;
  uniform vec3 uSunDir;
  uniform vec3 uCloud;
  uniform vec3 uCloudShade;
  uniform float uTime;
  varying vec3 vDir;
  ${NOISE_GLSL}

  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    float sunAmt = max(dot(d, uSunDir), 0.0);

    // Base gradient: a bright horizon band tightening into a deep zenith.
    float t = pow(clamp(h, 0.0, 1.0), 0.42);
    vec3 col = mix(uHorizon, uZenith, t);
    // Warm forward-scatter around the sun, strongest low in the sky.
    float lowSky = 1.0 - clamp(h * 2.5, 0.0, 1.0);
    col = mix(col, uSunColor, pow(sunAmt, 5.0) * (0.18 + 0.32 * lowSky));
    // Below the horizon: haze fading into the ground colour.
    if (h < 0.0) col = mix(uHorizon, uGround, clamp(-h * 5.0, 0.0, 1.0));

    if (h > 0.0) {
      vec2 uv = d.xz / (h + 0.14);
      vec2 wind = vec2(uTime * 0.010, uTime * 0.0035);

      // High, streaky cirrus behind the cumulus.
      float ci = fbm(vec2(uv.x * 0.35, uv.y * 2.4) + wind * 0.6 + 31.0);
      float cirrus = smoothstep(0.55, 0.85, ci) * 0.35 * smoothstep(0.05, 0.35, h);
      col = mix(col, uCloud, cirrus);

      // Puffy cumulus: two octave bands, self-shadowed by sampling toward the sun.
      vec2 p = uv * 1.25 + wind;
      float n1 = fbm(p) * 0.72;
      float n = n1 + fbm(p * 2.3 - wind * 1.5 + 7.3) * 0.38;
      float cover = smoothstep(0.50, 0.80, n);
      float ns = fbm(p + uSunDir.xz * 0.18) * 0.72 + (n - n1);
      float lit = clamp(0.62 + (n - ns) * 3.2, 0.0, 1.0);
      vec3 cc = mix(uCloudShade, uCloud, lit);
      // Silver lining on cloud edges facing the sun.
      cc += uSunColor * pow(sunAmt, 6.0) * (1.0 - cover) * 0.9;
      float fade = smoothstep(0.015, 0.2, h);
      col = mix(col, cc, cover * fade * 0.95);
    }

    // Sun disc + glow (drawn over thin cloud so it peeks through).
    col += uSunColor * (smoothstep(0.9992, 0.9996, sunAmt) * 6.0 + pow(sunAmt, 180.0) * 0.8 + pow(sunAmt, 18.0) * 0.12);

    // Tiny dither to kill gradient banding.
    col += (hash12(gl_FragCoord.xy) - 0.5) / 255.0;

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const TOWER_VERT = /* glsl */ `
  varying vec3 vColor;
  varying vec3 vNormalW;
  varying vec3 vWorld;
  varying vec2 vWin;
  varying float vSeed;
  uniform vec3 uTint;
  void main() {
    mat4 m = modelMatrix;
    #ifdef USE_INSTANCING
      m = modelMatrix * instanceMatrix;
    #endif
    vec3 scale = vec3(length(m[0].xyz), length(m[1].xyz), length(m[2].xyz));
    vec3 local = position * scale;
    vWin = vec2(abs(normal.x) > 0.5 ? local.z : local.x, local.y + m[3].y);
    vSeed = m[3].x * 0.137 + m[3].z * 0.719;
    vNormalW = normalize(mat3(m) * normal);
    vec4 wp = m * vec4(position, 1.0);
    vWorld = wp.xyz;
    vColor = uTint;
    #ifdef USE_INSTANCING_COLOR
      vColor *= instanceColor;
    #endif
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const TOWER_FRAG = /* glsl */ `
  uniform vec3 uHaze;
  uniform vec3 uSunDir;
  uniform vec3 uGlass;
  uniform vec3 uSkyRefl;
  uniform float uFogDensity;
  uniform float uWindows;
  varying vec3 vColor;
  varying vec3 vNormalW;
  varying vec3 vWorld;
  varying vec2 vWin;
  varying float vSeed;
  ${NOISE_GLSL}

  void main() {
    vec3 n = normalize(vNormalW);
    float isRoof = step(0.5, n.y);
    vec3 base = vColor;

    // Procedural window grid, anti-aliased by blending to its average
    // coverage once a cell shrinks to a few pixels.
    // Per-building facade style: window pitch varies, and some towers get
    // continuous ribbon glazing instead of punched windows.
    float style = fract(vSeed * 5.731);
    vec2 pitch = vec2(1.6 + fract(vSeed * 3.17) * 1.4, 2.7 + fract(vSeed * 7.31) * 0.9);
    vec2 cell = vWin / pitch;
    vec2 f = fract(cell);
    float win = step(0.24, f.y) * step(f.y, 0.76);
    if (style > 0.3) win *= step(0.2, f.x) * step(f.x, 0.8);
    else if (style < 0.1) win = step(0.12, f.x) * step(f.x, 0.88); // vertical fins
    vec2 w = fwidth(cell);
    win = mix(win, 0.33, smoothstep(0.25, 0.7, max(w.x, w.y)));
    win *= (1.0 - isRoof) * uWindows;
    float rnd = hash12(floor(cell) + vSeed);
    vec3 glass = mix(uGlass, uSkyRefl, 0.25 + 0.6 * rnd * smoothstep(0.0, 1.0, vWin.y / 60.0 + 0.3));
    float upper = step(3.8, vWin.y);
    base = mix(base, glass, win * upper);

    // Street level: darker storefront band with wide shop windows and a
    // trim line, so the walkable district holds up close.
    float wall = 1.0 - isRoof;
    float shopX = fract(vWin.x / 4.2);
    float shop = step(0.5, vWin.y) * step(vWin.y, 3.1) * step(0.12, shopX) * step(shopX, 0.88);
    base = mix(base, base * 0.62, wall * (1.0 - upper));
    base = mix(base, mix(uGlass, uSkyRefl, 0.35), wall * (1.0 - upper) * shop);
    base *= 1.0 - 0.3 * wall * upper * step(vWin.y, 4.2);

    float diff = max(dot(n, uSunDir), 0.0);
    vec3 col = base * (0.5 + 0.62 * diff + 0.18 * (0.5 + 0.5 * n.y));
    // Cheap ambient occlusion toward street level.
    col *= mix(0.72, 1.0, smoothstep(0.0, 14.0, vWorld.y));

    // Aerial perspective: gentle distance haze, plus the scene's exp2 fog
    // near the ground so bases melt into the same haze as the floor.
    float dist = length(vWorld - cameraPosition);
    float distHaze = smoothstep(40.0, 560.0, dist) * 0.82;
    float fogF = 1.0 - exp(-pow(dist * uFogDensity, 2.0));
    float haze = mix(distHaze, max(distHaze, fogF), exp(-max(vWorld.y, 0.0) / 16.0));
    col = mix(col, uHaze, haze);

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

type Flock = {
  birds: Array<{ root: THREE.Group; left: THREE.Mesh; right: THREE.Mesh; offset: THREE.Vector3; phase: number }>;
  center: THREE.Vector2;
  radius: number;
  height: number;
  speed: number;
  angle: number;
};

export class Backdrop {
  private renderer: Renderer;
  private root = new THREE.Group();
  private sky!: THREE.Mesh;
  private skyMaterial!: THREE.ShaderMaterial;
  private beacons!: THREE.InstancedMesh;
  private beaconMaterial = new THREE.MeshBasicMaterial({ color: 0xff3b30, fog: false, toneMapped: false });
  private flocks: Flock[] = [];
  private blimp = new THREE.Group();
  private blimpLight!: THREE.Mesh;
  private blimpAngle = 0.8;
  private time = 0;
  private sunDir = new THREE.Vector3();
  private rng = mulberry32(1337);

  private readonly HALF = SCENE.ARENA_SIZE / 2;
  /** Hero tower sites (x, z); the generated skyline keeps clear of them. */
  private static readonly LANDMARKS: Array<[number, number]> = [[185, -235], [-250, 205], [-215, -255]];

  /** Footprints of walkable-district buildings, for spawn rejection. */
  private blocks: Array<{ x: number; z: number; hw: number; hd: number }> = [];
  private physicsWorld: PhysicsWorld;

  constructor(renderer: Renderer, physicsWorld: PhysicsWorld) {
    this.renderer = renderer;
    this.physicsWorld = physicsWorld;
    this.sunDir.copy(renderer.getDirectionalLight().position).normalize();
  }

  setup(): void {
    this.root.name = 'Backdrop';
    const scene = this.renderer.getScene();
    scene.background = SKY_COLORS.horizon.clone();
    scene.fog = new THREE.FogExp2(SKY_COLORS.horizon.getHex(), FOG_DENSITY);
    this.createSky();
    this.createMountains(560, 0x8ea9c4, 70, 150, 0.6, true);
    this.createMountains(430, 0x7d9cad, 34, 80, 1.3, false);
    this.createOuterGround();
    this.createSkyline();
    this.createBoundary();
    this.createLandmarks();
    this.createBirds();
    this.createBlimp();
    this.renderer.add(this.root);
  }

  update(dt: number): void {
    this.time += dt;
    const cam = this.renderer.getCamera();
    this.sky.position.copy(cam.position);
    this.skyMaterial.uniforms.uTime.value = this.time;

    // Aircraft-warning lights: slow synced blink like real tower beacons.
    const blink = Math.sin(this.time * 2.4) > 0.55 ? 1 : 0.08;
    this.beaconMaterial.color.setRGB(1.6 * blink, 0.25 * blink, 0.18 * blink);
    (this.blimpLight.material as THREE.MeshBasicMaterial).color.setRGB(
      Math.sin(this.time * 3.1 + 1) > 0.7 ? 2 : 0.2,
      0.2,
      0.2
    );

    this.updateBirds(dt);
    this.updateBlimp(dt);
  }

  // ---------------------------------------------------------------- sky

  private createSky(): void {
    this.skyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uZenith: { value: SKY_COLORS.zenith },
        uHorizon: { value: SKY_COLORS.horizon },
        uGround: { value: SKY_COLORS.ground },
        uSunColor: { value: SKY_COLORS.sun },
        uSunDir: { value: this.sunDir },
        uCloud: { value: SKY_COLORS.cloud },
        uCloudShade: { value: SKY_COLORS.cloudShade },
        uTime: { value: 0 },
      },
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(900, 64, 32), this.skyMaterial);
    this.sky.renderOrder = -1000;
    this.sky.frustumCulled = false;
    this.root.add(this.sky);
  }

  // ---------------------------------------------------------- mountains

  /** A closed ring of ridgeline, coloured by height (optional snow caps). */
  private createMountains(
    radius: number,
    color: number,
    minH: number,
    maxH: number,
    roughness: number,
    snow: boolean
  ): void {
    const segments = 360;
    const rows = 8;
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const baseCol = new THREE.Color(color);
    const snowCol = new THREE.Color(0xf2f6fb);
    const hazeCol = SKY_COLORS.horizon;
    const seed = this.rng() * 100;
    const tmp = new THREE.Color();

    const ridge = (a: number): number => {
      let v = 0;
      v += Math.sin(a * 3 + seed) * 0.35;
      v += Math.sin(a * 7.3 + seed * 1.7) * 0.25 * roughness;
      v += Math.sin(a * 17.1 + seed * 0.3) * 0.12 * roughness;
      v += Math.abs(Math.sin(a * 31.7 + seed * 2.1)) * 0.08 * roughness;
      v += Math.sin(a * 63.3 + seed) * 0.03;
      return minH + (maxH - minH) * THREE.MathUtils.clamp(0.5 + v, 0, 1);
    };

    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const top = ridge(a);
      for (let r = 0; r <= rows; r++) {
        const k = r / rows;
        // Bow the face outward a touch so it reads as a slope, not a wall.
        const rr = radius + (1 - k) * 30;
        const y = -6 + (top + 6) * k;
        positions.push(Math.cos(a) * rr, y, Math.sin(a) * rr);
        tmp.copy(baseCol).lerp(hazeCol, (1 - k) * 0.75);
        if (snow && k > 0.82 && top > maxH * 0.72) tmp.lerp(snowCol, Math.min(1, (k - 0.82) * 7));
        colors.push(tmp.r, tmp.g, tmp.b);
      }
    }
    const stride = rows + 1;
    for (let i = 0; i < segments; i++) {
      for (let r = 0; r < rows; r++) {
        const a = i * stride + r;
        const b = (i + 1) * stride + r;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide })
    );
    mesh.renderOrder = -900;
    this.root.add(mesh);
  }

  // ------------------------------------------------------- outer ground

  private createOuterGround(): void {
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(700, 64),
      new THREE.MeshLambertMaterial({ color: 0x8a9098 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    this.root.add(ground);
    // Floor collider for the outer district (top at y = 0, like the arena's).
    const span = SCENE.PLAY_HALF * 2 + 20;
    this.physicsWorld.createStaticBody(new THREE.Vector3(0, -0.5, 0), 'box', { width: span, height: 1, depth: span });

    // The two avenues carry on past the arena edge toward the horizon.
    // Polygon offset keeps the overlays from z-fighting the ground far away.
    const asphalt = new THREE.MeshLambertMaterial({ color: 0x4a4d55, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const line = new THREE.MeshLambertMaterial({ color: 0xf2c23e, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const len = 640;
    const start = this.HALF + 4;
    for (const sign of [-1, 1]) {
      for (const alongX of [true, false]) {
        const mid = sign * (start + len / 2);
        const road = new THREE.Mesh(new THREE.PlaneGeometry(alongX ? len : 11, alongX ? 11 : len), asphalt);
        road.rotation.x = -Math.PI / 2;
        road.position.set(alongX ? mid : 0, -0.01, alongX ? 0 : mid);
        road.receiveShadow = true;
        this.root.add(road);
        for (let d = start + 1.5; d < start + 160; d += 3) {
          const dash = new THREE.Mesh(new THREE.PlaneGeometry(alongX ? 1.4 : 0.18, alongX ? 0.18 : 1.4), line);
          dash.rotation.x = -Math.PI / 2;
          dash.position.set(alongX ? sign * d : 0, 0, alongX ? 0 : sign * d);
          this.root.add(dash);
        }
      }
    }
  }

  // ------------------------------------------------------------ skyline

  private makeTowerMaterial(tint: number, windows = 1): THREE.ShaderMaterial {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTint: { value: new THREE.Color(tint) },
        uHaze: { value: SKY_COLORS.horizon },
        uSunDir: { value: this.sunDir },
        uGlass: { value: new THREE.Color(0x27394a) },
        uSkyRefl: { value: new THREE.Color(0x9cc6ea) },
        uFogDensity: { value: FOG_DENSITY },
        uWindows: { value: windows },
      },
      vertexShader: TOWER_VERT,
      fragmentShader: TOWER_FRAG,
      fog: false,
    });
    return mat;
  }

  /**
   * Fill a square annulus around the arena with blocks of buildings on a
   * jittered grid, leaving the avenue corridors open. Heights climb with
   * distance and peak in a "downtown" cluster so the silhouette has a focus.
   */
  private createSkyline(): void {
    const palette = [0xc9b8a6, 0xa8b4c2, 0xd8cdbd, 0x8f9aa8, 0xb7a08c, 0xe1d9cc, 0x9aa7a0, 0xc2c7cf, 0xa98f7f];
    const box = new THREE.BoxGeometry(1, 1, 1);
    box.translate(0, 0.5, 0);

    type Spec = { x: number; z: number; w: number; d: number; h: number; c: THREE.Color };
    const specs: Spec[] = [];
    const beaconPos: THREE.Vector3[] = [];
    const downtownAngle = -Math.PI * 0.3; // north-east-ish, behind the alley block

    const rings = [
      { inner: this.HALF + 12, outer: this.HALF + 70, cell: 14, hMin: 12, hMax: 30, skip: 0.3 },
      { inner: this.HALF + 70, outer: this.HALF + 200, cell: 20, hMin: 22, hMax: 70, skip: 0.22 },
      { inner: this.HALF + 200, outer: this.HALF + 330, cell: 30, hMin: 30, hMax: 85, skip: 0.15 },
    ];

    rings.forEach((ring, ringIndex) => {
      const walkable = ringIndex === 0;
      for (let gx = -ring.outer; gx <= ring.outer; gx += ring.cell) {
        for (let gz = -ring.outer; gz <= ring.outer; gz += ring.cell) {
          const cheb = Math.max(Math.abs(gx), Math.abs(gz));
          if (cheb < ring.inner || cheb >= ring.outer) continue;
          if (Math.abs(gx) < 12 + ring.cell / 2 || Math.abs(gz) < 12 + ring.cell / 2) continue; // avenue corridors
          if (Math.hypot(gx, gz) > 400) continue;
          if (this.rng() < ring.skip) continue; // the odd empty lot / plaza
          // Keep the fence line clear: walkable blocks stop short of it and
          // scenery blocks start beyond it.
          if (walkable && cheb > SCENE.PLAY_HALF - 10) continue;
          if (!walkable && cheb - ring.cell * 0.5 < SCENE.PLAY_HALF + 2) continue;
          if (Backdrop.LANDMARKS.some(([lx, lz]) => Math.hypot(gx - lx, gz - lz) < 40)) continue;

          // Walkable ring gets less jitter so its streets stay runnable.
          const jitter = walkable ? 0.1 : 0.25;
          const x = gx + (this.rng() - 0.5) * ring.cell * jitter;
          const z = gz + (this.rng() - 0.5) * ring.cell * jitter;
          const w = ring.cell * (0.45 + this.rng() * 0.3);
          const d = ring.cell * (0.45 + this.rng() * 0.3);
          let angDiff = Math.abs(Math.atan2(z, x) - downtownAngle);
          angDiff = Math.min(angDiff, Math.PI * 2 - angDiff);
          const downtown = Math.exp(-angDiff * angDiff * 6);
          let h = ring.hMin + Math.pow(this.rng(), 1.6) * (ring.hMax - ring.hMin);
          h *= 1 + downtown * 1.1;
          const c = new THREE.Color(palette[Math.floor(this.rng() * palette.length)]);
          specs.push({ x, z, w, d, h, c });
          if (walkable) {
            this.physicsWorld.createStaticBody(new THREE.Vector3(x, h / 2, z), 'box', { width: w, height: h, depth: d });
            this.blocks.push({ x, z, hw: w / 2, hd: d / 2 });
          }

          // Setback crown on taller towers.
          if (h > 45 && this.rng() < 0.6) {
            const k = 0.55 + this.rng() * 0.2;
            const ch = h * (0.12 + this.rng() * 0.18);
            specs.push({ x, z, w: w * k, d: d * k, h: h + ch, c: c.clone().multiplyScalar(0.92) });
            h += ch;
          }
          // Rooftop mast + warning light on the tallest.
          if (h > 85 && this.rng() < 0.7) {
            const mast = 4 + this.rng() * 8;
            specs.push({ x, z, w: 0.5, d: 0.5, h: h + mast, c: new THREE.Color(0x5a5f66) });
            beaconPos.push(new THREE.Vector3(x, h + mast + 0.4, z));
          }
        }
      }
    });

    const mat = this.makeTowerMaterial(0xffffff);
    const mesh = new THREE.InstancedMesh(box, mat, specs.length);
    const m = new THREE.Matrix4();
    specs.forEach((s, i) => {
      m.makeScale(s.w, s.h, s.d).setPosition(s.x, 0, s.z);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, s.c);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    this.root.add(mesh);

    this.beacons = new THREE.InstancedMesh(new THREE.SphereGeometry(0.6, 8, 6), this.beaconMaterial, Math.max(1, beaconPos.length + 8));
    beaconPos.forEach((p, i) => this.beacons.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z)));
    this.beacons.count = beaconPos.length;
    this.beacons.frustumCulled = false;
    this.root.add(this.beacons);
  }

  /** A few hero silhouettes that anchor the skyline: spire, TV needle, twins. */
  private createLandmarks(): void {
    const glassTower = this.makeTowerMaterial(0x7f9db8);
    const stone = this.makeTowerMaterial(0xd9d2c4);
    const plain = this.makeTowerMaterial(0xe8e8ea, 0);
    const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const addBox = (mat: THREE.Material, x: number, z: number, w: number, d: number, y0: number, h: number) => {
      const b = new THREE.Mesh(box, mat);
      b.scale.set(w, h, d);
      b.position.set(x, y0, z);
      this.root.add(b);
    };
    const beacon = (x: number, y: number, z: number) => {
      const i = this.beacons.count++;
      this.beacons.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, y, z));
      this.beacons.instanceMatrix.needsUpdate = true;
    };

    // Stepped glass spire in the downtown cluster.
    {
      const x = 185, z = -235;
      addBox(glassTower, x, z, 26, 26, 0, 120);
      addBox(glassTower, x, z, 19, 19, 120, 45);
      addBox(glassTower, x, z, 12, 12, 165, 25);
      const spire = new THREE.Mesh(new THREE.ConeGeometry(2.2, 42, 8), plain);
      spire.position.set(x, 190 + 21, z);
      this.root.add(spire);
      beacon(x, 233, z);
    }

    // TV needle tower, south-west.
    {
      const x = -250, z = 205;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 4.5, 150, 12).translate(0, 75, 0), plain);
      shaft.position.set(x, 0, z);
      this.root.add(shaft);
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(13, 8, 9, 20), stone);
      pod.position.set(x, 128, z);
      this.root.add(pod);
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 1.6, 24), plain);
      ring.position.set(x, 122.5, z);
      this.root.add(ring);
      const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.2, 40, 6).translate(0, 20, 0), plain);
      needle.position.set(x, 150, z);
      this.root.add(needle);
      beacon(x, 191, z);
    }

    // Twin towers, north-west.
    for (const dx of [-14, 14]) {
      const x = -215 + dx, z = -255;
      addBox(stone, x, z, 18, 18, 0, 128);
      addBox(stone, x, z, 12, 12, 128, 14);
      beacon(x, 146, z);
    }
    addBox(stone, -215, -255, 10, 6, 70, 5); // sky bridge
  }

  /**
   * Fenced edge of the walkable world, with striped roadblocks where the
   * avenues cross it so the boundary reads as intentional.
   */
  private createBoundary(): void {
    const edge = SCENE.PLAY_HALF;
    const height = 2.4;
    const postMat = new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.6, metalness: 0.4 });
    const meshMat = new THREE.MeshStandardMaterial({
      color: 0x9aa3ad,
      roughness: 0.5,
      metalness: 0.5,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const spacing = 3;
    const perSide = Math.floor((edge * 2) / spacing);
    const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, height, 0.14), postMat, perSide * 4);
    const m = new THREE.Matrix4();
    let n = 0;
    for (let side = 0; side < 4; side++) {
      const alongX = side < 2;
      const sign = side % 2 === 0 ? -1 : 1;
      for (let i = 0; i < perSide; i++) {
        const t = -edge + i * spacing;
        m.makeTranslation(alongX ? t : sign * edge, height / 2, alongX ? sign * edge : t);
        posts.setMatrixAt(n++, m);
      }
      const len = edge * 2;
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(len, height - 0.2), meshMat);
      panel.position.set(alongX ? 0 : sign * edge, height / 2, alongX ? sign * edge : 0);
      if (!alongX) panel.rotation.y = Math.PI / 2;
      this.root.add(panel);
      for (const y of [0.15, height - 0.05]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len : 0.1, 0.1, alongX ? 0.1 : len), postMat);
        rail.position.set(alongX ? 0 : sign * edge, y, alongX ? sign * edge : 0);
        this.root.add(rail);
      }
      this.physicsWorld.createStaticBody(
        new THREE.Vector3(alongX ? 0 : sign * (edge + 0.3), 2, alongX ? sign * (edge + 0.3) : 0),
        'box',
        { width: alongX ? len + 2 : 0.6, height: 4, depth: alongX ? 0.6 : len + 2 }
      );
    }
    posts.castShadow = true;
    this.root.add(posts);

    // Red/white striped barriers across each avenue just inside the fence.
    const stripe = document.createElement('canvas');
    stripe.width = 128;
    stripe.height = 16;
    const ctx = stripe.getContext('2d')!;
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#f4f1ea' : '#d8392f';
      ctx.fillRect(i * 16, 0, 16, 16);
    }
    const tex = new THREE.CanvasTexture(stripe);
    tex.colorSpace = THREE.SRGBColorSpace;
    const barMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
    const legMat = new THREE.MeshStandardMaterial({ color: 0xe8e8ea, roughness: 0.7 });
    for (let side = 0; side < 4; side++) {
      const alongX = side < 2;
      const sign = side % 2 === 0 ? -1 : 1;
      const g = new THREE.Group();
      const bar = new THREE.Mesh(new THREE.BoxGeometry(12, 0.35, 0.12), barMat);
      bar.position.y = 1.05;
      const bar2 = bar.clone();
      bar2.position.y = 0.55;
      g.add(bar, bar2);
      for (const lx of [-5.5, 0, 5.5]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.25, 0.6), legMat);
        leg.position.set(lx, 0.62, 0);
        g.add(leg);
      }
      g.traverse((o) => { o.castShadow = true; });
      // alongX sides sit at z = ±edge and span x; others at x = ±edge.
      g.position.set(alongX ? 0 : sign * (edge - 1.2), 0, alongX ? sign * (edge - 1.2) : 0);
      if (!alongX) g.rotation.y = Math.PI / 2;
      this.root.add(g);
    }
  }

  /** True when (x, z) lies inside (or within `pad` of) a district building. */
  private isBlocked(x: number, z: number, pad: number): boolean {
    return this.blocks.some((b) => Math.abs(x - b.x) < b.hw + pad && Math.abs(z - b.z) < b.hd + pad);
  }

  /**
   * A random open spot in the outer district (between the arena's rim
   * buildings and the fence), clear of the district's buildings.
   */
  randomDistrictPoint(): THREE.Vector2 {
    const lo = this.HALF + 5;
    const hi = SCENE.PLAY_HALF - 3;
    for (let tries = 0; tries < 40; tries++) {
      const x = (Math.random() * 2 - 1) * hi;
      const z = (Math.random() * 2 - 1) * hi;
      if (Math.max(Math.abs(x), Math.abs(z)) < lo) continue;
      if (this.isBlocked(x, z, 1)) continue;
      return new THREE.Vector2(x, z);
    }
    return new THREE.Vector2(0, hi); // the south avenue is always open
  }

  // -------------------------------------------------------------- birds

  private createBirds(): void {
    const wingGeo = new THREE.BufferGeometry();
    // One wing, root at origin, extending along +x.
    wingGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 0, 0.18, 0, 0, -0.22, 0.95, 0, -0.05], 3)
    );
    wingGeo.computeVertexNormals();
    const mat = new THREE.MeshBasicMaterial({ color: 0x2a313b, side: THREE.DoubleSide });

    const formations = [
      { center: new THREE.Vector2(-20, -30), radius: 60, height: 34, speed: 0.11, count: 7 },
      { center: new THREE.Vector2(30, 25), radius: 85, height: 46, speed: -0.08, count: 5 },
      { center: new THREE.Vector2(0, 0), radius: 120, height: 58, speed: 0.06, count: 9 },
    ];
    for (const f of formations) {
      const flock: Flock = { birds: [], center: f.center, radius: f.radius, height: f.height, speed: f.speed, angle: this.rng() * Math.PI * 2 };
      for (let i = 0; i < f.count; i++) {
        const root = new THREE.Group();
        const left = new THREE.Mesh(wingGeo, mat);
        left.scale.x = -1;
        const right = new THREE.Mesh(wingGeo, mat);
        root.add(left, right);
        root.scale.setScalar(0.75);
        // Loose V formation trailing the leader.
        const row = Math.ceil(i / 2);
        const side = i % 2 === 0 ? 1 : -1;
        const offset = new THREE.Vector3(side * row * 1.6, (this.rng() - 0.5) * 0.8, -row * 1.8);
        flock.birds.push({ root, left, right, offset, phase: this.rng() * Math.PI * 2 });
        this.root.add(root);
      }
      this.flocks.push(flock);
    }
  }

  private updateBirds(dt: number): void {
    const fwd = new THREE.Vector3();
    const rightV = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    for (const f of this.flocks) {
      f.angle += f.speed * dt;
      const dir = Math.sign(f.speed);
      const lx = f.center.x + Math.cos(f.angle) * f.radius;
      const lz = f.center.y + Math.sin(f.angle) * f.radius;
      fwd.set(-Math.sin(f.angle) * dir, 0, Math.cos(f.angle) * dir);
      rightV.crossVectors(fwd, up);
      const heading = Math.atan2(fwd.x, fwd.z);
      for (const b of f.birds) {
        const flap = Math.sin(this.time * 9 + b.phase);
        b.left.rotation.z = -flap * 0.6;
        b.right.rotation.z = flap * 0.6;
        b.root.position.set(
          lx + rightV.x * b.offset.x + fwd.x * b.offset.z,
          f.height + b.offset.y + Math.sin(this.time * 1.3 + b.phase) * 0.6,
          lz + rightV.z * b.offset.x + fwd.z * b.offset.z
        );
        b.root.rotation.set(0, heading, -dir * 0.18);
      }
    }
  }

  // -------------------------------------------------------------- blimp

  private createBlimp(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f4f1ea';
    ctx.fillRect(0, 0, 2048, 512);
    ctx.fillStyle = '#e2574c';
    ctx.fillRect(0, 196, 2048, 12);
    ctx.fillRect(0, 304, 2048, 12);
    ctx.font = '900 92px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1f3b63';
    // Sphere UVs: u = 0.25 is the +z flank, u = 0.75 the -z flank.
    for (const u of [0.25, 0.75]) ctx.fillText('EKUKE CHASE', u * 2048, 258, 520);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;

    const envelope = new THREE.Mesh(
      new THREE.SphereGeometry(1, 40, 24),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 })
    );
    envelope.scale.set(9, 2.6, 2.6);
    envelope.castShadow = true;
    this.blimp.add(envelope);

    const finMat = new THREE.MeshStandardMaterial({ color: 0xe2574c, roughness: 0.6 });
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 0.15), finMat);
      const a = (i * Math.PI) / 2;
      fin.position.set(-7.6, Math.cos(a) * 1.9, Math.sin(a) * 1.9);
      fin.rotation.x = a;
      this.blimp.add(fin);
    }
    const gondola = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.8, 1),
      new THREE.MeshStandardMaterial({ color: 0x2c3036, roughness: 0.5, metalness: 0.3 })
    );
    gondola.position.set(0.8, -2.75, 0);
    this.blimp.add(gondola);
    this.blimpLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff3333, toneMapped: false })
    );
    this.blimpLight.position.set(0.8, -3.25, 0);
    this.blimp.add(this.blimpLight);
    this.root.add(this.blimp);
  }

  private updateBlimp(dt: number): void {
    this.blimpAngle += dt * 0.022;
    const r = 115;
    const a = this.blimpAngle;
    this.blimp.position.set(Math.cos(a) * r, 52 + Math.sin(this.time * 0.4) * 1.2, Math.sin(a) * r);
    // Local +x is the nose; face along the tangent of the circle.
    this.blimp.rotation.set(0, -a - Math.PI / 2, Math.sin(this.time * 0.3) * 0.03);
  }
}

/** Small seeded PRNG so the skyline is identical every load. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
