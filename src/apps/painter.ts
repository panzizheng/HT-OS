import { WindowManager } from '../wm/WindowManager'
import { ContextMenu } from '../desktop/ContextMenu'
import { dialog } from '../desktop/Dialog'

const APP_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>'

// 工具图标
const BRUSH_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.06 11.9l8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z"/></svg>'
const ERASER_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20H7L3 16C2.5 15.5 2.5 14.5 3 14L13 4l7 7-7 7"/><line x1="18" y1="13" x2="9" y2="4"/></svg>'
const FILL_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 11h2m-1 -1v2"/><path d="M5.5 12.5l6.5 -6.5l4 4l-6.5 6.5z"/><path d="M5.5 12.5l-2.5 2.5l4 4l2.5 -2.5"/><path d="M17 21l1.5 -3l1.5 3z"/></svg>'
const LINE_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="19" x2="19" y2="5"/></svg>'
const RECT_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="6" width="16" height="12" rx="1"/></svg>'
const CIRCLE_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/></svg>'
const CLEAR_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>'
const SAVE_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>'

// 预设颜色
const PALETTE = [
  '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00',
  '#ff00ff', '#00ffff', '#808080', '#c0c0c0', '#800000', '#808000',
  '#008000', '#008080', '#000080', '#800080', '#ff8c00', '#ff69b4'
]

export function registerPainterApp(wm: WindowManager): void {
  wm.registerApp({
    id: 'painter',
    name: '画图',
    icon: APP_ICON,
    defaultWidth: 800,
    defaultHeight: 560,
    entry: (windowId: string) => {
      const win = wm.getWindow(windowId)
      if (!win) return

      const content = win.content
      content.className = 'painter-app window-content'

      // 画图状态
      let isDrawing = false
      let currentColor = '#000000'
      let brushSize = 5
      let currentTool = 'brush'
      let lastX = 0
      let lastY = 0
      let startX = 0
      let startY = 0
      let snapshot: ImageData | null = null  // 用于形状绘制时的预览

      content.innerHTML = `
        <div class="painter-toolbar">
          <div class="tool-group">
            <button class="tool-btn active" data-tool="brush" title="画笔">${BRUSH_ICON}</button>
            <button class="tool-btn" data-tool="eraser" title="橡皮擦">${ERASER_ICON}</button>
            <button class="tool-btn" data-tool="fill" title="填充">${FILL_ICON}</button>
            <button class="tool-btn" data-tool="line" title="直线">${LINE_ICON}</button>
            <button class="tool-btn" data-tool="rect" title="矩形">${RECT_ICON}</button>
            <button class="tool-btn" data-tool="circle" title="圆形">${CIRCLE_ICON}</button>
          </div>
          <div class="tool-group">
            <label>颜色:</label>
            <input type="color" id="paint-color" value="#000000" class="paint-color-input">
            <div class="paint-palette">
              ${PALETTE.map(c => `<div class="palette-color" style="background:${c}" data-color="${c}"></div>`).join('')}
            </div>
          </div>
          <div class="tool-group">
            <label>粗细:</label>
            <input type="range" id="paint-size" min="1" max="50" value="5">
            <span id="paint-size-val">5</span>
          </div>
          <div class="tool-group">
            <button class="tool-btn" id="paint-clear" title="清空">${CLEAR_ICON}</button>
            <button class="tool-btn" id="paint-save" title="保存">${SAVE_ICON}</button>
          </div>
        </div>
        <div class="painter-canvas-container">
          <canvas id="paint-canvas" width="720" height="420"></canvas>
        </div>
        <div class="painter-statusbar">
          <span id="paint-pos">坐标: 0, 0</span>
          <span id="paint-tool">工具: 画笔</span>
          <span id="paint-size-status">粗细: 5px</span>
        </div>
      `

      const canvas = content.querySelector('#paint-canvas') as HTMLCanvasElement
      const ctx = canvas.getContext('2d')!
      const sizeSlider = content.querySelector('#paint-size') as HTMLInputElement
      const sizeVal = content.querySelector('#paint-size-val') as HTMLElement
      const colorInput = content.querySelector('#paint-color') as HTMLInputElement
      const posEl = content.querySelector('#paint-pos') as HTMLElement
      const toolEl = content.querySelector('#paint-tool') as HTMLElement
      const sizeStatusEl = content.querySelector('#paint-size-status') as HTMLElement

      // 初始化画布
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      // 获取画布坐标
      const getCanvasPos = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect()
        const scaleX = canvas.width / rect.width
        const scaleY = canvas.height / rect.height
        return {
          x: (e.clientX - rect.left) * scaleX,
          y: (e.clientY - rect.top) * scaleY
        }
      }

      // 开始绘制
      const startDrawing = (e: MouseEvent) => {
        const pos = getCanvasPos(e)
        startX = lastX = pos.x
        startY = lastY = pos.y
        isDrawing = true

        if (currentTool === 'brush' || currentTool === 'eraser') {
          ctx.beginPath()
          ctx.moveTo(lastX, lastY)
          // 画一个点（单击效果）
          ctx.lineTo(lastX + 0.01, lastY + 0.01)
          ctx.strokeStyle = currentTool === 'eraser' ? '#ffffff' : currentColor
          ctx.lineWidth = brushSize
          ctx.stroke()
        } else if (currentTool === 'fill') {
          // 填充整个画布
          ctx.fillStyle = currentColor
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          isDrawing = false
        } else if (currentTool === 'line' || currentTool === 'rect' || currentTool === 'circle') {
          // 保存当前画布状态用于预览
          snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height)
        }
      }

      // 绘制过程
      const draw = (e: MouseEvent) => {
        const pos = getCanvasPos(e)
        posEl.textContent = `坐标: ${Math.round(pos.x)}, ${Math.round(pos.y)}`

        if (!isDrawing) return

        if (currentTool === 'brush' || currentTool === 'eraser') {
          ctx.strokeStyle = currentTool === 'eraser' ? '#ffffff' : currentColor
          ctx.lineWidth = brushSize
          ctx.lineTo(pos.x, pos.y)
          ctx.stroke()
          lastX = pos.x
          lastY = pos.y
        } else if (currentTool === 'line' && snapshot) {
          // 恢复快照并绘制预览直线
          ctx.putImageData(snapshot, 0, 0)
          ctx.strokeStyle = currentColor
          ctx.lineWidth = brushSize
          ctx.beginPath()
          ctx.moveTo(startX, startY)
          ctx.lineTo(pos.x, pos.y)
          ctx.stroke()
        } else if (currentTool === 'rect' && snapshot) {
          // 恢复快照并绘制预览矩形
          ctx.putImageData(snapshot, 0, 0)
          ctx.strokeStyle = currentColor
          ctx.lineWidth = brushSize
          ctx.strokeRect(startX, startY, pos.x - startX, pos.y - startY)
        } else if (currentTool === 'circle' && snapshot) {
          // 恢复快照并绘制预览圆形
          ctx.putImageData(snapshot, 0, 0)
          ctx.strokeStyle = currentColor
          ctx.lineWidth = brushSize
          const radius = Math.sqrt(Math.pow(pos.x - startX, 2) + Math.pow(pos.y - startY, 2))
          ctx.beginPath()
          ctx.arc(startX, startY, radius, 0, Math.PI * 2)
          ctx.stroke()
        }
      }

      // 停止绘制
      const stopDrawing = () => {
        isDrawing = false
        snapshot = null
      }

      // 画布事件
      canvas.addEventListener('mousedown', startDrawing)
      canvas.addEventListener('mousemove', draw)
      canvas.addEventListener('mouseup', stopDrawing)
      canvas.addEventListener('mouseleave', stopDrawing)

      // 触摸事件支持
      canvas.addEventListener('touchstart', (e: TouchEvent) => {
        e.preventDefault()
        const touch = e.touches[0]
        startDrawing({ clientX: touch.clientX, clientY: touch.clientY } as MouseEvent)
      })
      canvas.addEventListener('touchmove', (e: TouchEvent) => {
        e.preventDefault()
        const touch = e.touches[0]
        draw({ clientX: touch.clientX, clientY: touch.clientY } as MouseEvent)
      })
      canvas.addEventListener('touchend', stopDrawing)

      // 颜色选择
      colorInput.addEventListener('input', (e) => {
        currentColor = (e.target as HTMLInputElement).value
      })

      // 调色板
      content.querySelectorAll('.palette-color').forEach(c => {
        c.addEventListener('click', () => {
          const color = c.getAttribute('data-color') || '#000000'
          currentColor = color
          colorInput.value = color
        })
      })

      // 笔刷大小
      sizeSlider.addEventListener('input', (e) => {
        brushSize = parseInt((e.target as HTMLInputElement).value)
        sizeVal.textContent = String(brushSize)
        sizeStatusEl.textContent = `粗细: ${brushSize}px`
      })

      // 工具切换
      content.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
        btn.addEventListener('click', () => {
          content.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'))
          btn.classList.add('active')
          currentTool = btn.getAttribute('data-tool') || 'brush'
          const toolNames: Record<string, string> = {
            brush: '画笔',
            eraser: '橡皮擦',
            fill: '填充',
            line: '直线',
            rect: '矩形',
            circle: '圆形'
          }
          toolEl.textContent = `工具: ${toolNames[currentTool] || '画笔'}`
          // 更改鼠标样式
          if (currentTool === 'fill') {
            canvas.style.cursor = 'cell'
          } else {
            canvas.style.cursor = 'crosshair'
          }
        })
      })

      // 清空画布
      content.querySelector('#paint-clear')!.addEventListener('click', async () => {
        if (await dialog.confirm('确定要清空画布吗？')) {
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }
      })

      // 保存为 PNG
      content.querySelector('#paint-save')!.addEventListener('click', async () => {
        const link = document.createElement('a')
        const fileName = await dialog.prompt('文件名:', 'painting.png')
        if (fileName) {
          link.download = fileName.endsWith('.png') ? fileName : fileName + '.png'
          link.href = canvas.toDataURL('image/png')
          link.click()
        }
      })

      // 右键菜单
      const ctxMenu = new ContextMenu()
      canvas.addEventListener('contextmenu', (e: MouseEvent) => {
        e.preventDefault()
        ctxMenu.show(e.clientX, e.clientY, [
          {
            label: '保存图片',
            action: () => {
              const link = document.createElement('a')
              link.download = 'painting.png'
              link.href = canvas.toDataURL('image/png')
              link.click()
            }
          },
          {
            label: '清空画布',
            action: () => {
              ctx.fillStyle = '#ffffff'
              ctx.fillRect(0, 0, canvas.width, canvas.height)
            }
          },
          { separator: true },
          {
            label: '撤销',
            action: async () => {
              await dialog.alert('暂不支持撤销')
            }
          }
        ])
      })
    }
  })
}
