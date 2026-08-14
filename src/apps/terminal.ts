import { WindowManager } from '../wm/WindowManager'
import { FileSystem } from '../fs/FileSystem'
import type { FileSystemItem } from '../kernel/types'
import { ContextMenu } from '../desktop/ContextMenu'
import { EventBus } from '../kernel/EventBus'
import { getCommandRegistry, type CommandContext } from '../kernel/CommandRegistry'
import { TERMINAL_ICON } from './system-icons'

// 终端图标（来自 public/assets/终端.svg）
const APP_ICON = TERMINAL_ICON

export function registerTerminalApp(wm: WindowManager, fs: FileSystem, eventBus: EventBus): void {
  wm.registerApp({
    id: 'terminal',
    name: '终端',
    icon: APP_ICON,
    defaultWidth: 680,
    defaultHeight: 440,
    entry: (windowId: string) => {
      const win = wm.getWindow(windowId)
      if (!win) return

      const content = win.content
      content.className = 'terminal-app window-content'

      let history: string[] = []
      let historyIndex = -1
      let currentPath = '/'

      content.innerHTML = `
        <div class="terminal-output" id="term-output"></div>
        <div class="terminal-input-line">
          <span class="terminal-prompt" id="term-prompt">user@ht-os:/$</span>
          <input type="text" class="terminal-input" id="term-input" autocomplete="off" spellcheck="false">
        </div>
      `

      const output = content.querySelector('#term-output') as HTMLElement
      const input = content.querySelector('#term-input') as HTMLInputElement
      const prompt = content.querySelector('#term-prompt') as HTMLElement

      // 更新命令提示符
      const updatePrompt = () => {
        prompt.textContent = `user@ht-os:${currentPath}$`
      }

      // 输出一行文本
      const print = (text: string, className: string = '') => {
        const line = document.createElement('div')
        if (className) line.className = className
        line.textContent = text
        output.appendChild(line)
        output.scrollTop = output.scrollHeight
      }

      // 输出 HTML（用于带样式的输出）
      const printHtml = (html: string, className: string = '') => {
        const line = document.createElement('div')
        if (className) line.className = className
        line.innerHTML = html
        output.appendChild(line)
        output.scrollTop = output.scrollHeight
      }

      // 解析路径为绝对路径
      const resolvePath = (path: string): string => {
        if (!path) return currentPath
        if (path === '.') return currentPath
        if (path === '..') {
          if (currentPath === '/') return '/'
          const parts = currentPath.split('/').filter(Boolean)
          parts.pop()
          return '/' + parts.join('/')
        }
        if (path.startsWith('/')) return path
        if (path === '~') return '/'
        return currentPath === '/' ? '/' + path : currentPath + '/' + path
      }

      // 树形显示目录
      const printTree = async (folderId: string | null, prefix: string, isLast: boolean): Promise<void> => {
        const items = await fs.listFiles(folderId)
        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          const last = i === items.length - 1
          const branch = last ? '\u2514\u2500\u2500 ' : '\u251C\u2500\u2500 '
          print(prefix + branch + item.name + (item.type === 'folder' ? '/' : ''))

          if (item.type === 'folder') {
            const newPrefix = prefix + (last ? '    ' : '\u2502   ')
            await printTree(item.id, newPrefix, last)
          }
        }
      }

      // 执行命令
      const executeCommand = async (cmd: string) => {
        print(`${prompt.textContent} ${cmd}`, 'terminal-command')

        const parts = cmd.trim().split(/\s+/)
        const command = parts[0].toLowerCase()
        const args = parts.slice(1)

        // 优先调用已注册的应用命令（类似 Windows PATH 机制）
        const registry = getCommandRegistry()
        const registeredCmd = registry.resolve(command)
        if (registeredCmd) {
          // --help / -h 显示该命令用法
          if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
            print(`${registeredCmd.name} - ${registeredCmd.description}`)
            print(`所属应用: ${registeredCmd.app}`)
            if (registeredCmd.usage) print(`用法: ${registeredCmd.usage}`)
            return
          }
          const ctx: CommandContext = {
            cwd: currentPath,
            print: (text) => print(text),
            printError: (text) => print(text, 'terminal-error'),
            printHtml: (html) => printHtml(html),
            setCwd: (path) => { currentPath = path; updatePrompt() },
            fs,
            wm,
            eventBus
          }
          try {
            await registeredCmd.handler(args, ctx)
          } catch (e: any) {
            print(`${command}: 执行出错: ${e?.message || e}`, 'terminal-error')
          }
          return
        }

        switch (command) {
          case '':
            break

          case 'help': {
            print('HT OS 终端 - 内置命令:')
            print('  help              显示帮助信息')
            print('  commands          列出已注册的应用命令')
            print('  clear             清屏')
            print('  ls [path]         列出文件和目录')
            print('  cd <path>         切换目录')
            print('  pwd               显示当前路径')
            print('  mkdir <name>      创建文件夹')
            print('  touch <name>      创建空文件')
            print('  cat <file>        查看文件内容')
            print('  rm <name>         删除文件或目录')
            print('  echo <text>       输出文本')
            print('  write <file> <c>  写入文件内容')
            print('  whoami            显示当前用户')
            print('  date              显示当前日期时间')
            print('  about             显示系统信息')
            print('  tree              树形显示目录结构')
            print('')
            const cmds = registry.list()
            if (cmds.length > 0) {
              print(`已注册应用命令 (${cmds.length}):`)
              cmds.forEach(c => print(`  ${c.name.padEnd(16)} ${c.description}`))
            }
            break
          }

          case 'commands': {
            const all = registry.list()
            if (all.length === 0) {
              print('暂无已注册的应用命令')
            } else {
              print(`已注册应用命令 (${all.length}):`)
              all.forEach(c => {
                print(`  ${c.name}`)
                print(`      ${c.description}`)
                if (c.usage) print(`      用法: ${c.usage}`)
                print(`      应用: ${c.app}`)
              })
            }
            break
          }

          case 'clear':
            output.innerHTML = ''
            break

          case 'pwd':
            print(currentPath)
            break

          case 'whoami':
            print('user')
            break

          case 'date':
            print(new Date().toLocaleString('zh-CN'))
            break

          case 'about':
            print('HT OS v1.0.0')
            print('一个基于 TypeScript 的网页操作系统')
            print('支持: 窗口管理、虚拟文件系统、多应用')
            print('运行环境: ' + navigator.userAgent)
            break

          case 'echo':
            print(args.join(' '))
            break

          case 'ls': {
            try {
              const targetPath = args[0] ? resolvePath(args[0]) : currentPath
              const folder = targetPath === '/' ? null : await fs.getByPath(targetPath.replace(/^\//, ''))
              if (targetPath !== '/' && !folder) {
                print(`ls: 无法访问 '${args[0]}': 没有那个文件或目录`, 'terminal-error')
                break
              }
              if (folder && folder.type === 'file') {
                print(folder.name)
                break
              }
              const items = await fs.listFiles(folder?.id || null)
              if (items.length === 0) {
                print('(空目录)')
              } else {
                const line = items.map(i => {
                  if (i.type === 'folder') return i.name + '/'
                  return i.name
                }).join('  ')
                print(line)
              }
            } catch (e: any) {
              print('ls: ' + e.message, 'terminal-error')
            }
            break
          }

          case 'cd': {
            if (!args[0] || args[0] === '~') {
              currentPath = '/'
            } else if (args[0] === '.') {
              // 当前目录，不变
            } else {
              const target = resolvePath(args[0])
              try {
                if (target === '/') {
                  currentPath = '/'
                } else {
                  const item = await fs.getByPath(target.replace(/^\//, ''))
                  if (!item) {
                    print(`cd: ${args[0]}: 没有那个文件或目录`, 'terminal-error')
                  } else if (item.type !== 'folder') {
                    print(`cd: ${args[0]}: 不是目录`, 'terminal-error')
                  } else {
                    currentPath = target
                  }
                }
              } catch {
                print(`cd: ${args[0]}: 没有那个文件或目录`, 'terminal-error')
              }
            }
            updatePrompt()
            break
          }

          case 'mkdir': {
            if (!args[0]) {
              print('mkdir: 缺少操作数', 'terminal-error')
            } else {
              try {
                const folder = currentPath === '/' ? null : await fs.getByPath(currentPath.slice(1))
                await fs.createFolder(args[0], folder?.id || null)
              } catch (e: any) {
                print('mkdir: ' + e.message, 'terminal-error')
              }
            }
            break
          }

          case 'touch': {
            if (!args[0]) {
              print('touch: 缺少文件操作数', 'terminal-error')
            } else {
              try {
                const path = resolvePath(args[0])
                // 检查文件是否已存在
                const existing = await fs.getByPath(path.replace(/^\//, ''))
                if (!existing) {
                  await fs.writeFile(path.replace(/^\//, ''), '')
                }
              } catch (e: any) {
                print('touch: ' + e.message, 'terminal-error')
              }
            }
            break
          }

          case 'cat': {
            if (!args[0]) {
              print('cat: 缺少文件操作数', 'terminal-error')
            } else {
              try {
                const path = resolvePath(args[0])
                const item = await fs.getByPath(path.replace(/^\//, ''))
                if (!item) {
                  print(`cat: ${args[0]}: 没有那个文件或目录`, 'terminal-error')
                } else if (item.type === 'folder') {
                  print(`cat: ${args[0]}: 是一个目录`, 'terminal-error')
                } else {
                  const fileContent = await fs.readFile(item.id)
                  if (fileContent !== null) {
                    fileContent.split('\n').forEach(line => print(line))
                  }
                }
              } catch (e: any) {
                print('cat: ' + e.message, 'terminal-error')
              }
            }
            break
          }

          case 'rm': {
            if (!args[0]) {
              print('rm: 缺少操作数', 'terminal-error')
            } else {
              try {
                const path = resolvePath(args[0])
                const item = await fs.getByPath(path.replace(/^\//, ''))
                if (!item) {
                  print(`rm: ${args[0]}: 没有那个文件或目录`, 'terminal-error')
                } else {
                  await fs.deleteItem(item.id)
                  print(`已删除: ${args[0]}`)
                }
              } catch (e: any) {
                print('rm: ' + e.message, 'terminal-error')
              }
            }
            break
          }

          case 'write': {
            if (!args[0]) {
              print('write: 用法: write <文件名> <内容>', 'terminal-error')
            } else {
              try {
                const fileName = args[0]
                const fileContent = args.slice(1).join(' ')
                const path = resolvePath(fileName)
                await fs.writeFile(path.replace(/^\//, ''), fileContent)
                print(`已写入: ${fileName}`)
              } catch (e: any) {
                print('write: ' + e.message, 'terminal-error')
              }
            }
            break
          }

          case 'tree': {
            try {
              print(currentPath === '/' ? '/' : currentPath.split('/').pop() || '/')
              const folder = currentPath === '/' ? null : await fs.getByPath(currentPath.slice(1))
              await printTree(folder?.id || null, '', true)
            } catch (e: any) {
              print('tree: ' + e.message, 'terminal-error')
            }
            break
          }

          default:
            print(`${command}: 命令未找到。输入 'help' 查看可用命令。`, 'terminal-error')
        }
      }

      // 输入按键处理
      input.addEventListener('keydown', async (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          const cmd = input.value
          input.value = ''

          if (cmd.trim()) {
            history.push(cmd)
            historyIndex = history.length
          }

          await executeCommand(cmd)
          input.focus()
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          if (historyIndex > 0) {
            historyIndex--
            input.value = history[historyIndex] || ''
          } else if (historyIndex === 0) {
            input.value = history[0] || ''
          }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault()
          if (historyIndex < history.length - 1) {
            historyIndex++
            input.value = history[historyIndex] || ''
          } else {
            historyIndex = history.length
            input.value = ''
          }
        } else if (e.key === 'Tab') {
          e.preventDefault()
          // Tab 自动补全
          const currentInput = input.value
          if (currentInput) {
            try {
              const parts = currentInput.split(/\s+/)
              const lastPart = parts[parts.length - 1]
              if (parts.length > 1) {
                const folder = currentPath === '/' ? null : await fs.getByPath(currentPath.slice(1))
                const items = await fs.listFiles(folder?.id || null)
                const matches = items.filter(i => i.name.startsWith(lastPart))
                if (matches.length === 1) {
                  parts[parts.length - 1] = matches[0].name
                  input.value = parts.join(' ')
                } else if (matches.length > 1) {
                  print(matches.map(m => m.name).join('  '))
                }
              }
            } catch {
              // 忽略补全错误
            }
          }
        } else if (e.key === 'l' && e.ctrlKey) {
          e.preventDefault()
          output.innerHTML = ''
        }
      })

      // 点击终端区域时聚焦输入框
      content.addEventListener('click', () => input.focus())

      // 右键菜单
      const ctxMenu = new ContextMenu()
      content.addEventListener('contextmenu', (e: MouseEvent) => {
        e.preventDefault()
        ctxMenu.show(e.clientX, e.clientY, [
          {
            label: '复制',
            action: () => {
              document.execCommand('copy')
            }
          },
          {
            label: '粘贴',
            action: async () => {
              try {
                const text = await navigator.clipboard.readText()
                input.value += text
                input.focus()
              } catch {
                document.execCommand('paste')
              }
            }
          },
          { separator: true },
          {
            label: '清屏',
            action: () => {
              output.innerHTML = ''
            }
          }
        ])
      })

      // 欢迎信息
      print('HT OS 终端 v1.0.0')
      print('输入 "help" 查看可用命令')
      print('')

      updatePrompt()
      setTimeout(() => input.focus(), 100)
    }
  })
}
