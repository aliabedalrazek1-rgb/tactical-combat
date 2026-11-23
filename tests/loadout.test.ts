import { Vector3 } from 'three'
import { expect, it } from 'vitest'
import { Fighter } from '../src/fighter'
import { firearms, Loadout, pelletDirection } from '../src/weapon'

// Expected tuning from the published game balance table, independently of the definitions.
it.each([
  ['p9', 'semi', 34, 65, 12, 0.24, 1.15, 1],
  ['anvil', 'semi', 49, 72, 8, 0.35, 1.4, 1],
  ['needle', 'auto', 16, 40, 20, 0.075, 1.25, 1],
  ['field', 'auto', 27, 92, 30, 0.105, 1.8, 1],
  ['forge', 'auto', 36, 108, 22, 0.15, 2.2, 1],
  ['swift', 'auto', 23, 73, 26, 0.09, 1.55, 1],
  ['arc', 'auto', 30, 95, 28, 0.115, 1.95, 1],
  ['kite', 'auto', 19, 49, 25, 0.085, 1.36, 1],
  ['flux', 'auto', 15, 43, 36, 0.06, 1.63, 1],
  ['slide', 'pump', 12, 33, 6, 0.83, 2.4, 8],
  ['echo', 'semi', 10, 29, 8, 0.36, 2.15, 7],
  ['ridge', 'semi', 54, 140, 12, 0.39, 2.1, 1],
  ['spire', 'bolt', 90, 175, 5, 1.08, 2.75, 1],
] as const)('matches documented fire timing and conserves rounds for %s',
  (id, mode, damage, range, capacity, shotInterval, reloadTime, pellets) => {
    const actor = new Fighter()
    const gear = new Loadout()
    gear.request(id)
    gear.update(actor, 0)
    const gun = gear.weapon!
    expect(gun.spec).toMatchObject({ id, mode, damage, range, capacity, shotInterval, reloadTime, pellets })
    actor.tick(0.4)
    expect(gun.ammo).toBe(capacity)
    expect(gun.reserve).toBe(capacity * 6)
    expect(gear.shoot(actor, 1, true, true)).toBe(true)
    expect(gear.shoot(actor, 1 + shotInterval - 0.001, true, true)).toBe(false)
    expect(gear.shoot(actor, 1 + shotInterval, false, true)).toBe(mode === 'auto')
    if (mode !== 'auto') expect(gear.shoot(actor, 1 + shotInterval, true, true)).toBe(true)
    expect(gun.ammo).toBe(capacity - 2)
    gun.reserve = 1
    expect(gear.reload(actor, 4)).toBe(true)
    gear.update(actor, 4 + reloadTime - 0.001)
    expect(gun.ammo).toBe(capacity - 2)
    expect(gear.shoot(actor, 4 + reloadTime - 0.001, true, true)).toBe(false)
    gear.update(actor, 4 + reloadTime)
    expect(gun.ammo).toBe(capacity - 1)
    expect(gun.reserve).toBe(0)
    expect(gear.reload(actor, 8)).toBe(false)
  },
)
it.each(firearms)('equips, fires and reloads $name with its own capacity and mode', (spec) => {
  const actor = new Fighter(),
    gear = new Loadout()
  gear.request(spec.id)
  gear.update(actor, 0)
  actor.tick(0.33)
  expect(gear.shoot(actor, 1, false, true)).toBe(spec.mode === 'auto')
  expect(gear.shoot(actor, 3, true, false)).toBe(true)
  expect(gear.reload(actor, 3.1)).toBe(true)
  expect(gear.shoot(actor, 3.6, true, true)).toBe(false)
  gear.update(actor, 3.1 + spec.reloadTime)
  expect(gear.weapon?.ammo).toBe(spec.capacity)
})
it('retains inventory, cancels reload and gates fire during switching and melee', () => {
  const f = new Fighter(),
    gear = new Loadout()
  gear.update(f, 0)
  gear.shoot(f, 1, true, true)
  gear.reload(f, 1.1)
  gear.holster()
  gear.update(f, 1.2)
  expect(f.start('kick')).toBe(false)
  f.tick(0.4)
  expect(f.start('kick')).toBe(true)
  expect(gear.shoot(f, 2, true, true)).toBe(false)
  gear.holster()
  gear.update(f, 2.1)
  expect(gear.equipped).toBe('unarmed')
  f.tick(1)
  gear.update(f, 3.1)
  expect(gear.weapon?.ammo).toBe(11)
  expect(gear.weapon?.reloading).toBe(false)
  expect(gear.shoot(f, 3.1, true, true)).toBe(false)
})
it('creates distinct deterministic pellet directions and weapon tunings', () => {
  expect(new Set(firearms.map((s) => s.id)).size).toBe(13)
  const view = new Vector3(0, 0.3, -1).normalize()
  for (const spec of firearms.filter((s) => s.family === 'shotgun')) {
    const rays = Array.from({ length: spec.pellets }, (_, i) => pelletDirection(view, spec, i, 4, true))
    expect(new Set(rays.map((ray) => ray.toArray().join())).size).toBeGreaterThan(6)
    rays.forEach((ray) => expect(ray.angleTo(view)).toBeLessThan(spec.spread))
    expect(rays[0]).toEqual(pelletDirection(view, spec, 0, 4, true))
  }
})

it('retains optional Assignment 1 hold-to-fire for the P9 at its original cadence', () => {
  const f = new Fighter(),
    gear = new Loadout()
  gear.update(f, 0)
  expect(gear.shoot(f, 0, true, true, true)).toBe(true)
  expect(gear.shoot(f, 0.1, false, true, true)).toBe(false)
  expect(gear.shoot(f, 0.25, false, true, true)).toBe(true)
  expect(gear.shoot(f, 0.5, false, true, false)).toBe(false)
})

it.each(['startup', 'active', 'recovery', 'dodge', 'stagger'] as const)(
  'queues an equipment change while the fighter is in %s',
  (phase) => {
    const fighter = new Fighter()
    const gear = new Loadout()
    gear.request('knife')
    gear.update(fighter, 0)
    fighter.tick(0.33)
    if (phase === 'dodge') fighter.dodge(-1, 0)
    else if (phase === 'stagger') fighter.stagger(0.6)
    else {
      fighter.start('heavy')
      fighter.tick(phase === 'startup' ? 0.05 : phase === 'active' ? 0.25 : 0.45)
    }
    expect(fighter.phase).toBe(phase)
    gear.request('spire')
    gear.update(fighter, 1)
    expect(gear.equipped).toBe('knife')
    expect(gear.shoot(fighter, 1, true, true)).toBe(false)
    fighter.tick(1)
    gear.update(fighter, 2)
    expect(fighter.state).toBe('switch')
    expect(gear.equipped).toBe('spire')
    expect(gear.shoot(fighter, 2, true, true)).toBe(false)
    fighter.tick(0.33)
    expect(gear.shoot(fighter, 2.33, true, true)).toBe(true)
    expect(gear.weapon?.ammo).toBe(4)
  },
)
