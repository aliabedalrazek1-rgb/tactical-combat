import * as T from 'three'
import type { PlayerState } from './movement'

const unit = new T.BoxGeometry()
const material = (color: number) => new T.MeshStandardMaterial({ color, roughness: 0.8 })

export class Operative {
  readonly object = new T.Group()
  private readonly torso = new T.Group()
  private readonly arms = [new T.Group(), new T.Group()]
  private readonly legs = [new T.Group(), new T.Group()]
  private readonly muzzle = new T.Object3D()
  private readonly flash: T.Mesh
  private stride = 0
  private kick = 0

  constructor(scene: T.Scene) {
    const fabric = material(0x3e5255)
    const armor = material(0x232d31)
    const accents = material(0x929779)
    const visor = material(0x314e51)
    const gun = material(0x30383e)
    function box(parent: T.Object3D, mat: T.Material, w: number, h: number, d: number, x: number, y: number, z: number) {
      const mesh = new T.Mesh(unit, mat)
      mesh.scale.set(w, h, d)
      mesh.position.set(x, y, z)
      mesh.castShadow = true
      parent.add(mesh)
      return mesh
    }
    scene.add(this.object)
    this.object.add(this.torso)
    box(this.torso, fabric, 0.48, 0.56, 0.28, 0, 1.19, 0)
    box(this.torso, armor, 0.47, 0.36, 0.35, 0, 1.29, 0)
    box(this.torso, armor, 0.33, 0.35, 0.13, 0, 1.22, 0.207)
    box(this.torso, accents, 0.22, 0.06, 0.014, 0, 1.31, 0.277)
    box(this.torso, fabric, 0.21, 0.12, 0.06, 0, 1.16, 0.273)
    for (const x of [-0.14, 0.14]) box(this.torso, accents, 0.043, 0.23, 0.017, x, 1.22, 0.282)
    box(this.torso, armor, 0.46, 0.12, 0.30, 0, 0.94, 0)
    const helmet = new T.Mesh(new T.SphereGeometry(0.178, 12, 8), armor)
    helmet.scale.set(0.95, 1.06, 0.98)
    helmet.position.set(0, 1.62, 0)
    helmet.castShadow = true
    this.torso.add(helmet)
    box(this.torso, visor, 0.25, 0.08, 0.064, 0, 1.61, -0.142)

    for (const [i, side] of [-1, 1].entries()) {
      const leg = this.legs[i]
      leg.position.set(side * 0.132, 0.88, 0)
      this.object.add(leg)
      box(leg, fabric, 0.196, 0.66, 0.21, 0, -0.36, 0)
      box(leg, armor, 0.19, 0.19, 0.08, 0, -0.40, -0.105)
      box(leg, armor, 0.21, 0.065, 0.224, 0, -0.42, 0)
      box(leg, armor, 0.20, 0.18, 0.31, 0, -0.78, -0.048)
      const arm = this.arms[i]
      arm.position.set(side * 0.283, 1.39, 0)
      this.torso.add(arm)
      box(arm, fabric, 0.16, 0.49, 0.17, 0, -0.24, 0)
      box(arm, armor, 0.185, 0.15, 0.20, 0, -0.10, 0)
      box(arm, accents, 0.08, 0.038, 0.014, 0, -0.12, 0.106)
      box(arm, armor, 0.164, 0.13, 0.179, 0, -0.47, 0)
    }
    const right = this.arms[1]
    box(right, gun, 0.09, 0.26, 0.12, 0, -0.57, 0)
    box(right, gun, 0.075, 0.12, 0.14, 0, -0.49, 0.039)
    this.muzzle.position.set(0, -0.715, 0.015)
    right.add(this.muzzle)
    this.flash = new T.Mesh(new T.OctahedronGeometry(0.085), new T.MeshBasicMaterial({ color: 0xffd085 }))
    this.muzzle.add(this.flash)
    this.flash.visible = false
  }

  shoot() {
    this.kick = 1
    this.flash.visible = true
  }

  reset() {
    this.stride = this.kick = 0
    this.flash.visible = false
    for (const leg of this.legs) leg.rotation.x = 0
    for (const arm of this.arms) arm.rotation.set(0, 0, 0)
  }

  muzzlePosition(out: T.Vector3) { return this.muzzle.getWorldPosition(out) }

  update(position: T.Vector3, facing: number, state: PlayerState, ready: boolean, pitch: number, reloading: boolean, dt: number) {
    this.object.position.copy(position)
    this.object.rotation.y = facing
    const moving = state === 'run' || state === 'walk'
    this.stride += dt * (state === 'run' ? 13 : 8)
    const swing = moving ? Math.sin(this.stride) * (state === 'run' ? 0.72 : 0.43) : 0
    this.torso.position.y = moving ? Math.abs(swing) * 0.07 : Math.sin(this.stride * 0.33) * 0.009
    this.torso.rotation.x = state === 'run' ? -0.10 : 0
    this.kick = Math.max(0, this.kick - dt * 13)
    this.flash.visible = this.kick > 0.62
    for (let i = 0; i < 2; i++) {
      const step = i ? swing : -swing
      const leg = this.legs[i]
      const arm = this.arms[i]
      leg.rotation.x = T.MathUtils.damp(leg.rotation.x, state === 'airborne' ? (i ? 0.22 : -0.38) : step, 18, dt)
      const requested = reloading ? (i ? 0.78 : 0.55) : ready ? Math.PI / 2 + pitch - this.kick * 0.18 : -step * 0.66 + (i ? 0.42 : 0.1)
      arm.rotation.x = T.MathUtils.damp(arm.rotation.x, requested, 22, dt)
      arm.rotation.z = T.MathUtils.damp(arm.rotation.z, i ? -0.02 : ready ? 0.13 : -0.02, 18, dt)
    }
  }
}

export class ShotEffects {
  private readonly tracer: T.Line
  private readonly impact: T.Mesh
  private life = 0

  constructor(scene: T.Scene) {
    const trail = new T.BufferGeometry()
    trail.setAttribute('position', new T.BufferAttribute(new Float32Array(6), 3))
    this.tracer = new T.Line(trail, new T.LineBasicMaterial({ color: 0xffda8d }))
    this.tracer.frustumCulled = false
    this.impact = new T.Mesh(new T.OctahedronGeometry(0.075), new T.MeshBasicMaterial({ color: 0xffaa56 }))
    scene.add(this.tracer, this.impact)
    this.reset()
  }

  play(start: T.Vector3, end: T.Vector3, contact: boolean) {
    const points = this.tracer.geometry.getAttribute('position')
    points.setXYZ(0, start.x, start.y, start.z)
    points.setXYZ(1, end.x, end.y, end.z)
    points.needsUpdate = true
    this.impact.position.copy(end)
    this.tracer.visible = true
    this.impact.visible = contact
    this.life = 0.12
  }

  update(dt: number) {
    this.life -= dt
    if (this.life < 0.07) this.tracer.visible = false
    if (this.life <= 0) this.impact.visible = false
  }

  reset() {
    this.life = 0
    this.update(0)
  }
}
