// ============================================================
// 事件日志 - 记录系统事件，类似 Windows 事件查看器
// 通道：System / Application / Security
// 持久化到 localStorage（最多保留 500 条，超出自动清理）
// ============================================================

export type EventChannel = 'System' | 'Application' | 'Security'
export type EventLevel = 'info' | 'warning' | 'error'

export interface LogEntry {
  id: number
  time: number
  channel: EventChannel
  level: EventLevel
  source: string
  eventId: number
  message: string
}

const MAX_ENTRIES = 500

export class EventLog {
  private static STORAGE_KEY = 'ht-os-event-log'
  private entries: LogEntry[] = []
  private nextId = 1
  private listeners: Set<(entries: LogEntry[]) => void> = new Set()

  constructor() {
    this.load()
  }

  private load(): void {
    try {
      const saved = localStorage.getItem(EventLog.STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        this.entries = data.entries || []
        this.nextId = data.nextId || 1
      }
    } catch (e) {
      console.warn('[EventLog] 加载失败:', e)
    }
    // 如果是首次启动，记录系统启动事件
    if (this.entries.length === 0) {
      this.log('System', 'info', 'Kernel', 1, '系统已启动')
    }
  }

  private save(): void {
    try {
      localStorage.setItem(EventLog.STORAGE_KEY, JSON.stringify({
        entries: this.entries,
        nextId: this.nextId
      }))
    } catch (e) {
      console.warn('[EventLog] 保存失败:', e)
    }
  }

  // 写入日志
  log(channel: EventChannel, level: EventLevel, source: string, eventId: number, message: string): void {
    const entry: LogEntry = {
      id: this.nextId++,
      time: Date.now(),
      channel,
      level,
      source,
      eventId,
      message
    }
    this.entries.push(entry)
    // 超出上限则删除最旧的
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.splice(0, this.entries.length - MAX_ENTRIES)
    }
    this.save()
    this.notify()
  }

  // 快捷方法
  info(source: string, message: string, eventId = 1): void {
    this.log('Application', 'info', source, eventId, message)
  }
  warn(source: string, message: string, eventId = 2): void {
    this.log('Application', 'warning', source, eventId, message)
  }
  error(source: string, message: string, eventId = 3): void {
    this.log('Application', 'error', source, eventId, message)
  }
  security(source: string, message: string, eventId = 4): void {
    this.log('Security', 'info', source, eventId, message)
  }

  // 获取所有日志
  getAll(): LogEntry[] {
    return [...this.entries]
  }

  // 按通道筛选
  getByChannel(channel: EventChannel): LogEntry[] {
    return this.entries.filter(e => e.channel === channel)
  }

  // 按级别筛选
  getByLevel(level: EventLevel): LogEntry[] {
    return this.entries.filter(e => e.level === level)
  }

  // 清空所有日志
  clear(): void {
    this.entries = []
    this.save()
    this.notify()
  }

  // 监听变更
  onChange(cb: (entries: LogEntry[]) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  private notify(): void {
    const snapshot = this.getAll()
    for (const l of this.listeners) {
      try { l(snapshot) } catch (e) { console.warn('[EventLog] 监听器出错:', e) }
    }
  }
}
