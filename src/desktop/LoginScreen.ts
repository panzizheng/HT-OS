import { SettingsManager } from '../kernel/SettingsManager'

/**
 * 登录界面
 * 模糊的桌面壁纸背景，居中显示用户头像、用户名，支持密码输入
 * 登录成功后调用回调并淡出
 */
export class LoginScreen {
  private element: HTMLElement
  private settings: SettingsManager
  private loginCallback: (() => void) | null = null
  private clockInterval: number | null = null
  private clockEl: HTMLElement
  private passwordInput: HTMLInputElement | null = null
  private loginButton: HTMLButtonElement | null = null
  private isShowing: boolean = false
  private static PASSWORD_KEY = 'ht-os-login-password'

  constructor(container: HTMLElement, settings: SettingsManager) {
    this.settings = settings
    this.element = document.createElement('div')
    this.element.className = 'ht-login-screen'
    this.element.style.display = 'none'

    // 背景层（模糊壁纸）
    const bg = document.createElement('div')
    bg.className = 'login-bg'
    this.element.appendChild(bg)

    // 用户信息居中区域
    const center = document.createElement('div')
    center.className = 'login-center'

    // 用户头像（CSS 圆形）
    const avatar = document.createElement('div')
    avatar.className = 'login-avatar'
    // 头像内放一个简单的人形 SVG
    avatar.innerHTML = `
      <svg viewBox="0 0 80 80" width="80" height="80">
        <circle cx="40" cy="40" r="40" fill="#4a90d9"/>
        <circle cx="40" cy="32" r="12" fill="white"/>
        <path d="M16 72 a24 24 0 0 1 48 0 z" fill="white"/>
      </svg>
    `
    center.appendChild(avatar)

    // 用户名
    const nameEl = document.createElement('div')
    nameEl.className = 'login-username'
    nameEl.textContent = this.settings.get('userName')
    center.appendChild(nameEl)

    // 密码输入区（仅在设置了密码时显示）
    const hasPassword = this.hasPassword()
    if (hasPassword) {
      const inputWrap = document.createElement('div')
      inputWrap.className = 'login-input-wrap'
      this.passwordInput = document.createElement('input')
      this.passwordInput.type = 'password'
      this.passwordInput.className = 'login-input'
      this.passwordInput.placeholder = '请输入密码'
      this.passwordInput.setAttribute('autocomplete', 'off')
      inputWrap.appendChild(this.passwordInput)

      this.loginButton = document.createElement('button')
      this.loginButton.className = 'login-button'
      this.loginButton.type = 'button'
      this.loginButton.textContent = '登录'
      this.loginButton.addEventListener('click', () => this.tryLogin())
      inputWrap.appendChild(this.loginButton)

      center.appendChild(inputWrap)

      // 回车登录
      this.passwordInput.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') this.tryLogin()
      })
    } else {
      // 没有密码，显示点击进入
      this.loginButton = document.createElement('button')
      this.loginButton.className = 'login-button login-enter'
      this.loginButton.type = 'button'
      this.loginButton.textContent = '点击进入'
      this.loginButton.addEventListener('click', () => this.doLogin())
      center.appendChild(this.loginButton)
    }

    this.element.appendChild(center)

    // 底部时钟
    this.clockEl = document.createElement('div')
    this.clockEl.className = 'login-clock'
    this.element.appendChild(this.clockEl)

    container.appendChild(this.element)
  }

  /** 是否设置了登录密码 */
  private hasPassword(): boolean {
    return !!localStorage.getItem(LoginScreen.PASSWORD_KEY)
  }

  /** 校验密码 */
  private tryLogin(): void {
    if (!this.passwordInput) return
    const saved = localStorage.getItem(LoginScreen.PASSWORD_KEY) || ''
    if (this.passwordInput.value === saved) {
      this.doLogin()
    } else {
      // 抖动提示
      const wrap = this.passwordInput.parentElement
      if (wrap) {
        wrap.classList.remove('shake')
        void wrap.offsetWidth
        wrap.classList.add('shake')
      }
      this.passwordInput.value = ''
      this.passwordInput.placeholder = '密码错误，请重新输入'
    }
  }

  /** 执行登录成功流程 */
  private doLogin(): void {
    if (this.loginCallback) this.loginCallback()
    this.hide()
  }

  /** 显示登录界面 */
  show(): void {
    this.element.style.display = 'flex'
    void this.element.offsetWidth
    this.element.classList.add('visible')
    this.isShowing = true
    this.updateWallpaper()
    this.startClock()
    // 自动聚焦密码框
    if (this.passwordInput) {
      setTimeout(() => this.passwordInput!.focus(), 100)
    }
  }

  /** 隐藏登录界面（淡出） */
  hide(): void {
    if (!this.isShowing) return
    this.isShowing = false
    this.element.classList.remove('visible')
    this.element.classList.add('fading')
    const onEnd = () => {
      this.element.style.display = 'none'
      this.element.classList.remove('fading')
      this.element.removeEventListener('transitionend', onEnd)
    }
    this.element.addEventListener('transitionend', onEnd)
    setTimeout(() => {
      this.element.style.display = 'none'
      this.element.classList.remove('fading')
    }, 700)
    if (this.clockInterval !== null) {
      clearInterval(this.clockInterval)
      this.clockInterval = null
    }
  }

  /** 注册登录成功回调 */
  onLogin(callback: () => void): void {
    this.loginCallback = callback
  }

  /** 根据当前设置更新壁纸背景 */
  private updateWallpaper(): void {
    const wallpaper = this.settings.get('wallpaper')
    const bg = this.element.querySelector('.login-bg') as HTMLElement
    if (!bg) return
    if (wallpaper === 'default' || !wallpaper) {
      bg.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      bg.style.backgroundImage = ''
    } else {
      bg.style.backgroundImage = `url("${wallpaper}")`
      bg.style.backgroundSize = 'cover'
      bg.style.backgroundPosition = 'center'
    }
  }

  /** 启动底部时钟，每秒更新 */
  private startClock(): void {
    const update = () => {
      const now = new Date()
      const time = now.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
      const date = now.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      })
      this.clockEl.innerHTML = `<div class="login-clock-time">${time}</div><div class="login-clock-date">${date}</div>`
    }
    update()
    this.clockInterval = window.setInterval(update, 1000)
  }

  getElement(): HTMLElement {
    return this.element
  }
}
