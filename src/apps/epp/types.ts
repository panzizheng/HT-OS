export interface EPPManifest {
  name: string
  version: string
  icon?: string
  defaultWidth?: number
  defaultHeight?: number
  entry: string
}

export interface EPPFile {
  manifest: EPPManifest
  bytecode: string
}

/**
 * EPP 项目文件 (.epproj) 结构
 * 一个项目对应一个文件夹，文件夹内包含 project.epproj 和若干 .e 源文件
 */
export interface EPPProject {
  /** 项目名称 */
  name: string
  /** 项目版本 */
  version: string
  /** 主源文件名（相对项目目录），例如 "main.e" */
  main: string
  /** 项目包含的所有源文件名列表 */
  files: string[]
}

/**
 * EPP 解决方案文件 (.esln) 结构
 * 一个解决方案可包含多个项目，统一管理
 * 解决方案文件放在解决方案文件夹根目录
 */
export interface EPPSolution {
  /** 解决方案名称 */
  name: string
  /** 包含的项目列表 */
  projects: EPPSolutionProject[]
}

export interface EPPSolutionProject {
  /** 项目名称 */
  name: string
  /** 项目文件夹相对解决方案目录的路径，例如 "MyApp" 或 "libs/utils" */
  path: string
}

/** 编译配置：Debug 或 Release */
export type CompileConfig = 'Debug' | 'Release'

/** 编译结果 */
export interface CompileResult {
  /** 生成的 .epp 文件路径 */
  outputPath: string
  /** 编译配置 */
  config: CompileConfig
  /** 字节码大小（字符数） */
  bytecodeSize: number
  /** 项目名称 */
  projectName: string
  /** 编译耗时（毫秒） */
  duration: number
}

export interface EPPRuntimeAPI {
  // === 控制台 IO ===
  print(text: string): void
  println(text: string): void
  readLine(prompt?: string): Promise<string>
  // === 对话框 ===
  showMessage(title: string, message: string): void
  showConfirm(title: string, message: string): Promise<boolean>
  showPrompt(title: string, message: string, defaultValue?: string): Promise<string | null>
  showOpenDialog(options?: {
    title?: string
    filters?: string[]
    defaultPath?: string
  }): Promise<string | null>
  showSaveDialog(options?: {
    title?: string
    filters?: string[]
    defaultPath?: string
    defaultName?: string
  }): Promise<string | null>
  showFolderDialog(options?: {
    title?: string
    defaultPath?: string
  }): Promise<string | null>

  // === 窗口控制 ===
  createWindow(options: {
    title?: string
    width?: number
    height?: number
  }): string
  openWindow(options: {
    title?: string
    width?: number
    height?: number
    content?: string
  }): string
  closeWindow(windowId?: string): void
  setWindowTitle(title: string): void
  setWindowContent(content: string): void
  setWindowSize(width: number, height: number): void
  getWindowSize(): { width: number; height: number }
  centerWindow(): void
  minimizeWindow(): void
  maximizeWindow(): void
  isWindowMaximized(): boolean
  onWindowClose(callback: () => void): void

  // === DOM 操作 ===
  getElementById(id: string): HTMLElement | null
  createElement(tag: string, options?: {
    id?: string
    className?: string
    text?: string
    html?: string
    style?: Record<string, string>
  }): HTMLElement
  appendElement(element: HTMLElement): void
  onEvent(element: HTMLElement, event: string, callback: (e: Event) => void): void

  // === 文件系统 ===
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  listFiles(path?: string): Promise<string[]>
  createDirectory(path: string): Promise<void>
  deleteFile(path: string): Promise<void>
  fileExists(path: string): Promise<boolean>
  copyFile(source: string, destination: string): Promise<void>
  moveFile(source: string, destination: string): Promise<void>

  // === 定时器 ===
  setTimeout(callback: () => void, ms: number): number
  setInterval(callback: () => void, ms: number): number
  clearTimeout(id: number): void
  clearInterval(id: number): void

  // === 网络 ===
  httpRequest(url: string, options?: {
    method?: string
    headers?: Record<string, string>
    body?: string
  }): Promise<{ status: number; data: string; ok: boolean }>

  // === 剪贴板 ===
  clipboardWrite(text: string): void
  clipboardRead(): string

  // === 系统工具 ===
  getEnv(name: string): string | undefined
  setEnv(name: string, value: string): void
  getTimestamp(): number
  formatDate(format: string, timestamp?: number): string
  random(min: number, max: number): number
  getScreenWidth(): number
  getScreenHeight(): number

  // === 3D 游戏 ===
  /** 3D 场景引擎（g3d 对象），用于开发 3D 游戏 */
  g3d: import('./g3d').G3D
}
