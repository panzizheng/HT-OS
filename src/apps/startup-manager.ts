// ============================================================
// 启动项管理器 - 类似 Windows 任务管理器的"启动"选项卡
// 管理开机自启动应用：启用 / 禁用 / 删除 / 添加
// ============================================================

import { WindowManager } from '../wm/WindowManager'
import { StartupManager, StartupItem } from '../kernel/StartupManager'
import { dialog } from '../desktop/Dialog'

// 蓝色火箭图标
const APP_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>'

export function registerStartupManagerApp(wm: WindowManager, startupManager: StartupManager): void {
  wm.registerApp({
    id: 'startup-manager',
    name: '启动项管理',
    icon: APP_ICON,
    defaultWidth: 680,
    defaultHeight: 460,
    entry: (windowId: string) => {
      const win = wm.getWindow(windowId)
      if (!win) return
      const content = win.content
      content.className = 'startup-manager-app window-content'

      // 当前选中的启动项 ID
      let selectedId: string | null = null

      // 内联样式（应用特有，避免修改全局样式表）
      const styleEl = document.createElement('style')
      styleEl.textContent = `
        .startup-manager-app { display: flex; flex-direction: column; height: 100%; background: #fff; }
        .su-wrapper { display: flex; flex-direction: column; height: 100%; }
        .su-header { padding: 10px 14px; font-size: 12px; color: #555; background: #fafafa; border-bottom: 1px solid var(--window-border); flex-shrink: 0; }
        .su-list { flex: 1; overflow: auto; position: relative; }
        .su-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .su-table thead th { position: sticky; top: 0; background: #f0f0f0; border-bottom: 1px solid var(--window-border); padding: 7px 12px; text-align: left; font-weight: 600; color: #444; z-index: 1; }
        .su-table tbody tr { cursor: pointer; border-bottom: 1px solid #f0f0f0; }
        .su-table tbody tr:hover { background: #f5f9ff; }
        .su-table tbody tr.selected { background: #e6f0fb; }
        .su-table td { padding: 7px 12px; color: var(--text-dark); }
        .su-mono { font-family: ui-monospace, Menlo, Consolas, monospace; color: #666; font-size: 12px; }
        .su-empty { text-align: center; color: #999; padding: 20px; }
        /* 开关样式 */
        .su-switch { display: inline-block; width: 34px; height: 18px; border-radius: 10px; background: #ccc; position: relative; cursor: pointer; transition: background .15s; vertical-align: middle; }
        .su-switch.on { background: #16a34a; }
        .su-switch-knob { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: transform .15s; box-shadow: 0 1px 2px rgba(0,0,0,.3); }
        .su-switch.on .su-switch-knob { transform: translateX(16px); }
        /* 来源徽标 */
        .su-source { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 11px; }
        .su-source.system { background: #eef2ff; color: #4338ca; }
        .su-source.user { background: #ecfdf5; color: #047857; }
        /* 底部按钮栏 */
        .su-footer { display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-top: 1px solid var(--window-border); background: #fafafa; flex-shrink: 0; }
        .su-btn { padding: 5px 16px; font-size: 12px; border: 1px solid var(--window-border); background: #fff; color: var(--text-dark); border-radius: 4px; cursor: pointer; }
        .su-btn:hover:not(:disabled) { background: #f0f7ff; border-color: var(--theme-color); }
        .su-btn:disabled { color: #bbb; background: #f3f3f3; cursor: not-allowed; }
        .su-btn.primary { color: #fff; background: var(--theme-color); border-color: var(--theme-color); }
        .su-btn.primary:hover:not(:disabled) { opacity: .9; background: var(--theme-color); }
        .su-btn.danger { color: #c0392b; }
        .su-btn.danger:hover:not(:disabled) { background: #fdecea; border-color: #c0392b; }
        .su-spacer { flex: 1; }
        /* 右键菜单 */
        .su-ctxmenu { position: fixed; display: none; background: #fff; border: 1px solid var(--window-border); border-radius: 4px; min-width: 160px; box-shadow: var(--shadow-menu); padding: 4px; z-index: 100000; }
        .su-ctx-item { padding: 6px 16px; font-size: 13px; cursor: pointer; border-radius: 3px; color: var(--text-dark); }
        .su-ctx-item:hover:not(.disabled) { background: var(--theme-color); color: #fff; }
        .su-ctx-item.disabled { color: #bbb; cursor: not-allowed; }
        .su-ctx-sep { height: 1px; background: var(--window-border); margin: 4px 6px; }
        /* 添加对话框表单 */
        .su-form-row { display: flex; align-items: center; margin-bottom: 12px; }
        .su-form-row label { width: 70px; font-size: 13px; color: #444; flex-shrink: 0; }
        .su-form-input { flex: 1; padding: 5px 8px; font-size: 13px; border: 1px solid #d0d0d0; border-radius: 3px; outline: none; }
        .su-form-input:focus { border-color: var(--theme-color); }
      `
      content.appendChild(styleEl)

      const wrapper = document.createElement('div')
      wrapper.className = 'su-wrapper'
      wrapper.innerHTML = `
        <div class="su-header">管理开机时自动启动的应用程序</div>
        <div class="su-list" id="su-list"></div>
        <div class="su-footer">
          <button class="su-btn" data-act="enable">启用</button>
          <button class="su-btn" data-act="disable">禁用</button>
          <button class="su-btn danger" data-act="delete">删除</button>
          <span class="su-spacer"></span>
          <button class="su-btn primary" data-act="add">添加</button>
        </div>
      `
      content.appendChild(wrapper)

      const listEl = wrapper.querySelector('#su-list') as HTMLElement
      const footerBtns = wrapper.querySelectorAll<HTMLButtonElement>('.su-btn')

      // 右键菜单元素（挂到 body 以便浮于所有窗口之上）
      const ctxMenuEl = document.createElement('div')
      ctxMenuEl.className = 'su-ctxmenu'
      document.body.appendChild(ctxMenuEl)

      // HTML 转义
      const esc = (s: string): string => s.replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[c]!))

      // 渲染启动项列表
      const render = () => {
        const items = startupManager.getAll()
        renderTable(items)
        updateButtons()
      }

      // 表格视图
      const renderTable = (items: StartupItem[]) => {
        listEl.innerHTML = `
          <table class="su-table">
            <thead>
              <tr>
                <th>名称</th>
                <th>应用ID</th>
                <th style="width:90px;">启用状态</th>
                <th style="width:90px;">延迟(ms)</th>
                <th style="width:90px;">来源</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        `
        const tbody = listEl.querySelector('tbody') as HTMLElement
        if (items.length === 0) {
          tbody.innerHTML = `<tr><td colspan="5" class="su-empty">暂无启动项</td></tr>`
          return
        }
        for (const it of items) {
          const row = document.createElement('tr')
          row.dataset.id = it.id
          if (it.id === selectedId) row.classList.add('selected')
          row.innerHTML = `
            <td>${esc(it.name)}</td>
            <td class="su-mono">${esc(it.appId)}</td>
            <td><span class="su-switch ${it.enabled ? 'on' : ''}" title="${it.enabled ? '已启用' : '已禁用'}"><span class="su-switch-knob"></span></span></td>
            <td>${it.delay}</td>
            <td><span class="su-source ${it.source}">${it.source === 'system' ? '系统' : '用户'}</span></td>
          `
          // 点击行：选中；若点的是开关，则同时切换启用状态
          row.addEventListener('click', (e: MouseEvent) => {
            selectItem(it.id)
            if ((e.target as HTMLElement).closest('.su-switch')) {
              startupManager.setEnabled(it.id, !it.enabled)
            }
          })
          // 右键弹出菜单
          row.addEventListener('contextmenu', (e: MouseEvent) => {
            e.preventDefault()
            selectItem(it.id)
            showContextMenu(e.clientX, e.clientY, it)
          })
          // 双击切换启用状态
          row.addEventListener('dblclick', () => {
            startupManager.setEnabled(it.id, !it.enabled)
          })
          tbody.appendChild(row)
        }
      }

      // 选中启动项
      const selectItem = (id: string) => {
        selectedId = id
        listEl.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'))
        const target = listEl.querySelector(`[data-id="${id}"]`)
        if (target) target.classList.add('selected')
        updateButtons()
      }

      // 更新底部按钮的可用状态
      const updateButtons = () => {
        const item = selectedId ? startupManager.getAll().find(i => i.id === selectedId) : undefined
        const map: Record<string, boolean> = {
          enable: !!item && !item.enabled,
          disable: !!item && item.enabled,
          delete: !!item && item.source !== 'system',
          add: true
        }
        footerBtns.forEach(btn => {
          const act = btn.dataset.act
          btn.disabled = act ? !map[act] : true
        })
      }

      // ===== 启动项操作 =====
      const doEnable = (id: string) => {
        startupManager.setEnabled(id, true)
      }
      const doDisable = (id: string) => {
        startupManager.setEnabled(id, false)
      }
      const doDelete = async (id: string) => {
        const item = startupManager.getAll().find(i => i.id === id)
        if (!item) return
        if (await dialog.confirm(`确定要删除启动项 "${item.name}" 吗？`, '删除启动项')) {
          const ok = startupManager.remove(id)
          if (!ok) {
            await dialog.alert('该启动项为系统项，无法删除。')
          } else {
            selectedId = null
          }
        }
      }
      const doAdd = () => {
        showAddDialog()
      }

      // ===== 添加对话框（复用全局 ht-dialog-* 样式以保持视觉一致） =====
      const showAddDialog = () => {
        const overlay = document.createElement('div')
        overlay.className = 'ht-dialog-overlay'

        const box = document.createElement('div')
        box.className = 'ht-dialog-box'
        box.style.minWidth = '360px'

        const header = document.createElement('div')
        header.className = 'ht-dialog-header'
        header.textContent = '添加启动项'
        box.appendChild(header)

        const body = document.createElement('div')
        body.className = 'ht-dialog-body'
        body.innerHTML = `
          <div class="su-form-row"><label>名称</label><input class="su-form-input" id="su-add-name" type="text" autocomplete="off" placeholder="例如：我的应用" /></div>
          <div class="su-form-row"><label>应用ID</label><input class="su-form-input" id="su-add-appid" type="text" autocomplete="off" placeholder="例如：notepad" /></div>
          <div class="su-form-row"><label>延迟(ms)</label><input class="su-form-input" id="su-add-delay" type="number" min="0" step="100" value="0" /></div>
        `
        box.appendChild(body)

        const footer = document.createElement('div')
        footer.className = 'ht-dialog-footer'
        const confirmBtn = document.createElement('button')
        confirmBtn.className = 'ht-dialog-btn ht-dialog-btn-primary'
        confirmBtn.textContent = '确定'
        const cancelBtn = document.createElement('button')
        cancelBtn.className = 'ht-dialog-btn'
        cancelBtn.textContent = '取消'
        footer.appendChild(confirmBtn)
        footer.appendChild(cancelBtn)
        box.appendChild(footer)

        overlay.appendChild(box)
        document.body.appendChild(overlay)

        const nameInput = body.querySelector('#su-add-name') as HTMLInputElement
        const appIdInput = body.querySelector('#su-add-appid') as HTMLInputElement
        const delayInput = body.querySelector('#su-add-delay') as HTMLInputElement

        // 入场动画（与全局 Dialog 一致）
        requestAnimationFrame(() => overlay.classList.add('visible'))
        setTimeout(() => nameInput.focus(), 50)

        const close = () => {
          document.removeEventListener('keydown', onKey)
          overlay.classList.remove('visible')
          overlay.classList.add('hiding')
          setTimeout(() => overlay.remove(), 250)
        }

        const submit = async () => {
          const name = nameInput.value.trim()
          const appId = appIdInput.value.trim()
          const delay = Math.max(0, parseInt(delayInput.value, 10) || 0)
          if (!name) { await dialog.alert('请输入启动项名称。'); return }
          if (!appId) { await dialog.alert('请输入应用ID。'); return }
          startupManager.add({ name, appId, enabled: true, delay })
          close()
        }

        confirmBtn.addEventListener('click', submit)
        cancelBtn.addEventListener('click', close)

        const onKey = (e: KeyboardEvent) => {
          if (e.key === 'Enter') { e.preventDefault(); submit() }
          else if (e.key === 'Escape') { e.preventDefault(); close() }
        }
        document.addEventListener('keydown', onKey)
      }

      // ===== 右键菜单 =====
      const hideContextMenu = () => { ctxMenuEl.style.display = 'none' }

      const showContextMenu = (x: number, y: number, item: StartupItem) => {
        const canDelete = item.source !== 'system'
        const items: Array<{ label: string; action?: () => void; disabled?: boolean } | { sep: true }> = [
          { label: '启用', action: () => doEnable(item.id), disabled: item.enabled },
          { label: '禁用', action: () => doDisable(item.id), disabled: !item.enabled },
          { sep: true },
          { label: '删除', action: () => doDelete(item.id), disabled: !canDelete }
        ]
        ctxMenuEl.innerHTML = ''
        for (const it of items) {
          if ('sep' in it) {
            const sep = document.createElement('div')
            sep.className = 'su-ctx-sep'
            ctxMenuEl.appendChild(sep)
            continue
          }
          const el = document.createElement('div')
          el.className = 'su-ctx-item' + (it.disabled ? ' disabled' : '')
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
      listEl.addEventListener('mousedown', onCtxOutside, true)

      // 底部按钮事件分发
      footerBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const act = btn.dataset.act
          if (!act) return
          if (act === 'add') { doAdd(); return }
          if (!selectedId) return
          if (act === 'enable') doEnable(selectedId)
          else if (act === 'disable') doDisable(selectedId)
          else if (act === 'delete') doDelete(selectedId)
        })
      })

      // 监听启动项变更：自动刷新
      const onChangeUnsub = startupManager.onChange(() => {
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
