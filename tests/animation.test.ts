import { Scene, Vector3 } from 'three'
import { expect, it } from 'vitest'
import { Operative } from '../src/animation'

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
