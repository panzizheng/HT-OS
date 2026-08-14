// ============================================================
// Markdown 应用 - 支持 .md 文件渲染预览与编辑保存
// ============================================================

import { WindowManager } from '../wm/WindowManager'
import { FileSystem } from '../fs/FileSystem'
import { EventBus } from '../kernel/EventBus'
import { dialog } from '../desktop/Dialog'

const APP_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#007aff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v14H4z" stroke="#007aff" stroke-width="1.5"/><path d="M7 15l2-3 2 2 2-4 2 5" fill="none"/></svg>'

const EDIT_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>'
const PREVIEW_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
const SAVE_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>'
const NEW_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>'

/** 判断是否为 Markdown 文件 */
export function isMarkdownFile(name: string): boolean {
  return /\.(md|markdown)$/i.test(name)
}

/** 转义 HTML，防止 XSS */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 行内样式渲染（代码、粗体、斜体、删除线、链接） */
function renderInline(src: string): string {
  let s = escapeHtml(src)
  // 行内代码
  s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
  // 粗体
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  // 删除线
  s = s.replace(/~~([^~\n]+)~~/g, '<del>$1</del>')
  // 链接 [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  // 斜体
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
  return s
}

/** 将 Markdown 文本渲染为 HTML（块级：标题/代码/引用/列表/表格/段落） */
export function renderMarkdown(src: string): string {
  const lines = src.replace(/\r\n/g, '\n').split('\n')
  let html = ''
  let i = 0
  let listType: 'ul' | 'ol' | null = null
  const para: string[] = []

  const flushPara = () => {
    if (para.length > 0) {
      html += `<p>${para.join(' ')}</p>\n`
      para.length = 0
    }
  }
  const closeList = () => {
    if (listType) { html += `</${listType}>\n`; listType = null }
  }

  const parseRow = (l: string): string[] => {
    const parts = l.trim().split('|')
    parts.shift()
    parts.pop()
    return parts.map(c => c.trim())
  }

  while (i < lines.length) {
    const line = lines[i]

    // 围栏代码块
    if (/^\s*```/.test(line)) {
      flushPara(); closeList()
      const code: string[] = []
      i++
      while (i < lines.length && !/^\s*```/.test(lines[i])) { code.push(lines[i]); i++ }
      i++ // 跳过结束标记
      html += `<pre><code>${escapeHtml(code.join('\n'))}</code></pre>\n`
      continue
    }

    // 标题
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      flushPara(); closeList()
      const lvl = h[1].length
      html += `<h${lvl}>${renderInline(h[2])}</h${lvl}>\n`
      i++
      continue
    }

    // 水平线
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushPara(); closeList()
      html += '<hr>\n'
      i++
      continue
    }

    // 表格
    if (/^\s*\|.+\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      flushPara(); closeList()
      const header = parseRow(line)
      i += 2
      let tbl = '<table><thead><tr>' + header.map(c => `<th>${renderInline(c)}</th>`).join('') + '</tr></thead><tbody>'
      while (i < lines.length && /^\s*\|.+\|\s*$/.test(lines[i])) {
        tbl += '<tr>' + parseRow(lines[i]).map(c => `<td>${renderInline(c)}</td>`).join('') + '</tr>'
        i++
      }
      tbl += '</tbody></table>\n'
      html += tbl
      continue
    }

    // 引用
    if (/^\s*>\s?/.test(line)) {
      flushPara(); closeList()
      const quote: string[] = []
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ''))
        i++
      }
      html += `<blockquote>${renderMarkdown(quote.join('\n'))}</blockquote>\n`
      continue
    }

    // 无序列表（含任务列表）
    const ul = line.match(/^\s*[-*+]\s+(.*)$/)
    if (ul) {
      flushPara()
      if (listType !== 'ul') { closeList(); html += '<ul>\n'; listType = 'ul' }
      const task = ul[1].match(/^\[([ xX])\]\s+(.*)$/)
      if (task) {
        const checked = task[1].toLowerCase() === 'x'
        html += `<li class="md-task ${checked ? 'done' : ''}">${checked ? '☑' : '☐'} ${renderInline(task[2])}</li>\n`
      } else {
        html += `<li>${renderInline(ul[1])}</li>\n`
      }
      i++
      continue
    }

    // 有序列表
    const ol = line.match(/^\s*(\d+)\.\s+(.*)$/)
    if (ol) {
      flushPara()
      if (listType !== 'ol') { closeList(); html += '<ol>\n'; listType = 'ol' }
      html += `<li>${renderInline(ol[2])}</li>\n`
      i++
      continue
    }

    // 空行
    if (/^\s*$/.test(line)) { flushPara(); closeList(); i++; continue }

    // 普通段落
    para.push(renderInline(line))
    i++
  }

  flushPara(); closeList()
  return html
}

export function registerMarkdownApp(wm: WindowManager, fs: FileSystem, eventBus: EventBus): void {
  wm.registerApp({
    id: 'markdown',
    name: 'Markdown',
    icon: APP_ICON,
    defaultWidth: 820,
    defaultHeight: 600,
    entry: (windowId: string, filePath?: string, fileName?: string) => {
      const win = wm.getWindow(windowId)
      if (!win) return

      const content = win.content
      content.className = 'markdown-app window-content'

      let currentFileName = fileName || '未命名.md'
      let currentFilePath = filePath || ''
      let isModified = false
      let savedContent = ''
      let viewMode: 'preview' | 'edit' = 'preview'

      content.innerHTML = `
        <div class="md-toolbar">
          <div class="md-file-name" id="md-file-name">${currentFileName}</div>
          <div class="md-actions">
            <button class="md-btn md-btn-primary" id="md-save" title="保存 (Ctrl+S)">${SAVE_ICON}<span>保存</span></button>
            <button class="md-btn" id="md-new" title="新建">${NEW_ICON}<span>新建</span></button>
            <div class="md-divider"></div>
            <button class="md-btn md-toggle ${(viewMode as string) === 'edit' ? 'active' : ''}" id="md-edit" title="编辑">${EDIT_ICON}<span>编辑</span></button>
            <button class="md-btn md-toggle ${(viewMode as string) === 'preview' ? 'active' : ''}" id="md-preview-btn" title="预览">${PREVIEW_ICON}<span>预览</span></button>
          </div>
        </div>
        <div class="md-body">
          <textarea class="md-editor" id="md-editor" placeholder="在此输入 Markdown 内容..." spellcheck="false"></textarea>
          <div class="md-preview" id="md-preview"></div>
        </div>
        <div class="md-statusbar">
          <span id="md-status-cursor">行 1, 列 1</span>
          <span id="md-status-count">0 字符</span>
          <span id="md-status-modified"></span>
        </div>
      `

      const editorEl = content.querySelector('#md-editor') as HTMLTextAreaElement
      const previewEl = content.querySelector('#md-preview') as HTMLElement
      const saveBtn = content.querySelector('#md-save') as HTMLButtonElement
      const newBtn = content.querySelector('#md-new') as HTMLButtonElement
      const editBtn = content.querySelector('#md-edit') as HTMLButtonElement
      const previewToggleBtn = content.querySelector('#md-preview-btn') as HTMLButtonElement
      const fileNameEl = content.querySelector('#md-file-name') as HTMLElement
      const statusCursor = content.querySelector('#md-status-cursor') as HTMLElement
      const statusCount = content.querySelector('#md-status-count') as HTMLElement
      const statusModified = content.querySelector('#md-status-modified') as HTMLElement

      const updateTitle = () => {
        const marker = isModified ? ' *' : ''
        win.setTitle(`${currentFileName}${marker} - Markdown`)
        statusModified.textContent = isModified ? '已修改' : '已保存'
        statusModified.style.color = isModified ? '#e74c3c' : '#27ae60'
      }

      const renderPreview = () => {
        previewEl.innerHTML = `<div class="md-inner">${renderMarkdown(editorEl.value)}</div>`
      }

      const setMode = (mode: 'preview' | 'edit') => {
        viewMode = mode
        editorEl.style.display = mode === 'edit' ? 'block' : 'none'
        previewEl.style.display = mode === 'preview' ? 'block' : 'none'
        editBtn.classList.toggle('active', mode === 'edit')
        previewToggleBtn.classList.toggle('active', mode === 'preview')
        if (mode === 'preview') renderPreview()
        else editorEl.focus()
      }

      const updateCursor = () => {
        const before = editorEl.value.substring(0, editorEl.selectionStart)
        const lines = before.split('\n')
        statusCursor.textContent = `行 ${lines.length}, 列 ${lines[lines.length - 1].length + 1}`
        statusCount.textContent = `${editorEl.value.length} 字符`
      }

      const checkModified = () => {
        isModified = editorEl.value !== savedContent
        updateTitle()
      }

      const loadContent = (text: string) => {
        editorEl.value = text
        savedContent = text
        isModified = false
        updateTitle()
        updateCursor()
        renderPreview()
      }

      // 打开文件：异步读取并渲染
      const openFile = async (path: string) => {
        const clean = path.replace(/^\/+/, '')
        try {
          const text = await fs.readFile('/' + clean)
          if (text !== null) {
            currentFilePath = clean
            currentFileName = clean.split('/').pop() || '未命名.md'
            fileNameEl.textContent = currentFileName
            loadContent(text)
            setMode('preview')
          } else {
            await dialog.alert('无法读取文件内容')
          }
        } catch (e: any) {
          await dialog.alert('打开失败: ' + e.message)
        }
      }

      // 保存文件
      const saveFile = async (): Promise<boolean> => {
        try {
          if (currentFilePath) {
            await fs.writeFile(currentFilePath, editorEl.value)
            savedContent = editorEl.value
            isModified = false
            updateTitle()
            eventBus.emit('fs:changed')
            return true
          } else {
            const name = await dialog.prompt('输入文件名 (例如: 文档.md):', '未命名.md')
            if (name && name.trim()) {
              await fs.writeFile(name.trim().replace(/^\/+/, ''), editorEl.value)
              currentFilePath = name.trim().replace(/^\/+/, '')
              currentFileName = currentFilePath.split('/').pop() || currentFilePath
              fileNameEl.textContent = currentFileName
              savedContent = editorEl.value
              isModified = false
              updateTitle()
              eventBus.emit('fs:changed')
              return true
            }
            return false
          }
        } catch (e: any) {
          await dialog.alert('保存失败: ' + e.message)
          return false
        }
      }

      const newFile = async () => {
        if (isModified && !await dialog.confirm('文件已修改但未保存，是否放弃修改？')) return
        currentFilePath = ''
        currentFileName = '未命名.md'
        fileNameEl.textContent = currentFileName
        loadContent('')
        setMode('edit')
      }

      saveBtn.addEventListener('click', () => saveFile())
      newBtn.addEventListener('click', () => newFile())
      editBtn.addEventListener('click', () => setMode('edit'))
      previewToggleBtn.addEventListener('click', () => setMode('preview'))

      editorEl.addEventListener('input', () => {
        checkModified()
        updateCursor()
      })
      editorEl.addEventListener('click', updateCursor)
      editorEl.addEventListener('keyup', updateCursor)

      editorEl.addEventListener('keydown', async (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
          e.preventDefault()
          await saveFile()
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
          e.preventDefault()
          setMode(viewMode === 'edit' ? 'preview' : 'edit')
        }
      })

      // 初始化
      updateTitle()
      updateCursor()
      if (currentFilePath) {
        openFile(currentFilePath)
      } else {
        loadContent('')
        setMode('edit')
      }
    }
  })
}
