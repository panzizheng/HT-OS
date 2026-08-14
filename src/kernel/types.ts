// ============================================================
// HT OS 核心类型定义
// ============================================================

// HT OS 初始化选项
export interface HTOSOptions {
  container: HTMLElement
  wallpaper?: string
  userName?: string
}

// 超分辨率画质模式
export type QualityMode = 'off' | 'dlss' | 'fsr3' | 'metalfx'

// 帧生成 / 插帧模式
export type FrameInterpolationMode = 'off' | 'on' | 'auto'

// 画质设置
export interface QualitySettings {
  mode: QualityMode
  sharpness: number
  frameInterpolation: FrameInterpolationMode
  animationSpeed: number
}

// UAC 警戒级别
export type UACLevel = 'high' | 'medium' | 'low'

// 系统设置
export interface SystemSettings {
  wallpaper: string
  lockWallpaper: string
  themeColor: string
  userName: string
  password: string
  brightness: number
  volume: number
  quality: QualitySettings
  resolution: number
  oobeCompleted: boolean
  uacLevel: UACLevel
}

// 窗口配置
export interface WindowConfig {
  id: string
  title: string
  icon: string
  appId: string
  x: number
  y: number
  width: number
  height: number
  minWidth?: number
  minHeight?: number
  maxable?: boolean
  resizable?: boolean
  /** 打开动画的起始位置（从该点展开），不传则用默认淡入 */
  origin?: { x: number; y: number }
}

// 应用配置
export interface AppConfig {
  id: string
  name: string
  icon: string
  entry: (windowId: string, ...args: any[]) => void
  singleton?: boolean
  defaultWidth?: number
  defaultHeight?: number
}

// 文件系统项
export interface FileSystemItem {
  id: string
  name: string
  type: 'file' | 'folder'
  parentId: string | null
  content?: string
  created: number
  modified: number
  size: number
  mimeType?: string
}
