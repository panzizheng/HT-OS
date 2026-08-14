import { WindowManager } from '../wm/WindowManager'
import { dialog } from '../desktop/Dialog'

const APP_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#4a90d9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>'

const BACK_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>'
const FORWARD_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>'
const REFRESH_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>'
const STAR_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'
const PLUS_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
const CLOSE_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
const DOWNLOAD_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'
const SIDEBAR_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>'
const INCOGNITO_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8 2 5 5 5 9c0 4 3 6 3 9v2a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2c0-3 3-5 3-9 0-4-3-7-7-7z"/><line x1="9" y1="22" x2="15" y2="22"/></svg>'
const HISTORY_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
const FOLDER_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>'
const TRASH_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
const PLUS_CIRCLE_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>'
const SEARCH_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
const BOOKMARK_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>'

interface Tab {
  id: string
  title: string
  url: string
  history: string[]
  historyIndex: number
  private: boolean
}

interface HistoryEntry {
  url: string
  title: string
  timestamp: number
}

interface BookmarkEntry {
  title: string
  url: string
  folder: string
}

export function registerBrowserApp(wm: WindowManager): void {
  wm.registerApp({
    id: 'browser',
    name: '浏览器',
    icon: APP_ICON,
    defaultWidth: 900,
    defaultHeight: 620,
    entry: (windowId: string) => {
      const win = wm.getWindow(windowId)
      if (!win) return

      const content = win.content
      content.className = 'browser-app window-content'

      let tabs: Tab[] = []
      let activeTabId = ''
      let tabCounter = 0
      let isPrivateMode = false
      let sidebarOpen = false
      let sidebarView: 'bookmarks' | 'history' = 'bookmarks'

      interface DownloadItem {
        id: string
        url: string
        fileName: string
        status: 'downloading' | 'completed' | 'failed' | 'cancelled'
        progress: number
        totalSize: number
        downloaded: number
        filePath: string
        error: string
        startTime: number
        endTime: number
      }
      let downloads: DownloadItem[] = []

      try {
        const saved = localStorage.getItem('ht-os-downloads')
        if (saved) downloads = JSON.parse(saved)
      } catch { /* */ }

      const saveDownloads = () => {
        try {
          localStorage.setItem('ht-os-downloads', JSON.stringify(downloads.slice(-50)))
        } catch { /* */ }
      }

      let bookmarks: BookmarkEntry[] = []
      try {
        const saved = localStorage.getItem('ht-os-bookmarks')
        if (saved) bookmarks = JSON.parse(saved)
      } catch { /* */ }

      const saveBookmarks = () => {
        try {
          localStorage.setItem('ht-os-bookmarks', JSON.stringify(bookmarks))
        } catch { /* */ }
      }

      const saveHistory = () => {
        try {
          localStorage.setItem('ht-os-history', JSON.stringify(globalHistory.slice(-200)))
        } catch { /* */ }
      }

      let globalHistory: HistoryEntry[] = []
      try {
        const saved = localStorage.getItem('ht-os-history')
        if (saved) {
          const parsed = JSON.parse(saved)
          if (parsed.length > 0 && typeof parsed[0] === 'string') {
            globalHistory = (parsed as string[]).map((url, i) => ({
              url,
              title: url.replace(/^https?:\/\//, '').split('/')[0] || url,
              timestamp: Date.now() - (parsed.length - i) * 60000
            }))
            saveHistory()
          } else {
            globalHistory = parsed
          }
        }
      } catch { /* */ }

      const bookmarkFolders = () => {
        const set = new Set<string>()
        bookmarks.forEach(b => set.add(b.folder || '其他'))
        return Array.from(set)
      }

      content.innerHTML = `
        <div class="browser-tabs" id="browser-tabs">
          <div class="tab-list" id="tab-list"></div>
          <div class="tab new-tab" id="new-tab-btn" title="新建标签页">${PLUS_ICON}</div>
        </div>
        <div class="browser-toolbar">
          <button class="browser-btn" id="browser-sidebar" title="显示侧边栏">${SIDEBAR_ICON}</button>
          <button class="browser-btn" id="browser-back" title="后退" disabled>${BACK_ICON}</button>
          <button class="browser-btn" id="browser-forward" title="前进" disabled>${FORWARD_ICON}</button>
          <button class="browser-btn" id="browser-refresh" title="刷新">${REFRESH_ICON}</button>
          <div class="browser-addressbar">
            <span class="secure-icon" id="secure-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </span>
            <input type="text" id="browser-url" placeholder="搜索或输入网址" spellcheck="false">
            <button class="browser-btn bookmark-btn" id="browser-bookmark" title="添加书签">${STAR_ICON}</button>
          </div>
          <button class="browser-btn" id="browser-incognito" title="无痕浏览">${INCOGNITO_ICON}</button>
          <button class="browser-btn" id="browser-downloads" title="下载">
            ${DOWNLOAD_ICON}
            <span class="download-badge" id="download-badge" style="display:none">0</span>
          </button>
        </div>
        <div class="browser-main">
          <div class="browser-sidebar" id="browser-sidebar">
            <div class="sidebar-header">
              <div class="sidebar-tabs">
                <button class="sidebar-tab ${sidebarView === 'bookmarks' ? 'active' : ''}" data-view="bookmarks">
                  ${BOOKMARK_ICON} 收藏
                </button>
                <button class="sidebar-tab ${(sidebarView as string) === 'history' ? 'active' : ''}" data-view="history">
                  ${HISTORY_ICON} 历史
                </button>
              </div>
            </div>
            <div class="sidebar-search" id="sidebar-search">
              <span>${SEARCH_ICON}</span>
              <input type="text" id="sidebar-search-input" placeholder="搜索..." spellcheck="false">
            </div>
            <div class="sidebar-body" id="sidebar-body"></div>
          </div>
          <div class="browser-content-wrap">
            <div class="browser-bookmarks-bar" id="browser-bookmarks-bar"></div>
            <div class="browser-content" id="browser-content"></div>
          </div>
        </div>
        <div class="browser-statusbar">
          <span id="browser-status">完成</span>
        </div>
      `

      const tabList = content.querySelector('#tab-list') as HTMLElement
      const urlInput = content.querySelector('#browser-url') as HTMLInputElement
      const browserContent = content.querySelector('#browser-content') as HTMLElement
      const statusEl = content.querySelector('#browser-status') as HTMLElement
      const backBtn = content.querySelector('#browser-back') as HTMLButtonElement
      const forwardBtn = content.querySelector('#browser-forward') as HTMLButtonElement
      const bookmarksBar = content.querySelector('#browser-bookmarks-bar') as HTMLElement
      const sidebarEl = content.querySelector('#browser-sidebar') as HTMLElement
      const sidebarBody = content.querySelector('#sidebar-body') as HTMLElement
      const sidebarSearchInput = content.querySelector('#sidebar-search-input') as HTMLInputElement
      const sidebarSearch = content.querySelector('#sidebar-search') as HTMLElement
      const contentWrap = content.querySelector('.browser-content-wrap') as HTMLElement

      const createTab = (url: string = 'about:home', privateTab: boolean = false): string => {
        const tabId = `tab-${++tabCounter}`
        const tab: Tab = {
          id: tabId,
          title: privateTab ? '无痕标签页' : '新标签页',
          url: url,
          history: [url],
          historyIndex: 0,
          private: privateTab
        }
        tabs.push(tab)
        activeTabId = tabId
        if (privateTab) {
          content.classList.add('private-mode')
          const incognitoBtn = content.querySelector('#browser-incognito') as HTMLElement
          if (incognitoBtn) incognitoBtn.classList.add('active')
        }
        renderTabs()
        navigate(url, false)
        return tabId
      }

      const closeTab = (tabId: string) => {
        const index = tabs.findIndex(t => t.id === tabId)
        if (index === -1) return
        const wasPrivate = tabs[index].private
        tabs.splice(index, 1)

        if (tabs.length === 0) {
          content.classList.remove('private-mode')
          const incognitoBtn = content.querySelector('#browser-incognito') as HTMLElement
          if (incognitoBtn) incognitoBtn.classList.remove('active')
          createTab('about:home')
          return
        }

        if (activeTabId === tabId) {
          const newIndex = Math.min(index, tabs.length - 1)
          activeTabId = tabs[newIndex].id
          const tab = tabs[newIndex]
          urlInput.value = tab.url === 'about:home' ? '' : tab.url
          renderContent(tab.url)
          updateNavButtons()
        }

        if (wasPrivate && !tabs.some(t => t.private)) {
          content.classList.remove('private-mode')
          const incognitoBtn = content.querySelector('#browser-incognito') as HTMLElement
          if (incognitoBtn) incognitoBtn.classList.remove('active')
        }

        renderTabs()
      }

      const renderTabs = () => {
        tabList.innerHTML = ''
        tabs.forEach(tab => {
          const tabEl = document.createElement('div')
          tabEl.className = `tab ${tab.id === activeTabId ? 'active' : ''} ${tab.private ? 'private-tab' : ''}`
          if (tab.private) {
            tabEl.title = '无痕标签页'
          }
          tabEl.innerHTML = `
            <span class="tab-title">${tab.private ? '🕳 ' : ''}${tab.title}</span>
            <span class="tab-close" data-tab-id="${tab.id}">${CLOSE_ICON}</span>
          `
          tabEl.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).closest('.tab-close')) return
            switchTab(tab.id)
          })
          const closeBtn = tabEl.querySelector('.tab-close')
          closeBtn?.addEventListener('click', (e) => {
            e.stopPropagation()
            closeTab(tab.id)
          })
          tabList.appendChild(tabEl)
        })
      }

      const renderBookmarksBar = () => {
        if (bookmarks.length === 0) {
          bookmarksBar.innerHTML = '<span class="bm-label">书签</span><span class="bm-empty">暂无书签</span>'
          return
        }
        const folderGroups: { [key: string]: BookmarkEntry[] } = {}
        bookmarks.forEach(b => {
          const folder = b.folder || '其他'
          if (!folderGroups[folder]) folderGroups[folder] = []
          folderGroups[folder].push(b)
        })

        let html = `<span class="bm-label">书签</span>`
        Object.keys(folderGroups).forEach(folder => {
          html += `<span class="bm-folder-label">${folder}</span>`
          folderGroups[folder].forEach(b => {
            html += `<span class="bm-item" data-url="${b.url}" title="${b.title}">${b.title}</span>`
          })
        })
        bookmarksBar.innerHTML = html

        bookmarksBar.querySelectorAll('.bm-item').forEach(item => {
          item.addEventListener('click', () => {
            const url = item.getAttribute('data-url') || ''
            if (url) navigate(url)
          })
        })
      }
      renderBookmarksBar()

      const switchTab = (tabId: string) => {
        const tab = tabs.find(t => t.id === tabId)
        if (!tab) return
        activeTabId = tabId
        urlInput.value = tab.url === 'about:home' ? '' : tab.url
        renderContent(tab.url)
        updateNavButtons()
        renderTabs()
      }

      const updateNavButtons = () => {
        const tab = tabs.find(t => t.id === activeTabId)
        if (tab) {
          backBtn.disabled = tab.historyIndex <= 0
          forwardBtn.disabled = tab.historyIndex >= tab.history.length - 1
        }
        updateBookmarkButton()
        updateSecureIcon()
      }

      const bookmarkBtn = content.querySelector('#browser-bookmark') as HTMLButtonElement
      const updateBookmarkButton = () => {
        const tab = tabs.find(t => t.id === activeTabId)
        if (!tab || tab.url === 'about:home' || tab.url.startsWith('about:')) {
          bookmarkBtn.style.color = 'rgba(0,0,0,0.2)'
          bookmarkBtn.style.cursor = 'default'
          return
        }
        const isBookmarked = bookmarks.some(b => b.url === tab.url)
        bookmarkBtn.style.color = isBookmarked ? '#f5a623' : 'rgba(0,0,0,0.35)'
        bookmarkBtn.style.cursor = 'pointer'
      }

      const secureIcon = content.querySelector('#secure-icon') as HTMLElement
      const updateSecureIcon = () => {
        const tab = tabs.find(t => t.id === activeTabId)
        if (!tab) return
        if (tab.url.startsWith('https://')) {
          secureIcon.style.color = '#27ae60'
          secureIcon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'
        } else if (tab.url.startsWith('http://')) {
          secureIcon.style.color = '#e67e22'
          secureIcon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
        } else {
          secureIcon.style.color = '#999'
          secureIcon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
        }
      }

      const navigate = (url: string, addHistory: boolean = true) => {
        const tab = tabs.find(t => t.id === activeTabId)
        if (!tab) return

        tab.url = url
        urlInput.value = url === 'about:home' ? '' : url

        if (addHistory) {
          tab.history = tab.history.slice(0, tab.historyIndex + 1)
          tab.history.push(url)
          tab.historyIndex = tab.history.length - 1
          if (url !== 'about:home' && !url.startsWith('about:')) {
            if (!tab.private) {
              const domain = url.replace(/^https?:\/\//, '').split('/')[0] || url
              globalHistory.push({
                url,
                title: domain,
                timestamp: Date.now()
              })
              saveHistory()
              if (sidebarView === 'history' && sidebarOpen) renderSidebar()
            }
          }
        }

        updateNavButtons()
        renderContent(url)
      }

      const handleIframeNavigation = (e: MessageEvent) => {
        const data = e.data as { __htNav?: boolean; url?: string }
        if (data && data.__htNav && data.url) {
          const tab = tabs.find(t => t.id === activeTabId)
          if (tab && tab.url !== data.url) {
            tab.url = data.url
            urlInput.value = data.url
            updateNavButtons()
          }
        }
      }

      window.addEventListener('message', handleIframeNavigation)

      const renderContent = (url: string) => {
        statusEl.textContent = '加载中...'
        browserContent.innerHTML = `
          <div class="page-loading">
            <div class="loading-spinner"></div>
            <p>正在加载...</p>
          </div>
        `
        const progressBar = document.createElement('div')
        progressBar.className = 'browser-loading-bar'
        progressBar.style.position = 'absolute'
        progressBar.style.top = '0'
        progressBar.style.left = '0'
        progressBar.style.height = '3px'
        progressBar.style.width = '0%'
        progressBar.style.background = 'linear-gradient(90deg, #2b88d8, #0078d4)'
        progressBar.style.transition = 'width 0.4s ease'
        progressBar.style.zIndex = '1000'
        browserContent.style.position = 'relative'
        browserContent.appendChild(progressBar)
        requestAnimationFrame(() => { progressBar.style.width = '70%' })
        setTimeout(() => {
          progressBar.style.width = '100%'
          setTimeout(() => {
            progressBar.remove()
            if (url === 'about:home') {
              renderHomePage()
              statusEl.textContent = '完成'
            } else if (url.startsWith('about:')) {
              renderAboutPage(url)
              statusEl.textContent = '完成'
            } else if (url.startsWith('http://') || url.startsWith('https://')) {
              renderWebPage(url)
            } else {
              renderErrorPage(url)
              statusEl.textContent = '错误'
            }
          }, 200)
        }, 400)
      }

      const renderHomePage = () => {
        const searchEngines = [
          { name: '百度', url: 'https://www.baidu.com/s?wd=', icon: 'B' },
          { name: 'Google', url: 'https://www.google.com/search?q=', icon: 'G' },
          { name: 'Bing', url: 'https://www.bing.com/search?q=', icon: 'b' }
        ]
        let currentEngine = searchEngines[0]

        const privateNotice = tabs.some(t => t.private) ? `
          <div class="private-notice">
            <span class="private-notice-icon">${INCOGNITO_ICON}</span>
            <span>无痕模式已开启 — 浏览记录不会被保存</span>
          </div>
        ` : ''

        browserContent.innerHTML = `
          <div class="home-page">
            ${privateNotice}
            <div class="home-logo">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#0078d4" stroke-width="1.2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              <h1>HT 浏览器</h1>
            </div>
            <div class="search-engine-tabs">
              ${searchEngines.map((e, i) => `<button class="engine-btn ${i === 0 ? 'active' : ''}" data-engine="${i}">${e.name}</button>`).join('')}
            </div>
            <div class="search-box">
              <input type="text" placeholder="搜索或输入网址" id="home-search" spellcheck="false" autofocus>
              <button id="home-search-btn">搜索</button>
            </div>
            <div class="quick-links">
              <div class="quick-link" data-url="https://www.baidu.com"><div class="ql-icon" style="background:linear-gradient(135deg,#2461ff,#1a55d4)">百</div><span>百度</span></div>
              <div class="quick-link" data-url="https://www.google.com"><div class="ql-icon" style="background:linear-gradient(135deg,#4285f4,#34a853)">G</div><span>Google</span></div>
              <div class="quick-link" data-url="https://www.bing.com"><div class="ql-icon" style="background:linear-gradient(135deg,#00809d,#00b78c)">b</div><span>Bing</span></div>
              <div class="quick-link" data-url="https://github.com"><div class="ql-icon" style="background:linear-gradient(135deg,#24292e,#0d1117)">&lt;/&gt;</div><span>GitHub</span></div>
              <div class="quick-link" data-url="https://www.wikipedia.org"><div class="ql-icon" style="background:linear-gradient(135deg,#636466,#000)">W</div><span>维基百科</span></div>
              <div class="quick-link" data-url="https://www.youtube.com"><div class="ql-icon" style="background:linear-gradient(135deg,#ff0000,#cc0000)">▶</div><span>YouTube</span></div>
            </div>
            ${bookmarks.length > 0 ? `
              <div class="bookmarks-section">
                <h3>收藏的网站</h3>
                <div class="bookmarks-list">
                  ${bookmarks.slice(0, 12).map(b => `<div class="bookmark-item" data-url="${b.url}">${b.title}</div>`).join('')}
                </div>
              </div>
            ` : ''}
            ${!tabs.some(t => t.private) && globalHistory.length > 0 ? `
              <div class="history-section">
                <h3>最近访问</h3>
                <div class="history-list">
                  ${globalHistory.slice(-8).reverse().map(h => `<div class="history-item" data-url="${h.url}">${h.title}</div>`).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        `

        const searchInput = browserContent.querySelector('#home-search') as HTMLInputElement
        const searchBtn = browserContent.querySelector('#home-search-btn')

        browserContent.querySelectorAll('.engine-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            browserContent.querySelectorAll('.engine-btn').forEach(b => b.classList.remove('active'))
            btn.classList.add('active')
            const idx = parseInt(btn.getAttribute('data-engine') || '0')
            currentEngine = searchEngines[idx]
            searchInput.focus()
          })
        })

        const doSearch = () => {
          const query = searchInput.value.trim()
          if (query) {
            if (query.includes('.') && !query.includes(' ') && !query.startsWith('http')) {
              navigate('https://' + query)
            } else if (query.startsWith('http://') || query.startsWith('https://')) {
              navigate(query)
            } else {
              navigate(currentEngine.url + encodeURIComponent(query))
            }
          }
        }
        searchBtn?.addEventListener('click', doSearch)
        searchInput?.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); doSearch() }
        })

        browserContent.querySelectorAll('.quick-link').forEach(link => {
          link.addEventListener('click', () => {
            const url = link.getAttribute('data-url') || ''
            if (url) navigate(url)
          })
        })
        browserContent.querySelectorAll('.bookmark-item').forEach(item => {
          item.addEventListener('click', () => {
            const url = item.getAttribute('data-url') || ''
            if (url) navigate(url)
          })
        })
        browserContent.querySelectorAll('.history-item').forEach(item => {
          item.addEventListener('click', () => {
            const url = item.getAttribute('data-url') || ''
            if (url) navigate(url)
          })
        })
        setTimeout(() => searchInput?.focus(), 100)
      }

      const renderWebPage = (url: string) => {
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`
        browserContent.innerHTML = `
          <div class="web-page-container">
            <iframe src="${proxyUrl}" class="web-iframe" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>
            <div class="iframe-fallback" style="display:none;">
              <div class="fallback-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
              </div>
              <h3>无法加载网页</h3>
              <p>网络请求失败，无法加载 <strong>${url}</strong></p>
              <div class="fallback-actions">
                <button id="open-new-window">在新窗口打开</button>
                <button id="go-home">返回主页</button>
              </div>
            </div>
          </div>
        `
        const iframe = browserContent.querySelector('.web-iframe') as HTMLIFrameElement
        const fallback = browserContent.querySelector('.iframe-fallback') as HTMLElement
        let loaded = false
        iframe.addEventListener('load', () => {
          if (!loaded) { loaded = true; statusEl.textContent = '完成' }
        })
        setTimeout(() => { if (!loaded) { loaded = true; statusEl.textContent = '加载中...' } }, 3000)
        setTimeout(() => { statusEl.textContent = '完成' }, 8000)
        browserContent.querySelector('#open-new-window')?.addEventListener('click', () => { window.open(url, '_blank') })
        browserContent.querySelector('#go-home')?.addEventListener('click', () => { navigate('about:home') })

        const tab = tabs.find(t => t.id === activeTabId)
        if (tab) {
          tab.title = url.replace(/^https?:\/\//, '').split('/')[0] || '网页'
          renderTabs()
        }
      }

      const renderErrorPage = (url: string) => {
        browserContent.innerHTML = `
          <div class="error-page">
            <div class="error-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <h2>无法访问此网站</h2>
            <p>服务器找不到 <strong>${url}</strong></p>
            <p style="color:#888;font-size:13px;margin-top:4px;">请检查网址是否正确，或稍后再试。</p>
            <div class="error-actions">
              <button id="go-home-btn">返回主页</button>
            </div>
          </div>
        `
        browserContent.querySelector('#go-home-btn')?.addEventListener('click', () => { navigate('about:home') })
        const tab = tabs.find(t => t.id === activeTabId)
        if (tab) { tab.title = '错误页面'; renderTabs() }
      }

      const renderAboutPage = (url: string) => {
        if (url === 'about:home') { renderHomePage(); return }
        browserContent.innerHTML = `
          <div class="about-browser">
            <div style="font-size:48px;margin-bottom:16px;">🧭</div>
            <h2>关于 HT 浏览器</h2>
            <p style="font-size:16px;color:#333;margin-bottom:4px;">版本 1.0.0</p>
            <p>HT OS 内置浏览器</p>
            <p style="color:#888;margin-top:20px;font-size:12px;">
              快捷键: Ctrl+T 新建标签 · Ctrl+W 关闭标签 · Ctrl+L 聚焦地址栏 · Ctrl+Shift+N 无痕窗口
            </p>
          </div>
        `
      }

      const formatTimeAgo = (timestamp: number): string => {
        const now = new Date()
        const date = new Date(timestamp)
        const diff = now.getTime() - timestamp
        const seconds = Math.floor(diff / 1000)
        const minutes = Math.floor(seconds / 60)
        const hours = Math.floor(minutes / 60)

        if (seconds < 60) return '刚刚'
        if (minutes < 60) return `${minutes} 分钟前`
        if (hours < 24) return `${hours} 小时前`

        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
        const dayDiff = Math.floor((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24))

        if (dayDiff === 1) return '昨天'
        if (dayDiff < 7) return `${dayDiff} 天前`

        return `${date.getMonth() + 1}/${date.getDate()}`
      }

      const getHistoryGroups = (filter: string = ''): { label: string; items: HistoryEntry[] }[] => {
        const filtered = filter
          ? globalHistory.filter(h =>
              h.title.toLowerCase().includes(filter.toLowerCase()) ||
              h.url.toLowerCase().includes(filter.toLowerCase())
            )
          : globalHistory

        const reversed = [...filtered].reverse()
        const groups: { [key: string]: HistoryEntry[] } = {}

        reversed.forEach(h => {
          const label = formatTimeAgo(h.timestamp)
          if (!groups[label]) groups[label] = []
          groups[label].push(h)
        })

        const order = ['刚刚', '分钟前', '小时前', '昨天', '天前']
        const sortedKeys = Object.keys(groups).sort((a, b) => {
          const aIdx = order.findIndex(o => a.includes(o))
          const bIdx = order.findIndex(o => b.includes(o))
          return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx)
        })

        return sortedKeys.map(key => ({ label: key, items: groups[key] }))
      }

      const renderSidebar = () => {
        if (!sidebarOpen) return
        const filter = (sidebarSearchInput?.value || '').trim()

        if (sidebarView === 'bookmarks') {
          const folders = bookmarkFolders()
          let html = ''

          if (filter) {
            const filtered = bookmarks.filter(b =>
              b.title.toLowerCase().includes(filter.toLowerCase()) ||
              b.url.toLowerCase().includes(filter.toLowerCase())
            )
            html = `<div class="sidebar-section"><div class="sidebar-section-title">搜索结果 (${filtered.length})</div>`
            if (filtered.length === 0) {
              html += '<div class="sidebar-empty">未找到匹配的书签</div>'
            } else {
              filtered.forEach(b => {
                html += `<div class="sidebar-item" data-url="${b.url}" data-folder="${b.folder || '其他'}">
                  <span class="si-icon">📑</span>
                  <span class="si-title">${b.title}</span>
                  <span class="si-url">${b.url.replace(/^https?:\/\//, '')}</span>
                  <span class="si-remove" data-url="${b.url}" title="删除">${CLOSE_ICON}</span>
                </div>`
              })
            }
            html += '</div>'
          } else {
            html += `<div class="sidebar-section-header">
              <div class="sidebar-section-title">收藏夹</div>
              <button class="sidebar-add-folder" id="add-folder" title="新建文件夹">${PLUS_CIRCLE_ICON}</button>
            </div>`

            folders.forEach(folder => {
              const folderBookmarks = bookmarks.filter(b => (b.folder || '其他') === folder)
              html += `<div class="sidebar-folder">
                <div class="sidebar-folder-header" data-folder="${folder}">
                  <span class="sf-icon">${FOLDER_ICON}</span>
                  <span class="sf-name">${folder}</span>
                  <span class="sf-count">${folderBookmarks.length}</span>
                </div>
                <div class="sidebar-folder-items" id="folder-${folder}" style="display:none;">`
                folderBookmarks.forEach(b => {
                  html += `<div class="sidebar-item" data-url="${b.url}" data-folder="${folder}">
                    <span class="si-icon">📑</span>
                    <span class="si-title">${b.title}</span>
                    <span class="si-url">${b.url.replace(/^https?:\/\//, '')}</span>
                    <span class="si-actions">
                      <select class="si-folder-select" data-url="${b.url}" title="移动到">
                        ${folders.map(f => `<option value="${f}" ${f === folder ? 'selected' : ''}>${f}</option>`).join('')}
                      </select>
                      <span class="si-remove" data-url="${b.url}" title="删除">${CLOSE_ICON}</span>
                    </span>
                  </div>`
                })
                html += `</div></div>`
              })
          }

          sidebarBody.innerHTML = html

          sidebarBody.querySelectorAll('.sidebar-item').forEach(item => {
            const url = item.getAttribute('data-url') || ''
            item.querySelector('.si-title')?.addEventListener('click', () => {
              if (url) navigate(url)
            })
          })

          sidebarBody.querySelectorAll('.si-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
              e.stopPropagation()
              const url = btn.getAttribute('data-url') || ''
              bookmarks = bookmarks.filter(b => b.url !== url)
              saveBookmarks()
              renderBookmarksBar()
              renderSidebar()
              updateBookmarkButton()
            })
          })

          const addFolderBtn = sidebarBody.querySelector('#add-folder')
          addFolderBtn?.addEventListener('click', async () => {
            const name = await dialog.prompt('新建文件夹:', '新建文件夹')
            if (name && name.trim()) {
              bookmarks.forEach(b => {
                if (!b.folder) b.folder = '其他'
              })
              saveBookmarks()
              renderSidebar()
            }
          })

          sidebarBody.querySelectorAll('.sidebar-folder-header').forEach(header => {
            header.addEventListener('click', () => {
              const folder = header.getAttribute('data-folder') || ''
              const folderEl = sidebarBody.querySelector(`#folder-${folder}`) as HTMLElement
              if (folderEl) {
                folderEl.style.display = folderEl.style.display === 'none' ? 'block' : 'none'
              }
            })
          })

          sidebarBody.querySelectorAll('.si-folder-select').forEach(select => {
            select.addEventListener('change', (e) => {
              const url = (e.target as HTMLElement).getAttribute('data-url') || ''
              const newFolder = (e.target as HTMLSelectElement).value
              const bookmark = bookmarks.find(b => b.url === url)
              if (bookmark) {
                bookmark.folder = newFolder
                saveBookmarks()
                renderBookmarksBar()
                renderSidebar()
              }
            })
          })
        } else {
          const groups = getHistoryGroups(filter)
          let html = ''

          if (filter) {
            html += `<div class="sidebar-section"><div class="sidebar-section-title">搜索结果 (${globalHistory.filter(h =>
              h.title.toLowerCase().includes(filter.toLowerCase()) ||
              h.url.toLowerCase().includes(filter.toLowerCase())
            ).length})</div>`
          } else {
            html += `<div class="sidebar-section-header">
              <div class="sidebar-section-title">浏览历史</div>
              <button class="sidebar-clear" id="clear-history" title="清除历史">${TRASH_ICON}</button>
            </div>`
          }

          if (globalHistory.length === 0) {
            html += '<div class="sidebar-empty">暂无浏览记录</div>'
          } else {
            groups.forEach(group => {
              html += `<div class="sidebar-date-group">
                <div class="sidebar-date-label">${group.label}</div>`
              group.items.forEach(h => {
                html += `<div class="sidebar-item" data-url="${h.url}">
                  <span class="si-icon">🌐</span>
                  <span class="si-title">${h.title}</span>
                  <span class="si-url">${h.url.replace(/^https?:\/\//, '')}</span>
                  <span class="si-time">${new Date(h.timestamp).toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'})}</span>
                  <span class="si-remove" data-url="${h.url}" data-ts="${h.timestamp}" title="删除">${CLOSE_ICON}</span>
                </div>`
              })
              html += `</div>`
            })
          }
          html += '</div>'

          sidebarBody.innerHTML = html

          sidebarBody.querySelectorAll('.sidebar-item').forEach(item => {
            item.addEventListener('click', (e) => {
              if ((e.target as HTMLElement).closest('.si-remove')) return
              const url = item.getAttribute('data-url') || ''
              if (url) navigate(url)
            })
          })

          sidebarBody.querySelectorAll('.si-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
              e.stopPropagation()
              const url = btn.getAttribute('data-url') || ''
              const ts = parseFloat(btn.getAttribute('data-ts') || '0')
              globalHistory = globalHistory.filter(h => !(h.url === url && h.timestamp === ts))
              saveHistory()
              renderSidebar()
            })
          })

          if (!filter) {
            const clearBtn = sidebarBody.querySelector('#clear-history')
            clearBtn?.addEventListener('click', async () => {
              const ok = await dialog.confirm('确定要清除所有浏览历史吗？')
              if (ok) {
                globalHistory = []
                saveHistory()
                renderSidebar()
              }
            })
          }
        }
      }

      const toggleSidebar = () => {
        sidebarOpen = !sidebarOpen
        if (sidebarOpen) {
          sidebarEl.classList.add('open')
          contentWrap.classList.add('sidebar-open')
          sidebarSearch.style.display = 'flex'
          renderSidebar()
        } else {
          sidebarEl.classList.remove('open')
          contentWrap.classList.remove('sidebar-open')
          sidebarSearch.style.display = 'none'
        }
      }

      const toggleIncognito = () => {
        const incognitoBtn = content.querySelector('#browser-incognito') as HTMLElement
        if (tabs.some(t => t.private)) {
          const privateTabs = tabs.filter(t => t.private)
          privateTabs.forEach(t => closeTab(t.id))
          content.classList.remove('private-mode')
          incognitoBtn.classList.remove('active')
        } else {
          createTab('about:home', true)
          incognitoBtn.classList.add('active')
        }
      }

      urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          let url = urlInput.value.trim()
          if (!url) return
          if (url === 'about:home') {
            navigate(url)
          } else if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('about:')) {
            navigate(url)
          } else if (url.includes('.') && !url.includes(' ')) {
            navigate('https://' + url)
          } else {
            navigate('https://www.baidu.com/s?wd=' + encodeURIComponent(url))
          }
        }
      })

      backBtn.addEventListener('click', () => {
        const tab = tabs.find(t => t.id === activeTabId)
        if (tab && tab.historyIndex > 0) {
          tab.historyIndex--
          navigate(tab.history[tab.historyIndex], false)
        }
      })
      forwardBtn.addEventListener('click', () => {
        const tab = tabs.find(t => t.id === activeTabId)
        if (tab && tab.historyIndex < tab.history.length - 1) {
          tab.historyIndex++
          navigate(tab.history[tab.historyIndex], false)
        }
      })
      content.querySelector('#browser-refresh')!.addEventListener('click', () => {
        const tab = tabs.find(t => t.id === activeTabId)
        if (tab) renderContent(tab.url)
      })

      content.querySelector('#browser-bookmark')!.addEventListener('click', async () => {
        const tab = tabs.find(t => t.id === activeTabId)
        if (!tab || tab.url === 'about:home' || tab.url.startsWith('about:')) return

        const existing = bookmarks.find(b => b.url === tab.url)
        if (existing) {
          bookmarks = bookmarks.filter(b => b.url !== tab.url)
          saveBookmarks()
        } else {
          if (tab.private) {
            const ok = await dialog.confirm('当前为无痕模式，收藏此网站会保存到常规收藏中。是否继续？')
            if (!ok) return
          }
          const folders = bookmarkFolders()
          const folder = await dialog.prompt(`保存到文件夹 (${folders.join(', ') || '其他'}):`, folders[0] || '其他')
          bookmarks.push({ title: tab.title || tab.url.replace(/^https?:\/\//, '').split('/')[0], url: tab.url, folder: folder || '其他' })
          saveBookmarks()
        }
        updateBookmarkButton()
        renderBookmarksBar()
        if (sidebarView === 'bookmarks' && sidebarOpen) renderSidebar()
      })

      const downloadBadge = content.querySelector('#download-badge') as HTMLElement
      const updateDownloadBadge = () => {
        const activeCount = downloads.filter(d => d.status === 'downloading').length
        if (activeCount > 0) {
          downloadBadge.style.display = ''
          downloadBadge.textContent = String(activeCount)
        } else {
          downloadBadge.style.display = 'none'
        }
      }

      const formatSize = (bytes: number): string => {
        if (bytes === 0) return '未知'
        if (bytes < 1024) return bytes + ' B'
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
        if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
        return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
      }

      const showDownloadsPanel = () => {
        const existing = content.querySelector('.downloads-panel')
        if (existing) { existing.remove(); return }

        const panel = document.createElement('div')
        panel.className = 'downloads-panel'
        panel.innerHTML = `
          <div class="downloads-header">
            <span class="downloads-title">下载</span>
            <span class="downloads-clear" id="dl-clear">清除记录</span>
          </div>
          <div class="downloads-body" id="dl-body">
            ${downloads.length === 0 ? '<div class="downloads-empty">暂无下载记录</div>' : ''}
          </div>
          <div class="downloads-footer">
            <button class="downloads-new-btn" id="dl-new">下载新文件...</button>
          </div>
        `
        content.appendChild(panel)

        const renderDownloads = () => {
          const body = panel.querySelector('#dl-body') as HTMLElement
          if (downloads.length === 0) { body.innerHTML = '<div class="downloads-empty">暂无下载记录</div>'; return }
          body.innerHTML = downloads.slice().reverse().map(d => {
            let statusHtml = ''
            if (d.status === 'downloading') {
              statusHtml = `<div class="dl-progress-bar"><div class="dl-progress-fill" style="width: ${d.progress}%"></div></div><div class="dl-info">${formatSize(d.downloaded)} / ${formatSize(d.totalSize)} · ${d.progress}%</div>`
            } else if (d.status === 'completed') {
              statusHtml = `<div class="dl-status completed">已完成 · ${formatSize(d.downloaded)}</div>`
            } else if (d.status === 'failed') {
              statusHtml = `<div class="dl-status failed">失败 · ${d.error || '未知错误'}</div>`
            } else {
              statusHtml = `<div class="dl-status">已取消</div>`
            }
            return `<div class="dl-item" data-id="${d.id}">
              <div class="dl-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <div class="dl-info-wrap">
                <div class="dl-name" title="${d.fileName}">${d.fileName}</div>
                <div class="dl-path" title="${d.filePath}">保存位置: ${d.filePath}</div>
                ${statusHtml}
              </div>
              <div class="dl-actions">
                ${d.status === 'completed' ? `<span class="dl-action" data-action="open-folder" title="打开所在文件夹">📂</span>` : ''}
                <span class="dl-action" data-action="remove" title="删除记录">✕</span>
              </div>
            </div>`
          }).join('')
        }
        renderDownloads()

        panel.querySelector('#dl-clear')!.addEventListener('click', () => {
          downloads = downloads.filter(d => d.status === 'downloading')
          saveDownloads()
          updateDownloadBadge()
          renderDownloads()
        })
        panel.querySelector('#dl-new')!.addEventListener('click', async () => {
          const url = await dialog.prompt('输入要下载的文件 URL:', 'https://')
          if (url && url.trim() && url.startsWith('http')) {
            panel.remove()
            startDownload(url.trim())
          }
        })
        panel.querySelectorAll('.dl-action').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation()
            const id = ((btn as HTMLElement).closest('.dl-item') as HTMLElement | null)?.dataset.id
            const action = (btn as HTMLElement).dataset.action
            if (!id) return
            if (action === 'remove') {
              downloads = downloads.filter(d => d.id !== id)
              saveDownloads()
              renderDownloads()
            } else if (action === 'open-folder') {
              wm.openApp('file-manager', '/Users/Admin/Downloads')
            }
          })
        })
        const closePanel = (e: MouseEvent) => {
          if (!panel.contains(e.target as Node) && !(e.target as HTMLElement).closest('#browser-downloads')) {
            panel.remove()
            document.removeEventListener('click', closePanel)
          }
        }
        setTimeout(() => document.addEventListener('click', closePanel), 0)
      }

      content.querySelector('#browser-downloads')!.addEventListener('click', (e) => {
        e.stopPropagation()
        showDownloadsPanel()
      })

      const startDownload = async (url: string) => {
        const id = 'dl-' + Date.now()
        const fileName = url.split('/').pop()?.split('?')[0] || 'download'
        const item: DownloadItem = {
          id, url, fileName, status: 'downloading', progress: 0,
          totalSize: 0, downloaded: 0,
          filePath: '/Users/Admin/Downloads/' + fileName,
          error: '', startTime: Date.now(), endTime: 0
        }
        downloads.push(item)
        saveDownloads()
        updateDownloadBadge()
        try {
          const response = await fetch(`/api/browser/download?url=${encodeURIComponent(url)}`, { credentials: 'include' })
          if (!response.ok) {
            const err = await response.json().catch(() => ({ error: '下载失败' }))
            throw new Error(err.error || `HTTP ${response.status}`)
          }
          const data = await response.json()
          if (data.success && data.file) {
            item.status = 'completed'
            item.totalSize = data.totalSize || data.downloaded || 0
            item.downloaded = data.downloaded || data.totalSize || 0
            item.progress = 100
            item.filePath = data.file.path || '/Users/Admin/Downloads/' + data.file.name
            item.fileName = data.file.name || item.fileName
            item.endTime = Date.now()
          } else {
            throw new Error(data.error || '下载失败')
          }
        } catch (err: any) {
          item.status = 'failed'
          item.error = err.message
          item.endTime = Date.now()
        }
        saveDownloads()
        updateDownloadBadge()
        window.dispatchEvent(new CustomEvent('fs:changed'))
      }

      content.querySelector('#browser-sidebar')!.addEventListener('click', toggleSidebar)
      content.querySelector('#browser-incognito')!.addEventListener('click', toggleIncognito)

      sidebarSearchInput.addEventListener('input', () => { renderSidebar() })
      sidebarSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { sidebarSearchInput.value = ''; renderSidebar() }
      })

      content.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 't') { e.preventDefault(); createTab('about:home') }
        if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
          e.preventDefault()
          const tab = tabs.find(t => t.id === activeTabId)
          if (tab) closeTab(tab.id)
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'l') { e.preventDefault(); urlInput.focus(); urlInput.select() }
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'n') { e.preventDefault(); createTab('about:home', true) }
        if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); toggleSidebar() }
      })

      content.querySelector('#new-tab-btn')!.addEventListener('click', () => { createTab('about:home') })

      content.querySelector('.sidebar-tabs')?.addEventListener('click', (e) => {
        const tabBtn = (e.target as HTMLElement).closest('.sidebar-tab') as HTMLElement
        if (tabBtn) {
          sidebarView = tabBtn.getAttribute('data-view') as 'bookmarks' | 'history'
          sidebarBody.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'))
          tabBtn.classList.add('active')
          sidebarSearchInput.value = ''
          if (sidebarSearchInput) sidebarSearchInput.style.display = 'flex'
          renderSidebar()
        }
      })

      createTab('about:home')
    }
  })
}
