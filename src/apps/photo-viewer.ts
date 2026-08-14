// ============================================================
// 照片查看器 - iPad OS 照片应用风格
// 网格缩略图视图 + 全屏大图浏览，支持前后翻页、方向键
// ============================================================

import { WindowManager } from '../wm/WindowManager'
import { FileSystem } from '../fs/FileSystem'
import { EventBus } from '../kernel/EventBus'

const APP_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#4cd964" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>'

const PREV_ICON = '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>'
const NEXT_ICON = '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>'
const GRID_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>'
const FIT_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>'
const EMPTY_ICON = '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>'

const IMAGE_EXTS = /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/i

interface Photo {
  name: string
  url: string
  path: string
}

export function registerPhotoViewerApp(wm: WindowManager, fs: FileSystem, eventBus: EventBus): void {
  wm.registerApp({
    id: 'photo-viewer',
    name: '照片',
    icon: APP_ICON,
    defaultWidth: 900,
    defaultHeight: 640,
    entry: (windowId: string, filePath?: string, folderPath?: string) => {
      const win = wm.getWindow(windowId)
      if (!win) return

      const content = win.content
      content.className = 'photo-viewer window-content'

      let photos: Photo[] = []
      let currentIndex = -1
      let fitMode = true // true=适应窗口, false=实际大小
      let folder = (folderPath || (filePath ? filePath.split('/').slice(0, -1).join('/') : '') || 'Users/Admin/Pictures')

      const previewUrl = (p: string): string =>
        `/api/fs/preview?path=${encodeURIComponent('/' + p.replace(/^\/+/, ''))}`

      content.innerHTML = `
        <div class="pv-container">
          <div class="pv-topbar">
            <div class="pv-topbar-title" id="pv-title">照片</div>
            <div class="pv-topbar-count" id="pv-count"></div>
          </div>

          <div class="pv-grid-wrap">
            <div class="pv-grid" id="pv-grid"></div>
            <div class="pv-empty" id="pv-empty">
              <div class="pv-empty-icon">${EMPTY_ICON}</div>
              <div class="pv-empty-text">此文件夹没有图片</div>
              <div class="pv-empty-hint">点击右上角按钮通过文件管理器上传图片</div>
            </div>
          </div>

          <div class="pv-viewer" id="pv-viewer" style="display:none">
            <div class="pv-viewer-stage" id="pv-viewer-stage">
              <img class="pv-viewer-img" id="pv-viewer-img" alt="" draggable="false">
              <button class="pv-nav pv-nav-prev" id="pv-prev">${PREV_ICON}</button>
              <button class="pv-nav pv-nav-next" id="pv-next">${NEXT_ICON}</button>
            </div>
            <div class="pv-viewer-toolbar">
              <button class="pv-tool-btn" id="pv-grid-back" title="返回照片网格">${GRID_ICON}<span>照片</span></button>
              <div class="pv-viewer-name" id="pv-viewer-name"></div>
              <button class="pv-tool-btn" id="pv-fit" title="适应窗口 / 实际大小">${FIT_ICON}<span>缩放</span></button>
            </div>
          </div>
        </div>
      `

      const gridWrapEl = content.querySelector('.pv-grid-wrap') as HTMLElement
      const gridEl = content.querySelector('#pv-grid') as HTMLElement
      const emptyEl = content.querySelector('#pv-empty') as HTMLElement
      const viewerEl = content.querySelector('#pv-viewer') as HTMLElement
      const imageEl = content.querySelector('#pv-viewer-img') as HTMLImageElement
      const prevBtn = content.querySelector('#pv-prev') as HTMLButtonElement
      const nextBtn = content.querySelector('#pv-next') as HTMLButtonElement
      const titleEl = content.querySelector('#pv-title') as HTMLElement
      const countEl = content.querySelector('#pv-count') as HTMLElement
      const viewerNameEl = content.querySelector('#pv-viewer-name') as HTMLElement
      const gridBackBtn = content.querySelector('#pv-grid-back') as HTMLButtonElement
      const fitBtn = content.querySelector('#pv-fit') as HTMLButtonElement

      const loadFolderImages = async (folderPath: string): Promise<void> => {
        folder = folderPath.replace(/^\/+/, '') || 'Users/Admin/Pictures'
        try {
          const items = await fs.listFiles(folder)
          const imgs = items.filter(i =>
            i.type === 'file' && i.name.match(IMAGE_EXTS)
          )
          photos = imgs.map(i => {
            const path = (folder === '' ? '' : folder + '/') + i.name
            return { name: i.name, url: previewUrl(path), path }
          })
          renderGrid()
          if (photos.length === 0) {
            currentIndex = -1
            emptyEl.style.display = 'flex'
            titleEl.textContent = '照片'
            countEl.textContent = ''
            win.setTitle('照片')
          } else {
            emptyEl.style.display = 'none'
            titleEl.textContent = '照片'
            countEl.textContent = `${photos.length} 张`
            win.setTitle(`照片 · ${photos.length} 张`)
          }
        } catch (e) {
          photos = []
          renderGrid()
          emptyEl.style.display = 'flex'
          titleEl.textContent = '照片'
          countEl.textContent = ''
        }
      }

      const renderGrid = () => {
        gridEl.innerHTML = ''
        photos.forEach((p, i) => {
          const cell = document.createElement('div')
          cell.className = 'pv-grid-cell'
          cell.title = p.name
          cell.innerHTML = `<img src="${p.url}" alt="" loading="lazy">`
          cell.addEventListener('click', () => openViewer(i))
          gridEl.appendChild(cell)
        })
      }

      const openViewer = (index: number) => {
        if (index < 0 || index >= photos.length) return
        gridWrapEl.style.display = 'none'
        viewerEl.style.display = 'flex'
        showPhoto(index)
      }

      const closeViewer = () => {
        viewerEl.style.display = 'none'
        gridWrapEl.style.display = 'flex'
      }

      const showPhoto = (index: number) => {
        if (index < 0 || index >= photos.length) return
        currentIndex = index
        const photo = photos[index]
        imageEl.src = photo.url
        imageEl.alt = photo.name
        viewerNameEl.textContent = `${photo.name}  ·  ${index + 1} / ${photos.length}`
        win.setTitle(photo.name)
        prevBtn.style.display = index > 0 ? 'flex' : 'none'
        nextBtn.style.display = index < photos.length - 1 ? 'flex' : 'none'
        applyFit()
      }

      const applyFit = () => {
        if (fitMode) {
          imageEl.style.maxWidth = '100%'
          imageEl.style.maxHeight = '100%'
          imageEl.style.width = 'auto'
          imageEl.style.height = 'auto'
        } else {
          imageEl.style.maxWidth = 'none'
          imageEl.style.maxHeight = 'none'
          imageEl.style.width = 'auto'
          imageEl.style.height = 'auto'
        }
      }

      prevBtn.addEventListener('click', () => showPhoto(currentIndex - 1))
      nextBtn.addEventListener('click', () => showPhoto(currentIndex + 1))
      gridBackBtn.addEventListener('click', closeViewer)
      fitBtn.addEventListener('click', () => {
        fitMode = !fitMode
        applyFit()
      })

      content.addEventListener('keydown', (e: KeyboardEvent) => {
        if (viewerEl.style.display === 'none') return
        if (e.key === 'ArrowLeft') showPhoto(currentIndex - 1)
        else if (e.key === 'ArrowRight') showPhoto(currentIndex + 1)
        else if (e.key === 'Escape') closeViewer()
      })

      // 打开指定图片（优先）；否则展示文件夹相册
      if (filePath) {
        const cleanPath = filePath.replace(/^\/+/, '')
        const startFolder = folderPath
          ? String(folderPath).replace(/^\/+/, '')
          : cleanPath.split('/').slice(0, -1).join('/')
        folder = startFolder
        loadFolderImages(startFolder).then(() => {
          const idx = photos.findIndex(p => p.path === cleanPath)
          if (idx >= 0) openViewer(idx)
          else if (photos.length > 0) openViewer(0)
        })
      } else {
        loadFolderImages(folder)
      }
    }
  })
}
