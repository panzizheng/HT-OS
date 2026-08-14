// ============================================================
// 音乐播放器 - macOS 风格毛玻璃设计
// ============================================================

import { WindowManager } from '../wm/WindowManager'
import { FileSystem } from '../fs/FileSystem'
import { EventBus } from '../kernel/EventBus'
import { ContextMenu } from '../desktop/ContextMenu'
import { showOpenFileDialog } from '../desktop/FileDialog'
import { assetIcon } from './system-icons'

const APP_ICON = assetIcon('音乐.svg')

const PLAY_ICON = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>'
const PAUSE_ICON = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>'
const STOP_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>'
const NEXT_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"/><rect x="17" y="4" width="2.5" height="16" rx="1"/></svg>'
const PREV_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="19 4 9 12 19 20 19 4"/><rect x="4.5" y="4" width="2.5" height="16" rx="1"/></svg>'
const LOOP_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>'
const SHUFFLE_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>'
const UPLOAD_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'
const DELETE_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
const VOLUME_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>'
const VOLUME_MUTE_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>'

interface Track {
  name: string
  url: string
  size: number
}

const AUDIO_EXTS = /\.(mp3|wav|ogg|m4a|flac|aac|opus|wma)$/i

const previewUrl = (p: string): string =>
  `/api/fs/preview?path=${encodeURIComponent('/' + p.replace(/^\/+/, ''))}`

export function registerMusicPlayerApp(wm: WindowManager, fs: FileSystem, eventBus: EventBus): void {
  wm.registerApp({
    id: 'music-player',
    name: '音乐',
    icon: APP_ICON,
    singleton: true,
    defaultWidth: 520,
    defaultHeight: 640,
    entry: (windowId: string, filePath?: string) => {
      const win = wm.getWindow(windowId)
      if (!win) return

      const content = win.content
      content.className = 'music-player-app window-content'

      let playlist: Track[] = []
      let currentIndex = -1
      let isPlaying = false
      let isLooping = false
      let isShuffling = false
      let isMuted = false

      const audio = new Audio()

      content.innerHTML = `
        <div class="mp-container">
          <div class="mp-header">
            <div class="mp-app-title">音乐</div>
            <button class="mp-upload-btn" id="mp-upload">
              ${UPLOAD_ICON}
            </button>
          </div>
          
          <div class="mp-now-playing">
            <div class="mp-album-art" id="mp-album-art">
              <div class="mp-album-inner">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              </div>
            </div>
            <div class="mp-track-info">
              <div class="mp-track-name" id="mp-track-name">未选择歌曲</div>
              <div class="mp-track-artist" id="mp-track-artist">添加音乐文件开始播放</div>
            </div>
          </div>

          <div class="mp-progress-section">
            <div class="mp-progress-container">
              <input type="range" id="mp-progress-bar" min="0" max="100" value="0" step="0.1" class="mp-progress-bar">
              <div class="mp-progress-fill" id="mp-progress-fill"></div>
              <div class="mp-progress-thumb" id="mp-progress-thumb"></div>
            </div>
            <div class="mp-time-display">
              <span id="mp-current-time">0:00</span>
              <span id="mp-total-time">0:00</span>
            </div>
          </div>

          <div class="mp-controls-main">
            <button class="mp-ctrl-btn" id="mp-shuffle" title="随机播放">${SHUFFLE_ICON}</button>
            <button class="mp-ctrl-btn mp-prev-btn" id="mp-prev" title="上一首">${PREV_ICON}</button>
            <button class="mp-play-btn" id="mp-play" title="播放/暂停">${PLAY_ICON}</button>
            <button class="mp-ctrl-btn mp-next-btn" id="mp-next" title="下一首">${NEXT_ICON}</button>
            <button class="mp-ctrl-btn" id="mp-loop" title="循环">${LOOP_ICON}</button>
          </div>

          <div class="mp-bottom-controls">
            <div class="mp-volume-section">
              <button class="mp-volume-btn" id="mp-volume-btn">${VOLUME_ICON}</button>
              <div class="mp-volume-container">
                <input type="range" id="mp-volume" min="0" max="100" value="80" class="mp-volume-slider">
              </div>
            </div>
            <div class="mp-speed-section">
              <select id="mp-speed" class="mp-speed-select">
                <option value="0.5">0.5x</option>
                <option value="0.75">0.75x</option>
                <option value="1" selected>1x</option>
                <option value="1.25">1.25x</option>
                <option value="1.5">1.5x</option>
                <option value="2">2x</option>
              </select>
            </div>
          </div>

          <div class="mp-playlist-section">
            <div class="mp-playlist-header">
              <span class="mp-playlist-title">播放列表</span>
              <span class="mp-playlist-count" id="mp-playlist-count">0 首</span>
            </div>
            <div class="mp-playlist" id="mp-playlist">
              <div class="mp-empty-state">
                <div class="mp-empty-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                </div>
                <div class="mp-empty-text">没有正在播放的歌曲</div>
                <div class="mp-empty-hint">点击上方按钮从文件管理器添加</div>
              </div>
            </div>
          </div>
        </div>
      `

      const uploadBtn = content.querySelector('#mp-upload') as HTMLElement
      const playBtn = content.querySelector('#mp-play') as HTMLButtonElement
      const stopBtn = content.querySelector('#mp-stop') as HTMLButtonElement
      const prevBtn = content.querySelector('#mp-prev') as HTMLButtonElement
      const nextBtn = content.querySelector('#mp-next') as HTMLButtonElement
      const loopBtn = content.querySelector('#mp-loop') as HTMLButtonElement
      const shuffleBtn = content.querySelector('#mp-shuffle') as HTMLButtonElement
      const progressBar = content.querySelector('#mp-progress-bar') as HTMLInputElement
      const progressFill = content.querySelector('#mp-progress-fill') as HTMLElement
      const progressThumb = content.querySelector('#mp-progress-thumb') as HTMLElement
      const volumeSlider = content.querySelector('#mp-volume') as HTMLInputElement
      const volumeBtn = content.querySelector('#mp-volume-btn') as HTMLButtonElement
      const speedSelect = content.querySelector('#mp-speed') as HTMLSelectElement
      const trackNameEl = content.querySelector('#mp-track-name') as HTMLElement
      const trackArtistEl = content.querySelector('#mp-track-artist') as HTMLElement
      const currentTimeEl = content.querySelector('#mp-current-time') as HTMLElement
      const totalTimeEl = content.querySelector('#mp-total-time') as HTMLElement
      const playlistEl = content.querySelector('#mp-playlist') as HTMLElement
      const playlistCountEl = content.querySelector('#mp-playlist-count') as HTMLElement
      const albumArt = content.querySelector('#mp-album-art') as HTMLElement

      const formatTime = (seconds: number): string => {
        if (isNaN(seconds)) return '0:00'
        const m = Math.floor(seconds / 60)
        const s = Math.floor(seconds % 60)
        return `${m}:${String(s).padStart(2, '0')}`
      }

      const updateProgressUI = () => {
        const value = parseFloat(progressBar.value)
        progressFill.style.width = value + '%'
        progressThumb.style.left = value + '%'
      }

      const renderPlaylist = () => {
        playlistCountEl.textContent = `${playlist.length} 首`
        if (playlist.length === 0) {
          playlistEl.innerHTML = `
            <div class="mp-empty-state">
              <div class="mp-empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              </div>
              <div class="mp-empty-text">没有正在播放的歌曲</div>
              <div class="mp-empty-hint">点击上方按钮从文件管理器添加</div>
            </div>
          `
          return
        }
        playlistEl.innerHTML = ''
        playlist.forEach((track, index) => {
          const item = document.createElement('div')
          item.className = `mp-playlist-item ${index === currentIndex ? 'active' : ''}`
          item.innerHTML = `
            <div class="mp-item-index">${index === currentIndex && isPlaying ? '<div class="mp-playing-indicator"><span></span><span></span><span></span></div>' : (index + 1)}</div>
            <div class="mp-item-info">
              <span class="mp-item-name">${track.name}</span>
              <span class="mp-item-size">${(track.size / 1024 / 1024).toFixed(2)} MB</span>
            </div>
            <button class="mp-item-delete" data-index="${index}">${DELETE_ICON}</button>
          `
          item.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).closest('.mp-item-delete')) return
            playTrack(index)
          })
          item.querySelector('.mp-item-delete')?.addEventListener('click', (e) => {
            e.stopPropagation()
            removeTrack(index)
          })
          playlistEl.appendChild(item)
        })
      }

      // 从文件管理器导入新文件后刷新播放列表（保持当前播放曲目）
      const onFsChanged = async (): Promise<void> => {
        const folder = 'Users/Admin/Music'
        try {
          const items = await fs.listFiles(folder)
          const audioItems = items.filter(i => i.type === 'file' && i.name.match(AUDIO_EXTS))
          const newTracks: Track[] = audioItems.map(i => {
            const p = folder + '/' + i.name
            return { name: i.name.replace(/\.[^/.]+$/, ''), url: previewUrl(p), size: i.size }
          })
          if (newTracks.length === 0) return
          const keepName = currentIndex >= 0 ? playlist[currentIndex]?.name : ''
          playlist = newTracks
          renderPlaylist()
          if (keepName) {
            const idx = newTracks.findIndex(t => t.name === keepName)
            currentIndex = idx >= 0 ? idx : 0
            renderPlaylist()
          }
        } catch { /* 忽略 */ }
      }

      // 从虚拟文件系统的文件夹加载所有音频文件
      const loadFromFolder = async (folderPath: string): Promise<void> => {
        const folder = folderPath.replace(/^\/+/, '') || 'Users/Admin/Music'
        try {
          const items = await fs.listFiles(folder)
          const audioItems = items.filter(i =>
            i.type === 'file' && i.name.match(AUDIO_EXTS)
          )
          const newTracks: Track[] = audioItems.map(i => {
            const p = (folder === '' ? '' : folder + '/') + i.name
            return { name: i.name.replace(/\.[^/.]+$/, ''), url: previewUrl(p), size: i.size }
          })
          if (newTracks.length > 0) {
            playlist = newTracks
            renderPlaylist()
            loadTrack(0)
          } else if (playlist.length === 0) {
            trackArtistEl.textContent = '音乐文件夹中没有音频文件，请在文件管理器中上传'
          }
        } catch {
          if (playlist.length === 0) {
            trackArtistEl.textContent = '无法读取音乐文件夹'
          }
        }
      }

      // 从文件管理器双击打开指定音频文件并播放
      const loadFromFile = async (filePath: string): Promise<void> => {
        const clean = filePath.replace(/^\/+/, '')
        const fileName = clean.split('/').pop() || ''
        // 先直接播放指定文件，确保一定能打开
        const directTrack: Track = {
          name: fileName.replace(/\.[^/.]+$/, ''),
          url: previewUrl(clean),
          size: 0
        }
        playlist = [directTrack]
        renderPlaylist()
        playTrack(0)
        // 再尝试加载同目录音频作为播放列表
        try {
          const folder = clean.split('/').slice(0, -1).join('/')
          if (folder) {
            const items = await fs.listFiles(folder)
            const audioItems = items.filter(i => i.type === 'file' && i.name.match(AUDIO_EXTS))
            const newTracks: Track[] = audioItems.map(i => {
              const p = folder + '/' + i.name
              return { name: i.name.replace(/\.[^/.]+$/, ''), url: previewUrl(p), size: i.size }
            })
            if (newTracks.length > 0) {
              const curName = fileName.replace(/\.[^/.]+$/, '')
              const curIdx = newTracks.findIndex(t => t.name === curName)
              playlist = newTracks
              renderPlaylist()
              playTrack(curIdx >= 0 ? curIdx : 0)
            }
          }
        } catch { /* 列表加载失败时已直接播放，忽略 */ }
      }

      const removeTrack = (index: number) => {
        if (index === currentIndex) {
          audio.pause()
          isPlaying = false
          updatePlayButton()
          albumArt.classList.remove('playing')
        }
        if (playlist[index].url.startsWith('blob:')) URL.revokeObjectURL(playlist[index].url)
        playlist.splice(index, 1)
        if (index < currentIndex) {
          currentIndex--
        } else if (index === currentIndex) {
          currentIndex = -1
          trackNameEl.textContent = '未选择歌曲'
          trackArtistEl.textContent = '添加音乐文件开始播放'
          currentTimeEl.textContent = '0:00'
          totalTimeEl.textContent = '0:00'
          progressBar.value = '0'
          progressFill.style.width = '0%'
          progressThumb.style.left = '0%'
        }
        renderPlaylist()
      }

      const loadTrack = (index: number) => {
        if (index < 0 || index >= playlist.length) return
        currentIndex = index
        audio.src = playlist[index].url
        trackNameEl.textContent = playlist[index].name
        trackArtistEl.textContent = '本地音乐'
        currentTimeEl.textContent = '0:00'
        totalTimeEl.textContent = '0:00'
        progressBar.value = '0'
        progressFill.style.width = '0%'
        progressThumb.style.left = '0%'
        renderPlaylist()
      }

      const playTrack = (index: number) => {
        loadTrack(index)
        audio.play().catch(() => {})
        isPlaying = true
        updatePlayButton()
        albumArt.classList.add('playing')
      }

      const updatePlayButton = () => {
        playBtn.innerHTML = isPlaying ? PAUSE_ICON : PLAY_ICON
        playBtn.title = isPlaying ? '暂停' : '播放'
      }

      const togglePlay = () => {
        if (currentIndex === -1 && playlist.length > 0) {
          playTrack(0)
          return
        }
        if (currentIndex === -1) return
        if (isPlaying) {
          audio.pause()
          isPlaying = false
          albumArt.classList.remove('playing')
        } else {
          audio.play().catch(() => {})
          isPlaying = true
          albumArt.classList.add('playing')
        }
        updatePlayButton()
        renderPlaylist()
      }

      const stop = () => {
        audio.pause()
        audio.currentTime = 0
        isPlaying = false
        updatePlayButton()
        albumArt.classList.remove('playing')
        progressBar.value = '0'
        progressFill.style.width = '0%'
        progressThumb.style.left = '0%'
        currentTimeEl.textContent = '0:00'
      }

      const prev = () => {
        if (playlist.length === 0) return
        let index: number
        if (isShuffling) {
          index = Math.floor(Math.random() * playlist.length)
        } else {
          index = currentIndex <= 0 ? playlist.length - 1 : currentIndex - 1
        }
        playTrack(index)
      }

      const next = () => {
        if (playlist.length === 0) return
        let index: number
        if (isShuffling) {
          index = Math.floor(Math.random() * playlist.length)
        } else {
          index = currentIndex >= playlist.length - 1 ? 0 : currentIndex + 1
        }
        playTrack(index)
      }

      // 上传按钮：打开独立文件选择器，选择音频文件后播放
      uploadBtn.addEventListener('click', async () => {
        const result = await showOpenFileDialog(fs, {
          title: '打开音频',
          filters: ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'opus', 'wma'],
          defaultDir: 'Users/Admin/Music'
        })
        if (result) loadFromFile(result.path)
      })
      // 文件管理器导入新文件后刷新播放列表
      eventBus.on('fs:changed', onFsChanged)

      playBtn.addEventListener('click', togglePlay)
      prevBtn.addEventListener('click', prev)
      nextBtn.addEventListener('click', next)

      loopBtn.addEventListener('click', () => {
        isLooping = !isLooping
        loopBtn.classList.toggle('active', isLooping)
      })

      shuffleBtn.addEventListener('click', () => {
        isShuffling = !isShuffling
        shuffleBtn.classList.toggle('active', isShuffling)
      })

      audio.addEventListener('timeupdate', () => {
        if (audio.duration) {
          const progress = (audio.currentTime / audio.duration) * 100
          progressBar.value = String(progress)
          updateProgressUI()
          currentTimeEl.textContent = formatTime(audio.currentTime)
        }
      })

      progressBar.addEventListener('input', () => {
        if (audio.duration) {
          audio.currentTime = (parseFloat(progressBar.value) / 100) * audio.duration
          updateProgressUI()
        }
      })

      audio.volume = 0.8
      volumeSlider.addEventListener('input', (e) => {
        const value = parseInt((e.target as HTMLInputElement).value)
        audio.volume = value / 100
        isMuted = value === 0
        volumeBtn.innerHTML = isMuted ? VOLUME_MUTE_ICON : VOLUME_ICON
      })

      volumeBtn.addEventListener('click', () => {
        isMuted = !isMuted
        if (isMuted) {
          audio.volume = 0
          volumeSlider.value = '0'
        } else {
          audio.volume = parseInt(volumeSlider.value) / 100 || 0.8
          volumeSlider.value = String(audio.volume * 100)
        }
        volumeBtn.innerHTML = isMuted ? VOLUME_MUTE_ICON : VOLUME_ICON
      })

      speedSelect.addEventListener('change', (e) => {
        audio.playbackRate = parseFloat((e.target as HTMLSelectElement).value)
      })

      audio.addEventListener('ended', () => {
        if (isLooping) {
          audio.currentTime = 0
          audio.play()
        } else if (isShuffling) {
          next()
        } else {
          if (currentIndex < playlist.length - 1) {
            next()
          } else {
            stop()
          }
        }
      })

      audio.addEventListener('loadedmetadata', () => {
        totalTimeEl.textContent = formatTime(audio.duration)
      })

      audio.addEventListener('error', () => {
        trackArtistEl.textContent = '播放错误'
        isPlaying = false
        updatePlayButton()
        albumArt.classList.remove('playing')
      })

      renderPlaylist()

      // 双击打开指定音频文件，否则从音乐文件夹加载播放列表
      if (filePath) {
        loadFromFile(filePath)
      } else {
        loadFromFolder('Users/Admin/Music')
      }

      // 监听后续双击：播放器已打开时切换播放新文件
      const onLaunch = (appId: string, ...args: any[]) => {
        if (appId === 'music-player' && args && args.length > 0 && typeof args[0] === 'string' && args[0]) {
          loadFromFile(args[0])
        }
      }
      eventBus.on('app:launch', onLaunch)

      win.onClose(() => {
        eventBus.off('app:launch', onLaunch)
        eventBus.off('fs:changed', onFsChanged)
        audio.pause()
        audio.src = ''
        playlist.forEach(track => { if (track.url.startsWith('blob:')) URL.revokeObjectURL(track.url) })
      })

      const ctxMenu = new ContextMenu()
      content.addEventListener('contextmenu', (e: MouseEvent) => {
        e.preventDefault()
        ctxMenu.show(e.clientX, e.clientY, [
          {
            label: '播放/暂停',
            action: () => togglePlay()
          },
          {
            label: '上一首',
            action: () => prev()
          },
          {
            label: '下一首',
            action: () => next()
          },
          { separator: true },
          {
            label: '随机播放',
            action: () => {
              isShuffling = !isShuffling
              shuffleBtn.classList.toggle('active', isShuffling)
            }
          },
          {
            label: '循环播放',
            action: () => {
              isLooping = !isLooping
              loopBtn.classList.toggle('active', isLooping)
            }
          },
          { separator: true },
          {
            label: '从文件管理器上传',
            action: async () => {
              const result = await showOpenFileDialog(fs, {
                title: '打开音频',
                filters: ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'opus', 'wma'],
                defaultDir: 'Users/Admin/Music'
              })
              if (result) loadFromFile(result.path)
            }
          },
          { separator: true },
          {
            label: '清空播放列表',
            action: () => {
              audio.pause()
              isPlaying = false
              playlist.forEach(track => { if (track.url.startsWith('blob:')) URL.revokeObjectURL(track.url) })
              playlist = []
              currentIndex = -1
              audio.src = ''
              trackNameEl.textContent = '未选择歌曲'
              trackArtistEl.textContent = '添加音乐文件开始播放'
              currentTimeEl.textContent = '0:00'
              totalTimeEl.textContent = '0:00'
              progressBar.value = '0'
              progressFill.style.width = '0%'
              progressThumb.style.left = '0%'
              updatePlayButton()
              albumArt.classList.remove('playing')
              renderPlaylist()
            }
          }
        ])
      })
    }
  })
}
