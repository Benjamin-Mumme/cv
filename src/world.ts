import * as THREE from 'three'
import { CELL, GRID, STEP, stratumAt, worldXZ } from './economy'
import { sackCap, surfaceBlock, type GameState } from './state'
import type { DroneBody } from './drones'

const COUNT = GRID * GRID

export class World {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  readonly raycaster = new THREE.Raycaster()
  lookBias = 0
  shake = 0
  hover: number | null = null

  private readonly cols: THREE.InstancedMesh
  private readonly gems: THREE.InstancedMesh
  private readonly dummy = new THREE.Object3D()
  private readonly color = new THREE.Color()
  private readonly highlight: THREE.Mesh
  private readonly refinery: THREE.Group
  private readonly bin: THREE.Mesh
  private readonly walls: THREE.Mesh[] = []
  private wallRows = 0
  private readonly digLight: THREE.PointLight
  private readonly drones: THREE.Group[] = []
  private readonly beams: THREE.Mesh[] = []
  private readonly rig: THREE.Group
  private readonly rigMast: THREE.Mesh
  private readonly rigBit: THREE.Mesh
  private readonly sparks: Sparks
  private readonly nuggets: Nugget[] = []
  private time = 0
  private focusDepth = 0

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05

    this.scene.background = new THREE.Color(0x07060b)
    this.scene.fog = new THREE.Fog(0x07060b, 36, 110)

    this.camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 200)
    this.camera.position.set(12, 13, 14)

    const hemi = new THREE.HemisphereLight(0xc5d4ee, 0x6a5344, 1.15)
    const moon = new THREE.DirectionalLight(0xf2f4ff, 1.85)
    moon.position.set(14, 22, 8)
    this.scene.add(hemi, moon)

    const fill = new THREE.PointLight(0xffb15e, 14, 16)
    fill.position.set(0, 3.2, -8.4)
    this.digLight = new THREE.PointLight(0xffe2b0, 6, 9)
    this.scene.add(fill, this.digLight)

    this.cols = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.98, 1, 0.98),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.94, metalness: 0.05, flatShading: true }),
      COUNT,
    )
    this.gems = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.28, 0),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 1.35,
        roughness: 0.35,
        metalness: 0.15,
        flatShading: true,
      }),
      COUNT,
    )
    this.cols.userData.kind = 'column'
    this.gems.userData.kind = 'column'
    this.cols.frustumCulled = false
    this.gems.frustumCulled = false
    this.gems.raycast = () => {}
    this.scene.add(this.cols, this.gems)

    this.highlight = new THREE.Mesh(
      new THREE.BoxGeometry(1.02, 0.08, 1.02),
      new THREE.MeshBasicMaterial({ color: 0xffb15e, transparent: true, opacity: 0.85 }),
    )
    this.highlight.visible = false
    this.highlight.raycast = () => {}
    this.scene.add(this.highlight)

    this.buildTerrain()
    this.refinery = this.buildRefinery()
    this.bin = this.buildBin()
    this.buildWalls()
    this.buildSky()
    this.buildDrones()
    this.rig = new THREE.Group()
    this.rigMast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.12, 1, 6),
      new THREE.MeshStandardMaterial({
        color: 0xffb15e,
        emissive: 0xc45a12,
        emissiveIntensity: 0.35,
        metalness: 0.55,
        roughness: 0.35,
      }),
    )
    this.rigBit = new THREE.Mesh(
      new THREE.ConeGeometry(0.32, 0.6, 6),
      new THREE.MeshStandardMaterial({
        color: 0xffe0b0,
        emissive: 0xff6a1a,
        emissiveIntensity: 0.9,
        metalness: 0.4,
        roughness: 0.3,
      }),
    )
    this.rig.add(this.rigMast, this.rigBit)
    this.rig.visible = false
    this.scene.add(this.rig)

    this.sparks = new Sparks()
    this.scene.add(this.sparks.points)
    for (let i = 0; i < 20; i++) {
      const mesh = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.09, 0),
        new THREE.MeshStandardMaterial({ color: 0xffb15e, roughness: 0.5, metalness: 0.2, flatShading: true }),
      )
      mesh.visible = false
      this.scene.add(mesh)
      this.nuggets.push({ mesh, t: 0, dur: 0.6, from: new THREE.Vector3(), to: new THREE.Vector3(), active: false })
    }
  }

  resize(): void {
    const w = window.innerWidth
    const h = window.innerHeight
    this.camera.aspect = w / Math.max(1, h)
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  pick(clientX: number, clientY: number): { kind: 'column'; index: number } | { kind: 'refinery' } | null {
    const rect = this.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(ndc, this.camera)
    const hits = this.raycaster.intersectObjects([this.cols, this.gems, this.refinery], true)
    for (const hit of hits) {
      const kind = userKind(hit.object)
      if (kind === 'column' && hit.instanceId != null) return { kind: 'column', index: hit.instanceId }
      if (kind === 'refinery') return { kind: 'refinery' }
    }
    return null
  }

  columnTop(index: number, depth: number): { x: number; y: number; z: number } {
    const { x, z } = worldXZ(index)
    return { x, y: -depth * STEP, z }
  }

  burst(x: number, y: number, z: number, color: string, count = 10): void {
    this.sparks.burst(x, y, z, color, count)
  }

  fling(from: { x: number; y: number; z: number }, color: string): void {
    const nugget = this.nuggets.find((n) => !n.active)
    if (!nugget) return
    nugget.active = true
    nugget.t = 0
    nugget.dur = 0.45 + Math.random() * 0.25
    nugget.from.set(from.x, from.y, from.z)
    const shed = this.shedPoint()
    nugget.to.set(shed.x, shed.y + 0.8, shed.z)
    const mat = nugget.mesh.material as THREE.MeshStandardMaterial
    mat.color.set(color)
    mat.emissive.set(color)
    mat.emissiveIntensity = 0.25
    nugget.mesh.visible = true
  }

  sync(state: GameState, drones: DroneBody[]): void {
    const bottom = -(Math.max(state.stats.bestDepth, 0) + 4) * STEP
    let depthSum = 0
    for (let i = 0; i < COUNT; i++) {
      const depth = state.depths[i]
      depthSum += depth
      const block = surfaceBlock(state, i)
      const { x, z } = worldXZ(i)
      const top = -depth * STEP
      const h = Math.max(0.25, top - bottom)
      this.dummy.position.set(x, (top + bottom) / 2, z)
      this.dummy.rotation.set(0, 0, 0)
      this.dummy.scale.set(1, h, 1)
      this.dummy.updateMatrix()
      this.cols.setMatrixAt(i, this.dummy.matrix)
      const crack = block.hp > 0 ? THREE.MathUtils.clamp(state.crack[i] / block.hp, 0, 1) : 0
      const jitter = 0.86 + ((i * 17) % 9) / 28
      this.color.set(block.color).multiplyScalar(jitter * (1 - crack * 0.62))
      this.cols.setColorAt(i, this.color)

      this.dummy.rotation.y = this.time * 0.8 + i
      if (block.rare) {
        this.dummy.position.set(x, top + 0.26, z)
        this.dummy.scale.setScalar(1)
        this.color.set(block.emissive ?? block.color)
      } else {
        this.dummy.position.set(0, -50, 0)
        this.dummy.scale.setScalar(0)
      }
      this.dummy.updateMatrix()
      this.gems.setMatrixAt(i, this.dummy.matrix)
      if (block.rare) this.gems.setColorAt(i, this.color)
    }
    this.cols.instanceMatrix.needsUpdate = true
    if (this.cols.instanceColor) this.cols.instanceColor.needsUpdate = true
    this.gems.instanceMatrix.needsUpdate = true
    if (this.gems.instanceColor) this.gems.instanceColor.needsUpdate = true

    const average = depthSum / COUNT
    const wanted = this.hover != null ? state.depths[this.hover] * 0.85 : average
    this.focusDepth += (wanted - this.focusDepth) * 0.08
    this.layoutWalls(state.stats.bestDepth)
    const fill = sackCap(state) > 0 ? state.sackUnits / sackCap(state) : 0
    this.bin.scale.y = 0.2 + 1.3 * THREE.MathUtils.clamp(fill, 0, 1)
    this.bin.position.y = 0.35 + this.bin.scale.y * 0.35

    const crew = state.levels.drones
    for (let i = 0; i < this.drones.length; i++) {
      const body = drones[i]
      const group = this.drones[i]
      group.visible = i < crew
      if (!group.visible || !body) continue
      group.position.set(body.x, body.y + Math.sin(this.time * 6 + i) * 0.06, body.z)
      this.beams[i].visible = body.digging
      this.beams[i].scale.y = body.digging ? 1 : 0.01
    }

    const rigOn = state.rigColumn != null && state.levels.rig > 0
    this.rig.visible = rigOn
    if (rigOn && state.rigColumn != null) {
      const top = this.columnTop(state.rigColumn, state.depths[state.rigColumn])
      const height = Math.max(2.6, -top.y + 1.6)
      this.rig.position.set(top.x, top.y, top.z)
      this.rigMast.scale.y = height
      this.rigMast.position.y = height / 2
      this.rigBit.position.y = 0.45
      this.rigBit.rotation.y = this.time * 8
    }

    if (this.hover != null) {
      const top = this.columnTop(this.hover, state.depths[this.hover])
      this.highlight.visible = true
      this.highlight.position.set(top.x, top.y + 0.04, top.z)
      this.digLight.position.set(top.x, top.y + 1.6, top.z)
      this.digLight.intensity = 7
    } else {
      this.highlight.visible = false
      this.digLight.intensity = 1.5
    }
  }

  update(dt: number): void {
    this.time += dt
    this.shake *= Math.max(0, 1 - dt * 3.2)
    const lookY = -this.focusDepth * STEP + this.lookBias
    const dist = 16 + Math.min(14, this.focusDepth * 0.05)
    const jx = (Math.random() - 0.5) * this.shake
    const jy = (Math.random() - 0.5) * this.shake
    const desired = new THREE.Vector3(dist * 0.62 + jx, lookY + dist * 0.42 + jy, dist * 0.95)
    const blend = 1 - Math.pow(0.012, dt)
    this.camera.position.lerp(desired, blend)
    this.camera.lookAt(jx * 0.25, lookY + 1.2, -1.5)
    this.sparks.update(dt)
    this.updateNuggets(dt)
  }

  render(): void {
    this.renderer.render(this.scene, this.camera)
  }

  project(x: number, y: number, z: number): { x: number; y: number; behind: boolean } {
    const v = new THREE.Vector3(x, y, z).project(this.camera)
    const w = this.renderer.domElement.clientWidth
    const h = this.renderer.domElement.clientHeight
    return {
      x: (v.x * 0.5 + 0.5) * w,
      y: (-v.y * 0.5 + 0.5) * h,
      behind: v.z > 1,
    }
  }

  private updateNuggets(dt: number): void {
    for (const nugget of this.nuggets) {
      if (!nugget.active) continue
      nugget.t += dt
      const u = Math.min(1, nugget.t / nugget.dur)
      nugget.mesh.position.lerpVectors(nugget.from, nugget.to, u)
      nugget.mesh.position.y += Math.sin(u * Math.PI) * 1.3
      nugget.mesh.rotation.y += dt * 6
      if (u >= 1) {
        nugget.active = false
        nugget.mesh.visible = false
      }
    }
  }

  private layoutWalls(bestDepth: number): void {
    const rows = Math.max(40, bestDepth + 12)
    if (rows !== this.wallRows) {
      this.wallRows = rows
      const tex = strataTexture(rows)
      for (const wall of this.walls) {
        const mat = wall.material as THREE.MeshStandardMaterial
        mat.map?.dispose()
        mat.map = tex
        mat.needsUpdate = true
      }
    }
    const half = (GRID * CELL) / 2
    const height = this.wallRows * STEP
    const top = 0.35
    const positions: [number, number, number, number][] = [
      [0, top - height / 2, -half, 0],
      [0, top - height / 2, half, Math.PI],
      [-half, top - height / 2, 0, Math.PI / 2],
      [half, top - height / 2, 0, -Math.PI / 2],
    ]
    this.walls.forEach((wall, i) => {
      wall.scale.set(1, height, 1)
      wall.position.set(positions[i][0], positions[i][1], positions[i][2])
    })
  }

  private buildWalls(): void {
    const half = (GRID * CELL) / 2
    const geo = new THREE.PlaneGeometry(GRID * CELL, 1)
    const yaws = [0, Math.PI, Math.PI / 2, -Math.PI / 2]
    for (const yaw of yaws) {
      const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 })
      const wall = new THREE.Mesh(geo, mat)
      wall.rotation.y = yaw
      wall.position.set(yaw === 0 ? 0 : Math.sin(yaw) * half, 0, yaw === 0 ? -half : Math.cos(yaw) * half)
      wall.raycast = () => {}
      this.walls.push(wall)
      this.scene.add(wall)
    }
    this.layoutWalls(0)
  }

  private buildTerrain(): void {
    const half = (GRID * CELL) / 2
    const reach = 28
    const mat = new THREE.MeshStandardMaterial({
      color: 0xb7a898,
      roughness: 1,
      metalness: 0,
      map: dustTexture(),
    })
    const specs = [
      { x: 0, z: half + reach / 2, w: reach * 2 + GRID, d: reach },
      { x: 0, z: -(half + reach / 2), w: reach * 2 + GRID, d: reach },
      { x: half + reach / 2, z: 0, w: reach, d: GRID },
      { x: -(half + reach / 2), z: 0, w: reach, d: GRID },
    ]
    for (const spec of specs) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(spec.w, 0.5, spec.d), mat)
      mesh.position.set(spec.x, 0.1, spec.z)
      mesh.raycast = () => {}
      this.scene.add(mesh)
    }
    const lipMat = new THREE.MeshStandardMaterial({ color: 0xddd2c6, roughness: 0.85, metalness: 0.02 })
    const lipGeo = new THREE.BoxGeometry(GRID + 0.6, 0.18, 0.35)
    for (const side of [1, -1]) {
      const a = new THREE.Mesh(lipGeo, lipMat)
      a.position.set(0, 0.42, side * (half + 0.12))
      a.raycast = () => {}
      const b = new THREE.Mesh(lipGeo, lipMat)
      b.rotation.y = Math.PI / 2
      b.position.set(side * (half + 0.12), 0.42, 0)
      b.raycast = () => {}
      this.scene.add(a, b)
    }
  }

  private buildRefinery(): THREE.Group {
    const group = new THREE.Group()
    group.userData.kind = 'refinery'
    const metal = new THREE.MeshStandardMaterial({ color: 0x8d7b6a, roughness: 0.62, metalness: 0.28 })
    const glow = new THREE.MeshStandardMaterial({
      color: 0xffb15e,
      emissive: 0xff8a2a,
      emissiveIntensity: 0.85,
      roughness: 0.4,
    })
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.5, 1.7), metal)
    body.position.y = 0.75
    body.userData.kind = 'refinery'
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.85, 0.7, 4), metal)
    roof.position.y = 1.8
    roof.rotation.y = Math.PI / 4
    roof.userData.kind = 'refinery'
    const hopper = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.46, 0.55, 6), glow)
    hopper.position.set(-1.15, 0.55, 0)
    hopper.userData.kind = 'refinery'
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.9, 6), metal)
    stack.position.set(0.7, 2.1, 0)
    stack.userData.kind = 'refinery'
    group.add(body, roof, hopper, stack)
    group.position.set(0.2, 0.35, -8.55)
    const label = refineryLabel()
    label.position.set(0, 2.35, 0)
    group.add(label)
    this.scene.add(group)

    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.12, 2.4),
      new THREE.MeshStandardMaterial({ color: 0x3a342e, metalness: 0.35, roughness: 0.55 }),
    )
    belt.position.set(0.2, 0.48, -7.1)
    belt.raycast = () => {}
    this.scene.add(belt)
    return group
  }

  shedPoint(): { x: number; y: number; z: number } {
    return { x: this.refinery.position.x, y: this.refinery.position.y, z: this.refinery.position.z }
  }

  private buildBin(): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.7, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x8a5a32, roughness: 0.8, metalness: 0.05 }),
    )
    mesh.position.set(1.3, 0.7, -7.6)
    mesh.raycast = () => {}
    this.scene.add(mesh)
    return mesh
  }

  private buildDrones(): void {
    for (let i = 0; i < 8; i++) {
      const group = new THREE.Group()
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.24, 0.55),
        new THREE.MeshStandardMaterial({
          color: 0xff9a3c,
          emissive: 0xff6a1a,
          emissiveIntensity: 0.45,
          metalness: 0.35,
          roughness: 0.4,
        }),
      )
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 10, 10),
        new THREE.MeshStandardMaterial({
          color: 0xfff1c4,
          emissive: 0xffd27a,
          emissiveIntensity: 1.6,
        }),
      )
      lamp.position.y = 0.18
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.1, 2.1, 5),
        new THREE.MeshBasicMaterial({ color: 0xffb15e, transparent: true, opacity: 0.45 }),
      )
      beam.position.y = -1.05
      beam.visible = false
      group.add(body, lamp, beam)
      group.scale.setScalar(1.7)
      group.visible = false
      this.scene.add(group)
      this.drones.push(group)
      this.beams.push(beam)
    }
  }

  private buildSky(): void {
    const starPositions = new Float32Array(420 * 3)
    for (let i = 0; i < 420; i++) {
      const r = 70 + Math.random() * 30
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(Math.random())
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      starPositions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 8
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
    const stars = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xfff6e8, size: 1.7, sizeAttenuation: false }),
    )
    stars.raycast = () => {}
    this.scene.add(stars)

    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(4.2, 32, 20),
      new THREE.MeshStandardMaterial({ map: earthTexture(), roughness: 1, metalness: 0 }),
    )
    earth.position.set(-14, 8.5, -24)
    earth.raycast = () => {}
    this.scene.add(earth)
  }
}

function userKind(obj: THREE.Object3D): string | null {
  let cur: THREE.Object3D | null = obj
  while (cur) {
    if (typeof cur.userData.kind === 'string') return cur.userData.kind
    cur = cur.parent
  }
  return null
}

function strataTexture(rows: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 8
  canvas.height = rows
  const g = canvas.getContext('2d')
  if (!g) return new THREE.CanvasTexture(canvas)
  for (let d = 0; d < rows; d++) {
    g.fillStyle = stratumAt(d).color
    g.fillRect(0, d, 8, 1)
    g.fillStyle = 'rgba(0,0,0,0.15)'
    if (d % 3 === 0) g.fillRect(0, d, 8, 1)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  return tex
}

function dustTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const g = canvas.getContext('2d')
  if (!g) return new THREE.CanvasTexture(canvas)
  g.fillStyle = '#c3b3a2'
  g.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 400; i++) {
    const shade = 150 + Math.floor(Math.random() * 70)
    g.fillStyle = `rgb(${shade},${shade - 18},${shade - 32})`
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(4, 4)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function refineryLabel(): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const g = canvas.getContext('2d')
  if (g) {
    g.fillStyle = 'rgba(20, 14, 10, 0.8)'
    g.fillRect(8, 8, 240, 48)
    g.strokeStyle = '#ffb15e'
    g.strokeRect(8, 8, 240, 48)
    g.fillStyle = '#ffe0b5'
    g.font = '600 28px sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('REFINERY', 128, 32)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }))
  sprite.scale.set(2.4, 0.6, 1)
  sprite.raycast = () => {}
  return sprite
}

function earthTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 160
  canvas.height = 80
  const g = canvas.getContext('2d')
  if (!g) return new THREE.CanvasTexture(canvas)
  g.fillStyle = '#1c4f86'
  g.fillRect(0, 0, 160, 80)
  g.fillStyle = '#2f8a4a'
  const blobs = [
    [30, 28, 22, 12],
    [70, 36, 28, 14],
    [110, 30, 18, 10],
    [48, 48, 16, 8],
    [96, 50, 20, 9],
  ]
  for (const [x, y, rx, ry] of blobs) {
    g.beginPath()
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
    g.fill()
  }
  g.fillStyle = '#e7eef5'
  g.fillRect(0, 0, 160, 6)
  g.fillRect(0, 74, 160, 6)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

class Sparks {
  readonly points: THREE.Points
  private readonly positions: Float32Array
  private readonly colors: Float32Array
  private readonly velocity: Float32Array
  private readonly life: Float32Array
  private readonly n = 280

  constructor() {
    this.positions = new Float32Array(this.n * 3)
    this.colors = new Float32Array(this.n * 3)
    this.velocity = new Float32Array(this.n * 3)
    this.life = new Float32Array(this.n)
    for (let i = 0; i < this.n; i++) this.positions[i * 3 + 1] = -200
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))
    this.points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, depthWrite: false }),
    )
    this.points.raycast = () => {}
  }

  burst(x: number, y: number, z: number, color: string, count: number): void {
    const tint = new THREE.Color(color)
    let left = count
    for (let i = 0; i < this.n && left > 0; i++) {
      if (this.life[i] > 0) continue
      this.life[i] = 0.45 + Math.random() * 0.45
      this.positions[i * 3] = x + (Math.random() - 0.5) * 0.3
      this.positions[i * 3 + 1] = y
      this.positions[i * 3 + 2] = z + (Math.random() - 0.5) * 0.3
      this.velocity[i * 3] = (Math.random() - 0.5) * 2.4
      this.velocity[i * 3 + 1] = 1.4 + Math.random() * 2.2
      this.velocity[i * 3 + 2] = (Math.random() - 0.5) * 2.4
      this.colors[i * 3] = tint.r
      this.colors[i * 3 + 1] = tint.g
      this.colors[i * 3 + 2] = tint.b
      left--
    }
  }

  update(dt: number): void {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue
      this.life[i] -= dt
      this.velocity[i * 3 + 1] -= 2.4 * dt
      this.positions[i * 3] += this.velocity[i * 3] * dt
      this.positions[i * 3 + 1] += this.velocity[i * 3 + 1] * dt
      this.positions[i * 3 + 2] += this.velocity[i * 3 + 2] * dt
      if (this.life[i] <= 0) this.positions[i * 3 + 1] = -200
    }
    const pos = this.points.geometry.getAttribute('position') as THREE.BufferAttribute
    const col = this.points.geometry.getAttribute('color') as THREE.BufferAttribute
    pos.needsUpdate = true
    col.needsUpdate = true
  }
}

type Nugget = {
  mesh: THREE.Mesh
  t: number
  dur: number
  from: THREE.Vector3
  to: THREE.Vector3
  active: boolean
}
