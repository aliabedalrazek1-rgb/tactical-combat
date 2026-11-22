import RAPIER from '@dimforge/rapier3d-compat'
import { Vector3 } from 'three'
import type { Damageable, Point } from './combat'
import { spawn } from './movement'

const bodyCenter = 0.86

export class Physics {
  readonly world = new RAPIER.World({ x: 0, y: -19, z: 0 })
  private readonly body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased())
  private readonly capsule = this.world.createCollider(RAPIER.ColliderDesc.capsule(0.52, 0.33), this.body)
  private readonly controller = this.world.createCharacterController(0.035)
  private readonly targets = new Map<number, Damageable>()

  static async init() {
    await RAPIER.init()
    return new Physics()
  }

  constructor() {
    this.controller.enableAutostep(0.28, 0.25, false)
    this.controller.enableSnapToGround(0.18)
    this.reset()
  }

  reset() {
    this.body.setTranslation({ ...spawn, y: spawn.y + bodyCenter }, true)
    this.world.step()
  }

  box(x: number, y: number, z: number, w: number, h: number, d: number, target?: Damageable) {
    const collider = this.world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(x, y, z))
    if (target) this.targets.set(collider.handle, target)
    return collider
  }

  move(desired: Point) {
    this.controller.computeColliderMovement(this.capsule, desired, undefined, undefined, (collider) => !this.targets.has(collider.handle))
    const movement = this.controller.computedMovement()
    const grounded = this.controller.computedGrounded()
    const p = this.body.translation()
    this.body.setNextKinematicTranslation({ x: p.x + movement.x, y: p.y + movement.y, z: p.z + movement.z })
    this.world.step()
    const current = this.body.translation()
    return { position: new Vector3(current.x, current.y - bodyCenter, current.z), movement, grounded }
  }

  ray(origin: Point, direction: Point, length: number, camera = false) {
    if (length <= 0) return null
    const hit = this.world.castRay(new RAPIER.Ray(origin, direction), length, true, undefined, undefined,
      this.capsule, undefined, (collider) => {
        const target = this.targets.get(collider.handle)
        return !target || (!camera && target.health > 0)
      })
    return hit ? { distance: hit.timeOfImpact, target: this.targets.get(hit.collider.handle) } : null
  }
}
