import { Vector3 } from 'three'

export type Point = { x: number; y: number; z: number }
export interface Damageable {
  health: number
  maxHealth: number
}

export function damage(target: Damageable, amount: number) {
  if (target.health <= 0 || !Number.isFinite(amount) || amount <= 0) return false
  target.health = Math.max(0, target.health - amount)
  return true
}

export interface CombatHit {
  distance: number
  target?: Damageable
}

export function resolveShot(hit: CombatHit | null, amount: number) {
  if (!hit) return 'miss'
  if (!hit.target || !damage(hit.target, amount)) return 'impact'
  return hit.target.health === 0 ? 'down' : 'hit'
}


type Raycast = (origin: Point, direction: Point, range: number) => CombatHit | null

export function traceShot(raycast: Raycast, view: Vector3, direction: Vector3, shoulder: Vector3, muzzle: Vector3, range: number) {
  const sight = raycast(view, direction, range)
  const endpoint = view.clone().addScaledVector(direction, sight?.distance ?? range)
  const trajectory = endpoint.sub(muzzle)

  // Check both the weapon pose and the projectile path against cover.
  const barrel = muzzle.clone().sub(shoulder)
  const clearance = barrel.length()
  if (clearance > 0.001) {
    barrel.divideScalar(clearance)
    const obstruction = raycast(shoulder, barrel, clearance)
    if (obstruction) return { start: shoulder, end: shoulder.clone().addScaledVector(barrel, obstruction.distance), hit: obstruction }
  }

  // A close sight hit can lie behind the muzzle of an offset shoulder camera.
  if (trajectory.dot(direction) <= 0.001) trajectory.copy(direction).multiplyScalar(range)
  const length = trajectory.length()
  if (length < 0.001) return { start: muzzle, end: muzzle, hit: null }
  trajectory.divideScalar(length)

  const hit = raycast(muzzle, trajectory, Math.min(range, length + 0.035))
  return { start: muzzle, end: muzzle.clone().addScaledVector(trajectory, hit?.distance ?? Math.min(range, length)), hit }
}
