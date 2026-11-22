import { damage, type Point } from './combat'

export type CloseWeapon = 'unarmed' | 'knife' | 'baton'
export type Strike = 'jab' | 'heavy' | 'kick' | 'stepKick' | 'shove' | 'counter' | 'cut' | 'lunge' | 'swing' | 'overhead'
type Attack = { label: string, startup: number, active: number, recovery: number,
  reach: number, arc: number, cost: number, damage: number, impact: number }
function attack(label:string, startup:number, active:number, recovery:number, reach:number, arc:number, cost:number, harm:number, impact:number): Attack {
  return { label, startup, active, recovery, reach, arc, cost, damage:harm, impact }
}
// Distances are between actor centers. Arc is the minimum forward dot product.
export const attacks: Record<Strike, Attack> = {
  jab: attack('Jab', .10,.10,.20, 1.02,.62, 7,10,12),
  heavy: attack('Heavy punch', .26,.12,.46, 1.10,.55, 17,20,26),
  kick: attack('Kick', .18,.12,.30, 1.25,.56, 13,16,18),
  stepKick: attack('Step kick', .24,.15,.40, 1.48,.76, 18,21,24),
  shove: attack('Shove', .15,.10,.37, .94,.65, 12,3,43),
  counter: attack('Counter', .06,.12,.24, 1.18,.52, 9,22,30),
  cut: attack('Training blade', .11,.13,.23, 1.18,.48, 8,15,9),
  lunge: attack('Blade thrust', .21,.11,.43, 1.39,.78, 15,23,17),
  swing: attack('Baton swing', .20,.16,.35, 1.51,.36, 13,17,27),
  overhead: attack('Baton overhead', .32,.15,.52, 1.57,.65, 22,25,35),
}
export type State = 'idle' | 'attack' | 'guard' | 'dodge' | 'stagger' | 'switch' | 'down'
export type Contact = 'hit' | 'blocked' | 'parried' | 'evaded' | 'guard break' | 'down'
export class Fighter {
  readonly maxHealth = 100
  health = 100
  stamina = 100
  balance = 100
  state: State = 'idle'
  strike: Strike = 'jab'
  equipment: CloseWeapon | 'firearm' = 'unarmed'
  elapsed = 0
  duration = 0
  counterTime = 0
  contacted = false
  guardStart = false
  dodgeX = 0
  dodgeY = -1
  private breath = 0

  get phase() {
    if (this.state !== 'attack') return this.state
    const spec = attacks[this.strike]
    if (this.elapsed < spec.startup) return 'startup'
    return this.elapsed < spec.startup + spec.active ? 'active' : 'recovery'
  }
  get parrying() { return this.state === 'guard' && this.guardStart && this.elapsed < .14 }
  get free() { return this.state === 'idle' || this.state === 'guard' }
  private enter(state: State, duration = Infinity) {
    this.state = state
    this.elapsed = 0
    this.duration = duration
    this.guardStart = false
  }
  private spend(cost: number) {
    if (this.stamina < cost) return false
    this.stamina -= cost
    this.breath = .42
    return true
  }
  tick(dt: number) {
    const wasAttacking = this.state === 'attack'
    if (this.health <= 0 && this.state !== 'down') this.enter('down')
    this.counterTime = Math.max(0, this.counterTime - dt)
    this.elapsed += dt
    this.breath = Math.max(0,this.breath-dt)
    const missed = wasAttacking && this.phase === 'recovery' && !this.contacted
    if (missed) this.contacted = true
    if (this.elapsed >= this.duration) this.enter('idle')
    if (this.free && this.breath === 0) {
      this.stamina = Math.min(100,this.stamina + dt * (this.state === 'guard' ? 8 : 19))
      this.balance = Math.min(100,this.balance + dt * 18)
    }
    return missed
  }
  guard(held: boolean, pressed: boolean) {
    if (this.equipment === 'firearm') return
    if (!held && this.state === 'guard') this.enter('idle')
    if (held && this.state === 'idle') {
      this.enter('guard')
      this.guardStart = pressed && this.spend(3)
    }
  }
  start(action: 'fire'|'heavy'|'kick'|'shove', advancing = false, distance = Infinity) {
    if (!this.free || this.equipment === 'firearm') return false
    let strike: Strike
    if (action === 'kick') strike = advancing && distance > .85 ? 'stepKick' : 'kick'
    else if (action === 'shove') strike = action
    else if (action === 'fire' && this.counterTime > 0) strike = 'counter'
    else if (this.equipment === 'knife') strike = action === 'heavy' ? 'lunge' : 'cut'
    else if (this.equipment === 'baton') strike = action === 'heavy' ? 'overhead' : 'swing'
    else strike = action === 'heavy' ? 'heavy' : 'jab'
    const spec = attacks[strike]
    if (!this.spend(spec.cost)) return false
    this.counterTime = 0
    this.strike = strike
    this.contacted = false
    this.enter('attack', spec.startup + spec.active + spec.recovery)
    return true
  }
  exert(dt:number) {
    this.stamina = Math.max(0,this.stamina-8*dt)
    this.breath = .42
  }
  dodge(x:number, y:number) {
    if (!this.free || !this.spend(19)) return false
    const len = Math.hypot(x,y)
    this.dodgeX = len > .1 ? x/len : 0
    this.dodgeY = len > .1 ? y/len : -1
    this.enter('dodge',.43)
    return true
  }
  switchGear() {
    if (!this.free) return false
    this.enter('switch',.32)
    this.counterTime = 0
    return true
  }
  stagger(duration:number) {
    if (this.health <= 0) this.enter('down')
    else this.enter('stagger',duration)
    this.breath = .55
  }
}
export type Pose = { position: Point, facing: number }

function forwardDot(facing:number, dx:number, dz:number, distance:number) {
  return distance > .001 ? (-Math.sin(facing)*dx - Math.cos(facing)*dz)/distance : 1
}
export function contact(attacker:Fighter, from:Pose, target:Fighter, to:Pose, clear: () => boolean): Contact | undefined {
  if (attacker.phase !== 'active' || attacker.contacted || target.health <= 0) return
  const spec = attacks[attacker.strike]
  const dx = to.position.x - from.position.x
  const dz = to.position.z - from.position.z
  const distance = Math.hypot(dx,dz)
  if (distance > spec.reach || Math.abs(to.position.y-from.position.y) > .72 ||
    forwardDot(from.facing,dx,dz,distance) < spec.arc || !clear()) return

  attacker.contacted = true
  if (target.state === 'dodge' && target.elapsed >= .04 && target.elapsed < .23) {
    target.counterTime = .7
    return 'evaded'
  }
  const guarded = target.state === 'guard' && forwardDot(to.facing,-dx,-dz,distance) >= .35
  if (guarded && target.parrying && attacker.strike !== 'shove') {
    attacker.stagger(.55)
    target.counterTime = .62
    return 'parried'
  }
  if (guarded) {
    const cost = spec.impact * (target.equipment === 'baton' ? .45 : .8)
    target.balance = Math.max(0,target.balance-cost)
    target.stamina = Math.max(0,target.stamina-cost*.45)
    if (target.balance > 0 && target.stamina > 0) return 'blocked'
  }
  damage(target, spec.damage)
  target.balance = Math.max(0,target.balance-spec.impact)
  const broken = target.balance === 0 || guarded
  target.stagger(broken ? .65 : .17 + spec.impact * .003)
  if (broken) target.balance = 30
  return target.health <= 0 ? 'down' : broken ? 'guard break' : 'hit'
}
