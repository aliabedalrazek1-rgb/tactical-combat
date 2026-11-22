import * as T from 'three'
import type { Damageable } from './combat'
import type { Physics } from './physics'

export class PracticeTarget implements Damageable {
  readonly maxHealth = 100
  health = this.maxHealth
  private lastHealth = this.health
  private flash = 0
  readonly object = new T.Group()
  private readonly plate = new T.Group()
  private readonly face = new T.MeshStandardMaterial({ color: 0xdd694c, roughness: 0.72 })
  private readonly bar: T.Mesh

  constructor(x: number, z: number, physics: Physics, scene: T.Scene) {
    this.object.position.set(x, 0, z)
    scene.add(this.object)
    const dark = new T.MeshStandardMaterial({ color: 0x243740 })
    const mint = new T.MeshBasicMaterial({ color: 0xa6f5d5, side: T.DoubleSide })
    const stripe = new T.MeshBasicMaterial({ color: 0x492f2d, side: T.DoubleSide })
    function box(parent: T.Group, material: T.Material, w: number, h: number, d: number, y: number) {
      const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), material)
      mesh.position.y = y
      mesh.castShadow = true
      parent.add(mesh)
      return mesh
    }
    box(this.object, dark, 0.95, 0.11, 0.65, 0.055)
    box(this.object, dark, 0.12, 1.05, 0.12, 0.54)
    this.object.add(this.plate)
    this.plate.position.y = 0.85
    box(this.plate, this.face, 0.68, 0.79, 0.12, 0.43)
    box(this.plate, this.face, 0.34, 0.28, 0.12, 0.97)
    for (const [radius, material] of [[0.23, stripe], [0.14, this.face], [0.065, stripe]] as const) {
      const ring = new T.Mesh(new T.CircleGeometry(radius, 20), material)
      ring.position.set(0, 0.45, 0.063 + (0.23 - radius) * 0.02)
      this.plate.add(ring)
    }
    box(this.plate, dark, 0.72, 0.075, 0.06, 1.28)
    this.bar = box(this.plate, mint, 0.68, 0.035, 0.081, 1.28)
    physics.box(x, 1.28, z, 0.68, 0.79, 0.12, this)
    physics.box(x, 1.82, z, 0.34, 0.28, 0.12, this)
  }

  update(dt: number) {
    if (this.health < this.lastHealth) this.flash = 1
    this.lastHealth = this.health
    this.flash = Math.max(0, this.flash - dt * 5)
    this.face.emissive.setRGB(this.flash, this.flash * 0.27, this.flash * 0.05)
    const rotation = this.health === 0 ? -1.55 : -this.flash * 0.23
    this.plate.rotation.x = T.MathUtils.damp(this.plate.rotation.x, rotation, 13, dt)
    const scale = this.health / this.maxHealth
    this.bar.visible = scale > 0
    this.bar.scale.x = scale
    this.bar.position.x = (scale - 1) * 0.34
  }

  reset() {
    this.health = this.lastHealth = this.maxHealth
    this.flash = 0
    this.plate.rotation.x = 0
    this.update(0)
  }
}

type Box = [number, number, number, number, number, number]

export function buildArena(scene: T.Scene, physics: Physics) {
  const batches = new Map<number, Box[]>()
  function box(color: number, x: number, y: number, z: number, w: number, h: number, d: number, solid = false) {
    const batch = batches.get(color) ?? []
    if (!batches.has(color)) batches.set(color, batch)
    batch.push([x, y, z, w, h, d])
    if (solid) physics.box(x, y, z, w, h, d)
  }

  const asphalt = 0x41494b
  const slate = 0x35484d
  const dark = 0x24363a
  const concrete = 0x898d83
  const stripe = 0xd9aa57
  const green = 0x4b6b67
  const red = 0x9a503a
  box(asphalt, 0, -0.16, 0, 46, 0.32, 50, true)
  box(concrete, 0, 1.65, -24, 46, 3.3, 0.75, true)
  box(concrete, 0, 1.35, 24, 46, 2.7, 0.75, true)
  for (const side of [-1, 1]) {
    box(concrete, side * 22.5, 1.65, 0, 0.75, 3.3, 48, true)
    box(dark, side * 22.5, 3.38, 0, 0.96, 0.19, 48)
    box(concrete, side * 18.8, 0.1, 0, 3.2, 0.2, 45, true)
    box(stripe, side * 16.95, 0.009, 0, 0.12, 0.015, 45)
    for (let z = -20; z <= 20; z += 5) {
      box(slate, side * 22, 1.48, z, 0.45, 2.96, 0.45)
      box(green, side * 20.2, 2.7, z, 0.12, 0.45, 2.8)
    }
  }

  for (let x = -20; x <= 20; x += 4) {
    box(dark, x, 2.64, -23.55, 3.7, 0.13, 0.15)
    box(slate, x, 1.5, -23.55, 0.21, 3, 0.3)
  }
  for (let z = -20; z <= 20; z += 3.5) {
    box(0xb4ac90, 0, 0.012, z, 0.12, 0.016, 1.5)
  }
  for (let x = -12; x <= 12; x += 0.7) box(stripe, x, 0.014, 10, 0.37, 0.016, 0.18)

  function container(x: number, z: number, color: number) {
    box(color, x, 1.32, z, 5.6, 2.64, 2.55, true)
    for (let rib = -2.5; rib <= 2.5; rib += 0.33) {
      box(color, x + rib, 1.34, z + 1.3, 0.085, 2.32, 0.07)
      box(color, x + rib, 1.34, z - 1.3, 0.085, 2.32, 0.07)
    }
    for (const edge of [-1, 1]) {
      box(dark, x, 1.32 + edge * 1.24, z, 5.7, 0.12, 2.67)
      box(dark, x + edge * 2.8, 1.33, z, 0.13, 2.65, 2.68)
    }
  }
  container(-10, -4, green)
  container(10, -12, red)
  container(-14, 9, red)
  container(14, 6, green)

  for (const [x, z] of [[-4, 5], [5, 3], [0, -9], [-8, -14], [8, 13]]) {
    box(concrete, x, 0.47, z, 2.6, 0.94, 0.8, true)
    box(slate, x, 0.89, z, 2.74, 0.12, 0.85)
    for (let i = -1; i <= 1; i++) box(stripe, x + i * 0.72, 0.64, z + 0.411, 0.3, 0.12, 0.02)
  }

  for (const [x, z] of [[-6, 13], [11, -4], [-9, 3], [15, -17]]) {
    box(0x746753, x, 0.55, z, 1.15, 1.1, 1.15, true)
    for (const edge of [-0.47, 0.47]) box(0x9c8a6d, x + edge, 0.55, z + 0.585, 0.12, 1.1, 0.035)
    box(0x9c8a6d, x, 1.02, z + 0.585, 1.15, 0.12, 0.035)
  }

  for (let i = 0; i < 14; i++) {
    const x = (i - 6.5) * 5.2
    const height = 5 + ((i * 23) % 15)
    const z = -32 - (i % 3) * 3
    box(i % 2 ? slate : dark, x, (height - 1) / 2, z, 4.8, height, 5)
    for (let floor = 3; floor < height - 1; floor += 2.0) {
      for (const offset of [-1.45, 0, 1.45]) box(0x65848a, x + offset, floor, z + 2.51, 0.65, 0.44, 0.025)
    }
  }

  // One small repeatable texture adds surface detail without another network request.
  const surface = document.createElement('canvas')
  surface.width = surface.height = 128
  const paint = surface.getContext('2d')!
  const pixels = paint.createImageData(surface.width, surface.height)
  let seed = 14831
  for (let i = 0; i < pixels.data.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const value = 214 + (seed >>> 27)
    pixels.data.set([value, value, value, 255], i)
  }
  paint.putImageData(pixels, 0, 0)
  const grit = new T.CanvasTexture(surface)
  grit.wrapS = grit.wrapT = T.RepeatWrapping
  grit.repeat.set(14, 15)
  const geometry = new T.BoxGeometry()
  const dummy = new T.Object3D()
  for (const [color, boxes] of batches) {
    const mesh = new T.InstancedMesh(geometry, new T.MeshStandardMaterial({ color, roughness: 0.85, map: color === asphalt ? grit : null }), boxes.length)
    boxes.forEach(([x, y, z, w, h, d], index) => {
      dummy.position.set(x, y, z)
      dummy.scale.set(w, h, d)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
    })
    mesh.castShadow = color !== asphalt
    mesh.receiveShadow = true
    scene.add(mesh)
  }

  const sign = document.createElement('canvas')
  sign.width = 512
  sign.height = 112
  const ctx = sign.getContext('2d')!
  ctx.fillStyle = '#26383b'
  ctx.fillRect(0, 0, 512, 112)
  ctx.fillStyle = '#e0b574'
  ctx.font = 'bold 43px monospace'
  ctx.fillText('YARD 01', 24, 56)
  ctx.font = '19px monospace'
  ctx.fillText('TACTICAL TRAINING COMPLEX', 25, 88)
  const texture = new T.CanvasTexture(sign)
  texture.colorSpace = T.SRGBColorSpace
  const label = new T.Mesh(new T.PlaneGeometry(8, 1.75), new T.MeshBasicMaterial({ map: texture }))
  label.position.set(0, 2, -23.57)
  scene.add(label)

  const targets = [[0.76, 1], [-6, -1], [5.5, -4.5], [-4.5, -17], [3.9, -19]]
    .map(([x, z]) => new PracticeTarget(x, z, physics, scene))
  physics.world.step()
  return targets
}
