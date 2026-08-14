/** 右键菜单项 */
export interface ContextMenuItem {
  /** 显示文字 */
  label?: string
  /** SVG 图标 HTML 字符串 */
  icon?: string
  /** 点击时执行的回调 */
  action?: () => void
  /** 是否为分隔线 */
  separator?: boolean
  /** 是否禁用 */
  disabled?: boolean
}

/**
 * 通用右键菜单组件
 * 在指定位置显示 Windows 风格的菜单，支持菜单项、分隔线、禁用项
 */
export class ContextMenu {
  private menuEl: HTMLElement
  private outsideClickHandler: ((e: MouseEvent) => void) | null = null
  private escapeHandler: ((e: KeyboardEvent) => void) | null = null

  constructor() {
    this.menuEl = document.createElement('div')
    this.menuEl.className = 'ht-context-menu'
    this.menuEl.style.display = 'none'
    document.body.appendChild(this.menuEl)
  }

  /** 在指定坐标显示菜单 */
  show(x: number, y: number, items: ContextMenuItem[]): void {
    // 先关闭已有菜单
    this.hide()

    // 重建菜单内容
    this.menuEl.innerHTML = ''
    let itemIndex = 0
    for (const item of items) {
      if (item.separator) {
        const sep = document.createElement('div')
        sep.className = 'ht-context-separator'
        sep.style.setProperty('--item-index', String(itemIndex))
        this.menuEl.appendChild(sep)
        itemIndex++
        continue
      }

      const menuItem = document.createElement('div')
      menuItem.className = 'ht-context-item'
      menuItem.style.setProperty('--item-index', String(itemIndex))
      if (item.disabled) {
        menuItem.classList.add('disabled')
      }

      if (item.icon) {
        const iconWrap = document.createElement('span')
        iconWrap.className = 'ht-context-icon'
        iconWrap.innerHTML = item.icon
        menuItem.appendChild(iconWrap)
      } else {
        // 占位，保证无图标的项与有图标的项文字对齐
        const iconWrap = document.createElement('span')
        iconWrap.className = 'ht-context-icon'
        menuItem.appendChild(iconWrap)
      }

      const label = document.createElement('span')
      label.className = 'ht-context-label'
      label.textContent = item.label || ''
      menuItem.appendChild(label)

      if (!item.disabled && item.action) {
        menuItem.addEventListener('click', () => {
          item.action!()
          this.hide()
        })
      }

      this.menuEl.appendChild(menuItem)
      itemIndex++
    }

    // 先计算尺寸再定位，避免超出屏幕
    this.menuEl.style.display = 'block'
    this.menuEl.style.visibility = 'hidden'
    this.menuEl.style.left = '0px'
    this.menuEl.style.top = '0px'
    this.menuEl.classList.remove('ht-context-animate')

    const rect = this.menuEl.getBoundingClientRect()
    const winW = window.innerWidth
    const winH = window.innerHeight
    let left = x
    let top = y
    if (x + rect.width > winW) left = Math.max(0, winW - rect.width - 4)
    if (y + rect.height > winH) top = Math.max(0, winH - rect.height - 4)

    this.menuEl.style.left = left + 'px'
    this.menuEl.style.top = top + 'px'
    this.menuEl.style.visibility = 'visible'

    // 设置 transform-origin 为菜单弹出方向的对角
    const originX = x + rect.width > winW ? 'right' : 'left'
    const originY = y + rect.height > winH ? 'bottom' : 'top'
    this.menuEl.style.transformOrigin = `${originX} ${originY}`

    // 触发动画
    requestAnimationFrame(() => {
      this.menuEl.classList.add('ht-context-animate')
    })

    // 点击外部或按 Esc 关闭
    this.outsideClickHandler = (e: MouseEvent) => {
      if (!this.menuEl.contains(e.target as Node)) {
        this.hide()
      }
    }
    this.escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.hide()
      }
    }
    // 延迟绑定，避免当前触发的 click 事件立刻关闭菜单
    setTimeout(() => {
      document.addEventListener('mousedown', this.outsideClickHandler!)
      document.addEventListener('keydown', this.escapeHandler!)
    }, 0)
  }

  /** 隐藏菜单 */
  hide(): void {
    this.menuEl.style.display = 'none'
    if (this.outsideClickHandler) {
      document.removeEventListener('mousedown', this.outsideClickHandler)
      this.outsideClickHandler = null
    }
    if (this.escapeHandler) {
      document.removeEventListener('keydown', this.escapeHandler)
      this.escapeHandler = null
    }
  }

  /** 销毁菜单（移除 DOM） */
  destroy(): void {
    this.hide()
    this.menuEl.remove()
  }
}
