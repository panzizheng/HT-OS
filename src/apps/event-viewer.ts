// ============================================================
// 事件查看器 - 类似 Windows 事件查看器
// 左侧：通道（系统/应用程序/安全）与级别筛选；右侧：事件列表；底部：选中事件详情
// 支持刷新、清除日志、导出 JSON，订阅 eventLog.onChange 自动刷新
// ============================================================

import { WindowManager } from '../wm/WindowManager'
import { EventLog, LogEntry, EventChannel, EventLevel } from '../kernel/EventLog'
import { dialog } from '../desktop/Dialog'

// 蓝色文档 + 放大镜图标
const APP_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#0078d4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><circle cx="11" cy="14" r="3"/><line x1="13.2" y1="16.2" x2="15.5" y2="18.5"/></svg>'

// 级别 -> 中文文案
const levelText = (l: EventLevel): string => ({
  info: '信息', warning: '警告', error: '错误'
}[l])

// 级别 -> 颜色（info=蓝、warning=橙、error=红）
const levelColor = (l: EventLevel): string => ({
  info: '#0078d4', warning: '#f59e0b', error: '#dc2626'
}[l])

// 通道 -> 中文文案
const channelText = (c: EventChannel): string => ({
  System: '系统', Application: '应用程序', Security: '安全'
}[c])

// 格式化时间为 YYYY-MM-DD HH:mm:ss
const formatTime = (t: number): string => {
  const d = new Date(t)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function registerEventViewerApp(wm: WindowManager, eventLog: EventLog): void {
  wm.registerApp({
    id: 'event-viewer',
    name: '事件查看器',
    icon: APP_ICON,
    defaultWidth: 820,
    defaultHeight: 540,
    entry: (windowId: string) => {
      const win = wm.getWindow(windowId)
      if (!win) return
      const content = win.content
      content.className = 'event-viewer-app window-content'

      // 当前通道与级别筛选状态
      let selectedChannel: EventChannel = 'System'
      let selectedLevel: EventLevel | 'all' = 'all'
      let selectedEntryId: number | null = null
      let autoRefresh = true

      // 内联样式（应用特有，避免修改全局样式表）
      const styleEl = document.createElement('style')
      styleEl.textContent = `
        .event-viewer-app { display: flex; flex-direction: column; height: 100%; background: #fff; }
        .ev-menubar { height: 28px; background: #f5f5f5; border-bottom: 1px solid var(--window-border); display: flex; align-items: stretch; flex-shrink: 0; }
        .ev-menubar .menu { position: relative; }
        .ev-body { flex: 1; display: flex; min-height: 0; }
        .ev-sidebar { width: 180px; border-right: 1px solid var(--window-border); background: #fafafa; overflow-y: auto; flex-shrink: 0; }
        .ev-sidebar-section { padding: 8px 0; border-bottom: 1px solid #eee; }
        .ev-sidebar-title { padding: 4px 12px; font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
        .ev-sidebar-item { padding: 6px 18px; font-size: 13px; color: var(--text-dark); cursor: pointer; display: flex; align-items: center; gap: 6px; }
        .ev-sidebar-item:hover { background: #eef4fb; }
        .ev-sidebar-item.selected { background: #cfe2f3; font-weight: 600; }
        .ev-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
        .ev-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .ev-list-wrap { flex: 1; overflow: auto; position: relative; }
        .ev-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .ev-table thead th { position: sticky; top: 0; background: #f0f0f0; border-bottom: 1px solid var(--window-border); padding: 6px 8px; text-align: left; font-weight: 600; color: #444; z-index: 1; }
        .ev-table tbody tr { cursor: pointer; border-bottom: 1px solid #f0f0f0; }
        .ev-table tbody tr:hover { background: #f5f9ff; }
        .ev-table tbody tr.selected { background: #e6f0fb; }
        .ev-table td { padding: 5px 8px; color: var(--text-dark); white-space: nowrap; }
        .ev-table td.col-message { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 320px; }
        .ev-level { display: inline-flex; align-items: center; gap: 4px; }
        .ev-detail { height: 140px; border-top: 1px solid var(--window-border); background: #fafafa; padding: 8px 12px; overflow-y: auto; font-size: 12px; color: #333; flex-shrink: 0; }
        .ev-detail-empty { color: #999; text-align: center; padding: 30px 0; }
        .ev-detail-row { margin: 2px 0; line-height: 1.6; }
        .ev-detail-row b { color: #555; display: inline-block; width: 70px; }
        .ev-statusbar { height: 22px; background: #f5f5f5; border-top: 1px solid var(--window-border); padding: 0 12px; font-size: 11px; color: #666; display: flex; align-items: center; flex-shrink: 0; }
      `
      content.appendChild(styleEl)

      const wrapper = document.createElement('div')
      wrapper.style.display = 'flex'
      wrapper.style.flexDirection = 'column'
      wrapper.style.height = '100%'
      wrapper.innerHTML = `
        <div class="ev-menubar">
          <div class="menu">
            <span class="menu-label">操作(A)</span>
            <div class="menu-dropdown">
              <div class="menu-item" data-action="refresh">刷新</div>
              <div class="menu-separator"></div>
              <div class="menu-item" data-action="clear">清除所有日志...</div>
              <div class="menu-item" data-action="export">导出为 JSON...</div>
              <div class="menu-separator"></div>
              <div class="menu-item" data-action="exit">退出</div>
            </div>
          </div>
          <div class="menu">
            <span class="menu-label">查看(V)</span>
            <div class="menu-dropdown">
              <div class="menu-item" data-action="toggle-auto">自动刷新 (开)</div>
            </div>
          </div>
          <div class="menu">
            <span class="menu-label">帮助(H)</span>
            <div class="menu-dropdown">
              <div class="menu-item" data-action="about">关于事件查看器</div>
            </div>
          </div>
        </div>
        <div class="ev-body">
          <div class="ev-sidebar" id="ev-sidebar">
            <div class="ev-sidebar-section">
              <div class="ev-sidebar-title">通道</div>
              <div class="ev-sidebar-item" data-channel="System"><span class="ev-dot" style="background:#0078d4;"></span>系统</div>
              <div class="ev-sidebar-item" data-channel="Application"><span class="ev-dot" style="background:#16a34a;"></span>应用程序</div>
              <div class="ev-sidebar-item" data-channel="Security"><span class="ev-dot" style="background:#6b7280;"></span>安全</div>
            </div>
            <div class="ev-sidebar-section">
              <div class="ev-sidebar-title">级别</div>
              <div class="ev-sidebar-item" data-level="all"><span class="ev-dot" style="background:#888;"></span>所有事件</div>
              <div class="ev-sidebar-item" data-level="warning"><span class="ev-dot" style="background:#f59e0b;"></span>仅警告</div>
              <div class="ev-sidebar-item" data-level="error"><span class="ev-dot" style="background:#dc2626;"></span>仅错误</div>
            </div>
          </div>
          <div class="ev-main">
            <div class="ev-list-wrap" id="ev-list-wrap">
              <table class="ev-table">
                <thead>
                  <tr>
                    <th style="width:150px;">时间</th>
                    <th style="width:100px;">来源</th>
                    <th style="width:70px;">事件 ID</th>
                    <th style="width:80px;">级别</th>
                    <th>消息</th>
                  </tr>
                </thead>
                <tbody id="ev-tbody"></tbody>
              </table>
            </div>
            <div class="ev-detail" id="ev-detail">
              <div class="ev-detail-empty">未选中任何事件。请在上方列表中选择一个事件以查看详情。</div>
            </div>
          </div>
        </div>
        <div class="ev-statusbar" id="ev-statusbar">共 0 条事件</div>
      `
      content.appendChild(wrapper)

      const sidebarEl = wrapper.querySelector('#ev-sidebar') as HTMLElement
      const tbodyEl = wrapper.querySelector('#ev-tbody') as HTMLElement
      const detailEl = wrapper.querySelector('#ev-detail') as HTMLElement
      const statusbarEl = wrapper.querySelector('#ev-statusbar') as HTMLElement

      // HTML 转义
      const esc = (s: string): string => s.replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[c]!))

      // 取得当前筛选结果（按通道 + 级别），按时间倒序
      const getFiltered = (): LogEntry[] => {
        let list = eventLog.getByChannel(selectedChannel)
        if (selectedLevel !== 'all') {
          list = list.filter(e => e.level === selectedLevel)
        }
        return list.slice().sort((a, b) => b.time - a.time)
      }

      // 渲染事件列表
      const renderList = () => {
        const list = getFiltered()
        tbodyEl.innerHTML = ''
        if (list.length === 0) {
          tbodyEl.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#999;padding:30px;">没有符合条件的事件</td></tr>`
        } else {
          for (const entry of list) {
            const row = document.createElement('tr')
            row.dataset.id = String(entry.id)
            if (entry.id === selectedEntryId) row.classList.add('selected')
            const color = levelColor(entry.level)
            row.innerHTML = `
              <td>${esc(formatTime(entry.time))}</td>
              <td>${esc(entry.source)}</td>
              <td>${entry.eventId}</td>
              <td><span class="ev-level"><span class="ev-dot" style="background:${color};"></span><span style="color:${color};">${levelText(entry.level)}</span></span></td>
              <td class="col-message" title="${esc(entry.message)}">${esc(entry.message)}</td>
            `
            row.addEventListener('click', () => selectEntry(entry.id))
            tbodyEl.appendChild(row)
          }
        }
        statusbarEl.textContent = `共 ${list.length} 条事件  ·  通道：${channelText(selectedChannel)}  ·  级别：${selectedLevel === 'all' ? '所有' : levelText(selectedLevel)}`
      }

      // 渲染底部详情区
      const renderDetail = () => {
        const entry = selectedEntryId != null
          ? eventLog.getAll().find(e => e.id === selectedEntryId)
          : undefined
        if (!entry) {
          detailEl.innerHTML = `<div class="ev-detail-empty">未选中任何事件。请在上方列表中选择一个事件以查看详情。</div>`
          return
        }
        const color = levelColor(entry.level)
        detailEl.innerHTML = `
          <div class="ev-detail-row"><b>日志名称:</b> ${channelText(entry.channel)}</div>
          <div class="ev-detail-row"><b>来源:</b> ${esc(entry.source)}</div>
          <div class="ev-detail-row"><b>时间:</b> ${esc(formatTime(entry.time))}</div>
          <div class="ev-detail-row"><b>事件 ID:</b> ${entry.eventId}</div>
          <div class="ev-detail-row"><b>级别:</b> <span style="color:${color};">${levelText(entry.level)}</span></div>
          <div class="ev-detail-row" style="margin-top:8px;"><b>描述:</b></div>
          <div class="ev-detail-row" style="white-space:pre-wrap;word-break:break-word;">${esc(entry.message)}</div>
        `
      }

      // 选中某个事件
      const selectEntry = (id: number) => {
        selectedEntryId = id
        tbodyEl.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'))
        const target = tbodyEl.querySelector(`[data-id="${id}"]`)
        if (target) target.classList.add('selected')
        renderDetail()
      }

      // 渲染侧边栏选中态
      const renderSidebar = () => {
        sidebarEl.querySelectorAll<HTMLElement>('.ev-sidebar-item').forEach(item => {
          item.classList.remove('selected')
          if (item.dataset.channel && item.dataset.channel === selectedChannel) item.classList.add('selected')
          if (item.dataset.level && item.dataset.level === selectedLevel) item.classList.add('selected')
        })
      }

      // 整体渲染
      const render = () => {
        renderSidebar()
        renderList()
        renderDetail()
      }

      // 侧边栏点击：切换通道 / 级别
      sidebarEl.querySelectorAll<HTMLElement>('.ev-sidebar-item').forEach(item => {
        item.addEventListener('click', () => {
          if (item.dataset.channel) {
            selectedChannel = item.dataset.channel as EventChannel
          } else if (item.dataset.level) {
            selectedLevel = item.dataset.level as EventLevel | 'all'
          }
          render()
        })
      })

      // 菜单栏：点击标签切换下拉
      wrapper.querySelectorAll<HTMLElement>('.menu-label').forEach(label => {
        label.addEventListener('click', (e) => {
          e.stopPropagation()
          const dropdown = label.nextElementSibling as HTMLElement | null
          const isOpen = dropdown?.classList.contains('open')
          wrapper.querySelectorAll('.menu-dropdown').forEach(d => d.classList.remove('open'))
          if (!isOpen) dropdown?.classList.add('open')
        })
      })
      // 点击其他位置关闭下拉
      content.addEventListener('click', () => {
        wrapper.querySelectorAll('.menu-dropdown').forEach(d => d.classList.remove('open'))
      })

      // 导出当前筛选结果为 JSON 文件下载
      const exportJson = () => {
        const list = getFiltered()
        const payload = {
          exportedAt: new Date().toISOString(),
          channel: selectedChannel,
          level: selectedLevel,
          count: list.length,
          entries: list
        }
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `event-log-${formatTime(Date.now()).replace(/[: ]/g, '-')}.json`
        a.click()
        URL.revokeObjectURL(url)
      }

      // 清除所有日志（需确认）
      const clearLog = async () => {
        const ok = await dialog.confirm(
          '确认清除所有事件日志吗？\n此操作将永久删除所有通道中的所有事件，且不可恢复。',
          '清除日志'
        )
        if (ok) {
          eventLog.clear()
          selectedEntryId = null
          render()
          await dialog.alert('已清除所有事件日志。')
        }
      }

      // 菜单项动作分发
      const runAction = async (action: string) => {
        wrapper.querySelectorAll('.menu-dropdown').forEach(d => d.classList.remove('open'))
        switch (action) {
          case 'refresh':
            render()
            break
          case 'clear':
            await clearLog()
            break
          case 'export':
            exportJson()
            break
          case 'toggle-auto': {
            autoRefresh = !autoRefresh
            const toggleItem = wrapper.querySelector('[data-action="toggle-auto"]')
            if (toggleItem) toggleItem.textContent = `自动刷新 (${autoRefresh ? '开' : '关'})`
            await dialog.alert(`自动刷新已${autoRefresh ? '开启' : '关闭'}。`)
            break
          }
          case 'exit':
            win.close()
            break
          case 'about':
            await dialog.alert('HT OS 事件查看器 v1.0.0\n\n查看系统、应用程序与安全通道的事件日志。\n类似 Windows 事件查看器。')
            break
        }
      }

      wrapper.querySelectorAll<HTMLElement>('.menu-item').forEach(item => {
        item.addEventListener('click', () => {
          const action = item.dataset.action
          if (action) runAction(action)
        })
      })

      // 订阅 eventLog.onChange：自动刷新；窗口已从 DOM 移除时取消订阅，避免内存泄漏
      const unsub = eventLog.onChange(() => {
        if (!document.contains(content)) {
          unsub()
          return
        }
        if (autoRefresh) render()
      })

      // 首次渲染
      render()
    }
  })
}
