export const keys = {
  KeyW: 'forward', KeyS: 'back', KeyA: 'left', KeyD: 'right',
  ArrowUp: 'lookUp', ArrowDown: 'lookDown', ArrowLeft: 'lookLeft', ArrowRight: 'lookRight',
  KeyJ: 'fire', KeyK: 'aim', ShiftLeft: 'run', ShiftRight: 'run',
  Space: 'jump', KeyR: 'reload', Escape: 'pause', KeyP: 'pause',
  Mouse0: 'fire', Mouse2: 'aim', KeyU: 'heavy', KeyI: 'kick', KeyO: 'shove',
  KeyL: 'dodge', KeyH: 'holster', KeyB: 'loadout',
} as const
export type Action = typeof keys[keyof typeof keys]
export const actions: Record<Action, string> = {
  forward: 'Forward', back: 'Back', left: 'Strafe left', right: 'Strafe right',
  lookUp: 'Look up', lookDown: 'Look down', lookLeft: 'Look left', lookRight: 'Look right',
  fire: 'Fire / strike / counter', aim: 'Aim / guard / parry', heavy: 'Heavy strike',
  kick: 'Kick', shove: 'Shove', dodge: 'Dodge', run: 'Run', jump: 'Jump',
  reload: 'Reload', holster: 'Holster / draw', loadout: 'Open loadout', pause: 'Pause',
}
export type Bindings = Record<string, Action>
export type Layout = 'phone' | 'tablet'
export const touchControls = ['stick','fire','aim','run','jump','reload','heavy','kick','shove','dodge','holster'] as const
export type TouchControl = typeof touchControls[number]
export type Placement = { x: number, y: number, size: number }
type TouchLayout = { leftHanded: boolean, positions: Partial<Record<TouchControl, Placement>> }
export type Controls = {
  bindings: Bindings, vertical: number, invert: boolean, dragButton: number,
  phone: TouchLayout, tablet: TouchLayout,
}
export function defaultControls(): Controls {
  return { bindings: { ...keys }, vertical: 1, invert: false, dragButton: 2,
    phone: { leftHanded: false, positions: {} }, tablet: { leftHanded: false, positions: {} } }
}
const storageKey = 'tactical-combat.controls.v2'
const finite = (value: unknown, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
export function loadControls(storage: Pick<Storage,'getItem'>) {
  const controls = defaultControls()
  try {
    const data = JSON.parse(storage.getItem(storageKey) ?? '{}')
    if (data.bindings && typeof data.bindings === 'object' && !Array.isArray(data.bindings)) {
      controls.bindings = { Escape: 'pause' }
      for (const [code, action] of Object.entries(data.bindings)) {
        if (validCode(code) && typeof action === 'string' && Object.hasOwn(actions, action))
          controls.bindings[code] = action as Action
      }
    }
    if (finite(data.vertical, 0.4, 2)) controls.vertical = data.vertical
    controls.invert = data.invert === true
    if ([0,1,2].includes(data.dragButton)) controls.dragButton = data.dragButton
    for (const layout of ['phone','tablet'] as const) {
      controls[layout].leftHanded = data[layout]?.leftHanded === true
      for (const key of touchControls) {
        const pos = data[layout]?.positions?.[key]
        if (pos && finite(pos.x,0,1) && finite(pos.y,0,1) && finite(pos.size,0.65,1.5))
          controls[layout].positions[key] = { x:pos.x, y:pos.y, size:pos.size }
      }
    }
  } catch { /* Storage may be unavailable. */ }
  return controls
}
export function saveControls(storage: Pick<Storage,'setItem'>, controls: Controls) {
  try { storage.setItem(storageKey, JSON.stringify(controls)) } catch { /* Session settings still work. */ }
}
export function validCode(code: string) {
  return /^[A-Za-z][A-Za-z0-9]{0,30}$/.test(code) && !['Escape','Tab','Enter','Unidentified','MetaLeft','MetaRight','AltLeft','AltRight','ControlLeft','ControlRight'].includes(code)
}
export function bind(bindings: Bindings, action: Action, oldCode: string, code: string, resolve = false) {
  if (!validCode(code) || oldCode === 'Escape') return 'reserved'
  if (bindings[code] && bindings[code] !== action && !resolve) return 'conflict'
  if (bindings[oldCode] === action) delete bindings[oldCode]
  bindings[code] = action
  return 'saved'
}
export function bindingLabel(code: string) {
  return ({ Mouse0:'Left click', Mouse1:'Middle click', Mouse2:'Right click', Mouse3:'Mouse back', Mouse4:'Mouse forward' } as Record<string,string>)[code] ??
    code.replace(/^Key|^Digit/, '').replace(/(Left|Right)$/, ' $1').trim()
}
