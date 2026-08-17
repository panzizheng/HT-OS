// ============================================================
// G3D — EPP 语言的 3D 游戏引擎
// 自封装 WebGL 渲染，不依赖任何外部库。
// 提供：场景物体、透视相机、基础几何体、材质、变换、
//       动画帧循环、鼠标轨道控制与输入事件。
// EPP 程序中通过全局 g3d 对象使用（见 g3d 章节文档）。
// ============================================================

/** 4x4 矩阵（column-major，Float32Array） */
type Mat4 = Float32Array

function m4Identity(): Mat4 {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
}

function m4Multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Float32Array(16)
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[r] * b[c * 4] +
        a[4 + r] * b[c * 4 + 1] +
        a[8 + r] * b[c * 4 + 2] +
        a[12 + r] * b[c * 4 + 3]
    }
  }
  return out
}

function m4Perspective(fovY: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovY / 2)
  const nf = 1 / (near - far)
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0
  ])
}

function m4LookAt(eye: number[], center: number[], up: number[]): Mat4 {
  const z = norm(sub(eye, center))
  const x = norm(cross(up, z))
  const y = cross(z, x)
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -dot(x, eye), -dot(y, eye), -dot(z, eye), 1
  ])
}

function m4RotateX(a: number): Mat4 {
  const c = Math.cos(a), s = Math.sin(a)
  return new Float32Array([1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1])
}
function m4RotateY(a: number): Mat4 {
  const c = Math.cos(a), s = Math.sin(a)
  return new Float32Array([c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1])
}
function m4RotateZ(a: number): Mat4 {
  const c = Math.cos(a), s = Math.sin(a)
  return new Float32Array([c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
}

function vec3(x: number, y: number, z: number): number[] { return [x, y, z] }
function sub(a: number[], b: number[]): number[] { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]] }
function cross(a: number[], b: number[]): number[] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}
function dot(a: number[], b: number[]): number { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] }
function norm(a: number[]): number[] {
  const len = Math.sqrt(dot(a, a)) || 1
  return [a[0] / len, a[1] / len, a[2] / len]
}

/** 网格数据（顶点位置 + 法线 + 索引） */
interface G3DMesh {
  positions: Float32Array
  normals: Float32Array
  indices: Uint16Array
}

/** 场景中的物体 */
interface G3DObject {
  id: number
  mesh: G3DMesh
  position: number[]
  rotation: number[]   // 弧度，依次绕 X / Y / Z
  scale: number[]
  color: [number, number, number, number]
  wireframe: boolean
  visible: boolean
  buffers: {
    position: WebGLBuffer
    normal: WebGLBuffer
    index: WebGLBuffer
  }
  indexCount: number
}

interface G3DMouseEvent { x: number; y: number; button: number; dx: number; dy: number }
type MouseCallback = (e: G3DMouseEvent) => void

const VERTEX_SHADER = `
attribute vec3 aPosition;
attribute vec3 aNormal;
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProj;
varying vec3 vNormal;
varying vec3 vWorldPos;
void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  vWorldPos = world.xyz;
  vNormal = normalize((uModel * vec4(aNormal, 0.0)).xyz);
  gl_Position = uProj * uView * world;
}
`

const FRAGMENT_SHADER = `
precision mediump float;
varying vec3 vNormal;
varying vec3 vWorldPos;
uniform vec3 uColor;
uniform float uOpacity;
uniform vec3 uLightDir;
uniform vec3 uCamPos;
void main() {
  vec3 N = normalize(vNormal);
  vec3 L = normalize(uLightDir);
  float diff = max(dot(N, L), 0.0);
  vec3 V = normalize(uCamPos - vWorldPos);
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 40.0);
  vec3 base = uColor;
  vec3 lit = base * (0.28 + 0.72 * diff) + vec3(1.0) * spec * 0.35;
  gl_FragColor = vec4(lit, uOpacity);
}
`

/** 生成立方体网格（每面独立法线） */
function makeCube(w: number, h: number, d: number): G3DMesh {
  const x = w / 2, y = h / 2, z = d / 2
  // 每面 4 顶点：normal + 4 个角（CCW，从外侧看）
  const faces: { n: number[]; v: number[][] }[] = [
    { n: [0, 0, 1], v: [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]] },
    { n: [0, 0, -1], v: [[-x, -y, -z], [-x, y, -z], [x, y, -z], [x, -y, -z]] },
    { n: [1, 0, 0], v: [[x, -y, -z], [x, y, -z], [x, y, z], [x, -y, z]] },
    { n: [-1, 0, 0], v: [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z]] },
    { n: [0, 1, 0], v: [[-x, y, -z], [-x, y, z], [x, y, z], [x, y, -z]] },
    { n: [0, -1, 0], v: [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z]] }
  ]
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  for (const f of faces) {
    const base = positions.length / 3
    for (const v of f.v) { positions.push(v[0], v[1], v[2]); normals.push(f.n[0], f.n[1], f.n[2]) }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices)
  }
}

/** 生成球体网格（经纬细分） */
function makeSphere(r: number, seg: number): G3DMesh {
  const lat = Math.max(3, seg)
  const lon = Math.max(4, seg * 2)
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  for (let i = 0; i <= lat; i++) {
    const phi = (i / lat) * Math.PI
    const sinPhi = Math.sin(phi), cosPhi = Math.cos(phi)
    for (let j = 0; j <= lon; j++) {
      const theta = (j / lon) * Math.PI * 2
      const x = sinPhi * Math.cos(theta)
      const y = cosPhi
      const z = sinPhi * Math.sin(theta)
      positions.push(x * r, y * r, z * r)
      normals.push(x, y, z)
    }
  }
  const row = lon + 1
  for (let i = 0; i < lat; i++) {
    for (let j = 0; j < lon; j++) {
      const a = i * row + j
      const b = a + row
      indices.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices)
  }
}

/** 生成平面网格（水平，法线朝上） */
function makePlane(w: number, d: number): G3DMesh {
  const x = w / 2, z = d / 2
  return {
    positions: new Float32Array([
      -x, 0, -z,  x, 0, -z,  x, 0, z,  -x, 0, z
    ]),
    normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
    indices: new Uint16Array([0, 1, 2, 0, 2, 3])
  }
}

/**
 * G3D 3D 引擎
 * 面向 EPP 语言暴露的 3D 游戏开发 API
 */
export class G3D {
  private canvas: HTMLCanvasElement | null = null
  private gl: WebGLRenderingContext | null = null
  private program: WebGLProgram | null = null
  private objects: G3DObject[] = []
  private nextId = 1
  private rafId = 0
  private running = false
  private time = 0
  private delta = 0
  private lastTime = 0
  private animateCallbacks: (() => void)[] = []

  // 相机 / 轨道控制
  private target: number[] = [0, 0, 0]
  private orbitTheta = 0.8
  private orbitPhi = 0.6
  private orbitRadius = 6
  private fov = 60
  private near = 0.1
  private far = 500
  private background: [number, number, number] = [0.07, 0.09, 0.16]
  private enableOrbitMode = true

  // 输入
  private mouseDownCbs: MouseCallback[] = []
  private mouseMoveCbs: MouseCallback[] = []
  private mouseUpCbs: MouseCallback[] = []
  private wheelCbs: MouseCallback[] = []
  private dragging = false
  private lastMX = 0
  private lastMY = 0

  private lightDir: number[] = [0.5, 0.8, 0.6]
  private containerProvider: ((width: number, height: number, title?: string) => HTMLElement | null) | null = null

  /** 注册“打开窗口容器”的函数，供 createWindow 使用（由运行时注入） */
  setContainerProvider(fn: (width: number, height: number, title?: string) => HTMLElement | null): void {
    this.containerProvider = fn
  }

  /** 创建/切换 3D 窗口并开始渲染 */
  createWindow(width: number, height: number, title?: string): boolean {
    if (!this.containerProvider) return false
    const container = this.containerProvider(width, height, title)
    if (!container) return false
    return this.attach(container, width, height)
  }

  /** 将 canvas 挂载到容器并开始渲染 */
  attach(container: HTMLElement, width: number, height: number): boolean {
    container.classList.add('epp-g3d-container')
    if (this.canvas && this.canvas.parentElement === container) {
      // 复用已有 canvas
    } else {
      const canvas = document.createElement('canvas')
      canvas.className = 'epp-g3d-canvas'
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      canvas.style.display = 'block'
      container.innerHTML = ''
      container.appendChild(canvas)
      this.canvas = canvas
      this.gl = canvas.getContext('webgl', { antialias: true })
      if (!this.gl) {
        container.innerHTML = '<div style="padding:20px;color:#e11d48;font-family:monospace">当前环境不支持 WebGL，无法运行 3D 程序</div>'
        return false
      }
      this.initGL(width, height)
      this.setupInput()
    }
    this.resize(width, height)
    this.start()
    return true
  }

  /** 关闭并清理 3D 场景 */
  close(): void {
    this.stop()
    this.objects = []
    if (this.canvas) {
      this.canvas.remove()
      this.canvas = null
    }
    this.gl = null
    this.program = null
  }

  // ================= 场景 / 物体 =================

  /** 创建立方体，返回物体 id */
  createCube(w = 1, h = 1, d = 1): number {
    return this.addObject(makeCube(w, h, d))
  }

  /** 创建球体，返回物体 id */
  createSphere(radius = 1, segments = 24): number {
    return this.addObject(makeSphere(radius, segments))
  }

  /** 创建平面（地面），返回物体 id */
  createPlane(width = 10, depth = 10): number {
    return this.addObject(makePlane(width, depth))
  }

  /** 删除物体 */
  remove(id: number): boolean {
    const idx = this.objects.findIndex(o => o.id === id)
    if (idx < 0) return false
    const obj = this.objects[idx]
    this.gl?.deleteBuffer(obj.buffers.position)
    this.gl?.deleteBuffer(obj.buffers.normal)
    this.gl?.deleteBuffer(obj.buffers.index)
    this.objects.splice(idx, 1)
    return true
  }

  /** 清空所有物体 */
  clear(): void {
    for (const o of this.objects) {
      this.gl?.deleteBuffer(o.buffers.position)
      this.gl?.deleteBuffer(o.buffers.normal)
      this.gl?.deleteBuffer(o.buffers.index)
    }
    this.objects = []
  }

  /** 当前物体数量 */
  count(): number { return this.objects.length }

  // ================= 变换 =================

  setPosition(id: number, x: number, y: number, z: number): boolean {
    const o = this.find(id)
    if (!o) return false
    o.position = [x, y, z]
    return true
  }
  setRotation(id: number, rx: number, ry: number, rz: number): boolean {
    const o = this.find(id)
    if (!o) return false
    o.rotation = [rx, ry, rz]
    return true
  }
  setScale(id: number, sx: number, sy: number, sz: number): boolean {
    const o = this.find(id)
    if (!o) return false
    o.scale = [sx, sy, sz]
    return true
  }
  translate(id: number, dx: number, dy: number, dz: number): boolean {
    const o = this.find(id)
    if (!o) return false
    o.position = [o.position[0] + dx, o.position[1] + dy, o.position[2] + dz]
    return true
  }
  /** 增量旋转（弧度） */
  rotate(id: number, drx: number, dry: number, drz: number): boolean {
    const o = this.find(id)
    if (!o) return false
    o.rotation = [o.rotation[0] + drx, o.rotation[1] + dry, o.rotation[2] + drz]
    return true
  }

  // ================= 外观 =================

  setColor(id: number, r: number, g: number, b: number, a = 1): boolean {
    const o = this.find(id)
    if (!o) return false
    o.color = [r, g, b, a]
    return true
  }
  setWireframe(id: number, wire: boolean): boolean {
    const o = this.find(id)
    if (!o) return false
    o.wireframe = wire
    return true
  }
  setVisible(id: number, visible: boolean): boolean {
    const o = this.find(id)
    if (!o) return false
    o.visible = visible
    return true
  }

  // ================= 相机 =================

  /** 直接设置相机位置（看向目标点） */
  setCamera(x: number, y: number, z: number): void {
    const eye = [x, y, z]
    const d = Math.sqrt(dot(sub(eye, this.target), sub(eye, this.target))) || 1
    this.orbitRadius = d
    const off = sub(eye, this.target)
    this.orbitPhi = Math.acos(Math.max(-1, Math.min(1, off[1] / d)))
    this.orbitTheta = Math.atan2(off[0], off[2])
  }
  /** 设置相机看向的目标点 */
  lookAt(x: number, y: number, z: number): void {
    this.target = [x, y, z]
  }
  /** 相机到目标点的距离（缩放） */
  setDistance(d: number): void {
    this.orbitRadius = Math.max(0.1, d)
  }
  setFov(fovDegrees: number): void {
    this.fov = Math.max(10, Math.min(150, fovDegrees))
  }
  /** 设置背景色（0-1） */
  setBackground(r: number, g: number, b: number): void {
    this.background = [r, g, b]
  }
  setLightDirection(x: number, y: number, z: number): void {
    this.lightDir = norm([x, y, z])
  }
  /** 是否启用鼠标拖拽环绕观察 + 滚轮缩放 */
  enableOrbit(enable: boolean): void {
    this.enableOrbitMode = enable
  }

  // ================= 动画 / 时间 =================

  start(): void {
    if (this.running || !this.gl) return
    this.running = true
    this.lastTime = performance.now() / 1000
    const loop = (t: number) => {
      if (!this.running) return
      const now = t / 1000
      this.delta = Math.min(now - this.lastTime, 0.05)
      this.time = now
      this.lastTime = now
      for (const cb of this.animateCallbacks) cb()
      this.render()
      this.rafId = requestAnimationFrame(loop)
    }
    this.rafId = requestAnimationFrame(loop)
  }
  stop(): void {
    this.running = false
    if (this.rafId) cancelAnimationFrame(this.rafId)
    this.rafId = 0
  }
  /** 每帧调用一次回调（用于更新物体、实现游戏逻辑） */
  animate(callback: () => void): void {
    if (this.animateCallbacks.indexOf(callback) < 0) {
      this.animateCallbacks.push(callback)
    }
  }
  /** 清除所有动画回调 */
  clearAnimate(): void {
    this.animateCallbacks = []
  }
  /** 自运行以来的时间（秒） */
  getTime(): number { return this.time }
  /** 上一帧耗时（秒） */
  getDelta(): number { return this.delta }
  /** 是否正在渲染 */
  isRunning(): boolean { return this.running }

  // ================= 输入 =================

  onMouseDown(cb: MouseCallback): void { this.mouseDownCbs.push(cb) }
  onMouseMove(cb: MouseCallback): void { this.mouseMoveCbs.push(cb) }
  onMouseUp(cb: MouseCallback): void { this.mouseUpCbs.push(cb) }
  onWheel(cb: MouseCallback): void { this.wheelCbs.push(cb) }

  // ================= 内部实现 =================

  private find(id: number): G3DObject | undefined {
    return this.objects.find(o => o.id === id)
  }

  private addObject(mesh: G3DMesh): number {
    const gl = this.gl
    if (!gl) return 0
    const position = gl.createBuffer()!
    const normal = gl.createBuffer()!
    const index = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, position)
    gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW)
    gl.bindBuffer(gl.ARRAY_BUFFER, normal)
    gl.bufferData(gl.ARRAY_BUFFER, mesh.normals, gl.STATIC_DRAW)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW)
    const obj: G3DObject = {
      id: this.nextId++,
      mesh,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: [1, 1, 1, 1],
      wireframe: false,
      visible: true,
      buffers: { position, normal, index },
      indexCount: mesh.indices.length
    }
    this.objects.push(obj)
    return obj.id
  }

  private compileShader(type: number, source: string): WebGLShader | null {
    const gl = this.gl!
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('[G3D] 着色器编译失败:', gl.getShaderInfoLog(shader))
      gl.deleteShader(shader)
      return null
    }
    return shader
  }

  private initGL(width: number, height: number): void {
    const gl = this.gl!
    const vs = this.compileShader(gl.VERTEX_SHADER, VERTEX_SHADER)
    const fs = this.compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
    if (!vs || !fs) return
    const program = gl.createProgram()!
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('[G3D] 着色器链接失败:', gl.getProgramInfoLog(program))
      return
    }
    this.program = program
    gl.useProgram(program)
    gl.enable(gl.DEPTH_TEST)
    gl.clearColor(this.background[0], this.background[1], this.background[2], 1)
  }

  private resize(width: number, height: number): void {
    const gl = this.gl
    const canvas = this.canvas
    if (!gl || !canvas) return
    // 优先使用容器实际尺寸，保证随窗口缩放
    const w = width > 0 ? width : (canvas.parentElement?.clientWidth || 320)
    const h = height > 0 ? height : (canvas.parentElement?.clientHeight || 240)
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
      gl.viewport(0, 0, w, h)
    }
  }

  private setupInput(): void {
    const canvas = this.canvas!
    canvas.style.cursor = 'grab'

    canvas.addEventListener('mousedown', (e: MouseEvent) => {
      this.dragging = true
      this.lastMX = e.clientX
      this.lastMY = e.clientY
      canvas.style.cursor = 'grabbing'
      const ev: G3DMouseEvent = { x: e.clientX, y: e.clientY, button: e.button, dx: 0, dy: 0 }
      for (const cb of this.mouseDownCbs) cb(ev)
    })

    window.addEventListener('mousemove', (e: MouseEvent) => {
      const dx = e.clientX - this.lastMX
      const dy = e.clientY - this.lastMY
      this.lastMX = e.clientX
      this.lastMY = e.clientY
      if (this.dragging && this.enableOrbitMode) {
        this.orbitTheta -= dx * 0.005
        this.orbitPhi = Math.max(0.05, Math.min(Math.PI - 0.05, this.orbitPhi - dy * 0.005))
      }
      const ev: G3DMouseEvent = { x: e.clientX, y: e.clientY, button: -1, dx, dy }
      for (const cb of this.mouseMoveCbs) cb(ev)
    })

    window.addEventListener('mouseup', (e: MouseEvent) => {
      if (!this.dragging) return
      this.dragging = false
      canvas.style.cursor = 'grab'
      const ev: G3DMouseEvent = { x: e.clientX, y: e.clientY, button: e.button, dx: 0, dy: 0 }
      for (const cb of this.mouseUpCbs) cb(ev)
    })

    canvas.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault()
      this.orbitRadius = Math.max(0.5, Math.min(200, this.orbitRadius + e.deltaY * 0.006))
      const ev: G3DMouseEvent = { x: e.clientX, y: e.clientY, button: 0, dx: 0, dy: e.deltaY }
      for (const cb of this.wheelCbs) cb(ev)
    }, { passive: false })
  }

  private render(): void {
    const gl = this.gl
    const program = this.program
    if (!gl || !program) return
    const canvas = this.canvas!
    // 自适应容器尺寸
    const parent = canvas.parentElement
    if (parent) {
      const pw = parent.clientWidth
      const ph = parent.clientHeight
      if (pw > 0 && ph > 0 && (canvas.width !== pw || canvas.height !== ph)) {
        canvas.width = pw
        canvas.height = ph
        gl.viewport(0, 0, pw, ph)
      }
    }

    gl.clearColor(this.background[0], this.background[1], this.background[2], 1)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.useProgram(program)

    const aspect = (canvas.height > 0 ? canvas.width / canvas.height : 1)
    const proj = m4Perspective(this.fov * Math.PI / 180, aspect, this.near, this.far)

    // 轨道相机位置
    const eye = [
      this.target[0] + this.orbitRadius * Math.sin(this.orbitPhi) * Math.cos(this.orbitTheta),
      this.target[1] + this.orbitRadius * Math.cos(this.orbitPhi),
      this.target[2] + this.orbitRadius * Math.sin(this.orbitPhi) * Math.sin(this.orbitTheta)
    ]
    const view = m4LookAt(eye, this.target, [0, 1, 0])

    const aPos = gl.getAttribLocation(program, 'aPosition')
    const aNormal = gl.getAttribLocation(program, 'aNormal')
    const uProj = gl.getUniformLocation(program, 'uProj')
    const uView = gl.getUniformLocation(program, 'uView')
    const uModel = gl.getUniformLocation(program, 'uModel')
    const uColor = gl.getUniformLocation(program, 'uColor')
    const uOpacity = gl.getUniformLocation(program, 'uOpacity')
    const uLightDir = gl.getUniformLocation(program, 'uLightDir')
    const uCamPos = gl.getUniformLocation(program, 'uCamPos')

    gl.uniformMatrix4fv(uProj, false, proj)
    gl.uniformMatrix4fv(uView, false, view)
    gl.uniform3fv(uLightDir, new Float32Array(this.lightDir))
    gl.uniform3fv(uCamPos, new Float32Array(eye))

    for (const obj of this.objects) {
      if (!obj.visible) continue
      const T = m4Identity()
      T[12] = obj.position[0]
      T[13] = obj.position[1]
      T[14] = obj.position[2]
      const R = m4Multiply(m4RotateX(obj.rotation[0]), m4Multiply(m4RotateY(obj.rotation[1]), m4RotateZ(obj.rotation[2])))
      const S = m4Identity()
      S[0] = obj.scale[0]
      S[5] = obj.scale[1]
      S[10] = obj.scale[2]
      const model = m4Multiply(T, m4Multiply(R, S))

      gl.bindBuffer(gl.ARRAY_BUFFER, obj.buffers.position)
      gl.enableVertexAttribArray(aPos)
      gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0)
      gl.bindBuffer(gl.ARRAY_BUFFER, obj.buffers.normal)
      gl.enableVertexAttribArray(aNormal)
      gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0)
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj.buffers.index)

      gl.uniformMatrix4fv(uModel, false, model)
      gl.uniform3fv(uColor, new Float32Array([obj.color[0], obj.color[1], obj.color[2]]))
      gl.uniform1f(uOpacity, obj.color[3])
      if (obj.wireframe) {
        gl.drawElements(gl.LINE_STRIP, obj.indexCount, gl.UNSIGNED_SHORT, 0)
      } else {
        gl.drawElements(gl.TRIANGLES, obj.indexCount, gl.UNSIGNED_SHORT, 0)
      }
    }
  }
}
