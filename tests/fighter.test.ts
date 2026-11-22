import { expect, it } from 'vitest'
import { attacks, Fighter, contact } from '../src/fighter'
const origin = {position:{x:0,y:0,z:0},facing:0}
const front = {position:{x:0,y:0,z:-.9},facing:Math.PI}
function duel() {
  const a = new Fighter(), b = new Fighter()
  a.start('fire')
  const hit = () => contact(a, origin, b, front, () => true)
  return {a,b,hit}
}
it('requires active contact, hits once and locks incompatible actions through recovery', () => {
  const {a,b,hit} = duel()
  expect(hit()).toBeUndefined()
  a.tick(.11)
  expect(hit()).toBe('hit')
  expect(hit()).toBeUndefined()
  expect(b.health).toBe(90)
  a.tick(.13)
  expect(a.phase).toBe('recovery')
  expect(a.dodge(1,0)).toBe(false)
  expect(a.switchGear()).toBe(false)
  expect(b.start('heavy')).toBe(false)
  a.tick(.2)
  expect(a.start('heavy')).toBe(true)
})
it('rejects distant, elevated, rear and obstructed contacts and reports a miss once', () => {
  const {a,b} = duel()
  a.tick(.12)
  for (const position of [{x:1.6,y:0,z:-1},{x:0,y:1,z:-.9},{x:0,y:0,z:.7}]) {
    expect(contact(a,origin,b,{...front,position},()=>true)).toBeUndefined()
  }
  expect(contact(a,origin,b,front,()=>false)).toBeUndefined()
  expect(a.tick(.12)).toBe(true)
  expect(a.tick(.02)).toBe(false)
  expect(b.health).toBe(100)
})
it('parries from the front and opens a timed counter', () => {
  const {a,b,hit} = duel()
  b.guard(true,true)
  a.tick(.12)
  expect(hit()).toBe('parried')
  expect(a.phase).toBe('stagger')
  expect(b.start('fire')).toBe(true)
  expect(b.strike).toBe('counter')
  expect(b.counterTime).toBe(0)
})
it('tests guard direction, balance cost, guard break and timed evasion', () => {
  const {a,b,hit} = duel()
  a.tick(.12)
  b.guard(true,false)
  expect(hit()).toBe('blocked')
  expect(b.balance).toBeLessThan(100)
  a.contacted = false
  expect(contact(a,origin,b,{...front,facing:0},()=>true)).toBe('hit')
  b.tick(.5)
  b.guard(true,false)
  b.balance = 1
  a.contacted = false
  expect(hit()).toBe('guard break')
  b.tick(.7)
  b.dodge(1,1)
  b.tick(.1)
  a.contacted = false
  expect(hit()).toBe('evaded')
  expect(b.counterTime).toBeGreaterThan(0)
})
it('selects kicks by approach, distinguishes melee gear, and recovers exhausted stamina', () => {
  const f = new Fighter()
  f.start('kick',true,1.2)
  expect(f.strike).toBe('stepKick')
  f.tick(1)
  f.start('kick',false,1.2)
  expect(f.strike).toBe('kick')
  f.tick(1)
  f.equipment = 'knife'
  f.start('fire')
  expect(f.strike).toBe('cut')
  f.tick(1)
  f.equipment = 'baton'
  f.start('heavy')
  expect(f.strike).toBe('overhead')
  expect(attacks.overhead.reach).toBeGreaterThan(attacks.cut.reach)
  f.tick(1)
  f.stamina = 0
  expect(f.start('shove')).toBe(false)
  f.tick(1)
  expect(f.start('shove')).toBe(true)
})

