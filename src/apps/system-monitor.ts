// ============================================================
// 任务管理器 - 类似 Windows 任务管理器
// 标签页：进程 / 性能 / 启动应用 / 用户 / 详细信息 / 服务
// ============================================================

import { WindowManager } from '../wm/WindowManager'
import { SettingsManager } from '../kernel/SettingsManager'
import { ServiceManager } from '../kernel/ServiceManager'
import { StartupManager } from '../kernel/StartupManager'
import { EventBus } from '../kernel/EventBus'
import { ContextMenu } from '../desktop/ContextMenu'
import { dialog } from '../desktop/Dialog'
import { requestUac } from '../kernel/UAC'

const APP_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12 h4 l3-8 l4 16 l3-8 h4"/></svg>'

const CPU_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="2" x2="9" y2="4"/><line x1="15" y1="2" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="22"/><line x1="15" y1="20" x2="15" y2="22"/><line x1="2" y1="9" x2="4" y2="9"/><line x1="2" y1="15" x2="4" y2="15"/><line x1="20" y1="9" x2="22" y2="9"/><line x1="20" y1="15" x2="22" y2="15"/></svg>'
const MEMORY_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="12" rx="1"/><line x1="6" y1="19" x2="6" y2="22"/><line x1="18" y1="19" x2="18" y2="22"/></svg>'
const BATTERY_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="18" height="10" rx="1"/><line x1="22" y1="11" x2="22" y2="13"/></svg>'
const NETWORK_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12 a10 10 0 0 1 14 0"/><path d="M8 15 a6 6 0 0 1 8 0"/><circle cx="12" cy="18" r="1.5" fill="currentColor"/></svg>'

// 应用元数据（图标、可执行文件名）
const APP_META: Record<string, { exe: string; publisher: string }> = {
  'settings': { exe: 'settings.exe', publisher: 'HT Studio' },
  'file-manager': { exe: 'explorer.exe', publisher: 'HT Studio' },
  'terminal': { exe: 'cmd.exe', publisher: 'HT Studio' },
  'notepad': { exe: 'notepad.exe', publisher: 'HT Studio' },
  'office': { exe: 'htoffice.exe', publisher: 'HT Studio' },
  'calculator': { exe: 'calc.exe', publisher: 'HT Studio' },
  'browser': { exe: 'browser.exe', publisher: 'HT Studio' },
  'painter': { exe: 'mspaint.exe', publisher: 'HT Studio' },
  'music-player': { exe: 'music.exe', publisher: 'HT Studio' },
  'video-player': { exe: 'player.exe', publisher: 'HT Studio' },
  'weather': { exe: 'weather.exe', publisher: 'HT Studio' },
  'ai-assistant': { exe: 'ai.exe', publisher: 'HT Studio' },
  'task-manager': { exe: 'taskmgr.exe', publisher: 'HT Studio' },
  'regedit': { exe: 'regedit.exe', publisher: 'HT Studio' },
  'services': { exe: 'services.msc', publisher: 'HT Studio' },
  'startup-manager': { exe: 'startup.exe', publisher: 'HT Studio' },
  'event-viewer': { exe: 'eventvwr.exe', publisher: 'HT Studio' },
  'env-editor': { exe: 'sysdm.cpl', publisher: 'HT Studio' },
}

export function registerSystemMonitorApp(
  wm: WindowManager,
  settings: SettingsManager,
  serviceManager: ServiceManager,
  startupManager: StartupManager,
  eventBus: EventBus
): void {
  wm.registerApp({
    id: 'task-manager',
    name: '任务管理器',
    icon: APP_ICON,
    singleton: true,
    defaultWidth: 860,
    defaultHeight: 600,
    entry: (windowId: string) => {
      const win = wm.getWindow(windowId)
      if (!win) return

      const content = win.content
      content.className = 'task-manager-app window-content'

      let currentTab = 'processes'
      const startTime = Date.now()

      content.innerHTML = `
        <div class="tm-container">
          <div class="tm-tabs">
            <div class="tm-tab active" data-tab="processes">进程</div>
            <div class="tm-tab" data-tab="performance">性能</div>
            <div class="tm-tab" data-tab="startup">启动应用</div>
            <div class="tm-tab" data-tab="users">用户</div>
            <div class="tm-tab" data-tab="details">详细信息</div>
            <div class="tm-tab" data-tab="services">服务</div>
          </div>
          <div class="tm-body">
            <div class="tm-page" data-page="processes"></div>
            <div class="tm-page" data-page="performance" style="display:none"></div>
            <div class="tm-page" data-page="startup" style="display:none"></div>
            <div class="tm-page" data-page="users" style="display:none"></div>
            <div class="tm-page" data-page="details" style="display:none"></div>
            <div class="tm-page" data-page="services" style="display:none"></div>
          </div>
          <div class="tm-statusbar">
            <span id="tm-uptime">运行时长: 00:00:00</span>
            <span id="tm-processes-count">进程: 0</span>
            <span id="tm-cpu-status">CPU: 0%</span>
            <span id="tm-memory-status">内存: 0 MB</span>
          </div>
        </div>
      `

      const pages = {
        processes: content.querySelector('[data-page="processes"]') as HTMLElement,
        performance: content.querySelector('[data-page="performance"]') as HTMLElement,
        startup: content.querySelector('[data-page="startup"]') as HTMLElement,
        users: content.querySelector('[data-page="users"]') as HTMLElement,
        details: content.querySelector('[data-page="details"]') as HTMLElement,
        services: content.querySelector('[data-page="services"]') as HTMLElement,
      }

      const uptimeEl = content.querySelector('#tm-uptime') as HTMLElement
      const processesCountEl = content.querySelector('#tm-processes-count') as HTMLElement
      const cpuStatusEl = content.querySelector('#tm-cpu-status') as HTMLElement
      const memoryStatusEl = content.querySelector('#tm-memory-status') as HTMLElement

      // ---------- 工具函数 ----------
      const escapeHtml = (text: string): string => {
        const div = document.createElement('div')
        div.textContent = text
        return div.innerHTML
      }

      const formatTime = (seconds: number): string => {
        if (isNaN(seconds)) return '00:00:00'
        const h = Math.floor(seconds / 3600)
        const m = Math.floor((seconds % 3600) / 60)
        const s = Math.floor(seconds % 60)
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      }

      // 伪随机 CPU 占用（每个进程有基线）
      const cpuBaseMap = new Map<string, number>()
      const getCpuForApp = (appId: string): number => {
        let base = cpuBaseMap.get(appId)
        if (base === undefined) {
          base = 0.3 + Math.random() * 4
          cpuBaseMap.set(appId, base)
        }
        base += (Math.random() - 0.5) * 1.5
        base = Math.max(0.1, Math.min(25, base))
        cpuBaseMap.set(appId, base)
        return Math.round(base * 10) / 10
      }

      // 伪随机内存占用
      const memBaseMap = new Map<string, number>()
      const getMemForApp = (appId: string): number => {
        let base = memBaseMap.get(appId)
        if (base === undefined) {
          base = 15 + Math.random() * 120
          memBaseMap.set(appId, base)
        }
        base += (Math.random() - 0.5) * 5
        base = Math.max(5, Math.min(500, base))
        memBaseMap.set(appId, base)
        return Math.round(base * 10) / 10
      }

      const getMemoryInfo = (): { used: number; total: number; percent: number } => {
        const perfMem = (performance as any).memory
        if (perfMem) {
          const used = perfMem.usedJSHeapSize / 1024 / 1024
          const total = perfMem.jsHeapSizeLimit / 1024 / 1024
          return { used: Math.round(used), total: Math.round(total), percent: Math.round((used / total) * 100) }
        }
        const total = 4096
        const used = 800 + Math.floor(Math.random() * 400)
        return { used, total, percent: Math.round((used / total) * 100) }
      }

      // ---------- 进程页 ----------
      const renderProcesses = () => {
        const windows = wm.getAllWindows()
        const cpuCores = (navigator as any).hardwareConcurrency || 4

        // 系统进程
        const sysProcesses = [
          { name: '系统空闲进程', exe: 'System Idle Process', cpu: 0, mem: 0, type: '系统', pid: 0, windowId: '' },
          { name: '系统', exe: 'System', cpu: 0.5, mem: 8.2, type: '系统', pid: 4, windowId: '' },
          { name: 'HT OS 内核', exe: 'htkernel.exe', cpu: 1.2, mem: 45.6, type: '系统', pid: 8, windowId: '' },
          { name: '窗口管理器', exe: 'dwm.exe', cpu: 0.8, mem: 62.3, type: '系统', pid: 12, windowId: '' },
          { name: '桌面进程', exe: 'desktop.exe', cpu: 0.6, mem: 38.1, type: '系统', pid: 16, windowId: '' },
          { name: '任务栏', exe: 'taskbar.exe', cpu: 0.4, mem: 24.8, type: '系统', pid: 20, windowId: '' },
        ]

        // 应用进程（来自实际打开的窗口）
        const appProcesses = windows.map((w, i) => {
          const meta = APP_META[w.appId] || { exe: w.appId + '.exe', publisher: 'HT Studio' }
          return {
            name: w.title || w.appId,
            exe: meta.exe,
            cpu: getCpuForApp(w.appId),
            mem: getMemForApp(w.appId),
            type: '应用',
            pid: 1000 + i,
            windowId: w.id,
            appId: w.appId,
          }
        })

        const all = [...appProcesses, ...sysProcesses]
        // 系统空闲进程占剩余 CPU
        const usedCpu = all.filter(p => p.name !== '系统空闲进程').reduce((s, p) => s + p.cpu, 0)
        const idleCpu = Math.max(0, (cpuCores * 100) - usedCpu)
        const idle = all.find(p => p.name === '系统空闲进程')
        if (idle) idle.cpu = Math.round(idleCpu * 10) / 10

        processesCountEl.textContent = `进程: ${all.length}`

        pages.processes.innerHTML = `
          <div class="tm-process-list">
            <div class="tm-process-header">
              <div class="tm-col tm-col-name">名称</div>
              <div class="tm-col tm-col-type">类型</div>
              <div class="tm-col tm-col-cpu">CPU</div>
              <div class="tm-col tm-col-mem">内存</div>
              <div class="tm-col tm-col-pid">PID</div>
            </div>
            <div class="tm-process-body">
              ${all.map(p => `
                <div class="tm-process-row ${p.type === '系统' ? 'tm-system' : 'tm-app'}" data-window-id="${p.windowId || ''}" data-pid="${p.pid}">
                  <div class="tm-col tm-col-name" title="${escapeHtml(p.exe)}">${escapeHtml(p.name)}</div>
                  <div class="tm-col tm-col-type"><span class="tm-badge tm-badge-${p.type === '系统' ? 'system' : 'app'}">${p.type}</span></div>
                  <div class="tm-col tm-col-cpu">${p.cpu.toFixed(1)}%</div>
                  <div class="tm-col tm-col-mem">${p.mem.toFixed(1)} MB</div>
                  <div class="tm-col tm-col-pid">${p.pid}</div>
                </div>
              `).join('')}
            </div>
          </div>
        `

        // 行点击：选中
        let selectedRow: HTMLElement | null = null
        pages.processes.querySelectorAll('.tm-process-row').forEach(row => {
          row.addEventListener('click', () => {
            if (selectedRow) selectedRow.classList.remove('selected')
            selectedRow = row as HTMLElement
            row.classList.add('selected')
          })
          row.addEventListener('dblclick', async () => {
            const windowId = (row as HTMLElement).dataset.windowId
            const procName = (row as HTMLElement).dataset.name || '进程'
            if (windowId) {
              if (!await requestUac(eventBus, { operation: '结束进程', resource: procName, source: '任务管理器' })) return
              wm.closeWindow(windowId)
            }
          })
        })
      }

      // ---------- 性能页 ----------
      const cpuHistory: number[] = new Array(60).fill(0)
      const memoryHistory: number[] = new Array(60).fill(0)

      let cpuBase = 15
      const updateCpu = (): number => {
        cpuBase += (Math.random() - 0.5) * 8
        cpuBase = Math.max(5, Math.min(85, cpuBase))
        return Math.round(cpuBase)
      }

      // 电池
      let batteryLevel: number | null = null
      let batteryCharging = false
      const updateBattery = async () => {
        const nav = navigator as any
        if (nav.getBattery) {
          try {
            const battery = await nav.getBattery()
            batteryLevel = battery.level
            batteryCharging = battery.charging
          } catch {
            batteryLevel = null
          }
        }
      }
      updateBattery()

      const renderPerformance = () => {
        pages.performance.innerHTML = `
          <div class="tm-perf-container">
            <div class="tm-perf-sidebar">
              <div class="tm-perf-item active" data-perf="cpu">${CPU_ICON}<span>CPU</span></div>
              <div class="tm-perf-item" data-perf="memory">${MEMORY_ICON}<span>内存</span></div>
              <div class="tm-perf-item" data-perf="battery">${BATTERY_ICON}<span>电池</span></div>
              <div class="tm-perf-item" data-perf="network">${NETWORK_ICON}<span>网络</span></div>
            </div>
            <div class="tm-perf-main">
              <div class="tm-perf-detail" id="tm-perf-detail"></div>
            </div>
          </div>
        `

        const detailEl = pages.performance.querySelector('#tm-perf-detail') as HTMLElement
        let perfTab = 'cpu'

        const drawChart = (data: number[], color: string, height: number = 180): string => {
          const w = 600
          const h = height
          const step = w / (data.length - 1)
          const points = data.map((v, i) => `${i * step},${h - (v / 100) * h}`).join(' ')
          const fillPoints = `0,${h} ${points} ${w},${h}`
          return `
            <svg class="tm-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:${h}px;">
              <polygon points="${fillPoints}" fill="${color}22" />
              <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" />
            </svg>
          `
        }

        const renderDetail = () => {
          const cpuCores = (navigator as any).hardwareConcurrency || '未知'
          const mem = getMemoryInfo()
          const cpu = cpuHistory[cpuHistory.length - 1] || 0

          if (perfTab === 'cpu') {
            detailEl.innerHTML = `
              <div class="tm-perf-header">
                <div class="tm-perf-title">${CPU_ICON} CPU</div>
                <div class="tm-perf-big">${cpu}%</div>
              </div>
              ${drawChart(cpuHistory, '#16a34a')}
              <div class="tm-perf-info">
                <div class="tm-perf-info-row"><span>利用率</span><span>${cpu}%</span></div>
                <div class="tm-perf-info-row"><span>核心数</span><span>${cpuCores}</span></div>
                <div class="tm-perf-info-row"><span>速度</span><span>2.40 GHz</span></div>
                <div class="tm-perf-info-row"><span>缓存</span><span>L1 / L2 / L3</span></div>
              </div>
            `
          } else if (perfTab === 'memory') {
            detailEl.innerHTML = `
              <div class="tm-perf-header">
                <div class="tm-perf-title">${MEMORY_ICON} 内存</div>
                <div class="tm-perf-big">${mem.used} MB / ${mem.total} MB</div>
              </div>
              ${drawChart(memoryHistory, '#9b59b6')}
              <div class="tm-perf-info">
                <div class="tm-perf-info-row"><span>使用中</span><span>${mem.used} MB (${mem.percent}%)</span></div>
                <div class="tm-perf-info-row"><span>可用</span><span>${mem.total - mem.used} MB</span></div>
                <div class="tm-perf-info-row"><span>总计</span><span>${mem.total} MB</span></div>
                <div class="tm-perf-info-row"><span>已缓存</span><span>${Math.round(mem.total * 0.15)} MB</span></div>
              </div>
            `
          } else if (perfTab === 'battery') {
            const percent = batteryLevel !== null ? Math.round(batteryLevel * 100) : null
            detailEl.innerHTML = `
              <div class="tm-perf-header">
                <div class="tm-perf-title">${BATTERY_ICON} 电池</div>
                <div class="tm-perf-big">${percent !== null ? percent + '%' : '不支持'}</div>
              </div>
              <div class="tm-perf-info">
                <div class="tm-perf-info-row"><span>电池电量</span><span>${percent !== null ? percent + '%' : '未知'}</span></div>
                <div class="tm-perf-info-row"><span>状态</span><span>${batteryCharging ? '充电中' : (percent === null ? '不支持' : '使用电池')}</span></div>
                <div class="tm-perf-info-row"><span>剩余时间</span><span>${percent !== null && !batteryCharging ? Math.round(percent / 10) + ' 小时' : '--'}</span></div>
              </div>
            `
          } else if (perfTab === 'network') {
            const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
            detailEl.innerHTML = `
              <div class="tm-perf-header">
                <div class="tm-perf-title">${NETWORK_ICON} 网络</div>
                <div class="tm-perf-big">${navigator.onLine ? '已连接' : '离线'}</div>
              </div>
              <div class="tm-perf-info">
                <div class="tm-perf-info-row"><span>状态</span><span>${navigator.onLine ? '在线' : '离线'}</span></div>
                <div class="tm-perf-info-row"><span>连接类型</span><span>${conn?.effectiveType || '未知'}</span></div>
                <div class="tm-perf-info-row"><span>下行速度</span><span>${conn?.downlink || '--'} Mbps</span></div>
                <div class="tm-perf-info-row"><span>往返时间</span><span>${conn?.rtt || '--'} ms</span></div>
              </div>
            `
          }
        }

        pages.performance.querySelectorAll('.tm-perf-item').forEach(item => {
          item.addEventListener('click', () => {
            pages.performance.querySelectorAll('.tm-perf-item').forEach(i => i.classList.remove('active'))
            item.classList.add('active')
            perfTab = (item as HTMLElement).dataset.perf || 'cpu'
            renderDetail()
          })
        })

        renderDetail()
        // 保存到外部供刷新使用
        ;(pages.performance as any)._renderDetail = renderDetail
      }

      // ---------- 启动应用页 ----------
      const renderStartup = () => {
        const items = startupManager.getAll()
        pages.startup.innerHTML = `
          <div class="tm-startup-list">
            <div class="tm-startup-header">
              <div class="tm-col tm-col-name">名称</div>
              <div class="tm-col tm-col-status">状态</div>
              <div class="tm-col tm-col-source">来源</div>
              <div class="tm-col tm-col-delay">启动延迟</div>
              <div class="tm-col tm-col-impact">影响</div>
            </div>
            <div class="tm-startup-body">
              ${items.length === 0 ? '<div class="tm-empty">暂无启动项</div>' : items.map(item => {
                const impact = item.delay > 1000 ? '高' : item.delay > 0 ? '中' : '低'
                const impactClass = impact === '高' ? 'high' : impact === '中' ? 'mid' : 'low'
                return `
                  <div class="tm-startup-row" data-id="${item.id}">
                    <div class="tm-col tm-col-name">${escapeHtml(item.name)}</div>
                    <div class="tm-col tm-col-status">
                      <span class="tm-badge ${item.enabled ? 'tm-badge-enabled' : 'tm-badge-disabled'}">${item.enabled ? '已启用' : '已禁用'}</span>
                    </div>
                    <div class="tm-col tm-col-source">${item.source === 'system' ? '系统' : '用户'}</div>
                    <div class="tm-col tm-col-delay">${item.delay} ms</div>
                    <div class="tm-col tm-col-impact"><span class="tm-impact tm-impact-${impactClass}">${impact}</span></div>
                  </div>
                `
              }).join('')}
            </div>
          </div>
        `
      }

      // ---------- 用户页 ----------
      const renderUsers = () => {
        const userName = settings.get('userName') || 'User'
        const connectedTime = new Date(startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        pages.users.innerHTML = `
          <div class="tm-users-list">
            <div class="tm-users-header">
              <div class="tm-col tm-col-user">用户</div>
              <div class="tm-col tm-col-status">状态</div>
              <div class="tm-col tm-col-cpu">CPU</div>
              <div class="tm-col tm-col-mem">内存</div>
              <div class="tm-col tm-col-disk">磁盘</div>
              <div class="tm-col tm-col-network">网络</div>
            </div>
            <div class="tm-users-body">
              <div class="tm-user-row">
                <div class="tm-col tm-col-user">
                  <div class="tm-user-avatar">${escapeHtml(userName.charAt(0).toUpperCase() || 'U')}</div>
                  <div>
                    <div class="tm-user-name">${escapeHtml(userName)}</div>
                    <div class="tm-user-session">会话: 1</div>
                  </div>
                </div>
                <div class="tm-col tm-col-status"><span class="tm-badge tm-badge-active">活动</span></div>
                <div class="tm-col tm-col-cpu">${cpuHistory[cpuHistory.length - 1] || 0}%</div>
                <div class="tm-col tm-col-mem">${getMemoryInfo().used} MB</div>
                <div class="tm-col tm-col-disk">0 MB/s</div>
                <div class="tm-col tm-col-network">0 Mbps</div>
              </div>
              <div class="tm-user-row">
                <div class="tm-col tm-col-user">
                  <div class="tm-user-avatar tm-system-avatar">S</div>
                  <div>
                    <div class="tm-user-name">系统</div>
                    <div class="tm-user-session">会话: 0</div>
                  </div>
                </div>
                <div class="tm-col tm-col-status"><span class="tm-badge tm-badge-active">活动</span></div>
                <div class="tm-col tm-col-cpu">0.5%</div>
                <div class="tm-col tm-col-mem">8.2 MB</div>
                <div class="tm-col tm-col-disk">0 MB/s</div>
                <div class="tm-col tm-col-network">0 Mbps</div>
              </div>
            </div>
            <div class="tm-user-info">
              <div class="tm-user-info-row"><span>连接时间</span><span>${connectedTime}</span></div>
              <div class="tm-user-info-row"><span>会话 ID</span><span>1</span></div>
              <div class="tm-user-info-row"><span>客户端名称</span><span>HT-PC</span></div>
            </div>
          </div>
        `
      }

      // ---------- 详细信息页 ----------
      const renderDetails = () => {
        const windows = wm.getAllWindows()
        const sysDetails = [
          { name: 'System Idle Process', pid: 0, status: '运行中', user: 'SYSTEM', cpu: 0, mem: 0, desc: '系统空闲进程', platform: '32 位', windowId: '' },
          { name: 'System', pid: 4, status: '运行中', user: 'SYSTEM', cpu: 0.5, mem: 8.2, desc: 'NT 内核与系统', platform: '64 位', windowId: '' },
          { name: 'htkernel.exe', pid: 8, status: '运行中', user: 'SYSTEM', cpu: 1.2, mem: 45.6, desc: 'HT OS 内核', platform: '64 位', windowId: '' },
          { name: 'dwm.exe', pid: 12, status: '运行中', user: `${settings.get('userName') || 'User'}`, cpu: 0.8, mem: 62.3, desc: '桌面窗口管理器', platform: '64 位', windowId: '' },
          { name: 'desktop.exe', pid: 16, status: '运行中', user: `${settings.get('userName') || 'User'}`, cpu: 0.6, mem: 38.1, desc: '桌面进程', platform: '64 位', windowId: '' },
          { name: 'taskbar.exe', pid: 20, status: '运行中', user: `${settings.get('userName') || 'User'}`, cpu: 0.4, mem: 24.8, desc: '任务栏', platform: '64 位', windowId: '' },
        ]
        const appDetails = windows.map((w, i) => {
          const meta = APP_META[w.appId] || { exe: w.appId + '.exe', publisher: 'HT Studio' }
          return {
            name: meta.exe,
            pid: 1000 + i,
            status: '运行中',
            user: settings.get('userName') || 'User',
            cpu: getCpuForApp(w.appId),
            mem: getMemForApp(w.appId),
            desc: w.title || w.appId,
            platform: '64 位',
            windowId: w.id,
          }
        })
        const all = [...appDetails, ...sysDetails]

        pages.details.innerHTML = `
          <div class="tm-details-list">
            <div class="tm-details-header">
              <div class="tm-col tm-col-name">名称</div>
              <div class="tm-col tm-col-pid">PID</div>
              <div class="tm-col tm-col-status">状态</div>
              <div class="tm-col tm-col-user">用户名</div>
              <div class="tm-col tm-col-cpu">CPU</div>
              <div class="tm-col tm-col-mem">内存</div>
              <div class="tm-col tm-col-desc">描述</div>
              <div class="tm-col tm-col-platform">平台</div>
            </div>
            <div class="tm-details-body">
              ${all.map(p => `
                <div class="tm-details-row" data-window-id="${p.windowId || ''}" data-pid="${p.pid}">
                  <div class="tm-col tm-col-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</div>
                  <div class="tm-col tm-col-pid">${p.pid}</div>
                  <div class="tm-col tm-col-status">${p.status}</div>
                  <div class="tm-col tm-col-user">${escapeHtml(p.user)}</div>
                  <div class="tm-col tm-col-cpu">${p.cpu.toFixed(1)}%</div>
                  <div class="tm-col tm-col-mem">${p.mem.toFixed(1)} MB</div>
                  <div class="tm-col tm-col-desc" title="${escapeHtml(p.desc)}">${escapeHtml(p.desc)}</div>
                  <div class="tm-col tm-col-platform">${p.platform}</div>
                </div>
              `).join('')}
            </div>
          </div>
        `

        let selectedRow: HTMLElement | null = null
        pages.details.querySelectorAll('.tm-details-row').forEach(row => {
          row.addEventListener('click', () => {
            if (selectedRow) selectedRow.classList.remove('selected')
            selectedRow = row as HTMLElement
            row.classList.add('selected')
          })
          row.addEventListener('dblclick', async () => {
            const windowId = (row as HTMLElement).dataset.windowId
            const procName = (row as HTMLElement).dataset.name || '进程'
            if (windowId) {
              if (!await requestUac(eventBus, { operation: '结束进程', resource: procName, source: '任务管理器' })) return
              wm.closeWindow(windowId)
            }
          })
        })
      }

      // ---------- 服务页 ----------
      const renderServices = () => {
        const services = serviceManager.getAll()
        pages.services.innerHTML = `
          <div class="tm-services-list">
            <div class="tm-services-header">
              <div class="tm-col tm-col-name">名称</div>
              <div class="tm-col tm-col-desc">描述</div>
              <div class="tm-col tm-col-status">状态</div>
              <div class="tm-col tm-col-starttype">启动类型</div>
              <div class="tm-col tm-col-pid">PID</div>
            </div>
            <div class="tm-services-body">
              ${services.map(s => `
                <div class="tm-service-row" data-id="${s.id}">
                  <div class="tm-col tm-col-name">${escapeHtml(s.name)}</div>
                  <div class="tm-col tm-col-desc" title="${escapeHtml(s.description)}">${escapeHtml(s.description)}</div>
                  <div class="tm-col tm-col-status">
                    <span class="tm-badge ${s.status === 'running' ? 'tm-badge-running' : s.status === 'disabled' ? 'tm-badge-disabled' : 'tm-badge-stopped'}">${s.status === 'running' ? '正在运行' : s.status === 'disabled' ? '已禁用' : '已停止'}</span>
                  </div>
                  <div class="tm-col tm-col-starttype">${s.startType === 'auto' ? '自动' : s.startType === 'manual' ? '手动' : '禁用'}</div>
                  <div class="tm-col tm-col-pid">${s.status === 'running' ? Math.abs(hashCode(s.id)) % 9000 + 1000 : '--'}</div>
                </div>
              `).join('')}
            </div>
          </div>
        `

        let selectedService: HTMLElement | null = null
        pages.services.querySelectorAll('.tm-service-row').forEach(row => {
          row.addEventListener('click', () => {
            if (selectedService) selectedService.classList.remove('selected')
            selectedService = row as HTMLElement
            row.classList.add('selected')
          })
        })
      }

      function hashCode(str: string): number {
        let h = 0
        for (let i = 0; i < str.length; i++) {
          h = ((h << 5) - h) + str.charCodeAt(i)
          h |= 0
        }
        return h
      }

      // ---------- 主刷新 ----------
      const refresh = () => {
        // 更新 CPU 历史
        const cpu = updateCpu()
        cpuHistory.shift()
        cpuHistory.push(cpu)
        const mem = getMemoryInfo()
        memoryHistory.shift()
        memoryHistory.push(mem.percent)

        // 状态栏
        const elapsed = Math.floor((Date.now() - startTime) / 1000)
        uptimeEl.textContent = `运行时长: ${formatTime(elapsed)}`
        cpuStatusEl.textContent = `CPU: ${cpu}%`
        memoryStatusEl.textContent = `内存: ${mem.used} MB`

        // 根据当前标签页刷新
        if (currentTab === 'processes') renderProcesses()
        else if (currentTab === 'performance') {
          const renderDetail = (pages.performance as any)._renderDetail
          if (renderDetail) renderDetail()
        }
        else if (currentTab === 'startup') renderStartup()
        else if (currentTab === 'users') renderUsers()
        else if (currentTab === 'details') renderDetails()
        else if (currentTab === 'services') renderServices()
      }

      // ---------- 标签页切换 ----------
      content.querySelectorAll('.tm-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          content.querySelectorAll('.tm-tab').forEach(t => t.classList.remove('active'))
          tab.classList.add('active')
          const target = (tab as HTMLElement).dataset.tab || 'processes'
          currentTab = target
          Object.entries(pages).forEach(([key, page]) => {
            page.style.display = key === target ? '' : 'none'
          })
          // 性能页切换时重新渲染整个页面（建立图表）
          if (target === 'performance') {
            renderPerformance()
          }
          refresh()
        })
      })

      // ---------- 右键菜单 ----------
      const ctxMenu = new ContextMenu()
      content.addEventListener('contextmenu', (e: MouseEvent) => {
        e.preventDefault()
        const items: any[] = [
          { label: '刷新', action: () => refresh() },
          { separator: true },
          {
            label: '复制选中项',
            action: async () => {
              try {
                const selected = content.querySelector('.tm-process-row.selected, .tm-details-row.selected, .tm-service-row.selected') as HTMLElement | null
                if (selected) {
                  await navigator.clipboard.writeText(selected.textContent || '')
                  await dialog.alert('已复制到剪贴板')
                } else {
                  await dialog.alert('请先选中一项')
                }
              } catch {
                await dialog.alert('复制失败')
              }
            }
          }
        ]
        ctxMenu.show(e.clientX, e.clientY, items)
      })

      // ---------- 初始化 ----------
      renderPerformance()
      refresh()

      // 每秒刷新
      const intervalId = window.setInterval(refresh, 1000)

      // 服务变化时自动刷新
      const unsubServices = serviceManager.onChange(() => {
        if (currentTab === 'services') renderServices()
      })

      // 关闭时清理
      win.onClose(() => {
        clearInterval(intervalId)
        unsubServices()
      })
    }
  })
}
