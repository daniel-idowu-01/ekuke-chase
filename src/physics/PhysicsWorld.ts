import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { PHYSICS } from '../utils/Constants';


export class PhysicsWorld {
  private world: RAPIER.World;
  private gravity: RAPIER.Vector3;
  private bodies: Map<number, THREE.Object3D> = new Map();
  private bodyHandles: Map<THREE.Object3D, RAPIER.RigidBodyHandle> = new Map();

  constructor() {
    this.gravity = new RAPIER.Vector3(0, PHYSICS.GRAVITY, 0);
    this.world = new RAPIER.World(this.gravity);
  }

  createDynamicBody(
    position: THREE.Vector3,
    mass: number = 1,
    shape: 'capsule' | 'box' | 'sphere' = 'capsule'
  ): RAPIER.RigidBodyHandle {
    const rigidBodyDesc =
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.y, position.z)
        .setLinearDamping(1.8)
        .setAngularDamping(8)
        .lockRotations();

    const rigidBody = this.world.createRigidBody(rigidBodyDesc);

    let colliderDesc: RAPIER.ColliderDesc;
    if (shape === 'capsule') {
      colliderDesc = RAPIER.ColliderDesc.capsule(0.7, 0.3);
    } else if (shape === 'sphere') {
      colliderDesc = RAPIER.ColliderDesc.ball(0.5);
    } else {
      colliderDesc = RAPIER.ColliderDesc.cuboid(0.3, 0.5, 0.3);
    }

    colliderDesc.setMass(mass);
    this.world.createCollider(colliderDesc, rigidBody);

    return rigidBody.handle;
  }

  createStaticBody(
    position: THREE.Vector3,
    shape: 'box' | 'plane' = 'box',
    size?: { width: number; height: number; depth: number }
  ): RAPIER.RigidBodyHandle {
    const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(
      position.x,
      position.y,
      position.z
    );

    const rigidBody = this.world.createRigidBody(rigidBodyDesc);

    let colliderDesc: RAPIER.ColliderDesc;
    if (shape === 'plane') {
      colliderDesc = RAPIER.ColliderDesc.cuboid(50, 0.5, 50);
    } else if (size) {
      colliderDesc = RAPIER.ColliderDesc.cuboid(
        size.width / 2,
        size.height / 2,
        size.depth / 2
      );
    } else {
      colliderDesc = RAPIER.ColliderDesc.cuboid(1, 1, 1);
    }

    this.world.createCollider(colliderDesc, rigidBody);

    return rigidBody.handle;
  }

  createStaticTrimesh(vertices: Float32Array, indices: Uint32Array): RAPIER.RigidBodyHandle {
    const rigidBody = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    this.world.createCollider(RAPIER.ColliderDesc.trimesh(vertices, indices), rigidBody);
    return rigidBody.handle;
  }

  linkBody(object: THREE.Object3D, bodyHandle: RAPIER.RigidBodyHandle): void {
    this.bodyHandles.set(object, bodyHandle);
    this.bodies.set(bodyHandle, object);
  }

  getBodyHandle(object: THREE.Object3D): RAPIER.RigidBodyHandle | undefined {
    return this.bodyHandles.get(object);
  }

  applyForce(
    bodyHandle: RAPIER.RigidBodyHandle,
    force: THREE.Vector3
  ): void {
    const body = this.world.getRigidBody(bodyHandle);
    if (body) {
      body.addForce(
        new RAPIER.Vector3(force.x, force.y, force.z),
        true
      );
    }
  }

  setVelocity(
    bodyHandle: RAPIER.RigidBodyHandle,
    velocity: THREE.Vector3
  ): void {
    const body = this.world.getRigidBody(bodyHandle);
    if (body) {
      body.setLinvel(
        new RAPIER.Vector3(velocity.x, velocity.y, velocity.z),
        true
      );
    }
  }

  getVelocity(bodyHandle: RAPIER.RigidBodyHandle): THREE.Vector3 {
    const body = this.world.getRigidBody(bodyHandle);
    if (body) {
      const vel = body.linvel();
      return new THREE.Vector3(vel.x, vel.y, vel.z);
    }
    return new THREE.Vector3();
  }

  applyImpulse(
    bodyHandle: RAPIER.RigidBodyHandle,
    impulse: THREE.Vector3
  ): void {
    const body = this.world.getRigidBody(bodyHandle);
    if (body) {
      body.applyImpulse(
        new RAPIER.Vector3(impulse.x, impulse.y, impulse.z),
        true
      );
    }
  }

  getPosition(bodyHandle: RAPIER.RigidBodyHandle): THREE.Vector3 {
    const body = this.world.getRigidBody(bodyHandle);
    if (body) {
      const pos = body.translation();
      return new THREE.Vector3(pos.x, pos.y, pos.z);
    }
    return new THREE.Vector3();
  }

  setPosition(
    bodyHandle: RAPIER.RigidBodyHandle,
    position: THREE.Vector3
  ): void {
    const body = this.world.getRigidBody(bodyHandle);
    if (body) {
      body.setTranslation(
        new RAPIER.Vector3(position.x, position.y, position.z),
        true
      );
    }
  }

  getRotation(bodyHandle: RAPIER.RigidBodyHandle): THREE.Quaternion {
    const body = this.world.getRigidBody(bodyHandle);
    if (body) {
      const rot = body.rotation();
      return new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w);
    }
    return new THREE.Quaternion();
  }

  isGrounded(bodyHandle: RAPIER.RigidBodyHandle): boolean {
    const body = this.world.getRigidBody(bodyHandle);
    if (!body) return false;

    const pos = body.translation();
    const ray = new RAPIER.Ray(
      new RAPIER.Vector3(pos.x, pos.y, pos.z),
      new RAPIER.Vector3(0, -1, 0)
    );
    const hit = this.world.castRay(ray, 1.15, true);
    return hit !== null;
  }

  update(): void {
    this.world.step();

    for (const [object, bodyHandle] of this.bodyHandles.entries()) {
      const body = this.world.getRigidBody(bodyHandle);
      if (body) {
        const pos = body.translation();
        object.position.set(pos.x, pos.y, pos.z);
      }
    }
  }

  raycast(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number = 100
  ): RAPIER.RayColliderIntersection | null {
    const ray = new RAPIER.Ray(
      new RAPIER.Vector3(origin.x, origin.y, origin.z),
      new RAPIER.Vector3(direction.x, direction.y, direction.z)
    );

    return this.world.castRayAndGetNormal(ray, maxDistance, true);
  }

  getCollidersInSphere(
    center: THREE.Vector3,
    radius: number
  ): RAPIER.ColliderHandle[] {
    const colliders: RAPIER.ColliderHandle[] = [];
    this.world.colliders.forEach((collider: any) => {
      const pos = collider.translation();
      const distance = Math.sqrt(
        (pos.x - center.x) ** 2 +
          (pos.y - center.y) ** 2 +
          (pos.z - center.z) ** 2
      );
      if (distance < radius) {
        colliders.push(collider.handle);
      }
    });
    return colliders;
  }

  getWorld(): RAPIER.World {
    return this.world;
  }

  destroyBody(bodyHandle: RAPIER.RigidBodyHandle): void {
    const body = this.world.getRigidBody(bodyHandle);
    if (body) {
      this.world.removeRigidBody(body);
    }
  }
}
