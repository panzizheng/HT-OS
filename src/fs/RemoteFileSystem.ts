import type { FileSystemItem } from '../kernel/types'

/**
 * 远程文件系统 - 通过 HTTP API 与后端服务通信
 * 实现与本地 FileSystem 相同的接口，可无缝替换
 */
export class RemoteFileSystem {
  private baseUrl: string
  private isAvailable: boolean = false

  constructor(baseUrl: string = '/api/fs') {
    this.baseUrl = baseUrl
  }

  async init(): Promise<boolean> {
    try {
      const res = await fetch('/api/health', { credentials: 'include' })
      if (res.ok) {
        this.isAvailable = true
        await this.initDefaults()
        return true
      }
    } catch {
      // 后端不可用
    }
    this.isAvailable = false
    return false
  }

  /** 初始化默认文件夹和欢迎文件（后端已自动为每位用户创建） */
  private async initDefaults(): Promise<void> {
    // 后端会在用户首次访问时自动创建 Windows 风格目录结构
    // 并写入 welcome.txt，前端无需重复创建
    console.log('[RemoteFS] 已连接到后端文件服务')
  }

  get available(): boolean {
    return this.isAvailable
  }

  private async request<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(this.baseUrl + url, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...options
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '请求失败' }))
      throw new Error(err.error || `HTTP ${res.status}`)
    }
    return res.json()
  }

  async listFiles(parentPathOrId: string | null = '/'): Promise<FileSystemItem[]> {
    const path = parentPathOrId === null ? '/' : parentPathOrId
    const data = await this.request<any>(`/list?path=${encodeURIComponent(path)}`)
    return data.items.map((item: any) => this.toFileSystemItem(item))
  }

  async getItem(itemPath: string): Promise<FileSystemItem | null> {
    try {
      const data = await this.request<any>(`/stat?path=${encodeURIComponent(itemPath)}`)
      return this.toFileSystemItem(data)
    } catch {
      return null
    }
  }

  async getByPath(path: string): Promise<FileSystemItem | null> {
    return this.getItem('/' + path.replace(/^\//, ''))
  }

  async createFolder(name: string, parentPath: string | null): Promise<FileSystemItem> {
    const parent = parentPath === null ? '/' : parentPath
    const targetPath = parent === '/' ? '/' + name : parent + '/' + name
    const data = await this.request<any>('/mkdir', {
      method: 'POST',
      body: JSON.stringify({ path: targetPath })
    })
    return this.toFileSystemItem(data.stat)
  }

  async writeFile(filePath: string, content: string): Promise<FileSystemItem> {
    const data = await this.request<any>('/write', {
      method: 'POST',
      body: JSON.stringify({ path: filePath, content })
    })
    return this.toFileSystemItem(data.stat)
  }

  async createFile(name: string, content: string, parentPath: string | null): Promise<FileSystemItem> {
    const parent = parentPath === null ? '/' : parentPath
    const targetPath = parent === '/' ? '/' + name : parent + '/' + name
    return this.writeFile(targetPath, content)
  }

  async readFile(filePath: string): Promise<string | null> {
    try {
      const data = await this.request<any>(`/read?path=${encodeURIComponent(filePath)}`)
      return data.content
    } catch {
      return null
    }
  }

  async deleteItem(itemPath: string): Promise<void> {
    await this.request<any>('/delete', {
      method: 'DELETE',
      body: JSON.stringify({ path: itemPath })
    })
  }

  async rename(itemPath: string, newName: string): Promise<void> {
    await this.request<any>('/rename', {
      method: 'POST',
      body: JSON.stringify({ oldPath: itemPath, newName })
    })
  }

  async move(itemPath: string, newParentPath: string | null): Promise<void> {
    const parent = newParentPath === null ? '/' : newParentPath
    const targetPath = parent === '/'
      ? '/' + itemPath.split('/').pop()
      : parent + '/' + itemPath.split('/').pop()
    await this.request<any>('/move', {
      method: 'POST',
      body: JSON.stringify({ source: itemPath, target: targetPath })
    })
  }

  async copy(itemPath: string, newParentPath: string | null): Promise<FileSystemItem | null> {
    const parent = newParentPath === null ? '/' : newParentPath
    const data = await this.request<any>('/copy', {
      method: 'POST',
      body: JSON.stringify({ source: itemPath, target: parent })
    })
    return data.stat ? this.toFileSystemItem(data.stat) : null
  }

  async getPath(itemPath: string): Promise<string> {
    return itemPath
  }

  async search(keyword: string, parentPath?: string | null): Promise<FileSystemItem[]> {
    const path = parentPath || '/'
    const data = await this.request<any>(
      `/search?keyword=${encodeURIComponent(keyword)}&path=${encodeURIComponent(path)}`
    )
    return data.results.map((item: any) => this.toFileSystemItem(item))
  }

  /** 上传本地文件到指定目录（targetPath 如 '/' 或 '/Desktop'） */
  async uploadFile(file: File, targetPath: string): Promise<FileSystemItem> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('path', targetPath || '/')
    const res = await fetch(this.baseUrl + '/upload', {
      method: 'POST',
      credentials: 'include',
      body: formData
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '上传失败' }))
      throw new Error(err.error || `HTTP ${res.status}`)
    }
    const data = await res.json()
    return this.toFileSystemItem(data.stat)
  }

  private toFileSystemItem(data: any): FileSystemItem {
    return {
      id: data.path,
      name: data.name,
      type: data.type,
      parentId: this.getParentPath(data.path),
      content: undefined,
      created: data.created,
      modified: data.modified,
      size: data.size,
      mimeType: data.mimeType
    }
  }

  private getParentPath(fullPath: string): string | null {
    const parts = fullPath.split('/').filter(Boolean)
    parts.pop()
    if (parts.length === 0) return null
    return '/' + parts.join('/')
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '请求失败' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}
