// ============================================================
// AI 助手应用 - 基于规则匹配的本地智能助手
// 由于无法直接调用云端 AI API（需要密钥），采用本地规则引擎模拟智能回复
// 支持数学计算、时间查询、系统操作建议、闲聊等
// ============================================================

import { WindowManager } from '../wm/WindowManager'
import { EventBus } from '../kernel/EventBus'
import { SettingsManager } from '../kernel/SettingsManager'
import { ContextMenu } from '../desktop/ContextMenu'
import { dialog } from '../desktop/Dialog'

const APP_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 3 L14 10 L21 12 L14 14 L12 21 L10 14 L3 12 L10 10 z" fill="#9b59b6"/></svg>'

const SEND_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>'
const CLEAR_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>'

interface Message {
  role: 'user' | 'assistant'
  content: string
  time: string
}

const HISTORY_KEY = 'ht-os-ai-history'

export function registerAiAssistantApp(
  wm: WindowManager,
  eventBus: EventBus,
  settings: SettingsManager
): void {
  wm.registerApp({
    id: 'ai-assistant',
    name: 'AI 助手',
    icon: APP_ICON,
    singleton: true,
    defaultWidth: 540,
    defaultHeight: 640,
    entry: (windowId: string) => {
      const win = wm.getWindow(windowId)
      if (!win) return

      const content = win.content
      content.className = 'ai-assistant-app window-content'

      let messages: Message[] = loadHistory()

      content.innerHTML = `
        <div class="ai-container">
          <div class="ai-header">
            <div class="ai-bot-avatar">${APP_ICON}</div>
            <div class="ai-bot-info">
              <div class="ai-bot-name">HT 助手</div>
              <div class="ai-bot-status">在线 - 准备就绪</div>
            </div>
            <button class="ai-clear-btn" id="ai-clear-btn" title="清空对话">${CLEAR_ICON}</button>
          </div>
          <div class="ai-messages" id="ai-messages"></div>
          <div class="ai-suggestions" id="ai-suggestions">
            <button class="suggestion-btn" data-q="现在几点了？">现在几点？</button>
            <button class="suggestion-btn" data-q="计算 123 + 456">计算器</button>
            <button class="suggestion-btn" data-q="帮我打开文件管理器">打开应用</button>
            <button class="suggestion-btn" data-q="你是谁？">你是谁</button>
          </div>
          <div class="ai-input-area">
            <textarea id="ai-input" class="ai-input" placeholder="输入消息，按 Enter 发送..." rows="1"></textarea>
            <button class="ai-send-btn" id="ai-send-btn" title="发送">${SEND_ICON}</button>
          </div>
        </div>
      `

      const messagesEl = content.querySelector('#ai-messages') as HTMLElement
      const inputEl = content.querySelector('#ai-input') as HTMLTextAreaElement
      const sendBtn = content.querySelector('#ai-send-btn') as HTMLButtonElement
      const clearBtn = content.querySelector('#ai-clear-btn') as HTMLButtonElement
      const suggestionsEl = content.querySelector('#ai-suggestions') as HTMLElement

      // 加载历史记录
      function loadHistory(): Message[] {
        try {
          const saved = localStorage.getItem(HISTORY_KEY)
          if (saved) {
            const arr = JSON.parse(saved)
            if (Array.isArray(arr)) return arr
          }
        } catch (e) {
          console.warn('[AI] 加载历史失败:', e)
        }
        return [
          {
            role: 'assistant',
            content: '您好！我是 HT 助手，可以帮您查询时间、计算数学、打开应用或闲聊。请问有什么可以帮您？',
            time: currentTime()
          }
        ]
      }

      // 保存历史记录
      function saveHistory(): void {
        try {
          // 只保留最近 50 条
          const toSave = messages.slice(-50)
          localStorage.setItem(HISTORY_KEY, JSON.stringify(toSave))
        } catch (e) {
          console.warn('[AI] 保存历史失败:', e)
        }
      }

      // 当前时间字符串
      function currentTime(): string {
        const now = new Date()
        return now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
      }

      // 转义 HTML
      function escapeHtml(text: string): string {
        const div = document.createElement('div')
        div.textContent = text
        return div.innerHTML
      }

      // 渲染所有消息
      function renderMessages(): void {
        messagesEl.innerHTML = ''
        messages.forEach(msg => {
          const el = document.createElement('div')
          el.className = `ai-message ai-message-${msg.role}`
          el.innerHTML = `
            <div class="message-avatar">
              ${msg.role === 'assistant'
                ? '<svg width="24" height="24" viewBox="0 0 24 24"><path d="M12 3 L14 10 L21 12 L14 14 L12 21 L10 14 L3 12 L10 10 z" fill="#9b59b6"/></svg>'
                : '<svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#4a90d9"/><circle cx="12" cy="10" r="4" fill="white"/><path d="M4 22 a8 8 0 0 1 16 0 z" fill="white"/></svg>'
              }
            </div>
            <div class="message-content">
              <div class="message-text">${escapeHtml(msg.content)}</div>
              <div class="message-time">${msg.time}</div>
            </div>
          `
          messagesEl.appendChild(el)
        })
        // 滚动到底部
        messagesEl.scrollTop = messagesEl.scrollHeight
      }

      // 添加一条消息
      function addMessage(role: 'user' | 'assistant', content: string): void {
        messages.push({ role, content, time: currentTime() })
        saveHistory()
        renderMessages()
      }

      // 显示"正在输入"提示
      function showTyping(): HTMLElement {
        const el = document.createElement('div')
        el.className = 'ai-message ai-message-assistant ai-typing'
        el.innerHTML = `
          <div class="message-avatar">
            <svg width="24" height="24" viewBox="0 0 24 24"><path d="M12 3 L14 10 L21 12 L14 14 L12 21 L10 14 L3 12 L10 10 z" fill="#9b59b6"/></svg>
          </div>
          <div class="message-content">
            <div class="typing-indicator">
              <span></span><span></span><span></span>
            </div>
          </div>
        `
        messagesEl.appendChild(el)
        messagesEl.scrollTop = messagesEl.scrollHeight
        return el
      }

      // 生成回复（本地规则引擎）
      function generateReply(input: string): string {
        const text = input.trim().toLowerCase()

        // 1. 时间查询
        if (/(几点|时间|现在)/.test(text) && !/计算/.test(text)) {
          const now = new Date()
          const time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
          const date = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
          return `现在是 ${date} ${time}`
        }

        // 2. 日期查询
        if (/(今天|日期|几号)/.test(text)) {
          const now = new Date()
          return `今天是 ${now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}`
        }

        // 3. 数学计算
        const mathMatch = input.match(/(?:计算|算一下|算)\s*([\d\s+\-*/().%^]+)/)
        if (mathMatch) {
          try {
            const expr = mathMatch[1].trim().replace(/\^/g, '**').replace(/%/g, '/100')
            // 安全地计算表达式（仅允许数字和运算符）
            if (/^[\d\s+\-*/().]+$/.test(expr)) {
              const result = Function(`"use strict"; return (${expr})`)()
              if (typeof result === 'number' && !isNaN(result)) {
                return `${mathMatch[1].trim()} = ${result}`
              }
            }
          } catch (e) {
            return '抱歉，我无法计算这个表达式。请检查输入是否正确。'
          }
        }
        // 直接是数学表达式
        if (/^[\d\s+\-*/().%^]+$/.test(input.trim()) && /[+\-*/^%]/.test(input)) {
          try {
            const expr = input.trim().replace(/\^/g, '**').replace(/%/g, '/100')
            const result = Function(`"use strict"; return (${expr})`)()
            if (typeof result === 'number' && !isNaN(result)) {
              return `${input.trim()} = ${result}`
            }
          } catch (e) {
            return '计算失败，请检查表达式。'
          }
        }

        // 4. 打开应用
        const appMap: { [key: string]: { id: string; name: string } } = {
          '文件管理器': { id: 'file-manager', name: '文件管理器' },
          '文件': { id: 'file-manager', name: '文件管理器' },
          '终端': { id: 'terminal', name: '终端' },
          '记事本': { id: 'notepad', name: '记事本' },
          '计算器': { id: 'calculator', name: '计算器' },
          '浏览器': { id: 'browser', name: '浏览器' },
          '设置': { id: 'settings', name: '设置' },
          '画图': { id: 'painter', name: '画图' },
          '音乐': { id: 'music-player', name: '音乐播放器' },
          '视频': { id: 'video-player', name: '视频播放器' },
          '天气': { id: 'weather', name: '天气' }
        }
        if (/(打开|启动|运行|启动).+/.test(text) || /(打开|启动|运行)/.test(text)) {
          for (const key in appMap) {
            if (text.includes(key.toLowerCase())) {
              eventBus.emit('app:launch', appMap[key].id)
              return `好的，已为您打开${appMap[key].name}。`
            }
          }
          return '抱歉，我没有找到对应的应用。您可以尝试说"打开文件管理器"、"打开浏览器"等。'
        }

        // 5. 问候
        if (/^(你好|您好|hi|hello|嗨|hey)/.test(text)) {
          const greetings = ['您好！很高兴为您服务。', '你好！有什么我可以帮您的吗？', '嗨！今天过得怎么样？']
          return greetings[Math.floor(Math.random() * greetings.length)]
        }

        // 6. 询问身份
        if (/(你是谁|你叫什么|你的名字|介绍自己|你是)/.test(text)) {
          return `我是 HT 助手，HT OS 系统的智能助手。我可以帮您：
1. 查询时间和日期
2. 进行数学计算
3. 打开系统应用
4. 回答简单问题

请问有什么可以帮您？`
        }

        // 7. 感谢
        if (/(谢谢|感谢|多谢|thanks|thank you)/.test(text)) {
          return '不客气！很高兴能帮到您。'
        }

        // 8. 告别
        if (/(再见|拜拜|bye|goodbye)/.test(text)) {
          return '再见！祝您使用愉快。'
        }

        // 9. 天气相关
        if (/天气|气温|下雨/.test(text)) {
          return '建议您打开"天气"应用查看实时天气信息。您可以说"打开天气"。'
        }

        // 10. 系统信息
        if (/(系统|版本|关于)/.test(text)) {
          const userName = settings.get('userName')
          return `HT OS 系统信息：
- 用户名：${userName}
- 浏览器：${navigator.userAgent.split(') ')[0].split('(').pop() || '未知'}
- 平台：${navigator.platform}
- 语言：${navigator.language}
- 在线状态：${navigator.onLine ? '已联网' : '离线'}`
        }

        // 11. 帮助
        if (/^(帮助|help|能做什么|功能)/.test(text)) {
          return `我可以帮您做这些事：

1. 时间查询：直接问"现在几点"
2. 数学计算：输入"计算 123 + 456"或直接输入表达式
3. 打开应用：说"打开文件管理器"、"打开浏览器"等
4. 系统信息：问"系统信息"或"关于"
5. 闲聊：随时和我聊天

您也可以点击下方的快捷按钮快速体验。`
        }

        // 12. 简单的闲聊回复
        const replies = [
          `我理解您说的"${input}"。您可以问我时间、让我计算数学、或者让我打开应用。输入"帮助"查看完整功能。`,
          `这是一个有趣的话题。作为本地助手，我擅长处理时间查询、数学计算和应用启动。试试"帮助"了解更多。`,
          `收到您的消息。如果您需要具体帮助，可以输入"帮助"查看我能做什么。`
        ]
        return replies[Math.floor(Math.random() * replies.length)]
      }

      // 发送消息
      function sendMessage(): void {
        const text = inputEl.value.trim()
        if (!text) return
        addMessage('user', text)
        inputEl.value = ''
        inputEl.style.height = 'auto'

        // 显示"正在输入"
        const typingEl = showTyping()

        // 模拟思考延迟
        setTimeout(() => {
          typingEl.remove()
          const reply = generateReply(text)
          addMessage('assistant', reply)
        }, 400 + Math.random() * 600)
      }

      // 发送按钮
      sendBtn.addEventListener('click', sendMessage)

      // 输入框：Enter 发送，Shift+Enter 换行
      inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          sendMessage()
        }
      })

      // 自动调整输入框高度
      inputEl.addEventListener('input', () => {
        inputEl.style.height = 'auto'
        inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px'
      })

      // 清空对话
      clearBtn.addEventListener('click', async () => {
        if (await dialog.confirm('确定要清空所有对话记录吗？')) {
          messages = [
            {
              role: 'assistant',
              content: '对话已清空。请问有什么可以帮您？',
              time: currentTime()
            }
          ]
          saveHistory()
          renderMessages()
        }
      })

      // 快捷建议按钮
      suggestionsEl.querySelectorAll('.suggestion-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const q = btn.getAttribute('data-q')
          if (q) {
            inputEl.value = q
            sendMessage()
          }
        })
      })

      // 右键菜单
      const ctxMenu = new ContextMenu()
      content.addEventListener('contextmenu', (e: MouseEvent) => {
        e.preventDefault()
        ctxMenu.show(e.clientX, e.clientY, [
          {
            label: '清空对话',
            action: async () => {
              if (await dialog.confirm('确定要清空所有对话记录吗？')) {
                messages = [
                  {
                    role: 'assistant',
                    content: '对话已清空。请问有什么可以帮您？',
                    time: currentTime()
                  }
                ]
                saveHistory()
                renderMessages()
              }
            }
          },
          {
            label: '复制最后回复',
            action: async () => {
              const lastReply = [...messages].reverse().find(m => m.role === 'assistant')
              if (lastReply) {
                try {
                  await navigator.clipboard.writeText(lastReply.content)
                  await dialog.alert('已复制最后一条 AI 回复')
                } catch {
                  await dialog.alert('复制失败')
                }
              } else {
                await dialog.alert('暂无 AI 回复可复制')
              }
            }
          },
          { separator: true },
          {
            label: '导出对话',
            action: async () => {
              const text = messages.map(m => `[${m.time}] ${m.role === 'user' ? '我' : 'HT 助手'}: ${m.content}`).join('\n')
              try {
                await navigator.clipboard.writeText(text)
                await dialog.alert('对话已复制到剪贴板')
              } catch {
                await dialog.alert('导出失败')
              }
            }
          }
        ])
      })

      // 初始渲染
      renderMessages()
    }
  })
}
