// ============================================================
// 窗口管理器 - 管理所有窗口与应用注册
// 维护窗口 Map、z-index、级联排列、单例模式
// 通过 EventBus 发送窗口生命周期事件
// ============================================================

import { Window } from './Window'
import { EventBus } from '../kernel/EventBus'
import type { WindowConfig, AppConfig } from '../kernel/types'

export class WindowManager {
  private windows: Map<string, Window> = new Map()
  private appRegistry: Map<string, AppConfig> = new Map()
  private zIndexCounter: number = 100
  private cascadeOffset: number = 0
  private activeWindowId: string | null = null
  private eventBus: EventBus
  private container: HTMLElement

  constructor(container: HTMLElement, eventBus: EventBus) {
    this.container = container
    this.eventBus = eventBus
    this.setupEventListeners()
  }

  // 监听窗口内部事件
  private setupEventListeners(): void {
    // 窗口请求焦点
    this.eventBus.on('window:focus', (id: string) => {
      this.focusWindow(id)
    })

    // 窗口关闭后从 Map 中移除
    this.eventBus.on('window:closed', (id: string) => {
      this.windows.delete(id)
      if (this.activeWindowId === id) {
        this.activeWindowId = null
      }
    })
  }

  // 注册应用
  registerApp(app: AppConfig): void {
    this.appRegistry.set(app.id, app)
  }

  // 获取已注册应用
  getApp(appId: string): AppConfig | undefined {
    return this.appRegistry.get(appId)
  }

  // 打开应用窗口，支持单例模式与级联排列
  // 可选的 origin 参数指定打开动画的起始位置（从该点展开）
  openApp(appId: string, ...args: any[]): string | null {
    const app = this.appRegistry.get(appId)
    if (!app) {
      console.warn(`[WindowManager] 未找到应用: ${appId}`)
      return null
    }

    // 单例模式：已存在实例则聚焦/还原
    if (app.singleton) {
      for (const win of this.windows.values()) {
        if (win.appId === appId) {
          if (win.minimized) {
            win.restore()
          } else {
            win.focus()
          }
          return win.id
        }
      }
    }

    const windowId = `${appId}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`

    // 级联排列：每个新窗口偏移一定距离，超出范围后回到起点
    const baseX = 80
    const baseY = 40
    const offset = this.cascadeOffset % 220
    this.cascadeOffset += 28

    // 如果 args 最后一个参数是 { _origin: { x, y } }，提取作为打开动画起点
    let origin: { x: number; y: number } | undefined
    const lastArg = args.length > 0 ? args[args.length - 1] : null
    if (lastArg && typeof lastArg === 'object' && '_origin' in lastArg) {
      origin = (lastArg as any)._origin
      args = args.slice(0, -1) // 移除 origin 参数
    }

    const config: WindowConfig = {
      id: windowId,
      title: app.name,
      icon: app.icon,
      appId,
      x: baseX + offset,
      y: baseY + offset,
      width: app.defaultWidth || 600,
      height: app.defaultHeight || 400,
      maxable: true,
      resizable: true,
      origin
    }

    const win = new Window(config, this.eventBus, ++this.zIndexCounter)
    this.windows.set(windowId, win)
    this.container.appendChild(win.element)

    // 播放打开动画（从点击位置展开）
    if (config.origin) {
      // 禁用 CSS 默认淡入动画
      win.element.style.animation = 'none'
      win.playOpenAnimation(config.origin)
    }

    this.activeWindowId = windowId

    // 触发应用入口
    try {
      app.entry(windowId, ...args)
    } catch (e) {
      console.error(`[WindowManager] 应用 "${appId}" 启动出错:`, e)
    }

    // 通知任务栏等组件新窗口已创建
    this.eventBus.emit('window:created', windowId, win.title, win.icon)
    this.eventBus.emit('window:focusChanged', windowId)

    return windowId
  }

  // 提升窗口 z-index 并触发焦点变更事件
  focusWindow(id: string): void {
    const win = this.windows.get(id)
    if (!win) return
    this.zIndexCounter++
    win.setZIndex(this.zIndexCounter)
    this.activeWindowId = id
    this.eventBus.emit('window:focusChanged', id)
  }

  // 获取当前活动窗口
  getActiveWindow(): Window | null {
    if (!this.activeWindowId) return null
    return this.windows.get(this.activeWindowId) || null
  }

  getWindow(id: string): Window | undefined {
    return this.windows.get(id)
  }

  getAllWindows(): Window[] {
    return Array.from(this.windows.values())
  }

  getWindowsByApp(appId: string): Window[] {
    return Array.from(this.windows.values()).filter(w => w.appId === appId)
  }

  closeWindow(id: string): void {
    const win = this.windows.get(id)
    if (win) win.close()
  }

  minimizeAll(): void {
    this.windows.forEach(win => win.minimize())
  }

  closeAll(): void {
    // 拷贝一份避免迭代时修改集合
    Array.from(this.windows.values()).forEach(win => win.close())
  }
}
