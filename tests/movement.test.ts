import { describe, expect, it } from 'vitest'
import { Movement } from '../src/movement'

const dt = 1 / 60
const forward = { x: 0, y: 1 }
const still = { x: 0, y: 0 }

describe('player movement states', () => {
  it('switches between idle, walking, running and slower aiming movement', () => {
    const player = new Movement()
    player.contacts(true, 0, 0)
    player.step(still, 0, false, false, false, dt)
    expect(player.state).toBe('idle')
    const walk = player.step(forward, 0, false, false, false, dt)
    expect(player.state).toBe('walk')
    const run = player.step(forward, 0, true, false, false, dt)
    expect(player.state).toBe('run')
    const aim = player.step(forward, 0, true, false, true, dt)
    expect(player.state).toBe('walk')
    expect(run.z).toBeLessThan(walk.z)
    expect(aim.z).toBeGreaterThan(walk.z)
  })

  it('jumps from the ground, falls under gravity and cannot double jump', () => {
    const player = new Movement()
    player.contacts(true, 0, 0)
    const jump = player.step(still, 0, false, true, false, dt)
    expect(jump.y).toBeGreaterThan(0)
    expect(player.state).toBe('airborne')
    const second = player.step(still, 0, false, true, false, dt)
    expect(second.y).toBeLessThan(jump.y)
    for (let i = 0; i < 30; i++) player.step(still, 0, false, false, false, dt)
    expect(player.vertical).toBeLessThan(0)
    player.contacts(true, 0, -0.1)
    expect(player.vertical).toBe(0)
    player.step(still, 0, false, false, false, dt)
    expect(player.state).toBe('idle')
  })

  it('turns smoothly and rotates movement into camera space', () => {
    const player = new Movement()
    const motion = player.step(forward, Math.PI / 2, false, false, false, dt)
    expect(motion.x).toBeLessThan(0)
    expect(motion.z).toBeCloseTo(0)
    expect(player.facing).toBeGreaterThan(0)
    expect(player.facing).toBeLessThan(Math.PI / 2)
  })
})
