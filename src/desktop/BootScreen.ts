/**
 * 启动画面
 * 黑色全屏背景，居中显示系统 Logo，白色渐变为赤色，从大到小动画
 */
export class BootScreen {
  private element: HTMLElement
  private logoEl: HTMLElement
  private statusEl: HTMLElement
  private isShowing: boolean = false

  constructor(container: HTMLElement) {
    this.element = document.createElement('div')
    this.element.className = 'ht-boot-screen'
    this.element.style.display = 'none'

    const center = document.createElement('div')
    center.className = 'boot-center'

    this.logoEl = document.createElement('div')
    this.logoEl.className = 'boot-logo-wrapper'
    this.logoEl.innerHTML = `
      <img src="/assets/logo.svg" alt="HT OS" class="boot-logo-img" />
    `
    center.appendChild(this.logoEl)

    this.statusEl = document.createElement('div')
    this.statusEl.className = 'boot-status'
    this.statusEl.textContent = '正在启动...'
    center.appendChild(this.statusEl)

    this.element.appendChild(center)
    container.appendChild(this.element)
  }

  show(): void {
    this.element.style.display = 'flex'
    void this.element.offsetWidth
    this.element.classList.add('visible')
    this.isShowing = true
  }

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
  }

  setStatus(text: string): void {
    this.statusEl.textContent = text
  }

  getElement(): HTMLElement {
    return this.element
  }
}
