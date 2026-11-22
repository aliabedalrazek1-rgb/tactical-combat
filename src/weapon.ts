export interface WeaponDefinition {
  name: string
  capacity: number
  reserve: number
  shotInterval: number
  reloadTime: number
  damage: number
  range: number
  recoil: number
}

export const pistol: WeaponDefinition = {
  name: 'P9 Pistol', capacity: 12, reserve: 72,
  shotInterval: 0.24, reloadTime: 1.15, damage: 34, range: 65, recoil: 0.025,
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
