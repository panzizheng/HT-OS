// ============================================================
// 环境变量编辑器 - 类似 Windows 环境变量编辑器
// 上半部分：系统变量列表；下半部分：用户变量列表
// 支持新建/编辑/删除变量，删除需确认
// ============================================================

import { WindowManager } from '../wm/WindowManager'
import { Environment, EnvVar } from '../kernel/Environment'
import { EventBus } from '../kernel/EventBus'
import { dialog } from '../desktop/Dialog'
import { requestUac } from '../kernel/UAC'
import { ENV_EDITOR_ICON } from './system-icons'

// 环境变量图标（来自 public/assets/环境变量.svg）
const APP_ICON = ENV_EDITOR_ICON

export function registerEnvEditorApp(wm: WindowManager, environment: Environment, eventBus: EventBus): void {
  wm.registerApp({
    id: 'env-editor',
    name: '环境变量',
    icon: APP_ICON,
    defaultWidth: 640,
    defaultHeight: 520,
    entry: (windowId: string) => {
      const win = wm.getWindow(windowId)
      if (!win) return
      const content = win.content
      content.className = 'env-editor-app window-content'

      // 当前选中的变量名（按作用域区分，同一时刻只有一个作用域内有选中）
      let selectedSystemKey: string | null = null
      let selectedUserKey: string | null = null

      // 内联样式（应用特有，避免修改全局样式表）
      const styleEl = document.createElement('style')
      styleEl.textContent = `
        .env-editor-app { display: flex; flex-direction: column; height: 100%; background: #fff; }
        .env-editor-inner { display: flex; flex-direction: column; height: 100%; padding: 12px; gap: 8px; overflow: hidden; box-sizing: border-box; }
        .env-section { display: flex; flex-direction: column; flex: 1; min-height: 0; }
        .env-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
        .env-section-title { font-size: 13px; font-weight: 600; color: var(--text-dark); }
        .env-section-actions { display: flex; gap: 6px; }
        .env-btn { padding: 4px 14px; font-size: 12px; border: 1px solid var(--window-border); background: #fff; color: var(--text-dark); border-radius: 4px; cursor: pointer; }
        .env-btn:hover { background: #f0f7ff; border-color: var(--theme-color); }
        .env-btn.danger { color: #c0392b; }
        .env-btn.danger:hover { background: #fdecea; border-color: #c0392b; }
        .env-table-wrap { flex: 1; overflow: auto; border: 1px solid var(--window-border); border-radius: 4px; background: #fff; }
        .env-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .env-table thead th { position: sticky; top: 0; background: #f0f0f0; border-bottom: 1px solid var(--window-border); padding: 6px 10px; text-align: left; font-weight: 600; color: #444; z-index: 1; }
        .env-table tbody tr { cursor: pointer; border-bottom: 1px solid #f0f0f0; }
        .env-table tbody tr:hover { background: #f5f9ff; }
        .env-table tbody tr.selected { background: #e6f0fb; }
        .env-table td { padding: 6px 10px; color: var(--text-dark); }
        .env-table .col-key { width: 40%; word-break: break-all; }
        .env-table .col-value { word-break: break-all; }
        .env-separator { height: 1px; background: var(--window-border); margin: 4px 0; flex-shrink: 0; }
        /* 编辑对话框表单 */
        .env-edit-form { display: flex; flex-direction: column; gap: 12px; padding: 4px 0; }
        .env-edit-row { display: flex; flex-direction: column; gap: 4px; }
        .env-edit-row label { font-size: 12px; color: #555; }
        .env-edit-input { padding: 6px 8px; font-size: 13px; border: 1px solid var(--window-border); border-radius: 4px; outline: none; font-family: inherit; }
        .env-edit-input:focus { border-color: var(--theme-color); }
        .env-edit-input[readonly] { background: #f3f3f3; color: #888; cursor: not-allowed; }
      `
      content.appendChild(styleEl)

      const wrapper = document.createElement('div')
      wrapper.className = 'env-editor-inner'
      wrapper.innerHTML = `
        <div class="env-section">
          <div class="env-section-header">
            <span class="env-section-title">系统变量</span>
            <div class="env-section-actions">
              <button class="env-btn" data-act="new-system">新建</button>
              <button class="env-btn" data-act="edit-system">编辑</button>
              <button class="env-btn danger" data-act="del-system">删除</button>
            </div>
          </div>
          <div class="env-table-wrap" id="env-system-list"></div>
        </div>
        <div class="env-separator"></div>
        <div class="env-section">
          <div class="env-section-header">
            <span class="env-section-title">用户变量</span>
            <div class="env-section-actions">
              <button class="env-btn" data-act="new-user">新建</button>
              <button class="env-btn" data-act="edit-user">编辑</button>
              <button class="env-btn danger" data-act="del-user">删除</button>
            </div>
          </div>
          <div class="env-table-wrap" id="env-user-list"></div>
        </div>
      `
      content.appendChild(wrapper)

      const systemListEl = wrapper.querySelector('#env-system-list') as HTMLElement
      const userListEl = wrapper.querySelector('#env-user-list') as HTMLElement

      // HTML 转义
      const esc = (s: string): string => s.replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[c]!))

      // 渲染某一作用域的变量表
      const renderScope = (listEl: HTMLElement, scope: 'system' | 'user') => {
        const vars: EnvVar[] = environment.getByScope(scope)
        listEl.innerHTML = `
          <table class="env-table">
            <thead>
              <tr><th class="col-key">变量名</th><th class="col-value">值</th></tr>
            </thead>
            <tbody></tbody>
          </table>
        `
        const tbody = listEl.querySelector('tbody') as HTMLElement
        if (vars.length === 0) {
          tbody.innerHTML = `<tr><td colspan="2" style="text-align:center;color:#999;padding:14px;">暂无变量</td></tr>`
          return
        }
        const selectedKey = scope === 'system' ? selectedSystemKey : selectedUserKey
        for (const v of vars) {
          const row = document.createElement('tr')
          row.className = 'env-row'
          row.dataset.key = v.key
          if (v.key === selectedKey) row.classList.add('selected')
          row.innerHTML = `
            <td class="col-key">${esc(v.key)}</td>
            <td class="col-value">${esc(v.value)}</td>
          `
          row.addEventListener('click', () => selectRow(scope, v.key))
          row.addEventListener('dblclick', () => editVar(scope, v.key))
          tbody.appendChild(row)
        }
      }

      const render = () => {
        renderScope(systemListEl, 'system')
        renderScope(userListEl, 'user')
      }

      // 选中某行；切换作用域时清空另一作用域的选中
      const selectRow = (scope: 'system' | 'user', key: string) => {
        if (scope === 'system') {
          selectedSystemKey = key
          selectedUserKey = null
        } else {
          selectedUserKey = key
          selectedSystemKey = null
        }
        systemListEl.querySelectorAll('.env-row').forEach(r => {
          r.classList.toggle('selected', (r as HTMLElement).dataset.key === selectedSystemKey)
        })
        userListEl.querySelectorAll('.env-row').forEach(r => {
          r.classList.toggle('selected', (r as HTMLElement).dataset.key === selectedUserKey)
        })
      }

      // 自建双输入对话框（变量名 + 变量值）
      // 复用全局 .ht-dialog-overlay / .ht-dialog-box / .ht-dialog-btn 样式类
      const showEditDialog = (
        title: string,
        defaultKey = '',
        defaultValue = '',
        lockKey = false
      ): Promise<{ key: string, value: string } | null> => {
        return new Promise((resolve) => {
          const overlay = document.createElement('div')
          overlay.className = 'ht-dialog-overlay'
          overlay.style.zIndex = '100000'

          const box = document.createElement('div')
          box.className = 'ht-dialog-box'
          box.style.width = '420px'

          box.innerHTML = `
            <div class="ht-dialog-header">${esc(title)}</div>
            <div class="ht-dialog-body">
              <div class="env-edit-form">
                <div class="env-edit-row">
                  <label>变量名</label>
                  <input type="text" class="env-edit-input" id="env-edit-key" value="${esc(defaultKey)}" ${lockKey ? 'readonly' : ''} autocomplete="off" spellcheck="false">
                </div>
                <div class="env-edit-row">
                  <label>变量值</label>
                  <input type="text" class="env-edit-input" id="env-edit-value" value="${esc(defaultValue)}" autocomplete="off" spellcheck="false">
                </div>
              </div>
            </div>
            <div class="ht-dialog-footer">
              <button class="ht-dialog-btn ht-dialog-btn-cancel" id="env-edit-cancel">取消</button>
              <button class="ht-dialog-btn ht-dialog-btn-primary" id="env-edit-ok">确定</button>
            </div>
          `

          overlay.appendChild(box)
          document.body.appendChild(overlay)

          // 触发淡入动画
          requestAnimationFrame(() => overlay.classList.add('visible'))

          const keyInput = box.querySelector('#env-edit-key') as HTMLInputElement
          const valueInput = box.querySelector('#env-edit-value') as HTMLInputElement
          const okBtn = box.querySelector('#env-edit-ok') as HTMLButtonElement
          const cancelBtn = box.querySelector('#env-edit-cancel') as HTMLButtonElement

          const close = (result: { key: string, value: string } | null) => {
            document.removeEventListener('keydown', onKey)
            overlay.remove()
            resolve(result)
          }

          const doOk = () => {
            const key = keyInput.value.trim()
            const value = valueInput.value
            if (!key) {
              keyInput.focus()
              return
            }
            close({ key, value })
          }

          const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              doOk()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              close(null)
            }
          }

          okBtn.addEventListener('click', doOk)
          cancelBtn.addEventListener('click', () => close(null))
          overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null) })
          document.addEventListener('keydown', onKey)

          // 焦点：编辑模式锁定变量名时聚焦值输入框，否则聚焦变量名输入框
          setTimeout(() => {
            if (lockKey) {
              valueInput.focus()
              valueInput.select()
            } else {
              keyInput.focus()
              keyInput.select()
            }
          }, 50)
        })
      }

      // 新建变量
      const newVar = async (scope: 'system' | 'user') => {
        if (!await requestUac(eventBus, { operation: '新建环境变量', resource: `${scope === 'system' ? '系统' : '用户'}变量`, source: '环境变量编辑器' })) return
        const result = await showEditDialog(scope === 'system' ? '新建系统变量' : '新建用户变量')
        if (!result) return
        // 检查同作用域下是否已存在同名变量
        const exists = environment.getByScope(scope).some(v => v.key === result.key)
        if (exists) {
          if (await dialog.confirm(`变量 "${result.key}" 已存在，是否覆盖其值？`, '确认覆盖')) {
            environment.set(result.key, result.value, scope)
            if (scope === 'system') selectedSystemKey = result.key
            else selectedUserKey = result.key
          }
          return
        }
        environment.set(result.key, result.value, scope)
        if (scope === 'system') selectedSystemKey = result.key
        else selectedUserKey = result.key
      }

      // 编辑变量（双击行或点击"编辑"按钮触发）
      const editVar = async (scope: 'system' | 'user', key?: string) => {
        const targetKey = key ?? (scope === 'system' ? selectedSystemKey : selectedUserKey)
        if (!targetKey) {
          await dialog.alert('请先选择一个变量')
          return
        }
        if (!await requestUac(eventBus, { operation: '编辑环境变量', resource: targetKey, source: '环境变量编辑器' })) return
        // 注意 environment.get 是 user 优先，这里需要按作用域精确取值
        const scopedVar = environment.getByScope(scope).find(v => v.key === targetKey)
        const currentValue = scopedVar ? scopedVar.value : ''
        const result = await showEditDialog(
          scope === 'system' ? '编辑系统变量' : '编辑用户变量',
          targetKey,
          currentValue,
          true
        )
        if (!result) return
        environment.set(result.key, result.value, scope)
      }

      // 删除变量（需确认）
      const delVar = async (scope: 'system' | 'user') => {
        const targetKey = scope === 'system' ? selectedSystemKey : selectedUserKey
        if (!targetKey) {
          await dialog.alert('请先选择一个变量')
          return
        }
        if (!await requestUac(eventBus, { operation: '删除环境变量', resource: targetKey, source: '环境变量编辑器' })) return
        if (await dialog.confirm(`确定要删除变量 "${targetKey}" 吗？`, '确认删除')) {
          environment.remove(targetKey, scope)
          if (scope === 'system') selectedSystemKey = null
          else selectedUserKey = null
        }
      }

      // 按钮事件分发
      wrapper.querySelectorAll<HTMLButtonElement>('.env-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const act = btn.dataset.act
          if (!act) return
          switch (act) {
            case 'new-system': await newVar('system'); break
            case 'edit-system': await editVar('system'); break
            case 'del-system': await delVar('system'); break
            case 'new-user': await newVar('user'); break
            case 'edit-user': await editVar('user'); break
            case 'del-user': await delVar('user'); break
          }
        })
      })

      // 监听环境变量变更：自动刷新
      // 窗口关闭（content 脱离文档）时取消订阅，避免无谓渲染与内存泄漏
      const onChangeUnsub = environment.onChange(() => {
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
