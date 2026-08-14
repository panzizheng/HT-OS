import { WindowManager } from '../wm/WindowManager'
import { ContextMenu } from '../desktop/ContextMenu'

const APP_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ff9500" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8" y2="10"/><line x1="12" y1="10" x2="12" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="8" y2="18"/><line x1="12" y1="18" x2="12" y2="18"/></svg>'

export function registerCalculatorApp(wm: WindowManager): void {
  wm.registerApp({
    id: 'calculator',
    name: '计算器',
    icon: APP_ICON,
    singleton: true,
    defaultWidth: 320,
    defaultHeight: 460,
    entry: (windowId: string) => {
      const win = wm.getWindow(windowId)
      if (!win) return

      const content = win.content
      content.className = 'calculator-app window-content'

      // 计算器状态
      let display = '0'           // 当前显示值
      let expression = ''         // 完整算式
      let previousValue: number | null = null  // 上一个操作数
      let operation: string | null = null      // 当前运算符
      let waitingForNewNumber = false          // 等待输入新数字
      let hasError = false                     // 是否出错

      content.innerHTML = `
        <div class="calc-display">
          <div class="calc-previous" id="calc-prev"></div>
          <div class="calc-current" id="calc-display">0</div>
        </div>
        <div class="calc-buttons">
          <button class="calc-btn calc-func" data-action="clear">C</button>
          <button class="calc-btn calc-func" data-action="negate">+/-</button>
          <button class="calc-btn calc-func" data-action="percent">%</button>
          <button class="calc-btn calc-op" data-op="/">÷</button>

          <button class="calc-btn calc-num" data-num="7">7</button>
          <button class="calc-btn calc-num" data-num="8">8</button>
          <button class="calc-btn calc-num" data-num="9">9</button>
          <button class="calc-btn calc-op" data-op="*">×</button>

          <button class="calc-btn calc-num" data-num="4">4</button>
          <button class="calc-btn calc-num" data-num="5">5</button>
          <button class="calc-btn calc-num" data-num="6">6</button>
          <button class="calc-btn calc-op" data-op="-">−</button>

          <button class="calc-btn calc-num" data-num="1">1</button>
          <button class="calc-btn calc-num" data-num="2">2</button>
          <button class="calc-btn calc-num" data-num="3">3</button>
          <button class="calc-btn calc-op" data-op="+">+</button>

          <button class="calc-btn calc-num calc-zero" data-num="0">0</button>
          <button class="calc-btn calc-num" data-num=".">.</button>
          <button class="calc-btn calc-equals" data-action="equals">=</button>
        </div>
      `

      const displayEl = content.querySelector('#calc-display') as HTMLElement
      const prevEl = content.querySelector('#calc-prev') as HTMLElement

      // 格式化数字显示
      const formatNumber = (num: number): string => {
        if (!isFinite(num) || isNaN(num)) return '错误'
        if (Math.abs(num) > 1e15) return num.toExponential(10)
        // 保留精度但去除多余小数
        const str = parseFloat(num.toPrecision(15)).toString()
        return str
      }

      // 更新显示
      const updateDisplay = () => {
        if (hasError) {
          displayEl.textContent = '错误'
          displayEl.style.color = '#ff6b6b'
        } else {
          displayEl.textContent = display
          // 恢复 CSS 默认颜色（清除错误状态的红色覆盖）
          displayEl.style.color = ''
        }
      }

      // 更新算式显示
      const updateExpression = () => {
        if (previousValue !== null && operation) {
          const opSymbol = operation === '*' ? '×' : operation === '/' ? '÷' : operation === '-' ? '−' : operation
          prevEl.textContent = `${formatNumber(previousValue)} ${opSymbol}`
        } else {
          prevEl.textContent = expression
        }
      }

      // 执行计算
      const calculate = (a: number, b: number, op: string): number => {
        switch (op) {
          case '+': return a + b
          case '-': return a - b
          case '*': return a * b
          case '/':
            if (b === 0) return NaN
            return a / b
          default: return b
        }
      }

      // 输入数字
      const inputNumber = (num: string) => {
        if (hasError) return

        if (waitingForNewNumber) {
          display = num === '.' ? '0.' : num
          waitingForNewNumber = false
        } else {
          if (num === '.' && display.includes('.')) return
          if (display === '0' && num !== '.') {
            display = num
          } else {
            // 限制输入长度
            if (display.replace('.', '').replace('-', '').length >= 15) return
            display += num
          }
        }
        updateDisplay()
      }

      // 输入运算符
      const inputOperator = (op: string) => {
        if (hasError) return

        const currentValue = parseFloat(display)

        if (previousValue !== null && !waitingForNewNumber) {
          // 连续计算
          const result = calculate(previousValue, currentValue, operation!)
          if (!isFinite(result) || isNaN(result)) {
            hasError = true
            updateDisplay()
            return
          }
          previousValue = result
          display = formatNumber(result)
        } else {
          previousValue = currentValue
        }

        operation = op
        waitingForNewNumber = true
        updateDisplay()
        updateExpression()
      }

      // 等于计算
      const equals = () => {
        if (hasError) return
        if (previousValue !== null && operation) {
          const currentValue = parseFloat(display)
          const result = calculate(previousValue, currentValue, operation)

          if (!isFinite(result) || isNaN(result)) {
            hasError = true
            display = '0'
            updateDisplay()
            prevEl.textContent = ''
            return
          }

          const opSymbol = operation === '*' ? '×' : operation === '/' ? '÷' : operation === '-' ? '−' : operation
          expression = `${formatNumber(previousValue)} ${opSymbol} ${formatNumber(currentValue)} =`
          display = formatNumber(result)
          previousValue = null
          operation = null
          waitingForNewNumber = true
          updateDisplay()
          prevEl.textContent = expression
        }
      }

      // 清除
      const clearAll = () => {
        display = '0'
        expression = ''
        previousValue = null
        operation = null
        waitingForNewNumber = false
        hasError = false
        prevEl.textContent = ''
        updateDisplay()
      }

      // 退格
      const backspace = () => {
        if (hasError) {
          clearAll()
          return
        }
        if (waitingForNewNumber) return
        if (display.length > 1) {
          display = display.slice(0, -1)
          if (display === '-' || display === '') display = '0'
        } else {
          display = '0'
        }
        updateDisplay()
      }

      // 百分比
      const percent = () => {
        if (hasError) return
        const value = parseFloat(display)
        if (previousValue !== null) {
          // 计算上一个值的百分比
          display = formatNumber(previousValue * value / 100)
        } else {
          display = formatNumber(value / 100)
        }
        updateDisplay()
      }

      // 正负号切换
      const negate = () => {
        if (hasError) return
        if (display !== '0') {
          if (display.startsWith('-')) {
            display = display.slice(1)
          } else {
            display = '-' + display
          }
          updateDisplay()
        }
      }

      // 按钮事件绑定
      content.querySelectorAll('.calc-num').forEach(btn => {
        btn.addEventListener('click', () => {
          inputNumber(btn.getAttribute('data-num') || '0')
        })
      })

      content.querySelectorAll('.calc-op').forEach(btn => {
        btn.addEventListener('click', () => {
          inputOperator(btn.getAttribute('data-op') || '+')
        })
      })

      content.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
          const action = btn.getAttribute('data-action')
          switch (action) {
            case 'clear': clearAll(); break
            case 'equals': equals(); break
            case 'percent': percent(); break
            case 'negate': negate(); break
          }
        })
      })

      // 退格按钮需要单独绑定（不在 data-action 中，用单独的 ID 或 class）
      // 实际上当前布局没有退格按钮，但键盘支持有

      // 键盘支持
      const keyHandler = (e: KeyboardEvent) => {
        // 只在窗口可见时响应
        if (win.element.style.display === 'none' || win.minimized) return
        // 只在计算器窗口聚焦时响应
        const activeWin = document.querySelector('.ht-window')
        if (!win.element.contains(document.activeElement) && document.activeElement !== document.body) {
          // 如果焦点在输入框等元素上，不响应
          const tag = (document.activeElement as HTMLElement)?.tagName
          if (tag === 'INPUT' || tag === 'TEXTAREA') return
        }

        if (e.key >= '0' && e.key <= '9') {
          e.preventDefault()
          inputNumber(e.key)
        } else if (e.key === '.') {
          e.preventDefault()
          inputNumber('.')
        } else if (e.key === '+' || e.key === '-' || e.key === '*' || e.key === '/') {
          e.preventDefault()
          inputOperator(e.key)
        } else if (e.key === 'Enter' || e.key === '=') {
          e.preventDefault()
          equals()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          clearAll()
        } else if (e.key === 'Backspace') {
          e.preventDefault()
          backspace()
        } else if (e.key === '%') {
          e.preventDefault()
          percent()
        }
      }

      document.addEventListener('keydown', keyHandler)

      // 窗口关闭时移除键盘监听
      const cleanup = () => {
        document.removeEventListener('keydown', keyHandler)
      }
      win.element.addEventListener('remove', cleanup)

      // 初始显示
      updateDisplay()

      // 右键菜单
      const ctxMenu = new ContextMenu()
      content.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        ctxMenu.show(e.clientX, e.clientY, [
          {
            label: '复制结果',
            action: () => {
              navigator.clipboard?.writeText(display)
            }
          },
          {
            label: '粘贴',
            action: async () => {
              try {
                const text = (await navigator.clipboard?.readText())?.trim()
                if (!text) return
                if (hasError) clearAll()
                const num = parseFloat(text)
                if (!isNaN(num) && isFinite(num) && /^[\d.+\-eE]+$/.test(text)) {
                  display = formatNumber(num)
                  waitingForNewNumber = true
                  updateDisplay()
                  return
                }
                if (/^[\d+\-*/.()\s]+$/.test(text)) {
                  const result = Function(`"use strict"; return (${text})`)()
                  if (typeof result === 'number' && isFinite(result) && !isNaN(result)) {
                    display = formatNumber(result)
                    expression = `${text} =`
                    prevEl.textContent = expression
                    previousValue = null
                    operation = null
                    waitingForNewNumber = true
                    updateDisplay()
                  }
                }
              } catch (err) {
                // 粘贴失败时静默处理
              }
            }
          },
          { separator: true },
          { label: '清除', action: () => clearAll() },
          { separator: true },
          {
            label: '复制历史',
            action: () => {
              if (expression) {
                navigator.clipboard?.writeText(expression)
              } else {
                // 没有历史，临时在算式区提示
                const original = prevEl.textContent
                prevEl.textContent = '（历史为空）'
                setTimeout(() => { prevEl.textContent = original }, 1500)
              }
            }
          }
        ])
      })
    }
  })
}
