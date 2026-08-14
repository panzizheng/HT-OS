import { EventBus } from '../kernel/EventBus'
import { SettingsManager } from '../kernel/SettingsManager'
import { NotificationService, AppNotification } from '../kernel/NotificationService'
import { ENV_EDITOR_ICON, VIDEO_PLAYER_ICON, SETTINGS_ICON, TERMINAL_ICON, assetIcon } from '../apps/system-icons'

interface StartApp {
  id: string
  name: string
  icon: string
}

/**
 * 任务栏
 * 左侧：关机Logo + 开始按钮
 * 中间：运行中窗口
 * 右侧：天气 + 通知中心 + 搜索 + 刷新桌面 + 聊天
 */
export class Taskbar {
  private element: HTMLElement
  private leftSection: HTMLElement
  private tasksContainer: HTMLElement
  private rightSection: HTMLElement
  private eventBus: EventBus
  private settings: SettingsManager
  private notifications: NotificationService | null = null
  private startMenu: HTMLElement
  private appLibraryOverlay: HTMLElement | null = null
  private weatherEl: HTMLElement
  private clockInterval: number | null = null
  private notificationPanel: HTMLElement | null = null
  private notificationBadge: HTMLElement | null = null
  private toastContainer: HTMLElement | null = null
  private startSearchInput: HTMLInputElement | null = null
  private startSearchResults: HTMLElement | null = null
  private allApps: StartApp[] = []

  constructor(container: HTMLElement, eventBus: EventBus, settings: SettingsManager) {
    this.eventBus = eventBus
    this.settings = settings

    this.element = document.createElement('div')
    this.element.className = 'ht-taskbar'
    container.appendChild(this.element)

    this.leftSection = this.createLeftSection()
    this.element.appendChild(this.leftSection)

    this.tasksContainer = document.createElement('div')
    this.tasksContainer.className = 'taskbar-tasks'
    this.element.appendChild(this.tasksContainer)

    this.rightSection = this.createRightSection()
    this.element.appendChild(this.rightSection)

    this.startMenu = this.createStartMenu()
    container.appendChild(this.startMenu)

    // Toast 容器
    this.toastContainer = document.createElement('div')
    this.toastContainer.className = 'toast-container'
    container.appendChild(this.toastContainer)

    this.weatherEl = this.rightSection.querySelector('.tray-weather') as HTMLElement

    this.setupEvents()
    this.startClock()
    this.updateWeather()
  }

  /** 注入通知服务（由 main.ts 在初始化后调用） */
  setNotificationService(notifications: NotificationService): void {
    this.notifications = notifications
    this.setupNotifications()
  }

  /** 左侧：Logo + 开始按钮 */
  private createLeftSection(): HTMLElement {
    const left = document.createElement('div')
    left.className = 'taskbar-left'

    const logoBtn = document.createElement('button')
    logoBtn.className = 'tray-btn tray-logo'
    logoBtn.title = '电源管理'
    logoBtn.innerHTML = this.logoIcon()
    logoBtn.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation()
      this.togglePowerMenu(logoBtn)
    })

    const startBtn = document.createElement('button')
    startBtn.className = 'tray-btn tray-start'
    startBtn.title = '开始'
    startBtn.innerHTML = this.startIcon()
    startBtn.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation()
      this.toggleStartMenu()
    })

    left.appendChild(logoBtn)
    left.appendChild(startBtn)
    return left
  }

  /** 右侧：天气 + 通知 + 搜索 + 刷新 + 全屏资源库 + 聊天 + 语言 */
  private createRightSection(): HTMLElement {
    const right = document.createElement('div')
    right.className = 'taskbar-right'

    const savedLang = localStorage.getItem('ht-os-lang') || 'zh'

    right.innerHTML = `
      <div class="tray-weather" title="点击查看详情">
        <span class="weather-text">今天天气0度</span>
      </div>
      <div class="tray-btn tray-search" title="搜索 (Win+Q)">
        ${this.searchIcon()}
      </div>
      <div class="tray-btn tray-notification" title="通知中心">
        ${this.notificationIcon()}
        <span class="notification-badge" style="display:none;"></span>
      </div>
      <div class="tray-btn tray-refresh" title="刷新桌面">
        ${this.refreshIcon()}
      </div>
      <div class="tray-btn tray-apps" title="全屏应用资源库">
        ${this.appLibraryIcon()}
      </div>
      <div class="tray-btn tray-chat" title="聊天">
        ${this.chatIcon()}
      </div>
      <div class="tray-lang" title="切换语言">
        <span class="lang-item lang-zh ${savedLang === 'zh' ? 'active' : ''}" data-lang="zh">中</span>
        <span class="lang-sep">/</span>
        <span class="lang-item lang-en ${savedLang === 'en' ? 'active' : ''}" data-lang="en">EN</span>
      </div>
    `
    return right
  }

  /** 开始菜单 */
  private createStartMenu(): HTMLElement {
    const menu = document.createElement('div')
    menu.className = 'start-menu'
    menu.style.display = 'none'

    const apps: StartApp[] = [
      { id: 'file-manager', name: '文件管理器', icon: this.appFileIcon() },
      { id: 'terminal', name: '终端', icon: this.appTerminalIcon() },
      { id: 'notepad', name: '记事本', icon: this.appNotepadIcon() },
      { id: 'markdown', name: 'Markdown', icon: this.appMarkdownIcon() },
      { id: 'office', name: 'HT 办公', icon: this.appOfficeIcon() },
      { id: 'photo-viewer', name: '照片', icon: this.appPhotoIcon() },
      { id: 'calculator', name: '计算器', icon: this.appCalcIcon() },
      { id: 'browser', name: '浏览器', icon: this.appBrowserIcon() },
      { id: 'settings', name: '设置', icon: this.appSettingsIcon() },
      { id: 'painter', name: '画图', icon: this.appPaintIcon() },
      { id: 'music-player', name: '音乐播放器', icon: this.appMusicIcon() },
      { id: 'video-player', name: '视频播放器', icon: this.appVideoIcon() },
      { id: 'weather', name: '天气', icon: this.appWeatherIcon() },
      { id: 'ai-assistant', name: 'AI 助手', icon: this.appAiIcon() },
      { id: 'task-manager', name: '任务管理器', icon: this.appMonitorIcon() },
      { id: 'regedit', name: '注册表编辑器', icon: this.appRegeditIcon() },
      { id: 'services', name: '服务管理器', icon: this.appServicesIcon() },
      { id: 'startup-manager', name: '启动项管理', icon: this.appStartupIcon() },
      { id: 'event-viewer', name: '事件查看器', icon: this.appEventViewerIcon() },
      { id: 'env-editor', name: '环境变量', icon: this.appEnvIcon() },
      { id: 'epp-compiler', name: 'EPP 编译器', icon: this.appEPPCompilerIcon() }
    ]

    // 保存应用列表供搜索使用
    this.allApps = apps

    const appListHtml = apps.map(a => `
      <div class="start-app" data-app="${a.id}">
        <span class="start-app-icon">${a.icon}</span>
        <span class="start-app-name">${a.name}</span>
      </div>
    `).join('')

    menu.innerHTML = `
      <div class="start-menu-header">
        <div class="start-user-name">${this.escapeHtml(this.settings.get('userName'))}</div>
      </div>
      <div class="start-menu-search">
        <span class="search-icon">${this.searchIcon()}</span>
        <input type="text" class="start-search-input" placeholder="搜索应用和文件..." autocomplete="off">
      </div>
      <div class="start-menu-search-results" style="display:none;"></div>
      <div class="start-menu-apps">${appListHtml}</div>
      <div class="start-menu-footer">
        <button class="power-btn" data-power="shutdown" title="关机">${this.powerIcon()}</button>
        <button class="power-btn" data-power="restart" title="重启">${this.restartIcon()}</button>
        <button class="power-btn" data-power="sleep" title="睡眠">${this.sleepIcon()}</button>
      </div>
    `
    return menu
  }

  private setupEvents(): void {
    document.addEventListener('click', (e: MouseEvent) => {
      if (this.startMenu.style.display === 'none' || this.startMenu.classList.contains('closing')) return
      const t = e.target as HTMLElement
      if (!t.closest('.start-menu') && !t.closest('.tray-start')) {
        this.hideStartMenu()
      }
    })

    this.startMenu.querySelectorAll('.start-app').forEach(app => {
      app.addEventListener('click', () => {
        const appId = app.getAttribute('data-app')
        if (appId) {
          this.eventBus.emit('app:launch', appId)
          this.hideStartMenu()
        }
      })
    })

    this.startMenu.querySelectorAll('.power-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-power')
        this.hideStartMenu()
        this.eventBus.emit('system:shutdown', action)
      })
    })

    this.eventBus.on('window:created', (id: string, title: string, icon: string) => {
      this.addTask(id, title, icon)
    })
    this.eventBus.on('window:closed', (id: string) => this.removeTask(id))
    this.eventBus.on('window:minimized', (id: string) => this.setTaskActive(id, false))
    this.eventBus.on('window:restored', (id: string) => this.setTaskActive(id, true))
    this.eventBus.on('window:focusChanged', (id: string) => {
      this.tasksContainer.querySelectorAll('.task-item').forEach(item => {
        const ti = item as HTMLElement
        ti.classList.toggle('active', ti.dataset.windowId === id)
      })
    })

    const refreshBtn = this.rightSection.querySelector('.tray-refresh') as HTMLElement
    refreshBtn.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation()
      this.desktopRefresh()
    })

    const appsBtn = this.rightSection.querySelector('.tray-apps') as HTMLElement
    appsBtn.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation()
      this.toggleFullScreenApps()
    })

    const chatBtn = this.rightSection.querySelector('.tray-chat') as HTMLElement
    chatBtn.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation()
      this.eventBus.emit('app:launch', 'ai-assistant')
    })

    const weatherBtn = this.rightSection.querySelector('.tray-weather') as HTMLElement
    weatherBtn.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation()
      this.eventBus.emit('app:launch', 'weather')
    })

    // 通知中心按钮
    const notifBtn = this.rightSection.querySelector('.tray-notification') as HTMLElement
    this.notificationBadge = notifBtn.querySelector('.notification-badge') as HTMLElement
    notifBtn.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation()
      this.toggleNotificationPanel()
    })

    // 搜索按钮
    const searchBtn = this.rightSection.querySelector('.tray-search') as HTMLElement
    searchBtn.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation()
      this.showStartMenu()
      setTimeout(() => this.startSearchInput?.focus(), 100)
    })

    // 语言切换
    const langItems = this.rightSection.querySelectorAll<HTMLElement>('.lang-item')
    langItems.forEach(item => {
      item.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation()
        const lang = item.dataset.lang || 'zh'
        localStorage.setItem('ht-os-lang', lang)
        langItems.forEach(li => li.classList.remove('active'))
        item.classList.add('active')
        this.eventBus.emit('lang:changed', lang)
      })
    })

    // 开始菜单搜索框
    this.startSearchInput = this.startMenu.querySelector('.start-search-input') as HTMLInputElement
    this.startSearchResults = this.startMenu.querySelector('.start-menu-search-results') as HTMLElement
    this.startSearchInput.addEventListener('input', () => this.handleSearch())
    this.startSearchInput.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.startSearchInput!.value = ''
        this.handleSearch()
      } else if (e.key === 'Enter') {
        // 打开第一个搜索结果
        const first = this.startSearchResults?.querySelector('.search-result-item') as HTMLElement
        if (first) first.click()
      }
    })

    // 全局快捷键：Win+Q 打开搜索
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'q') {
        e.preventDefault()
        this.showStartMenu()
        setTimeout(() => this.startSearchInput?.focus(), 100)
      }
    })
  }

  /** 处理开始菜单搜索 */
  private handleSearch(): void {
    if (!this.startSearchInput || !this.startSearchResults) return
    const query = this.startSearchInput.value.trim().toLowerCase()

    if (!query) {
      this.startSearchResults.style.display = 'none'
      this.startSearchResults.innerHTML = ''
      return
    }

    // 搜索应用
    const matchedApps = this.allApps.filter(a =>
      a.name.toLowerCase().includes(query) || a.id.toLowerCase().includes(query)
    )

    this.startSearchResults.innerHTML = ''
    if (matchedApps.length > 0) {
      const title = document.createElement('div')
      title.className = 'search-group-title'
      title.textContent = '应用'
      this.startSearchResults.appendChild(title)
      matchedApps.forEach(a => {
        const item = document.createElement('div')
        item.className = 'search-result-item'
        item.innerHTML = `<span class="search-result-icon">${a.icon}</span><span class="search-result-name">${a.name}</span>`
        item.addEventListener('click', () => {
          this.eventBus.emit('app:launch', a.id)
          this.hideStartMenu()
          this.startSearchInput!.value = ''
          this.handleSearch()
        })
        this.startSearchResults!.appendChild(item)
      })
    } else {
      const empty = document.createElement('div')
      empty.className = 'search-empty'
      empty.textContent = '没有找到匹配的应用'
      this.startSearchResults.appendChild(empty)
    }

    this.startSearchResults.style.display = 'block'
  }

  /** 设置通知服务监听 */
  private setupNotifications(): void {
    if (!this.notifications) return

    // 监听通知列表变更
    this.notifications.onChange((notifications) => {
      this.updateNotificationBadge(notifications)
      if (this.notificationPanel && this.notificationPanel.classList.contains('open')) {
        this.renderNotificationList(notifications)
      }
    })

    // 监听新 Toast
    this.notifications.onToast((n) => {
      this.showToast(n)
    })

    // 初始化 badge
    this.updateNotificationBadge(this.notifications.getAll())
  }

  /** 更新通知未读数 */
  private updateNotificationBadge(notifications: AppNotification[]): void {
    if (!this.notificationBadge) return
    const count = notifications.filter(n => !n.read).length
    if (count > 0) {
      this.notificationBadge.textContent = count > 99 ? '99+' : String(count)
      this.notificationBadge.style.display = 'flex'
    } else {
      this.notificationBadge.style.display = 'none'
    }
  }

  /** 切换通知中心面板 */
  private toggleNotificationPanel(): void {
    if (this.notificationPanel && this.notificationPanel.classList.contains('open')) {
      this.hideNotificationPanel()
    } else {
      this.showNotificationPanel()
    }
  }

  /** 显示通知中心 */
  private showNotificationPanel(): void {
    if (!this.notifications) return

    if (!this.notificationPanel) {
      this.notificationPanel = document.createElement('div')
      this.notificationPanel.className = 'notification-panel'
      this.element.appendChild(this.notificationPanel)
    }

    this.renderNotificationList(this.notifications.getAll())
    this.notificationPanel.classList.add('open')
  }

  /** 隐藏通知中心 */
  private hideNotificationPanel(): void {
    if (this.notificationPanel) {
      this.notificationPanel.classList.remove('open')
    }
  }

  /** 渲染通知列表 */
  private renderNotificationList(notifications: AppNotification[]): void {
    if (!this.notificationPanel || !this.notifications) return

    const levelColors: Record<string, string> = {
      info: '#0078d4',
      warning: '#f59e0b',
      error: '#dc2626',
      success: '#16a34a'
    }

    const formatTime = (t: number): string => {
      const d = new Date(t)
      const now = Date.now()
      const diff = now - t
      if (diff < 60000) return '刚刚'
      if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前'
      if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前'
      return d.toLocaleString('zh-CN')
    }

    if (notifications.length === 0) {
      this.notificationPanel.innerHTML = `
        <div class="notif-panel-header">
          <span class="notif-panel-title">通知</span>
          <button class="notif-clear-all" title="清除所有">全部清除</button>
        </div>
        <div class="notif-empty">没有新通知</div>
      `
    } else {
      const itemsHtml = notifications.map(n => `
        <div class="notif-item ${n.read ? 'read' : 'unread'}" data-id="${n.id}">
          <div class="notif-item-header">
            <span class="notif-dot" style="background:${levelColors[n.level] || '#888'};"></span>
            <span class="notif-app">${this.escapeHtml(n.app)}</span>
            <span class="notif-time">${formatTime(n.time)}</span>
            <button class="notif-close" data-id="${n.id}" title="删除">✕</button>
          </div>
          <div class="notif-title">${this.escapeHtml(n.title)}</div>
          <div class="notif-message">${this.escapeHtml(n.message)}</div>
        </div>
      `).join('')

      this.notificationPanel.innerHTML = `
        <div class="notif-panel-header">
          <span class="notif-panel-title">通知</span>
          <button class="notif-mark-all">全部标为已读</button>
          <button class="notif-clear-all" title="清除所有">全部清除</button>
        </div>
        <div class="notif-list">${itemsHtml}</div>
      `

      // 标记已读
      this.notificationPanel.querySelectorAll('.notif-item').forEach(item => {
        item.addEventListener('click', (e) => {
          if ((e.target as HTMLElement).classList.contains('notif-close')) return
          const id = parseInt(item.getAttribute('data-id') || '0', 10)
          this.notifications!.markRead(id)
        })
      })

      // 删除单个
      this.notificationPanel.querySelectorAll('.notif-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation()
          const id = parseInt(btn.getAttribute('data-id') || '0', 10)
          this.notifications!.remove(id)
        })
      })

      // 全部标记已读
      this.notificationPanel.querySelector('.notif-mark-all')?.addEventListener('click', () => {
        this.notifications!.markAllRead()
      })

      // 全部清除
      this.notificationPanel.querySelector('.notif-clear-all')?.addEventListener('click', () => {
        this.notifications!.clear()
      })
    }
  }

  /** 显示 Toast 弹出 */
  private showToast(n: AppNotification): void {
    if (!this.toastContainer) return

    const levelColors: Record<string, string> = {
      info: '#0078d4',
      warning: '#f59e0b',
      error: '#dc2626',
      success: '#16a34a'
    }

    const toast = document.createElement('div')
    toast.className = 'toast-item'
    toast.innerHTML = `
      <div class="toast-header">
        <span class="toast-dot" style="background:${levelColors[n.level] || '#888'};"></span>
        <span class="toast-app">${this.escapeHtml(n.app)}</span>
      </div>
      <div class="toast-title">${this.escapeHtml(n.title)}</div>
      <div class="toast-message">${this.escapeHtml(n.message)}</div>
    `
    this.toastContainer.appendChild(toast)

    requestAnimationFrame(() => toast.classList.add('show'))

    // 4 秒后自动消失
    setTimeout(() => {
      toast.classList.remove('show')
      setTimeout(() => toast.remove(), 300)
    }, 4000)

    // 点击关闭
    toast.addEventListener('click', () => {
      toast.classList.remove('show')
      setTimeout(() => toast.remove(), 300)
      this.notifications?.markRead(n.id)
    })
  }

  /** 桌面刷新 */
  private desktopRefresh(): void {
    const desktop = document.querySelector('.ht-desktop')
    if (desktop) {
      desktop.animate(
        [{ opacity: 1 }, { opacity: 0.3 }, { opacity: 1 }],
        { duration: 400, easing: 'ease-in-out' }
      )
    }
    this.eventBus.emit('desktop:refresh')
  }

  /** 全屏应用资源库（复用开始菜单图标） */
  private toggleFullScreenApps(): void {
    if (this.appLibraryOverlay) {
      // 关闭动画
      this.appLibraryOverlay.classList.remove('visible')
      this.appLibraryOverlay.classList.add('closing')
      const overlay = this.appLibraryOverlay
      setTimeout(() => {
        overlay.remove()
        document.body.style.overflow = ''
      }, 300)
      this.appLibraryOverlay = null
      return
    }

    const gridHtml = this.allApps.map(a => `
      <div class="fs-app-item" data-app="${a.id}" title="${a.name}">
        <div class="fs-app-icon">${a.icon}</div>
        <div class="fs-app-label">${this.escapeHtml(a.name)}</div>
      </div>
    `).join('')

    const overlay = document.createElement('div')
    overlay.className = 'fs-app-overlay'
    overlay.innerHTML = `
      <div class="fs-app-header">
        <div class="fs-app-title">应用资源库</div>
        <div class="fs-app-close">✕</div>
      </div>
      <div class="fs-app-grid">${gridHtml}</div>
    `
    document.body.appendChild(overlay)
    document.body.style.overflow = 'hidden'

    // 触发进入动画：从底部弹上来
    requestAnimationFrame(() => {
      overlay.classList.add('visible')
    })

    const close = () => {
      overlay.classList.remove('visible')
      overlay.classList.add('closing')
      setTimeout(() => {
        overlay.remove()
        this.appLibraryOverlay = null
        document.body.style.overflow = ''
      }, 300)
    }

    overlay.querySelector('.fs-app-close')!.addEventListener('click', close)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close()
    })
    // 使用一次性事件监听 Escape
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.appLibraryOverlay) {
        close()
        document.removeEventListener('keydown', onKey)
      }
    }
    document.addEventListener('keydown', onKey)

    overlay.querySelectorAll('.fs-app-item').forEach(item => {
      item.addEventListener('click', () => {
        const appId = item.getAttribute('data-app')
        if (appId) {
          this.eventBus.emit('app:launch', appId)
          close()
        }
      })
    })

    this.appLibraryOverlay = overlay
  }

  private toggleStartMenu(): void {
    if (this.startMenu.classList.contains('open')) this.hideStartMenu()
    else this.showStartMenu()
  }
  private showStartMenu(): void {
    this.startMenu.style.display = 'flex'
    // 强制 reflow 后添加 open 类，触发滑入动画
    void this.startMenu.offsetHeight
    this.startMenu.classList.add('open')
    this.leftSection.querySelector('.tray-start')?.classList.add('active')
  }
  private hideStartMenu(): void {
    this.startMenu.classList.remove('open')
    this.startMenu.classList.add('closing')
    this.leftSection.querySelector('.tray-start')?.classList.remove('active')
    setTimeout(() => {
      this.startMenu.style.display = 'none'
      this.startMenu.classList.remove('closing')
    }, 280)
  }

  private startClock(): void {
    const update = () => {
      const now = new Date()
      this.weatherEl.querySelector('.weather-text')!.textContent =
        now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }) +
        ' · ' + now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
    }
    update()
    this.clockInterval = window.setInterval(update, 1000)
  }

  private async updateWeather(): Promise<void> {
    try {
      const resp = await fetch('https://api.open-meteo.com/v1/forecast?latitude=39.9&longitude=116.4&current=temperature_2m,weather_code&timezone=Asia%2FShanghai')
      if (resp.ok) {
        const data = await resp.json()
        const temp = Math.round(data.current.temperature_2m)
        this.weatherEl.querySelector('.weather-text')!.textContent = `今天天气${temp}度`
      }
    } catch {}
  }

  addTask(windowId: string, title: string, icon: string): void {
    if (this.tasksContainer.querySelector(`[data-window-id="${windowId}"]`)) return
    const task = document.createElement('div')
    task.className = 'task-item'
    task.dataset.windowId = windowId
    task.innerHTML = `<span class="task-icon">${this.normalizeIcon(icon)}</span><span class="task-title">${this.escapeHtml(title)}</span>`
    task.title = title
    task.addEventListener('click', () => this.eventBus.emit('taskbar:toggle', windowId))
    this.tasksContainer.appendChild(task)
  }

  removeTask(windowId: string): void {
    const task = this.tasksContainer.querySelector(`[data-window-id="${windowId}"]`)
    if (task) task.remove()
  }

  setTaskActive(windowId: string, active: boolean): void {
    const task = this.tasksContainer.querySelector(`[data-window-id="${windowId}"]`)
    if (task) task.classList.toggle('active', active)
  }

  private normalizeIcon(icon: string): string {
    if (!icon) return this.appDefaultIcon()
    if (icon.trim().startsWith('<svg')) return icon
    return `<span style="font-size:16px;line-height:1">${icon}</span>`
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  // ===== 图标 =====

  private logoIcon(): string {
    return `<svg viewBox="0 0 239 239" width="100%" height="100%">
      <g fill-rule="nonzero">
        <circle cx="119.5" cy="119.5" r="119.5" fill="#252525"/>
        <circle cx="119.5" cy="119.5" r="70.16667" fill="#ffffff"/>
        <circle cx="119.5" cy="119.5" r="54.83333" fill="#252525"/>
        <circle cx="119.5" cy="119.5" r="38.66667" fill="#ffffff"/>
        <circle cx="119.5" cy="119.5" r="25.125" fill="#252525"/>
        <path d="M165.41828,171.58044l-40.77649,-40.7765l10.6066,-10.60661l40.7765,40.7765z" fill="#ffffff"/>
        <path d="M164.11668,187.22317l-28.99138,-28.99138l8.48528,-8.48528l28.99138,28.99138z" fill="#252525"/>
      </g>
    </svg>`
  }

  private togglePowerMenu(btn: HTMLElement): void {
    const existing = document.getElementById('power-menu')
    if (existing) {
      this.closePowerMenu()
      return
    }

    const overlay = document.createElement('div')
    overlay.id = 'power-menu'
    overlay.className = 'power-overlay'

    overlay.innerHTML = `
      <div class="power-overlay-bg"></div>
      <div class="power-panel">
        <div class="power-panel-header">
          <div class="power-panel-title">电源管理</div>
          <div class="power-panel-close" id="power-close">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </div>
        </div>
        <div class="power-buttons">
          <div class="power-card" data-power="sleep">
            <div class="power-card-icon">${this.sleepIcon()}</div>
            <div class="power-card-label">睡眠</div>
            <div class="power-card-desc">降低功耗，快速恢复</div>
          </div>
          <div class="power-card" data-power="restart">
            <div class="power-card-icon">${this.restartIcon()}</div>
            <div class="power-card-label">重启</div>
            <div class="power-card-desc">重新启动系统</div>
          </div>
          <div class="power-card power-card-danger" data-power="shutdown">
            <div class="power-card-icon">${this.powerIcon()}</div>
            <div class="power-card-label">关机</div>
            <div class="power-card-desc">完全关闭系统</div>
          </div>
        </div>
      </div>
    `
    document.body.appendChild(overlay)

    // 触发进入动画
    requestAnimationFrame(() => {
      overlay.classList.add('visible')
    })

    const close = () => {
      this.closePowerMenu()
      document.removeEventListener('click', onOutsideClick)
    }

    const onOutsideClick = (e: MouseEvent) => {
      if (!overlay.contains(e.target as Node)) {
        close()
      }
    }

    overlay.querySelector('#power-close')?.addEventListener('click', (e) => {
      e.stopPropagation()
      close()
    })

    overlay.querySelector('.power-overlay-bg')?.addEventListener('click', (e) => {
      e.stopPropagation()
      close()
    })

    overlay.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation()
      const card = (e.target as HTMLElement).closest('.power-card')
      if (card) {
        const action = card.getAttribute('data-power')
        if (action) {
          this.eventBus.emit('system:shutdown', action)
          close()
        }
      }
    })

    btn.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation()
    }, { once: true })

    setTimeout(() => {
      document.addEventListener('click', onOutsideClick)
    }, 10)
  }

  private closePowerMenu(): void {
    const overlay = document.getElementById('power-menu')
    if (!overlay) return
    overlay.classList.remove('visible')
    overlay.classList.add('closing')
    setTimeout(() => overlay.remove(), 350)
  }

  private startIcon(): string {
    return `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,10 8,5 13,10"/></svg>`
  }

  private refreshIcon(): string {
    return `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 8a5 5 0 1 1-1.5-3.5"/><path d="M13 3v3.5h-3.5"/></svg>`
  }

  private appLibraryIcon(): string {
    return `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><rect x="1" y="1" width="4" height="4" rx="1"/><rect x="6" y="1" width="4" height="4" rx="1"/><rect x="11" y="1" width="4" height="4" rx="1"/><rect x="1" y="6" width="4" height="4" rx="1"/><rect x="6" y="6" width="4" height="4" rx="1"/><rect x="11" y="6" width="4" height="4" rx="1"/><rect x="1" y="11" width="4" height="4" rx="1"/><rect x="6" y="11" width="4" height="4" rx="1"/><rect x="11" y="11" width="4" height="4" rx="1"/></svg>`
  }

  private chatIcon(): string {
    return `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3 h12 a1 1 0 0 1 1 1 v6 a1 1 0 0 1-1 1 h-3 l-3 3 v-3 H2 a1 1 0 0 1-1-1 V4 a1 1 0 0 1 1-1z"/></svg>`
  }

  private powerIcon(): string {
    return `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2 v6"/><path d="M4 5 a6 6 0 1 0 8 0"/></svg>`
  }
  private restartIcon(): string {
    return `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 8 a5 5 0 1 1-1.5-3.5"/><path d="M13 2 v3.5 h-3.5"/></svg>`
  }
  private sleepIcon(): string {
    return `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 3 a6 6 0 1 0 3 8 a5 5 0 0 1-3-8 z"/></svg>`
  }

  private appFileIcon(): string {
    return `<svg viewBox="0 0 64 64" width="100%" height="100%">
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#f7be50"/>
      <path d="M14 20a3 3 0 0 1 3-3h12l6 6h18a3 3 0 0 1 3 3v22a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3z" fill="#fff8e1"/>
      <path d="M14 26h36v19a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3z" fill="#ffecb3"/>
    </svg>`
  }
  private appTerminalIcon(): string {
    return TERMINAL_ICON
  }
  private appNotepadIcon(): string {
    return `<svg viewBox="0 0 64 64" width="100%" height="100%">
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#f1f3f7"/>
      <line x1="16" y1="20" x2="48" y2="20" stroke="#4a90d9" stroke-width="3" stroke-linecap="round"/>
      <line x1="16" y1="30" x2="48" y2="30" stroke="#4a90d9" stroke-width="3" stroke-linecap="round"/>
      <line x1="16" y1="40" x2="40" y2="40" stroke="#4a90d9" stroke-width="3" stroke-linecap="round"/>
    </svg>`
  }
  private appMarkdownIcon(): string {
    return `<svg viewBox="0 0 64 64" width="100%" height="100%">
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#0787c5"/>
      <rect x="12" y="14" width="40" height="36" rx="3" fill="#f0f9ff"/>
      <path d="M18 40l6-9 5 6 5-10 6 13" fill="none" stroke="#0284c7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`
  }
  private appCalcIcon(): string {
    return `<svg viewBox="0 0 64 64" width="100%" height="100%">
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#2c68e7"/>
      <rect x="14" y="12" width="36" height="12" rx="3" fill="#1e3a8a"/>
      <text x="46" y="21" font-size="10" fill="#93c5fd" text-anchor="end" font-family="monospace">123</text>
      <circle cx="20" cy="34" r="5" fill="#60a5fa"/>
      <circle cx="32" cy="34" r="5" fill="#60a5fa"/>
      <circle cx="44" cy="34" r="5" fill="#f97316"/>
      <circle cx="20" cy="48" r="5" fill="#60a5fa"/>
      <circle cx="32" cy="48" r="5" fill="#60a5fa"/>
      <circle cx="44" cy="48" r="5" fill="#f97316"/>
    </svg>`
  }
  private appBrowserIcon(): string {
    return `<svg viewBox="0 0 64 64" width="100%" height="100%">
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#4284f2"/>
      <circle cx="32" cy="32" r="14" fill="#fff"/>
      <circle cx="32" cy="32" r="6" fill="#3b82f6"/>
      <ellipse cx="32" cy="32" rx="16" ry="6" fill="none" stroke="#fff" stroke-width="2.5"/>
      <line x1="16" y1="32" x2="48" y2="32" stroke="#fff" stroke-width="2.5"/>
    </svg>`
  }
  private appSettingsIcon(): string {
    return SETTINGS_ICON
  }
  private appPaintIcon(): string {
    return `<svg viewBox="0 0 64 64" width="100%" height="100%">
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#f27524"/>
      <circle cx="32" cy="32" r="14" fill="#fff7ed"/>
      <circle cx="26" cy="28" r="4" fill="#ef4444"/>
      <circle cx="38" cy="28" r="4" fill="#22c55e"/>
      <circle cx="32" cy="40" r="4" fill="#3b82f6"/>
    </svg>`
  }
  private appPhotoIcon(): string {
    return `<svg viewBox="0 0 64 64" width="100%" height="100%">
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#1aa07d"/>
      <rect x="10" y="16" width="44" height="32" rx="4" fill="#ecfdf5"/>
      <circle cx="20" cy="24" r="4" fill="#34d399"/>
      <path d="M18 40l10-10 8 8 6-6 8 8z" fill="#10b981"/>
    </svg>`
  }
  private appMusicIcon(): string {
    return assetIcon('音乐.svg')
  }
  private appVideoIcon(): string {
    return VIDEO_PLAYER_ICON
  }
  private appWeatherIcon(): string {
    return `<svg viewBox="0 0 64 64" width="100%" height="100%">
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#1fa3dd"/>
      <circle cx="24" cy="26" r="9" fill="#fbbf24"/>
      <path d="M16 42a7 7 0 0 1 2-14a9 9 0 0 1 16 2a5 5 0 0 1 2 12z" fill="#e0f2fe"/>
    </svg>`
  }
  private appAiIcon(): string {
    return `<svg viewBox="0 0 64 64" width="100%" height="100%">
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#8b4bdb"/>
      <path d="M32 14l6 18 18 6-18 6-6 18-6-18-18-6 18-6z" fill="#f3e8ff"/>
    </svg>`
  }
  private appDefaultIcon(): string {
    return `<svg viewBox="0 0 64 64" width="100%" height="100%">
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#4284f2"/>
    </svg>`
  }
  private appMonitorIcon(): string {
    return `<svg viewBox="0 0 64 64" width="100%" height="100%">
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#2f9f5a"/>
      <rect x="10" y="14" width="44" height="30" rx="3" fill="#dcfce7"/>
      <path d="M14 36 L22 28 L28 32 L36 20 L50 36" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="24" y="48" width="16" height="4" rx="1" fill="#166534"/>
    </svg>`
  }
  private appOfficeIcon(): string {
    return `<svg viewBox="0 0 64 64" width="100%" height="100%">
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#9175f3"/>
      <rect x="16" y="12" width="22" height="28" rx="2" fill="#fff" transform="rotate(-8 27 26)"/>
      <rect x="30" y="18" width="22" height="28" rx="2" fill="#fff" transform="rotate(8 41 32)"/>
      <rect x="34" y="26" width="14" height="3" rx="1" fill="#7c3aed" transform="rotate(8 41 32)"/>
      <rect x="34" y="32" width="14" height="3" rx="1" fill="#a78bfa" transform="rotate(8 41 32)"/>
      <rect x="34" y="38" width="10" height="3" rx="1" fill="#a78bfa" transform="rotate(8 41 32)"/>
      <rect x="18" y="20" width="14" height="3" rx="1" fill="#7c3aed" transform="rotate(-8 27 26)"/>
      <rect x="18" y="26" width="14" height="3" rx="1" fill="#a78bfa" transform="rotate(-8 27 26)"/>
      <rect x="18" y="32" width="10" height="3" rx="1" fill="#a78bfa" transform="rotate(-8 27 26)"/>
    </svg>`
  }

  // 搜索图标（任务栏用）
  private searchIcon(): string {
    return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`
  }

  // 通知图标（任务栏用）
  private notificationIcon(): string {
    return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`
  }

  // 注册表编辑器图标
  private appRegeditIcon(): string {
    return `<svg viewBox="0 0 64 64" width="100%" height="100%">
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#79808a"/>
      <rect x="12" y="16" width="40" height="32" rx="3" fill="#fff"/>
      <line x1="12" y1="24" x2="52" y2="24" stroke="#6b7280" stroke-width="1.5"/>
      <rect x="16" y="28" width="14" height="3" rx="1" fill="#4b5563"/>
      <rect x="16" y="34" width="10" height="3" rx="1" fill="#9ca3af"/>
      <rect x="16" y="40" width="12" height="3" rx="1" fill="#9ca3af"/>
      <rect x="34" y="28" width="14" height="3" rx="1" fill="#4b5563"/>
      <rect x="34" y="34" width="10" height="3" rx="1" fill="#9ca3af"/>
      <rect x="34" y="40" width="12" height="3" rx="1" fill="#9ca3af"/>
    </svg>`
  }

  // 服务管理器图标
  private appServicesIcon(): string {
    return `<svg viewBox="0 0 64 64" width="100%" height="100%">
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#5a6570"/>
      <path d="M32 18 L32 22 M32 42 L32 46 M18 32 L22 32 M42 32 L46 32 M22 22 L25 25 M39 39 L42 42 M42 22 L39 25 M25 39 L22 42" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="32" cy="32" r="8" fill="none" stroke="#fff" stroke-width="2.5"/>
      <circle cx="32" cy="32" r="3" fill="#fff"/>
    </svg>`
  }

  // 启动项管理图标
  private appStartupIcon(): string {
    return `<svg viewBox="0 0 64 64" width="100%" height="100%">
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#4284f2"/>
      <path d="M32 14 L32 38 M24 30 L32 38 L40 30" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <rect x="18" y="44" width="28" height="6" rx="2" fill="#fff" opacity="0.8"/>
    </svg>`
  }

  // 事件查看器图标
  private appEventViewerIcon(): string {
    return `<svg viewBox="0 0 64 64" width="100%" height="100%">
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#1fa3dd"/>
      <rect x="14" y="14" width="36" height="36" rx="3" fill="#fff"/>
      <line x1="14" y1="24" x2="50" y2="24" stroke="#0284c7" stroke-width="1.5"/>
      <circle cx="20" cy="32" r="2" fill="#16a34a"/>
      <rect x="25" y="30" width="18" height="3" rx="1" fill="#6b7280"/>
      <circle cx="20" cy="40" r="2" fill="#dc2626"/>
      <rect x="25" y="38" width="14" height="3" rx="1" fill="#6b7280"/>
    </svg>`
  }

  // 环境变量图标
  private appEnvIcon(): string {
    return ENV_EDITOR_ICON
  }

  // EPP 编译器图标
  private appEPPCompilerIcon(): string {
    return `<svg viewBox="0 0 64 64" width="100%" height="100%">
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#09b2c3"/>
      <rect x="10" y="12" width="44" height="14" rx="2" fill="#e0f2fe"/>
      <line x1="14" y1="18" x2="28" y2="18" stroke="#0891b2" stroke-width="2" stroke-linecap="round"/>
      <line x1="34" y1="18" x2="44" y2="18" stroke="#0891b2" stroke-width="2" stroke-linecap="round"/>
      <path d="M20 30 L28 38 M36 30 L28 38" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="14" y="44" width="12" height="4" rx="2" fill="#fff" opacity="0.8"/>
      <rect x="30" y="44" width="12" height="4" rx="2" fill="#fff" opacity="0.8"/>
      <rect x="46" y="44" width="4" height="4" rx="1" fill="#fff" opacity="0.6"/>
    </svg>`
  }

  getElement(): HTMLElement { return this.element }

  destroy(): void {
    if (this.clockInterval) clearInterval(this.clockInterval)
  }
}
