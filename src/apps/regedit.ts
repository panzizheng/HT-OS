// ============================================================
// 注册表编辑器 - 类似 Windows regedit
// 左侧：键的树形结构；右侧：当前键的值列表
// 支持新建/修改/删除键和值，导入/导出
// ============================================================

import { WindowManager } from '../wm/WindowManager'
import { Registry, RegValue } from '../kernel/Registry'
import { EventBus } from '../kernel/EventBus'
import { dialog } from '../desktop/Dialog'
import { requestUac } from '../kernel/UAC'

const APP_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>'

export function registerRegistryEditorApp(wm: WindowManager, registry: Registry, eventBus: EventBus): void {
  wm.registerApp({
    id: 'regedit',
    name: '注册表编辑器',
    icon: APP_ICON,
    defaultWidth: 820,
    defaultHeight: 560,
    entry: (windowId: string) => {
      const win = wm.getWindow(windowId)
      if (!win) return
      const content = win.content
      content.className = 'regedit-app window-content'

      let currentPath = 'HKEY_LOCAL_MACHINE'

      content.innerHTML = `
        <div class="regedit-menubar">
          <div class="menu">
            <span class="menu-label">注册表(R)</span>
            <div class="menu-dropdown">
              <div class="menu-item" data-action="import">导入...</div>
              <div class="menu-item" data-action="export">导出...</div>
              <div class="menu-separator"></div>
              <div class="menu-item" data-action="exit">退出</div>
            </div>
          </div>
          <div class="menu">
            <span class="menu-label">编辑(E)</span>
            <div class="menu-dropdown">
              <div class="menu-item" data-action="new-key">新建键</div>
              <div class="menu-item" data-action="new-value">新建值</div>
              <div class="menu-item" data-action="delete">删除</div>
              <div class="menu-separator"></div>
              <div class="menu-item" data-action="rename">重命名</div>
            </div>
          </div>
        </div>
        <div class="regedit-body">
          <div class="regedit-tree" id="regedit-tree"></div>
          <div class="regedit-main">
            <div class="regedit-path-bar">
              <span class="regedit-path-label">路径：</span>
              <span class="regedit-path" id="regedit-path"></span>
            </div>
            <div class="regedit-values">
              <table class="regedit-table">
                <thead>
                  <tr>
                    <th class="col-name">名称</th>
                    <th class="col-type">类型</th>
                    <th class="col-value">数据</th>
                  </tr>
                </thead>
                <tbody id="regedit-value-list"></tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="regedit-statusbar">
          <span id="regedit-status"></span>
        </div>
      `

      const treeEl = content.querySelector('#regedit-tree') as HTMLElement
      const pathEl = content.querySelector('#regedit-path') as HTMLElement
      const valueListEl = content.querySelector('#regedit-value-list') as HTMLElement
      const statusEl = content.querySelector('#regedit-status') as HTMLElement

      // 判断值类型字符串
      const getTypeName = (v: RegValue): string => {
        if (v === null) return 'REG_SZ'
        if (typeof v === 'number') return 'REG_DWORD'
        if (typeof v === 'boolean') return 'REG_BINARY'
        return 'REG_SZ'
      }

      // 转义 HTML
      const esc = (s: string): string => s.replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[c]!))

      // 渲染值列表
      const renderValues = (regPath: string) => {
        pathEl.textContent = regPath
        const values = registry.listValues(regPath)
        const subKeys = registry.listSubKeys(regPath)

        valueListEl.innerHTML = ''
        // 默认值行
        const defaultRow = document.createElement('tr')
        defaultRow.className = 'regedit-value-row'
        defaultRow.dataset.valueName = ''
        const defaultValue = registry.getValue(regPath, '')
        defaultRow.innerHTML = `
          <td class="col-name">(默认)</td>
          <td class="col-type">${getTypeName(defaultValue)}</td>
          <td class="col-value">${defaultValue === null ? '<span class="empty">（未设置值）</span>' : esc(String(defaultValue))}</td>
        `
        defaultRow.addEventListener('click', () => selectValueRow(defaultRow))
        defaultRow.addEventListener('dblclick', () => editValue(regPath, ''))
        valueListEl.appendChild(defaultRow)

        for (const v of values) {
          if (v.name === '') continue
          const row = document.createElement('tr')
          row.className = 'regedit-value-row'
          row.dataset.valueName = v.name
          row.innerHTML = `
            <td class="col-name">${esc(v.name)}</td>
            <td class="col-type">${getTypeName(v.value)}</td>
            <td class="col-value">${v.value === null ? '<span class="empty">（空）</span>' : esc(String(v.value))}</td>
          `
          row.addEventListener('click', () => selectValueRow(row))
          row.addEventListener('dblclick', () => editValue(regPath, v.name))
          valueListEl.appendChild(row)
        }

        statusEl.textContent = `子键: ${subKeys.length}  值: ${values.length}`
      }

      let selectedValueRow: HTMLElement | null = null
      const selectValueRow = (row: HTMLElement) => {
        if (selectedValueRow) selectedValueRow.classList.remove('selected')
        selectedValueRow = row
        row.classList.add('selected')
      }

      // 编辑值
      const editValue = async (regPath: string, name: string) => {
        // UAC 确认
        const allowed = await requestUac(eventBus, {
          operation: '修改注册表值',
          resource: `${regPath}\\${name || '(默认)'}`,
          source: '注册表编辑器'
        })
        if (!allowed) return
        const current = registry.getValue(regPath, name)
        const result = await dialog.prompt(
          `编辑值：${name || '(默认)'}`,
          current === null ? '' : String(current),
          '请输入值'
        )
        if (result !== null) {
          // 尝试转换为数字
          let value: RegValue = result
          if (/^-?\d+$/.test(result)) value = parseInt(result, 10)
          else if (result === 'true') value = true
          else if (result === 'false') value = false
          registry.setValue(regPath, name, value)
          renderValues(regPath)
        }
      }

      // 渲染树节点
      const renderTree = () => {
        treeEl.innerHTML = ''
        for (const root of registry.getRoots()) {
          const node = createTreeNode(root, root)
          treeEl.appendChild(node)
        }
      }

      // 递归创建树节点
      const createTreeNode = (name: string, fullPath: string, depth = 0): HTMLElement => {
        const node = document.createElement('div')
        node.className = 'regedit-tree-node'
        node.style.paddingLeft = (depth * 16 + 4) + 'px'

        const hasChildren = registry.listSubKeys(fullPath).length > 0
        const toggle = document.createElement('span')
        toggle.className = 'tree-toggle'
        toggle.textContent = hasChildren ? '▶' : ''

        const label = document.createElement('span')
        label.className = 'tree-label'
        label.textContent = name

        node.appendChild(toggle)
        node.appendChild(label)

        let expanded = false
        let childContainer: HTMLElement | null = null

        const expand = () => {
          if (expanded || !hasChildren) return
          expanded = true
          toggle.textContent = '▼'
          childContainer = document.createElement('div')
          for (const child of registry.listSubKeys(fullPath)) {
            childContainer.appendChild(createTreeNode(child, fullPath + '\\' + child, depth + 1))
          }
          node.after(childContainer)
        }

        const collapse = () => {
          if (!expanded) return
          expanded = false
          toggle.textContent = '▶'
          if (childContainer) {
            childContainer.remove()
            childContainer = null
          }
        }

        toggle.addEventListener('click', (e) => {
          e.stopPropagation()
          if (expanded) collapse(); else expand()
        })

        label.addEventListener('click', () => {
          // 选中此节点
          treeEl.querySelectorAll('.tree-label').forEach(l => l.classList.remove('selected'))
          label.classList.add('selected')
          currentPath = fullPath
          renderValues(fullPath)
          // 自动展开
          if (!expanded) expand()
        })

        return node
      }

      // 菜单事件
      content.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', async () => {
          const action = item.getAttribute('data-action')
          switch (action) {
            case 'new-key': {
              // UAC 确认
              if (!await requestUac(eventBus, { operation: '新建注册表键', resource: currentPath, source: '注册表编辑器' })) return
              const name = await dialog.prompt('新建键', '', '请输入键名')
              if (name) {
                const newPath = currentPath + '\\' + name
                registry.createKeyPath(newPath)
                renderTree()
                renderValues(currentPath)
              }
              break
            }
            case 'new-value': {
              // UAC 确认
              if (!await requestUac(eventBus, { operation: '新建注册表值', resource: currentPath, source: '注册表编辑器' })) return
              const name = await dialog.prompt('新建值', '', '请输入值名称')
              if (name) {
                const value = await dialog.prompt('新建值：' + name, '', '请输入值')
                if (value !== null) {
                  let v: RegValue = value
                  if (/^-?\d+$/.test(value)) v = parseInt(value, 10)
                  registry.setValue(currentPath, name, v)
                  renderValues(currentPath)
                }
              }
              break
            }
            case 'delete': {
              // UAC 确认
              if (!await requestUac(eventBus, { operation: '删除注册表项', resource: selectedValueRow ? `${currentPath}\\${selectedValueRow.dataset.valueName || '(默认)'}` : currentPath, source: '注册表编辑器' })) return
              if (selectedValueRow) {
                const name = selectedValueRow.dataset.valueName
                if (name !== undefined) {
                  if (await dialog.confirm('确认删除', `确定要删除值 "${name || '(默认)'}" 吗？`)) {
                    registry.deleteValue(currentPath, name)
                    renderValues(currentPath)
                  }
                }
              } else {
                // 删除当前键
                if (currentPath.includes('\\')) {
                  if (await dialog.confirm('确认删除', `确定要删除键 "${currentPath}" 及其所有子项吗？`)) {
                    registry.deleteKey(currentPath)
                    // 返回父键
                    currentPath = currentPath.substring(0, currentPath.lastIndexOf('\\'))
                    renderTree()
                    renderValues(currentPath)
                  }
                } else {
                  await dialog.alert('不能删除根键')
                }
              }
              break
            }
            case 'rename': {
              if (selectedValueRow) {
                const oldName = selectedValueRow.dataset.valueName
                if (oldName === undefined || oldName === '') {
                  await dialog.alert('不能重命名默认值')
                  return
                }
                const newName = await dialog.prompt('重命名', oldName, '请输入新名称')
                if (newName && newName !== oldName) {
                  const v = registry.getValue(currentPath, oldName)
                  registry.setValue(currentPath, newName, v)
                  registry.deleteValue(currentPath, oldName)
                  renderValues(currentPath)
                }
              }
              break
            }
            case 'export': {
              const json = registry.exportAll()
              const blob = new Blob([json], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = 'registry-backup.json'
              a.click()
              URL.revokeObjectURL(url)
              break
            }
            case 'import': {
              // UAC 确认
              if (!await requestUac(eventBus, { operation: '导入注册表', resource: '覆盖所有注册表项', source: '注册表编辑器' })) return
              const input = document.createElement('input')
              input.type = 'file'
              input.accept = '.json'
              input.addEventListener('change', async () => {
                const file = input.files?.[0]
                if (!file) return
                const text = await file.text()
                if (await dialog.confirm('导入注册表', '导入将覆盖当前注册表的所有内容，确定继续吗？')) {
                  if (registry.importAll(text)) {
                    renderTree()
                    renderValues(currentPath)
                    await dialog.alert('导入成功')
                  } else {
                    await dialog.alert('导入失败：文件格式错误')
                  }
                }
              })
              input.click()
              break
            }
            case 'exit':
              win.close()
              break
          }
        })
      })

      // 右键菜单
      valueListEl.addEventListener('contextmenu', (e: MouseEvent) => {
        e.preventDefault()
        const target = e.target as HTMLElement
        const row = target.closest('.regedit-value-row') as HTMLElement
        if (row) {
          selectValueRow(row)
          // 简化处理：直接触发修改
          const name = row.dataset.valueName
          if (name !== undefined) editValue(currentPath, name)
        }
      })

      renderTree()
      renderValues(currentPath)
    }
  })
}
