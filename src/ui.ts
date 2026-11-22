import type { Settings } from './settings'
import type { Damageable } from './combat'
import type { Weapon } from './weapon'

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
  private noticeUntil = 0
  private hitUntil = 0

  constructor(settings: Settings, onSettings: (key: keyof Settings) => void) {
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

  notify(message: string, now: number, hit = false, duration = 0.85) {
    this.feedback.textContent = message
    this.noticeUntil = now + duration
    if (hit) this.hitUntil = now + 0.16
  }

  reset() {
    this.feedback.textContent = ''
    this.noticeUntil = this.hitUntil = 0
  }

  update(weapon: Weapon, player: Damageable, down: number, total: number, aiming: boolean, now: number) {
    this.text(this.weapon, weapon.spec.name.toUpperCase())
    this.text(this.ammo, String(weapon.ammo))
    this.text(this.reserve, `/ ${weapon.reserve}`)
    this.text(this.score, `${down} / ${total}`)
    this.text(this.health, String(player.health))
    this.healthBar.max = player.maxHealth
    this.healthBar.value = player.health
    this.text(this.reloadState, weapon.reloading ? 'RELOADING…' : weapon.ammo === 0 ? 'EMPTY · RELOAD' : '')
    this.crosshair.classList.toggle('aim', aiming)
    this.crosshair.classList.toggle('hit', now < this.hitUntil)
    if (now >= this.noticeUntil) this.text(this.feedback, '')
  }

  private text(node: HTMLElement, value: string) {
    if (node.textContent !== value) node.textContent = value
  }
}
