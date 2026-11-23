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
import { Loadout, pelletDirection, type Weapon } from './weapon'
import { contact, Fighter, type Pose } from './fighter'
import { SparringPartner } from './sparring'
import { RangeAudio } from './sound'
import { loadControls, saveControls } from './bindings'
import { controlEditor } from './control-editor'
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
  const partner = new SparringPartner(graphics.scene, physics)
  const effects = Array.from({ length: 8 }, () => new ShotEffects(graphics.scene))
  const sound = new RangeAudio()
  const camera = new ShoulderCamera(graphics.camera, physics)
  const controls = loadControls(storage)
  function saveBindings() {
    saveControls(storage, controls)
    hud.guide(controls, Boolean(loadout.weapon))
  }
  const positionControls = controlEditor(controls, saveBindings, () => settings.buttonSize)
  const hud = new HUD(settings, (key) => {
    saveSettings(storage, settings)
    if (key === 'quality') {
      graphics.quality(settings.quality)
      graphics.draw(true)
    }
    if (key === 'buttonSize') positionControls()
  })
  const selector = element<HTMLSelectElement>('loadout')
  const input = new InputState((action) => {
    if (action === 'pause') setPaused(!paused)
    else {
      setPaused(true)
      selector.focus()
    }
  })
  const clearInput = bindInput(
    input,
    surface,
    element('joystick'),
    element('knob'),
    () => settings.touchSensitivity,
    controls,
    () => !paused,
  )
  let player = new Fighter()
  const position = new T.Vector3()
  const muzzle = new T.Vector3()
  const shoulder = new T.Vector3()
  let movement = new Movement()
  let loadout = new Loadout()
  let suppressTrigger = false
  const playerPose = { position, facing: 0 }
  const sightOrigin = new T.Vector3(),
    sightDelta = new T.Vector3()
  let now = 0
  let shotPoseUntil = 0
  let lastFrame = performance.now()
  let accumulator = 0
  let shadowTime = 0
  let paused = false

  function resetRange() {
    now = accumulator = shotPoseUntil = shadowTime = 0
    clearInput()
    player = new Fighter()
    loadout = new Loadout()
    loadout.update(player, 0)
    suppressTrigger = false
    partner.reset()
    operative.equip(loadout.equipped, loadout.weapon?.spec)
    movement = new Movement()
    position.set(spawn.x, spawn.y, spawn.z)
    physics.reset()
    targets.forEach((target) => target.reset())
    operative.reset()
    effects.forEach((effect) => effect.reset())
    camera.reset()
    hud.reset()
    operative.update(position, 0, 'idle', false, 0, false, 0)
    camera.update(position, false, 0)
    hud.update(loadout, player, 0, targets.length, false, now)
    hud.guide(controls, true)
    hud.showPartner(partner.fighter, false)
    positionControls()
    graphics.draw(true)
  }

  function setPaused(value: boolean) {
    if (paused === value) return
    paused = value
    accumulator = 0
    clearInput()
    if (paused) {
      if (document.pointerLockElement === surface) document.exitPointerLock()
      hud.menu.showModal()
    } else {
      hud.menu.close()
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    }
  }

  element('lock').addEventListener('click', async () => {
    setPaused(false)
    try {
      await surface.requestPointerLock()
    } catch {
      hud.notify('Pointer lock unavailable · drag to look', now, false, 3)
    }
  })
  let hadLock = false
  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === surface
    if (hadLock && !locked) setPaused(true)
    hadLock = locked
  })
  selector.addEventListener('change', () => loadout.request(selector.value))
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

  function fire(weapon: Weapon, aim: boolean) {
    const spec = weapon.spec
    shoulder.copy(position).setY(position.y + 1.39)
    operative.muzzlePosition(muzzle)
    let hit = false,
      down = false,
      partnerHit = false
    for (let i = 0; i < spec.pellets; i++) {
      const direction = pelletDirection(camera.direction, spec, i, loadout.sequence, aim)
      const shot = traceShot(
        (o, d, length) => physics.ray(o, d, length),
        graphics.camera.position,
        direction,
        shoulder,
        muzzle,
        spec.range,
      )
      const result = resolveShot(shot.hit, spec.damage)
      hit ||= result === 'hit'
      down ||= result === 'down'
      partnerHit ||= shot.hit?.target === partner.fighter
      effects[i].play(shot.start, shot.end, Boolean(shot.hit))
    }
    if (partnerHit) partner.fighter.stagger(0.22)
    operative.shoot(spec)
    camera.recoil(spec.recoil)
    sound.play(95 + spec.damage * 1.3, 0.06 + spec.recoil, 'sawtooth')
    if (down) hud.notify(targets.every((t) => t.health === 0) ? 'RANGE CLEAR' : 'TARGET DOWN', now, true, 1.45)
    else if (hit) hud.notify('HIT', now, true)
  }

  function exchange(attacker: Fighter, from: Pose, target: Fighter, to: Pose) {
    const result = contact(attacker, from, target, to, () => {
      sightOrigin.copy(from.position).y += 1
      sightDelta.copy(to.position).sub(from.position)
      const length = sightDelta.length()
      return !physics.ray(sightOrigin, sightDelta.normalize(), length, true)
    })
    if (!result) return
    const defended = result === 'parried' || result === 'evaded'
    const message =
      defended && target === player
        ? result.toUpperCase() + ' · STRIKE TO COUNTER'
        : (attacker === player ? '' : 'PARTNER · ') + result.toUpperCase()
    hud.notify(message, now, result === 'hit' || defended)
    sound.play(defended ? 560 : result === 'blocked' ? 290 : 120)
    if (attacker === player && attacker.strike === 'shove' && ['hit', 'guard break'].includes(result))
      partner.shove(from.facing)
  }

  const step = 1 / 60
  function simulate(dt: number) {
    now += dt
    for (const effect of effects) effect.update(dt)
    if (player.tick(dt)) hud.notify('MISS', now, false, 0.45)
    if (player.state === 'down' && player.elapsed >= 1.8) {
      resetRange()
      return
    }
    if (input.take('holster')) loadout.holster()
    const oldItem = loadout.equipped
    loadout.update(player, now)
    const weapon = loadout.weapon
    const axes = input.axes()
    const held = input.down('fire')
    const trigger = input.take('fire')
    if (oldItem !== loadout.equipped) {
      suppressTrigger = held
      shotPoseUntil = 0
      operative.equip(loadout.equipped, weapon?.spec)
      hud.guide(controls, Boolean(weapon))
    }
    if (!held) suppressTrigger = false
    const guardPressed = input.take('aim')
    player.guard(input.down('aim') || guardPressed, guardPressed)
    if (input.take('dodge') && movement.grounded && player.dodge(axes.x, axes.y)) weapon?.cancelReload()
    const distance = position.distanceTo(partner.position)
    const heavy = input.take('heavy'),
      kick = input.take('kick'),
      shove = input.take('shove')
    if (!weapon && movement.grounded) {
      const attack = heavy
        ? 'heavy'
        : kick
          ? 'kick'
          : shove
            ? 'shove'
            : trigger && !suppressTrigger
              ? 'fire'
              : undefined
      if (attack && player.start(attack, axes.y > 0.25, distance)) sound.play(180, 0.045, 'sine')
    }
    if (input.take('reload')) loadout.reload(player, now)
    const aim = Boolean(weapon && player.free && !weapon.reloading && input.down('aim'))
    const ready = Boolean(weapon && player.free && (aim || held || trigger || now < shotPoseUntil))
    const look = input.readLook()
    const focus = aim ? 0.66 / (weapon?.spec.heft ?? 1) : 1
    const horizontal = +input.down('lookRight') - +input.down('lookLeft')
    const vertical = +input.down('lookDown') - +input.down('lookUp')
    camera.rotate(
      (horizontal * 1.85 * dt + look.x * 0.0035) * settings.lookSensitivity * focus,
      (vertical * 1.45 * dt + look.y * 0.0035 * (controls.invert ? -1 : 1)) * controls.vertical * focus,
    )
    const dodging = player.state === 'dodge'
    const moving = dodging ? { x: player.dodgeX, y: player.dodgeY } : axes
    const pace = dodging
      ? 1.65 * Math.max(0, 1 - player.elapsed / player.duration)
      : player.state === 'down' || player.state === 'stagger'
        ? 0
        : player.state === 'attack'
          ? 0.24
          : !player.free || player.state === 'guard'
            ? 0.48
            : aim
              ? 1 / (weapon?.spec.heft ?? 1)
              : 1
    const run = player.state === 'idle' && input.down('run') && !ready && !weapon?.reloading && player.canSprint
    const jump = input.take('jump')
    const desired = movement.step(
      { x: moving.x * pace, y: moving.y * pace },
      camera.yaw,
      run,
      player.free && jump,
      aim,
      dt,
      ready || (!weapon && (player.state !== 'idle' || distance < 2.2)),
    )
    if (run && movement.state === 'run') player.exert(dt)
    const motion = physics.move(desired)
    movement.contacts(motion.grounded, motion.movement.y, desired.y)
    position.copy(motion.position)
    playerPose.facing = movement.facing
    camera.update(position, aim, dt)
    partner.think(dt, playerPose, !weapon && player.health > 0)
    exchange(player, playerPose, partner.fighter, partner)
    exchange(partner.fighter, partner, player, playerPose)
    const fired = !suppressTrigger && loadout.shoot(player, now, trigger, held, controls.repeatPistol)
    if (fired) shotPoseUntil = now + 0.24
    operative.update(
      position,
      movement.facing,
      movement.state,
      ready,
      Math.asin(camera.direction.y),
      Boolean(weapon?.reloading),
      dt,
      player,
      weapon?.spec.heft,
    )
    partner.display(dt)
    if (fired && weapon) fire(weapon, aim)
    for (const target of targets) target.update(dt)
    hud.update(loadout, player, targets.filter((t) => t.health === 0).length, targets.length, aim, now)
    hud.showPartner(partner.fighter, distance < 3.3 && !weapon)
    if (oldItem !== loadout.equipped) positionControls()
  }

  function frame(time: number) {
    // Recover short render stalls while bounding the work done after a long one.
    const dt = Math.min((time - lastFrame) / 1000, 0.25)
    lastFrame = time
    if (!paused && dt > 0) {
      accumulator += dt
      while (accumulator >= step) {
        accumulator -= step
        simulate(step)
      }
      shadowTime += dt
      const updateShadow = shadowTime >= (settings.quality === 'high' ? 1 / 30 : 1 / 15)
      if (updateShadow) shadowTime = 0
      graphics.draw(updateShadow)
    }
    requestAnimationFrame(frame)
  }

  positionControls()
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
