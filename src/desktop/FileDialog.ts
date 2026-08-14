/**
 * 系统级文件选择对话框
 * 类似 Windows 的打开/保存对话框，支持浏览目录、选择文件
 */
import type { FileSystem } from '../fs/FileSystem'
import type { FileSystemItem } from '../kernel/types'

export interface FileDialogOptions {
  /** 对话框标题 */
  title?: string
  /** 默认目录路径，如 'Documents' */
  defaultDir?: string
  /** 默认文件名（保存对话框使用） */
  defaultName?: string
  /** 文件扩展名过滤器，如 ['.e', '.epp']；为空表示显示所有文件 */
  filters?: string[]
  /** 是否只显示文件夹（用于选择目录） */
  folderOnly?: boolean
  /** 按钮文字 */
  okLabel?: string
}

export interface FileDialogResult {
  /** 文件名 */
  name: string
  /** 完整路径（不含开头的 /） */
  path: string
}

const FOLDER_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="#f5c542" stroke="#e0a800" stroke-width="1"><path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/></svg>'
const FILE_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="#ffffff" stroke="#888" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'

/**
 * 显示文件打开对话框
 * 返回用户选择的文件信息，取消则返回 null
 */
export function showOpenFileDialog(fs: FileSystem, options: FileDialogOptions = {}): Promise<FileDialogResult | null> {
  return showFileDialog(fs, 'open', options)
}

/**
 * 显示文件保存对话框
 * 返回用户选择的保存路径，取消则返回 null
 */
export function showSaveFileDialog(fs: FileSystem, options: FileDialogOptions = {}): Promise<FileDialogResult | null> {
  return showFileDialog(fs, 'save', options)
}

function showFileDialog(
  fs: FileSystem,
  mode: 'open' | 'save',
  options: FileDialogOptions
): Promise<FileDialogResult | null> {
  return new Promise((resolve) => {
    const title = options.title || (mode === 'open' ? '打开' : '另存为')
    const okLabel = options.okLabel || (mode === 'open' ? '打开' : '保存')
    const filters = options.filters || []
    const folderOnly = options.folderOnly || false

    let currentDir = options.defaultDir || '/'
    if (!currentDir.startsWith('/')) currentDir = '/' + currentDir
    currentDir = currentDir.replace(/\/+/g, '/').replace(/\/$/, '') || '/'

    const overlay = document.createElement('div')
    overlay.className = 'ht-dialog-overlay'
    overlay.style.zIndex = '100000'

    const dlg = document.createElement('div')
    dlg.className = 'ht-dialog-box file-dialog'
    dlg.style.width = '560px'

    dlg.innerHTML = `
      <div class="ht-dialog-header">
        <span class="ht-dialog-title">${title}</span>
      </div>
      <div class="file-dialog-body">
        <div class="fd-path-bar">
          <button class="fd-up" title="上级目录">↑</button>
          <button class="fd-home" title="根目录">🏠</button>
          <span class="fd-path" id="fd-path">/</span>
        </div>
        <div class="fd-filelist" id="fd-filelist"></div>
        <div class="fd-input-row">
          <span>文件名:</span>
          <input type="text" class="fd-filename" id="fd-filename" value="${(options.defaultName || '').replace(/"/g, '&quot;')}">
        </div>
      </div>
      <div class="ht-dialog-footer">
        <button class="ht-dialog-btn ht-dialog-btn-cancel" id="fd-cancel">取消</button>
        <button class="ht-dialog-btn ht-dialog-btn-primary" id="fd-ok">${okLabel}</button>
      </div>
    `

    overlay.appendChild(dlg)
    document.body.appendChild(overlay)

    requestAnimationFrame(() => {
      overlay.classList.add('visible')
    })

    const pathEl = dlg.querySelector('#fd-path') as HTMLElement
    const listEl = dlg.querySelector('#fd-filelist') as HTMLElement
    const nameInput = dlg.querySelector('#fd-filename') as HTMLInputElement
    const upBtn = dlg.querySelector('.fd-up') as HTMLButtonElement
    const homeBtn = dlg.querySelector('.fd-home') as HTMLButtonElement
    const okBtn = dlg.querySelector('#fd-ok') as HTMLButtonElement
    const cancelBtn = dlg.querySelector('#fd-cancel') as HTMLButtonElement

    let selectedItem: FileSystemItem | null = null

    const matchesFilter = (name: string): boolean => {
      if (filters.length === 0) return true
      const lower = name.toLowerCase()
      return filters.some(f => lower.endsWith(f.toLowerCase()))
    }

    const loadDir = async (dirPath: string) => {
      currentDir = dirPath || '/'
      pathEl.textContent = currentDir
      listEl.innerHTML = '<div style="padding:20px;text-align:center;color:#888;">加载中...</div>'
      selectedItem = null

      try {
        const cleanPath = currentDir.replace(/^\//, '')
        let items: FileSystemItem[] = []

        if (cleanPath === '') {
          items = await fs.listFiles(null)
        } else {
          const dirItem = await fs.getByPath(cleanPath)
          if (dirItem) {
            items = await fs.listFiles(dirItem.id)
          }
        }

        const visibleItems = items.filter(i => {
          if (i.type === 'folder') return true
          if (folderOnly) return false
          return matchesFilter(i.name)
        })

        if (visibleItems.length === 0) {
          listEl.innerHTML = '<div style="padding:20px;text-align:center;color:#888;">此文件夹为空</div>'
          return
        }

        listEl.innerHTML = ''
        visibleItems.forEach(item => {
          const row = document.createElement('div')
          row.className = 'fd-item'
          row.innerHTML = `${item.type === 'folder' ? FOLDER_ICON : FILE_ICON}<span class="fd-item-name">${item.name}</span>`

          if (item.type === 'folder') {
            row.addEventListener('dblclick', () => {
              const newPath = currentDir === '/' ? '/' + item.name : currentDir + '/' + item.name
              loadDir(newPath)
            })
          } else {
            row.addEventListener('dblclick', () => {
              const dir = currentDir.replace(/^\//, '')
              const fullPath = dir ? dir + '/' + item.name : item.name
              close({ name: item.name, path: fullPath })
            })
          }

          row.addEventListener('click', () => {
            listEl.querySelectorAll('.fd-item').forEach(el => el.classList.remove('selected'))
            row.classList.add('selected')
            selectedItem = item
            if (item.type === 'file') {
              nameInput.value = item.name
            }
          })

          listEl.appendChild(row)
        })
      } catch {
        listEl.innerHTML = '<div style="padding:20px;text-align:center;color:#c00;">加载失败</div>'
      }
    }

    loadDir(currentDir)

    upBtn.addEventListener('click', () => {
      if (currentDir === '/') return
      const parts = currentDir.split('/').filter(Boolean)
      parts.pop()
      loadDir('/' + parts.join('/'))
    })

    homeBtn.addEventListener('click', () => loadDir('/'))

    const close = (result: FileDialogResult | null) => {
      overlay.remove()
      resolve(result)
    }

    const doOk = () => {
      if (mode === 'save') {
        const name = nameInput.value.trim()
        if (!name) {
          nameInput.focus()
          return
        }
        if (currentDir === '/') {
          // 根目录不允许保存，提示选择子目录
          nameInput.focus()
          return
        }
        const dir = currentDir.replace(/^\//, '')
        const fullPath = dir ? dir + '/' + name : name
        close({ name, path: fullPath })
      } else {
        // 打开模式
        if (folderOnly) {
          const dir = currentDir.replace(/^\//, '')
          close({ name: dir.split('/').pop() || '', path: dir })
          return
        }
        if (selectedItem && selectedItem.type === 'file') {
          const dir = currentDir.replace(/^\//, '')
          const fullPath = dir ? dir + '/' + selectedItem.name : selectedItem.name
          close({ name: selectedItem.name, path: fullPath })
        } else {
          const name = nameInput.value.trim()
          if (name) {
            const dir = currentDir.replace(/^\//, '')
            const fullPath = dir ? dir + '/' + name : name
            close({ name, path: fullPath })
          } else {
            nameInput.focus()
          }
        }
      }
    }

    okBtn.addEventListener('click', doOk)
    cancelBtn.addEventListener('click', () => close(null))

    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doOk()
      else if (e.key === 'Escape') close(null)
    })

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(null)
    })

    setTimeout(() => {
      nameInput.focus()
      nameInput.select()
    }, 100)
  })
}
