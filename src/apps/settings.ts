import { WindowManager } from '../wm/WindowManager'
import { FileSystem } from '../fs/FileSystem'
import { SettingsManager } from '../kernel/SettingsManager'
import { EventBus } from '../kernel/EventBus'
import { ContextMenu } from '../desktop/ContextMenu'
import { dialog } from '../desktop/Dialog'
import { requestUac } from '../kernel/UAC'
import type { UACLevel } from '../kernel/types'
import { SETTINGS_ICON } from './system-icons'

// 设置图标（来自 public/assets/设置.svg）
const APP_ICON = SETTINGS_ICON

// 预设壁纸（使用 SVG 文件）
const BASE = import.meta.env.BASE_URL || './'
const WALLPAPERS = [
  { name: '默认壁纸', value: 'default', gradient: `url("${BASE}assets/wallpapers/default.svg") center/cover` },
]

// 主题色
const THEME_COLORS = [
  '#4a90d9', '#76b900', '#e03030', '#ff8c00',
  '#9b59b6', '#1abc9c', '#e74c3c', '#34495e',
  '#16a085', '#f39c12', '#8e44ad', '#2c3e50'
]

// UAC 级别选项
const UAC_LEVELS: { value: UACLevel; label: string; desc: string }[] = [
  { value: 'high', label: '高', desc: '始终提示，所有敏感操作都需要确认' },
  { value: 'medium', label: '中', desc: '默认级别，敏感操作需要确认' },
  { value: 'low', label: '低', desc: '不提示，自动允许所有操作' },
]

export function registerSettingsApp(
  wm: WindowManager,
  fs: FileSystem,
  settings: SettingsManager,
  eventBus: EventBus
): void {
  wm.registerApp({
    id: 'settings',
    name: '设置',
    icon: APP_ICON,
    singleton: true,
    defaultWidth: 820,
    defaultHeight: 580,
    entry: (windowId: string) => {
      const win = wm.getWindow(windowId)
      if (!win) return

      const content = win.content
      content.className = 'settings-app window-content'

      const currentUacLevel = settings.get('uacLevel')

      content.innerHTML = `
        <div class="settings-sidebar">
          <div class="sidebar-item active" data-page="display">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            <span>显示</span>
          </div>
          <div class="sidebar-item" data-page="security">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span>安全</span>
          </div>
          <div class="sidebar-item" data-page="personalization">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
            <span>个性化</span>
          </div>
          <div class="sidebar-item" data-page="account">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span>账号设置</span>
          </div>
          <div class="sidebar-item" data-page="about">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <span>关于系统</span>
          </div>
        </div>
        <div class="settings-content">
          <div class="settings-page" data-page="display">
            <h2>显示设置</h2>
            <div class="setting-group">
              <label>亮度</label>
              <div class="setting-row">
                <input type="range" id="brightness-slider" min="20" max="100" value="${settings.get('brightness')}">
                <span class="setting-value" id="brightness-value">${settings.get('brightness')}%</span>
              </div>
            </div>
            <div class="setting-group">
              <label>分辨率</label>
              <select id="resolution-select" class="setting-select">
                <option value="720" ${settings.get('resolution') === 720 ? 'selected' : ''}>720p (1280x720)</option>
                <option value="1080" ${settings.get('resolution') === 1080 ? 'selected' : ''}>1080p (1920x1080)</option>
                <option value="1440" ${settings.get('resolution') === 1440 ? 'selected' : ''}>1440p (2560x1440)</option>
                <option value="2160" ${settings.get('resolution') === 2160 ? 'selected' : ''}>4K (3840x2160)</option>
              </select>
            </div>
            <div class="setting-group">
              <label>音量</label>
              <div class="setting-row">
                <input type="range" id="volume-slider" min="0" max="100" value="${settings.get('volume')}">
                <span class="setting-value" id="volume-value">${settings.get('volume')}%</span>
              </div>
            </div>
          </div>

          <div class="settings-page" data-page="security" style="display:none">
            <h2>安全设置</h2>
            <div class="setting-group">
              <label>用户账户控制（UAC）</label>
              <div class="setting-hint">控制 UAC 对敏感操作的提示频率。</div>
              <div class="uac-level-options">
                ${UAC_LEVELS.map(l => `
                  <button class="uac-level-btn ${currentUacLevel === l.value ? 'active' : ''}" data-level="${l.value}">
                    <span class="uac-level-label">${l.label}</span>
                    <span class="uac-level-desc">${l.desc}</span>
                  </button>
                `).join('')}
              </div>
            </div>
            <div class="uac-info">
              <div class="info-item">
                <span class="info-label">当前级别：</span>
                <span class="info-value" id="current-uac-level">${UAC_LEVELS.find(l => l.value === currentUacLevel)?.label || '中'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">说明：</span>
                <span class="info-desc" id="uac-level-desc">${UAC_LEVELS.find(l => l.value === currentUacLevel)?.desc || ''}</span>
              </div>
            </div>
          </div>

          <div class="settings-page" data-page="personalization" style="display:none">
            <h2>个性化</h2>

            <!-- 桌面壁纸 -->
            <div class="wallpaper-category">
              <div class="category-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <span>桌面壁纸</span>
              </div>
              <div class="wallpaper-grid">
                ${WALLPAPERS.map(w => `
                  <div class="wallpaper-item ${settings.get('wallpaper') === w.value ? 'active' : ''}" data-wallpaper="${w.value}" style="background: ${w.gradient}">
                    <span class="wallpaper-label">${w.name}</span>
                  </div>
                `).join('')}
                <div class="wallpaper-item upload-item" data-wallpaper="custom">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <span class="wallpaper-label">导入壁纸</span>
                  <input type="file" accept="image/*" class="wallpaper-file-input" style="display:none">
                </div>
              </div>
            </div>

            <div class="setting-group">
              <label>主题色</label>
              <div class="color-options">
                ${THEME_COLORS.map(color => `
                  <button class="color-btn ${settings.get('themeColor') === color ? 'active' : ''}" style="background:${color}" data-color="${color}"></button>
                `).join('')}
              </div>
            </div>
            <div class="setting-group">
              <label>自定义主题色</label>
              <div class="setting-row">
                <input type="color" id="custom-color" value="${settings.get('themeColor')}">
                <button id="apply-custom-color" class="setting-btn">应用</button>
              </div>
            </div>
          </div>

          <div class="settings-page" data-page="account" style="display:none">
            <h2>账户设置</h2>
            <div class="setting-group">
              <label>当前用户</label>
              <div class="account-info">
                <div class="account-avatar">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <div class="account-name">${settings.get('userName')}</div>
              </div>
            </div>
            <div class="setting-group">
              <label>修改用户名</label>
              <div class="setting-row">
                <input type="text" id="username-input" value="${settings.get('userName')}" class="setting-input">
                <button id="username-apply" class="setting-btn">保存</button>
              </div>
            </div>
            <div class="setting-group">
              <label>修改密码</label>
              <div class="setting-row">
                <input type="password" id="password-input" placeholder="新密码" class="setting-input">
                <button id="password-apply" class="setting-btn">保存</button>
              </div>
              <p class="setting-hint">密码保存在本地，仅供演示使用。</p>
            </div>
            <div class="setting-group">
              <label class="danger-label">危险操作</label>
              <div class="danger-zone">
                <div class="danger-item">
                  <div class="danger-info">
                    <div class="danger-title">删除所有账户数据</div>
                    <div class="danger-desc">删除用户名、密码、设置、文件系统等所有数据。此操作不可恢复。</div>
                  </div>
                  <button id="delete-account" class="setting-btn danger-btn">删除</button>
                </div>
              </div>
            </div>
          </div>

          <div class="settings-page" data-page="about" style="display:none">
            <h2>关于系统</h2>
            <div class="about-content">
              <div class="about-logo">
                <svg width="80" height="80" viewBox="0 0 72 72">
                  <rect x="8" y="12" width="56" height="38" rx="4" fill="none" stroke="#0078d4" stroke-width="2.5"/>
                  <line x1="24" y1="58" x2="48" y2="58" stroke="#0078d4" stroke-width="2.5" stroke-linecap="round"/>
                  <line x1="36" y1="50" x2="36" y2="58" stroke="#0078d4" stroke-width="2.5"/>
                </svg>
              </div>
              <h3>HT OS</h3>
              <div class="about-info-grid">
                <div class="about-info-row">
                  <span class="about-info-label">系统名称</span>
                  <span class="about-info-value">HT OS</span>
                </div>
                <div class="about-info-row">
                  <span class="about-info-label">版本号</span>
                  <span class="about-info-value">1.0.0</span>
                </div>
                <div class="about-info-row">
                  <span class="about-info-label">内部版本号</span>
                  <span class="about-info-value">Build 20260724</span>
                </div>
                <div class="about-info-row">
                  <span class="about-info-label">开发者</span>
                  <span class="about-info-value">HT Studio</span>
                </div>
                <div class="about-info-row">
                  <span class="about-info-label">发布日期</span>
                  <span class="about-info-value">2026-07-24</span>
                </div>
              </div>
              <div class="about-desc">
                一个基于 TypeScript 的网页操作系统模拟器。<br>
                支持窗口管理、虚拟文件系统、多种应用程序和现代系统功能。
              </div>
              <div class="about-features">
                <div class="feature-item">窗口管理系统</div>
                <div class="feature-item">虚拟文件系统 (IndexedDB)</div>
                <div class="feature-item">注册表系统</div>
                <div class="feature-item">事件日志</div>
                <div class="feature-item">通知中心</div>
                <div class="feature-item">服务管理</div>
                <div class="feature-item">启动项管理</div>
                <div class="feature-item">环境变量</div>
                <div class="feature-item">UAC 用户账户控制</div>
                <div class="feature-item">终端命令行</div>
                <div class="feature-item">AI 助手</div>
                <div class="feature-item">系统监控</div>
              </div>
              <div class="about-tech">
                <p>浏览器: ${navigator.userAgent.split(' ').slice(-2).join(' ')}</p>
                <p>屏幕分辨率: ${screen.width}x${screen.height}</p>
                <p>语言: ${navigator.language}</p>
              </div>
            </div>
          </div>
        </div>
      `

      const sidebarItems = content.querySelectorAll('.sidebar-item')
      const pages = content.querySelectorAll('.settings-page') as NodeListOf<HTMLElement>

      // 侧边栏导航
      sidebarItems.forEach(item => {
        item.addEventListener('click', () => {
          const page = item.getAttribute('data-page')
          sidebarItems.forEach(i => i.classList.remove('active'))
          item.classList.add('active')
          pages.forEach(p => {
            p.style.display = p.getAttribute('data-page') === page ? 'block' : 'none'
          })
        })
      })

      // 显示设置 - 亮度
      const brightnessSlider = content.querySelector('#brightness-slider') as HTMLInputElement
      const brightnessValue = content.querySelector('#brightness-value') as HTMLElement
      brightnessSlider.addEventListener('input', (e) => {
        const value = parseInt((e.target as HTMLInputElement).value)
        brightnessValue.textContent = value + '%'
        settings.set('brightness', value)
        document.documentElement.style.setProperty('--brightness', value + '%')
      })

      // 显示设置 - 分辨率
      const resolutionSelect = content.querySelector('#resolution-select') as HTMLSelectElement
      resolutionSelect.addEventListener('change', (e) => {
        const value = parseInt((e.target as HTMLSelectElement).value)
        settings.set('resolution', value)
      })

      // 显示设置 - 音量
      const volumeSlider = content.querySelector('#volume-slider') as HTMLInputElement
      const volumeValue = content.querySelector('#volume-value') as HTMLElement
      volumeSlider.addEventListener('input', (e) => {
        const value = parseInt((e.target as HTMLInputElement).value)
        volumeValue.textContent = value + '%'
        settings.set('volume', value)
      })

      // 安全设置 - UAC 级别
      const updateUacInfo = () => {
        const level = settings.get('uacLevel')
        const info = UAC_LEVELS.find(l => l.value === level)
        const levelEl = content.querySelector('#current-uac-level') as HTMLElement
        const descEl = content.querySelector('#uac-level-desc') as HTMLElement
        if (levelEl) levelEl.textContent = info?.label || '中'
        if (descEl) descEl.textContent = info?.desc || ''
      }

      content.querySelectorAll('.uac-level-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const level = btn.getAttribute('data-level') as UACLevel
          settings.set('uacLevel', level)
          content.querySelectorAll('.uac-level-btn').forEach(b => b.classList.remove('active'))
          btn.classList.add('active')
          updateUacInfo()
        })
      })

      // 个性化 - 壁纸选择（桌面）
      content.querySelectorAll('.wallpaper-item[data-wallpaper]').forEach(item => {
        item.addEventListener('click', () => {
          const wallpaper = item.getAttribute('data-wallpaper') || 'default'
          if (wallpaper === 'custom') {
            // 导入壁纸
            const fileInput = item.querySelector('.wallpaper-file-input') as HTMLInputElement
            fileInput?.click()
            return
          }
          content.querySelectorAll('.wallpaper-item[data-wallpaper]').forEach(i => i.classList.remove('active'))
          item.classList.add('active')
          settings.set('wallpaper', wallpaper)
          eventBus.emit('settings:wallpaperChanged', wallpaper)
        })
      })

      // 导入壁纸文件处理
      content.querySelectorAll('.wallpaper-file-input').forEach(input => {
        input.addEventListener('change', async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0]
          if (!file) return
          const reader = new FileReader()
          reader.onload = () => {
            const dataUrl = reader.result as string
            settings.set('wallpaper', dataUrl)
            eventBus.emit('settings:wallpaperChanged', dataUrl)
            // 给导入项加上预览
            const uploadItem = (e.target as HTMLElement).closest('.wallpaper-item') as HTMLElement | null
            if (uploadItem) {
              uploadItem.style.background = `url(${dataUrl}) center/cover`
              uploadItem.classList.add('active')
              content.querySelectorAll('.wallpaper-item[data-wallpaper]').forEach(i => {
                if (i !== uploadItem) i.classList.remove('active')
              })
            }
          }
          reader.readAsDataURL(file)
        })
      })

      // 主题色选择
      content.querySelectorAll('.color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const color = btn.getAttribute('data-color')
          if (color) {
            settings.set('themeColor', color)
            document.documentElement.style.setProperty('--theme-color', color)
            document.documentElement.style.setProperty('--theme-color-dark', adjustColor(color, -30))
            content.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'))
            btn.classList.add('active')
          }
        })
      })

      // 自定义主题色
      const customColorInput = content.querySelector('#custom-color') as HTMLInputElement
      content.querySelector('#apply-custom-color')!.addEventListener('click', () => {
        const color = customColorInput.value
        settings.set('themeColor', color)
        document.documentElement.style.setProperty('--theme-color', color)
        document.documentElement.style.setProperty('--theme-color-dark', adjustColor(color, -30))
        content.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'))
      })

      // 账户设置 - 用户名
      content.querySelector('#username-apply')!.addEventListener('click', async () => {
        const input = content.querySelector('#username-input') as HTMLInputElement
        const value = input.value.trim() || 'User'
        settings.set('userName', value)
        const nameEl = content.querySelector('.account-name') as HTMLElement
        if (nameEl) nameEl.textContent = value
        await dialog.alert('用户名已保存')
      })

      // 账户设置 - 密码
      content.querySelector('#password-apply')!.addEventListener('click', async () => {
        const input = content.querySelector('#password-input') as HTMLInputElement
        const value = input.value.trim()
        if (!value) {
          await dialog.alert('请输入新密码')
          return
        }
        if (value.length < 4) {
          await dialog.alert('密码至少 4 个字符')
          return
        }
        try {
          localStorage.setItem('ht-os-password', value)
          input.value = ''
          await dialog.alert('密码已保存')
        } catch {
          await dialog.alert('密码保存失败')
        }
      })

      // 账户设置 - 删除所有账户数据
      content.querySelector('#delete-account')!.addEventListener('click', async () => {
        // UAC 确认
        const allowed = await requestUac(eventBus, {
          operation: '删除账户数据',
          resource: '所有用户数据',
          source: '设置'
        })
        if (!allowed) return

        const confirmed1 = await dialog.confirm(
          '确认删除',
          '此操作将删除您的所有账户数据，包括用户名、密码、设置和文件。确定继续吗？'
        )
        if (!confirmed1) return
        const confirmed2 = await dialog.confirm(
          '最后确认',
          '此操作不可恢复！所有数据将被永久删除。确定继续吗？'
        )
        if (!confirmed2) return
        try {
          // 清除 localStorage 中的所有 HT OS 相关数据
          const keysToRemove = [
            'ht-os-settings',
            'ht-os-registry',
            'ht-os-event-log',
            'ht-os-notifications',
            'ht-os-service-config',
            'ht-os-startup-items',
            'ht-os-env-vars',
            'ht-os-oobe',
            'ht-os-desktop-grid-positions',
            'ht-os-epp-recent-projects'
          ]
          for (const key of keysToRemove) {
            localStorage.removeItem(key)
          }
          // 清除 Cookie（SettingsManager 用 ht-os-prefs 做双重持久化）
          document.cookie = 'ht-os-prefs=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/'
          // 清除 IndexedDB（文件系统）
          if ('indexedDB' in window) {
            const dbs = await indexedDB.databases()
            for (const db of dbs) {
              if (db.name) indexedDB.deleteDatabase(db.name)
            }
          }
          await dialog.alert('所有账户数据已删除。页面即将刷新...')
          location.reload()
        } catch (e: any) {
          await dialog.alert('删除失败: ' + e.message)
        }
      })

      // 右键菜单
      const ctxMenu = new ContextMenu()
      content.addEventListener('contextmenu', (e: MouseEvent) => {
        e.preventDefault()
        ctxMenu.show(e.clientX, e.clientY, [
          {
            label: '重置设置',
            action: async () => {
              if (await dialog.confirm('确定要将所有设置重置为默认值吗？')) {
                // 重置各项设置到默认值
                settings.set('wallpaper', 'default')
                settings.set('themeColor', '#0078d4')
                settings.set('brightness', 100)
                settings.set('volume', 50)
                settings.set('resolution', 1080)
                settings.set('uacLevel', 'medium')

                // 应用视觉变化
                document.documentElement.style.setProperty('--brightness', '100%')
                document.documentElement.style.setProperty('--theme-color', '#0078d4')
                document.documentElement.style.setProperty('--theme-color-dark', adjustColor('#0078d4', -30))
                eventBus.emit('settings:wallpaperChanged', 'default')

                // 更新 UI 控件
                brightnessSlider.value = '100'
                brightnessValue.textContent = '100%'
                volumeSlider.value = '50'
                volumeValue.textContent = '50%'
                resolutionSelect.value = '1080'
                updateUacInfo()

                // UAC 级别按钮选中状态
                content.querySelectorAll('.uac-level-btn').forEach(b => {
                  b.classList.toggle('active', b.getAttribute('data-level') === 'medium')
                })

                // 壁纸与主题色按钮选中状态
                content.querySelectorAll('.wallpaper-item').forEach(i => {
                  i.classList.toggle('active', i.getAttribute('data-wallpaper') === 'default')
                })
                content.querySelectorAll('.color-btn').forEach(b => {
                  b.classList.toggle('active', b.getAttribute('data-color') === '#0078d4')
                })

                await dialog.alert('设置已重置为默认值')
              }
            }
          },
          { separator: true },
          {
            label: '导出设置',
            action: async () => {
              const json = JSON.stringify(settings.getAll(), null, 2)
              try {
                await navigator.clipboard.writeText(json)
                await dialog.alert('设置已复制到剪贴板')
              } catch {
                await dialog.alert('导出失败')
              }
            }
          }
        ])
      })

      // 初始化
      updateUacInfo()
    }
  })
}

// 调整颜色亮度（用于生成深色变体）
function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  let r = (num >> 16) + amount
  let g = ((num >> 8) & 0x00FF) + amount
  let b = (num & 0x0000FF) + amount
  r = Math.max(0, Math.min(255, r))
  g = Math.max(0, Math.min(255, g))
  b = Math.max(0, Math.min(255, b))
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')
}