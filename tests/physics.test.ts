import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import RAPIER from '@dimforge/rapier3d-compat'
import { PerspectiveCamera, Vector3 } from 'three'
import { ShoulderCamera } from '../src/camera'
import { damage, resolveShot, traceShot } from '../src/combat'
import { contact, Fighter } from '../src/fighter'
import { spawn } from '../src/movement'
import { Physics } from '../src/physics'

const origin = { x: 0, y: 1.3, z: 10 }
const downrange = { x: 0, y: 0, z: -1 }

describe('Rapier collision and combat', () => {
  let physics: Physics

  beforeAll(async () => { await RAPIER.init() })
  beforeEach(() => { physics = new Physics() })
  afterEach(() => physics.world.free())

  it('hits the closest target, applies damage and ignores downed plates', () => {
    const front = { health: 100, maxHealth: 100 }
    const back = { health: 100, maxHealth: 100 }
    physics.box(0, 1.3, 3, 0.7, 0.8, 0.1, front)
    physics.box(0, 1.3, 0, 0.7, 0.8, 0.1, back)
    physics.world.step()
    expect(resolveShot(physics.ray(origin, downrange, 6), 34)).toBe('miss')
    expect(resolveShot(physics.ray(origin, downrange, 20), 34)).toBe('hit')
    expect(front.health).toBe(66)
    expect(back.health).toBe(100)
    expect(resolveShot(physics.ray(origin, downrange, 20), 99)).toBe('down')
    expect(front.health).toBe(0)
    expect(damage(front, 10)).toBe(false)
    expect(damage(back, -5)).toBe(false)
    expect(damage(back, NaN)).toBe(false)
    expect(physics.ray(origin, downrange, 20)?.target).toBe(back)
    front.health = front.maxHealth
    expect(physics.ray(origin, downrange, 20)?.target).toBe(front)
  })

  it('stops a shot on cover and detects a camera obstruction', () => {
    const target = { health: 100, maxHealth: 100 }
    physics.box(0, 1.3, 2, 1, 1, 1, target)
    physics.box(0, 1.3, 4, 3, 2, 1)
    physics.world.step()
    const hit = physics.ray(origin, downrange, 20)
    expect(hit?.distance).toBeCloseTo(5.5)
    expect(resolveShot(hit, 34)).toBe('impact')
    expect(target.health).toBe(100)
    expect(physics.ray(origin, downrange, 20, true)?.distance).toBeCloseTo(5.5)
  })

  it('does not hit an exposed target when low cover blocks the muzzle', () => {
    const target = { health: 100, maxHealth: 100 }
    const view = new Vector3(0, 2, 10)
    const direction = new Vector3(0, 0, -1)
    const shoulder = new Vector3(0, 1, 8)
    const muzzle = new Vector3(0, 1, 7)
    physics.box(0, 2, 1, 1, 1, 0.2, target)
    physics.box(0, 0.75, 5, 2, 1.5, 1)
    physics.world.step()
    expect(physics.ray(view, direction, 20)?.target).toBe(target)
    const shot = traceShot((o, d, length) => physics.ray(o, d, length), view, direction, shoulder, muzzle, 20)
    expect(resolveShot(shot.hit, 34)).toBe('impact')
    expect(shot.end.z).toBeCloseTo(5.5)
    expect(target.health).toBe(100)
  })

  it('keeps shots forward when an offset camera sees a target behind the muzzle', () => {
    const behind = { health: 100, maxHealth: 100 }
    const ahead = { health: 100, maxHealth: 100 }
    const view = new Vector3(1, 1, 10)
    const direction = new Vector3(0, 0, -1)
    const shoulder = new Vector3(0, 1, 8)
    const muzzle = new Vector3(0, 1, 7)
    physics.box(0.9, 1, 8, 0.4, 1, 0.4, behind)
    physics.box(0.45, 1, 0, 1.2, 1, 0.2, ahead)
    physics.world.step()
    expect(physics.ray(view, direction, 20)?.target).toBe(behind)
    const shot = traceShot((o, d, length) => physics.ray(o, d, length), view, direction, shoulder, muzzle, 20)
    expect(shot.hit?.target).toBe(ahead)
    expect(shot.end.z).toBeLessThan(muzzle.z)
    expect(behind.health).toBe(100)
  })

  it('prevents an active melee strike from making contact across solid Rapier cover', () => {
    const attacker = new Fighter()
    const defender = new Fighter()
    const from = { position: { x: 0, y: 0, z: 0 }, facing: 0 }
    const to = { position: { x: 0, y: 0, z: -0.9 }, facing: Math.PI }
    const wall = physics.box(0, 1.1, -0.45, 2, 2.2, 0.16)
    physics.world.step()
    attacker.start('fire')
    attacker.tick(0.12)
    const strike = () => contact(attacker, from, defender, to,
      () => !physics.ray({ x: 0, y: 1, z: 0 }, downrange, 0.9, true))
    expect(strike()).toBeUndefined()
    expect(defender.health).toBe(100)
    physics.world.removeCollider(wall, false)
    physics.world.step()
    expect(strike()).toBe('hit')
    expect(defender.health).toBe(90)
  })

  it('pulls in the shoulder camera before it intersects a rear wall', () => {
    const view = new PerspectiveCamera()
    const camera = new ShoulderCamera(view, physics)
    const position = new Vector3(0, 0, 0)
    camera.update(position, false, 0)
    expect(view.position.z).toBeCloseTo(3.6)
    physics.box(0, 1, 1.5, 5, 4, 0.5)
    physics.world.step()
    camera.update(position, false, 1 / 60)
    expect(view.position.z).toBeGreaterThan(0.75)
    expect(view.position.z).toBeLessThan(1.25)
  })

  it('grounds the capsule, stops it at a barrier and resets at spawn', () => {
    physics.box(0, -0.2, 12, 10, 0.4, 15)
    physics.box(0, 1.3, 12, 4, 2.6, 1)
    physics.world.step()
    let frame = physics.move({ x: 0, y: -0.3, z: -3 })
    for (let i = 0; i < 10; i++) frame = physics.move({ x: 0, y: -0.03, z: -0.1 })
    expect(frame.grounded).toBe(true)
    expect(frame.position.y).toBeCloseTo(0.025, 1)
    expect(frame.position.z).toBeGreaterThan(12.82)
    expect(frame.position.z).toBeLessThan(13)
    physics.reset()
    expect(physics.move({ x: 0, y: 0, z: 0 }).position.z).toBeCloseTo(spawn.z)
  })
})
