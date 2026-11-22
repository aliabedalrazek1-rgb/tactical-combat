import * as T from 'three'
import type { Physics } from './physics'

export class ShoulderCamera {
  yaw = 0
  pitch = 0
  readonly direction = new T.Vector3(0, 0, -1)
  private readonly pivot = new T.Vector3()
  private readonly offset = new T.Vector3()
  private readonly right = new T.Vector3()
  private readonly probe = new T.Vector3()
  private actualYaw = 0
  private actualPitch = 0
  private aimBlend = 0
  private distance = 0
  private kick = 0

  constructor(readonly view: T.PerspectiveCamera, readonly physics: Physics) {}

  reset() {
    this.yaw = this.pitch = this.actualYaw = this.actualPitch = this.aimBlend = this.distance = this.kick = 0
  }

  rotate(x: number, y: number) {
    this.yaw -= x
    this.pitch = T.MathUtils.clamp(this.pitch - y, -0.99, 0.68)
  }

  recoil(amount: number) {
    this.kick = Math.min(0.13, this.kick + amount)
  }

  update(position: T.Vector3, aiming: boolean, dt: number) {
    this.actualYaw = T.MathUtils.damp(this.actualYaw, this.yaw, 24, dt)
    this.actualPitch = T.MathUtils.damp(this.actualPitch, this.pitch, 24, dt)
    this.aimBlend = T.MathUtils.damp(this.aimBlend, Number(aiming), 12, dt)
    this.kick *= Math.exp(-13 * dt)

    const pitch = this.actualPitch + this.kick
    const sin = Math.sin(this.actualYaw)
    const cos = Math.cos(this.actualYaw)
    this.direction.set(-sin * Math.cos(pitch), Math.sin(pitch), -cos * Math.cos(pitch))
    this.right.set(cos, 0, -sin)
    this.pivot.copy(position)
    this.pivot.y += 1.35
    const portrait = T.MathUtils.clamp((0.85 - this.view.aspect) / 0.4, 0, 1)
    const boom = T.MathUtils.lerp(3.6 + portrait * 0.85, 2.05 + portrait * 1.38, this.aimBlend)
    this.offset.copy(this.direction).multiplyScalar(-boom).addScaledVector(this.right, 0.76)
    this.offset.y += T.MathUtils.lerp(0.24, 0.10, this.aimBlend)
    const desired = this.offset.length()
    this.offset.divideScalar(desired)

    let safe = desired
    for (const [x, y] of [[0, 0], [-0.16, 0], [0.16, 0], [0, 0.16], [0, -0.16]]) {
      this.probe.copy(this.pivot).addScaledVector(this.right, x)
      this.probe.y += y
      const hit = this.physics.ray(this.probe, this.offset, desired + 0.13, true)
      if (hit) safe = Math.min(safe, Math.max(0, hit.distance - 0.13))
    }
    this.distance = safe < this.distance || dt === 0 ? safe : T.MathUtils.damp(this.distance, safe, 10, dt)
    this.view.position.copy(this.pivot).addScaledVector(this.offset, this.distance)
    this.view.lookAt(this.probe.copy(this.view.position).add(this.direction))
    const fov = T.MathUtils.lerp(59, 44 + portrait * 8, this.aimBlend)
    if (Math.abs(this.view.fov - fov) > 0.02) {
      this.view.fov = fov
      this.view.updateProjectionMatrix()
    }
  }
}
