import * as T from 'three'
import { Operative } from './animation'
import { Fighter, type Pose } from './fighter'
import type { Physics } from './physics'

export class SparringPartner implements Pose {
  readonly position = new T.Vector3(0, 0, 11.35)
  facing = Math.PI
  readonly fighter = new Fighter()
  private readonly model: Operative
  private readonly collider
  private beat = 0
  private turn = 0

  constructor(scene: T.Scene, physics: Physics) {
    this.model = new Operative(scene, true)
    this.model.equip('unarmed')
    this.collider = physics.box(0, 0.86, this.position.z, 0.65, 1.72, 0.6, this.fighter, true)
    const ring = new T.Mesh(new T.RingGeometry(1.78, 1.83, 48), new T.MeshBasicMaterial({ color: 0xe1ac75 }))
    ring.rotation.x = -Math.PI / 2
    ring.position.copy(this.position).y = 0.032
    scene.add(ring)
    this.reset()
  }
  reset() {
    // The Rapier collider retains this damageable object across restarts.
    Object.assign(this.fighter, new Fighter())
    this.beat = this.turn = 0
    this.position.set(0, 0, 11.35)
    this.facing = Math.PI
    this.model.reset()
    this.syncCollider()
    this.display(0)
  }
  display(dt: number) {
    this.model.update(this.position, this.facing, 'idle', false, 0, false, dt, this.fighter)
  }
  private syncCollider() {
    this.collider.setTranslation({ x: this.position.x, y: 0.86, z: this.position.z })
  }
  shove(facing: number) {
    // Keep the scripted partner on its marked training mat.
    this.position.x = T.MathUtils.clamp(this.position.x - Math.sin(facing) * 0.42, -0.9, 0.9)
    this.position.z = T.MathUtils.clamp(this.position.z - Math.cos(facing) * 0.42, 10.45, 12.25)
    this.syncCollider()
  }
  think(dt: number, player: Pose, sparring: boolean) {
    const actor = this.fighter
    actor.tick(dt)
    if (actor.state === 'down') {
      if (actor.elapsed > 2.4) this.reset()
      return
    }
    const dx = player.position.x - this.position.x,
      dz = player.position.z - this.position.z
    const desired = Math.atan2(-dx, -dz)
    this.facing +=
      Math.atan2(Math.sin(desired - this.facing), Math.cos(desired - this.facing)) * Math.min(1, dt * 5)
    if (!sparring || Math.hypot(dx, dz) > 1.55) {
      this.beat = 0
      actor.guard(false, false)
      return
    }
    this.beat += dt
    actor.guard(this.beat > 0.35 && this.beat < 1.05, false)
    if (this.beat > 1.36 && actor.start(this.turn % 2 ? 'kick' : 'heavy')) {
      this.turn++
      this.beat = -0.8
    }
  }
}
