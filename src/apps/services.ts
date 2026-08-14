// ============================================================
// 服务管理器 - 类似 Windows services.msc
// 列出系统服务，支持启动/停止/重启/禁用，三种视图模式
// ============================================================

import { WindowManager } from '../wm/WindowManager'
import { ServiceManager, SystemService, ServiceStatus, ServiceStartType } from '../kernel/ServiceManager'
import { EventBus } from '../kernel/EventBus'
import { dialog } from '../desktop/Dialog'
import { requestUac } from '../kernel/UAC'

// 灰色齿轮图标
const APP_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'

// 状态 -> 中文文案
const statusText = (s: ServiceStatus): string => ({
  running: '正在运行', stopped: '已停止', starting: '正在启动', stopping: '正在停止', disabled: '已禁用'
}[s])

// 状态 -> 颜色（running=绿、stopped=灰、disabled=红）
const statusColor = (s: ServiceStatus): string => ({
  running: '#16a34a', stopped: '#9ca3af', starting: '#f59e0b', stopping: '#f59e0b', disabled: '#dc2626'
}[s])

// 启动类型 -> 中文文案
const startTypeText = (t: ServiceStartType): string => ({
  auto: '自动', manual: '手动', disabled: '禁用'
}[t])

export function registerServicesApp(wm: WindowManager, serviceManager: ServiceManager, eventBus: EventBus): void {
  wm.registerApp({
    id: 'services',
    name: '服务管理器',
    icon: APP_ICON,
    defaultWidth: 720,
    defaultHeight: 480,
    entry: (windowId: string) => {
      const win = wm.getWindow(windowId)
      if (!win) return
      const content = win.content
      content.className = 'services-app window-content'

      type ViewMode = 'detail' | 'large' | 'small'
      let viewMode: ViewMode = 'detail'
      let selectedId: string | null = null

      // 内联样式（应用特有，避免修改全局样式表）
      const styleEl = document.createElement('style')
      styleEl.textContent = `
        .services-app { display: flex; flex-direction: column; height: 100%; background: #fff; }
        .services-menubar { height: 28px; background: #f5f5f5; border-bottom: 1px solid var(--window-border); display: flex; align-items: stretch; flex-shrink: 0; }
        .services-menubar .menu { position: relative; }
        .services-toolbar { display: flex; align-items: center; gap: 6px; padding: 6px 10px; border-bottom: 1px solid var(--window-border); background: #fafafa; flex-shrink: 0; }
        .svc-btn { padding: 4px 14px; font-size: 12px; border: 1px solid var(--window-border); background: #fff; color: var(--text-dark); border-radius: 4px; cursor: pointer; }
        .svc-btn:hover:not(:disabled) { background: #f0f7ff; border-color: var(--theme-color); }
        .svc-btn:disabled { color: #bbb; background: #f3f3f3; cursor: not-allowed; }
        .svc-btn.danger { color: #c0392b; }
        .svc-btn.danger:hover:not(:disabled) { background: #fdecea; border-color: #c0392b; }
        .svc-toolbar-spacer { flex: 1; }
        .services-list { flex: 1; overflow: auto; position: relative; }
        .services-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .services-table thead th { position: sticky; top: 0; background: #f0f0f0; border-bottom: 1px solid var(--window-border); padding: 6px 10px; text-align: left; font-weight: 600; color: #444; z-index: 1; }
        .services-table tbody tr { cursor: pointer; border-bottom: 1px solid #f0f0f0; }
        .services-table tbody tr:hover { background: #f5f9ff; }
        .services-table tbody tr.selected { background: #e6f0fb; }
        .services-table td { padding: 6px 10px; color: var(--text-dark); }
        .svc-status { display: inline-flex; align-items: center; gap: 6px; }
        .svc-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
        .svc-icon-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 10px; padding: 14px; }
        .svc-icon-cell { display: flex; flex-direction: column; align-items: center; padding: 10px 6px; border-radius: 6px; cursor: pointer; text-align: center; }
        .svc-icon-cell:hover { background: #f5f9ff; }
        .svc-icon-cell.selected { background: #e6f0fb; }
        .svc-icon-cell svg { width: 32px; height: 32px; }
        .svc-icon-cell.small svg { width: 16px; height: 16px; }
        .svc-icon-cell.small { flex-direction: row; justify-content: flex-start; gap: 8px; padding: 6px 12px; }
        .svc-icon-cell.small .svc-icon-name { font-size: 13px; }
        .svc-icon-cell.small .svc-icon-sub { font-size: 11px; color: #888; margin-left: auto; }
        .svc-icon-name { font-size: 12px; margin-top: 6px; color: var(--text-dark); word-break: break-word; }
        .svc-icon-status { font-size: 11px; margin-top: 2px; }
        .services-statusbar { height: 44px; background: #f5f5f5; border-top: 1px solid var(--window-border); padding: 4px 12px; font-size: 12px; color: #555; display: flex; flex-direction: column; justify-content: center; flex-shrink: 0; line-height: 1.5; }
        .services-statusbar .svc-detail { color: #333; }
        .services-statusbar .svc-detail b { color: var(--text-dark); }
        /* 右键菜单 */
        .svc-ctxmenu { position: fixed; display: none; background: #fff; border: 1px solid var(--window-border); border-radius: 4px; min-width: 180px; box-shadow: var(--shadow-menu); padding: 4px; z-index: 100000; }
        .svc-ctx-item { padding: 6px 16px; font-size: 13px; cursor: pointer; border-radius: 3px; color: var(--text-dark); }
        .svc-ctx-item:hover:not(.disabled) { background: var(--theme-color); color: #fff; }
        .svc-ctx-item.disabled { color: #bbb; cursor: not-allowed; }
        .svc-ctx-sep { height: 1px; background: var(--window-border); margin: 4px 6px; }
      `
      content.appendChild(styleEl)

      const wrapper = document.createElement('div')
      wrapper.className = 'services-app-inner'
      wrapper.innerHTML = `
        <div class="services-menubar">
          <div class="menu">
            <span class="menu-label">操作(A)</span>
            <div class="menu-dropdown">
              <div class="menu-item" data-action="refresh">刷新</div>
              <div class="menu-separator"></div>
              <div class="menu-item" data-action="start">启动服务</div>
              <div class="menu-item" data-action="stop">停止服务</div>
              <div class="menu-item" data-action="restart">重启服务</div>
              <div class="menu-separator"></div>
              <div class="menu-item" data-action="exit">退出</div>
            </div>
          </div>
          <div class="menu">
            <span class="menu-label">查看(V)</span>
            <div class="menu-dropdown">
              <div class="menu-item" data-action="view-large">大图标</div>
              <div class="menu-item" data-action="view-small">小图标</div>
              <div class="menu-item" data-action="view-detail">详细信息</div>
            </div>
          </div>
          <div class="menu">
            <span class="menu-label">帮助(H)</span>
            <div class="menu-dropdown">
              <div class="menu-item" data-action="about">关于服务管理器</div>
            </div>
          </div>
        </div>
        <div class="services-toolbar">
          <button class="svc-btn" data-act="start">启动</button>
          <button class="svc-btn" data-act="stop">停止</button>
          <button class="svc-btn" data-act="restart">重启</button>
          <button class="svc-btn danger" data-act="disable">禁用</button>
          <span class="svc-toolbar-spacer"></span>
          <button class="svc-btn" data-act="refresh">刷新</button>
        </div>
        <div class="services-list" id="services-list"></div>
        <div class="services-statusbar" id="services-statusbar">共 0 个服务</div>
      `
      content.appendChild(wrapper)

      const listEl = wrapper.querySelector('#services-list') as HTMLElement
      const statusbarEl = wrapper.querySelector('#services-statusbar') as HTMLElement
      const toolbarBtns = wrapper.querySelectorAll<HTMLButtonElement>('.svc-btn')

      // 右键菜单元素（挂到 body 以便浮于所有窗口之上）
      const ctxMenuEl = document.createElement('div')
      ctxMenuEl.className = 'svc-ctxmenu'
      document.body.appendChild(ctxMenuEl)

      // HTML 转义
      const esc = (s: string): string => s.replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[c]!))

      // 渲染服务列表
      const render = () => {
        const services = serviceManager.getAll()
        if (viewMode === 'detail') renderDetail(services)
        else renderIcons(services, viewMode === 'large')
        updateButtons()
        updateStatusbar()
      }

      // 详细信息视图（表格）
      const renderDetail = (services: SystemService[]) => {
        listEl.innerHTML = `
          <table class="services-table">
            <thead>
              <tr>
                <th>名称</th>
                <th>描述</th>
                <th style="width:110px;">状态</th>
                <th style="width:90px;">启动类型</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        `
        const tbody = listEl.querySelector('tbody') as HTMLElement
        if (services.length === 0) {
          tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#999;padding:20px;">暂无服务</td></tr>`
          return
        }
        for (const svc of services) {
          const row = document.createElement('tr')
          row.dataset.id = svc.id
          if (svc.id === selectedId) row.classList.add('selected')
          const color = statusColor(svc.status)
          row.innerHTML = `
            <td>${esc(svc.name)}</td>
            <td style="color:#666;">${esc(svc.description)}</td>
            <td><span class="svc-status"><span class="svc-dot" style="background:${color};"></span><span style="color:${color};">${statusText(svc.status)}</span></span></td>
            <td>${startTypeText(svc.startType)}</td>
          `
          row.addEventListener('click', () => selectService(svc.id))
          row.addEventListener('contextmenu', (e: MouseEvent) => {
            e.preventDefault()
            selectService(svc.id)
            showContextMenu(e.clientX, e.clientY, svc)
          })
          row.addEventListener('dblclick', () => {
            // 双击切换运行状态
            if (svc.status === 'running') doStop(svc.id)
            else if (svc.status === 'stopped') doStart(svc.id)
          })
          tbody.appendChild(row)
        }
      }

      // 图标视图（大/小）
      const renderIcons = (services: SystemService[], large: boolean) => {
        listEl.innerHTML = `<div class="svc-icon-grid"></div>`
        const grid = listEl.querySelector('.svc-icon-grid') as HTMLElement
        if (!large) grid.style.gridTemplateColumns = '1fr'
        for (const svc of services) {
          const cell = document.createElement('div')
          cell.className = 'svc-icon-cell' + (large ? '' : ' small') + (svc.id === selectedId ? ' selected' : '')
          cell.dataset.id = svc.id
          const color = statusColor(svc.status)
          const dot = `<span class="svc-dot" style="background:${color};"></span>`
          cell.innerHTML = `
            ${APP_ICON}
            <span class="svc-icon-name">${esc(svc.name)}</span>
            ${large
              ? `<span class="svc-icon-status" style="color:${color};">${dot} ${statusText(svc.status)}</span>`
              : `<span class="svc-icon-sub" style="color:${color};">${statusText(svc.status)}</span>`
            }
          `
          cell.addEventListener('click', () => selectService(svc.id))
          cell.addEventListener('contextmenu', (e: MouseEvent) => {
            e.preventDefault()
            selectService(svc.id)
            showContextMenu(e.clientX, e.clientY, svc)
          })
          grid.appendChild(cell)
        }
      }

      // 选中服务
      const selectService = (id: string) => {
        selectedId = id
        // 更新高亮，不整体重渲染
        listEl.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'))
        const target = listEl.querySelector(`[data-id="${id}"]`)
        if (target) target.classList.add('selected')
        updateButtons()
        updateStatusbar()
      }

      // 更新工具栏按钮的可用状态
      const updateButtons = () => {
        const svc = selectedId ? serviceManager.get(selectedId) : undefined
        const map: Record<string, boolean> = {
          start: !!svc && svc.status !== 'running' && svc.status !== 'disabled',
          stop: !!svc && svc.status === 'running',
          restart: !!svc && svc.status === 'running',
          disable: !!svc && svc.startType !== 'disabled',
          refresh: true
        }
        toolbarBtns.forEach(btn => {
          const act = btn.dataset.act
          btn.disabled = act ? !map[act] : true
        })
      }

      // 更新底部状态栏
      const updateStatusbar = () => {
        const services = serviceManager.getAll()
        const svc = selectedId ? serviceManager.get(selectedId) : undefined
        if (svc) {
          statusbarEl.innerHTML = `
            <div class="svc-detail"><b>${esc(svc.name)}</b> （${esc(svc.id)}）</div>
            <div class="svc-detail">${esc(svc.description)}</div>
            <div class="svc-detail" style="color:${statusColor(svc.status)};">状态：${statusText(svc.status)}  ·  启动类型：${startTypeText(svc.startType)}  ·  共 ${services.length} 个服务</div>
          `
        } else {
          statusbarEl.textContent = `共 ${services.length} 个服务`
        }
      }

      // ===== 服务操作 =====
      const doStart = async (id: string) => {
        const svc = serviceManager.get(id)
        if (!svc) return
        if (!await requestUac(eventBus, { operation: '启动服务', resource: svc.name, source: '服务管理器' })) return
        const ok = await serviceManager.start(id)
        if (!ok) await dialog.alert('服务启动失败，请查看事件日志。')
      }
      const doStop = async (id: string) => {
        const svc = serviceManager.get(id)
        if (!svc) return
        if (!await requestUac(eventBus, { operation: '停止服务', resource: svc.name, source: '服务管理器' })) return
        const ok = await serviceManager.stop(id)
        if (!ok) await dialog.alert('服务停止失败，请查看事件日志。')
      }
      const doRestart = async (id: string) => {
        const svc = serviceManager.get(id)
        if (!svc) return
        if (!await requestUac(eventBus, { operation: '重启服务', resource: svc.name, source: '服务管理器' })) return
        await serviceManager.stop(id)
        await serviceManager.start(id)
      }
      const doDisable = async (id: string) => {
        const svc = serviceManager.get(id)
        if (!svc) return
        if (!await requestUac(eventBus, { operation: '禁用服务', resource: svc.name, source: '服务管理器' })) return
        if (await dialog.confirm(`确定要禁用服务 "${svc.name}" 吗？\n禁用后该服务将无法启动，直至重新启用。`, '禁用服务')) {
          serviceManager.setStartType(id, 'disabled')
        }
      }
      const doSetStartType = async (id: string, type: ServiceStartType) => {
        const svc = serviceManager.get(id)
        if (!svc) return
        if (!await requestUac(eventBus, { operation: '修改服务启动类型', resource: svc.name, source: '服务管理器' })) return
        serviceManager.setStartType(id, type)
      }

      // ===== 右键菜单 =====
      const hideContextMenu = () => { ctxMenuEl.style.display = 'none' }

      const showContextMenu = (x: number, y: number, svc: SystemService) => {
        const items: Array<{ label: string; action?: () => void; disabled?: boolean } | { sep: true }> = [
          { label: '启动', action: () => doStart(svc.id), disabled: svc.status === 'running' || svc.status === 'disabled' },
          { label: '停止', action: () => doStop(svc.id), disabled: svc.status !== 'running' },
          { label: '重启', action: () => doRestart(svc.id), disabled: svc.status !== 'running' },
          { sep: true },
          { label: '设置为：自动', action: () => doSetStartType(svc.id, 'auto'), disabled: svc.startType === 'auto' },
          { label: '设置为：手动', action: () => doSetStartType(svc.id, 'manual'), disabled: svc.startType === 'manual' },
          { label: '设置为：禁用', action: () => doDisable(svc.id), disabled: svc.startType === 'disabled' }
        ]
        ctxMenuEl.innerHTML = ''
        for (const it of items) {
          if ('sep' in it) {
            const sep = document.createElement('div')
            sep.className = 'svc-ctx-sep'
            ctxMenuEl.appendChild(sep)
            continue
          }
          const el = document.createElement('div')
          el.className = 'svc-ctx-item' + (it.disabled ? ' disabled' : '')
          el.textContent = it.label
          if (!it.disabled && it.action) {
            el.addEventListener('click', () => { it.action!(); hideContextMenu() })
          }
          ctxMenuEl.appendChild(el)
        }
        ctxMenuEl.style.display = 'block'
        ctxMenuEl.style.visibility = 'hidden'
        ctxMenuEl.style.left = '0px'
        ctxMenuEl.style.top = '0px'
        const rect = ctxMenuEl.getBoundingClientRect()
        let left = x, top = y
        if (x + rect.width > window.innerWidth) left = Math.max(0, window.innerWidth - rect.width - 4)
        if (y + rect.height > window.innerHeight) top = Math.max(0, window.innerHeight - rect.height - 4)
        ctxMenuEl.style.left = left + 'px'
        ctxMenuEl.style.top = top + 'px'
        ctxMenuEl.style.visibility = 'visible'
      }

      // 点击外部 / Esc 关闭右键菜单
      const onCtxOutside = (e: MouseEvent) => {
        if (!ctxMenuEl.contains(e.target as Node)) hideContextMenu()
      }
      const onCtxEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') hideContextMenu() }
      document.addEventListener('mousedown', onCtxOutside)
      document.addEventListener('keydown', onCtxEsc)

      // 窗口内点击空白也关闭右键菜单
      listEl.addEventListener('mousedown', onCtxOutside, true)

      // ===== 菜单栏 =====
      // 菜单标签点击：切换下拉
      wrapper.querySelectorAll<HTMLElement>('.menu-label').forEach(label => {
        label.addEventListener('click', (e) => {
          e.stopPropagation()
          const dropdown = label.nextElementSibling as HTMLElement | null
          const isOpen = dropdown?.classList.contains('open')
          wrapper.querySelectorAll('.menu-dropdown').forEach(d => d.classList.remove('open'))
          if (!isOpen) dropdown?.classList.add('open')
        })
      })
      // 点击内容区其他位置关闭下拉菜单
      content.addEventListener('click', () => {
        wrapper.querySelectorAll('.menu-dropdown').forEach(d => d.classList.remove('open'))
      })

      // 菜单项 / 工具栏按钮统一动作分发
      const runAction = async (action: string) => {
        wrapper.querySelectorAll('.menu-dropdown').forEach(d => d.classList.remove('open'))
        const id = selectedId
        switch (action) {
          case 'refresh':
            render()
            break
          case 'start':
            if (id) await doStart(id)
            break
          case 'stop':
            if (id) await doStop(id)
            break
          case 'restart':
            if (id) await doRestart(id)
            break
          case 'disable':
            if (id) await doDisable(id)
            break
          case 'view-large':
            viewMode = 'large'
            render()
            break
          case 'view-small':
            viewMode = 'small'
            render()
            break
          case 'view-detail':
            viewMode = 'detail'
            render()
            break
          case 'exit':
            win.close()
            break
          case 'about':
            await dialog.alert('HT OS 服务管理器 v1.0.0\n\n管理系统后台服务的启动、停止与启动类型。\n类似 Windows services.msc。')
            break
        }
      }

      wrapper.querySelectorAll<HTMLElement>('.menu-item').forEach(item => {
        item.addEventListener('click', () => {
          const action = item.dataset.action
          if (action) runAction(action)
        })
      })

      toolbarBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const act = btn.dataset.act
          if (act) runAction(act)
        })
      })

      // 监听服务管理器变更：自动刷新
      const onChangeUnsub = serviceManager.onChange(() => {
        // 窗口已关闭则取消订阅，避免无谓渲染与内存泄漏
        if (!document.contains(content)) {
          onChangeUnsub()
          return
        }
        render()
      })

      // 首次渲染
      render()
    }
  })
}
