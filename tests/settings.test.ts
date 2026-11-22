import { describe, expect, it } from 'vitest'
import { defaults, loadSettings, saveSettings } from '../src/settings'

describe('settings persistence', () => {
  it('round-trips graphics and all sensitivity and size preferences', () => {
    const values = new Map<string, string>()
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: values.set.bind(values) }
    const settings = { quality: 'high' as const, lookSensitivity: 1.8, touchSensitivity: 0.7, buttonSize: 1.25 }
    saveSettings(storage, settings)
    expect(loadSettings(storage)).toEqual(settings)
  })

  it('clamps unsupported values and defaults missing or invalid fields', () => {
    expect(loadSettings({ getItem: () => '{"lookSensitivity":7,"buttonSize":0.2,"quality":"invalid"}' }))
      .toEqual({ ...defaults, lookSensitivity: 2, buttonSize: 0.8 })
    expect(loadSettings({ getItem: () => 'invalid' })).toEqual(defaults)
    expect(loadSettings({ getItem: () => 'null' })).toEqual(defaults)
  })

  it('continues with defaults when storage is blocked', () => {
    const fail = () => { throw new Error('blocked') }
    expect(loadSettings({ getItem: fail })).toEqual(defaults)
    expect(() => saveSettings({ setItem: fail }, defaults)).not.toThrow()
  })
})
