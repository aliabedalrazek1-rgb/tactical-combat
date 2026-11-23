import { keys, type Action, type Controls } from './bindings'
export { keys, type Action } from './bindings'
export class InputState {
  private held = new Map<string, Action>()
  private edges = new Map<Action, string | null>()
  private motion = { x: 0, y: 0 }
  stick = { x: 0, y: 0 }

  constructor(private readonly menuAction?: (action: 'pause' | 'loadout') => void) {}

  press(id: string, action: Action) {
    if (this.held.has(id)) return
    if (this.menuAction && (action === 'pause' || action === 'loadout')) {
      this.held.set(id, action)
      this.menuAction(action)
      return
    }
    if (!this.down(action) && !this.edges.has(action)) this.edges.set(action, id)
    this.held.set(id, action)
  }

  release(id: string, cancelled = false) {
    const action = this.held.get(id)
    this.held.delete(id)
    if (!action || !this.edges.has(action)) return
    if (!cancelled) {
      this.edges.set(action, null)
      return
    }
    if (this.edges.get(action) !== id) return
    for (const [other, held] of this.held) {
      if (held !== action) continue
      this.edges.set(action, other)
      return
    }
    this.edges.delete(action)
  }

  down(action: Action) {
    for (const value of this.held.values()) if (value === action) return true
    return false
  }

  take(action: Action) {
    return this.edges.delete(action)
  }

  axes() {
    const x = Number(this.down('right')) - Number(this.down('left')) + this.stick.x
    const y = Number(this.down('forward')) - Number(this.down('back')) + this.stick.y
    const length = Math.max(1, Math.hypot(x, y))
    return { x: x / length, y: y / length }
  }

  look(dx: number, dy: number) {
    this.motion.x += dx
    this.motion.y += dy
  }

  readLook() {
    const delta = this.motion
    this.motion = { x: 0, y: 0 }
    return delta
  }

  clear() {
    this.held.clear()
    this.edges.clear()
    this.stick = { x: 0, y: 0 }
    this.readLook()
  }
}

export function bindInput(input: InputState, surface: HTMLElement, joystick: HTMLElement, knob: HTMLElement, touchSensitivity: () => number, controls?: Controls, playing = () => true) {
  let swipe = -1
  let stick = -1
  let originX = 0
  let originY = 0
  let mouse = -1
  let previousX = 0
  let previousY = 0
  const heldButtons = new Map<number, HTMLButtonElement>()
  const id = (event: PointerEvent) => `pointer-${event.pointerId}`

  window.addEventListener('keydown', (event) => {
    const bindings = controls?.bindings ?? keys
    const action = bindings[event.code as keyof typeof bindings]
    if (!playing() && action !== 'pause') return
    if (!action || event.ctrlKey || event.metaKey || event.altKey) return
    const target = event.target
    if (event.code !== 'Escape' && target instanceof HTMLElement &&
      (target.matches('input, select, textarea') || (event.code === 'Space' && target.matches('button, summary')))) return
    event.preventDefault()
    if (!event.repeat) input.press(event.code, action)
  })
  window.addEventListener('keyup', (event) => input.release(event.code))

  function resetStick() {
    stick = -1
    input.stick = { x: 0, y: 0 }
    knob.style.transform = ''
  }

  const mouseMasks = [1, 4, 2, 8, 16]
  function updateMouseButtons(buttons: number, cancelled = false) {
    const bindings = controls?.bindings ?? keys
    for (const [index, mask] of mouseMasks.entries()) {
      const code = 'Mouse' + index
      const action = bindings[code as keyof typeof bindings]
      if (action && (buttons & mask)) {
        input.press(code, action)
        if (!playing()) return
      } else input.release(code, cancelled)
    }
  }

  surface.addEventListener('contextmenu', (event) => event.preventDefault())
  surface.addEventListener('pointerdown', (event) => {
    if (!playing()) return
    if (event.pointerType !== 'mouse') {
      if (swipe !== -1) return
      swipe = event.pointerId
      previousX = event.clientX
      previousY = event.clientY
      surface.setPointerCapture(event.pointerId)
    } else if (event.buttons) {
      mouse = event.pointerId
      updateMouseButtons(event.buttons)
      if (mouse === event.pointerId && document.pointerLockElement !== surface) surface.setPointerCapture(event.pointerId)
    }
  })
  surface.addEventListener('pointermove', (event) => {
    if (event.pointerId === swipe) {
      input.look((event.clientX - previousX) * touchSensitivity(), (event.clientY - previousY) * touchSensitivity())
      previousX = event.clientX
      previousY = event.clientY
    }
    if (!playing()) return
    const locked = event.pointerType === 'mouse' && document.pointerLockElement === surface
    // Mouse button chords deliver intermediate presses and releases as pointer moves.
    const ownsButtons = event.pointerId === mouse
    if (ownsButtons) updateMouseButtons(event.buttons)
    if (playing() && (locked || (ownsButtons && (event.buttons & mouseMasks[controls?.dragButton ?? 2]))))
      input.look(event.movementX, event.movementY)
  })
  surface.addEventListener('lostpointercapture', (event) => {
    if (event.pointerId === swipe) swipe = -1
    endMouse(event.pointerId, true)
  })

  joystick.addEventListener('pointerdown', (event) => {
    if (!playing() || stick !== -1) return
    stick = event.pointerId
    originX = event.clientX
    originY = event.clientY
    joystick.setPointerCapture(event.pointerId)
  })
  joystick.addEventListener('pointermove', (event) => {
    if (event.pointerId !== stick) return
    const dx = event.clientX - originX
    const dy = event.clientY - originY
    const radius = joystick.clientWidth * 0.32
    const scale = Math.max(radius, Math.hypot(dx, dy))
    input.stick = { x: dx / scale, y: -dy / scale }
    knob.style.transform = `translate(${radius * input.stick.x}px, ${-radius * input.stick.y}px)`
  })
  joystick.addEventListener('lostpointercapture', (event) => {
    if (event.pointerId === stick) resetStick()
  })

  document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
      if (!playing()) return
      event.preventDefault()
      heldButtons.set(event.pointerId, button)
      button.classList.add('held')
      input.press(id(event), button.dataset.action as Action)
      button.setPointerCapture(event.pointerId)
    })
    button.addEventListener('lostpointercapture', endPointer)
  })

  function endMouse(pointerId: number, cancelled: boolean) {
    if (pointerId !== mouse) return
    mouse = -1
    updateMouseButtons(0, cancelled)
  }

  function endPointer(event: PointerEvent) {
    const cancelled = event.type !== 'pointerup'
    input.release(id(event), cancelled)
    const button = heldButtons.get(event.pointerId)
    heldButtons.delete(event.pointerId)
    if (button && !Array.from(heldButtons.values()).includes(button)) button.classList.remove('held')
    if (event.pointerId === stick) resetStick()
    if (event.pointerId === swipe) swipe = -1
    endMouse(event.pointerId, cancelled)
  }

  window.addEventListener('pointerup', endPointer)
  window.addEventListener('pointercancel', endPointer)

  return () => {
    input.clear()
    swipe = mouse = -1
    resetStick()
    heldButtons.forEach((button) => button.classList.remove('held'))
    heldButtons.clear()
  }
}
