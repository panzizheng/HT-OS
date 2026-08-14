// ============================================================
// 启动项管理 - 管理开机自启动应用
// 持久化到 localStorage
// ============================================================

import { EventLog } from './EventLog'

export interface StartupItem {
  id: string
  name: string
  appId: string
  enabled: boolean
  // 启动时传给应用的参数
  args?: any[]
  // 启动延迟（毫秒）
  delay: number
  source: 'user' | 'system'
}

export class StartupManager {
  private static STORAGE_KEY = 'ht-os-startup-items'
  private items: StartupItem[] = []
  private eventLog: EventLog
  private listeners: Set<() => void> = new Set()

  constructor(eventLog: EventLog) {
    this.eventLog = eventLog
    this.load()
  }

  private load(): void {
    try {
      const saved = localStorage.getItem(StartupManager.STORAGE_KEY)
      if (saved) {
        this.items = JSON.parse(saved)
        // 清理旧版本遗留的会自动打开 UI 窗口的"系统启动项"
        const hadLegacy = this.items.some(i => i.id === 'startup-settings')
        if (hadLegacy) {
          this.items = this.items.filter(i => i.id !== 'startup-settings')
          this.save()
        }
      } else {
        this.initDefaults()
      }
    } catch (e) {
      console.warn('[StartupManager] 加载失败:', e)
      this.initDefaults()
    }
  }

  private initDefaults(): void {
    // 默认无开机自启项（避免每次开机都自动打开窗口）
    this.items = []
    this.save()
  }

  private save(): void {
    try {
      localStorage.setItem(StartupManager.STORAGE_KEY, JSON.stringify(this.items))
    } catch (e) {
      console.warn('[StartupManager] 保存失败:', e)
    }
    this.notify()
  }

  // 添加启动项
  add(item: Omit<StartupItem, 'id' | 'source'> & { id?: string }): void {
    const id = item.id || `startup-${Date.now()}`
    if (this.items.some(i => i.id === id)) {
      // 已存在则更新
      const idx = this.items.findIndex(i => i.id === id)
      this.items[idx] = { ...this.items[idx], ...item, id, source: 'user' }
    } else {
      this.items.push({
        ...item,
        id,
        source: 'user'
      })
    }
    this.eventLog.info('StartupManager', `已添加启动项: ${item.name}`)
    this.save()
  }

  // 删除启动项
  remove(id: string): boolean {
    const idx = this.items.findIndex(i => i.id === id)
    if (idx < 0) return false
    const item = this.items[idx]
    if (item.source === 'system') {
      // 系统级启动项不能删除，只能禁用
      return false
    }
    this.items.splice(idx, 1)
    this.eventLog.info('StartupManager', `已移除启动项: ${item.name}`)
    this.save()
    return true
  }

  // 启用/禁用启动项
  setEnabled(id: string, enabled: boolean): void {
    const item = this.items.find(i => i.id === id)
    if (item && item.enabled !== enabled) {
      item.enabled = enabled
      this.eventLog.info('StartupManager', `启动项 ${item.name} 已${enabled ? '启用' : '禁用'}`)
      this.save()
    }
  }

  // 获取所有启动项
  getAll(): StartupItem[] {
    return [...this.items]
  }

  // 获取已启用的启动项
  getEnabled(): StartupItem[] {
    return this.items.filter(i => i.enabled)
  }

  // 触发启动（由系统在进入桌面时调用）
  async runStartup(launchApp: (appId: string, ...args: any[]) => void): Promise<void> {
    const enabled = this.getEnabled().sort((a, b) => a.delay - b.delay)
    for (const item of enabled) {
      if (item.delay > 0) {
        await new Promise(resolve => setTimeout(resolve, item.delay))
      }
      try {
        launchApp(item.appId, ...(item.args || []))
        this.eventLog.info('StartupManager', `已启动: ${item.name}`)
      } catch (e: any) {
        this.eventLog.error('StartupManager', `启动失败: ${item.name} - ${e.message}`)
      }
    }
  }

  onChange(cb: () => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  private notify(): void {
    for (const l of this.listeners) {
      try { l() } catch (e) { console.warn('[StartupManager] 监听器出错:', e) }
    }
  }
}
