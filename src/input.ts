export const keys = {
  KeyW: 'forward', KeyS: 'back', KeyA: 'left', KeyD: 'right',
  ArrowUp: 'lookUp', ArrowDown: 'lookDown', ArrowLeft: 'lookLeft', ArrowRight: 'lookRight',
  KeyJ: 'fire', KeyK: 'aim', ShiftLeft: 'run', ShiftRight: 'run',
  Space: 'jump', KeyR: 'reload', Escape: 'pause',
} as const
export type Action = typeof keys[keyof typeof keys]

export class InputState {
  private held = new Map<string, Action>()
  private edges = new Set<Action>()
  private motion = { x: 0, y: 0 }
  stick = { x: 0, y: 0 }

  press(id: string, action: Action) {
    if (this.held.has(id)) return
    if (!this.down(action)) this.edges.add(action)
    this.held.set(id, action)
  }

  release(id: string) {
    this.held.delete(id)
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

export function bindInput(input: InputState, surface: HTMLElement, joystick: HTMLElement, knob: HTMLElement, touchSensitivity: () => number) {
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
    const action = keys[event.code as keyof typeof keys]
    if (!action || event.ctrlKey || event.metaKey || event.altKey) return
    if (action !== 'pause' && (event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLSelectElement ||
      (event.target instanceof HTMLButtonElement && action === 'jump'))) return
    event.preventDefault()
    if (!event.repeat) input.press(event.code, action)
  })
  window.addEventListener('keyup', (event) => input.release(event.code))

  function resetStick() {
    stick = -1
    input.stick = { x: 0, y: 0 }
    knob.style.transform = ''
  }

  function updateMouseButtons(buttons: number) {
    if (buttons & 1) input.press('mouse-fire', 'fire')
    else input.release('mouse-fire')
    if (buttons & 2) input.press('mouse-aim', 'aim')
    else input.release('mouse-aim')
  }

  surface.addEventListener('contextmenu', (event) => event.preventDefault())
  surface.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse') {
      if (swipe !== -1 || event.clientX < surface.clientWidth * 0.35) return
      swipe = event.pointerId
      previousX = event.clientX
      previousY = event.clientY
      surface.setPointerCapture(event.pointerId)
    } else if (event.buttons & 3) {
      mouse = event.pointerId
      updateMouseButtons(event.buttons)
      surface.setPointerCapture(event.pointerId)
    }
  })
  surface.addEventListener('pointermove', (event) => {
    if (event.pointerId === swipe) {
      input.look((event.clientX - previousX) * touchSensitivity(), (event.clientY - previousY) * touchSensitivity())
      previousX = event.clientX
      previousY = event.clientY
    }
    if (event.pointerId === mouse) {
      // Mouse button chords deliver intermediate presses and releases as pointer moves.
      updateMouseButtons(event.buttons)
      if (event.buttons & 2) input.look(event.movementX, event.movementY)
    }
  })
  surface.addEventListener('lostpointercapture', (event) => {
    if (event.pointerId === swipe) swipe = -1
    endMouse(event.pointerId)
  })

  joystick.addEventListener('pointerdown', (event) => {
    if (stick !== -1) return
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
      event.preventDefault()
      heldButtons.set(event.pointerId, button)
      button.classList.add('held')
      input.press(id(event), button.dataset.action as Action)
      button.setPointerCapture(event.pointerId)
    })
    button.addEventListener('lostpointercapture', endPointer)
  })

  function endMouse(pointerId: number) {
    if (pointerId !== mouse) return
    mouse = -1
    updateMouseButtons(0)
  }

  function endPointer(event: PointerEvent) {
    input.release(id(event))
    const button = heldButtons.get(event.pointerId)
    heldButtons.delete(event.pointerId)
    if (button && !Array.from(heldButtons.values()).includes(button)) button.classList.remove('held')
    if (event.pointerId === stick) resetStick()
    if (event.pointerId === swipe) swipe = -1
    endMouse(event.pointerId)
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
