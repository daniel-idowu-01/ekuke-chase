import * as THREE from 'three';


export class VectorUtils {
  static distance(a: THREE.Vector3, b: THREE.Vector3): number {
    return a.distanceTo(b);
  }

  static distanceSquared(a: THREE.Vector3, b: THREE.Vector3): number {
    return a.distanceToSquared(b);
  }

  static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  static lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  static smoothstep(edge0: number, edge1: number, x: number): number {
    const t = this.clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  static getAngle(v: THREE.Vector3): number {
    return Math.atan2(v.x, v.z);
  }

  static getDirection(angle: number): THREE.Vector3 {
    return new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
  }

  static quaternionToEuler(q: THREE.Quaternion): THREE.Euler {
    return new THREE.Euler().setFromQuaternion(q);
  }

  static rotateAround(
    v: THREE.Vector3,
    axis: THREE.Vector3,
    angle: number
  ): THREE.Vector3 {
    return v.applyAxisAngle(axis, angle);
  }

  static getForward(q: THREE.Quaternion): THREE.Vector3 {
    return new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  }

  static getRight(q: THREE.Quaternion): THREE.Vector3 {
    return new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  }

  static getUp(q: THREE.Quaternion): THREE.Vector3 {
    return new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  }

  static flattenToXZ(v: THREE.Vector3): THREE.Vector3 {
    return new THREE.Vector3(v.x, 0, v.z);
  }

  static clampLength(v: THREE.Vector3, maxLength: number): THREE.Vector3 {
    const length = v.length();
    if (length > maxLength) {
      return v.normalize().multiplyScalar(maxLength);
    }
    return v;
  }
}
