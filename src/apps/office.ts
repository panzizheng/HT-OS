import { WindowManager } from '../wm/WindowManager'
import { FileSystem } from '../fs/FileSystem'
import { EventBus } from '../kernel/EventBus'
import { dialog } from '../desktop/Dialog'

const APP_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="14" x2="15" y2="14"/><line x1="9" y1="17" x2="13" y2="17"/></svg>'

const DOWNLOAD_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'
const ONLINE_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>'
const CLOSE_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'

const FILE_TYPES: Record<string, { color: string; label: string; desc: string }> = {
  pdf: { color: '#d93025', label: 'PDF', desc: 'PDF 文档' },
  doc: { color: '#2b579a', label: 'DOC', desc: 'Word 文档' },
  docx: { color: '#2b579a', label: 'DOC', desc: 'Word 文档' },
  xls: { color: '#217346', label: 'XLS', desc: 'Excel 表格' },
  xlsx: { color: '#217346', label: 'XLS', desc: 'Excel 表格' },
  ppt: { color: '#d24726', label: 'PPT', desc: 'PowerPoint 演示文稿' },
  pptx: { color: '#d24726', label: 'PPT', desc: 'PowerPoint 演示文稿' }
}

function getExt(name: string): string {
  return name.split('.').pop()?.toLowerCase() || ''
}

export function isOfficeFile(fileName: string): boolean {
  return getExt(fileName) in FILE_TYPES
}

export function officeFileIcon(fileName: string): string {
  const ext = getExt(fileName)
  const info = FILE_TYPES[ext]
  if (!info) {
    return `<svg viewBox="0 0 48 48" width="40" height="40"><path d="M10 4 h20 l10 10 v28 a2 2 0 0 1-2 2 H10 a2 2 0 0 1-2-2 V6 a2 2 0 0 1 2-2 z" fill="#ffffff" stroke="#bbbbbb" stroke-width="1"/><path d="M30 4 v8 a2 2 0 0 0 2 2 h8 z" fill="#dddddd"/></svg>`
  }
  return `<svg viewBox="0 0 48 48" width="40" height="40"><path d="M10 4 h20 l10 10 v28 a2 2 0 0 1-2 2 H10 a2 2 0 0 1-2-2 V6 a2 2 0 0 1 2-2 z" fill="#ffffff" stroke="#bbbbbb" stroke-width="1"/><path d="M30 4 v8 a2 2 0 0 0 2 2 h8 z" fill="#dddddd"/><rect x="8" y="26" width="32" height="14" fill="${info.color}"/><text x="24" y="36" font-size="9" font-weight="bold" fill="white" text-anchor="middle" font-family="Segoe UI,Arial">${info.label}</text></svg>`
}

export function registerOfficeApp(wm: WindowManager, fs: FileSystem, eventBus: EventBus): void {
  wm.registerApp({
    id: 'office',
    name: 'HT 办公',
    icon: APP_ICON,
    defaultWidth: 960,
    defaultHeight: 680,
    entry: (windowId: string, fileId?: string, fileName?: string, _fileContent?: string, filePath?: string) => {
      const win = wm.getWindow(windowId)
      if (!win) return

      const content = win.content
      content.className = 'office-app window-content'

      let currentFileName = fileName || '未命名'
      let currentFilePath = filePath || ''

      const ext = getExt(currentFileName)
      const typeInfo = FILE_TYPES[ext]

      const updateTitle = () => {
        win.setTitle(`${currentFileName} - HT 办公`)
      }

      const getDownloadUrl = (): string => {
        const p = currentFilePath.startsWith('/') ? currentFilePath.slice(1) : currentFilePath
        return `/api/fs/download?path=${encodeURIComponent('/' + p)}`
      }

      const getPreviewUrl = (): string => {
        const p = currentFilePath.startsWith('/') ? currentFilePath.slice(1) : currentFilePath
        return `/api/fs/preview?path=${encodeURIComponent('/' + p)}`
      }

      const formatSize = async (): Promise<string> => {
        try {
          if (currentFilePath) {
            const item = await (fs as any).getItem('/' + (currentFilePath.startsWith('/') ? currentFilePath.slice(1) : currentFilePath))
            if (item && typeof item.size === 'number') {
              if (item.size < 1024) return `${item.size} B`
              if (item.size < 1024 * 1024) return `${(item.size / 1024).toFixed(1)} KB`
              return `${(item.size / 1024 / 1024).toFixed(2)} MB`
            }
          }
        } catch { /* 忽略 */ }
        return '未知'
      }

      const render = async () => {
        updateTitle()

        if (!typeInfo) {
          content.innerHTML = `
            <div class="office-container">
              <div class="office-empty">
                <div class="office-empty-icon">
                  <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="14" x2="15" y2="14"/><line x1="9" y1="17" x2="13" y2="17"/></svg>
                </div>
                <div class="office-empty-title">HT 办公</div>
                <div class="office-empty-desc">支持打开 PDF、Word、Excel、PowerPoint 文档</div>
                <div class="office-empty-hint">请从文件管理器或桌面双击办公文件打开</div>
                <div class="office-empty-features">
                  <div class="office-feature-item">
                    <div class="office-feature-icon" style="background: linear-gradient(135deg, #d93025, #ea4335)">PDF</div>
                    <span>PDF 文档</span>
                  </div>
                  <div class="office-feature-item">
                    <div class="office-feature-icon" style="background: linear-gradient(135deg, #2b579a, #4179c4)">DOC</div>
                    <span>Word 文档</span>
                  </div>
                  <div class="office-feature-item">
                    <div class="office-feature-icon" style="background: linear-gradient(135deg, #217346, #2ea366)">XLS</div>
                    <span>Excel 表格</span>
                  </div>
                  <div class="office-feature-item">
                    <div class="office-feature-icon" style="background: linear-gradient(135deg, #d24726, #e85d3d)">PPT</div>
                    <span>演示文稿</span>
                  </div>
                </div>
              </div>
            </div>
          `
          return
        }

        const sizeText = await formatSize()

        content.innerHTML = `
          <div class="office-container">
            <div class="office-toolbar">
              <div class="office-toolbar-content">
                <div class="office-file-info">
                  <div class="office-file-badge" style="background: linear-gradient(135deg, ${typeInfo.color}, ${typeInfo.color}dd)">${typeInfo.label}</div>
                  <div class="office-file-meta">
                    <div class="office-file-name" title="${currentFileName}">${currentFileName}</div>
                    <div class="office-file-type">
                      <span class="office-type-dot" style="background:${typeInfo.color}"></span>
                      ${typeInfo.desc} · ${sizeText}
                    </div>
                  </div>
                </div>
                <div class="office-actions">
                  <button class="office-btn office-btn-secondary" id="office-online" title="使用 Microsoft Office Online 预览（需联网）">
                    ${ONLINE_ICON}
                    <span>在线预览</span>
                  </button>
                  <button class="office-btn office-btn-primary" id="office-download" title="下载到本地">
                    ${DOWNLOAD_ICON}
                    <span>下载</span>
                  </button>
                </div>
              </div>
            </div>
            <div class="office-viewer" id="office-viewer"></div>
          </div>
        `

        const viewer = content.querySelector('#office-viewer') as HTMLElement
        const downloadBtn = content.querySelector('#office-download') as HTMLButtonElement
        const onlineBtn = content.querySelector('#office-online') as HTMLButtonElement

        if (ext === 'pdf') {
          viewer.innerHTML = `<iframe class="office-iframe" src="${getPreviewUrl()}" title="PDF 预览"></iframe>`
          onlineBtn.style.display = 'none'
        } else {
          viewer.innerHTML = `
            <div class="office-placeholder">
              <div class="office-placeholder-icon" style="background: linear-gradient(135deg, ${typeInfo.color}, ${typeInfo.color}cc)">${typeInfo.label}</div>
              <div class="office-placeholder-title">${typeInfo.desc}</div>
              <div class="office-placeholder-desc">浏览器无法直接渲染 ${typeInfo.label} 格式文件</div>
              <div class="office-placeholder-actions">
                <div class="office-placeholder-tip">
                  <div class="office-tip-item">
                    <span class="office-tip-icon">📥</span>
                    <span>点击"下载"保存到本地后用 Office 软件打开</span>
                  </div>
                  <div class="office-tip-item">
                    <span class="office-tip-icon">🌐</span>
                    <span>或点击"在线预览"使用 Microsoft Office Online 查看</span>
                  </div>
                </div>
              </div>
            </div>
          `
        }

        downloadBtn.addEventListener('click', async () => {
          try {
            const downloadUrl = getDownloadUrl()
            const response = await fetch(downloadUrl)
            if (!response.ok) throw new Error('下载失败')

            const blob = await response.blob()

            try {
              const file = new File([blob], currentFileName, { type: blob.type })
              await (fs as any).uploadFile(file, 'Users/Admin/Downloads')
              eventBus.emit('fs:changed')
            } catch { /* 忽略保存到虚拟文件系统的错误 */ }

            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = currentFileName
            document.body.appendChild(a)
            a.click()
            a.remove()
            setTimeout(() => URL.revokeObjectURL(url), 1000)
          } catch (e: any) {
            await dialog.alert('下载失败: ' + e.message)
          }
        })

        onlineBtn.addEventListener('click', async () => {
          await dialog.alert(
            '在线预览说明\n\n' +
            'Microsoft Office Online 需要文件可通过公网 URL 访问。\n' +
            '本系统的文件存储在本地服务器，无法直接在线预览。\n\n' +
            '请先点击 "下载" 将文件保存到本地，然后访问:\n' +
            'https://view.officeapps.live.com/op/embed.aspx?src=<文件公网URL>\n\n' +
            '上传文件后即可在线查看。'
          )
        })
      }

      render()
    }
  })
}
