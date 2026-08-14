// ============================================================
// 事件总线 - 全局事件发布/订阅系统
// 支持 on / off / emit / once，错误隔离不会中断其他监听器
// ============================================================

type EventHandler = (...args: any[]) => void

export class EventBus {
  // 事件名 -> 监听器集合
  private listeners: Map<string, Set<EventHandler>> = new Map()

  // 注册事件监听器
  on(event: string, handler: EventHandler): void {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(handler)
  }

  // 移除事件监听器
  off(event: string, handler: EventHandler): void {
    const set = this.listeners.get(event)
    if (!set) return
    set.delete(handler)
    if (set.size === 0) {
      this.listeners.delete(event)
    }
  }

  // 触发事件，单个监听器抛错不会影响其他监听器
  emit(event: string, ...args: any[]): void {
    const set = this.listeners.get(event)
    if (!set || set.size === 0) return
    // 拷贝一份，避免回调中增删监听器导致迭代异常
    const handlers = Array.from(set)
    for (const handler of handlers) {
      try {
        handler(...args)
      } catch (e) {
        console.error(`[EventBus] 事件 "${event}" 的监听器执行出错:`, e)
      }
    }
  }

  // 只监听一次，触发后自动移除
  once(event: string, handler: EventHandler): void {
    const wrapper: EventHandler = (...args: any[]) => {
      this.off(event, wrapper)
      try {
        handler(...args)
      } catch (e) {
        console.error(`[EventBus] 事件 "${event}" 的 once 监听器执行出错:`, e)
      }
    }
    this.on(event, wrapper)
  }

  // 清除某个事件的所有监听器（不传则清除全部）
  clear(event?: string): void {
    if (event) {
      this.listeners.delete(event)
    } else {
      this.listeners.clear()
    }
  }
}
