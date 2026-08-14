// ============================================================
// 注册表 - 分层键值存储，类似 Windows 注册表
// 路径格式：HKEY_LOCAL_MACHINE\Software\HTOS\Settings
// 支持根键：HKEY_LOCAL_MACHINE (系统), HKEY_CURRENT_USER (用户), HKEY_CLASSES_ROOT (文件关联)
// 持久化到 localStorage
// ============================================================

// 注册表值类型
export type RegValue = string | number | boolean | null

// 注册表项
export interface RegKey {
  name: string
  children: Map<string, RegKey>
  values: Map<string, RegValue>
}

// 根键名称
export const HKLM = 'HKEY_LOCAL_MACHINE'
export const HKCU = 'HKEY_CURRENT_USER'
export const HKCR = 'HKEY_CLASSES_ROOT'

const ROOT_KEYS = [HKLM, HKCU, HKCR]

export class Registry {
  private static STORAGE_KEY = 'ht-os-registry'
  private roots: Map<string, RegKey> = new Map()
  private listeners: Set<() => void> = new Set()

  constructor() {
    this.load()
  }

  // 创建空键
  private createKey(name: string): RegKey {
    return { name, children: new Map(), values: new Map() }
  }

  // 加载持久化数据
  private load(): void {
    try {
      const saved = localStorage.getItem(Registry.STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        for (const rootName of ROOT_KEYS) {
          const root = this.createKey(rootName)
          if (data[rootName]) {
            this.deserializeKey(root, data[rootName])
          }
          this.roots.set(rootName, root)
        }
      } else {
        this.initDefaults()
      }
    } catch (e) {
      console.warn('[Registry] 加载失败，使用默认值:', e)
      this.initDefaults()
    }
  }

  // 反序列化键
  private deserializeKey(key: RegKey, data: any): void {
    if (data.values) {
      for (const v of data.values) {
        key.values.set(v[0], v[1])
      }
    }
    if (data.children) {
      for (const c of data.children) {
        const child = this.createKey(c[0])
        this.deserializeKey(child, c[1])
        key.children.set(c[0], child)
      }
    }
  }

  // 保存到 localStorage
  private save(): void {
    try {
      const data: any = {}
      for (const [name, root] of this.roots) {
        data[name] = this.serializeKey(root)
      }
      localStorage.setItem(Registry.STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      console.warn('[Registry] 保存失败:', e)
    }
    this.notifyChange()
  }

  private serializeKey(key: RegKey): any {
    return {
      values: Array.from(key.values.entries()),
      children: Array.from(key.children.entries()).map(([n, c]) => [n, this.serializeKey(c)])
    }
  }

  // 初始化默认注册表项
  private initDefaults(): void {
    for (const rootName of ROOT_KEYS) {
      this.roots.set(rootName, this.createKey(rootName))
    }

    // HKLM\SOFTWARE\HTOS - 系统信息
    const hklm = this.roots.get(HKLM)!
    const software = this.getOrCreateChild(hklm, 'SOFTWARE')
    const htos = this.getOrCreateChild(software, 'HTOS')
    htos.values.set('Version', '1.0.0')
    htos.values.set('BuildNumber', '20260724')
    htos.values.set('InstallDate', Date.now())
    htos.values.set('ProductName', 'HT OS')

    // HKLM\SYSTEM\CurrentControlSet - 系统配置
    const system = this.getOrCreateChild(hklm, 'SYSTEM')
    const ccs = this.getOrCreateChild(system, 'CurrentControlSet')
    const control = this.getOrCreateChild(ccs, 'Control')
    const sessionMan = this.getOrCreateChild(control, 'Session Manager')
    sessionMan.values.set('PowerTimeout', '300')
    sessionMan.values.set('Shell', 'explorer.exe')

    // HKCU\Software\HTOS - 用户配置
    const hkcu = this.roots.get(HKCU)!
    const userSoftware = this.getOrCreateChild(hkcu, 'Software')
    const userHtos = this.getOrCreateChild(userSoftware, 'HTOS')
    userHtos.values.set('ThemeColor', '#0078d4')
    userHtos.values.set('Wallpaper', 'default')
    userHtos.values.set('TaskbarPosition', 'bottom')
    const desktop = this.getOrCreateChild(userHtos, 'Desktop')
    desktop.values.set('IconSpacing', 92)
    desktop.values.set('AutoArrange', 0)

    // HKCR - 文件关联
    const hkcr = this.roots.get(HKCR)!
    const txtKey = this.getOrCreateChild(hkcr, '.txt')
    txtKey.values.set('', 'txtfile')
    const txtfile = this.getOrCreateChild(hkcr, 'txtfile')
    txtfile.values.set('EditHandler', 'notepad')
    const pdfKey = this.getOrCreateChild(hkcr, '.pdf')
    pdfKey.values.set('', 'pdffile')
    const pdffile = this.getOrCreateChild(hkcr, 'pdffile')
    pdffile.values.set('OpenHandler', 'office')

    this.save()
  }

  private getOrCreateChild(parent: RegKey, name: string): RegKey {
    let child = parent.children.get(name)
    if (!child) {
      child = this.createKey(name)
      parent.children.set(name, child)
    }
    return child
  }

  // 通知变更
  private notifyChange(): void {
    for (const l of this.listeners) {
      try { l() } catch (e) { console.warn('[Registry] 监听器出错:', e) }
    }
  }

  // 监听变更
  onChange(cb: () => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  // 规范化路径：返回 [根键, 子路径段数组]
  private parsePath(regPath: string): [RegKey, string[]] | null {
    const parts = regPath.split('\\').filter(p => p.length > 0)
    if (parts.length === 0) return null
    const rootName = parts[0]
    const root = this.roots.get(rootName)
    if (!root) return null
    return [root, parts.slice(1)]
  }

  // 获取指定路径的键（不存在返回 null）
  getKey(regPath: string): RegKey | null {
    const parsed = this.parsePath(regPath)
    if (!parsed) return null
    let [current, parts] = parsed
    for (const p of parts) {
      const next = current.children.get(p)
      if (!next) return null
      current = next
    }
    return current
  }

  // 获取或创建指定路径的键
  private getOrCreateKey(regPath: string): RegKey | null {
    const parsed = this.parsePath(regPath)
    if (!parsed) return null
    let [current, parts] = parsed
    for (const p of parts) {
      current = this.getOrCreateChild(current, p)
    }
    return current
  }

  // 读取值
  getValue(regPath: string, valueName: string): RegValue {
    const key = this.getKey(regPath)
    if (!key) return null
    return key.values.get(valueName) ?? null
  }

  // 写入值（会自动创建不存在的键）
  setValue(regPath: string, valueName: string, value: RegValue): void {
    const key = this.getOrCreateKey(regPath)
    if (!key) return
    key.values.set(valueName, value)
    this.save()
  }

  // 删除值
  deleteValue(regPath: string, valueName: string): boolean {
    const key = this.getKey(regPath)
    if (!key) return false
    const result = key.values.delete(valueName)
    if (result) this.save()
    return result
  }

  // 删除键（包含所有子键和值）
  deleteKey(regPath: string): boolean {
    const parsed = this.parsePath(regPath)
    if (!parsed || parsed[1].length === 0) return false // 不允许删除根键
    const [root, parts] = parsed
    let parent = root
    for (let i = 0; i < parts.length - 1; i++) {
      const next = parent.children.get(parts[i])
      if (!next) return false
      parent = next
    }
    const last = parts[parts.length - 1]
    const result = parent.children.delete(last)
    if (result) this.save()
    return result
  }

  // 创建新键路径（自动创建不存在的中间键）
  createKeyPath(regPath: string): boolean {
    const key = this.getOrCreateKey(regPath)
    if (!key) return false
    this.save()
    return true
  }

  // 列出某键的所有子键名
  listSubKeys(regPath: string): string[] {
    const key = this.getKey(regPath)
    if (!key) return []
    return Array.from(key.children.keys()).sort()
  }

  // 列出某键的所有值（名称+值）
  listValues(regPath: string): Array<{ name: string; value: RegValue }> {
    const key = this.getKey(regPath)
    if (!key) return []
    return Array.from(key.values.entries()).map(([name, value]) => ({ name, value }))
  }

  // 获取所有根键
  getRoots(): string[] {
    return ROOT_KEYS
  }

  // 导出整个注册表为 JSON
  exportAll(): string {
    const data: any = {}
    for (const [name, root] of this.roots) {
      data[name] = this.serializeKey(root)
    }
    return JSON.stringify(data, null, 2)
  }

  // 从 JSON 导入注册表
  importAll(json: string): boolean {
    try {
      const data = JSON.parse(json)
      for (const rootName of ROOT_KEYS) {
        const root = this.createKey(rootName)
        if (data[rootName]) {
          this.deserializeKey(root, data[rootName])
        }
        this.roots.set(rootName, root)
      }
      this.save()
      return true
    } catch (e) {
      console.warn('[Registry] 导入失败:', e)
      return false
    }
  }

  // 重置为默认值
  reset(): void {
    this.initDefaults()
  }
}
