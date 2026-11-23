import {
  actions,
  bind,
  bindingLabel,
  defaultControls,
  touchControls,
  type Action,
  type Controls,
  type Layout,
  type Placement,
  type TouchControl,
} from './bindings'
import { element } from './ui'

const grid: Record<TouchControl, [number, number]> = {
  fire: [0, 0],
  aim: [1, 0],
  dodge: [2, 0],
  reload: [0, 1],
  heavy: [0, 1],
  kick: [1, 1],
  shove: [2, 1],
  holster: [0, 2],
  run: [1, 2],
  jump: [2, 2],
  stick: [0, 0],
}
const device = (): Layout => (Math.min(innerWidth, innerHeight) >= 600 ? 'tablet' : 'phone')
type Bounds = { left: number; right: number; top: number; bottom: number }
const meleeOnly = new Set<TouchControl>(['heavy', 'kick', 'shove'])

function placeInFreeSpace(x: number, y: number, radius: number, width: number, height: number, blocked: Bounds[]) {
  const padding = 2
  const min = radius + padding
  const maxX = width - min
  const maxY = height - min
  const clamp = (value: number, max: number) => Math.max(min, Math.min(max, value))
  x = clamp(x, maxX)
  y = clamp(y, maxY)
  const xs = [x, min, maxX]
  const ys = [y, min, maxY]
  for (const box of blocked) {
    xs.push(clamp(box.left - min, maxX), clamp(box.right + min, maxX))
    ys.push(clamp(box.top - min, maxY), clamp(box.bottom + min, maxY))
  }
  let best: Bounds | undefined
  let nearest = Infinity
  for (const cx of xs) {
    for (const cy of ys) {
      const distance = (cx - x) ** 2 + (cy - y) ** 2
      if (distance >= nearest) continue
      const box = { left: cx - radius, right: cx + radius, top: cy - radius, bottom: cy + radius }
      if (blocked.some((other) =>
        box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top)) continue
      best = box
      nearest = distance
    }
  }
  return best
}

export function controlEditor(controls: Controls, save: () => void, baseSize: () => number) {
  const list = element('bindings')
  const panel = element('capture')
  const move = element('move-binding')
  const notice = element('binding-status')
  const choice = element<HTMLSelectElement>('binding-choice')
  const choices = [
    ...Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ', (letter) => 'Key' + letter),
    ...Array.from('0123456789', (digit) => 'Digit' + digit),
    'Space',
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'ShiftLeft',
    'ShiftRight',
    ...Array.from({ length: 5 }, (_, index) => 'Mouse' + index),
  ]
  for (const code of choices) choice.add(new Option(bindingLabel(code), code))
  choice.onchange = () => {
    if (choice.value) assign(choice.value)
  }
  let capture: { action: Action; old: string; candidate: string; button: HTMLButtonElement } | null = null
  function finish() {
    const button = capture?.button
    capture = null
    panel.hidden = move.hidden = true
    button?.focus()
  }
  function drawBindings() {
    list.replaceChildren()
    for (const action of Object.keys(actions) as Action[]) {
      const row = document.createElement('div')
      const title = document.createElement('span')
      title.textContent = actions[action]
      row.append(title)
      const codes = Object.keys(controls.bindings).filter((code) => controls.bindings[code] === action)
      for (const code of [...codes, '']) {
        const button = document.createElement('button')
        button.type = 'button'
        button.textContent = code ? bindingLabel(code) : '+'
        button.disabled = code === 'Escape'
        button.setAttribute(
          'aria-label',
          actions[action] + ' — ' + (button.textContent === '+' ? 'add binding' : button.textContent),
        )
        button.onclick = () => {
          capture = { action, old: code, candidate: '', button }
          element('unbind').hidden = !code
          panel.hidden = false
          move.hidden = true
          choice.value = ''
          notice.textContent = 'Choose an input for ' + actions[action]
          if (matchMedia('(any-pointer: coarse)').matches) panel.scrollIntoView({ block: 'nearest' })
        }
        row.append(button)
      }
      list.append(row)
    }
  }
  function assign(code: string, resolve = false) {
    if (!capture) return
    const { action, old } = capture
    const result = bind(controls.bindings, action, old, code, resolve)
    if (result === 'saved') {
      finish()
      save()
      drawBindings()
      const row = Array.from(list.children)[Object.keys(actions).indexOf(action)]
      row.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    } else {
      capture.candidate = code
      move.hidden = result !== 'conflict'
      notice.textContent =
        result === 'reserved'
          ? 'Reserved for menu or browser navigation. Choose another input.'
          : bindingLabel(code) +
            ' controls ' +
            actions[controls.bindings[code]] +
            '. Move it to ' +
            actions[action] +
            '?'
      if (!move.hidden) move.focus()
    }
  }
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.target === choice && event.code !== 'Escape') return
      if (!capture || event.code === 'Tab' || (event.code === 'Enter' && panel.contains(document.activeElement)))
        return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (event.code === 'Escape') finish()
      else if (!event.repeat) assign(event.code)
    },
    true,
  )
  window.addEventListener(
    'pointerdown',
    (event) => {
      if (!capture || event.pointerType === 'touch' || panel.contains(event.target as Node)) return
      event.preventDefault()
      event.stopImmediatePropagation()
      // Ignore the generated click only if it belongs to the captured pointer gesture.
      const origin = event.target
      const ignore = (click: MouseEvent) => {
        if (click.target === origin) {
          click.preventDefault()
          click.stopImmediatePropagation()
        }
      }
      const cleanup = () => setTimeout(() => window.removeEventListener('click', ignore, true), 0)
      window.addEventListener('click', ignore, { capture: true, once: true })
      window.addEventListener('pointerup', cleanup, { capture: true, once: true })
      assign('Mouse' + event.button)
    },
    true,
  )
  element('controls').addEventListener('contextmenu', (e) => e.preventDefault())
  element('unbind').onclick = () => {
    if (!capture?.old) return
    delete controls.bindings[capture.old]
    finish()
    drawBindings()
    save()
  }
  element('cancel-binding').onclick = finish
  element<HTMLDialogElement>('menu').addEventListener('close', finish)
  move.onclick = () => capture && assign(capture.candidate, true)
  element('default-bindings').onclick = () => {
    controls.bindings = defaultControls().bindings
    finish()
    drawBindings()
    save()
  }
  drawBindings()
  const vertical = element<HTMLInputElement>('vertical')
  const repeat = element<HTMLInputElement>('repeat-pistol')
  repeat.checked = controls.repeatPistol
  repeat.onchange = () => {
    controls.repeatPistol = repeat.checked
    save()
  }
  const invert = element<HTMLInputElement>('invert')
  const drag = element<HTMLSelectElement>('dragButton')
  vertical.value = String(controls.vertical)
  invert.checked = controls.invert
  drag.value = String(controls.dragButton)
  vertical.oninput = () => {
    controls.vertical = vertical.valueAsNumber
    save()
  }
  invert.onchange = () => {
    controls.invert = invert.checked
    save()
  }
  drag.onchange = () => {
    controls.dragButton = Number(drag.value)
    save()
  }

  const layout = element<HTMLSelectElement>('layout')
  const item = element<HTMLSelectElement>('touch-item')
  const left = element<HTMLInputElement>('left-handed')
  const x = element<HTMLInputElement>('touch-x')
  const y = element<HTMLInputElement>('touch-y')
  const size = element<HTMLInputElement>('touch-size')
  layout.value = device()
  for (const name of touchControls)
    item.add(new Option(name === 'stick' ? 'Movement joystick' : actions[name], name))
  const nodes = new Map(
    touchControls.map((name) => [
      name,
      name === 'stick' ? element('joystick') : document.querySelector<HTMLElement>('[data-action="' + name + '"]'),
    ]),
  )
  function dimensions(profile: Layout) {
    if (profile !== device()) {
      const phone = profile === 'phone'
      return {
        width: phone ? 390 : 1024,
        height: phone ? 620 : 550,
        top: 70,
        diameter: (phone ? 48 : 60) * baseSize(),
      }
    }
    const width = innerWidth
    const top = Math.max(64, element('pause').getBoundingClientRect().bottom + 6)
    const bottom = document.querySelector<HTMLElement>('.bottom')!.getBoundingClientRect().top - 24
    const height = Math.max(1, bottom - top)
    const diameter = Math.min((profile === 'tablet' ? 60 : 48) * baseSize(), height / 3.65, width / 7)
    return { width, height, top, diameter }
  }
  function placement(profile: Layout, name: TouchControl, dims: ReturnType<typeof dimensions>): Placement {
    const custom = controls[profile].positions[name]
    if (custom) return custom
    const [col, row] = grid[name]
    const gap = Math.min(dims.diameter + 6, dims.height / 3.2)
    const pad = dims.diameter * 0.6 + (profile === 'tablet' ? 20 : 4)
    return name === 'stick'
      ? { x: 0.15, y: 0.78, size: 1 }
      : { x: 1 - (pad + col * gap) / dims.width, y: 1 - (pad + row * gap) / dims.height, size: 1 }
  }
  function arranged(profile: Layout, dims: ReturnType<typeof dimensions>) {
    const placed = new Map<TouchControl, Bounds>()
    const center = dims.width / 2
    const partnerTop = (dims.width <= 680 ? 66 : 80) - dims.top
    const reticle = (profile === device() ? innerHeight / 2 - dims.top : dims.height * 0.4)
    // Keep space for the sparring HUD, reticle and strike feedback, even when hidden.
    const hud = [
      { left: center - 130, right: center + 130, top: partnerTop, bottom: partnerTop + 42 },
      { left: center - 90, right: center + 90, top: reticle - 10, bottom: reticle + 43 },
    ]
    for (const name of touchControls) {
      const pos = placement(profile, name, dims)
      const horizontal = controls[profile].leftHanded ? 1 - pos.x : pos.x
      const blocked = [...hud]
      for (const [other, box] of placed) {
        if ((name === 'reload' && meleeOnly.has(other)) || (other === 'reload' && meleeOnly.has(name))) continue
        blocked.push(box)
      }
      const x = horizontal * dims.width
      const y = pos.y * dims.height
      const radius = (dims.diameter * (name === 'stick' ? 1.85 : 1)) / 2
      const box =
        placeInFreeSpace(x, y, radius * pos.size, dims.width, dims.height, blocked) ??
        placeInFreeSpace(x, y, radius * Math.min(pos.size, 1), dims.width, dims.height, blocked) ??
        placeInFreeSpace(x, y, radius * 0.65, dims.width, dims.height, blocked)
      if (box) placed.set(name, box)
    }
    return placed
  }
  function positionControls() {
    const profile = device()
    const dims = dimensions(profile)
    const placed = arranged(profile, dims)
    for (const [name, node] of nodes) {
      const box = placed.get(name)
      if (!node || !box) continue
      const d = box.right - box.left
      node.style.cssText =
        'width:' +
        d +
        'px;height:' +
        d +
        'px;left:' +
        (box.left + d / 2) +
        'px;top:' +
        (dims.top + box.top + d / 2) +
        'px'
    }
  }
  const preview = element('layout-preview')
  const markers = touchControls.map((name) => {
    const marker = document.createElement('button')
    marker.type = 'button'
    marker.textContent = {
      stick: 'M',
      fire: 'F',
      aim: 'A',
      heavy: 'H',
      kick: 'K',
      shove: 'S',
      dodge: 'D',
      holster: '⇄',
      run: 'R',
      jump: 'J',
      reload: '↻',
    }[name]
    marker.title = name
    marker.setAttribute('aria-label', 'Position ' + name)
    marker.onclick = () => {
      item.value = name
      refresh()
    }
    let owner: number | null = null
    marker.onpointerdown = (event) => {
      if (owner !== null) return
      owner = event.pointerId
      item.value = name
      marker.setPointerCapture(owner)
      refresh()
    }
    marker.onpointermove = (event) => {
      if (owner !== event.pointerId) return
      const box = preview.getBoundingClientRect()
      x.value = String((100 * (event.clientX - box.left)) / box.width)
      y.value = String((100 * (event.clientY - box.top)) / box.height)
      changePosition()
    }
    marker.onlostpointercapture = () => {
      owner = null
    }
    preview.append(marker)
    return { name, marker }
  })
  function drawPreview() {
    const profile = layout.value as Layout
    const dims = dimensions(profile)
    const placed = arranged(profile, dims)
    const gunPreview = item.value === 'reload'
    for (const { name, marker } of markers) {
      const box = placed.get(name)
      marker.hidden = gunPreview ? ['heavy', 'shove', 'kick'].includes(name) : name === 'reload'
      marker.classList.toggle('selected', item.value === name)
      if (!box) continue
      const radius = ((name === 'stick' ? 35 / 1.85 : 27) * (box.right - box.left)) / dims.diameter / 2
      const percent = ((box.left + box.right) / 2 / dims.width) * 100
      marker.style.left = 'clamp(' + radius + 'px,' + percent + '%,calc(100% - ' + radius + 'px))'
      marker.style.top = ((box.top + box.bottom) / 2 / dims.height) * 100 + '%'
      marker.style.width = marker.style.height = radius * 2 + 'px'
    }
  }
  function refresh() {
    const profile = layout.value as Layout
    const pos = placement(profile, item.value as TouchControl, dimensions(profile))
    left.checked = controls[profile].leftHanded
    x.value = String(Math.round((left.checked ? 1 - pos.x : pos.x) * 100))
    y.value = String(Math.round(pos.y * 100))
    size.value = String(pos.size)
    positionControls()
    drawPreview()
  }
  function changePosition() {
    controls[layout.value as Layout].positions[item.value as TouchControl] = {
      x: left.checked ? 1 - x.valueAsNumber / 100 : x.valueAsNumber / 100,
      y: y.valueAsNumber / 100,
      size: size.valueAsNumber,
    }
    save()
    positionControls()
    drawPreview()
  }
  for (const slider of [x, y, size]) slider.oninput = changePosition
  layout.onchange = item.onchange = refresh
  left.onchange = () => {
    controls[layout.value as Layout].leftHanded = left.checked
    save()
    refresh()
  }
  element('reset-layout').onclick = () => {
    controls[layout.value as Layout] = { leftHanded: false, positions: {} }
    save()
    refresh()
  }
  window.addEventListener('resize', refresh)
  refresh()
  return positionControls
}
