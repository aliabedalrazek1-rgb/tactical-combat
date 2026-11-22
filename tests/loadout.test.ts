import { Vector3 } from 'three'
import { expect, it } from 'vitest'
import { Fighter } from '../src/fighter'
import { firearms, Loadout, pelletDirection } from '../src/weapon'
it.each(firearms)('equips, fires and reloads $name with its own capacity and mode', spec => {
  const actor = new Fighter(), gear = new Loadout()
  gear.request(spec.id)
  gear.update(actor,0)
  actor.tick(.33)
  expect(gear.shoot(actor,1,false,true)).toBe(spec.mode === 'auto')
  expect(gear.shoot(actor,3,true,false)).toBe(true)
  expect(gear.reload(actor,3.1)).toBe(true)
  expect(gear.shoot(actor,3.6,true,true)).toBe(false)
  gear.update(actor,3.1+spec.reloadTime)
  expect(gear.weapon?.ammo).toBe(spec.capacity)
})
it('retains inventory, cancels reload and gates fire during switching and melee', () => {
  const f = new Fighter(), gear = new Loadout()
  gear.update(f,0)
  gear.shoot(f,1,true,true)
  gear.reload(f,1.1)
  gear.holster()
  gear.update(f,1.2)
  expect(f.start('kick')).toBe(false)
  f.tick(.4)
  expect(f.start('kick')).toBe(true)
  expect(gear.shoot(f,2,true,true)).toBe(false)
  gear.holster()
  gear.update(f,2.1)
  expect(gear.equipped).toBe('unarmed')
  f.tick(1)
  gear.update(f,3.1)
  expect(gear.weapon?.ammo).toBe(11)
  expect(gear.weapon?.reloading).toBe(false)
  expect(gear.shoot(f,3.1,true,true)).toBe(false)
})
it('creates distinct deterministic pellet directions and weapon tunings', () => {
  expect(new Set(firearms.map(s=>s.id)).size).toBe(13)
  const view = new Vector3(0,.3,-1).normalize()
  for (const spec of firearms.filter(s=>s.family==='shotgun')) {
    const rays = Array.from({length:spec.pellets},(_,i)=>pelletDirection(view,spec,i,4,true))
    expect(new Set(rays.map(ray=>ray.toArray().join())).size).toBeGreaterThan(6)
    rays.forEach(ray=>expect(ray.angleTo(view)).toBeLessThan(spec.spread))
    expect(rays[0]).toEqual(pelletDirection(view,spec,0,4,true))
  }
})
