import * as T from 'three'
import { buildArena } from './arena'
import { Operative, ShotEffects } from './animation'
import { ShoulderCamera } from './camera'
import { resolveShot, traceShot } from './combat'
import { bindInput, InputState } from './input'
import { Movement, spawn } from './movement'
import { Physics } from './physics'
import { Rendering } from './rendering'
import { loadSettings, saveSettings } from './settings'
import { element, HUD } from './ui'
import { pistol, Weapon } from './weapon'
import './styles.css'

async function start() {
  // Keep storage access inside load/save's error handling.
  const storage = {
    getItem: (key: string) => window.localStorage.getItem(key),
    setItem: (key: string, value: string) => window.localStorage.setItem(key, value),
  }
  const settings = loadSettings(storage)
  const physics = await Physics.init()
  const surface = element('surface')
  const graphics = new Rendering(surface)
  const targets = buildArena(graphics.scene, physics)
  const operative = new Operative(graphics.scene)
  const effects = new ShotEffects(graphics.scene)
  const camera = new ShoulderCamera(graphics.camera, physics)
  const hud = new HUD(settings, (key) => {
    saveSettings(storage, settings)
    if (key === 'quality') {
      graphics.quality(settings.quality)
      graphics.draw(true)
    }
    if (key === 'buttonSize') setButtonSize()
  })
  const input = new InputState()
  const clearInput = bindInput(input, surface, element('joystick'), element('knob'), () => settings.touchSensitivity)
  const player = { health: 100, maxHealth: 100 }
  const position = new T.Vector3()
  const muzzle = new T.Vector3()
  const shoulder = new T.Vector3()
  let movement = new Movement()
  let weapon = new Weapon(pistol)
  let now = 0
  let shotPoseUntil = 0
  let lastFrame = performance.now()
  let accumulator = 0
  let shadowTime = 0
  let paused = false

  function setButtonSize() {
    document.documentElement.style.setProperty('--touch-button', `${52 * settings.buttonSize}px`)
  }

  function resetRange() {
    now = accumulator = shotPoseUntil = shadowTime = 0
    player.health = player.maxHealth
    weapon = new Weapon(pistol)
    movement = new Movement()
    position.set(spawn.x, spawn.y, spawn.z)
    physics.reset()
    targets.forEach((target) => target.reset())
    operative.reset()
    effects.reset()
    camera.reset()
    hud.reset()
    operative.update(position, 0, 'idle', false, 0, false, 0)
    camera.update(position, false, 0)
    hud.update(weapon, player, 0, targets.length, false, now)
    graphics.draw(true)
  }

  function setPaused(value: boolean) {
    if (paused === value) return
    paused = value
    accumulator = 0
    clearInput()
    if (paused) hud.menu.showModal()
    else {
      hud.menu.close()
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    }
  }

  element('pause').addEventListener('click', () => setPaused(true))
  element('resume').addEventListener('click', () => setPaused(false))
  element('restart').addEventListener('click', () => {
    resetRange()
    setPaused(false)
  })
  hud.menu.addEventListener('cancel', (event) => {
    event.preventDefault()
    setPaused(false)
  })
  window.addEventListener('blur', clearInput)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) setPaused(true)
  })
  new ResizeObserver(() => {
    if (paused) graphics.draw(false)
  }).observe(surface)

  function fire() {
    const { range, damage, recoil } = weapon.spec
    shoulder.copy(position).setY(position.y + 1.39)
    const shot = traceShot(
      (origin, direction, length) => physics.ray(origin, direction, length),
      graphics.camera.position, camera.direction, shoulder, operative.muzzlePosition(muzzle), range,
    )
    const result = resolveShot(shot.hit, damage)
    effects.play(shot.start, shot.end, Boolean(shot.hit))
    operative.shoot()
    camera.recoil(recoil)
    if (result === 'hit') hud.notify('HIT', now, true)
    if (result === 'down') hud.notify(targets.every((t) => t.health === 0) ? 'RANGE CLEAR' : 'TARGET DOWN', now, true, 1.45)
  }

  const step = 1 / 60
  function simulate(dt: number) {
    now += dt
    effects.update(dt)
    const aim = input.down('aim')
    const fireRequested = input.take('fire') || input.down('fire')
    const running = input.down('run')
    const ready = aim || fireRequested || now < shotPoseUntil
    const look = input.readLook()
    const sensitivity = settings.lookSensitivity * (aim ? 0.66 : 1)
    const horizontal = +input.down('lookRight') - +input.down('lookLeft')
    const vertical = +input.down('lookDown') - +input.down('lookUp')
    camera.rotate((horizontal * 1.85 * dt + look.x * 0.0035) * sensitivity,
      (vertical * 1.45 * dt + look.y * 0.0035) * sensitivity)
    const desired = movement.step(input.axes(), camera.yaw, running, input.take('jump'), aim, dt, ready && !weapon.reloading)
    const motion = physics.move(desired)
    movement.contacts(motion.grounded, motion.movement.y, desired.y)
    position.copy(motion.position)
    camera.update(position, aim, dt)
    weapon.update(now)
    if (input.take('reload')) weapon.reload(now)
    const fired = fireRequested && weapon.fire(now)
    if (fired) shotPoseUntil = now + 0.24
    operative.update(position, movement.facing, movement.state, ready,
      Math.asin(camera.direction.y), weapon.reloading, dt)
    if (fired) fire()
    targets.forEach((target) => target.update(dt))
    hud.update(weapon, player, targets.filter((t) => t.health === 0).length, targets.length, aim, now)
  }

  function frame(time: number) {
    const dt = Math.min((time - lastFrame) / 1000, 0.05)
    lastFrame = time
    if (input.take('pause')) setPaused(!paused)
    if (!paused && dt > 0) {
      accumulator += dt
      while (accumulator >= step) {
        simulate(step)
        accumulator -= step
      }
      shadowTime += dt
      const updateShadow = shadowTime >= (settings.quality === 'high' ? 1 / 30 : 1 / 15)
      if (updateShadow) shadowTime = 0
      graphics.draw(updateShadow)
    }
    requestAnimationFrame(frame)
  }

  setButtonSize()
  graphics.quality(settings.quality)
  resetRange()
  element('loading').hidden = true
  lastFrame = performance.now()
  requestAnimationFrame(frame)
}

start().catch((error: unknown) => {
  console.error(error)
  element('loading').textContent = 'The range could not load. WebGL 2 and hardware acceleration are required.'
})
