import { WindowManager } from '../wm/WindowManager'
import { FileSystem } from '../fs/FileSystem'
import { ContextMenu } from '../desktop/ContextMenu'
import { dialog } from '../desktop/Dialog'
import { EventBus } from '../kernel/EventBus'

const APP_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#4a90d9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>'

export function registerNotepadApp(wm: WindowManager, fs: FileSystem, eventBus: EventBus): void {
  wm.registerApp({
    id: 'notepad',
    name: '记事本',
    icon: APP_ICON,
    defaultWidth: 640,
    defaultHeight: 480,
    entry: (windowId: string, fileId?: string, fileName?: string, fileContent?: string, filePath?: string) => {
      const win = wm.getWindow(windowId)
      if (!win) return

      const content = win.content
      content.className = 'notepad-app window-content'

      // 当前文件状态
      let currentFileId = fileId || null
      let currentFileName = fileName || '无标题'
      let currentFilePath = filePath || ''
      let isModified = false
      let savedContent = fileContent || ''

      content.innerHTML = `
        <div class="notepad-menubar">
          <div class="menu">
            <span class="menu-label">文件(F)</span>
            <div class="menu-dropdown">
              <div class="menu-item" data-action="new">新建</div>
              <div class="menu-item" data-action="open">打开...</div>
              <div class="menu-item" data-action="save">保存 (Ctrl+S)</div>
              <div class="menu-item" data-action="saveas">另存为...</div>
            </div>
          </div>
          <div class="menu">
            <span class="menu-label">编辑(E)</span>
            <div class="menu-dropdown">
              <div class="menu-item" data-action="undo">撤销 (Ctrl+Z)</div>
              <div class="menu-item" data-action="redo">重做 (Ctrl+Y)</div>
              <div class="menu-separator"></div>
              <div class="menu-item" data-action="selectall">全选 (Ctrl+A)</div>
              <div class="menu-item" data-action="datetime">插入时间/日期 (F5)</div>
            </div>
          </div>
          <div class="menu">
            <span class="menu-label">帮助(H)</span>
            <div class="menu-dropdown">
              <div class="menu-item" data-action="about">关于记事本</div>
            </div>
          </div>
        </div>
        <textarea class="notepad-textarea" placeholder="开始输入..." spellcheck="false">${fileContent || ''}</textarea>
        <div class="notepad-statusbar">
          <span id="status-cursor">行 1, 列 1</span>
          <span id="status-count">0 字符</span>
          <span id="status-modified"></span>
        </div>
      `

      const textarea = content.querySelector('.notepad-textarea') as HTMLTextAreaElement
      const statusCursor = content.querySelector('#status-cursor') as HTMLElement
      const statusCount = content.querySelector('#status-count') as HTMLElement
      const statusModified = content.querySelector('#status-modified') as HTMLElement

      // 更新标题
      const updateTitle = () => {
        const marker = isModified ? ' *' : ''
        win.setTitle(`${currentFileName}${marker} - 记事本`)
        statusModified.textContent = isModified ? '已修改' : '已保存'
        statusModified.style.color = isModified ? '#e74c3c' : '#27ae60'
      }

      // 更新光标位置
      const updateCursorPos = () => {
        const beforeCursor = textarea.value.substring(0, textarea.selectionStart)
        const lines = beforeCursor.split('\n')
        const line = lines.length
        const col = lines[lines.length - 1].length + 1
        statusCursor.textContent = `行 ${line}, 列 ${col}`
      }

      // 更新字符计数
      const updateCharCount = () => {
        statusCount.textContent = `${textarea.value.length} 字符`
      }

      // 检查是否已修改
      const checkModified = () => {
        isModified = textarea.value !== savedContent
        updateTitle()
      }

      // 保存文件：直接覆盖原文件；如果是新文件则弹出另存为对话框
      const saveFile = async (): Promise<boolean> => {
        try {
          if (currentFilePath) {
            // 直接覆盖当前文件
            await fs.writeFile(currentFilePath, textarea.value)
            savedContent = textarea.value
            isModified = false
            updateTitle()
            eventBus.emit('fs:changed')
            return true
          } else {
            // 新文件，走另存为流程
            return await saveAs()
          }
        } catch (e: any) {
          await dialog.alert('保存失败: ' + e.message)
          return false
        }
      }

      // 另存为：弹出文件浏览器让用户选择目录和文件名
      const saveAs = async (): Promise<boolean> => {
        const result = await showSaveAsDialog(currentFileName === '无标题' ? '未命名.txt' : currentFileName, currentFilePath || 'Documents/')
        if (!result) return false

        try {
          await fs.writeFile(result.path, textarea.value)
          currentFileName = result.name
          currentFilePath = result.path
          currentFileId = result.path // 用 path 作为 ID 标识
          savedContent = textarea.value
          isModified = false
          updateTitle()
          eventBus.emit('fs:changed')
          return true
        } catch (e: any) {
          await dialog.alert('保存失败: ' + e.message)
          return false
        }
      }

      // 另存为对话框：浏览目录 + 输入文件名
      const showSaveAsDialog = (defaultName: string, defaultDir: string): Promise<{ name: string, path: string } | null> => {
        return new Promise((resolve) => {
          let currentDir = defaultDir.replace(/\/[^/]*$/, '') || '/'  // 去掉文件名部分，只保留目录
          if (!currentDir.startsWith('/')) currentDir = '/' + currentDir
          currentDir = currentDir.replace(/\/+/g, '/').replace(/\/$/, '') || '/'

          const overlay = document.createElement('div')
          overlay.className = 'ht-dialog-overlay'
          overlay.style.zIndex = '100000'

          const dlg = document.createElement('div')
          dlg.className = 'ht-dialog-box saveas-dialog'
          dlg.style.width = '500px'

          dlg.innerHTML = `
            <div class="ht-dialog-header">
              <span class="ht-dialog-title">另存为</span>
            </div>
            <div class="saveas-body">
              <div class="saveas-path-bar">
                <button class="saveas-up" title="上级目录">↑</button>
                <span class="saveas-path" id="saveas-path">/</span>
              </div>
              <div class="saveas-filelist" id="saveas-filelist"></div>
              <div class="saveas-input-row">
                <span>文件名:</span>
                <input type="text" class="saveas-filename" id="saveas-filename" value="${defaultName.replace(/"/g, '&quot;')}">
              </div>
            </div>
            <div class="ht-dialog-footer">
              <button class="ht-dialog-btn ht-dialog-btn-cancel" id="saveas-cancel">取消</button>
              <button class="ht-dialog-btn ht-dialog-btn-primary" id="saveas-ok">保存</button>
            </div>
          `

          overlay.appendChild(dlg)
          document.body.appendChild(overlay)

          // 触发淡入动画
          requestAnimationFrame(() => {
            overlay.classList.add('visible')
          })

          const pathEl = dlg.querySelector('#saveas-path') as HTMLElement
          const listEl = dlg.querySelector('#saveas-filelist') as HTMLElement
          const nameInput = dlg.querySelector('#saveas-filename') as HTMLInputElement
          const upBtn = dlg.querySelector('.saveas-up') as HTMLButtonElement
          const okBtn = dlg.querySelector('#saveas-ok') as HTMLButtonElement
          const cancelBtn = dlg.querySelector('#saveas-cancel') as HTMLButtonElement

          const loadDir = async (dirPath: string) => {
            currentDir = dirPath || '/'
            pathEl.textContent = currentDir
            listEl.innerHTML = '<div style="padding:20px;text-align:center;color:#888;">加载中...</div>'

            try {
              // 获取目录下的文件夹列表
              const cleanPath = currentDir.replace(/^\//, '')
              let items: any[] = []

              if (cleanPath === '') {
                // 根目录
                items = await fs.listFiles(null)
              } else {
                const dirItem = await fs.getByPath(cleanPath)
                if (dirItem) {
                  items = await fs.listFiles(dirItem.id)
                }
              }

              // 只显示文件夹
              const folders = items.filter(i => i.type === 'folder')

              if (folders.length === 0) {
                listEl.innerHTML = '<div style="padding:20px;text-align:center;color:#888;">没有子文件夹</div>'
                return
              }

              listEl.innerHTML = ''
              folders.forEach(folder => {
                const item = document.createElement('div')
                item.className = 'saveas-folder-item'
                item.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="#f5c542" stroke="#e0a800" stroke-width="1"><path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/></svg><span>${folder.name}</span>`
                item.addEventListener('dblclick', () => {
                  const newPath = currentDir === '/' ? '/' + folder.name : currentDir + '/' + folder.name
                  loadDir(newPath)
                })
                item.addEventListener('click', () => {
                  // 单击选中，但不变更目录
                  listEl.querySelectorAll('.saveas-folder-item').forEach(el => el.classList.remove('selected'))
                  item.classList.add('selected')
                })
                listEl.appendChild(item)
              })
            } catch {
              listEl.innerHTML = '<div style="padding:20px;text-align:center;color:#c00;">加载失败</div>'
            }
          }

          // 初始加载目录
          loadDir(currentDir)

          // 上级目录
          upBtn.addEventListener('click', () => {
            if (currentDir === '/') return
            const parts = currentDir.split('/').filter(Boolean)
            parts.pop()
            loadDir('/' + parts.join('/'))
          })

          const close = (result: { name: string, path: string } | null) => {
            overlay.remove()
            resolve(result)
          }

          const doSave = () => {
            const name = nameInput.value.trim()
            if (!name) {
              nameInput.focus()
              return
            }
            if (currentDir === '/') {
              dialog.alert('不能在根目录保存文件，请选择一个子文件夹（如 Documents、Desktop 等）。')
              return
            }
            const dir = currentDir.replace(/^\//, '')
            const fullPath = dir ? dir + '/' + name : name
            close({ name, path: fullPath })
          }

          okBtn.addEventListener('click', doSave)
          cancelBtn.addEventListener('click', () => close(null))

          nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') doSave()
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

      // 新建文件
      const newFile = async () => {
        if (isModified) {
          if (!await dialog.confirm('文件已修改但未保存，是否放弃修改？')) return
        }
        textarea.value = ''
        savedContent = ''
        currentFileId = null
        currentFileName = '无标题'
        currentFilePath = ''
        isModified = false
        updateTitle()
        updateCharCount()
        updateCursorPos()
      }

      // 文本输入事件
      textarea.addEventListener('input', () => {
        checkModified()
        updateCharCount()
        updateCursorPos()
      })

      textarea.addEventListener('click', updateCursorPos)
      textarea.addEventListener('keyup', updateCursorPos)

      // 菜单点击
      content.querySelectorAll('.menu-label').forEach(label => {
        label.addEventListener('click', (e) => {
          e.stopPropagation()
          const dropdown = label.nextElementSibling
          const isOpen = dropdown?.classList.contains('open')
          content.querySelectorAll('.menu-dropdown').forEach(d => d.classList.remove('open'))
          if (!isOpen) dropdown?.classList.add('open')
        })
      })

      // 点击外部关闭菜单
      document.addEventListener('click', () => {
        content.querySelectorAll('.menu-dropdown').forEach(d => d.classList.remove('open'))
      })

      // 菜单项点击
      content.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', async () => {
          const action = item.getAttribute('data-action')
          content.querySelectorAll('.menu-dropdown').forEach(d => d.classList.remove('open'))

          switch (action) {
            case 'new':
              await newFile()
              break

            case 'save':
              await saveFile()
              break

            case 'saveas':
              await saveAs()
              break

            case 'open': {
              if (isModified && !await dialog.confirm('当前文件已修改，是否放弃修改？')) break
              const path = await dialog.prompt('请输入文件路径 (例如: Documents/test.txt):', 'Documents/')
              if (path) {
                try {
                  const fileItem = await fs.getByPath(path)
                  if (fileItem && fileItem.type === 'file') {
                    const fileContent = await fs.readFile(fileItem.id)
                    if (fileContent !== null) {
                      textarea.value = fileContent
                      savedContent = fileContent
                      currentFileId = fileItem.id
                      currentFileName = fileItem.name
                      currentFilePath = path.startsWith('/') ? path.slice(1) : path
                      isModified = false
                      updateTitle()
                      updateCharCount()
                      updateCursorPos()
                    }
                  } else {
                    await dialog.alert('文件不存在')
                  }
                } catch (e: any) {
                  await dialog.alert('打开失败: ' + e.message)
                }
              }
              break
            }

            case 'undo':
              document.execCommand('undo')
              break

            case 'redo':
              document.execCommand('redo')
              break

            case 'selectall':
              textarea.select()
              break

            case 'datetime': {
              const now = new Date().toLocaleString('zh-CN')
              const start = textarea.selectionStart
              const end = textarea.selectionEnd
              textarea.value = textarea.value.substring(0, start) + now + textarea.value.substring(end)
              textarea.selectionStart = textarea.selectionEnd = start + now.length
              checkModified()
              updateCharCount()
              break
            }

            case 'about':
              await dialog.alert('HT OS 记事本 v1.0.0\n\n一个功能完整的文本编辑器\n支持文件读写、编辑操作')
              break
          }
        })
      })

      // Ctrl+S 保存快捷键
      textarea.addEventListener('keydown', async (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
          e.preventDefault()
          await saveFile()
        } else if (e.key === 'F5') {
          e.preventDefault()
          const now = new Date().toLocaleString('zh-CN')
          const start = textarea.selectionStart
          const end = textarea.selectionEnd
          textarea.value = textarea.value.substring(0, start) + now + textarea.value.substring(end)
          textarea.selectionStart = textarea.selectionEnd = start + now.length
          checkModified()
          updateCharCount()
        }
      })

      // 右键菜单
      const ctxMenu = new ContextMenu()
      textarea.addEventListener('contextmenu', (e: MouseEvent) => {
        e.preventDefault()
        ctxMenu.show(e.clientX, e.clientY, [
          {
            label: '剪切',
            action: () => {
              textarea.focus()
              document.execCommand('cut')
              checkModified()
              updateCharCount()
            }
          },
          {
            label: '复制',
            action: () => {
              textarea.focus()
              document.execCommand('copy')
            }
          },
          {
            label: '粘贴',
            action: () => {
              textarea.focus()
              document.execCommand('paste')
              checkModified()
              updateCharCount()
            }
          },
          { separator: true },
          {
            label: '全选',
            action: () => {
              textarea.focus()
              document.execCommand('selectAll')
            }
          },
          { separator: true },
          {
            label: '插入时间/日期',
            action: () => {
              const now = new Date().toLocaleString('zh-CN')
              const start = textarea.selectionStart
              const end = textarea.selectionEnd
              textarea.value = textarea.value.substring(0, start) + now + textarea.value.substring(end)
              textarea.selectionStart = textarea.selectionEnd = start + now.length
              textarea.focus()
              checkModified()
              updateCharCount()
            }
          }
        ])
      })

      // 初始化
      updateTitle()
      updateCharCount()
      updateCursorPos()
      setTimeout(() => textarea.focus(), 100)
    }
  })
}
