import { WindowManager } from '../../wm/WindowManager'
import { FileSystem } from '../../fs/FileSystem'
import { dialog } from '../../desktop/Dialog'
import type { EPPFile } from './types'

const APP_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>'

/**
 * EPP Runner - 用于显示通过 createWindow 创建的程序窗口
 * 当编译器中调用 createWindow/openWindow 时，会通过 wm.openApp('epp-runner', ...) 打开此窗口
 * runner 窗口只负责显示内容，不再自己执行代码
 *
 * [SYNC] API 实现 — 与 compiler.ts createRuntimeAPI / epp_compiler.py RUNNER_SCRIPT 保持同步
 * 所有 44 个 API 必须保持一致
 */
export function registerEPPRunnerApp(wm: WindowManager, fs: FileSystem): void {
  wm.registerApp({
    id: 'epp-runner',
    name: 'EPP 运行器',
    icon: APP_ICON,
    defaultWidth: 600,
    defaultHeight: 400,
    entry: (windowId: string, eppFile?: EPPFile) => {
      const win = wm.getWindow(windowId)
      if (!win) return

      const content = win.content
      content.className = 'epp-runner window-content'

      // 判断是独立运行（双击 .epp）还是被 createWindow 调用
      // 如果有 eppFile 且包含实际代码 → 独立控制台模式
      // 如果 eppFile 的 code 为空 → GUI 窗口模式（由 createWindow 创建）
      let isConsoleMode = true
      if (eppFile) {
        try {
          const decoded = JSON.parse(decodeURIComponent(atob(eppFile.bytecode)))
          if (!decoded.code || !decoded.code.trim()) {
            isConsoleMode = false
          }
        } catch {
          isConsoleMode = false
        }
      }

      if (isConsoleMode) {
        // 控制台模式：深色背景，等宽字体
        content.innerHTML = '<div class="epp-runner-content epp-runner-console" id="epp-content"></div>'
      } else {
        // GUI 窗口模式：白色背景，普通字体
        content.innerHTML = '<div class="epp-runner-content epp-runner-gui" id="epp-content"></div>'
      }

      // 如果有 eppFile 且包含代码，执行代码（用于双击 .epp 文件直接运行）
      if (eppFile) {
        // 不用 manifest.name 做标题，让代码中的 setWindowTitle 控制
        win.setTitle('EPP 程序')
        try {
          const decoded = JSON.parse(decodeURIComponent(atob(eppFile.bytecode)))
          if (decoded.code && decoded.code.trim()) {
            const container = content.querySelector('#epp-content') as HTMLElement
            runStandaloneCode(decoded.code, container, wm, win, fs)
          }
        } catch {
          // 忽略解码错误，窗口保持空白
        }
      }
    }
  })
}

/**
 * 独立运行模式：双击 .epp 文件时执行
 * 创建控制台输出 + 窗口 API
 */
function runStandaloneCode(
  code: string,
  container: HTMLElement,
  wm: WindowManager,
  win: { setTitle: (t: string) => void; close: () => void; minimize: () => void; toggleMaximize: () => void; maximized: boolean; width: number; height: number; x: number; y: number; element: HTMLElement; onClose: (cb: () => void) => void; content: HTMLElement; updateSize: () => void; updatePosition: () => void },
  fs: FileSystem
): void {
  let activeWindowId: string | null = null
  let activeWindowContent: HTMLElement | null = container
  const timers: number[] = []

  const api = {
    print: (text: string) => {
      const el = document.createElement('div')
      el.textContent = text
      container.appendChild(el)
    },
    println: (text: string) => {
      const el = document.createElement('div')
      el.textContent = text
      container.appendChild(el)
    },
    readLine: async (prompt?: string) => {
      if (prompt) {
        const p = document.createElement('div')
        p.textContent = prompt
        container.appendChild(p)
      }
      return new Promise<string>(resolve => {
        const input = document.createElement('input')
        input.className = 'epp-input-line'
        input.autofocus = true
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            const value = input.value
            input.remove()
            const echo = document.createElement('div')
            echo.textContent = value
            container.appendChild(echo)
            resolve(value)
          }
        })
        container.appendChild(input)
        setTimeout(() => input.focus(), 0)
      })
    },
    showMessage: (title: string, message: string) => dialog.alert(message, title),
    showConfirm: (title: string, message: string) => dialog.confirm(message, title),
    showPrompt: (title: string, message: string, defaultValue?: string) => dialog.prompt(message, defaultValue, title),
    showOpenDialog: async (options?: { title?: string; filters?: string[]; defaultPath?: string }) => {
      return dialog.showOpenDialog(fs, options)
    },
    showSaveDialog: async (options?: { title?: string; filters?: string[]; defaultPath?: string; defaultName?: string }) => {
      return dialog.showSaveDialog(fs, options)
    },
    showFolderDialog: async (options?: { title?: string; defaultPath?: string }) => {
      return dialog.showFolderDialog(fs, options)
    },
    createWindow: (options: { title?: string; width?: number; height?: number }) => {
      // 复用当前 epp-runner 窗口，从控制台模式切换为 GUI 模式
      win.setTitle(options.title || 'EPP 窗口')
      // 应用传入的窗口大小
      if (options.width) {
        win.width = options.width
      }
      if (options.height) {
        win.height = options.height
      }
      if (options.width || options.height) {
        win.updateSize()
      }
      container.className = 'epp-runner-content epp-runner-gui'
      container.innerHTML = ''
      activeWindowContent = container
      activeWindowId = null
      return 'current'
    },
    openWindow: (options: { title?: string; width?: number; height?: number; content?: string }) => {
      // 复用当前 epp-runner 窗口
      win.setTitle(options.title || 'EPP 窗口')
      container.className = 'epp-runner-content epp-runner-gui'
      container.innerHTML = options.content || ''
      // 重新执行脚本标签
      if (options.content) {
        container.querySelectorAll('script').forEach(oldScript => {
          const newScript = document.createElement('script')
          // 复制所有属性（保留 type、data-* 等自定义属性）
          for (let i = 0; i < oldScript.attributes.length; i++) {
            const attr = oldScript.attributes[i]
            newScript.setAttribute(attr.name, attr.value)
          }
          if (oldScript.src) {
            newScript.src = oldScript.src
          } else {
            newScript.textContent = oldScript.textContent
          }
          oldScript.parentNode?.replaceChild(newScript, oldScript)
        })
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
          document.dispatchEvent(new Event('DOMContentLoaded'))
        }
      }
      activeWindowContent = container
      activeWindowId = null
      return 'current'
    },
    closeWindow: (wid?: string) => {
      if (wid && wid !== 'current') {
        wm.getWindow(wid)?.close()
      } else if (activeWindowId) {
        wm.getWindow(activeWindowId)?.close()
      } else {
        win.close()
      }
    },
    setWindowTitle: (title: string) => {
      if (activeWindowId) {
        wm.getWindow(activeWindowId)?.setTitle(title)
      } else {
        win.setTitle(title)
      }
    },
    setWindowContent: (html: string) => {
      if (activeWindowContent) {
        // 设置 HTML 内容（innerHTML 不会执行 <script> 标签）
        activeWindowContent.innerHTML = html
        // 重新执行所有 <script> 标签：创建新 script 元素替换旧元素
        activeWindowContent.querySelectorAll('script').forEach(oldScript => {
          const newScript = document.createElement('script')
          // 复制所有属性（保留 type、data-* 等自定义属性）
          for (let i = 0; i < oldScript.attributes.length; i++) {
            const attr = oldScript.attributes[i]
            newScript.setAttribute(attr.name, attr.value)
          }
          if (oldScript.src) {
            newScript.src = oldScript.src
          } else {
            newScript.textContent = oldScript.textContent
          }
          oldScript.parentNode?.replaceChild(newScript, oldScript)
        })
        // 触发 DOMContentLoaded 事件（页面已加载完成，但脚本刚注入）
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
          document.dispatchEvent(new Event('DOMContentLoaded'))
        }
      }
    },
    setWindowSize: (width: number, height: number) => {
      win.width = width
      win.height = height
      win.updateSize()
    },
    getWindowSize: () => {
      return { width: win.width, height: win.height }
    },
    centerWindow: () => {
      win.x = (window.innerWidth - win.width) / 2
      win.y = (window.innerHeight - win.height) / 2
      win.element.style.left = win.x + 'px'
      win.element.style.top = win.y + 'px'
    },
    minimizeWindow: () => {
      win.minimize()
    },
    maximizeWindow: () => {
      win.toggleMaximize()
    },
    isWindowMaximized: () => {
      return win.maximized
    },
    onWindowClose: (callback: () => void) => {
      win.onClose(callback)
    },
    getElementById: (id: string) => {
      const c = activeWindowContent || container
      return c.querySelector(`#${id}`) as HTMLElement | null
    },
    createElement: (tag: string, options?: { id?: string; className?: string; text?: string; html?: string; style?: Record<string, string> }) => {
      const el = document.createElement(tag)
      if (options?.id) el.id = options.id
      if (options?.className) el.className = options.className
      if (options?.text) el.textContent = options.text
      if (options?.html) el.innerHTML = options.html
      if (options?.style) {
        for (const [k, v] of Object.entries(options.style)) {
          (el.style as any)[k] = v
        }
      }
      return el
    },
    appendElement: (element: HTMLElement) => {
      const c = activeWindowContent || container
      c.appendChild(element)
    },
    onEvent: (element: HTMLElement, event: string, callback: (e: Event) => void) => {
      element.addEventListener(event, callback as EventListener)
    },
    readFile: async (path: string) => {
      try {
        const fileItem = await fs.getByPath(path)
        if (!fileItem || fileItem.type !== 'file') return ''
        const content = await fs.readFile(fileItem.id)
        return content || ''
      } catch {
        return ''
      }
    },
    writeFile: async (path: string, fileContent: string) => {
      await fs.writeFile(path, fileContent)
    },
    listFiles: async (path?: string) => {
      try {
        const cleanPath = (path || '/').replace(/^\//, '')
        if (cleanPath === '') {
          const items = await fs.listFiles(null)
          return items.map(i => i.name)
        }
        const dirItem = await fs.getByPath(cleanPath)
        if (!dirItem) return []
        const items = await fs.listFiles(dirItem.id)
        return items.map(i => i.name)
      } catch {
        return []
      }
    },
    createDirectory: async (path: string) => {
      const parts = path.split('/').filter(Boolean)
      const folderName = parts.pop() || ''
      const parentPath = '/' + parts.join('/')
      const parent = await fs.getByPath(parentPath)
      if (!parent || parent.type !== 'folder') throw new Error('父目录不存在')
      await fs.createFolder(folderName, parent.id)
    },
    deleteFile: async (path: string) => {
      const fileItem = await fs.getByPath(path)
      if (!fileItem) throw new Error('文件不存在')
      await fs.deleteItem(fileItem.id)
    },
    fileExists: async (path: string) => {
      const item = await fs.getByPath(path)
      return !!item
    },
    copyFile: async (source: string, destination: string) => {
      const srcItem = await fs.getByPath(source)
      if (!srcItem || srcItem.type !== 'file') throw new Error('源文件不存在')
      const content = await fs.readFile(srcItem.id)
      await fs.writeFile(destination, content || '')
    },
    moveFile: async (source: string, destination: string) => {
      const srcItem = await fs.getByPath(source)
      if (!srcItem) throw new Error('源文件不存在')
      const content = srcItem.type === 'file' ? await fs.readFile(srcItem.id) : ''
      await fs.writeFile(destination, content || '')
      await fs.deleteItem(srcItem.id)
    },
    setTimeout: (callback: () => void, ms: number) => {
      const id = window.setTimeout(callback, ms)
      timers.push(id)
      return id
    },
    setInterval: (callback: () => void, ms: number) => {
      const id = window.setInterval(callback, ms)
      timers.push(id)
      return id
    },
    clearTimeout: (id: number) => {
      window.clearTimeout(id)
      const idx = timers.indexOf(id)
      if (idx >= 0) timers.splice(idx, 1)
    },
    clearInterval: (id: number) => {
      window.clearInterval(id)
      const idx = timers.indexOf(id)
      if (idx >= 0) timers.splice(idx, 1)
    },
    httpRequest: async (url: string, options?: { method?: string; headers?: Record<string, string>; body?: string }) => {
      const response = await fetch(url, {
        method: options?.method || 'GET',
        headers: options?.headers || {},
        body: options?.body
      })
      const data = await response.text()
      return { status: response.status, data, ok: response.ok }
    },
    clipboardWrite: (text: string) => {
      navigator.clipboard?.writeText(text)
    },
    clipboardRead: () => {
      const ta = document.createElement('textarea')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      try { document.execCommand('paste'); } catch { /* */ }
      const text = ta.value
      ta.remove()
      return text
    },
    getEnv: (name: string) => localStorage.getItem(`ht-os-env-${name}`) || undefined,
    setEnv: (name: string, value: string) => localStorage.setItem(`ht-os-env-${name}`, value),
    getTimestamp: () => Date.now(),
    formatDate: (format: string, timestamp?: number) => {
      const d = new Date(timestamp || Date.now())
      const map: Record<string, string> = {
        'YYYY': String(d.getFullYear()),
        'MM': String(d.getMonth() + 1).padStart(2, '0'),
        'DD': String(d.getDate()).padStart(2, '0'),
        'HH': String(d.getHours()).padStart(2, '0'),
        'mm': String(d.getMinutes()).padStart(2, '0'),
        'ss': String(d.getSeconds()).padStart(2, '0'),
      }
      let result = format
      for (const [k, v] of Object.entries(map)) {
        result = result.replace(k, v)
      }
      return result
    },
    random: (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min,
    getScreenWidth: () => window.innerWidth,
    getScreenHeight: () => window.innerHeight
  }

  try {
    const wrapped = `
      "use strict";
      const { print, println, readLine, showMessage, showConfirm, showPrompt, showOpenDialog, showSaveDialog, showFolderDialog, createWindow, openWindow, closeWindow, setWindowTitle, setWindowContent, setWindowSize, getWindowSize, centerWindow, minimizeWindow, maximizeWindow, isWindowMaximized, onWindowClose, getElementById, createElement, appendElement, onEvent, readFile, writeFile, listFiles, createDirectory, deleteFile, fileExists, copyFile, moveFile, setTimeout, setInterval, clearTimeout, clearInterval, httpRequest, clipboardWrite, clipboardRead, getEnv, setEnv, getTimestamp, formatDate, random, getScreenWidth, getScreenHeight } = this;
      return (async function() {
        ${code}
      })();
    `
    new Function(wrapped).call(api)
  } catch (e) {
    const errDiv = document.createElement('div')
    errDiv.style.color = '#f87171'
    errDiv.textContent = `运行时错误: ${(e as Error).message}`
    container.appendChild(errDiv)
  }
}

/**
 * 从文件系统运行 .epp 可执行文件
 */
export function runEPPFromFile(wm: WindowManager, fs: FileSystem, filePath: string): void {
  fs.getByPath(filePath).then(fileItem => {
    if (!fileItem || fileItem.type !== 'file') {
      dialog.alert('文件不存在', '错误')
      return
    }
    fs.readFile(fileItem.id).then(data => {
      if (!data) {
        dialog.alert('文件内容为空', '错误')
        return
      }
      try {
        const eppFile = JSON.parse(data) as EPPFile
        wm.openApp('epp-runner', eppFile)
      } catch (e) {
        dialog.alert(`无法加载 EPP 文件: ${(e as Error).message}`, '错误')
      }
    }).catch(e => {
      dialog.alert(`读取文件失败: ${(e as Error).message}`, '错误')
    })
  }).catch(e => {
    dialog.alert(`查找文件失败: ${(e as Error).message}`, '错误')
  })
}
