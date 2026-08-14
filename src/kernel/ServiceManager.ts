// ============================================================
// 系统服务管理 - 后台服务，可启动/停止/禁用
// 类似 Windows services.msc
// ============================================================

import { EventLog } from './EventLog'

export type ServiceStatus = 'running' | 'stopped' | 'starting' | 'stopping' | 'disabled'
export type ServiceStartType = 'auto' | 'manual' | 'disabled'

export interface SystemService {
  id: string
  name: string
  description: string
  status: ServiceStatus
  startType: ServiceStartType
  // 服务执行函数（启动时调用）
  onStart?: () => Promise<void> | void
  onStop?: () => Promise<void> | void
}

export class ServiceManager {
  private static STORAGE_KEY = 'ht-os-service-config'
  private services: Map<string, SystemService> = new Map()
  private eventLog: EventLog
  private listeners: Set<() => void> = new Set()

  constructor(eventLog: EventLog) {
    this.eventLog = eventLog
    this.loadConfig()
    this.registerBuiltinServices()
  }

  // 加载服务的启动类型配置
  private loadConfig(): void {
    // 启动类型由用户修改后保存；服务列表本身是内置的
  }

  // 注册内置服务
  private registerBuiltinServices(): void {
    const builtin: SystemService[] = [
      {
        id: 'EventLog',
        name: '事件日志服务',
        description: '记录系统和应用程序事件，供事件查看器查询',
        status: 'running',
        startType: 'auto'
      },
      {
        id: 'Notification',
        name: '通知服务',
        description: '管理应用通知推送和通知中心',
        status: 'running',
        startType: 'auto'
      },
      {
        id: 'Registry',
        name: '注册表服务',
        description: '提供系统注册表的读写访问',
        status: 'running',
        startType: 'auto'
      },
      {
        id: 'AutoSave',
        name: '自动保存服务',
        description: '定期保存未保存的文档（每 60 秒检查）',
        status: 'stopped',
        startType: 'manual'
      },
      {
        id: 'Indexer',
        name: '文件索引服务',
        description: '为文件搜索建立索引，加快全局搜索速度',
        status: 'stopped',
        startType: 'manual'
      },
      {
        id: 'UpdateChecker',
        name: '更新检查服务',
        description: '检查系统更新（演示服务）',
        status: 'stopped',
        startType: 'manual'
      },
      {
        id: 'Telemetry',
        name: '诊断数据收集',
        description: '收集匿名诊断数据以改进系统',
        status: 'disabled',
        startType: 'disabled'
      }
    ]
    for (const svc of builtin) {
      this.services.set(svc.id, svc)
    }
    // 应用用户保存的启动类型配置
    this.applySavedConfig()
  }

  // 应用用户保存的启动类型
  private applySavedConfig(): void {
    try {
      const saved = localStorage.getItem(ServiceManager.STORAGE_KEY)
      if (saved) {
        const config: Record<string, ServiceStartType> = JSON.parse(saved)
        for (const [id, startType] of Object.entries(config)) {
          const svc = this.services.get(id)
          if (svc) {
            svc.startType = startType
            if (startType === 'disabled') {
              svc.status = 'disabled'
            }
          }
        }
      }
    } catch (e) {
      console.warn('[ServiceManager] 加载配置失败:', e)
    }
  }

  // 保存启动类型配置
  private saveConfig(): void {
    const config: Record<string, ServiceStartType> = {}
    for (const [id, svc] of this.services) {
      config[id] = svc.startType
    }
    try {
      localStorage.setItem(ServiceManager.STORAGE_KEY, JSON.stringify(config))
    } catch (e) {
      console.warn('[ServiceManager] 保存配置失败:', e)
    }
  }

  // 启动服务
  async start(serviceId: string): Promise<boolean> {
    const svc = this.services.get(serviceId)
    if (!svc) return false
    if (svc.status === 'running') return true
    if (svc.status === 'disabled') {
      this.eventLog.warn('ServiceManager', `服务 ${svc.name} 已被禁用，无法启动`)
      return false
    }
    svc.status = 'starting'
    this.notify()
    try {
      if (svc.onStart) await svc.onStart()
      svc.status = 'running'
      this.eventLog.log('System', 'info', 'ServiceManager', 10, `服务 ${svc.name} 已启动`)
      this.notify()
      return true
    } catch (e: any) {
      svc.status = 'stopped'
      this.eventLog.error('ServiceManager', `服务 ${svc.name} 启动失败: ${e.message}`)
      this.notify()
      return false
    }
  }

  // 停止服务
  async stop(serviceId: string): Promise<boolean> {
    const svc = this.services.get(serviceId)
    if (!svc) return false
    if (svc.status === 'stopped' || svc.status === 'disabled') return true
    svc.status = 'stopping'
    this.notify()
    try {
      if (svc.onStop) await svc.onStop()
      svc.status = 'stopped'
      this.eventLog.log('System', 'info', 'ServiceManager', 11, `服务 ${svc.name} 已停止`)
      this.notify()
      return true
    } catch (e: any) {
      svc.status = 'running'
      this.eventLog.error('ServiceManager', `服务 ${svc.name} 停止失败: ${e.message}`)
      this.notify()
      return false
    }
  }

  // 设置启动类型
  setStartType(serviceId: string, startType: ServiceStartType): boolean {
    const svc = this.services.get(serviceId)
    if (!svc) return false
    svc.startType = startType
    if (startType === 'disabled' && svc.status === 'running') {
      // 禁用正在运行的服务：先停止
      this.stop(serviceId).then(() => {
        svc.status = 'disabled'
        this.notify()
      })
    } else if (startType === 'disabled') {
      svc.status = 'disabled'
    } else if (svc.status === 'disabled') {
      // 从禁用状态恢复为非禁用启动类型
      svc.status = 'stopped'
    }
    this.saveConfig()
    this.notify()
    return true
  }

  // 获取所有服务
  getAll(): SystemService[] {
    return Array.from(this.services.values())
  }

  // 获取单个服务
  get(id: string): SystemService | undefined {
    return this.services.get(id)
  }

  // 注册自定义服务
  register(service: SystemService): void {
    this.services.set(service.id, service)
    this.notify()
  }

  // 启动所有 auto 类型的服务
  async startAutoServices(): Promise<void> {
    for (const svc of this.services.values()) {
      if (svc.startType === 'auto' && svc.status !== 'running') {
        await this.start(svc.id)
      }
    }
  }

  onChange(cb: () => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  private notify(): void {
    for (const l of this.listeners) {
      try { l() } catch (e) { console.warn('[ServiceManager] 监听器出错:', e) }
    }
  }
}
