import { Vector3 } from 'three'
import type { CloseWeapon, Fighter } from './fighter'

export type Family = 'pistol' | 'carbine' | 'smg' | 'shotgun' | 'precision'
export type Mode = 'semi' | 'auto' | 'pump' | 'bolt'
export interface WeaponDefinition {
  id: string
  name: string
  family: Family
  mode: Mode
  spread: number
  pellets: number
  length: number
  heft: number
  capacity: number
  reserve: number
  shotInterval: number
  reloadTime: number
  damage: number
  range: number
  recoil: number
}

function gun(id:string, name:string, family:Family, mode:Mode, damage:number, range:number,
  capacity:number, shotInterval:number, reloadTime:number, recoil:number, spread:number,
  length:number, heft:number, pellets = 1): WeaponDefinition {
  return {id,name,family,mode,damage,range,capacity,reserve:capacity*6,shotInterval,reloadTime,recoil,spread,length,heft,pellets}
}
export const pistol = gun('p9','P9 Pistol','pistol','semi',34,65,12,.24,1.15,.025,.011,.24,.9)
export const firearms = [
  pistol,
  gun('anvil','Anvil Heavy Pistol','pistol','semi',49,72,8,.35,1.4,.050,.018,.32,1.1),
  gun('needle','Needle Machine Pistol','pistol','auto',16,40,20,.075,1.25,.020,.034,.28,.85),
  gun('field','Field Assault Rifle','carbine','auto',27,92,30,.105,1.8,.027,.015,.63,1.12),
  gun('forge','Forge Heavy Rifle','carbine','auto',36,108,22,.15,2.2,.046,.018,.77,1.38),
  gun('swift','Swift Compact Carbine','carbine','auto',23,73,26,.09,1.55,.021,.020,.49,.96),
  gun('arc','Arc Bullpup','carbine','auto',30,95,28,.115,1.95,.024,.013,.54,1.07),
  gun('kite','Kite Compact SMG','smg','auto',19,49,25,.085,1.36,.016,.025,.38,.78),
  gun('flux','Flux Rapid SMG','smg','auto',15,43,36,.060,1.63,.018,.032,.43,.84),
  gun('slide','Slide Pump Shotgun','shotgun','pump',12,33,6,.83,2.4,.072,.080,.78,1.30,8),
  gun('echo','Echo Semi Shotgun','shotgun','semi',10,29,8,.36,2.15,.055,.091,.66,1.18,7),
  gun('ridge','Ridge Marksman Rifle','precision','semi',54,140,12,.39,2.10,.044,.006,.86,1.42),
  gun('spire','Spire Bolt Rifle','precision','bolt',90,175,5,1.08,2.75,.079,.003,.99,1.62),
] as const

// A deterministic disk pattern around the view ray, including when looking up or down.
export function pelletDirection(view:Vector3, spec:WeaponDefinition, index:number, sequence:number, aimed:boolean) {
  const radius = spec.spread * Math.sqrt((index+.5)/spec.pellets) * (aimed && spec.pellets === 1 ? .24 : 1)
  const angle = index*2.39996323 + sequence*1.61803399
  const right = new Vector3(-view.z,0,view.x).normalize()
  const up = new Vector3().crossVectors(right,view)
  return view.clone().addScaledVector(right,radius*Math.cos(angle)).addScaledVector(up,radius*Math.sin(angle)).normalize()
}
export class Weapon {
  ammo: number
  reserve: number
  private nextShot = 0
  private reloadEnd: number | null = null

  constructor(readonly spec: Readonly<WeaponDefinition>) {
    this.ammo = spec.capacity
    this.reserve = spec.reserve
  }

  get reloading() { return this.reloadEnd !== null }

  update(now: number) {
    if (this.reloadEnd === null || now < this.reloadEnd) return
    const amount = Math.min(this.reserve, this.spec.capacity - this.ammo)
    this.ammo += amount
    this.reserve -= amount
    this.reloadEnd = null
  }

  cancelReload() { this.reloadEnd = null }

  reload(now: number) {
    if (this.reloading || this.ammo === this.spec.capacity || this.reserve <= 0) return false
    this.reloadEnd = now + this.spec.reloadTime
    return true
  }

  fire(now: number) {
    if (this.reloading || this.ammo <= 0 || now < this.nextShot) return false
    this.ammo--
    this.nextShot = now + this.spec.shotInterval
    return true
  }
}

export class Loadout {
  private guns = new Map(firearms.map(spec => [spec.id,new Weapon(spec)]))
  equipped: string = pistol.id
  lastGear: string = pistol.id
  private pending: string | null = null
  sequence = 0

  get weapon() { return this.guns.get(this.equipped) }
  request(id:string) {
    if (this.guns.has(id) || ['unarmed','knife','baton'].includes(id)) this.pending = id
  }
  holster() { this.request(this.equipped === 'unarmed' ? this.lastGear : 'unarmed') }
  update(actor:Fighter, now:number) {
    if (this.pending === this.equipped) this.pending = null
    if (this.pending !== null && actor.switchGear()) {
      this.weapon?.cancelReload()
      if (this.equipped !== 'unarmed') this.lastGear = this.equipped
      this.equipped = this.pending
      this.pending = null
    }
    actor.equipment = this.weapon ? 'firearm' : this.equipped as CloseWeapon
    if (actor.state === 'stagger' || actor.state === 'down') this.weapon?.cancelReload()
    this.weapon?.update(now)
  }
  shoot(actor:Fighter, now:number, pressed:boolean, held:boolean) {
    const gun = this.weapon
    if (!gun || actor.state !== 'idle' || !(pressed || (held && gun.spec.mode === 'auto'))) return false
    if (!gun.fire(now)) return false
    this.sequence++
    return true
  }
  reload(actor:Fighter, now:number) {
    return actor.state === 'idle' && this.weapon?.reload(now) === true
  }
}
