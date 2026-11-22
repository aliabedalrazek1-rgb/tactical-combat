import type { Settings } from './settings'
import { attacks, type Fighter } from './fighter'
import { firearms, type Loadout } from './weapon'

export function element<T extends HTMLElement = HTMLElement>(id: string) {
  return document.getElementById(id) as T
}

export class HUD {
  readonly menu = element<HTMLDialogElement>('menu')
  private readonly crosshair = element('crosshair')
  private readonly feedback = element('feedback')
  private readonly score = element('score')
  private readonly health = element('health')
  private readonly healthBar = element<HTMLMeterElement>('health-bar')
  private readonly ammo = element('ammo')
  private readonly reserve = element('reserve')
  private readonly weapon = element('weapon')
  private readonly reloadState = element('reload-state')
  private readonly stamina = element<HTMLMeterElement>('stamina')
  private readonly mode = element('mode')
  private readonly partner = element('partner')
  private readonly partnerState = element('partner-state')
  private readonly partnerHealth = element<HTMLMeterElement>('partner-health')
  private readonly gear = element<HTMLSelectElement>('loadout')
  private previousItem = ''
  private noticeUntil = 0
  private hitUntil = 0

  constructor(settings: Settings, onSettings: (key: keyof Settings) => void) {
    const group = (name:string) => {
      const opt = document.createElement('optgroup')
      opt.label = name
      this.gear.append(opt)
      return opt
    }
    const close = group('Close combat')
    for (const item of ['Unarmed','Knife','Baton']) close.append(new Option(item,item.toLowerCase()))
    for (const family of ['pistol','carbine','smg','shotgun','precision']) {
      const section = group(family.toUpperCase())
      for (const spec of firearms.filter(s=>s.family===family)) section.append(new Option(spec.name,spec.id))
    }
    this.gear.value = 'p9'
    this.gear.addEventListener('change', () => this.describe())
    this.describe()
    for (const key of ['lookSensitivity', 'touchSensitivity', 'buttonSize'] as const) {
      const control = element<HTMLInputElement>(key)
      control.value = String(settings[key])
      control.addEventListener('input', () => {
        settings[key] = control.valueAsNumber
        onSettings(key)
      })
    }
    const quality = element<HTMLSelectElement>('quality')
    quality.value = settings.quality
    quality.addEventListener('change', () => {
      settings.quality = quality.value as Settings['quality']
      onSettings('quality')
    })
  }

  private describe() {
    const spec = firearms.find(s=>s.id===this.gear.value)
    element('gear-details').textContent = spec ? [spec.mode.toUpperCase(), spec.capacity + ' rounds',
      spec.pellets > 1 ? spec.pellets + ' pellets × ' + spec.damage : spec.damage + ' damage',
      spec.reloadTime + 's reload'].join(' · ') : 'Strike or hold guard. Tap guard just before contact, then strike to counter.'
  }

  showPartner(actor:Fighter, nearby:boolean) {
    this.partner.hidden = !nearby
    if (!nearby) return
    const state = actor.state === 'attack' ? (actor.phase === 'startup' ? 'Preparing ' : '') + attacks[actor.strike].label :
      actor.state === 'idle' ? 'Ready' : actor.state
    this.text(this.partnerState,state)
    this.partnerHealth.value = actor.health
  }

  notify(message: string, now: number, hit = false, duration = 0.85) {
    this.feedback.textContent = message
    this.noticeUntil = now + duration
    if (hit) this.hitUntil = now + 0.16
  }

  reset() {
    this.feedback.textContent = ''
    this.noticeUntil = this.hitUntil = 0
  }

  update(loadout: Loadout, player: Fighter, down: number, total: number, aiming: boolean, now: number) {
    const weapon = loadout.weapon
    if (this.previousItem !== loadout.equipped) {
      this.previousItem = loadout.equipped
      this.gear.value = loadout.equipped
      this.describe()
      this.text(this.weapon,(weapon?.spec.name ?? loadout.equipped).toUpperCase())
      this.text(this.mode,weapon ? weapon.spec.family : 'Close combat')
      for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action]')) {
        const action = button.dataset.action!
        button.hidden = action === 'reload' ? !weapon : Boolean(weapon && ['heavy','kick','shove'].includes(action))
        if (action === 'aim') button.textContent = weapon ? 'Aim' : 'Guard'
        if (action === 'fire') button.textContent = weapon ? 'Fire' : 'Strike'
        if (action === 'holster') button.textContent = loadout.equipped === 'unarmed' ? 'Draw' : 'Holster'
      }
    }
    this.text(this.ammo,weapon ? String(weapon.ammo) : player.counterTime > 0 ? 'Counter' : player.state === 'guard' ? 'Guard' : 'Melee')
    this.text(this.reserve,weapon ? `/ ${weapon.reserve}` : '')
    this.stamina.value = player.stamina
    this.text(this.score, `${down} / ${total}`)
    this.text(this.health, String(player.health))
    this.healthBar.max = player.maxHealth
    this.healthBar.value = player.health
    this.text(this.reloadState, weapon?.reloading ? 'RELOADING…' : player.parrying ? 'PARRY' :
      player.state === 'attack' ? attacks[player.strike].label.toUpperCase() : player.state !== 'idle' ? player.state.toUpperCase() :
      weapon?.ammo === 0 ? 'EMPTY · RELOAD' : '')
    this.crosshair.classList.toggle('aim', aiming)
    this.crosshair.classList.toggle('hit', now < this.hitUntil)
    if (now >= this.noticeUntil) this.text(this.feedback, '')
  }

  private text(node: HTMLElement, value: string) {
    if (node.textContent !== value) node.textContent = value
  }
}
