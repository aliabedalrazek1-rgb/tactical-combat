export const defaults = {
  lookSensitivity: 1,
  touchSensitivity: 1,
  buttonSize: 1,
  quality: 'balanced' as 'low' | 'balanced' | 'high',
}
export type Settings = typeof defaults
const key = 'tactical-combat.settings.v1'

export function loadSettings(storage: Pick<Storage, 'getItem'>): Settings {
  try {
    const data = JSON.parse(storage.getItem(key) ?? '{}') ?? {}
    function number(field: 'lookSensitivity' | 'touchSensitivity' | 'buttonSize', min: number, max: number) {
      const value = data[field]
      return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : defaults[field]
    }
    return {
      lookSensitivity: number('lookSensitivity', 0.4, 2),
      touchSensitivity: number('touchSensitivity', 0.4, 2),
      buttonSize: number('buttonSize', 0.8, 1.3),
      quality: ['low', 'balanced', 'high'].includes(data.quality) ? data.quality : defaults.quality,
    }
  } catch {
    return { ...defaults }
  }
}

export function saveSettings(storage: Pick<Storage, 'setItem'>, settings: Settings) {
  try {
    storage.setItem(key, JSON.stringify(settings))
  } catch {
    // Private browsing and storage policies can disable persistence.
  }
}
