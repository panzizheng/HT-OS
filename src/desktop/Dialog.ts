/**
 * 系统级对话框组件
 * 替代浏览器原生 alert / confirm / prompt
 * 支持 alert（信息提示）、confirm（确认）、prompt（输入）三种模式
 * 以及文件打开/保存/文件夹选择对话框
 */
export class Dialog {
  private static instance: Dialog | null = null
  private overlay: HTMLElement | null = null
  private currentResolve: ((value: any) => void) | null = null
  private keyHandler: ((e: KeyboardEvent) => void) | null = null
  private isClosing = false

  static getInstance(): Dialog {
    if (!Dialog.instance) {
      Dialog.instance = new Dialog()
    }
    return Dialog.instance
  }

  /** 显示信息提示框（单按钮） */
  alert(message: string, title = '提示'): Promise<void> {
    return this.show({ type: 'alert', message, title })
  }

  /** 显示确认对话框（双按钮） */
  confirm(message: string, title = '确认'): Promise<boolean> {
    return this.show({ type: 'confirm', message, title })
  }

  /** 显示输入对话框（带输入框） */
  prompt(message: string, defaultValue = '', title = '输入'): Promise<string | null> {
    return this.show({ type: 'prompt', message, title, defaultValue })
  }

  /** 显示文件打开对话框，返回选中的文件完整路径或 null */
  showOpenDialog(fs: any, options?: {
    title?: string
    filters?: string[]
    defaultPath?: string
  }): Promise<string | null> {
    return this.showFileDialog(fs, {
      mode: 'open',
      title: options?.title || '打开文件',
      filters: options?.filters,
      defaultPath: options?.defaultPath || ''
    })
  }

  /** 显示文件保存对话框，返回保存路径或 null */
  showSaveDialog(fs: any, options?: {
    title?: string
    filters?: string[]
    defaultPath?: string
    defaultName?: string
  }): Promise<string | null> {
    return this.showFileDialog(fs, {
      mode: 'save',
      title: options?.title || '保存文件',
      filters: options?.filters,
      defaultPath: options?.defaultPath || '',
      defaultName: options?.defaultName || '未命名'
    })
  }

  /** 显示文件夹选择对话框，返回选中的文件夹路径或 null */
  showFolderDialog(fs: any, options?: {
    title?: string
    defaultPath?: string
  }): Promise<string | null> {
    return this.showFileDialog(fs, {
      mode: 'folder',
      title: options?.title || '选择文件夹',
      defaultPath: options?.defaultPath || ''
    })
  }

  /** 文件对话框内部实现 */
  private showFileDialog(fs: any, options: {
    mode: 'open' | 'save' | 'folder'
    title: string
    filters?: string[]
    defaultPath?: string
    defaultName?: string
  }): Promise<string | null> {
    return new Promise(async (resolve) => {
      this.forceClosePending()
      this.currentResolve = resolve

      let currentPath = options.defaultPath || ''
      const overlay = document.createElement('div')
      overlay.className = 'ht-dialog-overlay'

      const box = document.createElement('div')
      box.className = 'ht-dialog-box'
      box.style.width = '480px'
      box.style.maxWidth = '90vw'

      // 标题栏
      const header = document.createElement('div')
      header.className = 'ht-dialog-header'
      header.textContent = options.title
      box.appendChild(header)

      // 内容区
      const body = document.createElement('div')
      body.className = 'ht-dialog-body'

      // 路径栏
      const pathBar = document.createElement('div')
      pathBar.style.cssText = 'display:flex;align-items:center;gap:4px;margin-bottom:8px;font-size:13px;'
      const pathLabel = document.createElement('span')
      pathLabel.textContent = '路径:'
      pathLabel.style.color = '#666'
      const pathInput = document.createElement('input')
      pathInput.type = 'text'
      pathInput.style.cssText = 'flex:1;padding:4px 8px;border:1px solid #ccc;border-radius:4px;font-size:13px;'
      pathInput.value = currentPath || '/'
      pathInput.readOnly = options.mode !== 'save'
      pathBar.appendChild(pathLabel)
      pathBar.appendChild(pathInput)
      body.appendChild(pathBar)

      // 文件列表区
      const listContainer = document.createElement('div')
      listContainer.style.cssText = 'border:1px solid #ddd;border-radius:4px;max-height:280px;overflow-y:auto;background:#fff;'
      body.appendChild(listContainer)

      // 文件名输入（仅 save 模式）
      let nameInput: HTMLInputElement | null = null
      if (options.mode === 'save') {
        const nameBar = document.createElement('div')
        nameBar.style.cssText = 'display:flex;align-items:center;gap:4px;margin-top:8px;font-size:13px;'
        const nameLabel = document.createElement('span')
        nameLabel.textContent = '文件名:'
        nameLabel.style.color = '#666'
        nameInput = document.createElement('input')
        nameInput.type = 'text'
        nameInput.style.cssText = 'flex:1;padding:4px 8px;border:1px solid #ccc;border-radius:4px;font-size:13px;'
        nameInput.value = options.defaultName || ''
        nameBar.appendChild(nameLabel)
        nameBar.appendChild(nameInput)
        body.appendChild(nameBar)
      }

      box.appendChild(body)

      // 按钮区
      const footer = document.createElement('div')
      footer.className = 'ht-dialog-footer'

      const confirmBtn = document.createElement('button')
      confirmBtn.className = 'ht-dialog-btn ht-dialog-btn-primary'
      confirmBtn.textContent = options.mode === 'save' ? '保存' : '选择'
      confirmBtn.addEventListener('click', () => {
        if (options.mode === 'save' && nameInput) {
          const name = nameInput.value.trim()
          if (!name) return
          const fullPath = currentPath ? `${currentPath}/${name}` : `/${name}`
          this.resolve(fullPath)
        } else {
          this.resolve(null)
        }
      })

      const cancelBtn = document.createElement('button')
      cancelBtn.className = 'ht-dialog-btn'
      cancelBtn.textContent = '取消'
      cancelBtn.addEventListener('click', () => {
        this.resolve(null)
      })

      footer.appendChild(confirmBtn)
      footer.appendChild(cancelBtn)
      box.appendChild(footer)
      overlay.appendChild(box)
      document.body.appendChild(overlay)

      // 动画
      requestAnimationFrame(() => {
        overlay.classList.add('visible')
      })

      this.overlay = overlay
      this.isClosing = false

      // 渲染文件列表
      const renderList = async () => {
        const cleanPath = currentPath.replace(/^\//, '')
        let items: any[] = []
        try {
          const folder = cleanPath ? await fs.getByPath(cleanPath) : null
          items = await fs.listFiles(folder?.id || null)
        } catch { items = [] }

        listContainer.innerHTML = ''

        // 返回上级
        if (currentPath) {
          const upItem = document.createElement('div')
          upItem.style.cssText = 'padding:6px 12px;cursor:pointer;display:flex;align-items:center;gap:6px;font-size:13px;border-bottom:1px solid #eee;'
          upItem.innerHTML = '<span style="color:#0078d4;">📁</span> 返回上级'
          upItem.addEventListener('click', () => {
            const parts = currentPath.split('/').filter(Boolean)
            parts.pop()
            currentPath = '/' + parts.join('/')
            pathInput.value = currentPath || '/'
            renderList()
          })
          upItem.addEventListener('mouseenter', () => { upItem.style.background = '#f0f7ff' })
          upItem.addEventListener('mouseleave', () => { upItem.style.background = '' })
          listContainer.appendChild(upItem)
        }

        // 过滤
        const filtered = items.filter((item: any) => {
          if (options.mode === 'folder') return item.type === 'folder'
          if (options.filters && options.filters.length > 0 && item.type === 'file') {
            const ext = item.name.split('.').pop()?.toLowerCase() || ''
            return options.filters.some(f => {
              const fe = f.replace(/^\*\./, '').toLowerCase()
              return fe === '*' || fe === ext
            })
          }
          return true
        })

        // 排序：文件夹优先
        filtered.sort((a: any, b: any) => {
          if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
          return a.name.localeCompare(b.name)
        })

        for (const item of filtered) {
          const row = document.createElement('div')
          row.style.cssText = 'padding:6px 12px;cursor:pointer;display:flex;align-items:center;gap:6px;font-size:13px;border-bottom:1px solid #f5f5f5;'
          const icon = item.type === 'folder' ? '📁' : '📄'
          row.innerHTML = `<span>${icon}</span> <span>${item.name}</span>`

          if (options.mode === 'save' || (options.mode === 'open' && item.type === 'file')) {
            row.addEventListener('click', () => {
              if (item.type === 'folder') {
                currentPath = currentPath ? `${currentPath}/${item.name}` : `/${item.name}`
                pathInput.value = currentPath
                renderList()
              } else {
                // 选中文件
                const fullPath = currentPath ? `${currentPath}/${item.name}` : `/${item.name}`
                if (options.mode === 'open') {
                  this.resolve(fullPath)
                } else {
                  if (nameInput) nameInput.value = item.name
                }
              }
            })
          } else {
            row.addEventListener('click', () => {
              if (item.type === 'folder') {
                currentPath = currentPath ? `${currentPath}/${item.name}` : `/${item.name}`
                pathInput.value = currentPath
                renderList()
              }
            })
          }

          if (options.mode === 'folder' && item.type === 'folder') {
            row.addEventListener('dblclick', () => {
              this.resolve(currentPath ? `${currentPath}/${item.name}` : `/${item.name}`)
            })
          }

          row.addEventListener('mouseenter', () => { row.style.background = '#f0f7ff' })
          row.addEventListener('mouseleave', () => { row.style.background = '' })
          listContainer.appendChild(row)
        }

        // 空列表
        if (filtered.length === 0 && !currentPath) {
          const empty = document.createElement('div')
          empty.style.cssText = 'padding:20px;text-align:center;color:#999;font-size:13px;'
          empty.textContent = '没有文件'
          listContainer.appendChild(empty)
        }
      }

      renderList()
    })
  }

  private show(options: {
    type: 'alert' | 'confirm' | 'prompt'
    message: string
    title: string
    defaultValue?: string
  }): Promise<any> {
    return new Promise((resolve) => {
      // 关闭上一个对话框，但要 resolve 它的 Promise
      this.forceClosePending()
      this.currentResolve = resolve

      const overlay = document.createElement('div')
      overlay.className = 'ht-dialog-overlay'

      const box = document.createElement('div')
      box.className = 'ht-dialog-box'

      // 标题栏
      const header = document.createElement('div')
      header.className = 'ht-dialog-header'
      header.textContent = options.title
      box.appendChild(header)

      // 内容区
      const body = document.createElement('div')
      body.className = 'ht-dialog-body'

      // 图标 + 消息
      const content = document.createElement('div')
      content.className = 'ht-dialog-content'

      const icon = document.createElement('div')
      icon.className = `ht-dialog-icon ht-dialog-icon-${options.type === 'confirm' ? 'confirm' : options.type === 'prompt' ? 'prompt' : 'info'}`
      icon.innerHTML = this.getIconSvg(options.type)
      content.appendChild(icon)

      const msgWrap = document.createElement('div')
      msgWrap.className = 'ht-dialog-message-wrap'

      const msg = document.createElement('div')
      msg.className = 'ht-dialog-message'
      msg.textContent = options.message
      msgWrap.appendChild(msg)

      // 输入框（prompt 模式）
      let inputEl: HTMLInputElement | null = null
      if (options.type === 'prompt') {
        inputEl = document.createElement('input')
        inputEl.type = 'text'
        inputEl.className = 'ht-dialog-input'
        inputEl.value = options.defaultValue || ''
        inputEl.autocomplete = 'off'
        msgWrap.appendChild(inputEl)
      }

      content.appendChild(msgWrap)
      body.appendChild(content)
      box.appendChild(body)

      // 按钮区
      const footer = document.createElement('div')
      footer.className = 'ht-dialog-footer'

      const confirmBtn = document.createElement('button')
      confirmBtn.className = 'ht-dialog-btn ht-dialog-btn-primary'
      confirmBtn.textContent = '确定'
      confirmBtn.addEventListener('click', () => {
        if (options.type === 'prompt' && inputEl) {
          this.resolve(inputEl.value)
        } else if (options.type === 'confirm') {
          this.resolve(true)
        } else {
          this.resolve(undefined)
        }
      })
      footer.appendChild(confirmBtn)

      if (options.type === 'confirm' || options.type === 'prompt') {
        const cancelBtn = document.createElement('button')
        cancelBtn.className = 'ht-dialog-btn'
        cancelBtn.textContent = '取消'
        cancelBtn.addEventListener('click', () => {
          if (options.type === 'prompt') {
            this.resolve(null)
          } else {
            this.resolve(false)
          }
        })
        footer.appendChild(cancelBtn)
      }

      box.appendChild(footer)
      overlay.appendChild(box)
      document.body.appendChild(overlay)

      // 动画
      requestAnimationFrame(() => {
        overlay.classList.add('visible')
        if (inputEl) {
          setTimeout(() => inputEl!.focus(), 50)
        }
      })

      this.overlay = overlay
      this.isClosing = false

      // 键盘事件
      this.keyHandler = (e: KeyboardEvent) => {
        // 防止在输入框中按 Enter 触发表单提交
        if (e.key === 'Enter') {
          if (inputEl && document.activeElement === inputEl) {
            // 在输入框中按 Enter 触发确认
            e.preventDefault()
            confirmBtn.click()
          } else if (!inputEl) {
            e.preventDefault()
            confirmBtn.click()
          }
          // 如果焦点不在输入框上且不是 Enter 型对话框，忽略
        } else if (e.key === 'Escape') {
          e.preventDefault()
          if (options.type === 'confirm') {
            this.resolve(false)
          } else if (options.type === 'prompt') {
            this.resolve(null)
          } else {
            this.resolve(undefined)
          }
        }
      }
      document.addEventListener('keydown', this.keyHandler)

      // 点击遮罩关闭（仅 alert）
      if (options.type === 'alert') {
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) {
            this.resolve(undefined)
          }
        })
      }
    })
  }

  private resolve(value: any): void {
    if (this.isClosing) return
    this.isClosing = true
    if (this.currentResolve) {
      this.currentResolve(value)
      this.currentResolve = null
    }
    this.closeOverlay()
  }

  /** 强制关闭上一个对话框（用于替换时） */
  private forceClosePending(): void {
    if (this.currentResolve) {
      // 用默认值 resolve，防止等待中的 Promise 永远挂起
      // 对于被替换的对话框，根据类型给出合理默认值
      this.currentResolve(null)
      this.currentResolve = null
    }
    this.closeOverlay()
    this.isClosing = false
  }

  private closeOverlay(): void {
    if (this.keyHandler) {
      document.removeEventListener('keydown', this.keyHandler)
      this.keyHandler = null
    }
    if (this.overlay) {
      const el = this.overlay
      el.classList.remove('visible')
      el.classList.add('hiding')
      this.overlay = null
      setTimeout(() => {
        el.remove()
      }, 250)
    }
  }

  private getIconSvg(type: string): string {
    if (type === 'confirm') {
      return `<svg viewBox="0 0 48 48" width="32" height="32"><circle cx="24" cy="24" r="22" fill="none" stroke="#f59e0b" stroke-width="3"/><text x="24" y="34" font-size="28" font-weight="bold" fill="#f59e0b" text-anchor="middle">?</text></svg>`
    }
    if (type === 'prompt') {
      return `<svg viewBox="0 0 48 48" width="32" height="32"><circle cx="24" cy="24" r="22" fill="none" stroke="#0078d4" stroke-width="3"/><text x="24" y="34" font-size="26" font-weight="bold" fill="#0078d4" text-anchor="middle">i</text></svg>`
    }
    return `<svg viewBox="0 0 48 48" width="32" height="32"><circle cx="24" cy="24" r="22" fill="none" stroke="#0078d4" stroke-width="3"/><path d="M24 14 v12 M24 30 v2" stroke="#0078d4" stroke-width="3" stroke-linecap="round"/></svg>`
  }
}

/** 全局便捷函数 */
export const dialog = Dialog.getInstance()
