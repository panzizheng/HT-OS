import { WindowManager } from '../../wm/WindowManager'
import { FileSystem } from '../../fs/FileSystem'
import { EventBus } from '../../kernel/EventBus'
import { dialog } from '../../desktop/Dialog'
import { showOpenFileDialog, showSaveFileDialog } from '../../desktop/FileDialog'
import { getCommandRegistry } from '../../kernel/CommandRegistry'
import { compileCode, compileProject, loadProject } from './compiler-core'
import type { EPPFile, EPPManifest, EPPProject, EPPRuntimeAPI, EPPSolution, CompileConfig } from './types'

const APP_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/><line x1="2" y1="8" x2="22" y2="8"/></svg>'

// 启动页图标
const ICON_NEW = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>'
const ICON_OPEN = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>'
const ICON_FILE = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
const ICON_PROJECT = '<svg width="20" height="20" viewBox="0 0 24 24" fill="#f5c542" stroke="#e0a800" stroke-width="1.5"><path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/></svg>'
const ICON_SOLUTION = '<svg width="20" height="20" viewBox="0 0 24 24" fill="#8b5cf6" stroke="#7c3aed" stroke-width="1.5"><path d="M3 7l9-4 9 4-9 4z"/><path d="M3 12l9 4 9-4"/><path d="M3 17l9 4 9-4"/></svg>'
// 项目树中的源代码文件图标（与 index.ts 中 E_SOURCE_ICON 保持一致）
const E_SOURCE_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="#f5f5f5" stroke="#06b6d4" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><text x="12" y="18" font-size="8" fill="#06b6d4" text-anchor="middle" font-family="monospace">e</text></svg>'

const RECENT_KEY = 'ht-os-epp-recent-projects'
const MAX_RECENT = 10

interface RecentProject {
  name: string
  /** 项目文件夹完整路径（无前导 /） */
  path: string
  openedAt: number
}

function getRecentProjects(): RecentProject[] {
  try {
    const data = localStorage.getItem(RECENT_KEY)
    if (!data) return []
    return JSON.parse(data) as RecentProject[]
  } catch {
    return []
  }
}

function addRecentProject(name: string, path: string): void {
  const list = getRecentProjects().filter(p => p.path !== path)
  list.unshift({ name, path, openedAt: Date.now() })
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)))
}

function removeRecentProject(path: string): void {
  const list = getRecentProjects().filter(p => p.path !== path)
  localStorage.setItem(RECENT_KEY, JSON.stringify(list))
}

export function registerEPPCompilerApp(wm: WindowManager, fs: FileSystem, eventBus: EventBus): void {
  // [SYNC] 主函数 — 与 epp_compiler.py EPPCompilerGUI 类保持同步
  wm.registerApp({
    id: 'epp-compiler',
    name: 'EPP 编译器',
    icon: APP_ICON,
    defaultWidth: 900,
    defaultHeight: 600,
    entry: (windowId: string) => {
      const win = wm.getWindow(windowId)
      if (!win) return

      const content = win.content
      content.className = 'epp-compiler window-content'

      // 项目状态
      let currentProject: EPPProject | null = null
      /** 项目文件夹完整路径（无前导 /） */
      let currentProjectPath = ''
      /** 当前编辑的源文件完整路径（无前导 /） */
      let currentFilePath = ''
      /** 当前解决方案（可选） */
      let currentSolution: EPPSolution | null = null
      let currentSolutionPath = ''
      /** 编译配置 */
      let compileConfig: CompileConfig = 'Debug'

      // ---------- 启动页 ----------
      function showStartPage(): void {
        win!.setTitle('EPP 编译器')
        content.innerHTML = `
          <div class="epp-start-page">
            <div class="epp-start-header">
              <div class="epp-start-logo">EPP</div>
              <h1>EPP 编译器</h1>
              <p class="epp-start-subtitle">选择一个项目或解决方案开始，或直接打开源文件</p>
            </div>
            <div class="epp-start-actions">
              <button class="epp-start-card" id="epp-new-project">
                <div class="epp-start-card-icon">${ICON_NEW}</div>
                <div class="epp-start-card-text">
                  <div class="epp-start-card-title">新建项目</div>
                  <div class="epp-start-card-desc">创建一个新的 EPP 项目</div>
                </div>
              </button>
              <button class="epp-start-card" id="epp-open-project">
                <div class="epp-start-card-icon">${ICON_OPEN}</div>
                <div class="epp-start-card-text">
                  <div class="epp-start-card-title">打开项目</div>
                  <div class="epp-start-card-desc">打开 .epproj 项目或 .esln 解决方案</div>
                </div>
              </button>
              <button class="epp-start-card" id="epp-open-file">
                <div class="epp-start-card-icon">${ICON_FILE}</div>
                <div class="epp-start-card-text">
                  <div class="epp-start-card-title">打开文件</div>
                  <div class="epp-start-card-desc">直接编辑单个 .e 源文件</div>
                </div>
              </button>
            </div>
            <div class="epp-start-recent">
              <h3>最近项目</h3>
              <div class="epp-recent-list" id="epp-recent-list"></div>
            </div>
          </div>
        `
        renderRecentList()

        content.querySelector('#epp-new-project')?.addEventListener('click', createNewProject)
        content.querySelector('#epp-open-project')?.addEventListener('click', () => openProjectOrSolution())
        content.querySelector('#epp-open-file')?.addEventListener('click', openSingleFile)
      }

      function renderRecentList(): void {
        const listEl = content.querySelector('#epp-recent-list') as HTMLElement
        if (!listEl) return
        const list = getRecentProjects()
        if (list.length === 0) {
          listEl.innerHTML = '<div class="epp-recent-empty">暂无最近项目</div>'
          return
        }
        listEl.innerHTML = ''
        list.forEach(rp => {
          const item = document.createElement('div')
          item.className = 'epp-recent-item'
          item.innerHTML = `
            <div class="epp-recent-icon">${ICON_PROJECT}</div>
            <div class="epp-recent-info">
              <div class="epp-recent-name">${rp.name}</div>
              <div class="epp-recent-path">${rp.path}</div>
            </div>
            <button class="epp-recent-remove" title="移除">&times;</button>
          `
          item.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).classList.contains('epp-recent-remove')) return
            openProject(rp.path)
          })
          item.querySelector('.epp-recent-remove')?.addEventListener('click', (e) => {
            e.stopPropagation()
            removeRecentProject(rp.path)
            renderRecentList()
          })
          listEl.appendChild(item)
        })
      }

      // ---------- 新建项目 ----------
      async function createNewProject(): Promise<void> {
        const name = await dialog.prompt('请输入项目名称：', 'MyProject', '新建项目')
        if (!name || !name.trim()) return
        const projName = name.trim().replace(/[\\/:*?"<>|]/g, '_')

        const result = await showOpenFileDialog(fs, {
          title: '选择项目保存位置',
          defaultDir: '/Users/Admin/Documents',
          folderOnly: true,
          okLabel: '在此创建'
        })
        if (!result) return

        const parentPath = result.path.replace(/^\//, '')
        const projPath = parentPath ? `${parentPath}/${projName}` : projName

        try {
          const existing = await fs.getByPath(projPath)
          if (existing) {
            const overwrite = await dialog.confirm(`目录 "${projName}" 已存在，是否覆盖？`, '确认')
            if (!overwrite) return
            await fs.deleteItem(existing.id)
          }

          const parentItem = await fs.getByPath(parentPath)
          if (!parentItem || parentItem.type !== 'folder') {
            await dialog.alert('所选位置无效', '错误')
            return
          }
          await fs.createFolder(projName, parentItem.id)

          const mainFile = 'main.e'
          const mainPath = `${projPath}/${mainFile}`
          await fs.writeFile(mainPath, '// ' + projName + '\nprintln("Hello, EPP!")\n')

          const project: EPPProject = {
            name: projName,
            version: '1.0.0',
            main: mainFile,
            files: [mainFile]
          }
          await fs.writeFile(`${projPath}/project.epproj`, JSON.stringify(project, null, 2))

          addRecentProject(projName, projPath)
          currentSolution = null
          currentSolutionPath = ''
          await loadProjectIntoEditor(projPath, project)
        } catch (e) {
          await dialog.alert(`创建项目失败: ${(e as Error).message}`, '错误')
        }
      }

      // ---------- 打开项目或解决方案 ----------
      async function openProjectOrSolution(): Promise<void> {
        const result = await showOpenFileDialog(fs, {
          title: '打开 EPP 项目或解决方案',
          defaultDir: '/Users/Admin/Documents',
          filters: ['.epproj', '.esln'],
          okLabel: '打开'
        })
        if (!result) return
        const path = result.path.replace(/^\//, '')
        if (path.toLowerCase().endsWith('.esln')) {
          await openSolution(path)
        } else {
          await openProject(path)
        }
      }

      // ---------- 打开项目 ----------
      async function openProject(projPath?: string): Promise<void> {
        let path = projPath
        if (!path) {
          const result = await showOpenFileDialog(fs, {
            title: '打开 EPP 项目',
            defaultDir: '/Users/Admin/Documents',
            filters: ['.epproj'],
            okLabel: '打开'
          })
          if (!result) return
          path = result.path.replace(/^\//, '')
        } else {
          path = path.replace(/^\//, '')
        }

        try {
          const { project, projectDir } = await loadProject(fs, path)
          addRecentProject(project.name, projectDir)
          currentSolution = null
          currentSolutionPath = ''
          await loadProjectIntoEditor(projectDir, project)
        } catch (e) {
          await dialog.alert(`打开项目失败: ${(e as Error).message}`, '错误')
          if (projPath) {
            removeRecentProject(projPath)
            renderRecentList()
          }
        }
      }

      // ---------- 打开解决方案 ----------
      async function openSolution(slnPath: string): Promise<void> {
        const path = slnPath.replace(/^\//, '')
        try {
          const fileItem = await fs.getByPath(path)
          if (!fileItem || fileItem.type !== 'file') {
            await dialog.alert('解决方案文件不存在', '错误')
            return
          }
          const data = await fs.readFile(fileItem.id)
          if (!data) {
            await dialog.alert('无法读取解决方案文件', '错误')
            return
          }
          const solution = JSON.parse(data) as EPPSolution
          currentSolution = solution
          currentSolutionPath = path.split('/').slice(0, -1).join('/')
          // 加载第一个项目作为默认项目
          if (solution.projects.length > 0) {
            const firstProj = solution.projects[0]
            const projAbsPath = `${currentSolutionPath}/${firstProj.path}`.replace(/\/+/g, '/')
            const { project, projectDir } = await loadProject(fs, projAbsPath)
            addRecentProject(solution.name, currentSolutionPath)
            await loadProjectIntoEditor(projectDir, project, solution)
          } else {
            await dialog.alert('解决方案中没有项目', '提示')
          }
        } catch (e) {
          await dialog.alert(`打开解决方案失败: ${(e as Error).message}`, '错误')
        }
      }

      // ---------- 加载项目到编辑器 ----------
      async function loadProjectIntoEditor(projPath: string, project: EPPProject, solution?: EPPSolution): Promise<void> {
        currentProject = project
        currentProjectPath = projPath
        currentFilePath = ''
        if (solution) {
          currentSolution = solution
        }
        renderEditorView()
        const mainPath = `${projPath}/${project.main}`
        await loadSourceFile(mainPath)
      }

      // ---------- 单文件模式 ----------
      async function openSingleFile(): Promise<void> {
        const result = await showOpenFileDialog(fs, {
          title: '打开 EPP 源文件',
          defaultDir: '/Users/Admin/Documents',
          filters: ['.e'],
          okLabel: '打开'
        })
        if (!result) return
        currentProject = null
        currentProjectPath = ''
        currentSolution = null
        currentSolutionPath = ''
        renderEditorView()
        await loadSourceFile(result.path.replace(/^\//, ''))
      }

      // ---------- 渲染编辑器视图 ----------
      function renderEditorView(): void {
        const projName = currentProject ? currentProject.name : '单文件模式'
        const slnBadge = currentSolution ? `<span class="epp-solution-badge" title="${currentSolution.name}">${ICON_SOLUTION}<span class="epp-solution-name">${currentSolution.name}</span></span>` : ''
        win!.setTitle(`EPP 编译器 - ${projName}`)
        content.innerHTML = `
          <div class="epp-toolbar">
            ${slnBadge}
            <div class="epp-project-badge" id="epp-project-badge">
              ${ICON_PROJECT}
              <span class="epp-project-name">${projName}</span>
            </div>
            <select class="epp-file-select" id="epp-file-select" title="切换项目文件"></select>
            <div class="epp-divider"></div>
            <select class="epp-config-select" id="epp-config-select" title="编译配置">
              <option value="Debug">Debug</option>
              <option value="Release">Release</option>
            </select>
            <div class="epp-divider"></div>
            <button class="epp-btn" id="epp-new-file" title="新建源文件">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>
            </button>
            <button class="epp-btn" id="epp-save" title="保存源文件 (Ctrl+S)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            </button>
            <button class="epp-btn" id="epp-saveas" title="另存为">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            </button>
            <div class="epp-divider"></div>
            <button class="epp-btn" id="epp-compile" title="仅编译（生成到 bin/<配置>/）">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 17l6-6-6-6M14 7l6 6-6 6"/></svg>
            </button>
            <button class="epp-btn epp-btn-primary" id="epp-run" title="编译并运行 (F5)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </button>
            <div class="epp-divider"></div>
            <button class="epp-btn" id="epp-close-project" title="关闭项目">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="epp-body">
            <!-- 中部：编辑器 + 底部输出窗口 -->
            <div class="epp-editor-and-output">
              <div class="epp-editor-panel">
                <div class="epp-panel-header" id="epp-panel-header">源代码 (.e)</div>
                <div class="epp-editor-container" id="epp-editor-container">
                  <div class="epp-line-numbers" id="epp-line-numbers"></div>
                  <div class="epp-code-wrapper">
                    <pre class="epp-highlighted-code" id="epp-highlighted-code"><code></code></pre>
                    <textarea class="epp-editor" id="epp-editor" spellcheck="false"></textarea>
                  </div>
                </div>
              </div>
              <!-- 底部输出面板（可折叠） -->
              <div class="epp-bottom-pane" id="epp-bottom-pane">
                <div class="epp-bottom-header">
                  <div class="epp-bottom-tabs">
                    <span class="epp-tab epp-tab-active" data-tab="output">输出</span>
                    <span class="epp-tab" data-tab="errors">错误列表</span>
                  </div>
                  <div class="epp-bottom-actions">
                    <button class="epp-pane-btn" id="epp-output-clear" title="清空输出">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                    <button class="epp-pane-btn" id="epp-output-toggle" title="折叠/展开">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9" id="epp-output-toggle-arrow"/></polyline>
                    </svg>
                    </button>
                  </div>
                </div>
                <div class="epp-output" id="epp-output"></div>
              </div>
            </div>
            <!-- 右侧：解决方案资源管理器（管理项目文件） -->
            <div class="epp-solution-pane">
              <div class="epp-pane-header">
                <span class="epp-pane-title">解决方案资源管理器</span>
                <div class="epp-pane-toolbar">
                  <button class="epp-pane-btn" id="epp-explorer-new" title="新建源文件">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                  <button class="epp-pane-btn" id="epp-explorer-refresh" title="刷新">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                  </button>
                </div>
              </div>
              <div class="epp-solution-tree" id="epp-solution-tree"></div>
            </div>
          </div>
        `

        // -------- 文件下拉框（工具栏） --------
        const fileSelect = content.querySelector('#epp-file-select') as HTMLSelectElement
        if (currentProject) {
          currentProject.files.forEach(f => {
            const opt = document.createElement('option')
            opt.value = f
            opt.textContent = f
            fileSelect.appendChild(opt)
          })
          fileSelect.value = currentProject.main
          fileSelect.style.display = ''
          fileSelect.addEventListener('change', async () => {
            const f = fileSelect.value
            await loadSourceFile(`${currentProjectPath}/${f}`)
          })
        } else {
          fileSelect.style.display = 'none'
        }

        // -------- 编译配置 --------
        const configSelect = content.querySelector('#epp-config-select') as HTMLSelectElement
        configSelect.value = compileConfig
        configSelect.addEventListener('change', () => {
          compileConfig = configSelect.value as CompileConfig
          log(`编译配置已切换为: ${compileConfig}`, 'info')
        })

        // -------- 工具栏按钮 --------
        content.querySelector('#epp-new-file')?.addEventListener('click', handleNewFile)
        content.querySelector('#epp-save')?.addEventListener('click', handleSave)
        content.querySelector('#epp-saveas')?.addEventListener('click', handleSaveAs)
        content.querySelector('#epp-compile')?.addEventListener('click', handleCompile)
        content.querySelector('#epp-run')?.addEventListener('click', handleRun)
        content.querySelector('#epp-close-project')?.addEventListener('click', () => {
          currentProject = null
          currentProjectPath = ''
          currentSolution = null
          currentSolutionPath = ''
          currentFilePath = ''
          showStartPage()
        })

        // -------- 解决方案资源管理器按钮 --------
        content.querySelector('#epp-explorer-new')?.addEventListener('click', handleNewFile)
        content.querySelector('#epp-explorer-refresh')?.addEventListener('click', renderSolutionExplorer)

        // -------- 代码编辑器：行号 + 语法高亮 + 滚动同步 --------
        setupCodeEditor(content)

        // -------- 编辑器右键菜单 --------
        const editorEl = content.querySelector('#epp-editor') as HTMLTextAreaElement
        editorEl?.addEventListener('contextmenu', (e) => {
          e.preventDefault()
          showEditorContextMenu(e.clientX, e.clientY)
        })

        // -------- 底部面板控制 --------
        let outputCollapsed = false
        const toggleBtn = content.querySelector('#epp-output-toggle')
        toggleBtn?.addEventListener('click', () => {
          outputCollapsed = !outputCollapsed
          const pane = content.querySelector('#epp-bottom-pane') as HTMLElement
          const arrow = content.querySelector('#epp-output-toggle-arrow') as SVGPolylineElement
          if (outputCollapsed) {
            pane?.classList.add('epp-bottom-collapsed')
            if (arrow) arrow.setAttribute('points', '6 15 12 9 18 15')
          } else {
            pane?.classList.remove('epp-bottom-collapsed')
            if (arrow) arrow.setAttribute('points', '6 9 12 15 18 9')
          }
        })
        content.querySelector('#epp-output-clear')?.addEventListener('click', clearOutput)
        // Tab 切换
        content.querySelectorAll('.epp-tab').forEach(tab => {
          tab.addEventListener('click', () => {
            content.querySelectorAll('.epp-tab').forEach(t => t.classList.remove('epp-tab-active'))
            ;(tab as HTMLElement).classList.add('epp-tab-active')
            // 目前只有 output 有内容，errors 是占位
          })
        })

        // -------- 渲染解决方案树 --------
        renderSolutionExplorer()
      }

      // ---------- 渲染解决方案资源管理器 ----------
      async function renderSolutionExplorer(): Promise<void> {
        const tree = content.querySelector('#epp-solution-tree') as HTMLElement | null
        if (!tree) return
        tree.innerHTML = ''

        // 空白区域右键菜单
        tree.addEventListener('contextmenu', (ev) => {
          // 仅在点击 tree 本身（非子节点）时触发
          if (ev.target === tree) {
            ev.preventDefault()
            showTreeContextMenu(ev.clientX, ev.clientY)
          }
        })

        if (currentSolution) {
          // 解决方案节点
          const slnNode = document.createElement('div')
          slnNode.className = 'epp-tree-node epp-tree-sln'
          slnNode.innerHTML = `<div class="epp-tree-item">
            <span class="epp-tree-caret epp-caret-open">▾</span>
            <span class="epp-tree-icon">${ICON_SOLUTION}</span>
            <span class="epp-tree-label">解决方案 '${currentSolution.name}' (${currentSolution.projects.length})</span>
          </div>`
          // 解决方案节点右键菜单
          slnNode.querySelector('.epp-tree-item')?.addEventListener('contextmenu', (ev: Event) => {
            ev.preventDefault()
            ev.stopPropagation()
            const me = ev as MouseEvent
            showSolutionContextMenu(me.clientX, me.clientY)
          })
          const slnBody = document.createElement('div')
          slnBody.className = 'epp-tree-children'
          for (const sp of currentSolution.projects) {
            const projFullPath = `${currentSolutionPath}/${sp.path}`.replace(/\/+/g, '/')
            try {
              const { project } = await loadProject(fs, projFullPath)
              const isCurrent = currentProjectPath === projFullPath
              const projNode = await buildProjectNode(project, projFullPath, isCurrent)
              slnBody.appendChild(projNode)
            } catch {
              const fail = document.createElement('div')
              fail.className = 'epp-tree-node epp-tree-project epp-tree-error'
              fail.innerHTML = `<div class="epp-tree-item"><span class="epp-tree-caret">▸</span><span class="epp-tree-icon">${ICON_PROJECT}</span><span class="epp-tree-label">${sp.name} (加载失败)</span></div>`
              slnBody.appendChild(fail)
            }
          }
          slnNode.appendChild(slnBody)
          tree.appendChild(slnNode)
        } else if (currentProject) {
          // 仅项目模式
          const projNode = await buildProjectNode(currentProject, currentProjectPath, true)
          tree.appendChild(projNode)
        } else {
          // 单文件模式
          tree.innerHTML = `<div class="epp-tree-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <p>当前为单文件模式</p>
            <p class="epp-tree-empty-hint">返回启动页新建或打开项目以管理多文件</p>
            <button class="epp-btn epp-btn-inline" id="epp-explorer-goto-start">返回启动页</button>
          </div>`
          tree.querySelector('#epp-explorer-goto-start')?.addEventListener('click', showStartPage)
          return
        }
      }

      // 构建项目树节点
      async function buildProjectNode(
        project: EPPProject,
        projectDir: string,
        isCurrent: boolean
      ): Promise<HTMLElement> {
        const node = document.createElement('div')
        node.className = `epp-tree-node epp-tree-project ${isCurrent ? 'epp-tree-current' : ''}`
        const header = document.createElement('div')
        header.className = 'epp-tree-item'
        if (!isCurrent) {
          // 非当前项目：点击可以切换过去
          header.style.cursor = 'pointer'
          header.addEventListener('dblclick', async () => {
            try {
              const { project: loaded } = await loadProject(fs, projectDir)
              currentProject = loaded
              currentProjectPath = projectDir
              renderEditorView()
              await loadSourceFile(`${projectDir}/${loaded.main}`)
            } catch (e) {
              log(`加载项目失败: ${(e as Error).message}`, 'error')
            }
          })
        }
        header.innerHTML = `
          <span class="epp-tree-caret epp-caret-open">▾</span>
          <span class="epp-tree-icon">${ICON_PROJECT}</span>
          <span class="epp-tree-label">${project.name}${isCurrent ? ' <span class="epp-tree-tag">当前</span>' : ''}</span>
          <span class="epp-tree-version">v${project.version}</span>
        `
        // 项目节点右键菜单
        header.addEventListener('contextmenu', (ev) => {
          ev.preventDefault()
          ev.stopPropagation()
          showProjectContextMenu(ev.clientX, ev.clientY, project, projectDir, isCurrent)
        })
        node.appendChild(header)

        const body = document.createElement('div')
        body.className = 'epp-tree-children'

        // 每个源文件
        for (const fileName of project.files) {
          const fileNode = document.createElement('div')
          fileNode.className = `epp-tree-node epp-tree-file ${currentFilePath.endsWith('/' + fileName) || (currentFilePath === projectDir + '/' + fileName) ? 'epp-tree-active-file' : ''}`
          const item = document.createElement('div')
          item.className = 'epp-tree-item'
          const isMain = fileName === project.main
          item.innerHTML = `
            <span class="epp-tree-caret epp-caret-none"></span>
            <span class="epp-tree-icon">${E_SOURCE_ICON}</span>
            <span class="epp-tree-label">${fileName}${isMain ? ' <span class="epp-tree-tag epp-tree-tag-main">入口</span>' : ''}</span>
          `
          // 单文件双击打开
          fileNode.addEventListener('dblclick', async (e) => {
            if ((e.target as HTMLElement).classList.contains('epp-tree-del-btn')) return
            // 先保存当前编辑器
            await saveCurrentEditorIfDirty()
            await loadSourceFile(`${projectDir}/${fileName}`)
            renderSolutionExplorer()
          })
          // 右键菜单：打开 / 重命名 / 删除 / 设为入口 / 在文件管理器中显示
          item.addEventListener('contextmenu', (ev) => {
            ev.preventDefault()
            ev.stopPropagation()
            showFileContextMenu(ev.clientX, ev.clientY, fileName, projectDir, project, isMain)
          })
          // 删除按钮
          if (isCurrent) {
            const delBtn = document.createElement('span')
            delBtn.className = 'epp-tree-del-btn'
            delBtn.title = '从项目中移除并删除文件'
            delBtn.textContent = '×'
            delBtn.addEventListener('click', async (e) => {
              e.stopPropagation()
              if (fileName === project.main) {
                dialog.alert('不能删除项目入口文件，可先将其他文件设为入口。', '提示')
                return
              }
              const ok = await dialog.confirm(`确定删除文件 "${fileName}"？此操作不可恢复。`, '确认删除')
              if (!ok) return
              try {
                const full = `${projectDir}/${fileName}`
                const item2 = await fs.getByPath(full)
                if (item2) await fs.deleteItem(item2.id)
                project.files = project.files.filter(f => f !== fileName)
                await fs.writeFile(`${projectDir}/project.epproj`, JSON.stringify(project, null, 2))
                eventBus.emit('fs:changed')
                log(`已删除: ${full}`, 'success')
                // 如果删除的是当前打开文件，切换回 main
                if (currentFilePath === full) {
                  currentFilePath = ''
                  await loadSourceFile(`${projectDir}/${project.main}`)
                }
                renderEditorView()
              } catch (err) {
                log(`删除失败: ${(err as Error).message}`, 'error')
              }
            })
            item.appendChild(delBtn)
          }

          fileNode.appendChild(item)
          body.appendChild(fileNode)
        }

        // 项目属性区（仅当前项目）
        if (isCurrent) {
          const props = document.createElement('div')
          props.className = 'epp-tree-props'
          props.innerHTML = `
            <div class="epp-prop-row"><span class="epp-prop-k">编译配置</span><span class="epp-prop-v">${compileConfig}</span></div>
            <div class="epp-prop-row"><span class="epp-prop-k">入口文件</span><span class="epp-prop-v">${project.main}</span></div>
            <div class="epp-prop-row"><span class="epp-prop-k">文件数</span><span class="epp-prop-v">${project.files.length}</span></div>
          `
          body.appendChild(props)
        }

        node.appendChild(body)
        return node
      }

      // ---------- 统一右键菜单 ----------
      interface CtxMenuItem {
        label?: string
        icon?: string
        separator?: boolean
        disabled?: boolean
        danger?: boolean
        action?: () => void | Promise<void>
      }

      function showContextMenu(x: number, y: number, items: CtxMenuItem[]): void {
        // 关闭已有菜单
        document.querySelectorAll('.epp-ctx-menu').forEach(m => m.remove())
        const menu = document.createElement('div')
        menu.className = 'epp-ctx-menu'
        // 防止超出视口
        const menuWidth = 200, menuHeight = items.length * 32
        const finalX = x + menuWidth > window.innerWidth ? window.innerWidth - menuWidth - 4 : x
        const finalY = y + menuHeight > window.innerHeight ? window.innerHeight - menuHeight - 4 : y
        menu.style.left = `${finalX}px`
        menu.style.top = `${finalY}px`

        for (const m of items) {
          if (m.separator) {
            const sep = document.createElement('div')
            sep.className = 'epp-ctx-menu-sep'
            menu.appendChild(sep)
            continue
          }
          const btn = document.createElement('div')
          btn.className = `epp-ctx-menu-item${m.disabled ? ' epp-ctx-disabled' : ''}${m.danger ? ' epp-ctx-danger' : ''}`
          if (m.icon) {
            const icon = document.createElement('span')
            icon.className = 'epp-ctx-menu-icon'
            icon.innerHTML = m.icon
            btn.appendChild(icon)
          }
          const label = document.createElement('span')
          label.textContent = m.label || ''
          btn.appendChild(label)
          if (!m.disabled && m.action) {
            btn.addEventListener('click', async () => {
              menu.remove()
              document.removeEventListener('click', outsideClose)
              document.removeEventListener('contextmenu', outsideClose)
              await m.action!()
            })
          }
          menu.appendChild(btn)
        }

        const outsideClose = (e: MouseEvent) => {
          if (!menu.contains(e.target as Node)) {
            menu.remove()
            document.removeEventListener('click', outsideClose)
            document.removeEventListener('contextmenu', outsideClose)
          }
        }
        document.body.appendChild(menu)
        setTimeout(() => {
          document.addEventListener('click', outsideClose)
          document.addEventListener('contextmenu', outsideClose)
        }, 0)
      }

      // ---------- 编辑器右键菜单 ----------
      function showEditorContextMenu(x: number, y: number): void {
        const editor = content.querySelector('#epp-editor') as HTMLTextAreaElement
        const hasSelection = editor && editor.selectionStart !== editor.selectionEnd
        showContextMenu(x, y, [
          {
            label: '剪切', disabled: !hasSelection,
            icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>',
            action: () => { document.execCommand('cut') }
          },
          {
            label: '复制', disabled: !hasSelection,
            icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
            action: () => { document.execCommand('copy') }
          },
          {
            label: '粘贴',
            icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>',
            action: () => { document.execCommand('paste') }
          },
          {
            label: '全选',
            icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 9 4 4 9 4"/><polyline points="20 9 20 4 15 4"/><polyline points="4 15 4 20 9 20"/><polyline points="20 15 20 20 15 20"/></svg>',
            action: () => { editor?.select() }
          },
          { separator: true },
          {
            label: '保存',
            icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>',
            action: () => { void handleSave() }
          },
          {
            label: '另存为...',
            icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
            action: () => { void handleSaveAs() }
          },
          { separator: true },
          {
            label: '编译',
            icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 17l6-6-6-6M14 7l6 6-6 6"/></svg>',
            action: () => { void handleCompile() }
          },
          {
            label: '编译并运行',
            icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
            action: () => { void handleRun() }
          }
        ])
      }

      // ---------- 解决方案资源管理器 - 文件右键菜单 ----------
      function showFileContextMenu(
        x: number, y: number,
        fileName: string, projectDir: string, project: EPPProject, isMain: boolean
      ): void {
        showContextMenu(x, y, [
          {
            label: '打开',
            icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
            action: async () => {
              await saveCurrentEditorIfDirty()
              await loadSourceFile(`${projectDir}/${fileName}`)
              renderSolutionExplorer()
            }
          },
          { separator: true },
          {
            label: '重命名',
            icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
            action: async () => {
              const newName = await dialog.prompt('新文件名：', fileName, '重命名文件')
              if (!newName || !newName.trim() || newName === fileName) return
              let cleaned = newName.trim().replace(/[\\/:*?"<>|]/g, '_')
              if (!cleaned.toLowerCase().endsWith('.e')) cleaned += '.e'
              if (project.files.includes(cleaned)) {
                dialog.alert('文件名已存在', '提示'); return
              }
              const oldFull = `${projectDir}/${fileName}`
              const newFull = `${projectDir}/${cleaned}`
              const oldItem = await fs.getByPath(oldFull)
              if (!oldItem) { log('源文件不存在', 'error'); return }
              const data = await fs.readFile(oldItem.id)
              await fs.writeFile(newFull, data ?? '')
              await fs.deleteItem(oldItem.id)
              project.files = project.files.map(f => f === fileName ? cleaned : f)
              if (project.main === fileName) project.main = cleaned
              await fs.writeFile(`${projectDir}/project.epproj`, JSON.stringify(project, null, 2))
              if (currentFilePath === oldFull) {
                currentFilePath = newFull
              }
              eventBus.emit('fs:changed')
              log(`已重命名为 ${cleaned}`, 'success')
              renderEditorView()
            }
          },
          {
            label: '设为入口文件',
            disabled: isMain,
            icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
            action: async () => {
              project.main = fileName
              await fs.writeFile(`${projectDir}/project.epproj`, JSON.stringify(project, null, 2))
              log(`入口文件设为: ${fileName}`, 'success')
              renderEditorView()
            }
          },
          { separator: true },
          {
            label: '在文件管理器中显示',
            icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
            action: () => {
              eventBus.emit('app:launch', 'file-manager', projectDir)
            }
          },
          {
            label: '复制文件名',
            icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
            action: () => {
              navigator.clipboard?.writeText(fileName).catch(() => {})
              log(`已复制: ${fileName}`, 'info')
            }
          },
          { separator: true },
          {
            label: '删除文件',
            disabled: isMain,
            danger: true,
            icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
            action: async () => {
              if (isMain) return
              const ok = await dialog.confirm(`确定删除 "${fileName}"？此操作不可恢复。`, '确认删除')
              if (!ok) return
              const full = `${projectDir}/${fileName}`
              const it = await fs.getByPath(full)
              if (it) await fs.deleteItem(it.id)
              project.files = project.files.filter(f => f !== fileName)
              await fs.writeFile(`${projectDir}/project.epproj`, JSON.stringify(project, null, 2))
              if (currentFilePath === full) {
                currentFilePath = ''
                await loadSourceFile(`${projectDir}/${project.main}`)
              }
              eventBus.emit('fs:changed')
              log(`已删除: ${full}`, 'success')
              renderEditorView()
            }
          }
        ])
      }

      // ---------- 解决方案资源管理器 - 项目节点右键菜单 ----------
      function showProjectContextMenu(
        x: number, y: number,
        project: EPPProject, projectDir: string, isCurrent: boolean
      ): void {
        showContextMenu(x, y, [
          {
            label: '新建源文件',
            icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>',
            action: async () => {
              if (!isCurrent) {
                // 切换到该项目
                try {
                  const { project: loaded } = await loadProject(fs, projectDir)
                  currentProject = loaded
                  currentProjectPath = projectDir
                  renderEditorView()
                } catch (e) {
                  log(`加载项目失败: ${(e as Error).message}`, 'error')
                  return
                }
              }
              await handleNewFile()
            }
          },
          {
            label: '编译项目',
            icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 17l6-6-6-6M14 7l6 6-6 6"/></svg>',
            action: async () => {
              if (!isCurrent) {
                try {
                  const { project: loaded } = await loadProject(fs, projectDir)
                  currentProject = loaded
                  currentProjectPath = projectDir
                  renderEditorView()
                } catch (e) {
                  log(`加载项目失败: ${(e as Error).message}`, 'error')
                  return
                }
              }
              await handleCompile()
            }
          },
          {
            label: '编译并运行',
            icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
            action: async () => {
              if (!isCurrent) {
                try {
                  const { project: loaded } = await loadProject(fs, projectDir)
                  currentProject = loaded
                  currentProjectPath = projectDir
                  renderEditorView()
                } catch (e) {
                  log(`加载项目失败: ${(e as Error).message}`, 'error')
                  return
                }
              }
              await handleRun()
            }
          },
          { separator: true },
          {
            label: '在文件管理器中显示',
            icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
            action: () => {
              eventBus.emit('app:launch', 'file-manager', projectDir)
            }
          },
          { separator: true },
          {
            label: '刷新',
            icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
            action: () => { renderSolutionExplorer() }
          }
        ])
      }

      // ---------- 解决方案资源管理器 - 解决方案节点右键菜单 ----------
      function showSolutionContextMenu(x: number, y: number): void {
        showContextMenu(x, y, [
          {
            label: '新建源文件',
            icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>',
            action: () => { void handleNewFile() }
          },
          { separator: true },
          {
            label: '在文件管理器中显示',
            icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
            action: () => {
              if (currentSolutionPath) {
                eventBus.emit('app:launch', 'file-manager', currentSolutionPath)
              }
            }
          },
          { separator: true },
          {
            label: '刷新',
            icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
            action: () => { renderSolutionExplorer() }
          },
          {
            label: '关闭解决方案',
            danger: true,
            icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
            action: () => {
              currentProject = null
              currentProjectPath = ''
              currentSolution = null
              currentSolutionPath = ''
              currentFilePath = ''
              showStartPage()
            }
          }
        ])
      }

      // ---------- 解决方案资源管理器 - 空白区域右键菜单 ----------
      function showTreeContextMenu(x: number, y: number): void {
        const items: CtxMenuItem[] = []
        if (currentProject) {
          items.push({
            label: '新建源文件',
            icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>',
            action: () => { void handleNewFile() }
          })
          items.push({ separator: true })
        }
        items.push({
          label: '刷新',
          icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
          action: () => { renderSolutionExplorer() }
        })
        if (currentProject || currentSolutionPath) {
          items.push({
            label: '在文件管理器中显示',
            icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
            action: () => {
              const path = currentProjectPath || currentSolutionPath
              if (path) eventBus.emit('app:launch', 'file-manager', path)
            }
          })
        }
        showContextMenu(x, y, items)
      }

      // 保存当前编辑器（若脏则先保存；若未保存过则调用 saveAs 流程）
      async function saveCurrentEditorIfDirty(): Promise<boolean> {
        const editor = content.querySelector('#epp-editor') as HTMLTextAreaElement
        if (!editor || !currentFilePath) return true
        try {
          const disk = await fs.getByPath(currentFilePath)
          if (!disk) {
            await saveSourceFile(currentFilePath, editor.value)
            return true
          }
          const existing = await fs.readFile(disk.id)
          if (existing !== editor.value) {
            await saveSourceFile(currentFilePath, editor.value)
          }
          return true
        } catch {
          return true
        }
      }

      // ---------- 加载源文件到编辑器 ----------
      async function loadSourceFile(filePath: string): Promise<void> {
        const editor = content.querySelector('#epp-editor') as HTMLTextAreaElement
        const panelHeader = content.querySelector('#epp-panel-header') as HTMLElement
        if (!editor) return
        try {
          const fileItem = await fs.getByPath(filePath)
          if (!fileItem || fileItem.type !== 'file') {
            editor.value = ''
            currentFilePath = filePath
            panelHeader.textContent = filePath.split('/').pop() || '源代码 (.e)'
            triggerEditorUpdate()
            return
          }
          const data = await fs.readFile(fileItem.id)
          editor.value = data || ''
          currentFilePath = filePath
          panelHeader.textContent = fileItem.name
          const fileSelect = content.querySelector('#epp-file-select') as HTMLSelectElement
          if (fileSelect && currentProject) {
            fileSelect.value = fileItem.name
          }
          triggerEditorUpdate()
          log(`已打开: ${filePath}`, 'success')
        } catch (e) {
          log(`打开文件失败: ${(e as Error).message}`, 'error')
        }
      }

      /** 触发编辑器行号和语法高亮更新 */
      function triggerEditorUpdate(): void {
        const textarea = content.querySelector('#epp-editor') as HTMLTextAreaElement
        const lineNumbers = content.querySelector('#epp-line-numbers') as HTMLElement
        const highlightedCode = content.querySelector('#epp-highlighted-code') as HTMLElement
        const codeEl = highlightedCode?.querySelector('code') as HTMLElement
        if (!textarea || !lineNumbers || !codeEl) return
        // 更新行号
        const lines = textarea.value.split('\n')
        let lnHtml = ''
        for (let i = 1; i <= lines.length; i++) {
          lnHtml += `<div class="epp-ln">${i}</div>`
        }
        lineNumbers.innerHTML = lnHtml
        const digits = String(lines.length).length
        lineNumbers.style.width = (28 + digits * 10) + 'px'
        // 更新语法高亮
        codeEl.innerHTML = highlightEPPCode(textarea.value)
      }

      function log(text: string, type: 'info' | 'error' | 'success' = 'info'): void {
        const output = content.querySelector('#epp-output') as HTMLElement
        if (!output) return
        const line = document.createElement('div')
        line.className = `epp-log epp-log-${type}`
        line.textContent = text
        output.appendChild(line)
        output.scrollTop = output.scrollHeight
      }

      function clearOutput(): void {
        const output = content.querySelector('#epp-output') as HTMLElement
        if (output) output.innerHTML = ''
      }

      // ---------- 代码编辑器：行号 + 语法高亮 ----------
      function setupCodeEditor(ctx: HTMLElement): void {
        const textarea = ctx.querySelector('#epp-editor') as HTMLTextAreaElement
        const lineNumbers = ctx.querySelector('#epp-line-numbers') as HTMLElement
        const highlightedCode = ctx.querySelector('#epp-highlighted-code') as HTMLElement
        const codeEl = highlightedCode?.querySelector('code') as HTMLElement
        if (!textarea || !lineNumbers || !codeEl) return

        function updateLineNumbers(): void {
          const lines = textarea.value.split('\n')
          const lineCount = lines.length
          let html = ''
          for (let i = 1; i <= lineCount; i++) {
            html += `<div class="epp-ln">${i}</div>`
          }
          lineNumbers.innerHTML = html
          // 更新行号栏宽度
          const digits = String(lineCount).length
          lineNumbers.style.width = (28 + digits * 10) + 'px'
        }

        function updateHighlighting(): void {
          const code = textarea.value
          codeEl.innerHTML = highlightEPPCode(code)
        }

        function updateEditor(): void {
          updateLineNumbers()
          updateHighlighting()
        }

        // 同步滚动
        textarea.addEventListener('scroll', () => {
          codeEl.parentElement!.scrollTop = textarea.scrollTop
          lineNumbers.scrollTop = textarea.scrollTop
        })

        // 输入时更新
        textarea.addEventListener('input', updateEditor)

        // 点击行号区定位到对应行
        lineNumbers.addEventListener('click', (e) => {
          const target = e.target as HTMLElement
          if (target.classList.contains('epp-ln')) {
            const lineNum = parseInt(target.textContent || '1', 10) - 1
            const lines = textarea.value.split('\n')
            let pos = 0
            for (let i = 0; i < lineNum && i < lines.length; i++) {
              pos += lines[i].length + 1
            }
            textarea.focus()
            textarea.setSelectionRange(pos, pos)
          }
        })

        // 标签键支持
        textarea.addEventListener('keydown', (e) => {
          if (e.key === 'Tab') {
            e.preventDefault()
            const start = textarea.selectionStart
            const end = textarea.selectionEnd
            const before = textarea.value.substring(0, start)
            const after = textarea.value.substring(end)
            textarea.value = before + '  ' + after
            textarea.selectionStart = textarea.selectionEnd = start + 2
            updateEditor()
          }
        })

        // 初始更新
        updateEditor()
      }

      // ---------- EPP 语法高亮 — [SYNC] 与 epp_compiler.py SYNTAX_KEYWORDS / SYNTAX_BUILTINS 保持同步 ----------
      function highlightEPPCode(code: string): string {
        const keywords = new Set([
          'if', 'else', 'while', 'for', 'do', 'break', 'continue', 'return',
          'function', 'var', 'let', 'const', 'true', 'false', 'null', 'undefined',
          'new', 'this', 'typeof', 'instanceof', 'in', 'of', 'try', 'catch',
          'finally', 'throw', 'switch', 'case', 'default', 'class', 'extends',
          'super', 'import', 'export', 'async', 'await', 'yield', 'delete', 'void'
        ])
        const builtins = new Set([
          'print', 'println', 'readLine', 'showMessage', 'showConfirm', 'showPrompt',
          'showOpenDialog', 'showSaveDialog', 'showFolderDialog',
          'createWindow', 'openWindow', 'closeWindow', 'setWindowTitle',
          'setWindowContent', 'setWindowSize', 'getWindowSize', 'centerWindow',
          'minimizeWindow', 'maximizeWindow', 'isWindowMaximized', 'onWindowClose',
          'getElementById', 'createElement', 'appendElement', 'onEvent',
          'readFile', 'writeFile', 'listFiles', 'createDirectory', 'deleteFile',
          'fileExists', 'copyFile', 'moveFile',
          'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
          'httpRequest', 'clipboardWrite', 'clipboardRead',
          'getEnv', 'setEnv', 'getTimestamp', 'formatDate', 'random',
          'getScreenWidth', 'getScreenHeight',
          'console', 'Math', 'JSON', 'String', 'Number', 'Array', 'Object',
          'Boolean', 'Date', 'parseInt', 'parseFloat', 'isNaN', 'toString'
        ])

        // 转义 HTML 特殊字符
        let escaped = code
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')

        // 用占位符令牌暂存注入的 span 标签，防止后续正则再扫描到标签内容（如 class/keyword 等词），
        // 避免损坏 HTML 结构导致高亮文本与 textarea 不一致、光标错位。
        // 占位符索引后追加字母 q：使数字正则 \b\d+\.?\d*\b 无法在数字与字母之间形成单词边界，
        // 从而不会误匹配占位符里的数字。
        const tokens: string[] = []
        const stash = (tag: string) => `\u0000${tokens.push(tag) - 1}q\u0000`

        // 高亮字符串（单引号、双引号、反引号）
        escaped = escaped.replace(/(["'`])((?:\\.|(?!\1)[^\\])*?)\1/g,
          (m) => stash(`<span class="epp-hl-string">${m}</span>`))

        // 高亮注释 //
        escaped = escaped.replace(/(\/\/[^\n]*)/g,
          (m) => stash(`<span class="epp-hl-comment">${m}</span>`))

        // 高亮数字
        escaped = escaped.replace(/\b(\d+\.?\d*)\b/g,
          (m) => stash(`<span class="epp-hl-number">${m}</span>`))

        // 高亮关键字（需要确保不在字符串/注释内）
        for (const kw of keywords) {
          const regex = new RegExp('\\b(' + kw + ')\\b', 'g')
          escaped = escaped.replace(regex, (m) => stash(`<span class="epp-hl-keyword">${m}</span>`))
        }

        // 高亮内置函数
        for (const bn of builtins) {
          const regex = new RegExp('\\b(' + bn + ')\\b', 'g')
          escaped = escaped.replace(regex, (m) => stash(`<span class="epp-hl-builtin">${m}</span>`))
        }

        // 最后把所有占位符还原成真正的 span 标签（迭代还原以处理嵌套占位符，如注释内的字符串）
        let out = escaped
        let prev: string
        do {
          prev = out
          out = out.replace(/\u0000(\d+)q\u0000/g, (_, i) => tokens[+i])
        } while (out !== prev)
        return out
      }

      // ---------- 新建源文件 ----------
      async function handleNewFile(): Promise<void> {
        if (!currentProject) {
          const editor = content.querySelector('#epp-editor') as HTMLTextAreaElement
          editor.value = ''
          currentFilePath = ''
          ;(content.querySelector('#epp-panel-header') as HTMLElement).textContent = '源代码 (.e)'
          triggerEditorUpdate()
          return
        }
        const name = await dialog.prompt('请输入源文件名：', 'source.e', '新建源文件')
        if (!name || !name.trim()) return
        let fileName = name.trim().replace(/[\\/:*?"<>|]/g, '_')
        if (!fileName.toLowerCase().endsWith('.e')) fileName += '.e'
        if (currentProject.files.includes(fileName)) {
          await dialog.alert('文件名已存在', '提示')
          return
        }
        const filePath = `${currentProjectPath}/${fileName}`
        try {
          await fs.writeFile(filePath, '')
          currentProject.files.push(fileName)
          await fs.writeFile(`${currentProjectPath}/project.epproj`, JSON.stringify(currentProject, null, 2))
          eventBus.emit('fs:changed')
          await loadSourceFile(filePath)
          // 刷新解决方案资源管理器和下拉框
          renderEditorView()
        } catch (e) {
          log(`新建文件失败: ${(e as Error).message}`, 'error')
        }
      }

      // ---------- 保存 ----------
      async function handleSave(): Promise<void> {
        const editor = content.querySelector('#epp-editor') as HTMLTextAreaElement
        if (!currentFilePath) {
          await handleSaveAs()
          return
        }
        await saveSourceFile(currentFilePath, editor.value)
      }

      async function handleSaveAs(): Promise<void> {
        const editor = content.querySelector('#epp-editor') as HTMLTextAreaElement
        const defaultName = currentFilePath
          ? currentFilePath.split('/').pop()
          : 'program.e'
        const result = await showSaveFileDialog(fs, {
          title: '保存 EPP 源文件',
          defaultDir: currentFilePath ? '/' + currentFilePath.split('/').slice(0, -1).join('/') : '/Users/Admin/Documents',
          defaultName: defaultName || 'program.e',
          okLabel: '保存'
        })
        if (!result) return

        let fileName = result.name
        if (!fileName.toLowerCase().endsWith('.e')) {
          fileName += '.e'
        }
        const path = result.path.replace(/[^/]+$/, fileName)
        currentFilePath = path
        ;(content.querySelector('#epp-panel-header') as HTMLElement).textContent = fileName
        await saveSourceFile(path, editor.value)
      }

      async function saveSourceFile(path: string, fileContent: string): Promise<void> {
        try {
          await fs.writeFile(path, fileContent)
          log(`已保存: ${path}`, 'success')
        } catch (e) {
          log(`保存失败: ${(e as Error).message}`, 'error')
        }
      }

      // ---------- 编译（使用新核心，输出到 bin/<配置>/） ----------
      async function handleCompile(): Promise<void> {
        if (!currentProject) {
          // 单文件模式：编译当前编辑器内容到用户选择位置
          await compileSingleFile()
          return
        }
        try {
          // 从磁盘重新加载项目，确保使用最新的项目名和配置
          const { project: freshProject } = await loadProject(fs, currentProjectPath)
          currentProject = freshProject
          log(`正在以 ${compileConfig} 配置编译项目 "${currentProject.name}"...`, 'info')
          const result = await compileProject(fs, currentProjectPath, currentProject, compileConfig)
          clearOutput()
          log(`========== 编译成功 ==========`, 'success')
          log(`项目: ${result.projectName}`, 'info')
          log(`配置: ${result.config}`, 'info')
          log(`输出: ${result.outputPath}`, 'info')
          log(`字节码: ${result.bytecodeSize} 字符`, 'info')
          log(`耗时: ${result.duration} ms`, 'info')
        } catch (e) {
          log(`编译错误: ${(e as Error).message}`, 'error')
        }
      }

      async function compileSingleFile(): Promise<void> {
        const editor = content.querySelector('#epp-editor') as HTMLTextAreaElement
        const sourceName = currentFilePath
          ? (currentFilePath.split('/').pop() || 'program').replace(/\.e$/i, '.epp')
          : 'program.epp'
        const defaultDir = currentFilePath
          ? '/' + currentFilePath.split('/').slice(0, -1).join('/')
          : '/Users/Admin/Documents'
        const result = await showSaveFileDialog(fs, {
          title: '编译为 EPP 可执行文件',
          defaultDir,
          defaultName: sourceName,
          okLabel: '编译保存'
        })
        if (!result) return
        let fileName = result.name
        if (!fileName.toLowerCase().endsWith('.epp')) fileName += '.epp'
        const path = result.path.replace(/[^/]+$/, fileName)
        try {
          const eppFile = compileCode(editor.value, 'EPP 程序', '1.0.0', compileConfig)
          await fs.writeFile(path, JSON.stringify(eppFile))
          clearOutput()
          log(`编译成功！配置: ${compileConfig}`, 'success')
          log(`已保存为: ${path}`, 'info')
          log(`字节码大小: ${eppFile.bytecode.length} 字符`, 'info')
        } catch (e) {
          log(`编译错误: ${(e as Error).message}`, 'error')
        }
      }

      // ---------- 运行 ----------
      const runEPP = async (eppFile: EPPFile): Promise<void> => {
        clearOutput()
        log('程序启动...', 'info')
        try {
          const decoded = JSON.parse(decodeURIComponent(atob(eppFile.bytecode)))
          const code = decoded.code
          const api = createRuntimeAPI(log, content, fs, wm, win)
          await executeCode(code, api)
          log('程序执行完毕。', 'success')
        } catch (e) {
          log(`运行错误: ${(e as Error).message}`, 'error')
        }
      }

      // Visual Studio 风格：点"运行" = 先编译（保存+编译），再运行
      async function handleRun(): Promise<void> {
        // 1. 先保存当前编辑器内容（若脏）
        await saveCurrentEditorIfDirty()
        const editor = content.querySelector('#epp-editor') as HTMLTextAreaElement

        try {
          if (currentProject) {
            // 从磁盘重新加载项目，确保使用最新的项目名和配置
            const { project: freshProject } = await loadProject(fs, currentProjectPath)
            currentProject = freshProject
            // 项目模式：完整编译项目（输出到 bin/<配置>/），再从编译结果运行
            const compileStart = Date.now()
            log(`========== 开始编译: ${currentProject.name} (${compileConfig}) ==========`, 'info')
            const result = await compileProject(fs, currentProjectPath, currentProject, compileConfig)
            log(`编译完成 ✓   ${result.duration} ms   ${result.bytecodeSize} 字符`, 'success')
            log(`输出文件: /${result.outputPath}`, 'info')
            log('')
            // 从编译产物读取并运行
            const outItem = await fs.getByPath(result.outputPath)
            if (outItem && outItem.type === 'file') {
              const eppJson = await fs.readFile(outItem.id)
              if (eppJson) {
                const eppFile = JSON.parse(eppJson) as EPPFile
                log('========== 开始运行 ==========', 'info')
                await runEPP(eppFile)
                eventBus.emit('fs:changed')
                return
              }
            }
            log('无法读取编译产物，改为使用入口源文件直接编译运行', 'info')
          }
          // 单文件模式 或 项目模式读取失败回退：直接编译当前编辑器内容运行
          const projectName = currentProject ? currentProject.name : 'EPP 程序'
          const projectVersion = currentProject ? currentProject.version : '1.0.0'
          const eppFile = compileCode(editor.value, projectName, projectVersion, compileConfig)
          await runEPP(eppFile)
        } catch (e) {
          log(`编译错误: ${(e as Error).message}`, 'error')
        }
      }

      // ---------- 初始化 ----------
      showStartPage()

      // 快捷键：F5 = 编译并运行, Ctrl+S = 保存, Ctrl+Shift+B = 仅编译
      const keyHandler = (e: KeyboardEvent) => {
        if (e.key === 'F5' && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
          const tag = (e.target as HTMLElement)?.tagName
          if (tag && tag !== 'TEXTAREA' && tag !== 'INPUT') {
            e.preventDefault()
            void handleRun()
          } else {
            // 编辑器内也允许 F5 启动
            e.preventDefault()
            void handleRun()
          }
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && !e.shiftKey) {
          e.preventDefault()
          void handleSave()
        } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'b') {
          e.preventDefault()
          void handleCompile()
        }
      }
      content.addEventListener('keydown', keyHandler)

      // 监听外部直接打开源文件的请求
      content.addEventListener('epp:open-file', (e: Event) => {
        const filePath = (e as CustomEvent).detail.filePath as string
        currentProject = null
        currentProjectPath = ''
        currentSolution = null
        currentSolutionPath = ''
        renderEditorView()
        void loadSourceFile(filePath.replace(/^\//, ''))
      })

      // 监听外部直接打开项目的请求
      content.addEventListener('epp:open-project', (e: Event) => {
        const projPath = (e as CustomEvent).detail.path as string
        void openProject(projPath)
      })

      // 监听外部直接打开解决方案的请求
      content.addEventListener('epp:open-solution', (e: Event) => {
        const slnPath = (e as CustomEvent).detail.path as string
        void openSolution(slnPath)
      })
    }
  })
}

/**
 * 创建运行时 API — [SYNC] 与 runner.ts / epp_compiler.py RUNNER_SCRIPT API 保持同步
 * 所有 44 个 API 必须保持一致
 */
function createRuntimeAPI(
  log: (text: string, type?: 'info' | 'error' | 'success') => void,
  content: HTMLElement,
  fs: FileSystem,
  wm: WindowManager,
  win: any
): EPPRuntimeAPI {
  const output = content.querySelector('#epp-output') as HTMLElement
  let activeWindowId: string | null = null
  let activeWindowContent: HTMLElement | null = null
  const timers: number[] = []

  return {
    print: (text) => {
      const last = output.lastElementChild
      if (last && last.classList.contains('epp-log-info')) {
        last.textContent += text
      } else {
        log(text, 'info')
      }
    },
    println: (text) => log(text, 'info'),
    readLine: async (prompt) => {
      if (prompt) log(prompt, 'info')
      return new Promise(resolve => {
        const input = document.createElement('input')
        input.className = 'epp-input-line'
        input.autofocus = true
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            const value = input.value
            input.remove()
            log(value, 'info')
            resolve(value)
          }
        })
        output.appendChild(input)
        setTimeout(() => input.focus(), 0)
      })
    },
    showMessage: (title, message) => dialog.alert(message, title),
    showConfirm: (title, message) => dialog.confirm(message, title),
    showPrompt: (title, message, defaultValue) => dialog.prompt(message, defaultValue, title),
    showOpenDialog: async (options) => {
      return dialog.showOpenDialog(fs, options)
    },
    showSaveDialog: async (options) => {
      return dialog.showSaveDialog(fs, options)
    },
    showFolderDialog: async (options) => {
      return dialog.showFolderDialog(fs, options)
    },
    createWindow: (options) => {
      const winId = wm.openApp('epp-runner', {
        manifest: {
          name: options.title || 'EPP 窗口',
          version: '1.0.0',
          defaultWidth: options.width || 400,
          defaultHeight: options.height || 300,
          entry: 'main'
        },
        bytecode: btoa(encodeURIComponent(JSON.stringify({
          manifest: { name: options.title || 'EPP 窗口', version: '1.0.0', entry: 'main' },
          code: ''
        })))
      })
      activeWindowId = winId || null
      if (winId) {
        const w = wm.getWindow(winId)
        if (w) {
          // 应用 createWindow 传入的窗口大小
          if (options.width) {
            w.width = options.width
            w.element.style.width = options.width + 'px'
          }
          if (options.height) {
            w.height = options.height
            w.element.style.height = options.height + 'px'
          }
          activeWindowContent = w.content.querySelector('.epp-runner-content') as HTMLElement
        }
      }
      return winId || ''
    },
    openWindow: (options) => {
      const winId = wm.openApp('epp-runner', {
        manifest: {
          name: options.title || 'EPP 窗口',
          version: '1.0.0',
          defaultWidth: options.width || 400,
          defaultHeight: options.height || 300,
          entry: 'main'
        },
        bytecode: btoa(encodeURIComponent(JSON.stringify({
          manifest: { name: options.title || 'EPP 窗口', version: '1.0.0', entry: 'main' },
          code: ''
        })))
      })
      activeWindowId = winId || ''
      if (winId) {
        const w = wm.getWindow(winId)
        if (w) {
          const c = w.content.querySelector('.epp-runner-content') as HTMLElement
          if (c) {
            if (options.content) {
              c.innerHTML = options.content
              // 重新执行脚本标签
              c.querySelectorAll('script').forEach(oldScript => {
                const newScript = document.createElement('script')
                // 复制所有属性（保留 type、data-* 等自定义属性）
                for (let i = 0; i < oldScript.attributes.length; i++) {
                  const attr = oldScript.attributes[i]
                  newScript.setAttribute(attr.name, attr.value)
                }
                if (oldScript.src) {
                  newScript.src = oldScript.src
                } else {
                  newScript.textContent = oldScript.textContent
                }
                oldScript.parentNode?.replaceChild(newScript, oldScript)
              })
              if (document.readyState === 'complete' || document.readyState === 'interactive') {
                document.dispatchEvent(new Event('DOMContentLoaded'))
              }
            }
            activeWindowContent = c
          }
        }
      }
      return winId || ''
    },
    closeWindow: (wid) => {
      if (wid) {
        wm.getWindow(wid)?.close()
      } else if (activeWindowId) {
        wm.getWindow(activeWindowId)?.close()
      }
    },
    setWindowTitle: (title) => {
      if (activeWindowId) {
        wm.getWindow(activeWindowId)?.setTitle(title)
      }
    },
    setWindowContent: (html) => {
      if (activeWindowContent) {
        // 设置 HTML 内容（innerHTML 不会执行 <script> 标签）
        activeWindowContent.innerHTML = html
        // 重新执行所有 <script> 标签
        activeWindowContent.querySelectorAll('script').forEach(oldScript => {
          const newScript = document.createElement('script')
          // 复制所有属性（保留 type、data-* 等自定义属性）
          for (let i = 0; i < oldScript.attributes.length; i++) {
            const attr = oldScript.attributes[i]
            newScript.setAttribute(attr.name, attr.value)
          }
          if (oldScript.src) {
            newScript.src = oldScript.src
          } else {
            newScript.textContent = oldScript.textContent
          }
          oldScript.parentNode?.replaceChild(newScript, oldScript)
        })
        // 触发 DOMContentLoaded 事件（页面已加载完成，但脚本刚注入）
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
          document.dispatchEvent(new Event('DOMContentLoaded'))
        }
      }
    },
    setWindowSize: (width, height) => {
      const targetWin = activeWindowId ? wm.getWindow(activeWindowId) : win
      if (targetWin) {
        targetWin.width = width
        targetWin.height = height
        targetWin.element.style.width = width + 'px'
        targetWin.element.style.height = height + 'px'
      }
    },
    getWindowSize: () => {
      const targetWin = activeWindowId ? wm.getWindow(activeWindowId) : win
      if (targetWin) {
        return { width: targetWin.width, height: targetWin.height }
      }
      return { width: 0, height: 0 }
    },
    centerWindow: () => {
      const targetWin = activeWindowId ? wm.getWindow(activeWindowId) : win
      if (targetWin) {
        targetWin.x = (window.innerWidth - targetWin.width) / 2
        targetWin.y = (window.innerHeight - targetWin.height) / 2
        targetWin.element.style.left = targetWin.x + 'px'
        targetWin.element.style.top = targetWin.y + 'px'
      }
    },
    minimizeWindow: () => {
      const targetWin = activeWindowId ? wm.getWindow(activeWindowId) : win
      targetWin?.minimize()
    },
    maximizeWindow: () => {
      const targetWin = activeWindowId ? wm.getWindow(activeWindowId) : win
      targetWin?.toggleMaximize()
    },
    isWindowMaximized: () => {
      const targetWin = activeWindowId ? wm.getWindow(activeWindowId) : win
      return targetWin?.maximized || false
    },
    onWindowClose: (callback) => {
      const targetWin = activeWindowId ? wm.getWindow(activeWindowId) : win
      targetWin?.onClose(callback)
    },
    getElementById: (id) => {
      const container = activeWindowContent || output
      return container.querySelector(`#${id}`) as HTMLElement | null
    },
    createElement: (tag, options) => {
      const el = document.createElement(tag)
      if (options?.id) el.id = options.id
      if (options?.className) el.className = options.className
      if (options?.text) el.textContent = options.text
      if (options?.html) el.innerHTML = options.html
      if (options?.style) {
        for (const [k, v] of Object.entries(options.style)) {
          (el.style as any)[k] = v
        }
      }
      return el
    },
    appendElement: (element) => {
      const container = activeWindowContent || output
      container.appendChild(element)
    },
    onEvent: (element, event, callback) => {
      element.addEventListener(event, callback as EventListener)
    },
    readFile: async (path) => {
      try {
        const fileItem = await fs.getByPath(path)
        if (!fileItem || fileItem.type !== 'file') return ''
        const fileContent = await fs.readFile(fileItem.id)
        return fileContent || ''
      } catch {
        return ''
      }
    },
    writeFile: async (path, fileContent) => {
      await fs.writeFile(path, fileContent)
    },
    listFiles: async (path) => {
      try {
        const cleanPath = (path || '/').replace(/^\//, '')
        if (cleanPath === '') {
          const items = await fs.listFiles(null)
          return items.map(i => i.name)
        }
        const dirItem = await fs.getByPath(cleanPath)
        if (!dirItem) return []
        const items = await fs.listFiles(dirItem.id)
        return items.map(i => i.name)
      } catch {
        return []
      }
    },
    createDirectory: async (path) => {
      const parts = path.split('/').filter(Boolean)
      const folderName = parts.pop() || ''
      const parentPath = '/' + parts.join('/')
      const parent = await fs.getByPath(parentPath)
      if (!parent || parent.type !== 'folder') throw new Error('父目录不存在')
      await fs.createFolder(folderName, parent.id)
    },
    deleteFile: async (path) => {
      const fileItem = await fs.getByPath(path)
      if (!fileItem) throw new Error('文件不存在')
      await fs.deleteItem(fileItem.id)
    },
    fileExists: async (path) => {
      const item = await fs.getByPath(path)
      return !!item
    },
    copyFile: async (source, destination) => {
      const srcItem = await fs.getByPath(source)
      if (!srcItem || srcItem.type !== 'file') throw new Error('源文件不存在')
      const content = await fs.readFile(srcItem.id)
      await fs.writeFile(destination, content || '')
    },
    moveFile: async (source, destination) => {
      const srcItem = await fs.getByPath(source)
      if (!srcItem) throw new Error('源文件不存在')
      const content = srcItem.type === 'file' ? await fs.readFile(srcItem.id) : ''
      await fs.writeFile(destination, content || '')
      await fs.deleteItem(srcItem.id)
    },
    setTimeout: (callback, ms) => {
      const id = window.setTimeout(callback, ms)
      timers.push(id)
      return id
    },
    setInterval: (callback, ms) => {
      const id = window.setInterval(callback, ms)
      timers.push(id)
      return id
    },
    clearTimeout: (id) => {
      window.clearTimeout(id)
      const idx = timers.indexOf(id)
      if (idx >= 0) timers.splice(idx, 1)
    },
    clearInterval: (id) => {
      window.clearInterval(id)
      const idx = timers.indexOf(id)
      if (idx >= 0) timers.splice(idx, 1)
    },
    httpRequest: async (url, options) => {
      const response = await fetch(url, {
        method: options?.method || 'GET',
        headers: options?.headers || {},
        body: options?.body
      })
      const data = await response.text()
      return { status: response.status, data, ok: response.ok }
    },
    clipboardWrite: (text) => {
      navigator.clipboard?.writeText(text)
    },
    clipboardRead: () => {
      // clipboardRead 是同步的，但 Clipboard API 是异步的
      // 使用 deprecated 的 execCommand 作为 fallback
      const ta = document.createElement('textarea')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      try { document.execCommand('paste'); } catch { /* */ }
      const text = ta.value
      ta.remove()
      return text
    },
    getEnv: (name) => localStorage.getItem(`ht-os-env-${name}`) || undefined,
    setEnv: (name, value) => localStorage.setItem(`ht-os-env-${name}`, value),
    getTimestamp: () => Date.now(),
    formatDate: (format, timestamp) => {
      const d = new Date(timestamp || Date.now())
      const map: Record<string, string> = {
        'YYYY': String(d.getFullYear()),
        'MM': String(d.getMonth() + 1).padStart(2, '0'),
        'DD': String(d.getDate()).padStart(2, '0'),
        'HH': String(d.getHours()).padStart(2, '0'),
        'mm': String(d.getMinutes()).padStart(2, '0'),
        'ss': String(d.getSeconds()).padStart(2, '0'),
      }
      let result = format
      for (const [k, v] of Object.entries(map)) {
        result = result.replace(k, v)
      }
      return result
    },
    random: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
    getScreenWidth: () => window.innerWidth,
    getScreenHeight: () => window.innerHeight
  }
}

/**
 * 从文件系统打开 .e 源文件到 EPP 编译器（单文件模式）
 */
export function openESourceFile(wm: WindowManager, _fs: FileSystem, filePath: string): void {
  const windowId = wm.openApp('epp-compiler')
  if (!windowId) return
  const win = wm.getWindow(windowId)
  if (!win) return
  setTimeout(() => {
    win.content.dispatchEvent(new CustomEvent('epp:open-file', { detail: { filePath } }))
  }, 200)
}

/**
 * 从文件系统打开 .epproj 项目文件到 EPP 编译器
 */
export function openEProjectFile(wm: WindowManager, _fs: FileSystem, filePath: string): void {
  const windowId = wm.openApp('epp-compiler')
  if (!windowId) return
  const win = wm.getWindow(windowId)
  if (!win) return
  setTimeout(() => {
    win.content.dispatchEvent(new CustomEvent('epp:open-project', { detail: { path: filePath } }))
  }, 200)
}

/**
 * 从文件系统打开 .esln 解决方案文件到 EPP 编译器
 */
export function openESolutionFile(wm: WindowManager, _fs: FileSystem, filePath: string): void {
  const windowId = wm.openApp('epp-compiler')
  if (!windowId) return
  const win = wm.getWindow(windowId)
  if (!win) return
  setTimeout(() => {
    win.content.dispatchEvent(new CustomEvent('epp:open-solution', { detail: { path: filePath } }))
  }, 200)
}

/**
 * 执行 EPP 源代码
 */
async function executeCode(code: string, api: EPPRuntimeAPI): Promise<void> {
  const wrapped = `
    "use strict";
    const { print, println, readLine, showMessage, showConfirm, showPrompt, showOpenDialog, showSaveDialog, showFolderDialog, createWindow, openWindow, closeWindow, setWindowTitle, setWindowContent, setWindowSize, getWindowSize, centerWindow, minimizeWindow, maximizeWindow, isWindowMaximized, onWindowClose, getElementById, createElement, appendElement, onEvent, readFile, writeFile, listFiles, createDirectory, deleteFile, fileExists, copyFile, moveFile, setTimeout, setInterval, clearTimeout, clearInterval, httpRequest, clipboardWrite, clipboardRead, getEnv, setEnv, getTimestamp, formatDate, random, getScreenWidth, getScreenHeight } = this;
    return (async function() {
      ${code}
    })();
  `
  await new Function(wrapped).call(api)
}

/**
 * 注册 EPP 命令行工具到命令注册中心
 * 在终端中可使用：eppc <项目路径> [--config Debug|Release]
 *                epprun <.epp文件路径>
 *
 * [SYNC] 命令行工具 — 与 epp_compiler.py 命令行工具保持同步
 */
export function registerEPPCommands(fs: FileSystem, eventBus: EventBus): void {
  const registry = getCommandRegistry()

  // eppc：编译项目
  registry.register({
    name: 'eppc',
    description: '编译 EPP 项目（生成 .epp 到 bin/<配置>/）',
    usage: 'eppc <项目路径|.epproj> [--config Debug|Release]',
    app: 'EPP 编译器',
    handler: async (args, ctx) => {
      if (args.length === 0) {
        ctx.printError('用法: eppc <项目路径|.epproj> [--config Debug|Release]')
        return
      }
      let projectPath = args[0]
      const configIdx = args.indexOf('--config')
      const config: CompileConfig = (configIdx !== -1 && args[configIdx + 1] === 'Release') ? 'Release' : 'Debug'

      // 相对路径转绝对路径
      if (!projectPath.startsWith('/')) {
        projectPath = (ctx.cwd === '/' ? '' : ctx.cwd) + '/' + projectPath
      }
      projectPath = projectPath.replace(/^\//, '')

      try {
        ctx.print(`正在编译: ${projectPath} (${config})...`)
        const { project, projectDir } = await loadProject(fs, projectPath)
        const result = await compileProject(fs, projectDir, project, config)
        ctx.print(`编译成功 ✓`)
        ctx.print(`  项目: ${result.projectName}`)
        ctx.print(`  配置: ${result.config}`)
        ctx.print(`  输出: /${result.outputPath}`)
        ctx.print(`  字节码: ${result.bytecodeSize} 字符`)
        ctx.print(`  耗时: ${result.duration} ms`)
      } catch (e) {
        ctx.printError(`编译失败: ${(e as Error).message}`)
      }
    }
  })

  // epprun：运行 .epp 文件
  registry.register({
    name: 'epprun',
    description: '运行编译后的 .epp 可执行文件',
    usage: 'epprun <.epp 文件路径>',
    app: 'EPP 编译器',
    handler: async (args, ctx) => {
      if (args.length === 0) {
        ctx.printError('用法: epprun <.epp 文件路径>')
        return
      }
      let filePath = args[0]
      if (!filePath.startsWith('/')) {
        filePath = (ctx.cwd === '/' ? '' : ctx.cwd) + '/' + filePath
      }
      filePath = filePath.replace(/^\//, '')
      ctx.print(`启动: /${filePath}`)
      eventBus.emit('app:launch', 'epp-runner-file', filePath)
    }
  })

  // eppnew：新建项目
  registry.register({
    name: 'eppnew',
    description: '新建 EPP 项目',
    usage: 'eppnew <项目名> [父目录路径]',
    app: 'EPP 编译器',
    handler: async (args, ctx) => {
      if (args.length === 0) {
        ctx.printError('用法: eppnew <项目名> [父目录路径]')
        return
      }
      const projName = args[0].replace(/[\\/:*?"<>|]/g, '_')
      let parentPath = args[1] ? args[1].replace(/^\//, '') : ctx.cwd.replace(/^\//, '')
      const projPath = parentPath ? `${parentPath}/${projName}` : projName

      try {
        const existing = await fs.getByPath(projPath)
        if (existing) {
          ctx.printError(`目录已存在: ${projPath}`)
          return
        }
        const parentItem = await fs.getByPath(parentPath)
        if (!parentItem || parentItem.type !== 'folder') {
          ctx.printError(`父目录不存在: ${parentPath}`)
          return
        }
        await fs.createFolder(projName, parentItem.id)
        await fs.writeFile(`${projPath}/main.e`, `// ${projName}\nprintln("Hello, EPP!")\n`)
        const project: EPPProject = {
          name: projName,
          version: '1.0.0',
          main: 'main.e',
          files: ['main.e']
        }
        await fs.writeFile(`${projPath}/project.epproj`, JSON.stringify(project, null, 2))
        ctx.print(`已创建项目: /${projPath}`)
        addRecentProject(projName, projPath)
      } catch (e) {
        ctx.printError(`创建项目失败: ${(e as Error).message}`)
      }
    }
  })

  // eppslngen：生成解决方案文件
  registry.register({
    name: 'eppslngen',
    description: '生成 EPP 解决方案文件 (.esln)',
    usage: 'eppslngen <解决方案名> <项目1路径> [项目2路径 ...]',
    app: 'EPP 编译器',
    handler: async (args, ctx) => {
      if (args.length < 2) {
        ctx.printError('用法: eppslngen <解决方案名> <项目1路径> [项目2路径 ...]')
        return
      }
      const slnName = args[0]
      const projectPaths = args.slice(1)
      const solution: EPPSolution = {
        name: slnName,
        projects: []
      }
      // 解析每个项目，得到相对解决方案目录的路径
      // 解决方案文件放在当前工作目录
      const slnDir = ctx.cwd.replace(/^\//, '')
      for (const p of projectPaths) {
        let absPath = p
        if (!absPath.startsWith('/')) {
          absPath = (ctx.cwd === '/' ? '' : ctx.cwd) + '/' + absPath
        }
        absPath = absPath.replace(/^\//, '')
        try {
          const { project } = await loadProject(fs, absPath)
          // 计算相对路径
          let relPath = absPath
          if (slnDir && absPath.startsWith(slnDir + '/')) {
            relPath = absPath.slice(slnDir.length + 1)
          }
          solution.projects.push({ name: project.name, path: relPath })
        } catch (e) {
          ctx.printError(`无法加载项目 ${p}: ${(e as Error).message}`)
          return
        }
      }
      const slnFilePath = slnDir ? `${slnDir}/${slnName}.esln` : `${slnName}.esln`
      try {
        await fs.writeFile(slnFilePath, JSON.stringify(solution, null, 2))
        ctx.print(`已生成解决方案: /${slnFilePath}`)
        ctx.print(`  包含 ${solution.projects.length} 个项目:`)
        solution.projects.forEach(p => ctx.print(`    - ${p.name} (${p.path})`))
      } catch (e) {
        ctx.printError(`生成解决方案失败: ${(e as Error).message}`)
      }
    }
  })
}
