import { describe, expect, it } from 'vitest'
import { pistol, Weapon } from '../src/weapon'

describe('pistol', () => {
  it('consumes one round per accepted shot and stops when empty', () => {
    const weapon = new Weapon(pistol)
    for (let i = 0; i < pistol.capacity; i++) expect(weapon.fire(i)).toBe(true)
    expect(weapon.ammo).toBe(0)
    expect(weapon.reserve).toBe(pistol.reserve)
    expect(weapon.fire(pistol.capacity)).toBe(false)
  })

  it('enforces the data-defined fire interval', () => {
    const weapon = new Weapon(pistol)
    expect(weapon.fire(0)).toBe(true)
    expect(weapon.fire(pistol.shotInterval - 0.001)).toBe(false)
    expect(weapon.fire(pistol.shotInterval)).toBe(true)
    expect(weapon.ammo).toBe(pistol.capacity - 2)
  })

  it('moves ammunition from reserve on reload completion only', () => {
    const weapon = new Weapon(pistol)
    expect(weapon.reload(0)).toBe(false)
    weapon.fire(0)
    expect(weapon.reload(1)).toBe(true)
    expect(weapon.reload(1.1)).toBe(false)
    weapon.update(1 + pistol.reloadTime - 0.01)
    expect(weapon.fire(2)).toBe(false)
    expect(weapon.ammo).toBe(pistol.capacity - 1)
    weapon.update(1 + pistol.reloadTime)
    expect(weapon.reloading).toBe(false)
    expect(weapon.ammo).toBe(pistol.capacity)
    expect(weapon.reserve).toBe(pistol.reserve - 1)
  })

  it('supports a partial reload and rejects reloads without reserve', () => {
    const weapon = new Weapon({ ...pistol, capacity: 3, reserve: 1 })
    weapon.fire(0)
    weapon.fire(1)
    expect(weapon.reload(2)).toBe(true)
    weapon.update(2 + pistol.reloadTime)
    expect(weapon.ammo).toBe(2)
    expect(weapon.reserve).toBe(0)
    expect(weapon.reload(4)).toBe(false)
  })
})
