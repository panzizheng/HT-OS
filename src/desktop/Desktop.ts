import { EventBus } from '../kernel/EventBus'
import { SettingsManager } from '../kernel/SettingsManager'
import { FileSystem } from '../fs/FileSystem'
import { ContextMenu } from './ContextMenu'
import { dialog } from './Dialog'
import { isOfficeFile, officeFileIcon } from '../apps/office'
import { isMarkdownFile } from '../apps/markdown'
import { isEPPFile, isESourceFile, isEProjectFile, isESolutionFile, EPP_ICON, E_SOURCE_ICON, EPPROJ_ICON, ESLN_ICON } from '../apps/epp'
import { requestUac } from '../kernel/UAC'
import type { FileSystemItem } from '../kernel/types'
import { ENV_EDITOR_ICON, VIDEO_PLAYER_ICON, SETTINGS_ICON, TERMINAL_ICON, assetIcon } from '../apps/system-icons'

// 多媒体扩展名与图标
const IMAGE_EXTS = /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/i
const AUDIO_EXTS = /\.(mp3|wav|ogg|m4a|flac|aac|opus|wma)$/i
const VIDEO_EXTS = /\.(mp4|webm|ogg|mov|avi|mkv|m4v|flv|wmv)$/i
const IMAGE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40"><defs><linearGradient id="dImgGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#34C759"/><stop offset="100%" style="stop-color:#1C9B54"/></linearGradient></defs><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="#fff" stroke="#C7C7CC" stroke-width="0.5"/><rect x="6" y="6" width="12" height="12" rx="2" fill="url(#dImgGrad)"/><circle cx="9" cy="9.5" r="1.2" fill="#fff"/><polyline points="17 15 13.5 11.5 9 16" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
const AUDIO_ICON = assetIcon('音乐.svg')
const VIDEO_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40"><defs><linearGradient id="dVidGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#007AFF"/><stop offset="100%" style="stop-color:#0040DD"/></linearGradient></defs><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="#fff" stroke="#C7C7CC" stroke-width="0.5"/><rect x="6" y="6" width="12" height="12" rx="2" fill="url(#dVidGrad)"/><path d="M11 9.5l4 2.5-4 2.5z" fill="#fff"/></svg>'

/** 桌面图标在网格中的位置记录（保存到 localStorage 以持久化排列） */
interface IconPosition {
  id: string
  col: number
  row: number
}

const GRID_CELL_W = 92
const GRID_CELL_H = 92
const GRID_PAD = 16

/**
 * 桌面环境
 * 从文件系统的 Desktop 文件夹读取图标，支持选中、双击打开、右键菜单、拖拽排列
 */
export class Desktop {
  private element: HTMLElement
  private iconsContainer: HTMLElement
  private eventBus: EventBus
  private settings: SettingsManager
  private fs: FileSystem
  private contextMenu: ContextMenu
  private selectedIcon: HTMLElement | null = null
  private iconPositions: Map<string, { col: number; row: number }> = new Map()
  private refreshTimer: number | null = null
  private static POSITION_KEY = 'ht-os-desktop-grid-positions'

  constructor(
    container: HTMLElement,
    eventBus: EventBus,
    settings: SettingsManager,
    fs: FileSystem
  ) {
    this.eventBus = eventBus
    this.settings = settings
    this.fs = fs

    // 桌面根元素
    this.element = document.createElement('div')
    this.element.className = 'ht-desktop'
    container.appendChild(this.element)

    // 图标容器
    this.iconsContainer = document.createElement('div')
    this.iconsContainer.className = 'desktop-icons'
    this.element.appendChild(this.iconsContainer)

    this.contextMenu = new ContextMenu()
    this.loadPositions()
    this.updateWallpaper()
    this.setupDesktopEvents()
    window.addEventListener('resize', () => this.handleResize())
  }

  /** 从 localStorage 读取图标网格位置记录 */
  private loadPositions(): void {
    try {
      const saved = localStorage.getItem(Desktop.POSITION_KEY)
      if (saved) {
        const arr: IconPosition[] = JSON.parse(saved)
        for (const p of arr) {
          this.iconPositions.set(p.id, { col: p.col, row: p.row })
        }
      }
    } catch (e) {
      console.warn('[Desktop] 读取图标位置失败:', e)
    }
  }

  /** 保存图标网格位置到 localStorage */
  private savePositions(): void {
    try {
      const arr: IconPosition[] = []
      this.iconPositions.forEach((pos, id) => {
        arr.push({ id, col: pos.col, row: pos.row })
      })
      localStorage.setItem(Desktop.POSITION_KEY, JSON.stringify(arr))
    } catch (e) {
      console.warn('[Desktop] 保存图标位置失败:', e)
    }
  }

  /** 根据设置更新壁纸 */
  updateWallpaper(): void {
    const wallpaper = this.settings.get('wallpaper')
    const base = import.meta.env.BASE_URL || './'
    const defaultUrl = `${base}assets/wallpapers/default.svg`

    let wpUrl: string
    if (!wallpaper || wallpaper === 'default') {
      // 默认蓝色线条壁纸
      wpUrl = defaultUrl
    } else if (
      wallpaper.startsWith('data:') ||
      wallpaper.startsWith('http://') ||
      wallpaper.startsWith('https://') ||
      wallpaper.startsWith('blob:')
    ) {
      // 用户自定义导入的壁纸（data URL 或网络 URL）
      wpUrl = wallpaper
    } else {
      // 未知预设值（如旧版的 'green'、'orange' 等），回退到默认蓝色壁纸
      wpUrl = defaultUrl
    }

    this.element.style.backgroundImage = `url("${wpUrl}")`
    this.element.style.backgroundSize = 'cover'
    this.element.style.backgroundPosition = 'center center'
    this.element.style.backgroundRepeat = 'no-repeat'
    this.element.style.backgroundColor = 'transparent'
  }

  /** 动态切换文件系统并刷新桌面图标 */
  setFs(fs: any): void {
    this.fs = fs
    this.refreshIcons()
  }

  /** 默认用户桌面路径 */
  private static readonly DESKTOP_PATH = 'Users/Admin/Desktop'

  /** 重新加载桌面图标（从 Desktop 文件夹读取） */
  async refreshIcons(): Promise<void> {
    this.selectedIcon = null
    this.iconsContainer.innerHTML = ''

    let desktopFolder
    try {
      desktopFolder = await this.fs.getByPath(Desktop.DESKTOP_PATH)
    } catch (e) {
      return
    }

    if (!desktopFolder) return

    const items = await this.fs.listFiles(desktopFolder.id)

    // 清理已不存在的文件的位置记录（保留系统图标 sys- 开头的）
    const currentItemIds = new Set(items.map(i => i.id))
    for (const id of Array.from(this.iconPositions.keys())) {
      if (!currentItemIds.has(id) && !id.startsWith('sys-')) {
        this.iconPositions.delete(id)
      }
    }

    items.forEach((item) => {
      this.createIcon(item)
    })

    this.savePositions()
  }

  /** 渲染系统级图标（此电脑、回收站等），这些不属于文件系统 */
  private renderSystemIcons(): void {
    const systemIcons = [
      { id: 'sys-computer', name: '此电脑', type: 'folder' as const, icon: this.computerIcon(), action: () => this.eventBus.emit('app:launch', 'file-manager') },
      { id: 'sys-recycle', name: '回收站', type: 'folder' as const, icon: this.recycleIcon(), action: () => dialog.alert('回收站为空') },
      { id: 'sys-browser', name: '浏览器', type: 'file' as const, icon: this.browserIcon(), action: () => this.eventBus.emit('app:launch', 'browser') },
      { id: 'sys-terminal', name: '终端', type: 'file' as const, icon: this.terminalIcon(), action: () => this.eventBus.emit('app:launch', 'terminal') },
      { id: 'sys-notepad', name: '记事本', type: 'file' as const, icon: this.notepadIcon(), action: () => this.eventBus.emit('app:launch', 'notepad') },
      { id: 'sys-markdown', name: 'Markdown', type: 'file' as const, icon: this.markdownIcon(), action: () => this.eventBus.emit('app:launch', 'markdown') },
      { id: 'sys-settings', name: '设置', type: 'file' as const, icon: this.settingsLargeIcon(), action: () => this.eventBus.emit('app:launch', 'settings') },
      { id: 'sys-ai', name: 'AI 助手', type: 'file' as const, icon: this.aiIcon(), action: () => this.eventBus.emit('app:launch', 'ai-assistant') },
      { id: 'sys-weather', name: '天气', type: 'file' as const, icon: this.weatherIcon(), action: () => this.eventBus.emit('app:launch', 'weather') },
      { id: 'sys-monitor', name: '任务管理器', type: 'file' as const, icon: this.monitorIcon(), action: () => this.eventBus.emit('app:launch', 'task-manager') },
      { id: 'sys-painter', name: '画图', type: 'file' as const, icon: this.paintIcon(), action: () => this.eventBus.emit('app:launch', 'painter') },
      { id: 'sys-music', name: '音乐播放器', type: 'file' as const, icon: this.musicIcon(), action: () => this.eventBus.emit('app:launch', 'music-player') },
      { id: 'sys-video', name: '视频播放器', type: 'file' as const, icon: this.videoIcon(), action: () => this.eventBus.emit('app:launch', 'video-player') },
      { id: 'sys-office', name: 'HT 办公', type: 'file' as const, icon: this.officeIcon(), action: () => this.eventBus.emit('app:launch', 'office') },
      { id: 'sys-photo', name: '照片', type: 'file' as const, icon: this.photoIcon(), action: () => this.eventBus.emit('app:launch', 'photo-viewer') },
      { id: 'sys-calculator', name: '计算器', type: 'file' as const, icon: this.calcIcon(), action: () => this.eventBus.emit('app:launch', 'calculator') },
      { id: 'sys-epp', name: 'EPP 编译器', type: 'file' as const, icon: this.eppIcon(), action: () => this.eventBus.emit('app:launch', 'epp-compiler') },
      { id: 'sys-regedit', name: '注册表编辑器', type: 'file' as const, icon: this.regeditIcon(), action: () => this.eventBus.emit('app:launch', 'regedit') },
      { id: 'sys-services', name: '服务管理器', type: 'file' as const, icon: this.servicesIcon(), action: () => this.eventBus.emit('app:launch', 'services') },
      { id: 'sys-startup', name: '启动项管理', type: 'file' as const, icon: this.startupIcon(), action: () => this.eventBus.emit('app:launch', 'startup-manager') },
      { id: 'sys-eventviewer', name: '事件查看器', type: 'file' as const, icon: this.eventViewerIcon(), action: () => this.eventBus.emit('app:launch', 'event-viewer') },
      { id: 'sys-env', name: '环境变量', type: 'file' as const, icon: this.envIcon(), action: () => this.eventBus.emit('app:launch', 'env-editor') }
    ]
    systemIcons.forEach((icon, index) => {
      const el = this.createIconElement(icon.id, icon.name, icon.icon, true)
      this.placeIcon(el, icon.id)
      el.addEventListener('dblclick', icon.action)
      this.iconsContainer.appendChild(el)
    })
  }

  /** 创建一个桌面图标元素（对应文件系统项目） */
  private createIcon(item: FileSystemItem): void {
    const displayName = item.name
    const iconHtml = item.type === 'folder' ? this.folderIcon() : this.fileIcon(item.name)

    const el = this.createIconElement(item.id, displayName, iconHtml, false)
    this.placeIcon(el, item.id)

    el.addEventListener('dblclick', async () => {
      this.openItem(item, Desktop.DESKTOP_PATH + '/' + item.name)
    })

    el.addEventListener('contextmenu', (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      this.selectIcon(el)
      this.showItemContextMenu(e.clientX, e.clientY, item)
    })

    this.iconsContainer.appendChild(el)
  }

  /** 打开文件系统项目（通用逻辑） */
  private async openItem(item: FileSystemItem, itemPath: string): Promise<void> {
    if (item.type === 'folder') {
      // 打开文件管理器并定位到该文件夹
      this.eventBus.emit('app:launch', 'file-manager', 'desktop', item.id)
    } else if (isOfficeFile(item.name)) {
      // PDF/Word/Excel/PPT 用 HT 办公打开
      this.eventBus.emit('app:launch', 'office', item.id, item.name, '', itemPath)
    } else if (isMarkdownFile(item.name)) {
      // Markdown 文件用 Markdown 应用打开
      this.eventBus.emit('app:launch', 'markdown', itemPath, item.name)
    } else if (IMAGE_EXTS.test(item.name)) {
      // 图片用照片查看器打开
      this.eventBus.emit('app:launch', 'photo-viewer', itemPath)
    } else if (AUDIO_EXTS.test(item.name)) {
      // 音频用音乐播放器播放
      this.eventBus.emit('app:launch', 'music-player', itemPath)
    } else if (VIDEO_EXTS.test(item.name)) {
      // 视频用视频播放器播放
      this.eventBus.emit('app:launch', 'video-player', itemPath)
    } else if (isESolutionFile(item.name)) {
      this.eventBus.emit('app:launch', 'epp-compiler-solution', itemPath)
    } else if (isEProjectFile(item.name)) {
      this.eventBus.emit('app:launch', 'epp-compiler-project', itemPath)
    } else if (isEPPFile(item.name)) {
      this.eventBus.emit('app:launch', 'epp-runner-file', itemPath)
    } else if (isESourceFile(item.name)) {
      this.eventBus.emit('app:launch', 'epp-compiler-open', itemPath)
    } else {
      // 文本类文件用记事本打开
      const content = await this.fs.readFile(item.id)
      this.eventBus.emit('app:launch', 'notepad', item.id, item.name, content || '', itemPath)
    }
  }

  /** 创建图标元素并设置选中行为 */
  private createIconElement(id: string, name: string, iconHtml: string, isSystem: boolean): HTMLElement {
    const el = document.createElement('div')
    el.className = 'desktop-icon'
    el.dataset.id = id
    el.dataset.name = name
    el.dataset.system = isSystem ? '1' : '0'
    el.innerHTML = `
      <div class="icon-image">${iconHtml}</div>
      <div class="icon-label">${this.escapeHtml(name)}</div>
    `

    // 单击选中
    el.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation()
      this.selectIcon(el)
    })

    // 拖拽（网格排列 + 拖出到文件管理器/文件夹）
    this.setupIconDrag(el, id, isSystem)
    return el
  }

  /** 把图标放置到合适位置（已保存的网格位置或自动寻找第一个空闲位置） */
  private placeIcon(el: HTMLElement, id: string): void {
    const saved = this.iconPositions.get(id)
    if (saved) {
      this.applyGridPosition(el, saved.col, saved.row)
    } else {
      const slot = this.findFirstFreeSlot()
      this.iconPositions.set(id, slot)
      this.applyGridPosition(el, slot.col, slot.row)
    }
  }

  /** 根据网格坐标设置像素位置 */
  private applyGridPosition(el: HTMLElement, col: number, row: number): void {
    el.style.left = (GRID_PAD + col * GRID_CELL_W) + 'px'
    el.style.top = (GRID_PAD + row * GRID_CELL_H) + 'px'
  }

  /** 计算当前桌面每列最大可容纳的行数 */
  private getMaxRows(): number {
    const h = this.iconsContainer.clientHeight || window.innerHeight
    return Math.max(1, Math.floor((h - GRID_PAD * 2) / GRID_CELL_H))
  }

  /** 找到第一个空闲的网格单元（竖向排列，先填满一列再换下一列） */
  private findFirstFreeSlot(): { col: number; row: number } {
    const maxRows = this.getMaxRows()
    const occupied = new Set<string>()
    this.iconPositions.forEach(pos => {
      occupied.add(`${pos.col},${pos.row}`)
    })

    let col = 0
    while (true) {
      for (let row = 0; row < maxRows; row++) {
        if (!occupied.has(`${col},${row}`)) {
          return { col, row }
        }
      }
      col++
    }
  }

  /** 找到第一个空闲网格单元，排除指定 id 的占用 */
  private findFirstFreeSlotExcluding(excludeId: string): { col: number; row: number } {
    const maxRows = this.getMaxRows()
    const occupied = new Set<string>()
    this.iconPositions.forEach((pos, key) => {
      if (key !== excludeId) occupied.add(`${pos.col},${pos.row}`)
    })

    let col = 0
    while (true) {
      for (let row = 0; row < maxRows; row++) {
        if (!occupied.has(`${col},${row}`)) {
          return { col, row }
        }
      }
      col++
    }
  }

  /** 窗口大小变化时，将超出当前范围的图标重新排列 */
  private handleResize(): void {
    const maxRows = this.getMaxRows()
    let changed = false
    const ids = Array.from(this.iconPositions.keys())
    for (const id of ids) {
      const pos = this.iconPositions.get(id)!
      if (pos.row >= maxRows) {
        // 找出第一个空闲位置并移动
        const occupied = new Set<string>()
        this.iconPositions.forEach((p, key) => {
          if (key !== id) occupied.add(`${p.col},${p.row}`)
        })
        let found = false
        let col = 0
        while (!found) {
          for (let row = 0; row < maxRows; row++) {
            if (!occupied.has(`${col},${row}`)) {
              this.iconPositions.set(id, { col, row })
              const el = this.iconsContainer.querySelector(`[data-id="${id}"]`) as HTMLElement
              if (el) this.applyGridPosition(el, col, row)
              changed = true
              found = true
              break
            }
          }
          col++
        }
      }
    }
    if (changed) this.savePositions()
  }

  /** 设置图标拖拽（网格排列 + 非系统图标可拖出到文件管理器/文件夹） */
  private setupIconDrag(el: HTMLElement, id: string, isSystem: boolean): void {
    let isDragging = false
    let startX = 0
    let startY = 0
    let offsetX = 0
    let offsetY = 0
    let moved = false

    // 非系统图标支持 HTML5 拖放，可拖出到文件管理器或其他文件夹
    if (!isSystem) {
      el.draggable = true

      el.addEventListener('dragstart', (e: DragEvent) => {
        e.dataTransfer!.effectAllowed = 'move'
        e.dataTransfer!.setData('text/ht-os-item', id)
        const name = el.dataset.name || ''
        e.dataTransfer!.setData('text/ht-os-item-path', Desktop.DESKTOP_PATH + '/' + name)
        el.classList.add('dragging')
        // 取消自定义网格拖拽，避免与 HTML5 拖放冲突
        isDragging = false
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      })

      el.addEventListener('dragend', () => {
        el.classList.remove('dragging')
      })
    }

    const onMove = (ev: MouseEvent) => {
      if (!isDragging) return
      if (Math.abs(ev.clientX - startX) > 3 || Math.abs(ev.clientY - startY) > 3) {
        moved = true
      }
      if (moved) {
        const parentRect = this.iconsContainer.getBoundingClientRect()
        let x = ev.clientX - parentRect.left - offsetX
        let y = ev.clientY - parentRect.top - offsetY
        x = Math.max(0, Math.min(x, parentRect.width - el.offsetWidth))
        y = Math.max(0, Math.min(y, parentRect.height - el.offsetHeight))
        el.style.left = x + 'px'
        el.style.top = y + 'px'
      }
    }

    const onUp = () => {
      isDragging = false
      el.style.zIndex = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      if (moved) {
        // 将像素坐标吸附到最近的网格单元
        const left = parseFloat(el.style.left) || 0
        const top = parseFloat(el.style.top) || 0
        this.snapIconToSlot(id, Math.round((left - GRID_PAD) / GRID_CELL_W), Math.round((top - GRID_PAD) / GRID_CELL_H))
      }
    }

    el.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button !== 0) return
      isDragging = true
      moved = false
      startX = e.clientX
      startY = e.clientY
      const rect = el.getBoundingClientRect()
      offsetX = e.clientX - rect.left
      offsetY = e.clientY - rect.top
      el.style.zIndex = '10'
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    })
  }

  /** 将图标吸附到最近网格单元，若目标被其他图标占据则交换位置 */
  private snapIconToSlot(id: string, col: number, row: number): void {
    const el = this.iconsContainer.querySelector(`[data-id="${id}"]`) as HTMLElement
    if (!el) return
    col = Math.max(0, col)
    row = Math.max(0, row)

    const targetKey = `${col},${row}`
    let occupiedBy: string | null = null
    this.iconPositions.forEach((pos, key) => {
      if (key !== id && `${pos.col},${pos.row}` === targetKey) {
        occupiedBy = key
      }
    })

    if (occupiedBy) {
      // 与被占据的图标交换位置
      const oldPos = this.iconPositions.get(id)
      const otherPos = this.iconPositions.get(occupiedBy)!
      if (oldPos) {
        this.iconPositions.set(occupiedBy, { ...oldPos })
        const otherEl = this.iconsContainer.querySelector(`[data-id="${occupiedBy}"]`) as HTMLElement
        if (otherEl) this.applyGridPosition(otherEl, oldPos.col, oldPos.row)
      } else {
        // 当前图标没有记录过位置，将被占据的图标移到第一个空闲位置
        const freeSlot = this.findFirstFreeSlotExcluding(id)
        this.iconPositions.set(occupiedBy, freeSlot)
        const otherEl = this.iconsContainer.querySelector(`[data-id="${occupiedBy}"]`) as HTMLElement
        if (otherEl) this.applyGridPosition(otherEl, freeSlot.col, freeSlot.row)
      }
    }

    this.iconPositions.set(id, { col, row })
    this.applyGridPosition(el, col, row)
    this.savePositions()
  }

  /** 选中某个图标 */
  private selectIcon(el: HTMLElement): void {
    if (this.selectedIcon) {
      this.selectedIcon.classList.remove('selected')
    }
    this.selectedIcon = el
    el.classList.add('selected')
  }

  /** 取消所有选中 */
  private clearSelection(): void {
    if (this.selectedIcon) {
      this.selectedIcon.classList.remove('selected')
      this.selectedIcon = null
    }
  }

  /** 设置桌面事件：点击空白取消选中、右键菜单 */
  private setupDesktopEvents(): void {
    // 点击空白取消选中
    this.element.addEventListener('click', (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.desktop-icon')) return
      this.clearSelection()
    })

    // 桌面右键菜单
    this.element.addEventListener('contextmenu', (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.desktop-icon')) return
      e.preventDefault()
      this.showDesktopContextMenu(e.clientX, e.clientY)
    })

    // 监听设置变化以更新壁纸
    this.eventBus.on('settings:changed', () => {
      this.updateWallpaper()
    })

    // 监听文件系统变化，防抖刷新桌面图标
    this.eventBus.on('fs:changed', () => {
      if (this.refreshTimer !== null) {
        clearTimeout(this.refreshTimer)
      }
      this.refreshTimer = window.setTimeout(() => {
        this.refreshIcons()
        this.refreshTimer = null
      }, 250)
    })

    // 原生文件拖拽上传到桌面
    this.setupFileDrop()
  }

  /** 设置桌面文件拖放上传 */
  private setupFileDrop(): void {
    this.element.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      // 支持原生文件拖拽和内部虚拟文件拖拽
      if (e.dataTransfer?.types.includes('Files') || e.dataTransfer?.types.includes('text/ht-os-item-path')) {
        e.dataTransfer.dropEffect = e.dataTransfer?.types.includes('text/ht-os-item-path') ? 'move' : 'copy'
        this.element.classList.add('drag-over')
      }
    })

    this.element.addEventListener('dragleave', (e: DragEvent) => {
      // 鼠标离开整个桌面（不再位于桌面或其子元素内）时移除高亮
      if (!this.element.contains(e.relatedTarget as Node)) {
        this.element.classList.remove('drag-over')
      }
    })

    // 兜底：无论文件最终放到哪里，拖拽结束后都清理高亮
    const clearDragOver = () => this.element.classList.remove('drag-over')
    document.addEventListener('dragend', clearDragOver)
    document.addEventListener('drop', clearDragOver)

    this.element.addEventListener('drop', async (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      this.element.classList.remove('drag-over')

      // 处理内部虚拟文件拖拽
      if (e.dataTransfer?.types.includes('text/ht-os-item-path')) {
        const itemId = e.dataTransfer.getData('text/ht-os-item')
        const srcPath = e.dataTransfer.getData('text/ht-os-item-path')
        if (itemId && srcPath) {
          // 源是桌面自身图标 → 按拖放位置执行网格重排（不移动文件）
          if (srcPath.startsWith(Desktop.DESKTOP_PATH + '/')) {
            const parentRect = this.iconsContainer.getBoundingClientRect()
            const col = Math.round((e.clientX - parentRect.left - GRID_PAD) / GRID_CELL_W)
            const row = Math.round((e.clientY - parentRect.top - GRID_PAD) / GRID_CELL_H)
            this.snapIconToSlot(itemId, col, row)
            return
          }
          // 从文件管理器等其他位置移动到桌面
          try {
            // 获取桌面文件夹，将文件移动到桌面
            const desktopFolder = await this.fs.getByPath(Desktop.DESKTOP_PATH)
            if (desktopFolder) {
              await this.fs.move(itemId, desktopFolder.id)
              this.eventBus.emit('fs:changed')
            }
          } catch (err) {
            console.error('[Desktop] 移动文件到桌面失败:', err)
          }
        }
        return
      }

      // 处理原生文件拖拽上传
      const files = e.dataTransfer?.files
      if (!files || files.length === 0) return

      for (const file of Array.from(files)) {
        try {
          await (this.fs as any).uploadFile(file, Desktop.DESKTOP_PATH)
        } catch (err) {
          console.error('[Desktop] 上传文件失败:', file.name, err)
        }
      }
      this.refreshIcons()
    })
  }

  /** 显示桌面右键菜单 */
  private showDesktopContextMenu(x: number, y: number): void {
    this.contextMenu.show(x, y, [
      {
        icon: this.refreshIcon(),
        label: '刷新',
        action: () => this.refreshIcons()
      },
      { separator: true },
      {
        icon: this.newFolderIcon(),
        label: '新建文件夹',
        action: () => this.createNewFolder()
      },
      {
        icon: this.newFileIcon(),
        label: '新建文本文件',
        action: () => this.createNewTextFile()
      },
      { separator: true },
      {
        icon: this.wallpaperIcon(),
        label: '更改壁纸',
        action: () => this.eventBus.emit('app:launch', 'settings')
      },
      {
        icon: this.settingsIcon(),
        label: '显示设置',
        action: () => this.eventBus.emit('app:launch', 'settings')
      }
    ])
  }

  /** 显示文件项右键菜单 */
  private showItemContextMenu(x: number, y: number, item: FileSystemItem): void {
    this.contextMenu.show(x, y, [
      {
        icon: this.openIcon(),
        label: '打开',
        action: async () => {
          if (item.type === 'folder') {
            this.eventBus.emit('app:launch', 'file-manager', 'desktop', item.id)
          } else if (isOfficeFile(item.name)) {
            this.eventBus.emit('app:launch', 'office', item.id, item.name, '', 'Desktop/' + item.name)
          } else if (isMarkdownFile(item.name)) {
            this.eventBus.emit('app:launch', 'markdown', 'Desktop/' + item.name, item.name)
          } else if (IMAGE_EXTS.test(item.name)) {
            this.eventBus.emit('app:launch', 'photo-viewer', 'Desktop/' + item.name)
          } else if (AUDIO_EXTS.test(item.name)) {
            this.eventBus.emit('app:launch', 'music-player', 'Desktop/' + item.name)
          } else if (VIDEO_EXTS.test(item.name)) {
            this.eventBus.emit('app:launch', 'video-player', 'Desktop/' + item.name)
          } else if (isESolutionFile(item.name)) {
            this.eventBus.emit('app:launch', 'epp-compiler-solution', 'Desktop/' + item.name)
          } else if (isEProjectFile(item.name)) {
            this.eventBus.emit('app:launch', 'epp-compiler-project', 'Desktop/' + item.name)
          } else if (isEPPFile(item.name)) {
            this.eventBus.emit('app:launch', 'epp-runner-file', 'Desktop/' + item.name)
          } else if (isESourceFile(item.name)) {
            this.eventBus.emit('app:launch', 'epp-compiler-open', 'Desktop/' + item.name)
          } else {
            const content = await this.fs.readFile(item.id)
            this.eventBus.emit('app:launch', 'notepad', item.id, item.name, content || '', 'Desktop/' + item.name)
          }
        }
      },
      { separator: true },
      {
        icon: this.renameIcon(),
        label: '重命名',
        action: () => this.renameItem(item)
      },
      {
        icon: this.deleteIcon(),
        label: '删除',
        action: () => this.deleteItem(item)
      }
    ])
  }

  /** 在指定目录下生成不重名的名称 */
  private async getUniqueName(name: string, parentId: string): Promise<string> {
    const children = await this.fs.listFiles(parentId)
    if (!children.some(c => c.name === name)) return name
    const dotIndex = name.lastIndexOf('.')
    const base = dotIndex > 0 ? name.slice(0, dotIndex) : name
    const ext = dotIndex > 0 ? name.slice(dotIndex) : ''
    let counter = 2
    while (children.some(c => c.name === `${base} (${counter})${ext}`)) {
      counter++
    }
    return `${base} (${counter})${ext}`
  }

  /** 新建文件夹 */
  private async createNewFolder(): Promise<void> {
    const desktopFolder = await this.fs.getByPath('Desktop')
    if (!desktopFolder) return
    const name = await this.getUniqueName('新建文件夹', desktopFolder.id)
    await this.fs.createFolder(name, desktopFolder.id)
    this.refreshIcons()
  }

  /** 新建文本文件 */
  private async createNewTextFile(): Promise<void> {
    const desktopFolder = await this.fs.getByPath('Desktop')
    if (!desktopFolder) return
    const name = await this.getUniqueName('新文件.txt', desktopFolder.id)
    await this.fs.writeFile('Desktop/' + name, '')
    this.refreshIcons()
  }

  /** 重命名项目 */
  private async renameItem(item: FileSystemItem): Promise<void> {
    const newName = await dialog.prompt('请输入新名称：', item.name)
    if (!newName || newName === item.name) return
    await this.fs.rename(item.id, newName)
    this.refreshIcons()
  }

  /** 删除项目 */
  private async deleteItem(item: FileSystemItem): Promise<void> {
    // UAC 确认
    const allowed = await requestUac(this.eventBus, {
      operation: '删除文件',
      resource: item.name,
      source: '桌面'
    })
    if (!allowed) return
    const ok = await dialog.confirm(`确定要删除 "${item.name}" 吗？`)
    if (!ok) return
    await this.fs.deleteItem(item.id)
    this.refreshIcons()
  }

  /** HTML 转义 */
  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  // ===== 图标 SVG 资源 =====

  private folderIcon(): string {
    return assetIcon('文件夹.svg')
  }

  private fileIcon(name: string): string {
    // EPP 相关文件使用专用图标
    if (isESolutionFile(name)) return ESLN_ICON
    if (isEProjectFile(name)) return EPPROJ_ICON
    if (isEPPFile(name)) return EPP_ICON
    if (isESourceFile(name)) return E_SOURCE_ICON
    // PDF/Word/Excel/PPT 使用专用图标
    if (isOfficeFile(name)) {
      return officeFileIcon(name)
    }
    // 图片 / 音频 / 视频使用专用图标
    if (IMAGE_EXTS.test(name)) return IMAGE_ICON
    if (AUDIO_EXTS.test(name)) return AUDIO_ICON
    if (VIDEO_EXTS.test(name)) return VIDEO_ICON
    const ext = name.split('.').pop()?.toLowerCase() || ''
    let color = '#6ba3d6'
    let label = 'TXT'
    if (ext === 'md') { color = '#5a8c4a'; label = 'MD' }
    else if (ext === 'json') { color = '#c99020'; label = 'JSON' }
    else if (ext === 'html') { color = '#d6534a'; label = 'HTML' }
    else if (ext === 'js' || ext === 'ts') { color = '#c9a227'; label = ext.toUpperCase() }
    return `<svg viewBox="0 0 48 48" width="40" height="40"><path d="M10 4 h20 l10 10 v28 a2 2 0 0 1-2 2 H10 a2 2 0 0 1-2-2 V6 a2 2 0 0 1 2-2 z" fill="#ffffff" stroke="#bbbbbb" stroke-width="1"/><path d="M30 4 v8 a2 2 0 0 0 2 2 h8 z" fill="#dddddd"/><rect x="8" y="26" width="32" height="14" fill="${color}"/><text x="24" y="36" font-size="9" font-weight="bold" fill="white" text-anchor="middle" font-family="Segoe UI,Arial">${label}</text></svg>`
  }

  private computerIcon(): string {
    return `<svg viewBox="0 0 48 48" width="40" height="40"><rect x="6" y="8" width="36" height="24" rx="2" fill="#3a5a8a" stroke="#2a4070" stroke-width="1"/><rect x="9" y="11" width="30" height="18" fill="#9ec5e8"/><rect x="16" y="34" width="16" height="3" fill="#888"/><rect x="12" y="37" width="24" height="4" rx="1" fill="#aaa"/><text x="24" y="44" font-size="0" fill="transparent"/></svg>`
  }

  private recycleIcon(): string {
    return `<svg viewBox="0 0 48 48" width="40" height="40"><path d="M14 16 h20 l-2 24 a2 2 0 0 1-2 2 H18 a2 2 0 0 1-2-2 z" fill="#cfd8dc" stroke="#90a4ae" stroke-width="1"/><rect x="12" y="12" width="24" height="4" rx="1" fill="#78909c"/><line x1="20" y1="22" x2="20" y2="36" stroke="#78909c" stroke-width="1.5"/><line x1="24" y1="22" x2="24" y2="36" stroke="#78909c" stroke-width="1.5"/><line x1="28" y1="22" x2="28" y2="36" stroke="#78909c" stroke-width="1.5"/></svg>`
  }

  private browserIcon(): string {
    return `<svg viewBox="0 0 48 48" width="40" height="40"><circle cx="24" cy="24" r="18" fill="#4a90d9" stroke="#2d5aa0" stroke-width="1"/><circle cx="24" cy="24" r="8" fill="#ffffff"/><ellipse cx="24" cy="24" rx="18" ry="7" fill="none" stroke="#ffffff" stroke-width="1.5"/><line x1="6" y1="24" x2="42" y2="24" stroke="#ffffff" stroke-width="1.5"/></svg>`
  }

  private refreshIcon(): string {
    return `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 8 a5 5 0 1 1-1.5-3.5"/><path d="M13 2 v3.5 h-3.5"/></svg>`
  }

  private newFolderIcon(): string {
    return `<svg viewBox="0 0 16 16" width="14" height="14"><path d="M1 4 a1 1 0 0 1 1-1 h3 l1 1 h8 a1 1 0 0 1 1 1 v8 a1 1 0 0 1-1 1 H2 a1 1 0 0 1-1-1 z" fill="#f5c146"/></svg>`
  }

  private newFileIcon(): string {
    return `<svg viewBox="0 0 16 16" width="14" height="14"><path d="M3 1 h7 l3 3 v10 a1 1 0 0 1-1 1 H3 a1 1 0 0 1-1-1 V2 a1 1 0 0 1 1-1 z" fill="#fff" stroke="#888"/><line x1="8" y1="8" x2="8" y2="13" stroke="#4a90d9" stroke-width="1.5"/><line x1="5.5" y1="10.5" x2="10.5" y2="10.5" stroke="#4a90d9" stroke-width="1.5"/></svg>`
  }

  private wallpaperIcon(): string {
    return `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1.5" y="2.5" width="13" height="11" rx="1"/><path d="M1.5 11 L5 7 L8 10 L11 6 L14.5 9.5"/><circle cx="5.5" cy="5.5" r="1" fill="currentColor"/></svg>`
  }

  private settingsIcon(): string {
    return `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="8" cy="8" r="2"/><path d="M8 1 v2 M8 13 v2 M1 8 h2 M13 8 h2 M3 3 l1.5 1.5 M11.5 11.5 l1.5 1.5 M3 13 l1.5-1.5 M11.5 4.5 l1.5-1.5"/></svg>`
  }

  private openIcon(): string {
    return `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M2 5 a1 1 0 0 1 1-1 h3 l1 1 h6 a1 1 0 0 1 1 1 v6 a1 1 0 0 1-1 1 H3 a1 1 0 0 1-1-1 z"/></svg>`
  }

  private renameIcon(): string {
    return `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M2 12 L11 3 L13 5 L4 14 z"/><path d="M11 3 L13 1 L15 3 L13 5"/></svg>`
  }

  private deleteIcon(): string {
    return `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M3 4 h10 M6 4 V2.5 a1 1 0 0 1 1-1 h2 a1 1 0 0 1 1 1 V4 M4.5 4 L5.5 14 a1 1 0 0 0 1 1 h3 a1 1 0 0 0 1-1 L11.5 4"/></svg>`
  }

  // ===== 系统图标（用于桌面系统图标渲染） =====

  private terminalIcon(): string {
    return TERMINAL_ICON
  }

  private notepadIcon(): string {
    return `<svg viewBox="0 0 48 48" width="40" height="40"><rect x="6" y="4" width="36" height="40" rx="2" fill="#ffffff" stroke="#888"/><line x1="12" y1="14" x2="36" y2="14" stroke="#4a90d9" stroke-width="2"/><line x1="12" y1="22" x2="36" y2="22" stroke="#4a90d9" stroke-width="2"/><line x1="12" y1="30" x2="28" y2="30" stroke="#4a90d9" stroke-width="2"/></svg>`
  }

  private markdownIcon(): string {
    return `<svg viewBox="0 0 48 48" width="40" height="40"><rect x="4" y="4" width="40" height="40" rx="8" fill="#0284c7"/><rect x="10" y="12" width="28" height="24" rx="3" fill="#e0f2fe"/><path d="M15 30l4-7 3 4 4-8 4 11" fill="none" stroke="#0369a1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  }

  private aiIcon(): string {
    return `<svg viewBox="0 0 48 48" width="40" height="40"><path d="M24 6 L28 20 L42 24 L28 28 L24 42 L20 28 L6 24 L20 20 z" fill="#9b59b6"/></svg>`
  }

  private weatherIcon(): string {
    return `<svg viewBox="0 0 48 48" width="40" height="40"><circle cx="18" cy="18" r="8" fill="#ffb900"/><path d="M12 34 a8 8 0 0 1 2-16 a10 10 0 0 1 18 2 a6 6 0 0 1 2 12 z" fill="#9ec5e8"/></svg>`
  }

  private monitorIcon(): string {
    return `<svg viewBox="0 0 48 48" width="40" height="40" fill="none" stroke="#16a34a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 24 h8 l6-16 l8 32 l6-16 h8"/></svg>`
  }

  private paintIcon(): string {
    return `<svg viewBox="0 0 48 48" width="40" height="40"><rect x="4" y="4" width="40" height="40" rx="8" fill="#ea580c"/><circle cx="24" cy="24" r="12" fill="#fff7ed"/><circle cx="20" cy="21" r="3" fill="#ef4444"/><circle cx="28" cy="21" r="3" fill="#22c55e"/><circle cx="24" cy="30" r="3" fill="#3b82f6"/></svg>`
  }

  private musicIcon(): string {
    return assetIcon('音乐.svg')
  }

  private videoIcon(): string {
    return VIDEO_PLAYER_ICON
  }

  private officeIcon(): string {
    return `<svg viewBox="0 0 48 48" width="40" height="40"><rect x="4" y="4" width="40" height="40" rx="8" fill="#7c3aed"/><rect x="12" y="10" width="18" height="22" rx="2" fill="#fff" transform="rotate(-8 21 21)"/><rect x="24" y="14" width="18" height="22" rx="2" fill="#fff" transform="rotate(8 33 25)"/><rect x="27" y="20" width="10" height="2" rx="1" fill="#7c3aed" transform="rotate(8 33 25)"/><rect x="27" y="25" width="10" height="2" rx="1" fill="#a78bfa" transform="rotate(8 33 25)"/><rect x="14" y="16" width="10" height="2" rx="1" fill="#7c3aed" transform="rotate(-8 21 21)"/><rect x="14" y="21" width="10" height="2" rx="1" fill="#a78bfa" transform="rotate(-8 21 21)"/></svg>`
  }

  private photoIcon(): string {
    return `<svg viewBox="0 0 48 48" width="40" height="40"><rect x="4" y="4" width="40" height="40" rx="8" fill="#059669"/><rect x="10" y="12" width="28" height="24" rx="3" fill="#ecfdf5"/><circle cx="18" cy="19" r="3" fill="#34d399"/><path d="M16 30l7-7 6 6 4-4 6 6z" fill="#10b981"/></svg>`
  }

  private calcIcon(): string {
    return `<svg viewBox="0 0 48 48" width="40" height="40"><rect x="4" y="4" width="40" height="40" rx="8" fill="#1d4ed8"/><rect x="10" y="10" width="28" height="10" rx="2" fill="#1e3a8a"/><text x="36" y="18" font-size="8" fill="#93c5fd" text-anchor="end" font-family="monospace">123</text><circle cx="16" cy="26" r="4" fill="#60a5fa"/><circle cx="26" cy="26" r="4" fill="#60a5fa"/><circle cx="36" cy="26" r="4" fill="#f97316"/><circle cx="16" cy="36" r="4" fill="#60a5fa"/><circle cx="26" cy="36" r="4" fill="#60a5fa"/><circle cx="36" cy="36" r="4" fill="#f97316"/></svg>`
  }

  private eppIcon(): string {
    return `<svg viewBox="0 0 48 48" width="40" height="40"><rect x="4" y="4" width="40" height="40" rx="8" fill="#0891b2"/><rect x="8" y="10" width="32" height="10" rx="2" fill="#e0f2fe"/><line x1="12" y1="15" x2="20" y2="15" stroke="#0891b2" stroke-width="2" stroke-linecap="round"/><line x1="26" y1="15" x2="34" y2="15" stroke="#0891b2" stroke-width="2" stroke-linecap="round"/><path d="M16 26 L22 30 L16 34" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><rect x="10" y="36" width="10" height="3" rx="1.5" fill="#fff" opacity="0.8"/><rect x="24" y="36" width="10" height="3" rx="1.5" fill="#fff" opacity="0.8"/></svg>`
  }

  private regeditIcon(): string {
    return `<svg viewBox="0 0 48 48" width="40" height="40"><rect x="4" y="4" width="40" height="40" rx="8" fill="#4b5563"/><rect x="10" y="12" width="28" height="24" rx="2" fill="#fff"/><line x1="10" y1="18" x2="38" y2="18" stroke="#9ca3af" stroke-width="1.5"/><rect x="14" y="22" width="10" height="2" rx="1" fill="#4b5563"/><rect x="14" y="28" width="8" height="2" rx="1" fill="#9ca3af"/><rect x="26" y="22" width="10" height="2" rx="1" fill="#4b5563"/><rect x="26" y="28" width="8" height="2" rx="1" fill="#9ca3af"/></svg>`
  }

  private servicesIcon(): string {
    return `<svg viewBox="0 0 48 48" width="40" height="40"><rect x="4" y="4" width="40" height="40" rx="8" fill="#374151"/><path d="M24 14 L24 18 M24 30 L24 34 M14 24 L18 24 M30 24 L34 24 M17 17 L19 19 M29 29 L31 31 M31 17 L29 19 M19 29 L17 31" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="24" cy="24" r="6" fill="none" stroke="#fff" stroke-width="2"/><circle cx="24" cy="24" r="2.5" fill="#fff"/></svg>`
  }

  private startupIcon(): string {
    return `<svg viewBox="0 0 48 48" width="40" height="40"><rect x="4" y="4" width="40" height="40" rx="8" fill="#2563eb"/><path d="M24 12 L24 30 M18 24 L24 30 L30 24" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><rect x="14" y="34" width="20" height="4" rx="2" fill="#fff" opacity="0.8"/></svg>`
  }

  private eventViewerIcon(): string {
    return `<svg viewBox="0 0 48 48" width="40" height="40"><rect x="4" y="4" width="40" height="40" rx="8" fill="#0284c7"/><rect x="10" y="10" width="28" height="28" rx="2" fill="#fff"/><line x1="10" y1="18" x2="38" y2="18" stroke="#0284c7" stroke-width="1.5"/><circle cx="16" cy="24" r="2" fill="#16a34a"/><rect x="21" y="23" width="14" height="2" rx="1" fill="#6b7280"/><circle cx="16" cy="30" r="2" fill="#dc2626"/><rect x="21" y="29" width="10" height="2" rx="1" fill="#6b7280"/></svg>`
  }

  private envIcon(): string {
    return ENV_EDITOR_ICON
  }

  private settingsLargeIcon(): string {
    return SETTINGS_ICON
  }

  getElement(): HTMLElement {
    return this.element
  }
}
