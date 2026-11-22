import { Scene, Vector3 } from 'three'
import { expect, it } from 'vitest'
import { Operative } from '../src/animation'
import { Fighter } from '../src/fighter'
import { firearms } from '../src/weapon'

it('restores the starting pose immediately when restarting after an airborne shot', () => {
  const operative = new Operative(new Scene())
  const position = new Vector3()
  const initialMuzzle = operative.muzzlePosition(new Vector3())
  operative.update(position, 0, 'airborne', true, 0.3, false, 0.2)
  operative.shoot()
  expect(operative.muzzlePosition(new Vector3()).distanceTo(initialMuzzle)).toBeGreaterThan(0.1)

  operative.reset()
  operative.update(position, 0, 'idle', false, 0, false, 0)
  expect(operative.muzzlePosition(new Vector3()).distanceTo(initialMuzzle)).toBeCloseTo(0)
  expect(operative.object.children.slice(1).map((leg) => leg.rotation.x)).toEqual([0, 0])
})

it('moves the striking limb during the contact window and relaxes it in recovery', () => {
  const rig = new Operative(new Scene())
  rig.equip('unarmed')
  const fighter = new Fighter()
  const leg = rig.object.getObjectByName('right-leg')!
  function frames(count: number) {
    for (let i = 0; i < count; i++) {
      fighter.tick(1 / 60)
      rig.update(new Vector3(), 0, 'idle', false, 0, false, 1 / 60, fighter)
    }
    return leg.rotation.x
  }
  fighter.start('kick')
  const windup = frames(6)
  const extension = frames(12)
  const recovered = frames(24)
  expect(extension - windup).toBeGreaterThan(0.8)
  expect(recovered).toBeLessThan(0.15)
})

it('changes visible equipment geometry for every firearm and removes it when holstered', () => {
  const rig = new Operative(new Scene())
  const equipment = rig.object.getObjectByName('equipment')!
  const silhouettes = new Set<string>()
  for (const spec of firearms) {
    rig.equip(spec.id, spec)
    silhouettes.add(
      JSON.stringify(
        equipment.children
          .filter((part) => part.visible)
          .map((part) => [part.position.toArray(), part.scale.toArray()]),
      ),
    )
  }
  expect(silhouettes.size).toBe(13)
  rig.equip('unarmed')
  expect(equipment.visible).toBe(false)
})
