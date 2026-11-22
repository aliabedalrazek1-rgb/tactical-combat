import { describe, expect, it } from 'vitest'
import { InputState, keys } from '../src/input'

describe('device-independent input', () => {
  it('maps every documented keyboard action', () => {
    expect(keys).toMatchObject({
      KeyW: 'forward', KeyA: 'left', KeyS: 'back', KeyD: 'right',
      ArrowUp: 'lookUp', ArrowDown: 'lookDown', ArrowLeft: 'lookLeft', ArrowRight: 'lookRight',
      KeyJ: 'fire', KeyK: 'aim', ShiftLeft: 'run', ShiftRight: 'run',
      Space: 'jump', KeyR: 'reload', Escape: 'pause',
    })
  })

  it('keeps touch movement, swipe and firing independent', () => {
    const input = new InputState()
    input.stick = { x: 0.3, y: 0.8 }
    input.look(8, -4)
    input.look(2, 3)
    input.press('touch-3', 'fire')
    expect(input.axes()).toEqual({ x: 0.3, y: 0.8 })
    expect(input.readLook()).toEqual({ x: 10, y: -1 })
    expect(input.readLook()).toEqual({ x: 0, y: 0 })
    expect(input.take('fire')).toBe(true)
    expect(input.down('fire')).toBe(true)
    input.release('touch-3')
    expect(input.down('fire')).toBe(false)
    expect(input.axes()).toEqual({ x: 0.3, y: 0.8 })
  })

  it('normalizes diagonal movement and allows aiming and jumping together', () => {
    const input = new InputState()
    input.press('KeyW', keys.KeyW)
    input.press('KeyD', keys.KeyD)
    input.press('KeyK', keys.KeyK)
    input.press('Space', keys.Space)
    const { x, y } = input.axes()
    expect(Math.hypot(x, y)).toBeCloseTo(1)
    expect(input.down('aim')).toBe(true)
    expect(input.take('jump')).toBe(true)
    input.press('Space', keys.Space)
    expect(input.take('jump')).toBe(false)
  })

  it('handles overlapping sources and clears state on focus loss', () => {
    const input = new InputState()
    input.press('KeyJ', 'fire')
    input.press('mouse-fire', 'fire')
    input.release('KeyJ')
    expect(input.down('fire')).toBe(true)
    input.clear()
    expect(input.down('fire')).toBe(false)
    expect(input.take('fire')).toBe(false)
  })
})
