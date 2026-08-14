import { WindowManager } from '../wm/WindowManager'
import { EventBus } from '../kernel/EventBus'
import { FileSystem } from '../fs/FileSystem'
import { ContextMenu } from '../desktop/ContextMenu'
import { dialog } from '../desktop/Dialog'
import { isOfficeFile, officeFileIcon } from './office'
import { isMarkdownFile } from './markdown'
import { isEPPFile, EPP_ICON, isESourceFile, E_SOURCE_ICON, isEProjectFile, EPPROJ_ICON, isESolutionFile, ESLN_ICON } from './epp'
import { requestUac } from '../kernel/UAC'
import type { FileSystemItem } from '../kernel/types'
import { assetIcon } from './system-icons'

// 文件夹图标 SVG（public/assets/文件夹.svg）
const FOLDER_ICON = assetIcon('文件夹.svg')
// 文件图标 SVG - iPad OS 风格
const FILE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40"><defs><linearGradient id="fileGrad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#ffffff"/><stop offset="100%" style="stop-color:#F2F2F7"/></linearGradient></defs><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="url(#fileGrad)" stroke="#C7C7CC" stroke-width="0.5"/><polyline points="14 2 14 8 20 8" fill="#E5E5EA" stroke="#C7C7CC" stroke-width="0.5"/></svg>'

// 图片 / 音频 / 视频扩展名与图标
const IMAGE_EXTS = /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/i
const AUDIO_EXTS = /\.(mp3|wav|ogg|m4a|flac|aac|opus|wma)$/i
const VIDEO_EXTS = /\.(mp4|webm|ogg|mov|avi|mkv|m4v|flv|wmv)$/i

const IMAGE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40"><defs><linearGradient id="imgGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#34C759"/><stop offset="100%" style="stop-color:#1C9B54"/></linearGradient></defs><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="#fff" stroke="#C7C7CC" stroke-width="0.5"/><rect x="6" y="6" width="12" height="12" rx="2" fill="url(#imgGrad)"/><circle cx="9" cy="9.5" r="1.2" fill="#fff"/><polyline points="17 15 13.5 11.5 9 16" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
const AUDIO_ICON = assetIcon('音乐.svg')
const VIDEO_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40"><defs><linearGradient id="vidGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#007AFF"/><stop offset="100%" style="stop-color:#0040DD"/></linearGradient></defs><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="#fff" stroke="#C7C7CC" stroke-width="0.5"/><rect x="6" y="6" width="12" height="12" rx="2" fill="url(#vidGrad)"/><path d="M11 9.5l4 2.5-4 2.5z" fill="#fff"/></svg>'

/** 根据文件名返回合适的图标（办公文件使用专用图标） */
function getFileIcon(name: string): string {
  if (isOfficeFile(name)) return officeFileIcon(name)
  if (isESolutionFile(name)) return ESLN_ICON
  if (isEProjectFile(name)) return EPPROJ_ICON
  if (isEPPFile(name)) return EPP_ICON
  if (isESourceFile(name)) return E_SOURCE_ICON
  if (IMAGE_EXTS.test(name)) return IMAGE_ICON
  if (AUDIO_EXTS.test(name)) return AUDIO_ICON
  if (VIDEO_EXTS.test(name)) return VIDEO_ICON
  return FILE_ICON
}

// 工具栏按钮图标
const BACK_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>'
const FORWARD_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>'
const UP_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>'
const REFRESH_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>'
const NEW_FOLDER_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>'
const NEW_FILE_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>'
const DELETE_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
const SEARCH_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
// 导入（从本地电脑上传文件）图标
const IMPORT_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'

// 应用图标
const APP_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#f5a623" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>'

export function registerFileManagerApp(wm: WindowManager, fs: FileSystem, eventBus: EventBus): void {
  wm.registerApp({
    id: 'file-manager',
    name: '文件管理器',
    icon: APP_ICON,
    defaultWidth: 880,
    defaultHeight: 600,
    entry: (windowId: string, source?: string, targetId?: string) => {
      const win = wm.getWindow(windowId)
      if (!win) return

      const content = win.content
      content.className = 'file-manager window-content'

      // 当前路径和文件夹ID
      let currentPath = '/'
      let currentFolderId: string | null = null
      // 历史记录用于后退/前进
      let pathHistory: string[] = ['/']
      let historyIndex = 0
      // 剪贴板
      let clipboard: { item: FileSystemItem; mode: 'copy' | 'cut' } | null = null
      // 当前搜索关键字
      let searchKeyword = ''
      // 当前显示的文件列表
      let currentItems: FileSystemItem[] = []

      content.innerHTML = `
        <div class="fm-toolbar">
          <button class="fm-btn" id="fm-back" title="后退" disabled>${BACK_ICON}</button>
          <button class="fm-btn" id="fm-forward" title="前进" disabled>${FORWARD_ICON}</button>
          <button class="fm-btn" id="fm-up" title="上一级" disabled>${UP_ICON}</button>
          <button class="fm-btn" id="fm-refresh" title="刷新">${REFRESH_ICON}</button>
          <div class="fm-divider"></div>
          <button class="fm-btn" id="fm-new-folder" title="新建文件夹">${NEW_FOLDER_ICON}</button>
          <button class="fm-btn" id="fm-new-file" title="新建文件">${NEW_FILE_ICON}</button>
          <button class="fm-btn" id="fm-delete" title="删除" disabled>${DELETE_ICON}</button>
          <button class="fm-btn" id="fm-import" title="从电脑导入文件到当前文件夹">${IMPORT_ICON}</button>
          <input type="file" id="fm-import-input" multiple style="display:none">
          <div class="fm-divider"></div>
          <div class="fm-search">
            ${SEARCH_ICON}
            <input type="text" id="fm-search-input" placeholder="搜索当前文件夹...">
          </div>
        </div>
        <div class="fm-addressbar" id="fm-addressbar"></div>
        <div class="fm-body">
          <div class="fm-sidebar" id="fm-sidebar">
            <div class="fm-sidebar-item active" data-path="/">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              <span>主目录</span>
            </div>
            <div class="fm-sidebar-item" data-path="/Users/Admin/Desktop">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              <span>桌面</span>
            </div>
            <div class="fm-sidebar-item" data-path="/Users/Admin/Documents">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span>文档</span>
            </div>
            <div class="fm-sidebar-item" data-path="/Users/Admin/Downloads">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>下载</span>
            </div>
            <div class="fm-sidebar-item" data-path="/Users/Admin/Pictures">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <span>图片</span>
            </div>
            <div class="fm-sidebar-item" data-path="/Users/Admin/Music">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              <span>音乐</span>
            </div>
            <div class="fm-sidebar-item" data-path="/Users/Admin/Videos">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              <span>视频</span>
            </div>
          </div>
          <div class="fm-content" id="fm-content"></div>
        </div>
        <div class="fm-statusbar">
          <span id="fm-status">0 个项目</span>
          <span id="fm-selected-info"></span>
        </div>
      `

      const fmContent = content.querySelector('#fm-content') as HTMLElement
      const fmAddressbar = content.querySelector('#fm-addressbar') as HTMLElement
      const fmStatus = content.querySelector('#fm-status') as HTMLElement
      const fmSelectedInfo = content.querySelector('#fm-selected-info') as HTMLElement
      const searchInput = content.querySelector('#fm-search-input') as HTMLInputElement
      const backBtn = content.querySelector('#fm-back') as HTMLButtonElement
      const forwardBtn = content.querySelector('#fm-forward') as HTMLButtonElement
      const upBtn = content.querySelector('#fm-up') as HTMLButtonElement
      const deleteBtn = content.querySelector('#fm-delete') as HTMLButtonElement
      const importBtn = content.querySelector('#fm-import') as HTMLButtonElement
      const importInput = content.querySelector('#fm-import-input') as HTMLInputElement

      const ctxMenu = new ContextMenu()

      // 渲染地址栏（支持点击导航）
      const renderAddressbar = () => {
        const parts = currentPath.split('/').filter(Boolean)
        let html = '<div class="fm-addr-item" data-path="/">主目录</div>'
        let accPath = ''
        parts.forEach(part => {
          accPath += '/' + part
          html += '<span class="fm-addr-sep">/</span>'
          html += `<div class="fm-addr-item" data-path="${accPath}">${part}</div>`
        })
        fmAddressbar.innerHTML = html

        fmAddressbar.querySelectorAll('.fm-addr-item').forEach(item => {
          item.addEventListener('click', () => {
            const path = item.getAttribute('data-path') || '/'
            navigateTo(path, true)
          })
        })
      }

      // 更新导航按钮状态
      const updateNavButtons = () => {
        backBtn.disabled = historyIndex <= 0
        forwardBtn.disabled = historyIndex >= pathHistory.length - 1
        upBtn.disabled = currentPath === '/'
      }

      // 导航到指定路径
      const navigateTo = (path: string, addHistory: boolean = false) => {
        currentPath = path
        if (addHistory) {
          pathHistory = pathHistory.slice(0, historyIndex + 1)
          pathHistory.push(path)
          historyIndex = pathHistory.length - 1
        }
        updateNavButtons()
        renderAddressbar()

        // 更新侧边栏高亮
        content.querySelectorAll('.fm-sidebar-item').forEach(item => {
          item.classList.toggle('active', item.getAttribute('data-path') === path)
        })

        loadFolder()
      }

      // 加载文件夹内容
      const loadFolder = async () => {
        try {
          // getByPath 需要不带前导 / 的路径
          const cleanPath = currentPath === '/' ? '' : currentPath.replace(/^\//, '')
          const folder = cleanPath === '' ? null : await fs.getByPath(cleanPath)
          currentFolderId = folder?.id || null

          const items = await fs.listFiles(currentFolderId)
          currentItems = items
          renderItems(items)
          eventBus.emit('fs:changed')
        } catch (e: any) {
          fmContent.innerHTML = `<div class="fm-empty">加载失败: ${e.message}</div>`
        }
      }

      // 渲染文件列表
      const renderItems = (items: FileSystemItem[]) => {
        // 过滤搜索
        let displayItems = items
        if (searchKeyword) {
          displayItems = items.filter(i =>
            i.name.toLowerCase().includes(searchKeyword.toLowerCase())
          )
        }

        fmContent.innerHTML = ''

        if (displayItems.length === 0) {
          fmContent.innerHTML = searchKeyword
            ? '<div class="fm-empty">未找到匹配的项目</div>'
            : '<div class="fm-empty">此文件夹为空</div>'
        } else {
          displayItems.forEach(item => {
            const itemEl = document.createElement('div')
            itemEl.className = 'fm-item'
            itemEl.dataset.id = item.id
            itemEl.title = item.name
            itemEl.draggable = true
            itemEl.innerHTML = `
              <div class="fm-item-icon">${item.type === 'folder' ? FOLDER_ICON : getFileIcon(item.name)}</div>
              <div class="fm-item-name">${item.name}</div>
            `

            // 单击选中
            itemEl.addEventListener('click', (e: MouseEvent) => {
              e.stopPropagation()
              fmContent.querySelectorAll('.fm-item.selected').forEach(el => el.classList.remove('selected'))
              itemEl.classList.add('selected')
              deleteBtn.disabled = false
              fmSelectedInfo.textContent = `已选择: ${item.name}`
            })

            // 双击打开
            itemEl.addEventListener('dblclick', () => {
              openItem(item)
            })

            // 右键菜单
            itemEl.addEventListener('contextmenu', (e: MouseEvent) => {
              e.preventDefault()
              e.stopPropagation()
              fmContent.querySelectorAll('.fm-item.selected').forEach(el => el.classList.remove('selected'))
              itemEl.classList.add('selected')
              showContextMenu(e.clientX, e.clientY, item)
            })

            // 内部拖拽：开始拖拽文件项
            itemEl.addEventListener('dragstart', (e: DragEvent) => {
              e.stopPropagation()
              e.dataTransfer!.effectAllowed = 'move'
              e.dataTransfer!.setData('text/ht-os-item', item.id)
              e.dataTransfer!.setData('text/ht-os-item-path', currentPath === '/' ? '/' + item.name : currentPath + '/' + item.name)
              itemEl.classList.add('dragging')
            })

            itemEl.addEventListener('dragend', () => {
              itemEl.classList.remove('dragging')
              // 拖拽结束后刷新当前目录（覆盖拖到桌面等外部场景）
              loadFolder()
            })

            // 文件夹作为放置目标：接收拖入的文件项
            if (item.type === 'folder') {
              itemEl.addEventListener('dragover', (e: DragEvent) => {
                // 仅响应内部拖拽（不拦截原生文件拖拽，让 fmContent 处理）
                if (e.dataTransfer?.types.includes('text/ht-os-item')) {
                  e.preventDefault()
                  e.stopPropagation()
                  e.dataTransfer.dropEffect = 'move'
                  itemEl.classList.add('drop-target')
                }
              })

              itemEl.addEventListener('dragleave', () => {
                itemEl.classList.remove('drop-target')
              })

              itemEl.addEventListener('drop', async (e: DragEvent) => {
                const itemId = e.dataTransfer?.getData('text/ht-os-item')
                if (!itemId) return
                e.preventDefault()
                e.stopPropagation()
                itemEl.classList.remove('drop-target')

                if (itemId === item.id) return // 不能拖入自身
                try {
                  await fs.move(itemId, item.id)
                  loadFolder()
                  eventBus.emit('fs:changed')
                } catch (err: any) {
                  await dialog.alert('移动失败: ' + err.message)
                }
              })
            }

            fmContent.appendChild(itemEl)
          })
        }

        const count = displayItems.length
        fmStatus.textContent = `${count} 个项目${searchKeyword ? ` (搜索: "${searchKeyword}")` : ''}`
      }

      // 打开文件或文件夹
      const openItem = async (item: FileSystemItem) => {
        if (item.type === 'folder') {
          const newPath = currentPath === '/' ? '/' + item.name : currentPath + '/' + item.name
          navigateTo(newPath, true)
        } else if (isOfficeFile(item.name)) {
          // PDF/Word/Excel/PPT 用 HT 办公打开
          const filePath = currentPath === '/'
            ? item.name
            : (currentPath + '/' + item.name).replace(/^\//, '')
          eventBus.emit('app:launch', 'office', item.id, item.name, '', filePath)
        } else if (isMarkdownFile(item.name)) {
          // Markdown 文件用 Markdown 应用打开
          const filePath = currentPath === '/'
            ? item.name
            : (currentPath + '/' + item.name).replace(/^\//, '')
          eventBus.emit('app:launch', 'markdown', filePath, item.name)
        } else if (IMAGE_EXTS.test(item.name)) {
          // 图片用照片查看器打开
          const filePath = currentPath === '/'
            ? item.name
            : (currentPath + '/' + item.name).replace(/^\//, '')
          eventBus.emit('app:launch', 'photo-viewer', filePath)
        } else if (AUDIO_EXTS.test(item.name)) {
          // 音频用音乐播放器播放
          const filePath = currentPath === '/'
            ? item.name
            : (currentPath + '/' + item.name).replace(/^\//, '')
          eventBus.emit('app:launch', 'music-player', filePath)
        } else if (VIDEO_EXTS.test(item.name)) {
          // 视频用视频播放器播放
          const filePath = currentPath === '/'
            ? item.name
            : (currentPath + '/' + item.name).replace(/^\//, '')
          eventBus.emit('app:launch', 'video-player', filePath)
        } else if (isESolutionFile(item.name)) {
          // .esln 解决方案文件：用 EPP 编译器打开解决方案
          const filePath = currentPath === '/'
            ? item.name
            : (currentPath + '/' + item.name).replace(/^\//, '')
          eventBus.emit('app:launch', 'epp-compiler-solution', filePath)
        } else if (isEProjectFile(item.name)) {
          // .epproj 项目文件：用 EPP 编译器打开项目
          const filePath = currentPath === '/'
            ? item.name
            : (currentPath + '/' + item.name).replace(/^\//, '')
          eventBus.emit('app:launch', 'epp-compiler-project', filePath)
        } else if (isEPPFile(item.name)) {
          // .epp 编译后可执行文件：直接运行
          const filePath = currentPath === '/'
            ? item.name
            : (currentPath + '/' + item.name).replace(/^\//, '')
          eventBus.emit('app:launch', 'epp-runner-file', filePath)
        } else if (isESourceFile(item.name)) {
          // .e 源代码文件：用 EPP 编译器打开
          const filePath = currentPath === '/'
            ? item.name
            : (currentPath + '/' + item.name).replace(/^\//, '')
          eventBus.emit('app:launch', 'epp-compiler-open', filePath)
        } else {
          // 读取文件内容并通过事件总线启动记事本
          const fileContent = await fs.readFile(item.id)
          if (fileContent !== null) {
            // 构造完整路径（去掉开头的 /）
            const filePath = currentPath === '/'
              ? item.name
              : (currentPath + '/' + item.name).replace(/^\//, '')
            eventBus.emit('app:launch', 'notepad', item.id, item.name, fileContent, filePath)
          }
        }
      }

      // 显示右键菜单
      const showContextMenu = (x: number, y: number, item: FileSystemItem) => {
        ctxMenu.show(x, y, [
          {
            label: '打开',
            action: () => openItem(item)
          },
          { separator: true },
          {
            label: '重命名',
            action: async () => {
              const newName = await dialog.prompt('输入新名称:', item.name)
              if (newName && newName !== item.name && newName.trim()) {
                try {
                  await fs.rename(item.id, newName.trim())
                  loadFolder()
                } catch (e: any) {
                  await dialog.alert('重命名失败: ' + e.message)
                }
              }
            }
          },
          {
            label: '复制',
            action: () => {
              clipboard = { item, mode: 'copy' }
              fmStatus.textContent = `已复制: ${item.name}`
            }
          },
          {
            label: '剪切',
            action: () => {
              clipboard = { item, mode: 'cut' }
              fmStatus.textContent = `已剪切: ${item.name}`
            }
          },
          {
            label: clipboard ? '粘贴' : '粘贴 (剪贴板为空)',
            disabled: !clipboard,
            action: async () => { if (clipboard) await pasteItem() }
          },
          { separator: true },
          {
            label: '删除',
            action: async () => {
              // UAC 确认
              const allowed = await requestUac(eventBus, {
                operation: '删除文件',
                resource: item.name,
                source: '文件管理器'
              })
              if (!allowed) return
              if (await dialog.confirm(`确定要删除 "${item.name}" 吗？`)) {
                try {
                  await fs.deleteItem(item.id)
                  loadFolder()
                } catch (e: any) {
                  await dialog.alert('删除失败: ' + e.message)
                }
              }
            }
          },
          { separator: true },
          {
            label: '属性',
            action: async () => {
              const sizeStr = item.type === 'file'
                ? `${item.size} 字节`
                : '文件夹'
              await dialog.alert(
                `属性\n\n` +
                `名称: ${item.name}\n` +
                `类型: ${item.type === 'folder' ? '文件夹' : '文件'}\n` +
                `大小: ${sizeStr}\n` +
                `创建时间: ${new Date(item.created).toLocaleString('zh-CN')}\n` +
                `修改时间: ${new Date(item.modified).toLocaleString('zh-CN')}\n` +
                `路径: ${currentPath === '/' ? '/' + item.name : currentPath + '/' + item.name}`
              )
            }
          }
        ])
      }

      // 粘贴文件
      const pasteItem = async () => {
        if (!clipboard) return
        const { item, mode } = clipboard

        try {
          if (mode === 'copy') {
            // 复制：在当前目录创建副本
            const content = item.type === 'file' ? (await fs.readFile(item.id) || '') : ''
            if (item.type === 'file') {
              const copyName = item.name.replace(/(\.[^.]+)?$/, ' (副本)$1')
              const fullPath = currentPath === '/' ? '/' + copyName : currentPath + '/' + copyName
              await fs.writeFile(fullPath, content)
            } else {
              // 文件夹复制 - 创建新文件夹
              const copyName = item.name + ' (副本)'
              await fs.createFolder(copyName, currentFolderId)
            }
          } else if (mode === 'cut') {
            // 剪切：重设父目录
            // 由于 FileSystem 没有 move 方法，我们用重命名到新路径的方式
            // 这里简化处理：如果是文件，读取内容写到新位置再删除
            if (item.type === 'file') {
              const fileContent = await fs.readFile(item.id)
              if (fileContent !== null) {
                const fullPath = currentPath === '/' ? '/' + item.name : currentPath + '/' + item.name
                await fs.writeFile(fullPath, fileContent)
                await fs.deleteItem(item.id)
              }
            }
            clipboard = null
          }
          loadFolder()
        } catch (e: any) {
          await dialog.alert('粘贴失败: ' + e.message)
        }
      }

      // 空白处右键菜单
      fmContent.addEventListener('contextmenu', (e: MouseEvent) => {
        if ((e.target as HTMLElement).closest('.fm-item')) return
        e.preventDefault()

        ctxMenu.show(e.clientX, e.clientY, [
          {
            label: '新建文件夹',
            action: async () => {
              const name = await dialog.prompt('文件夹名称:', '新建文件夹')
              if (name && name.trim()) {
                try {
                  await fs.createFolder(name.trim(), currentFolderId)
                  loadFolder()
                } catch (e: any) {
                  await dialog.alert('创建失败: ' + e.message)
                }
              }
            }
          },
          {
            label: '新建文件',
            action: async () => {
              const name = await dialog.prompt('文件名称:', '新文件.txt')
              if (name && name.trim()) {
                try {
                  const fullPath = currentPath === '/' ? '/' + name.trim() : currentPath + '/' + name.trim()
                  await fs.writeFile(fullPath, '')
                  loadFolder()
                } catch (e: any) {
                  await dialog.alert('创建失败: ' + e.message)
                }
              }
            }
          },
          { separator: true },
          {
            label: clipboard ? '粘贴' : '粘贴 (剪贴板为空)',
            disabled: !clipboard,
            action: async () => { if (clipboard) await pasteItem() }
          },
          { separator: true },
          {
            label: '刷新',
            action: () => loadFolder()
          }
        ])
      })

      // 点击空白处取消选中
      fmContent.addEventListener('click', () => {
        fmContent.querySelectorAll('.fm-item.selected').forEach(el => el.classList.remove('selected'))
        deleteBtn.disabled = true
        fmSelectedInfo.textContent = ''
      })

      // 拖拽放置到当前目录：支持原生文件拖拽与来自桌面/其他文件管理器窗口的虚拟文件
      fmContent.addEventListener('dragover', (e: DragEvent) => {
        const types = e.dataTransfer?.types || []
        // 内部拖拽悬停在文件夹项上时由文件夹项自行处理并 stopPropagation
        if (types.includes('Files') || types.includes('text/ht-os-item')) {
          e.preventDefault()
          e.dataTransfer!.dropEffect = types.includes('text/ht-os-item') ? 'move' : 'copy'
          fmContent.classList.add('drag-over')
        }
      })

      fmContent.addEventListener('dragleave', (e: DragEvent) => {
        if (!fmContent.contains(e.relatedTarget as Node)) {
          fmContent.classList.remove('drag-over')
        }
      })

      fmContent.addEventListener('drop', async (e: DragEvent) => {
        const types = e.dataTransfer?.types || []

        // 处理来自桌面或其他文件管理器窗口的虚拟文件拖拽（移动到当前目录）
        if (types.includes('text/ht-os-item')) {
          e.preventDefault()
          fmContent.classList.remove('drag-over')
          const itemId = e.dataTransfer!.getData('text/ht-os-item')
          const srcPath = e.dataTransfer!.getData('text/ht-os-item-path')
          if (itemId && srcPath) {
            try {
              await fs.move(itemId, currentFolderId)
              loadFolder()
              eventBus.emit('fs:changed')
            } catch (err: any) {
              await dialog.alert('移动失败: ' + err.message)
            }
          }
          return
        }

        // 原生文件拖拽上传到当前目录
        if (!types.includes('Files')) return
        e.preventDefault()
        fmContent.classList.remove('drag-over')

        const files = e.dataTransfer!.files
        if (!files || files.length === 0) return

        fmStatus.textContent = `正在上传 ${files.length} 个文件...`
        for (const file of Array.from(files)) {
          try {
            await (fs as any).uploadFile(file, currentPath)
          } catch (err: any) {
            await dialog.alert(`上传失败: ${file.name} - ${err.message}`)
          }
        }
        loadFolder()
      })

      // 工具栏按钮事件
      backBtn.addEventListener('click', () => {
        if (historyIndex > 0) {
          historyIndex--
          currentPath = pathHistory[historyIndex]
          updateNavButtons()
          renderAddressbar()
          loadFolder()
        }
      })

      forwardBtn.addEventListener('click', () => {
        if (historyIndex < pathHistory.length - 1) {
          historyIndex++
          currentPath = pathHistory[historyIndex]
          updateNavButtons()
          renderAddressbar()
          loadFolder()
        }
      })

      upBtn.addEventListener('click', () => {
        if (currentPath !== '/') {
          const parts = currentPath.split('/').filter(Boolean)
          parts.pop()
          navigateTo(parts.length === 0 ? '/' : '/' + parts.join('/'), true)
        }
      })

      content.querySelector('#fm-refresh')!.addEventListener('click', () => {
        loadFolder()
      })

      content.querySelector('#fm-new-folder')!.addEventListener('click', async () => {
        const name = await dialog.prompt('文件夹名称:', '新建文件夹')
        if (name && name.trim()) {
          try {
            await fs.createFolder(name.trim(), currentFolderId)
            loadFolder()
          } catch (e: any) {
            await dialog.alert('创建失败: ' + e.message)
          }
        }
      })

      content.querySelector('#fm-new-file')!.addEventListener('click', async () => {
        const name = await dialog.prompt('文件名称:', '新文件.txt')
        if (name && name.trim()) {
          try {
            const fullPath = currentPath === '/' ? '/' + name.trim() : currentPath + '/' + name.trim()
            await fs.writeFile(fullPath, '')
            loadFolder()
          } catch (e: any) {
            await dialog.alert('创建失败: ' + e.message)
          }
        }
      })

      deleteBtn.addEventListener('click', async () => {
        const selected = fmContent.querySelector('.fm-item.selected') as HTMLElement
        if (!selected) return
        const itemId = selected.dataset.id
        const item = currentItems.find(i => i.id === itemId)
        if (!item) return

        // UAC 确认
        const allowed = await requestUac(eventBus, {
          operation: '删除文件',
          resource: item.name,
          source: '文件管理器'
        })
        if (!allowed) return

        if (await dialog.confirm(`确定要删除 "${item.name}" 吗？`)) {
          try {
            await fs.deleteItem(item.id)
            loadFolder()
          } catch (e: any) {
            await dialog.alert('删除失败: ' + e.message)
          }
        }
      })

      // 从本地电脑导入文件到当前文件夹
      importBtn.addEventListener('click', () => importInput.click())
      importInput.addEventListener('change', async () => {
        const files = Array.from(importInput.files || [])
        if (files.length === 0) return
        const target = currentPath === '/' ? '/' : currentPath
        fmStatus.textContent = `正在导入 ${files.length} 个文件...`
        let ok = 0
        let fail = 0
        const failedNames: string[] = []
        for (const file of files) {
          try {
            await fs.uploadFile(file, target)
            ok++
          } catch (e: any) {
            fail++
            failedNames.push(`${file.name} (${e.message || '失败'})`)
          }
        }
        // 清空，允许再次选择同一文件
        importInput.value = ''
        loadFolder()
        if (fail === 0) {
          fmStatus.textContent = `已导入 ${ok} 个文件到${target === '/' ? '主目录' : target}`
        } else {
          fmStatus.textContent = `导入完成：成功 ${ok} 个，失败 ${fail} 个`
          await dialog.alert(`导入完成：成功 ${ok} 个，失败 ${fail} 个\n\n${failedNames.join('\n')}`)
        }
      })

      // 搜索实时过滤
      searchInput.addEventListener('input', (e) => {
        searchKeyword = (e.target as HTMLInputElement).value
        renderItems(currentItems)
      })

      // 侧边栏导航
      content.querySelectorAll('.fm-sidebar-item').forEach(item => {
        item.addEventListener('click', () => {
          const path = item.getAttribute('data-path') || '/'
          content.querySelectorAll('.fm-sidebar-item').forEach(i => i.classList.remove('active'))
          item.classList.add('active')
          navigateTo(path, true)
        })
      })

      // 初始加载
      loadFolder()

      // 如果从桌面打开指定文件夹，自动定位
      if (source === 'desktop' && targetId) {
        fs.getPath(targetId).then(path => {
          if (path && path !== '/') {
            navigateTo(path, true)
          }
        }).catch(() => {})
      } else if (source && source !== 'desktop' && source.includes('/')) {
        // source 是路径字符串（如从 EPP 编译器调用），统一加 / 前缀
        const targetPath = source.startsWith('/') ? source : '/' + source
        navigateTo(targetPath, true)
      }
    }
  })
}
