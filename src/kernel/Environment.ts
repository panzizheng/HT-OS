// ============================================================
// 环境变量 - 系统/用户环境变量管理
// 终端可读取这些变量，类似 Windows 环境变量
// 持久化到 localStorage
// ============================================================

export interface EnvVar {
  key: string
  value: string
  scope: 'system' | 'user'
}

export class Environment {
  private static STORAGE_KEY = 'ht-os-env-vars'
  private vars: EnvVar[] = []
  private listeners: Set<() => void> = new Set()

  constructor() {
    this.load()
  }

  private load(): void {
    try {
      const saved = localStorage.getItem(Environment.STORAGE_KEY)
      if (saved) {
        this.vars = JSON.parse(saved)
      } else {
        this.initDefaults()
      }
    } catch (e) {
      console.warn('[Environment] 加载失败:', e)
      this.initDefaults()
    }
  }

  private initDefaults(): void {
    this.vars = [
      { key: 'PATH', value: '/bin:/usr/bin:/System/bin', scope: 'system' },
      { key: 'USERNAME', value: 'user', scope: 'system' },
      { key: 'OS', value: 'HTOS', scope: 'system' },
      { key: 'HOME', value: '/Users/user', scope: 'system' },
      { key: 'SHELL', value: '/bin/terminal', scope: 'system' },
      { key: 'TEMP', value: '/System/Temp', scope: 'system' },
      { key: 'APPDATA', value: '/System/AppData', scope: 'user' },
      { key: 'USERPROFILE', value: '/Users/user', scope: 'user' }
    ]
    this.save()
  }

  private save(): void {
    try {
      localStorage.setItem(Environment.STORAGE_KEY, JSON.stringify(this.vars))
    } catch (e) {
      console.warn('[Environment] 保存失败:', e)
    }
    this.notify()
  }

  // 获取所有变量
  getAll(): EnvVar[] {
    return [...this.vars]
  }

  // 按范围获取
  getByScope(scope: 'system' | 'user'): EnvVar[] {
    return this.vars.filter(v => v.scope === scope)
  }

  // 获取变量值（user 优先于 system）
  get(key: string): string | null {
    // user 优先
    const userVar = this.vars.find(v => v.scope === 'user' && v.key === key)
    if (userVar) return userVar.value
    const sysVar = this.vars.find(v => v.scope === 'system' && v.key === key)
    return sysVar ? sysVar.value : null
  }

  // 设置变量（不存在则新增，存在则更新）
  set(key: string, value: string, scope: 'system' | 'user'): void {
    const idx = this.vars.findIndex(v => v.key === key && v.scope === scope)
    if (idx >= 0) {
      this.vars[idx].value = value
    } else {
      this.vars.push({ key, value, scope })
    }
    this.save()
  }

  // 删除变量
  remove(key: string, scope: 'system' | 'user'): boolean {
    const idx = this.vars.findIndex(v => v.key === key && v.scope === scope)
    if (idx < 0) return false
    this.vars.splice(idx, 1)
    this.save()
    return true
  }

  // 转换为 key=value 格式（用于终端导出）
  toExportFormat(scope?: 'system' | 'user'): string[] {
    const filtered = scope ? this.getByScope(scope) : this.vars
    return filtered.map(v => `${v.key}=${v.value}`)
  }

  // 转为对象（合并 system 和 user，user 优先）
  toObject(): Record<string, string> {
    const obj: Record<string, string> = {}
    for (const v of this.vars) {
      if (v.scope === 'system') obj[v.key] = v.value
    }
    // user 覆盖 system
    for (const v of this.vars) {
      if (v.scope === 'user') obj[v.key] = v.value
    }
    return obj
  }

  onChange(cb: () => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  private notify(): void {
    for (const l of this.listeners) {
      try { l() } catch (e) { console.warn('[Environment] 监听器出错:', e) }
    }
  }
}
