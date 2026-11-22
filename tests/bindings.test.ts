import { expect, it } from 'vitest'
import { bind, defaultControls, loadControls, saveControls } from '../src/bindings'
it('requires an explicit transfer and retains independent alternatives and escape', () => {
  const {bindings} = defaultControls()
  expect(bind(bindings, 'fire','KeyJ','KeyW')).toBe('conflict')
  expect(bindings.KeyW).toBe('forward')
  expect(bind(bindings, 'fire','KeyJ','KeyW',true)).toBe('saved')
  expect(bindings.KeyJ).toBeUndefined()
  expect(bindings.KeyW).toBe(bindings.Mouse0)
  expect(bind(bindings, 'aim','KeyK','Escape',true)).toBe('reserved')
  expect(bind(bindings, 'pause','Escape','KeyQ')).toBe('reserved')
  expect(defaultControls().bindings.KeyW).toBe('forward')
})
it('saves bindings, handedness and independent device placements and tolerates broken storage', () => {
  const controls = defaultControls()
  bind(controls.bindings,'aim','Mouse2','Mouse1')
  controls.phone = {leftHanded:true,positions:{fire:{x:0.1,y:0.7,size:1.2}}}
  let value = ''
  saveControls({setItem:(_,v) => {value=v}},controls)
  expect(loadControls({getItem:() => value})).toEqual(controls)
  expect(loadControls({getItem:() => 'null'})).toEqual(defaultControls())
})
