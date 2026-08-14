// ============================================================
// 通知服务 - 应用可推送通知，任务栏右下角显示通知中心
// 持久化到 localStorage（最多保留 100 条）
// ============================================================

export type NotificationLevel = 'info' | 'warning' | 'error' | 'success'

export interface AppNotification {
  id: number
  time: number
  app: string
  title: string
  message: string
  level: NotificationLevel
  read: boolean
}

const MAX_NOTIFICATIONS = 100

export class NotificationService {
  private static STORAGE_KEY = 'ht-os-notifications'
  private notifications: AppNotification[] = []
  private nextId = 1
  private listeners: Set<(notifications: AppNotification[]) => void> = new Set()
  private toastListeners: Set<(n: AppNotification) => void> = new Set()

  constructor() {
    this.load()
  }

  private load(): void {
    try {
      const saved = localStorage.getItem(NotificationService.STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        this.notifications = data.notifications || []
        this.nextId = data.nextId || 1
      }
    } catch (e) {
      console.warn('[NotificationService] 加载失败:', e)
    }
  }

  private save(): void {
    try {
      localStorage.setItem(NotificationService.STORAGE_KEY, JSON.stringify({
        notifications: this.notifications,
        nextId: this.nextId
      }))
    } catch (e) {
      console.warn('[NotificationService] 保存失败:', e)
    }
  }

  // 推送通知
  notify(app: string, title: string, message: string, level: NotificationLevel = 'info'): void {
    const n: AppNotification = {
      id: this.nextId++,
      time: Date.now(),
      app,
      title,
      message,
      level,
      read: false
    }
    this.notifications.unshift(n) // 最新通知在最前
    if (this.notifications.length > MAX_NOTIFICATIONS) {
      this.notifications.splice(MAX_NOTIFICATIONS)
    }
    this.save()
    this.notifyChange()
    this.showToast(n)
  }

  // 触发 Toast 弹出
  private showToast(n: AppNotification): void {
    for (const l of this.toastListeners) {
      try { l(n) } catch (e) { console.warn('[NotificationService] Toast 监听器出错:', e) }
    }
  }

  // 标记为已读
  markRead(id: number): void {
    const n = this.notifications.find(x => x.id === id)
    if (n && !n.read) {
      n.read = true
      this.save()
      this.notifyChange()
    }
  }

  // 全部标记已读
  markAllRead(): void {
    let changed = false
    for (const n of this.notifications) {
      if (!n.read) {
        n.read = true
        changed = true
      }
    }
    if (changed) {
      this.save()
      this.notifyChange()
    }
  }

  // 删除通知
  remove(id: number): void {
    const idx = this.notifications.findIndex(x => x.id === id)
    if (idx >= 0) {
      this.notifications.splice(idx, 1)
      this.save()
      this.notifyChange()
    }
  }

  // 清空所有
  clear(): void {
    this.notifications = []
    this.save()
    this.notifyChange()
  }

  // 获取所有
  getAll(): AppNotification[] {
    return [...this.notifications]
  }

  // 未读数量
  unreadCount(): number {
    return this.notifications.filter(n => !n.read).length
  }

  // 监听变更（通知列表变化）
  onChange(cb: (notifications: AppNotification[]) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  // 监听新 Toast
  onToast(cb: (n: AppNotification) => void): () => void {
    this.toastListeners.add(cb)
    return () => this.toastListeners.delete(cb)
  }

  private notifyChange(): void {
    const snapshot = this.getAll()
    for (const l of this.listeners) {
      try { l(snapshot) } catch (e) { console.warn('[NotificationService] 监听器出错:', e) }
    }
  }
}
