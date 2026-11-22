import * as T from 'three'
import { attacks, type Fighter } from './fighter'
import { pistol, type WeaponDefinition } from './weapon'
import type { PlayerState } from './movement'

const unit = new T.BoxGeometry()
const material = (color: number) => new T.MeshStandardMaterial({ color, roughness: 0.8 })

export class Operative {
  readonly object = new T.Group()
  private readonly torso = new T.Group()
  private readonly arms = [new T.Group(), new T.Group()]
  private readonly elbows = [new T.Group(), new T.Group()]
  private readonly implement = new T.Group()
  private readonly parts: T.Mesh[] = []
  private lastItem = ''
  private readonly legs = [new T.Group(), new T.Group()]
  private readonly muzzle = new T.Object3D()
  private readonly flash: T.Mesh
  private stride = 0
  private kick = 0

  constructor(scene: T.Scene, partner = false) {
    const fabric = material(partner ? 0xac6247 : 0x3e5255)
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
      box(arm, fabric, 0.16, 0.26, 0.17, 0, -0.13, 0)
      box(arm, armor, 0.185, 0.15, 0.20, 0, -0.10, 0)
      box(arm, accents, 0.08, 0.038, 0.014, 0, -0.12, 0.106)
      const elbow = this.elbows[i]
      elbow.position.y = -.24
      arm.add(elbow)
      box(elbow, fabric, .14,.21,.15,0,-.10,0)
      box(elbow, armor, .16,.14,.18,0,-.23,0)
    }
    this.elbows[1].add(this.implement)
    this.implement.position.y = -.24
    for (let i=0; i<6; i++) this.parts.push(box(this.implement, i===1 || i===4 ? accents : gun,1,1,1,0,0,0))
    this.implement.add(this.muzzle)
    this.equip('p9',pistol)
    this.flash = new T.Mesh(new T.OctahedronGeometry(0.085), new T.MeshBasicMaterial({ color: 0xffd085 }))
    this.muzzle.add(this.flash)
    this.flash.visible = false
  }

  equip(item:string, spec?:WeaponDefinition) {
    if (item === this.lastItem) return
    this.lastItem = item
    this.implement.visible = item !== 'unarmed'
    for (const part of this.parts) part.visible = false
    const part = (i:number,w:number,h:number,d:number,y:number,z=0) => {
      this.parts[i].scale.set(w,h,d)
      this.parts[i].position.set(0,y,z)
      this.parts[i].visible = true
    }
    if (!spec) {
      if (item === 'knife') {
        part(0,.055,.14,.05,-.07)
        part(1,.044,.22,.025,-.25)
        part(2,.12,.024,.045,-.14)
      } else if (item === 'baton') {
        part(0,.06,.52,.06,-.23)
        part(1,.085,.13,.08,-.49)
        part(2,.05,.05,.14,-.07,.07)
      }
      return
    }
    const l = spec.length
    const long = spec.family !== 'pistol'
    const precision = spec.family === 'precision'
    const tube = spec.family === 'shotgun'
    part(0, .085,l*.52,long ? .145 : .10,-l*.2)
    part(1, tube ? .084 : .054,l*.47,tube ? .09 : .058,-l*.69)
    if (long) part(2,.09,l*.34,.11,l*.19,-.015)
    if (!tube) part(3,.066,.095,spec.mode === 'auto' ? .19 : .105,item==='arc' ? l*.13 : -l*.12,.095)
    if (precision || item==='arc') part(4,.064,l*.27,.065,-l*.12,-.10)
    if (tube || item==='swift' || item==='flux') part(5,.10,l*.22,.10,-l*.55,.038)
    this.muzzle.position.set(0,-l*.95,0)
  }

  shoot() {
    this.kick = 1
    this.flash.visible = true
  }

  reset() {
    this.stride = this.kick = 0
    this.flash.visible = false
    for (const leg of this.legs) leg.rotation.x = 0
    this.torso.rotation.set(0,0,0)
    for (const elbow of this.elbows) elbow.rotation.set(0,0,0)
    for (const arm of this.arms) arm.rotation.set(0, 0, 0)
  }

  muzzlePosition(out: T.Vector3) { return this.muzzle.getWorldPosition(out) }

  update(position: T.Vector3, facing: number, state: PlayerState, ready: boolean, pitch: number, reloading: boolean, dt: number, fighter?: Fighter, heft = 1) {
    this.object.position.copy(position)
    this.object.rotation.y = facing
    const moving = state === 'run' || state === 'walk'
    this.stride += dt * (state === 'run' ? 13 : 8)
    const swing = moving ? Math.sin(this.stride) * (state === 'run' ? 0.72 : 0.43) : 0
    this.torso.position.y = moving ? Math.abs(swing) * 0.07 : Math.sin(this.stride * 0.33) * 0.009
    this.torso.rotation.x = state === 'run' ? -0.10 : 0
    this.kick = Math.max(0, this.kick - dt * 13)
    this.flash.visible = this.kick > 0.62
    const attack = fighter?.state === 'attack' ? attacks[fighter.strike] : undefined
    const action = attack ? fighter!.strike : undefined
    // Wind up, extend through contact, then settle over the recovery interval.
    const t = fighter?.elapsed ?? 0
    const extension = !attack ? 0 : t < attack.startup ? -.28*Math.sin(Math.PI*t/attack.startup) :
      t < attack.startup+attack.active ? Math.sin(Math.PI*.5*Math.min(1,(t-attack.startup+.035)/attack.active)) :
      Math.max(0,1-(t-attack.startup-attack.active)/attack.recovery)
    const guard = fighter?.state === 'guard'
    const stagger = fighter?.state === 'stagger'
    const dodge = fighter?.state === 'dodge'
    const down = fighter?.state === 'down'
    const close = fighter && fighter.equipment !== 'firearm'
    const kick = action === 'kick' || action === 'stepKick'
    const swingWeapon = action === 'swing' || action === 'cut'
    const wave = fighter && Number.isFinite(fighter.duration) ? Math.sin(Math.PI*Math.min(1,t/fighter.duration)) : 0
    const turn = attack && !kick ? extension * (swingWeapon ? 1.0 : .46) : 0
    const lean = down ? -1.32 : stagger ? -.32*wave : dodge ? .48*wave : kick ? -.22*extension : this.torso.rotation.x
    this.torso.rotation.set(lean,turn,dodge ? fighter!.dodgeX*.42*wave : 0)
    if (dodge || down) this.torso.position.y -= down ? .60 : .35*wave
    for (let i = 0; i < 2; i++) {
      const step = i ? swing : -swing
      const leg = this.legs[i]
      const arm = this.arms[i]
      let legAngle = state === 'airborne' ? (i ? .22 : -.38) : step
      if (kick && i) legAngle += extension*(action==='stepKick' ? 1.48 : 1.20)
      if (dodge) legAngle += (i ? .54 : -.4)*wave
      if (down) legAngle = -1.2
      leg.rotation.x = T.MathUtils.damp(leg.rotation.x,legAngle,24,dt)
      let shoulder = ready ? Math.PI / 2 + pitch - this.kick * .22 : -step*.66 + (i ? .42 : .1)
      let elbow = 0
      let side = ready && !i ? .13 : -.02
      if (close) { shoulder = .44-step*.32; elbow = .80 }
      if (guard) { shoulder = fighter!.parrying ? 1.23 : .84; elbow = .98; side = i ? -.27 : .27 }
      if (attack && !kick && (i || action === 'shove')) {
        shoulder += (action === 'overhead' ? 1.7 : 1.28)*extension
        elbow *= 1-extension
        side += (swingWeapon ? .85 : -.13)*extension
      }
      if (stagger) { shoulder -= .9*wave; side += (i ? .6 : -.6)*wave }
      if (dodge) { elbow += .6*wave; shoulder += .48*wave }
      if (fighter?.state === 'switch') shoulder -= 1.1*wave
      if (reloading) { shoulder = (i ? .8 : .53)+.14*Math.sin(this.stride*1.7); elbow = .45 }
      arm.rotation.x = T.MathUtils.damp(arm.rotation.x,shoulder, ready ? 24/heft : 26,dt)
      arm.rotation.z = T.MathUtils.damp(arm.rotation.z,side,22,dt)
      this.elbows[i].rotation.x = T.MathUtils.damp(this.elbows[i].rotation.x,elbow,25,dt)
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
