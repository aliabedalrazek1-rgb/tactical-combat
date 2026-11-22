export type PlayerState = 'idle' | 'walk' | 'run' | 'airborne'
export const spawn = { x: 0, y: 0.04, z: 14 }

export class Movement {
  state: PlayerState = 'airborne'
  grounded = false
  vertical = 0
  facing = 0

  step(axes: { x: number; y: number }, yaw: number, run: boolean, jump: boolean, aim: boolean, dt: number, faceCamera = aim) {
    if (jump && this.grounded) {
      this.vertical = 6.1
      this.grounded = false
    }
    this.vertical = Math.max(-20, this.vertical - 19 * dt)
    const moving = Math.hypot(axes.x, axes.y) > 0.01
    const running = run && !aim
    const speed = aim ? 2.45 : running ? 7.0 : 4.0
    const x = axes.x * Math.cos(yaw) - axes.y * Math.sin(yaw)
    const z = -axes.x * Math.sin(yaw) - axes.y * Math.cos(yaw)
    this.state = this.grounded ? moving ? running ? 'run' : 'walk' : 'idle' : 'airborne'
    if (faceCamera || moving) {
      const desired = faceCamera ? yaw : Math.atan2(-x, -z)
      const difference = desired - this.facing
      this.facing += Math.atan2(Math.sin(difference), Math.cos(difference)) * (1 - Math.exp(-16 * dt))
    }
    return { x: x * speed * dt, y: this.vertical * dt, z: z * speed * dt }
  }

  contacts(grounded: boolean, movedY: number, requestedY: number) {
    this.grounded = grounded
    if ((grounded && this.vertical < 0) || (this.vertical > 0 && movedY < requestedY - 0.001)) this.vertical = 0
  }
}
