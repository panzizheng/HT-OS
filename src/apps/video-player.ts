// ============================================================
// 视频播放器应用 - iPad OS / macOS 风格毛玻璃设计
// 支持上传、播放/暂停、进度拖动、音量、播放速度、全屏播放
// ============================================================

import { WindowManager } from '../wm/WindowManager'
import { FileSystem } from '../fs/FileSystem'
import { EventBus } from '../kernel/EventBus'
import { ContextMenu } from '../desktop/ContextMenu'
import { showOpenFileDialog } from '../desktop/FileDialog'
import { VIDEO_PLAYER_ICON } from './system-icons'

// 视频播放器图标（来自 public/assets/视频.svg）
const APP_ICON = VIDEO_PLAYER_ICON

const PLAY_ICON = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>'
const PAUSE_ICON = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>'
const STOP_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>'
const FULLSCREEN_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3 H4 a1 1 0 0 0-1 1 v4 M16 3 h4 a1 1 0 0 1 1 1 v4 M8 21 H4 a1 1 0 0 1-1-1 v-4 M16 21 h4 a1 1 0 0 0 1-1 v-4"/></svg>'
const UPLOAD_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'
const VOLUME_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46 a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93 a10 10 0 0 1 0 14.14"/></svg>'
const VOLUME_MUTE_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>'

interface VideoItem {
  name: string
  url: string
  size: number
}

const VIDEO_EXTS = /\.(mp4|webm|ogg|mov|avi|mkv|m4v|flv|wmv)$/i

const previewUrl = (p: string): string =>
  `/api/fs/preview?path=${encodeURIComponent('/' + p.replace(/^\/+/, ''))}`

export function registerVideoPlayerApp(wm: WindowManager, fs: FileSystem, eventBus: EventBus): void {
  wm.registerApp({
    id: 'video-player',
    name: '视频',
    icon: APP_ICON,
    singleton: true,
    defaultWidth: 880,
    defaultHeight: 620,
    entry: (windowId: string, filePath?: string) => {
      const win = wm.getWindow(windowId)
      if (!win) return

      const content = win.content
      content.className = 'video-player-app window-content'

      let playlist: VideoItem[] = []
      let currentIndex = -1
      let isPlaying = false
      let isMuted = false

      const video = document.createElement('video')

      content.innerHTML = `
        <div class="vp-container">
          <div class="vp-header">
            <div class="vp-app-title">视频</div>
            <button class="vp-upload-btn" id="vp-upload">${UPLOAD_ICON}</button>
          </div>
          
          <div class="vp-stage" id="vp-stage">
            <div class="vp-empty" id="vp-empty">
              <div class="vp-empty-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"><rect x="2" y="5" width="15" height="14" rx="2"/><path d="M17 9 l5-3 v12 l-5-3 z"/></svg>
              </div>
              <div class="vp-empty-text">点击右上角按钮从文件管理器添加视频</div>
            </div>
          </div>
          
          <div class="vp-controls" id="vp-controls" style="display:none">
            <div class="vp-progress-section">
              <input type="range" id="vp-progress-bar" min="0" max="100" value="0" step="0.1" class="vp-progress-bar">
              <div class="vp-progress-fill" id="vp-progress-fill"></div>
              <div class="vp-progress-thumb" id="vp-progress-thumb"></div>
            </div>
            <div class="vp-time-display">
              <span id="vp-current-time">00:00</span>
              <span id="vp-total-time">00:00</span>
            </div>
            
            <div class="vp-buttons">
              <button class="vp-btn vp-play-btn" id="vp-play" title="播放/暂停">${PLAY_ICON}</button>
              <button class="vp-btn" id="vp-stop" title="停止">${STOP_ICON}</button>
              
              <div class="vp-divider"></div>
              
              <div class="vp-volume-section">
                <button class="vp-btn vp-vol-btn" id="vp-vol-btn">${VOLUME_ICON}</button>
                <input type="range" id="vp-volume" min="0" max="100" value="80" class="vp-volume-slider">
              </div>
              
              <div class="vp-divider"></div>
              
              <div class="vp-speed-section">
                <select id="vp-speed" class="vp-speed-select">
                  <option value="0.5">0.5x</option>
                  <option value="0.75">0.75x</option>
                  <option value="1" selected>1x</option>
                  <option value="1.25">1.25x</option>
                  <option value="1.5">1.5x</option>
                  <option value="2">2x</option>
                </select>
              </div>
              
              <button class="vp-btn vp-fullscreen-btn" id="vp-fullscreen" title="全屏">${FULLSCREEN_ICON}</button>
            </div>
          </div>
          
          <div class="vp-playlist-section">
            <div class="vp-playlist-header">
              <span class="vp-playlist-title">播放列表</span>
              <span class="vp-playlist-count" id="vp-playlist-count">0 个视频</span>
            </div>
            <div class="vp-playlist" id="vp-playlist">
              <div class="vp-empty-item">
                <div class="vp-empty-item-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"><rect x="2" y="5" width="15" height="14" rx="2"/><path d="M17 9 l5-3 v12 l-5-3 z"/></svg>
                </div>
                <div class="vp-empty-item-text">点击右上角按钮从文件管理器添加</div>
              </div>
            </div>
          </div>
        </div>
      `

      const uploadBtn = content.querySelector('#vp-upload') as HTMLElement
      const playBtn = content.querySelector('#vp-play') as HTMLButtonElement
      const stopBtn = content.querySelector('#vp-stop') as HTMLButtonElement
      const fullscreenBtn = content.querySelector('#vp-fullscreen') as HTMLButtonElement
      const progressBar = content.querySelector('#vp-progress-bar') as HTMLInputElement
      const progressFill = content.querySelector('#vp-progress-fill') as HTMLElement
      const progressThumb = content.querySelector('#vp-progress-thumb') as HTMLElement
      const volumeSlider = content.querySelector('#vp-volume') as HTMLInputElement
      const volumeBtn = content.querySelector('#vp-vol-btn') as HTMLButtonElement
      const speedSelect = content.querySelector('#vp-speed') as HTMLSelectElement
      const currentTimeEl = content.querySelector('#vp-current-time') as HTMLElement
      const totalTimeEl = content.querySelector('#vp-total-time') as HTMLElement
      const stageEl = content.querySelector('#vp-stage') as HTMLElement
      const emptyEl = content.querySelector('#vp-empty') as HTMLElement
      const controlsEl = content.querySelector('#vp-controls') as HTMLElement
      const playlistEl = content.querySelector('#vp-playlist') as HTMLElement
      const playlistCountEl = content.querySelector('#vp-playlist-count') as HTMLElement

      video.className = 'vp-video'
      video.style.display = 'none'
      stageEl.appendChild(video)

      const formatTime = (seconds: number): string => {
        if (isNaN(seconds) || !isFinite(seconds)) return '00:00'
        const h = Math.floor(seconds / 3600)
        const m = Math.floor((seconds % 3600) / 60)
        const s = Math.floor(seconds % 60)
        if (h > 0) {
          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        }
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      }

      const updateProgressUI = () => {
        const value = parseFloat(progressBar.value)
        progressFill.style.width = value + '%'
        progressThumb.style.left = value + '%'
      }

      const renderPlaylist = () => {
        playlistCountEl.textContent = `${playlist.length} 个视频`
        if (playlist.length === 0) {
          playlistEl.innerHTML = `
            <div class="vp-empty-item">
              <div class="vp-empty-item-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"><rect x="2" y="5" width="15" height="14" rx="2"/><path d="M17 9 l5-3 v12 l-5-3 z"/></svg>
              </div>
              <div class="vp-empty-item-text">点击右上角按钮从文件管理器添加</div>
            </div>
          `
          return
        }
        playlistEl.innerHTML = ''
        playlist.forEach((item, index) => {
          const el = document.createElement('div')
          el.className = `vp-playlist-item ${index === currentIndex ? 'active' : ''}`
          el.innerHTML = `
            <div class="vp-item-index">${index === currentIndex && isPlaying ? '<div class="vp-playing-indicator"><span></span><span></span><span></span></div>' : (index + 1)}</div>
            <div class="vp-item-info">
              <span class="vp-item-name">${item.name}</span>
              <span class="vp-item-size">${(item.size / 1024 / 1024).toFixed(2)} MB</span>
            </div>
          `
          el.addEventListener('click', () => playVideo(index))
          playlistEl.appendChild(el)
        })
      }

      // 从文件管理器导入新文件后刷新播放列表（保持当前播放）
      const onFsChanged = async (): Promise<void> => {
        const folder = 'Users/Admin/Videos'
        try {
          const items = await fs.listFiles(folder)
          const videoItems = items.filter(i => i.type === 'file' && i.name.match(VIDEO_EXTS))
          const newList: VideoItem[] = videoItems.map(i => {
            const p = folder + '/' + i.name
            return { name: i.name, url: previewUrl(p), size: i.size }
          })
          if (newList.length === 0) return
          const keepName = currentIndex >= 0 ? playlist[currentIndex]?.name : ''
          playlist = newList
          renderPlaylist()
          if (keepName) {
            const idx = newList.findIndex(v => v.name === keepName)
            currentIndex = idx >= 0 ? idx : 0
            renderPlaylist()
          }
        } catch { /* 忽略 */ }
      }

      // 从虚拟文件系统的文件夹加载所有视频文件
      const loadFromFolder = async (folderPath: string): Promise<void> => {
        const folder = folderPath.replace(/^\/+/, '') || 'Users/Admin/Videos'
        try {
          const items = await fs.listFiles(folder)
          const videoItems = items.filter(i =>
            i.type === 'file' && i.name.match(VIDEO_EXTS)
          )
          const newList: VideoItem[] = videoItems.map(i => {
            const p = (folder === '' ? '' : folder + '/') + i.name
            return { name: i.name, url: previewUrl(p), size: i.size }
          })
          if (newList.length > 0) {
            playlist = newList
            renderPlaylist()
            loadVideo(0)
          } else if (playlist.length === 0) {
            emptyEl.innerHTML = `
              <div class="vp-empty-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"><rect x="2" y="5" width="15" height="14" rx="2"/><path d="M17 9 l5-3 v12 l-5-3 z"/></svg>
              </div>
              <div class="vp-empty-text">视频文件夹中没有视频文件</div>
              <div class="vp-empty-hint">请在文件管理器中上传视频后双击打开</div>
            `
          }
        } catch {
          if (playlist.length === 0) {
            emptyEl.innerHTML = `
              <div class="vp-empty-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"><rect x="2" y="5" width="15" height="14" rx="2"/><path d="M17 9 l5-3 v12 l-5-3 z"/></svg>
              </div>
              <div class="vp-empty-text">无法读取视频文件夹</div>
            `
          }
        }
      }

      // 从文件管理器双击打开指定视频文件并播放
      const loadFromFile = async (filePath: string): Promise<void> => {
        const clean = filePath.replace(/^\/+/, '')
        const fileName = clean.split('/').pop() || ''
        // 先直接播放指定文件，确保一定能打开
        const directItem: VideoItem = { name: fileName, url: previewUrl(clean), size: 0 }
        playlist = [directItem]
        renderPlaylist()
        playVideo(0)
        // 再尝试加载同目录视频作为播放列表
        try {
          const folder = clean.split('/').slice(0, -1).join('/')
          if (folder) {
            const items = await fs.listFiles(folder)
            const videoItems = items.filter(i => i.type === 'file' && i.name.match(VIDEO_EXTS))
            const newList: VideoItem[] = videoItems.map(i => {
              const p = folder + '/' + i.name
              return { name: i.name, url: previewUrl(p), size: i.size }
            })
            if (newList.length > 0) {
              const curIdx = newList.findIndex(v => v.name === fileName)
              playlist = newList
              renderPlaylist()
              playVideo(curIdx >= 0 ? curIdx : 0)
            }
          }
        } catch { /* 列表加载失败时已直接播放，忽略 */ }
      }

      const loadVideo = (index: number) => {
        if (index < 0 || index >= playlist.length) return
        currentIndex = index
        video.src = playlist[index].url
        video.load()
        emptyEl.style.display = 'none'
        video.style.display = 'block'
        controlsEl.style.display = 'block'
        win.setTitle(`${playlist[index].name} - 视频`)
        renderPlaylist()
      }

      const playVideo = (index: number) => {
        loadVideo(index)
        video.play().catch(() => {})
        isPlaying = true
        updatePlayButton()
        renderPlaylist()
      }

      const updatePlayButton = () => {
        playBtn.innerHTML = isPlaying ? PAUSE_ICON : PLAY_ICON
        playBtn.title = isPlaying ? '暂停' : '播放'
      }

      const togglePlay = () => {
        if (currentIndex === -1 && playlist.length > 0) {
          playVideo(0)
          return
        }
        if (currentIndex === -1) return
        if (isPlaying) {
          video.pause()
          isPlaying = false
        } else {
          video.play().catch(() => {})
          isPlaying = true
        }
        updatePlayButton()
        renderPlaylist()
      }

      const stop = () => {
        video.pause()
        video.currentTime = 0
        isPlaying = false
        updatePlayButton()
        progressBar.value = '0'
        updateProgressUI()
        currentTimeEl.textContent = '00:00'
        renderPlaylist()
      }

      // 上传按钮：打开独立文件选择器，选择视频文件后播放
      uploadBtn.addEventListener('click', async () => {
        const result = await showOpenFileDialog(fs, {
          title: '打开视频',
          filters: ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'm4v', 'flv', 'wmv'],
          defaultDir: 'Users/Admin/Videos'
        })
        if (result) loadFromFile(result.path)
      })
      // 文件管理器导入新文件后刷新播放列表
      eventBus.on('fs:changed', onFsChanged)

      playBtn.addEventListener('click', togglePlay)
      stopBtn.addEventListener('click', stop)

      fullscreenBtn.addEventListener('click', () => {
        if (video.requestFullscreen) {
          video.requestFullscreen()
        } else if ((video as any).webkitRequestFullscreen) {
          ;(video as any).webkitRequestFullscreen()
        }
      })

      video.addEventListener('timeupdate', () => {
        if (video.duration) {
          const progress = (video.currentTime / video.duration) * 100
          progressBar.value = String(progress)
          updateProgressUI()
          currentTimeEl.textContent = formatTime(video.currentTime)
        }
      })

      progressBar.addEventListener('input', () => {
        if (video.duration) {
          video.currentTime = (parseFloat(progressBar.value) / 100) * video.duration
          updateProgressUI()
        }
      })

      video.volume = 0.8
      volumeSlider.addEventListener('input', (e) => {
        const value = parseInt((e.target as HTMLInputElement).value)
        video.volume = value / 100
        isMuted = value === 0
        volumeBtn.innerHTML = isMuted ? VOLUME_MUTE_ICON : VOLUME_ICON
      })

      volumeBtn.addEventListener('click', () => {
        isMuted = !isMuted
        if (isMuted) {
          video.volume = 0
          volumeSlider.value = '0'
        } else {
          video.volume = 0.8
          volumeSlider.value = '80'
        }
        volumeBtn.innerHTML = isMuted ? VOLUME_MUTE_ICON : VOLUME_ICON
      })

      speedSelect.addEventListener('change', (e) => {
        video.playbackRate = parseFloat((e.target as HTMLSelectElement).value)
      })

      video.addEventListener('loadedmetadata', () => {
        totalTimeEl.textContent = formatTime(video.duration)
      })

      video.addEventListener('ended', () => {
        isPlaying = false
        updatePlayButton()
        if (currentIndex < playlist.length - 1) {
          playVideo(currentIndex + 1)
        }
      })

      video.addEventListener('click', togglePlay)

      video.addEventListener('error', () => {
        isPlaying = false
        updatePlayButton()
      })

      renderPlaylist()

      // 双击打开指定视频文件，否则从视频文件夹加载播放列表
      if (filePath) {
        loadFromFile(filePath)
      } else {
        loadFromFolder('Users/Admin/Videos')
      }

      // 监听后续双击：播放器已打开时切换播放新文件
      const onLaunch = (appId: string, ...args: any[]) => {
        if (appId === 'video-player' && args && args.length > 0 && typeof args[0] === 'string' && args[0]) {
          loadFromFile(args[0])
        }
      }
      eventBus.on('app:launch', onLaunch)

      win.onClose(() => {
        eventBus.off('app:launch', onLaunch)
        eventBus.off('fs:changed', onFsChanged)
        video.pause()
        video.src = ''
        playlist.forEach(item => { if (item.url.startsWith('blob:')) URL.revokeObjectURL(item.url) })
      })

      const ctxMenu = new ContextMenu()
      content.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        ctxMenu.show(e.clientX, e.clientY, [
          { label: isPlaying ? '暂停' : '播放', action: () => togglePlay() },
          { label: video.muted ? '取消静音' : '静音', action: () => { video.muted = !video.muted } },
          { separator: true },
          {
            label: '全屏',
            action: () => {
              if (video.requestFullscreen) {
                video.requestFullscreen()
              } else if ((video as any).webkitRequestFullscreen) {
                ;(video as any).webkitRequestFullscreen()
              }
            }
          },
          { separator: true },
          {
            label: '从文件管理器上传',
            action: async () => {
              const result = await showOpenFileDialog(fs, {
                title: '打开视频',
                filters: ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'm4v', 'flv', 'wmv'],
                defaultDir: 'Users/Admin/Videos'
              })
              if (result) loadFromFile(result.path)
            }
          }
        ])
      })
    }
  })
}
