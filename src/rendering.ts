import * as T from 'three'
import type { Settings } from './settings'

export class Rendering {
  readonly scene = new T.Scene()
  readonly camera = new T.PerspectiveCamera(59, 1, 0.08, 125)
  readonly renderer: T.WebGLRenderer
  readonly sun = new T.DirectionalLight(0xffdfb5, 2.35)

  constructor(readonly surface: HTMLElement) {
    this.renderer = new T.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' })
    this.renderer.toneMapping = T.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.15
    this.renderer.shadowMap.type = T.PCFShadowMap
    this.renderer.shadowMap.autoUpdate = false
    surface.append(this.renderer.domElement)
    this.scene.background = new T.Color(0x829ba5)
    this.scene.fog = new T.FogExp2(0x829ba5, 0.018)
    this.scene.add(new T.HemisphereLight(0xb9e5ff, 0x5b5046, 2.1), this.sun, this.sun.target)
    this.sun.position.set(-18, 27, 12)
    this.sun.target.position.set(0, 0, -5)
    Object.assign(this.sun.shadow.camera, { left: -26, right: 26, top: 28, bottom: -26, near: 0.5, far: 82 })
    this.sun.shadow.normalBias = 0.045
    this.sun.shadow.bias = -0.00025
    new ResizeObserver(() => this.resize()).observe(surface)
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.surface
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / Math.max(1, h)
    this.camera.updateProjectionMatrix()
  }

  quality(quality: Settings['quality']) {
    const cap = quality === 'high' ? 1.65 : quality === 'balanced' ? 1.1 : 0.85
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, cap))
    this.renderer.shadowMap.enabled = this.sun.castShadow = quality !== 'low'
    const size = quality === 'high' ? 1536 : 768
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size)
      this.sun.shadow.map?.dispose()
      this.sun.shadow.map = null
    }
    this.renderer.shadowMap.needsUpdate = true
    this.resize()
  }

  draw(shadows: boolean) {
    if (shadows && this.renderer.shadowMap.enabled) this.renderer.shadowMap.needsUpdate = true
    this.renderer.render(this.scene, this.camera)
  }
}
