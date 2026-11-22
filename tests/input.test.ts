import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindInput, InputState, keys } from '../src/input'
import { defaultControls, type Controls } from '../src/bindings'

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

describe('bound pointer events', () => {
  afterEach(() => vi.unstubAllGlobals())

  function setup(controls?: Controls) {
    function element() {
      const classes = new Set<string>()
      return Object.assign(new EventTarget(), {
        clientWidth: 400,
        style: { transform: '' },
        classList: {
          add: (name: string) => classes.add(name),
          remove: (name: string) => classes.delete(name),
          contains: (name: string) => classes.has(name),
        },
        setPointerCapture: vi.fn(),
      })
    }

    const root = new EventTarget()
    const surface = element()
    const joystick = element()
    const knob = element()
    const aim = Object.assign(element(), { dataset: { action: 'aim' } })
    const fire = Object.assign(element(), { dataset: { action: 'fire' } })
    vi.stubGlobal('window', root)
    vi.stubGlobal('document', { querySelectorAll: () => [aim, fire] })
    const input = new InputState()
    const clear = bindInput(input, surface as unknown as HTMLElement, joystick as unknown as HTMLElement,
      knob as unknown as HTMLElement, () => 1, controls)
    return { root, surface, joystick, knob, aim, fire, input, clear }
  }

  function pointer(target: EventTarget, type: string, pointerId: number, pointerType: string, overrides = {}) {
    target.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), {
      pointerId, pointerType, button: 0, buttons: 1, clientX: 200, clientY: 100,
      movementX: 0, movementY: 0, ...overrides,
    }))
  }

  it('keeps mouse fire held through unrelated pointer up and cancellation', () => {
    const { root, surface, fire, input } = setup()
    pointer(surface, 'pointerdown', 1, 'mouse')
    pointer(fire, 'pointerdown', 2, 'touch')
    pointer(root, 'pointerup', 2, 'touch', { buttons: 0 })
    expect(input.down('fire')).toBe(true)
    pointer(root, 'pointercancel', 3, 'touch', { button: -1, buttons: 0 })
    expect(input.down('fire')).toBe(true)
    pointer(root, 'pointerup', 1, 'mouse', { buttons: 0 })
    expect(input.down('fire')).toBe(false)
  })

  it('maps a custom mouse chord and drag button through independent actions', () => {
    const controls = defaultControls()
    controls.bindings.Mouse0 = 'aim'
    controls.bindings.Mouse2 = 'fire'
    controls.dragButton = 0
    const { surface, input } = setup(controls)
    pointer(surface,'pointerdown',1,'mouse')
    expect(input.down('aim')).toBe(true)
    pointer(surface,'pointermove',1,'mouse',{buttons:3,movementX:7})
    expect(input.down('fire')).toBe(true)
    expect(input.readLook().x).toBe(7)
    pointer(surface,'pointermove',1,'mouse',{buttons:2,movementX:7})
    expect(input.down('aim')).toBe(false)
    expect(input.down('fire')).toBe(true)
    expect(input.readLook().x).toBe(0)
  })

  it('accepts direct camera motion with no buttons only while locked', () => {
    const {surface,input} = setup()
    pointer(surface,'pointermove',1,'mouse',{buttons:0,movementX:8})
    expect(input.readLook().x).toBe(0)
    Object.assign(document,{pointerLockElement:surface})
    pointer(surface,'pointermove',1,'mouse',{buttons:0,movementX:8})
    expect(input.readLook().x).toBe(8)
    expect(input.down('fire')).toBe(false)
  })

  it('tracks both mouse buttons when chord changes are delivered as pointer moves', () => {
    const { root, surface, input } = setup()
    pointer(surface, 'pointerdown', 1, 'mouse', { button: 2, buttons: 2 })
    pointer(surface, 'pointermove', 1, 'mouse', { button: 0, buttons: 3, movementX: 4 })
    expect(input.down('aim')).toBe(true)
    expect(input.down('fire')).toBe(true)
    expect(input.readLook()).toEqual({ x: 4, y: 0 })
    pointer(surface, 'pointermove', 1, 'mouse', { button: 0, buttons: 2 })
    expect(input.down('fire')).toBe(false)
    expect(input.down('aim')).toBe(true)
    pointer(root, 'pointerup', 1, 'mouse', { button: 2, buttons: 0 })
    expect(input.down('aim')).toBe(false)
  })

  it('does not leave mouse fire held after capture loss or its own cancellation', () => {
    const { root, surface, input } = setup()
    pointer(surface, 'pointerdown', 1, 'mouse')
    pointer(surface, 'lostpointercapture', 1, 'mouse', { button: -1 })
    expect(input.down('fire')).toBe(false)
    pointer(surface, 'pointerdown', 1, 'mouse')
    pointer(root, 'pointercancel', 1, 'mouse', { button: -1, buttons: 0 })
    expect(input.down('fire')).toBe(false)
  })

  it('releases only the cancelled or captured touch and clears remaining input together', () => {
    const { root, surface, joystick, knob, aim, fire, input, clear } = setup()
    pointer(joystick, 'pointerdown', 2, 'touch')
    pointer(joystick, 'pointermove', 2, 'touch', { clientY: 68 })
    pointer(surface, 'pointerdown', 3, 'touch')
    pointer(surface, 'pointermove', 3, 'touch', { clientX: 220 })
    pointer(aim, 'pointerdown', 4, 'touch')
    pointer(fire, 'pointerdown', 5, 'touch')
    expect(input.axes().y).toBeCloseTo(0.25)
    expect(input.readLook()).toEqual({ x: 20, y: 0 })
    expect(input.down('aim')).toBe(true)
    expect(input.down('fire')).toBe(true)
    pointer(root, 'pointercancel', 5, 'touch', { button: -1, buttons: 0 })
    pointer(surface, 'lostpointercapture', 3, 'touch', { button: -1, buttons: 0 })
    pointer(surface, 'pointermove', 3, 'touch', { clientX: 240 })
    expect(input.readLook().x).toBe(0)
    expect(input.axes().y).toBeCloseTo(0.25)
    expect(input.down('aim')).toBe(true)
    expect(input.down('fire')).toBe(false)
    expect(fire.classList.contains('held')).toBe(false)
    clear()
    expect(input.axes()).toEqual({ x: 0, y: 0 })
    expect(input.down('aim')).toBe(false)
    expect(input.take('fire')).toBe(false)
    expect(knob.style.transform).toBe('')
    expect(aim.classList.contains('held')).toBe(false)
  })
})
