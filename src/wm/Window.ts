// ============================================================
// 窗口类 - 窗口管理核心
// 支持拖拽、8方向缩放、最小化/最大化/还原/关闭、焦点管理
// 所有事件监听器在关闭时正确清理，避免内存泄漏
// ============================================================

import { EventBus } from '../kernel/EventBus'
import type { WindowConfig } from '../kernel/types'

export class Window {
  public id: string
  public title: string
  public icon: string
  public appId: string
  public element: HTMLElement
  public content: HTMLElement
  public x: number
  public y: number
  public width: number
  public height: number
  public minWidth: number
  public minHeight: number
  public maxable: boolean
  public resizable: boolean
  public minimized: boolean = false
  public maximized: boolean = false
  public zIndex: number

  private eventBus: EventBus
  private titlebar: HTMLElement
  private titleEl: HTMLElement
  private iconEl: HTMLElement

  // 拖拽状态
  private isDragging: boolean = false
  private dragOffsetX: number = 0
  private dragOffsetY: number = 0
  private dragRafId: number | null = null
  private pendingDragX: number = 0
  private pendingDragY: number = 0

  // 缩放状态
  private isResizing: boolean = false
  private resizeDirection: string = ''
  private startX: number = 0
  private startY: number = 0
  private startWidth: number = 0
  private startHeight: number = 0
  private startLeft: number = 0
  private startTop: number = 0
  private resizeRafId: number | null = null
  private pendingResize: { dx: number; dy: number } | null = null

  // 最大化前保存的位置/尺寸
  private prevX: number = 0
  private prevY: number = 0
  private prevWidth: number = 0
  private prevHeight: number = 0

  // 清理函数列表，关闭时统一调用
  private cleanupCallbacks: Array<() => void> = []
  private closed: boolean = false

  /**
   * 注册窗口关闭时的清理回调。
   * 应用可在 entry 中调用此方法，确保窗口关闭时释放音频、视频、定时器等资源。
   */
  onClose(callback: () => void): void {
    this.cleanupCallbacks.push(callback)
  }

  // 预绑定的 document 事件处理器（用于动态添加/移除）
  private boundDragMove: (e: MouseEvent) => void
  private boundDragEnd: (e: MouseEvent) => void
  private boundResizeMove: (e: MouseEvent) => void
  private boundResizeEnd: (e: MouseEvent) => void

  constructor(config: WindowConfig, eventBus: EventBus, zIndex: number) {
    this.id = config.id
    this.title = config.title
    this.icon = config.icon
    this.appId = config.appId
    this.x = config.x
    this.y = config.y
    this.width = config.width
    this.height = config.height
    this.minWidth = config.minWidth ?? 200
    this.minHeight = config.minHeight ?? 120
    this.maxable = config.maxable ?? true
    this.resizable = config.resizable ?? true
    this.zIndex = zIndex
    this.eventBus = eventBus

    // 预绑定 document 级处理器，便于精准移除
    this.boundDragMove = this.onDragMove.bind(this)
    this.boundDragEnd = this.onDragEnd.bind(this)
    this.boundResizeMove = this.onResizeMove.bind(this)
    this.boundResizeEnd = this.onResizeEnd.bind(this)

    this.element = this.createElement(config)
    this.titlebar = this.element.querySelector('.window-titlebar') as HTMLElement
    this.titleEl = this.element.querySelector('.window-title') as HTMLElement
    this.iconEl = this.element.querySelector('.window-icon') as HTMLElement
    this.content = this.element.querySelector('.window-content') as HTMLElement

    this.setTitle(this.title)
    this.renderIcon(this.icon)
    this.setupInteractions()
    this.updatePosition()
    this.updateSize()
  }

  // 创建窗口 DOM 结构
  private createElement(config: WindowConfig): HTMLElement {
    const win = document.createElement('div')
    win.className = 'ht-window'
    win.dataset.windowId = this.id
    win.style.zIndex = String(this.zIndex)

    const resizeHandles = this.resizable ? `
      <div class="window-resize-handle resize-n" data-dir="n"></div>
      <div class="window-resize-handle resize-s" data-dir="s"></div>
      <div class="window-resize-handle resize-e" data-dir="e"></div>
      <div class="window-resize-handle resize-w" data-dir="w"></div>
      <div class="window-resize-handle resize-ne" data-dir="ne"></div>
      <div class="window-resize-handle resize-nw" data-dir="nw"></div>
      <div class="window-resize-handle resize-se" data-dir="se"></div>
      <div class="window-resize-handle resize-sw" data-dir="sw"></div>
    ` : ''

    win.innerHTML = `
      <div class="window-titlebar">
        <div class="window-icon"></div>
        <div class="window-title"></div>
        <div class="window-controls">
          <button class="window-btn window-minimize" title="最小化" type="button">
            <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="4.5" width="8" height="1" fill="currentColor"/></svg>
          </button>
          <button class="window-btn window-maximize" title="最大化" type="button">
            <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1"/></svg>
          </button>
          <button class="window-btn window-close" title="关闭" type="button">
            <svg width="10" height="10" viewBox="0 0 10 10"><line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" stroke-width="1.2"/><line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" stroke-width="1.2"/></svg>
          </button>
        </div>
      </div>
      <div class="window-content"></div>
      ${resizeHandles}
    `

    return win
  }

  // 渲染图标：URL 用背景图，SVG/emoji 用 innerHTML
  private renderIcon(icon: string): void {
    const isUrl = /^(https?:|data:|\/|\.\.?\/)/.test(icon)
    if (isUrl) {
      this.iconEl.style.backgroundImage = `url('${icon}')`
      this.iconEl.innerHTML = ''
    } else {
      this.iconEl.style.backgroundImage = ''
      this.iconEl.innerHTML = icon
    }
  }

  // 设置所有交互：拖拽、缩放、按钮、焦点
  private setupInteractions(): void {
    this.setupDrag()
    this.setupResize()

    const closeBtn = this.element.querySelector('.window-close') as HTMLElement
    const minBtn = this.element.querySelector('.window-minimize') as HTMLElement
    const maxBtn = this.element.querySelector('.window-maximize') as HTMLElement

    const onClose = () => this.close()
    const onMin = () => this.minimize()
    const onMax = () => { if (this.maxable) this.toggleMaximize() }

    closeBtn.addEventListener('click', onClose)
    minBtn.addEventListener('click', onMin)
    maxBtn.addEventListener('click', onMax)
    this.cleanupCallbacks.push(
      () => closeBtn.removeEventListener('click', onClose),
      () => minBtn.removeEventListener('click', onMin),
      () => maxBtn.removeEventListener('click', onMax)
    )

    // 点击窗口任意位置提升焦点
    const onFocus = () => { if (!this.closed) this.focus() }
    this.element.addEventListener('mousedown', onFocus)
    this.cleanupCallbacks.push(() => this.element.removeEventListener('mousedown', onFocus))
  }

  // 标题栏拖拽 + 双击最大化
  private setupDrag(): void {
    const onMouseDown = (e: MouseEvent) => {
      if (this.closed) return
      if (e.button !== 0) return
      // 点击控制按钮区域不拖拽
      if ((e.target as HTMLElement).closest('.window-controls')) return
      if (this.maximized) return

      this.isDragging = true
      // 计算鼠标相对窗口左上角的偏移
      this.dragOffsetX = e.clientX - this.x
      this.dragOffsetY = e.clientY - this.y
      this.focus()
      this.element.classList.add('dragging')

      document.addEventListener('mousemove', this.boundDragMove)
      document.addEventListener('mouseup', this.boundDragEnd)
      document.addEventListener('mouseleave', this.boundDragEnd)
      e.preventDefault()
    }
    this.titlebar.addEventListener('mousedown', onMouseDown)
    this.cleanupCallbacks.push(() => this.titlebar.removeEventListener('mousedown', onMouseDown))

    // 双击标题栏切换最大化
    const onDblClick = () => {
      if (this.closed || !this.maxable) return
      this.toggleMaximize()
    }
    this.titlebar.addEventListener('dblclick', onDblClick)
    this.cleanupCallbacks.push(() => this.titlebar.removeEventListener('dblclick', onDblClick))
  }

  // 拖拽移动
  private onDragMove(e: MouseEvent): void {
    if (!this.isDragging) return
    this.pendingDragX = e.clientX - this.dragOffsetX
    this.pendingDragY = Math.max(0, e.clientY - this.dragOffsetY)

    if (this.dragRafId === null) {
      this.dragRafId = requestAnimationFrame(() => {
        this.x = this.pendingDragX
        this.y = this.pendingDragY
        this.updatePosition()
        this.dragRafId = null
      })
    }
  }

  // 拖拽结束，移除 document 监听器
  private onDragEnd(): void {
    if (!this.isDragging) return
    this.isDragging = false
    if (this.dragRafId !== null) {
      cancelAnimationFrame(this.dragRafId)
      this.dragRafId = null
      this.x = this.pendingDragX
      this.y = this.pendingDragY
      this.updatePosition()
    }
    this.element.classList.remove('dragging')
    document.removeEventListener('mousemove', this.boundDragMove)
    document.removeEventListener('mouseup', this.boundDragEnd)
    document.removeEventListener('mouseleave', this.boundDragEnd)
  }

  // 8 方向缩放
  private setupResize(): void {
    if (!this.resizable) return
    const handles = this.element.querySelectorAll('.window-resize-handle') as NodeListOf<HTMLElement>
    handles.forEach(handle => {
      const dir = handle.dataset.dir || ''
      const onMouseDown = (e: MouseEvent) => {
        if (this.closed || this.maximized) return
        if (e.button !== 0) return
        this.isResizing = true
        this.resizeDirection = dir
        this.startX = e.clientX
        this.startY = e.clientY
        this.startWidth = this.width
        this.startHeight = this.height
        this.startLeft = this.x
        this.startTop = this.y
        this.focus()
        this.element.classList.add('resizing')

        document.addEventListener('mousemove', this.boundResizeMove)
        document.addEventListener('mouseup', this.boundResizeEnd)
        document.addEventListener('mouseleave', this.boundResizeEnd)
        e.preventDefault()
        e.stopPropagation()
      }
      handle.addEventListener('mousedown', onMouseDown)
      this.cleanupCallbacks.push(() => handle.removeEventListener('mousedown', onMouseDown))
    })
  }

  // 缩放移动
  private onResizeMove(e: MouseEvent): void {
    if (!this.isResizing) return
    this.pendingResize = {
      dx: e.clientX - this.startX,
      dy: e.clientY - this.startY
    }

    if (this.resizeRafId === null) {
      this.resizeRafId = requestAnimationFrame(() => {
        this.applyResize()
        this.resizeRafId = null
      })
    }
  }

  private applyResize(): void {
    if (!this.pendingResize || !this.isResizing) return
    const { dx, dy } = this.pendingResize
    const dir = this.resizeDirection

    // 东：改宽度
    if (dir.includes('e')) {
      this.width = Math.max(this.minWidth, this.startWidth + dx)
    }
    // 南：改高度
    if (dir.includes('s')) {
      this.height = Math.max(this.minHeight, this.startHeight + dy)
    }
    // 西：改宽度并左移
    if (dir.includes('w')) {
      const newWidth = Math.max(this.minWidth, this.startWidth - dx)
      this.x = this.startLeft + (this.startWidth - newWidth)
      this.width = newWidth
    }
    // 北：改高度并上移
    if (dir.includes('n')) {
      const newHeight = Math.max(this.minHeight, this.startHeight - dy)
      this.y = this.startTop + (this.startHeight - newHeight)
      this.height = newHeight
    }

    this.updatePosition()
    this.updateSize()
  }

  // 缩放结束
  private onResizeEnd(): void {
    if (!this.isResizing) return
    this.isResizing = false
    if (this.resizeRafId !== null) {
      cancelAnimationFrame(this.resizeRafId)
      this.resizeRafId = null
      this.applyResize()
    }
    this.pendingResize = null
    this.element.classList.remove('resizing')
    document.removeEventListener('mousemove', this.boundResizeMove)
    document.removeEventListener('mouseup', this.boundResizeEnd)
    document.removeEventListener('mouseleave', this.boundResizeEnd)
    this.eventBus.emit('window:resized', this.id)
  }

  updatePosition(): void {
    // 使用 left/top 定位，避免 transform 导致的子像素渲染模糊
    this.element.style.left = this.x + 'px'
    this.element.style.top = this.y + 'px'
  }

  updateSize(): void {
    this.element.style.width = this.width + 'px'
    this.element.style.height = this.height + 'px'
  }

  // 请求焦点（由 WindowManager 处理 z-index 提升）
  focus(): void {
    if (this.closed) return
    this.eventBus.emit('window:focus', this.id)
  }

  setZIndex(z: number): void {
    this.zIndex = z
    this.element.style.zIndex = String(z)
  }

  // 保存最小化动画的目标位置，用于还原时反向播放
  private _minimizeTarget: { x: number; y: number } | null = null

  /**
   * 获取任务栏上该窗口按钮的屏幕位置（用于最小化/还原动画）
   */
  private _getTaskbarTarget(): { x: number; y: number } | null {
    const btn = document.querySelector(`.task-item[data-window-id="${this.id}"]`) as HTMLElement | null
    if (!btn) return null
    const rect = btn.getBoundingClientRect()
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    }
  }

  /**
   * 窗口打开动画：从 origin 点展开到最终位置
   * 在元素已添加到 DOM 后调用
   */
  playOpenAnimation(origin?: { x: number; y: number }): void {
    // 如果没有 origin，使用默认淡入动画（CSS 已定义 window-open keyframe）
    if (!origin) return

    const endX = this.x
    const endY = this.y
    const endW = this.width
    const endH = this.height

    // 初始状态：从 origin 点开始，极小尺寸
    this.element.style.left = origin.x + 'px'
    this.element.style.top = origin.y + 'px'
    this.element.style.width = '0px'
    this.element.style.height = '0px'
    this.element.style.opacity = '0'

    // 强制布局
    this.element.getBoundingClientRect()

    // 动画到最终位置
    const anim = this.element.animate([
      {
        left: origin.x + 'px',
        top: origin.y + 'px',
        width: '0px',
        height: '0px',
        opacity: 0,
        borderRadius: '12px'
      },
      {
        left: endX + 'px',
        top: endY + 'px',
        width: endW + 'px',
        height: endH + 'px',
        opacity: 1,
        borderRadius: 'var(--radius)'
      }
    ], { duration: 280, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' })

    anim.onfinish = () => {
      anim.cancel()
      this.element.style.opacity = '1'
      this.element.style.left = endX + 'px'
      this.element.style.top = endY + 'px'
      this.element.style.width = endW + 'px'
      this.element.style.height = endH + 'px'
      this.element.style.borderRadius = ''
    }
  }

  // 最小化：向任务栏按钮收缩
  minimize(): void {
    if (this.closed || this.minimized) return
    this.minimized = true
    this.element.style.pointerEvents = 'none'

    // 获取任务栏按钮位置作为收缩目标
    const target = this._getTaskbarTarget()
    if (!target) {
      // 找不到任务栏按钮，回退到简单淡出
      const anim = this.element.animate(
        [
          { opacity: 1, transform: 'scale(1)' },
          { opacity: 0, transform: 'scale(0.85)' }
        ],
        { duration: 220, easing: 'cubic-bezier(0.4, 0, 0.6, 1)', fill: 'forwards' }
      )
      setTimeout(() => {
        if (this.minimized && !this.closed) {
          anim.cancel()
          this.element.style.display = 'none'
          this.element.style.opacity = '0'
        }
      }, 225)
      this.eventBus.emit('window:minimized', this.id)
      return
    }

    // 保存目标位置供还原使用
    this._minimizeTarget = target

    // 获取窗口当前中心位置
    const rect = this.element.getBoundingClientRect()
    const curCenterX = rect.left + rect.width / 2
    const curCenterY = rect.top + rect.height / 2
    const dx = target.x - curCenterX
    const dy = target.y - curCenterY

    // 动画：向任务栏按钮收缩
    const anim = this.element.animate([
      {
        left: this.x + 'px',
        top: this.y + 'px',
        width: this.width + 'px',
        height: this.height + 'px',
        opacity: 1,
        borderRadius: 'var(--radius)'
      },
      {
        left: (this.x + dx) + 'px',
        top: (this.y + dy) + 'px',
        width: '4px',
        height: '4px',
        opacity: 0,
        borderRadius: '50%'
      }
    ], { duration: 280, easing: 'cubic-bezier(0.4, 0, 0.6, 1)', fill: 'forwards' })

    anim.onfinish = () => {
      if (this.minimized && !this.closed) {
        anim.cancel()
        this.element.style.display = 'none'
        this.element.style.opacity = '0'
        // 恢复位置/尺寸，以便还原时从正确位置开始
        this.element.style.left = this.x + 'px'
        this.element.style.top = this.y + 'px'
        this.element.style.width = this.width + 'px'
        this.element.style.height = this.height + 'px'
        this.element.style.borderRadius = ''
      }
    }

    this.eventBus.emit('window:minimized', this.id)
  }

  // 还原（从最小化恢复）：从任务栏按钮位置展开
  restore(): void {
    if (this.closed) return
    this.minimized = false
    this.element.style.display = ''
    this.element.style.pointerEvents = ''

    const target = this._minimizeTarget || this._getTaskbarTarget()
    if (!target) {
      // 无目标位置，简单淡入
      this.element.style.opacity = '1'
      this.focus()
      this.eventBus.emit('window:restored', this.id)
      return
    }

    // 获取窗口中心到目标位置的偏移
    const rect = this.element.getBoundingClientRect()
    const curCenterX = rect.left + rect.width / 2
    const curCenterY = rect.top + rect.height / 2
    const dx = target.x - curCenterX
    const dy = target.y - curCenterY

    // 先设到最小化结束时的位置（极小）
    this.element.style.left = (this.x + dx) + 'px'
    this.element.style.top = (this.y + dy) + 'px'
    this.element.style.width = '4px'
    this.element.style.height = '4px'
    this.element.style.opacity = '0'
    this.element.style.borderRadius = '50%'
    this.element.style.display = ''

    // 强制布局
    this.element.getBoundingClientRect()

    // 动画展开到原始位置
    const anim = this.element.animate([
      {
        left: (this.x + dx) + 'px',
        top: (this.y + dy) + 'px',
        width: '4px',
        height: '4px',
        opacity: 0,
        borderRadius: '50%'
      },
      {
        left: this.x + 'px',
        top: this.y + 'px',
        width: this.width + 'px',
        height: this.height + 'px',
        opacity: 1,
        borderRadius: 'var(--radius)'
      }
    ], { duration: 300, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' })

    anim.onfinish = () => {
      if (!this.closed) {
        anim.cancel()
        this.element.style.opacity = '1'
        this.element.style.left = this.x + 'px'
        this.element.style.top = this.y + 'px'
        this.element.style.width = this.width + 'px'
        this.element.style.height = this.height + 'px'
        this.element.style.borderRadius = ''
      }
    }

    this.focus()
    this.eventBus.emit('window:restored', this.id)
  }

  // 最大化 / 还原切换
  toggleMaximize(): void {
    if (this.closed || !this.maxable) return
    if (this.maximized) {
      // ===== 还原：从全屏回退到保存的位置 =====
      this.maximized = false

      // 先在移除类之前获取当前最大化状态下的位置和尺寸
      const rect = this.element.getBoundingClientRect()
      // 设置内联样式保持窗口外观，防止移除类后窗口跳变
      this.element.style.left = rect.left + 'px'
      this.element.style.top = rect.top + 'px'
      this.element.style.width = rect.width + 'px'
      this.element.style.height = rect.height + 'px'
      this.element.style.borderRadius = '0px'
      // 然后再移除类（此时内联样式已生效，窗口外观保持不变）
      this.element.classList.remove('maximized')

      // 强制布局
      this.element.getBoundingClientRect()

      // 动画到保存的位置/尺寸
      // 从当前内联样式位置（最大化全屏位置）动画到之前保存的位置
      const anim = this.element.animate([
        {
          left: rect.left + 'px',
          top: rect.top + 'px',
          width: rect.width + 'px',
          height: rect.height + 'px',
          borderRadius: '0px'
        },
        {
          left: this.prevX + 'px',
          top: this.prevY + 'px',
          width: this.prevWidth + 'px',
          height: this.prevHeight + 'px',
          borderRadius: 'var(--radius)'
        }
      ], { duration: 280, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' })

      anim.onfinish = () => {
        anim.cancel()
        this.x = this.prevX
        this.y = this.prevY
        this.width = this.prevWidth
        this.height = this.prevHeight
        this.element.style.left = this.x + 'px'
        this.element.style.top = this.y + 'px'
        this.element.style.width = this.width + 'px'
        this.element.style.height = this.height + 'px'
        this.element.style.borderRadius = ''
      }

      this.eventBus.emit('window:restored', this.id)
    } else {
      // ===== 最大化：向四周延伸覆盖屏幕 =====
      this.prevX = this.x
      this.prevY = this.y
      this.prevWidth = this.width
      this.prevHeight = this.height

      const fsH = window.innerHeight - 44 - 8

      // 保存当前位置用于动画起点
      const startLeft = this.x + 'px'
      const startTop = this.y + 'px'
      const startWidth = this.width + 'px'
      const startHeight = this.height + 'px'

      // 动画：从当前位置延伸到全屏
      const anim = this.element.animate([
        {
          left: startLeft,
          top: startTop,
          width: startWidth,
          height: startHeight,
          borderRadius: 'var(--radius)'
        },
        {
          left: '0px',
          top: '0px',
          width: window.innerWidth + 'px',
          height: fsH + 'px',
          borderRadius: '0px'
        }
      ], { duration: 280, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' })

      anim.onfinish = () => {
        anim.cancel()
        this.maximized = true
        this.element.classList.add('maximized')
        this.x = 0
        this.y = 0
        this.width = window.innerWidth
        this.height = fsH
        // 使用 CSS 类控制最大化状态，不再用内联样式
        this.element.style.left = '0'
        this.element.style.top = '0'
        this.element.style.width = '100%'
        this.element.style.height = 'calc(100% - var(--taskbar-height) - var(--taskbar-margin))'
        this.element.style.borderRadius = '0'
      }

      this.eventBus.emit('window:maximized', this.id)
    }
    this.focus()
  }

  // 关闭：先播放退出动画再移除 DOM
  close(): void {
    if (this.closed) return
    this.closed = true

    // 取消 RAF
    if (this.dragRafId !== null) {
      cancelAnimationFrame(this.dragRafId)
      this.dragRafId = null
    }
    if (this.resizeRafId !== null) {
      cancelAnimationFrame(this.resizeRafId)
      this.resizeRafId = null
    }

    // 移除可能残留的 document 监听器
    document.removeEventListener('mousemove', this.boundDragMove)
    document.removeEventListener('mouseup', this.boundDragEnd)
    document.removeEventListener('mouseleave', this.boundDragEnd)
    document.removeEventListener('mousemove', this.boundResizeMove)
    document.removeEventListener('mouseup', this.boundResizeEnd)
    document.removeEventListener('mouseleave', this.boundResizeEnd)

    // 清理所有注册的监听器
    this.cleanupCallbacks.forEach(fn => {
      try { fn() } catch (e) { /* 忽略清理错误 */ }
    })
    this.cleanupCallbacks = []

    // 如果窗口是最大化状态，先移除 maximized 类以避免 CSS !important 规则干扰 transform 动画
    const wasMaximized = this.maximized
    if (wasMaximized) {
      // 先在移除类之前获取当前最大化状态下的位置和尺寸
      const rect = this.element.getBoundingClientRect()
      // 设置内联样式保持窗口外观，防止移除类后窗口跳变
      this.element.style.left = rect.left + 'px'
      this.element.style.top = rect.top + 'px'
      this.element.style.width = rect.width + 'px'
      this.element.style.height = rect.height + 'px'
      this.element.style.borderRadius = '0'
      // 然后再移除类（此时内联样式已生效，窗口外观保持不变）
      this.element.classList.remove('maximized')
    }

    // 播放关闭动画：使用 transform 做缩放，不影响 left/top 定位
    this.element.style.pointerEvents = 'none'
    const anim = this.element.animate(
      [
        { transform: 'scale(1)', opacity: 1, borderRadius: wasMaximized ? '0' : '8px' },
        { transform: 'scale(0.92) translateY(-10px)', opacity: 0, borderRadius: wasMaximized ? '0' : '8px' }
      ],
      { duration: 200, easing: 'cubic-bezier(0.4, 0, 0.6, 1)', fill: 'forwards' }
    )

    setTimeout(() => {
      anim.cancel()
      this.element.remove()
      this.eventBus.emit('window:closed', this.id)
    }, 205)
  }

  // 设置标题
  setTitle(title: string): void {
    this.title = title
    if (this.titleEl) this.titleEl.textContent = title
  }

  // 设置图标
  setIcon(icon: string): void {
    this.icon = icon
    this.renderIcon(icon)
  }
}
