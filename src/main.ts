// ============================================================
// HT OS 系统入口
// 启动流程：启动画面 -> 文件系统 -> OOBE/登录 -> 桌面
// ============================================================

import { EventBus } from './kernel/EventBus'
import { SettingsManager } from './kernel/SettingsManager'
import { Registry } from './kernel/Registry'
import { EventLog } from './kernel/EventLog'
import { NotificationService } from './kernel/NotificationService'
import { ServiceManager } from './kernel/ServiceManager'
import { StartupManager } from './kernel/StartupManager'
import { Environment } from './kernel/Environment'
import { UAC, bindUacToEventBus, requestUac } from './kernel/UAC'
import { WindowManager } from './wm/WindowManager'
import { FileSystem } from './fs/FileSystem'
import { RemoteFileSystem } from './fs/RemoteFileSystem'
import { Desktop } from './desktop/Desktop'
import { Taskbar } from './desktop/Taskbar'
import { registerSettingsApp } from './apps/settings'
import { registerFileManagerApp } from './apps/file-manager'
import { registerTerminalApp } from './apps/terminal'
import { registerNotepadApp } from './apps/notepad'
import { registerMarkdownApp } from './apps/markdown'
import { registerOfficeApp } from './apps/office'
import { registerPhotoViewerApp } from './apps/photo-viewer'
import { registerCalculatorApp } from './apps/calculator'
import { registerBrowserApp } from './apps/browser'
import { registerPainterApp } from './apps/painter'
import { registerMusicPlayerApp } from './apps/music-player'
import { registerVideoPlayerApp } from './apps/video-player'
import { registerWeatherApp } from './apps/weather'
import { registerAiAssistantApp } from './apps/ai-assistant'
import { registerSystemMonitorApp } from './apps/system-monitor'
import { registerRegistryEditorApp } from './apps/regedit'
import { registerServicesApp } from './apps/services'
import { registerStartupManagerApp } from './apps/startup-manager'
import { registerEventViewerApp } from './apps/event-viewer'
import { registerEnvEditorApp } from './apps/env-editor'
import { registerEPPCompilerApp, registerEPPRunnerApp, registerEPPCommands, runEPPFromFile, openESourceFile, openEProjectFile, openESolutionFile } from './apps/epp'
import './styles/main.css'

export class HTOS {
  private container: HTMLElement
  private eventBus: EventBus
  private settings: SettingsManager
  private registry: Registry
  private eventLog: EventLog
  private notifications: NotificationService
  private serviceManager: ServiceManager
  private startupManager: StartupManager
  private environment: Environment
  private uac: UAC
  private wm: WindowManager
  private fs: FileSystem
  private desktop: Desktop
  private taskbar: Taskbar
  private initialized: boolean = false
  private bootScreen: HTMLElement | null = null
  private loginScreen: HTMLElement | null = null
  private oobeScreen: HTMLElement | null = null

  constructor(container: HTMLElement | string) {
    this.container = typeof container === 'string'
      ? document.querySelector(container) as HTMLElement
      : container

    if (!this.container) {
      throw new Error('HT OS: 未找到容器元素')
    }

    this.eventBus = new EventBus()
    this.settings = new SettingsManager()
    // 现代系统内核服务
    this.registry = new Registry()
    this.eventLog = new EventLog()
    this.notifications = new NotificationService()
    this.serviceManager = new ServiceManager(this.eventLog)
    this.startupManager = new StartupManager(this.eventLog)
    this.environment = new Environment()
    this.uac = new UAC(this.eventLog, this.notifications, this.settings)

    this.wm = new WindowManager(this.container, this.eventBus)
    this.fs = new FileSystem()
    this.desktop = new Desktop(this.container, this.eventBus, this.settings, this.fs)
    this.taskbar = new Taskbar(this.container, this.eventBus, this.settings)
    // 注入通知服务到任务栏
    this.taskbar.setNotificationService(this.notifications)
  }

  // 初始化系统
  async init(): Promise<void> {
    if (this.initialized) return

    this.container.id = 'ht-os'

    // 显示启动画面
    this.showBootScreen()

    try {
      // 尝试连接远程文件系统后端，失败则使用本地 IndexedDB
      const remoteFs = new RemoteFileSystem()
      const remoteAvailable = await remoteFs.init()

      if (remoteAvailable) {
        // 使用远程文件系统（真实本地文件）
        ;(this.fs as any) = remoteFs
        this.desktop.setFs(remoteFs)
        console.log('%c 已连接远程文件服务 ', 'background:#22c55e;color:white;padding:2px 8px;border-radius:4px;')
      } else {
        // 使用本地 IndexedDB 虚拟文件系统
        await this.fs.init()
        console.log('%c 使用本地虚拟文件系统 ', 'background:#f59e0b;color:white;padding:2px 8px;border-radius:4px;')
      }

      // 注册应用并设置事件
      this.registerApps()
      this.setupEventListeners()
      this.applyTheme()

      // 启动画面持续约 2 秒
      await this.delay(2000)
      await this.hideBootScreen()

      // 判断后续流程
      if (!this.settings.get('oobeCompleted')) {
        // 首次使用：进入 OOBE
        this.showOOBE()
      } else {
        // 已完成 OOBE：始终先显示登录界面（无密码时显示"点击进入"）
        this.showLoginScreen()
      }

      this.initialized = true
      console.log('%c HT OS ', 'background:#0078d4;color:white;padding:4px 10px;border-radius:4px;font-weight:bold;')
    } catch (err) {
      console.error('[HT OS] 初始化失败:', err)
      if (this.bootScreen) {
        const text = this.bootScreen.querySelector('.boot-status') as HTMLElement | null
        if (text) {
          text.textContent = '初始化出错: ' + (err instanceof Error ? err.message : String(err))
          text.style.color = '#ff6666'
        }
      }
      await this.delay(2000)
      await this.hideBootScreen()
      this.enterDesktop()
    }
  }

  // 注册所有应用
  private registerApps(): void {
    registerSettingsApp(this.wm, this.fs, this.settings, this.eventBus)
    registerFileManagerApp(this.wm, this.fs, this.eventBus)
    registerTerminalApp(this.wm, this.fs, this.eventBus)
    registerNotepadApp(this.wm, this.fs, this.eventBus)
    registerMarkdownApp(this.wm, this.fs, this.eventBus)
    registerOfficeApp(this.wm, this.fs, this.eventBus)
    registerPhotoViewerApp(this.wm, this.fs, this.eventBus)
    registerCalculatorApp(this.wm)
    registerBrowserApp(this.wm)
    registerPainterApp(this.wm)
    registerMusicPlayerApp(this.wm, this.fs, this.eventBus)
    registerVideoPlayerApp(this.wm, this.fs, this.eventBus)
    registerWeatherApp(this.wm)
    registerAiAssistantApp(this.wm, this.eventBus, this.settings)
    registerSystemMonitorApp(this.wm, this.settings, this.serviceManager, this.startupManager, this.eventBus)
    // 现代系统工具
    registerRegistryEditorApp(this.wm, this.registry, this.eventBus)
    registerServicesApp(this.wm, this.serviceManager, this.eventBus)
    registerStartupManagerApp(this.wm, this.startupManager)
    registerEventViewerApp(this.wm, this.eventLog)
    registerEnvEditorApp(this.wm, this.environment, this.eventBus)
    // EPP 编译器和运行器
    registerEPPCompilerApp(this.wm, this.fs, this.eventBus)
    registerEPPRunnerApp(this.wm, this.fs)
    // 注册 EPP 命令行工具到终端命令注册中心
    registerEPPCommands(this.fs, this.eventBus)
  }

  // 最后点击位置（用于打开动画的展开起点）
  private _lastClickPos: { x: number; y: number } = { x: window.innerWidth / 2, y: window.innerHeight / 2 }

  // 设置全局事件监听
  private setupEventListeners(): void {
    // 绑定 UAC 到事件总线，让各应用可通过 eventBus 请求 UAC 权限
    bindUacToEventBus(this.eventBus, this.uac)

    // 跟踪鼠标点击位置，用于打开动画
    document.addEventListener('mousedown', (e: MouseEvent) => {
      this._lastClickPos = { x: e.clientX, y: e.clientY }
    })

    this.eventBus.on('app:launch', async (appId: string, ...args: any[]) => {
      // 系统内部命令不弹 UAC（编译器打开文件等）
      if (appId === 'epp-compiler-open') {
        openESourceFile(this.wm, this.fs, args[0])
      } else if (appId === 'epp-compiler-project') {
        openEProjectFile(this.wm, this.fs, args[0])
      } else if (appId === 'epp-compiler-solution') {
        openESolutionFile(this.wm, this.fs, args[0])
      } else if (appId === 'epp-runner-file') {
        // EPP 程序运行 → UAC 确认
        const allowed = await requestUac(this.eventBus, {
          operation: '运行 EPP 程序',
          resource: args[0] || '未知',
          source: '系统'
        })
        if (!allowed) return
        runEPPFromFile(this.wm, this.fs, args[0])
      } else {
        // 用户触发的应用启动 → UAC 确认
        const app = this.wm.getApp(appId)
        if (app) {
          const allowed = await requestUac(this.eventBus, {
            operation: '启动应用',
            resource: app.name,
            source: '系统'
          })
          if (!allowed) return
        }
        // 将点击位置作为打开动画的起点
        this.wm.openApp(appId, ...args, { _origin: this._lastClickPos })
      }
    })

    this.eventBus.on('taskbar:toggle', (windowId: string) => {
      const win = this.wm.getWindow(windowId)
      if (!win) return
      if (win.minimized) {
        win.restore()
      } else {
        const active = this.wm.getActiveWindow()
        if (active && active.id === windowId) {
          win.minimize()
        } else {
          win.focus()
        }
      }
    })

    this.eventBus.on('system:shutdown', (action: string) => {
      this.handlePowerAction(action)
    })

    // 桌面刷新
    this.eventBus.on('desktop:refresh', () => {})
  }

  // 处理关机 / 重启 / 睡眠
  private handlePowerAction(action: string): void {
    this.wm.closeAll()
    if (action === 'sleep') {
      this.showLoginScreen()
    } else if (action === 'restart') {
      this.showBootScreen()
      setTimeout(() => {
        this.hideBootScreen()
        this.showLoginScreen()
      }, 1500)
    } else {
      // 关机：关闭浏览器窗口
      this.showBootScreen()
      const statusEl = this.bootScreen?.querySelector('.boot-status') as HTMLElement | null
      if (statusEl) statusEl.textContent = '正在关机...'
      setTimeout(() => {
        window.close()
        if (this.bootScreen && document.body.contains(this.bootScreen)) {
          const el = this.bootScreen.querySelector('.boot-status') as HTMLElement | null
          if (el) el.textContent = '已关机，请手动关闭页面'
        }
      }, 1200)
    }
  }

  // 应用主题色与亮度
  private applyTheme(): void {
    const themeColor = this.settings.get('themeColor')
    document.documentElement.style.setProperty('--theme-color', themeColor)
    document.documentElement.style.setProperty('--theme-color-dark', this.darken(themeColor))
    const brightness = this.settings.get('brightness')
    document.documentElement.style.setProperty('--brightness', brightness + '%')
  }

  // 显示启动画面（使用原始 SVG 背景）
  private showBootScreen(): void {
    const boot = document.createElement('div')
    boot.className = 'ht-boot-screen'
    boot.innerHTML = `
      <div class="boot-center">
        <div class="boot-logo-wrapper">
          <img src="/assets/logo.svg" alt="HT OS" class="boot-logo-img" />
        </div>
        <div class="boot-status">正在启动...</div>
      </div>
    `
    this.container.appendChild(boot)
    requestAnimationFrame(() => {
      boot.classList.add('visible')
    })
    this.bootScreen = boot
  }

  // 隐藏启动画面
  private async hideBootScreen(): Promise<void> {
    if (!this.bootScreen) return
    this.bootScreen.classList.add('fading')
    await this.delay(500)
    this.bootScreen.remove()
    this.bootScreen = null
  }

  // ============================================================
  // OOBE（首次使用体验）
  // 流程：欢迎 → 协议 → 注册账号 → 注册密码 → 完成
  // ============================================================
  private showOOBE(): void {
    const oobe = document.createElement('div')
    oobe.className = 'oobe-screen'
    oobe.innerHTML = `
      <div class="oobe-container">
        <div class="oobe-content" id="oobe-content"></div>
      </div>
    `
    this.container.appendChild(oobe)
    this.oobeScreen = oobe
    this.oobeStep('welcome')
  }

  private oobeStep(step: string): void {
    const content = this.oobeScreen?.querySelector('#oobe-content') as HTMLElement
    if (!content) return

    switch (step) {
      case 'welcome':
        content.innerHTML = `
          <div class="oobe-welcome">
            <div class="oobe-logo">
              <svg width="80" height="80" viewBox="0 0 72 72">
                <rect x="8" y="12" width="56" height="38" rx="4" fill="none" stroke="#0078d4" stroke-width="2.5"/>
                <line x1="24" y1="58" x2="48" y2="58" stroke="#0078d4" stroke-width="2.5" stroke-linecap="round"/>
                <line x1="36" y1="50" x2="36" y2="58" stroke="#0078d4" stroke-width="2.5"/>
              </svg>
            </div>
            <h1 class="oobe-title">欢迎使用 HT OS</h1>
            <p class="oobe-desc">这是一个基于网页的操作系统模拟器。<br>让我们花几分钟时间完成初始设置。</p>
            <button class="oobe-btn oobe-btn-primary" id="oobe-next">开始设置</button>
          </div>
        `
        content.querySelector('#oobe-next')!.addEventListener('click', () => this.oobeStep('agreement'))
        break

      case 'agreement':
        content.innerHTML = `
          <div class="oobe-agreement">
            <h2 class="oobe-step-title">用户协议</h2>
            <div class="oobe-agreement-text">
              <p>欢迎使用 HT OS。在使用本系统之前，请阅读以下条款：</p>
              <p>1. 本系统是一个教学/演示性质的网页操作系统模拟器，不存储任何真实个人数据。</p>
              <p>2. 所有文件和设置仅保存在浏览器的本地存储（IndexedDB / localStorage）中，清除浏览器数据将导致丢失。</p>
              <p>3. 系统中的"浏览器"应用使用 iframe 嵌入网页，部分网站可能无法正常显示。</p>
              <p>4. 请勿在本系统中输入真实的敏感信息（如银行密码等）。</p>
              <p>5. 本系统开源免费，按原样提供，不附带任何担保。</p>
            </div>
            <div class="oobe-btn-group">
              <button class="oobe-btn" id="oobe-disagree">不同意</button>
              <button class="oobe-btn oobe-btn-primary" id="oobe-agree">同意并继续</button>
            </div>
          </div>
        `
        content.querySelector('#oobe-disagree')!.addEventListener('click', () => {
          // 不同意则重启
          this.oobeScreen?.remove()
          this.oobeScreen = null
          this.showBootScreen()
          setTimeout(() => location.reload(), 1000)
        })
        content.querySelector('#oobe-agree')!.addEventListener('click', () => this.oobeStep('account'))
        break

      case 'account':
        content.innerHTML = `
          <div class="oobe-account">
            <h2 class="oobe-step-title">创建账户</h2>
            <p class="oobe-desc">请输入您的用户名，这将是系统显示的名称。</p>
            <input type="text" class="oobe-input" id="oobe-username" placeholder="输入用户名" maxlength="20" autocomplete="off">
            <div class="oobe-hint" id="oobe-hint"></div>
            <button class="oobe-btn oobe-btn-primary" id="oobe-next">下一步</button>
          </div>
        `
        const usernameInput = content.querySelector('#oobe-username') as HTMLInputElement
        const hint = content.querySelector('#oobe-hint') as HTMLElement
        const nextBtn = content.querySelector('#oobe-next') as HTMLButtonElement
        const goNext = () => {
          const name = usernameInput.value.trim()
          if (!name) {
            hint.textContent = '请输入用户名'
            hint.style.color = '#e81123'
            return
          }
          this.settings.set('userName', name)
          this.oobeStep('password')
        }
        nextBtn.addEventListener('click', goNext)
        usernameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') goNext() })
        setTimeout(() => usernameInput.focus(), 100)
        break

      case 'password':
        content.innerHTML = `
          <div class="oobe-password">
            <h2 class="oobe-step-title">设置密码</h2>
            <p class="oobe-desc">为您的账户设置一个密码（可以留空跳过）。</p>
            <input type="password" class="oobe-input" id="oobe-password" placeholder="输入密码（可选）" autocomplete="off">
            <input type="password" class="oobe-input" id="oobe-password2" placeholder="确认密码" autocomplete="off">
            <div class="oobe-hint" id="oobe-hint"></div>
            <div class="oobe-btn-group">
              <button class="oobe-btn" id="oobe-skip">跳过</button>
              <button class="oobe-btn oobe-btn-primary" id="oobe-next">完成设置</button>
            </div>
          </div>
        `
        const pwd1 = content.querySelector('#oobe-password') as HTMLInputElement
        const pwd2 = content.querySelector('#oobe-password2') as HTMLInputElement
        const pwdHint = content.querySelector('#oobe-hint') as HTMLElement
        const completeBtn = content.querySelector('#oobe-next') as HTMLButtonElement
        const skipBtn = content.querySelector('#oobe-skip') as HTMLButtonElement

        const complete = () => {
          const p1 = pwd1.value
          const p2 = pwd2.value
          if (p1 !== p2) {
            pwdHint.textContent = '两次输入的密码不一致'
            pwdHint.style.color = '#e81123'
            return
          }
          if (p1) this.settings.set('password', p1)
          this.oobeStep('complete')
        }
        completeBtn.addEventListener('click', complete)
        skipBtn.addEventListener('click', () => this.oobeStep('complete'))
        pwd2.addEventListener('keydown', (e) => { if (e.key === 'Enter') complete() })
        setTimeout(() => pwd1.focus(), 100)
        break

      case 'complete':
        // 标记 OOBE 完成
        this.settings.set('oobeCompleted', true)
        content.innerHTML = `
          <div class="oobe-complete">
            <div class="oobe-check">
              <svg width="64" height="64" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="30" fill="none" stroke="#16a34a" stroke-width="3"/>
                <polyline points="20,32 28,40 44,24" fill="none" stroke="#16a34a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <h1 class="oobe-title">设置完成！</h1>
            <p class="oobe-desc">一切就绪，欢迎开始使用 HT OS。</p>
            <button class="oobe-btn oobe-btn-primary" id="oobe-finish">进入系统</button>
          </div>
        `
        content.querySelector('#oobe-finish')!.addEventListener('click', () => {
          // 移除 OOBE 界面
          if (this.oobeScreen) {
            this.oobeScreen.classList.add('fade-out')
            setTimeout(() => {
              this.oobeScreen?.remove()
              this.oobeScreen = null
            }, 450)
          }
          // 始终进入登录界面（无密码时显示"点击进入"）
          this.showLoginScreen()
        })
        break
    }
  }

  // 显示登录界面（使用原始 SVG 背景）
  private showLoginScreen(): void {
    const userName = this.settings.get('userName')
    const password = this.settings.get('password')
    const hasPassword = !!password

    const login = document.createElement('div')
    login.className = 'login-screen'
    const base = import.meta.env.BASE_URL || './'
    login.style.backgroundImage = `url("${base}assets/wallpapers/login.svg")`
    login.style.backgroundSize = '108% 108%'
    login.style.backgroundPosition = 'center'
    login.style.backgroundColor = '#dbf6df'

    const inputHtml = hasPassword
      ? `<input type="password" class="login-input" placeholder="密码" autocomplete="off">
         <button class="login-btn" type="button">进入系统</button>`
      : `<button class="login-btn login-btn-enter" type="button">点击进入</button>`

    login.innerHTML = `
      <div class="login-box">
        <div class="login-avatar">${this.getInitial(userName)}</div>
        <div class="login-username">${userName}</div>
        ${inputHtml}
        <div class="login-hint"></div>
      </div>
    `
    this.container.appendChild(login)
    this.loginScreen = login

    const hint = login.querySelector('.login-hint') as HTMLElement

    if (hasPassword) {
      const input = login.querySelector('.login-input') as HTMLInputElement
      const btn = login.querySelector('.login-btn') as HTMLButtonElement

      const tryLogin = () => {
        const value = input.value
        if (value === password) {
          this.enterDesktop()
        } else {
          hint.textContent = '密码错误，请重试'
          input.value = ''
          input.focus()
        }
      }

      btn.addEventListener('click', tryLogin)
      input.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') tryLogin()
      })
      setTimeout(() => input.focus(), 100)
    } else {
      const btn = login.querySelector('.login-btn') as HTMLButtonElement
      btn.addEventListener('click', () => this.enterDesktop())
    }
  }

  // 进入桌面
  private enterDesktop(): void {
    if (this.loginScreen) {
      const screen = this.loginScreen
      this.loginScreen = null
      screen.classList.add('fade-out')
      setTimeout(() => screen.remove(), 450)
    }
    this.desktop.getElement().classList.add('visible')
    this.taskbar.getElement().classList.add('visible')
    this.desktop.updateWallpaper()
    this.desktop.refreshIcons()

    // 启动系统服务和开机自启项
    this.serviceManager.startAutoServices()
    this.startupManager.runStartup((appId, ...args) => {
      this.eventBus.emit('app:launch', appId, ...args)
    })
    // 推送欢迎通知
    this.notifications.notify('系统', '欢迎使用 HT OS', '系统已成功启动，所有服务运行正常', 'success')
  }

  // 颜色变暗
  private darken(hex: string): string {
    try {
      const c = hex.replace('#', '')
      const r = Math.floor(parseInt(c.slice(0, 2), 16) * 0.8)
      const g = Math.floor(parseInt(c.slice(2, 4), 16) * 0.8)
      const b = Math.floor(parseInt(c.slice(4, 6), 16) * 0.8)
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
    } catch {
      return hex
    }
  }

  private getInitial(name: string): string {
    return (name || 'U').charAt(0).toUpperCase()
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // 对外访问器
  getEventBus(): EventBus { return this.eventBus }
  getSettings(): SettingsManager { return this.settings }
  getWindowManager(): WindowManager { return this.wm }
  getFileSystem(): FileSystem { return this.fs }

  openApp(appId: string, ...args: any[]): string | null {
    return this.wm.openApp(appId, ...args)
  }
}

declare global {
  interface Window {
    HTOS: typeof HTOS
  }
}

window.HTOS = HTOS

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('ht-os-container')
  if (container) {
    const os = new HTOS(container)
    os.init().catch(err => console.error('[HT OS] 启动失败:', err))
  }
})
