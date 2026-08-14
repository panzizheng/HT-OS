import type { FileSystemItem } from '../kernel/types'

/**
 * 基于 IndexedDB 的虚拟文件系统
 * 数据真正持久化到浏览器本地，刷新页面后仍然存在
 */
export class FileSystem {
  private static DB_NAME = 'ht-os-fs'
  private static STORE_NAME = 'files'
  private static DB_VERSION = 3
  private db: IDBDatabase | null = null

  /** 初始化 IndexedDB 数据库并创建默认目录 */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(FileSystem.DB_NAME, FileSystem.DB_VERSION)

      request.onerror = () => reject(request.error)

      request.onsuccess = () => {
        this.db = request.result
        this.initDefaults().then(resolve).catch(reject)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        const oldVersion = (event as IDBVersionChangeEvent).oldVersion

        // 升级到 v3：删除旧的 object store，强制重建
        if (oldVersion < 3 && db.objectStoreNames.contains(FileSystem.STORE_NAME)) {
          db.deleteObjectStore(FileSystem.STORE_NAME)
        }

        if (!db.objectStoreNames.contains(FileSystem.STORE_NAME)) {
          const store = db.createObjectStore(FileSystem.STORE_NAME, { keyPath: 'id' })
          store.createIndex('parentId', 'parentId', { unique: false })
          store.createIndex('name', 'name', { unique: false })
        }
      }
    })
  }

  /** 初始化默认文件夹和欢迎文件（仅在首次启动时创建） */
  private async initDefaults(): Promise<void> {
    const root = await this.listFiles(null)
    if (root.length > 0) {
      // 已有数据，迁移到新结构或确保新结构存在
      await this.ensureWindowsStructure()
      await this.ensureGuideExists()
      return
    }

    // 创建 Windows 风格的根目录结构
    // /Windows, /Program Files, /Program Files (x86), /Users, /PerfLogs
    const windowsRoot = await this.createFolder('Windows', null)
    const programFiles = await this.createFolder('Program Files', null)
    const programFilesX86 = await this.createFolder('Program Files (x86)', null)
    const usersRoot = await this.createFolder('Users', null)
    const perfLogs = await this.createFolder('PerfLogs', null)

    // 在 Windows 目录下放系统文件
    await this.createFile('about.txt',
      'HT OS v1.0.0\n\n' +
      '一个使用 TypeScript + Vite 开发的网页操作系统。\n\n' +
      '技术栈：\n' +
      '- TypeScript 5\n' +
      '- Vite 5\n' +
      '- IndexedDB（文件系统持久化）\n' +
      '- localStorage（设置持久化）\n' +
      '- 原生 DOM API（窗口管理）\n\n' +
      'License: MIT',
      windowsRoot.id
    )

    await this.createFile('system-info.txt',
      '系统信息\n\n' +
      '产品名: HT OS\n' +
      '版本: 1.0.0\n' +
      '构建: 稳定版\n' +
      '内核: HT Kernel 1.0\n' +
      '窗口系统: HT Window Manager\n' +
      '文件系统: HT Virtual File System (IndexedDB)',
      windowsRoot.id
    )

    // 在 Users 下创建默认用户 "Admin"
    const userFolder = await this.createFolder('Admin', usersRoot.id)

    // 在用户文件夹内创建用户子目录
    const desktop = await this.createFolder('Desktop', userFolder.id)
    const documents = await this.createFolder('Documents', userFolder.id)
    const downloads = await this.createFolder('Downloads', userFolder.id)
    const pictures = await this.createFolder('Pictures', userFolder.id)
    const music = await this.createFolder('Music', userFolder.id)
    const videos = await this.createFolder('Videos', userFolder.id)

    // 在桌面上创建欢迎文件
    await this.createFile(
      'welcome.txt',
      '欢迎使用 HT OS!\n\n' +
        '这是一个基于 TypeScript 的网页操作系统，所有数据都通过 IndexedDB 真正持久化存储。\n\n' +
        '功能包括：\n' +
        '- 完整的窗口管理系统（拖动、调整大小、最大化、最小化）\n' +
        '- 基于 IndexedDB 的虚拟文件系统（持久化）\n' +
        '- 桌面环境（图标、右键菜单、壁纸）\n' +
        '- 任务栏与开始菜单\n' +
        '- 启动画面与登录界面\n' +
        '- 多种应用程序（文件管理器、终端、记事本、计算器等）\n' +
        '- EPP 专属应用程序系统（.e 源代码 / .epp 可执行文件）\n' +
        '- 画质增强模拟 (DLSS / FSR3 / MetalFX)\n\n' +
        '试试双击桌面图标，或者点击左下角开始按钮开始体验吧！',
      desktop.id
    )

    // 在 Documents 里放 EPP 编程指南
    await this.createFile('EPP_Programming_Guide.md', this.getEPPGuide(), documents.id)

    // 在 Program Files 下创建各系统程序子文件夹
    await this.initProgramFiles(programFiles.id)

    // 在 PerfLogs 创建示例日志
    await this.createFile('system.log',
      `[启动] HT OS 初始化完成\n[启动] 窗口管理器就绪\n[启动] 文件系统已挂载\n[启动] 所有服务已启动\n`,
      perfLogs.id
    )
  }

  /** 初始化 Program Files 目录下的应用程序文件夹 */
  private async initProgramFiles(programFilesId: string): Promise<void> {
    const apps = [
      { name: 'File Manager', desc: '文件管理器 - 浏览和管理系统文件' },
      { name: 'Terminal', desc: '终端 - 命令行工具' },
      { name: 'Notepad', desc: '记事本 - 文本编辑器' },
      { name: 'Office', desc: 'HT 办公 - 文档查看器' },
      { name: 'Calculator', desc: '计算器' },
      { name: 'Browser', desc: '浏览器' },
      { name: 'Painter', desc: '画图' },
      { name: 'Music Player', desc: '音乐播放器' },
      { name: 'Video Player', desc: '视频播放器' },
      { name: 'Weather', desc: '天气' },
      { name: 'AI Assistant', desc: 'AI 助手' },
      { name: 'System Monitor', desc: '系统监控器' },
      { name: 'Settings', desc: '设置' },
      { name: 'Registry Editor', desc: '注册表编辑器' },
      { name: 'Services', desc: '服务管理器' },
      { name: 'EPP Compiler', desc: 'EPP 编译器 - 编写、编译和运行 EPP 程序' },
      { name: 'EPP Runner', desc: 'EPP 运行器 - 运行编译后的 .epp 可执行文件' }
    ]

    for (const app of apps) {
      const folder = await this.createFolder(app.name, programFilesId)
      await this.createFile('info.txt', `${app.name}\n${app.desc}\n`, folder.id)
    }
  }

  /** 兼容旧版本：确保 Windows 风格的目录结构存在 */
  private async ensureWindowsStructure(): Promise<void> {
    // 确保根目录下有 Windows, Program Files, Users, PerfLogs
    const rootItems = await this.listFiles(null)
    const existingNames = new Set(rootItems.map(i => i.name))

    if (!existingNames.has('Windows')) {
      const w = await this.createFolder('Windows', null)
      if (!(await this.getByPath('Windows/about.txt'))) {
        await this.createFile('about.txt',
          'HT OS v1.0.0\n\n一个使用 TypeScript + Vite 开发的网页操作系统。',
          w.id
        )
      }
    }

    if (!existingNames.has('Program Files')) {
      const pf = await this.createFolder('Program Files', null)
      const children = await this.listFiles(pf.id)
      if (children.length === 0) {
        await this.initProgramFiles(pf.id)
      }
    }

    if (!existingNames.has('Program Files (x86)')) {
      await this.createFolder('Program Files (x86)', null)
    }

    if (!existingNames.has('PerfLogs')) {
      await this.createFolder('PerfLogs', null)
    }

    // 确保 Users 结构存在
    if (!existingNames.has('Users')) {
      const users = await this.createFolder('Users', null)
      const admin = await this.createFolder('Admin', users.id)
      await this.createFolder('Desktop', admin.id)
      await this.createFolder('Documents', admin.id)
      await this.createFolder('Downloads', admin.id)
      await this.createFolder('Pictures', admin.id)
      await this.createFolder('Music', admin.id)
      await this.createFolder('Videos', admin.id)
    } else {
      // Users 存在，检查默认用户结构
      const usersFolder = await this.getByPath('Users')
      if (usersFolder) {
        const userItems = await this.listFiles(usersFolder.id)
        if (userItems.length > 0) {
          // 以第一个用户为例确保结构完整
          const firstUser = userItems[0]
          const subFolders = ['Desktop', 'Documents', 'Downloads', 'Pictures', 'Music', 'Videos']
          for (const name of subFolders) {
            const exists = userItems.some(i => i.name === name)
            if (!exists) {
              await this.createFolder(name, firstUser.id)
            }
          }
        } else {
          const admin = await this.createFolder('Admin', usersFolder.id)
          for (const name of ['Desktop', 'Documents', 'Downloads', 'Pictures', 'Music', 'Videos']) {
            await this.createFolder(name, admin.id)
          }
        }
      }
    }

  }

  /** 确保开发者文档存在于所有用户目录下 */
  private async ensureGuideExists(): Promise<void> {
    const usersFolder = await this.getByPath('Users')
    if (!usersFolder) return

    const userFolders = await this.listFiles(usersFolder.id)
    for (const userFolder of userFolders) {
      const docsPath = `Users/${userFolder.name}/Documents`
      const documents = await this.getByPath(docsPath)
      if (!documents) continue

      const guidePath = `${docsPath}/EPP_Programming_Guide.md`
      const existing = await this.getByPath(guidePath)
      if (!existing) {
        await this.createFile('EPP_Programming_Guide.md', this.getEPPGuide(), documents.id)
      }
    }
  }

  /** EPP 编程指南内容 */
  private getEPPGuide(): string {
    return `# EPP 程序编写规范和指南

## 概述

EPP (Executable Program Package) 是 HT OS 的专属应用程序格式。
源代码文件后缀为 \`.e\`，编译后生成 \`.epp\` 可执行文件。

## 文件类型

| 后缀 | 类型 | 说明 |
|------|------|------|
| .e   | 源代码 | 纯文本，使用 EPP 语法编写 |
| .epp | 可执行文件 | 编译后的二进制格式，可直接运行 |

## 程序类型

EPP 支持两种程序类型：

### 1. 窗口程序 (GUI)
\`\`\`
// 程序类型: gui
\`\`\`
拥有可视化窗口界面，可设置窗口标题和内容。

### 2. 控制台程序 (Console)
\`\`\`
// 程序类型: console
\`\`\`
在编译器输出面板中运行，支持文本输入输出。

## 语法规则

EPP 基于 JavaScript 语法，支持以下特性：

### 变量声明
\`\`\`javascript
var x = 10          // 函数级作用域
let y = 20          // 块级作用域
const PI = 3.14     // 常量
\`\`\`

### 数据类型
- 数字 (Number): \`1\`, \`3.14\`, \`-5\`
- 字符串 (String): \`'hello'\`, \`\`"world"\`\`
- 布尔值 (Boolean): \`true\`, \`false\`
- 数组 (Array): \`[1, 2, 3]\`
- 对象 (Object): \`{ name: 'test' }\`
- 空值 (Null): \`null\`
- 未定义 (Undefined): \`undefined\`

### 控制流

#### 条件语句
\`\`\`javascript
if (condition) {
  // ...
} else if (otherCondition) {
  // ...
} else {
  // ...
}
\`\`\`

#### switch 语句
\`\`\`javascript
switch (value) {
  case 1:
    // ...
    break
  default:
    // ...
}
\`\`\`

### 循环语句

#### for 循环
\`\`\`javascript
for (let i = 0; i < 10; i++) {
  println(i)
}
\`\`\`

#### while 循环
\`\`\`javascript
while (condition) {
  // ...
}
\`\`\`

#### for...of 循环
\`\`\`javascript
for (const item of array) {
  println(item)
}
\`\`\`

### 函数定义
\`\`\`javascript
function add(a, b) {
  return a + b
}

// 异步函数
async function main() {
  const name = await readLine('名字: ')
  println(name)
}
\`\`\`

### 异常处理
\`\`\`javascript
try {
  // 可能出错的代码
} catch (e) {
  println('错误: ' + e.message)
} finally {
  // 总是执行
}
\`\`\`

## 运行时 API

EPP 程序可直接调用以下系统 API（无需导入）：

---

### 控制台 IO

#### print(text)
输出文本（不换行）。
\`\`\`javascript
print('Hello')
print(' World')
\`\`\`

#### println(text)
输出文本并换行。
\`\`\`javascript
println('Hello, World!')
\`\`\`

#### readLine(prompt?) -> Promise<string>
读取用户输入（异步）。
\`\`\`javascript
const name = await readLine('请输入名字: ')
println('你好, ' + name)
\`\`\`

---

### 对话框

#### showMessage(title, message)
显示消息对话框。
\`\`\`javascript
showMessage('提示', '操作完成！')
\`\`\`

#### showConfirm(title, message) -> Promise<boolean>
显示确认对话框，返回 true/false。
\`\`\`javascript
if (await showConfirm('确认', '确定删除吗？')) {
  println('已删除')
}
\`\`\`

#### showPrompt(title, message, defaultValue?) -> Promise<string|null>
显示输入对话框，返回用户输入或 null。
\`\`\`javascript
const value = await showPrompt('输入', '请输入数字', '0')
\`\`\`

#### showOpenDialog(options?) -> Promise<string|null>
显示文件打开对话框，返回选中的文件完整路径或 null。
\`\`\`javascript
const path = await showOpenDialog({
  title: '打开文件',
  filters: ['txt', 'md'],
  defaultPath: '/Users/Admin/Documents'
})
if (path) {
  const content = await readFile(path)
  println(content)
}
\`\`\`

#### showSaveDialog(options?) -> Promise<string|null>
显示文件保存对话框，返回保存路径或 null。
\`\`\`javascript
const path = await showSaveDialog({
  title: '保存文件',
  filters: ['txt'],
  defaultPath: '/Users/Admin/Documents',
  defaultName: '未命名'
})
if (path) {
  await writeFile(path, 'Hello World')
}
\`\`\`

#### showFolderDialog(options?) -> Promise<string|null>
显示文件夹选择对话框，返回选中的文件夹路径或 null。
\`\`\`javascript
const folder = await showFolderDialog({
  title: '选择保存位置',
  defaultPath: '/Users/Admin'
})
if (folder) {
  println('选中: ' + folder)
}
\`\`\`

---

### 窗口控制

#### createWindow(options) -> string
创建并打开新窗口，返回窗口 ID。
\`\`\`javascript
const winId = createWindow({
  title: '我的窗口',
  width: 600,
  height: 400
})
\`\`\`

#### openWindow(options) -> string
打开窗口并设置初始内容，返回窗口 ID。
\`\`\`javascript
const winId = openWindow({
  title: '欢迎',
  width: 400,
  height: 300,
  content: '<h1>Hello</h1>'
})
\`\`\`

#### closeWindow(windowId?)
关闭窗口。不传参数则关闭当前窗口。
\`\`\`javascript
closeWindow()      // 关闭当前窗口
closeWindow(winId) // 关闭指定窗口
\`\`\`

#### setWindowTitle(title)
设置窗口标题。
\`\`\`javascript
setWindowTitle('我的程序')
\`\`\`

#### setWindowContent(html)
设置窗口内容（支持 HTML）。
\`\`\`javascript
setWindowContent('<div style="padding:20px;"><h1>Hello</h1></div>')
\`\`\`

#### setWindowSize(width, height)
设置窗口大小。
\`\`\`javascript
setWindowSize(800, 600)
\`\`\`

#### getWindowSize() -> { width: number, height: number }
获取窗口大小。
\`\`\`javascript
const { width, height } = getWindowSize()
println(\`窗口: \${width}x\${height}\`)
\`\`\`

#### centerWindow()
窗口居中显示。
\`\`\`javascript
centerWindow()
\`\`\`

#### minimizeWindow()
最小化窗口。
\`\`\`javascript
minimizeWindow()
\`\`\`

#### maximizeWindow()
最大化/还原窗口。
\`\`\`javascript
maximizeWindow()
\`\`\`

#### isWindowMaximized() -> boolean
判断窗口是否最大化。
\`\`\`javascript
if (isWindowMaximized()) {
  println('窗口已最大化')
}
\`\`\`

#### onWindowClose(callback)
注册窗口关闭事件回调。
\`\`\`javascript
onWindowClose(() => {
  println('窗口即将关闭')
})
\`\`\`

---

### DOM 操作

#### getElementById(id) -> HTMLElement | null
在窗口内容中查找元素。
\`\`\`javascript
const el = getElementById('myDiv')
if (el) {
  el.textContent = '新内容'
}
\`\`\`

#### createElement(tag, options?) -> HTMLElement
创建 DOM 元素。
\`\`\`javascript
const btn = createElement('button', {
  id: 'btn1',
  className: 'my-btn',
  text: '点击我',
  style: { color: 'red', fontSize: '16px' }
})
\`\`\`

#### appendElement(element)
向窗口追加元素。
\`\`\`javascript
const btn = createElement('button', { text: '点击' })
appendElement(btn)
\`\`\`

#### onEvent(element, event, callback)
绑定事件。
\`\`\`javascript
const btn = createElement('button', { text: '点击' })
appendElement(btn)
onEvent(btn, 'click', () => {
  showMessage('提示', '按钮被点击')
})
\`\`\`

---

### 文件系统

#### readFile(path) -> Promise<string>
读取文件内容。
\`\`\`javascript
const content = await readFile('/Users/Admin/Documents/test.txt')
\`\`\`

#### writeFile(path, content) -> Promise<void>
写入文件。
\`\`\`javascript
await writeFile('/Users/Admin/Documents/output.txt', 'Hello')
\`\`\`

#### listFiles(path?) -> Promise<string[]>
列出目录下的文件名。
\`\`\`javascript
const files = await listFiles('/Users/Admin/Documents')
for (const f of files) {
  println(f)
}
\`\`\`

#### createDirectory(path) -> Promise<void>
创建目录。
\`\`\`javascript
await createDirectory('/Users/Admin/Documents/myfolder')
\`\`\`

#### deleteFile(path) -> Promise<void>
删除文件。
\`\`\`javascript
await deleteFile('/Users/Admin/Documents/old.txt')
\`\`\`

#### fileExists(path) -> Promise<boolean>
判断文件是否存在。
\`\`\`javascript
if (await fileExists('/Users/Admin/test.txt')) {
  println('文件存在')
}
\`\`\`

#### copyFile(source, destination) -> Promise<void>
复制文件。
\`\`\`javascript
await copyFile('/Users/Admin/a.txt', '/Users/Admin/b.txt')
\`\`\`

#### moveFile(source, destination) -> Promise<void>
移动文件。
\`\`\`javascript
await moveFile('/Users/Admin/a.txt', '/Users/Admin/Docs/a.txt')
\`\`\`

---

### 定时器

#### setTimeout(callback, ms) -> number
设置定时器，返回定时器 ID。
\`\`\`javascript
const id = setTimeout(() => {
  println('2秒后执行')
}, 2000)
\`\`\`

#### setInterval(callback, ms) -> number
设置循环定时器。
\`\`\`javascript
const id = setInterval(() => {
  println('每秒执行一次')
}, 1000)
\`\`\`

#### clearTimeout(id)
清除定时器。
\`\`\`javascript
clearTimeout(id)
\`\`\`

#### clearInterval(id)
清除循环定时器。
\`\`\`javascript
clearInterval(id)
\`\`\`

---

### 网络

#### httpRequest(url, options?) -> Promise<{ status, data, ok }>
发送 HTTP 请求。
\`\`\`javascript
const res = await httpRequest('https://api.example.com/data', {
  method: 'GET',
  headers: { 'Content-Type': 'application/json' }
})
if (res.ok) {
  println('响应: ' + res.data)
}
\`\`\`

---

### 剪贴板

#### clipboardWrite(text)
写入剪贴板。
\`\`\`javascript
clipboardWrite('复制的内容')
\`\`\`

#### clipboardRead() -> string
读取剪贴板。
\`\`\`javascript
const text = clipboardRead()
println('剪贴板: ' + text)
\`\`\`

---

### 系统工具

#### getEnv(name) -> string | undefined
获取环境变量。
\`\`\`javascript
const path = getEnv('PATH')
\`\`\`

#### setEnv(name, value)
设置环境变量。
\`\`\`javascript
setEnv('MY_VAR', 'hello')
\`\`\`

#### getTimestamp() -> number
获取当前时间戳（毫秒）。
\`\`\`javascript
const ts = getTimestamp()
println('时间戳: ' + ts)
\`\`\`

#### formatDate(format, timestamp?) -> string
格式化日期。支持: YYYY, MM, DD, HH, mm, ss。
\`\`\`javascript
const date = formatDate('YYYY-MM-DD HH:mm:ss')
println('当前时间: ' + date)
\`\`\`

#### random(min, max) -> number
生成随机整数（包含 min 和 max）。
\`\`\`javascript
const num = random(1, 100)
println('随机数: ' + num)
\`\`\`

#### getScreenWidth() -> number
获取屏幕宽度。
\`\`\`javascript
println('屏幕宽度: ' + getScreenWidth())
\`\`\`

#### getScreenHeight() -> number
获取屏幕高度。
\`\`\`javascript
println('屏幕高度: ' + getScreenHeight())
\`\`\`

---

## 完整示例

### 控制台程序示例
\`\`\`javascript
async function main() {
  println('===== 计算器 =====')
  const a = parseFloat(await readLine('第一个数: '))
  const op = await readLine('运算符 (+ - * /): ')
  const b = parseFloat(await readLine('第二个数: '))

  let result
  switch (op) {
    case '+': result = a + b; break
    case '-': result = a - b; break
    case '*': result = a * b; break
    case '/': result = b !== 0 ? a / b : '除零错误'; break
    default: result = '未知运算符'
  }

  println('结果: ' + result)
}

main()
\`\`\`

### 窗口程序示例
\`\`\`javascript
function main() {
  setWindowTitle('我的应用')
  centerWindow()
  setWindowContent(\`
    <div style="padding: 20px; font-family: sans-serif;">
      <h2>欢迎使用</h2>
      <p>这是一个 EPP 窗口程序。</p>
    </div>
  \`)
}

main()
\`\`\`

### 文件编辑器示例
\`\`\`javascript
async function main() {
  createWindow({ title: '文件编辑器', width: 600, height: 400 })

  const btnOpen = createElement('button', { text: '打开' })
  const btnSave = createElement('button', { text: '保存' })
  const textarea = createElement('textarea', {
    style: { width: '100%', height: '300px', marginTop: '10px' }
  })

  appendElement(btnOpen)
  appendElement(btnSave)
  appendElement(textarea)

  onEvent(btnOpen, 'click', async () => {
    const path = await showOpenDialog({ filters: ['txt', 'md'] })
    if (path) {
      textarea.value = await readFile(path)
      setWindowTitle('编辑器 - ' + path.split('/').pop())
    }
  })

  onEvent(btnSave, 'click', async () => {
    const path = await showSaveDialog({ filters: ['txt'], defaultName: '未命名.txt' })
    if (path) {
      await writeFile(path, textarea.value)
      showMessage('成功', '文件已保存')
    }
  })
}

main()
\`\`\`

---

## 编译和运行

1. 在 EPP 编译器中编写 \`.e\` 源代码
2. 点击"编译"按钮，选择保存位置生成 \`.epp\` 文件
3. 点击"运行"按钮可直接在编译器中运行
4. 双击 \`.epp\` 文件可用 EPP 运行器直接运行

---

## 安全要求

### 用户账户控制（UAC）

运行 EPP 程序时，系统会弹出 UAC 用户账户控制确认对话框，要求用户确认是否允许运行该程序。这是为了保护系统安全，防止未经授权的程序执行。

- 运行 EPP 程序时，UAC 对话框会显示程序路径
- 用户点击"是"才允许运行，点击"否"则取消运行
- 该机制由系统自动处理，开发者无需额外配置

---

## 注意事项

- 所有异步 API（返回 Promise）需要使用 \`await\` 调用
- 入口函数需要在代码末尾手动调用，如 \`main()\`
- 控制台程序在编译器输出面板运行
- 窗口程序在新窗口中运行
- 文件路径使用 \`/Users/Admin/Documents/\` 等完整路径
`
  }

  /** 获取 object store（默认只读） */
  private getStore(mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
    if (!this.db) throw new Error('FileSystem 未初始化，请先调用 init()')
    const transaction = this.db.transaction(FileSystem.STORE_NAME, mode)
    return transaction.objectStore(FileSystem.STORE_NAME)
  }

  /** 生成唯一 ID */
  private genId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  }

  /** 根据文件名猜测 MIME 类型 */
  private guessMimeType(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase() || ''
    const map: Record<string, string> = {
      txt: 'text/plain',
      md: 'text/markdown',
      json: 'application/json',
      html: 'text/html',
      css: 'text/css',
      js: 'text/javascript',
      ts: 'text/typescript',
      xml: 'application/xml',
      csv: 'text/csv',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      mp4: 'video/mp4',
      webm: 'video/webm'
    }
    return map[ext] || 'application/octet-stream'
  }

  /** 列出指定目录下的子项，文件夹排在前面，同类按名称排序 */
  async listFiles(parentId: string | null): Promise<FileSystemItem[]> {
    const store = this.getStore()
    const index = store.index('parentId')

    return new Promise((resolve, reject) => {
      const request = index.getAll(parentId)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const items = request.result.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
          return a.name.localeCompare(b.name, 'zh-CN')
        })
        resolve(items)
      }
    })
  }

  /** 获取单个项目 */
  async getItem(id: string): Promise<FileSystemItem | null> {
    const store = this.getStore()
    return new Promise((resolve, reject) => {
      const request = store.get(id)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result || null)
    })
  }

  /** 通过路径获取项目，例如 'Documents/report.txt' 或 'Desktop' */
  async getByPath(path: string): Promise<FileSystemItem | null> {
    const parts = path.split('/').map(p => p.trim()).filter(Boolean)
    let parentId: string | null = null

    for (const part of parts) {
      const children = await this.listFiles(parentId)
      const found = children.find(c => c.name === part)
      if (!found) return null
      parentId = found.id
    }

    return parentId ? await this.getItem(parentId) : null
  }

  /** 创建文件夹 */
  async createFolder(name: string, parentId: string | null): Promise<FileSystemItem> {
    const store = this.getStore('readwrite')
    const now = Date.now()

    const folder: FileSystemItem = {
      id: this.genId('folder'),
      name,
      type: 'folder',
      parentId,
      created: now,
      modified: now,
      size: 0
    }

    return new Promise((resolve, reject) => {
      const request = store.add(folder)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(folder)
    })
  }

  /** 写入文件（支持新建和更新），路径如 'Documents/report.txt' */
  async writeFile(path: string, content: string): Promise<FileSystemItem> {
    const parts = path.split('/')
    const fileName = parts.pop()!
    const parentPath = parts.join('/')

    let parentId: string | null = null
    if (parentPath) {
      const parent = await this.getByPath(parentPath)
      if (!parent) {
        throw new Error(`父目录不存在: ${parentPath}`)
      }
      parentId = parent.id
    }

    const existing = await this.getByPath(path)
    const store = this.getStore('readwrite')
    const now = Date.now()

    // 更新已有文件
    if (existing) {
      existing.content = content
      existing.modified = now
      existing.size = new Blob([content]).size
      existing.mimeType = this.guessMimeType(existing.name)

      return new Promise((resolve, reject) => {
        const request = store.put(existing)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve(existing)
      })
    }

    // 创建新文件
    const file: FileSystemItem = {
      id: this.genId('file'),
      name: fileName,
      type: 'file',
      parentId,
      content,
      created: now,
      modified: now,
      size: new Blob([content]).size,
      mimeType: this.guessMimeType(fileName)
    }

    return new Promise((resolve, reject) => {
      const request = store.add(file)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(file)
    })
  }

  /** 直接在指定目录下创建文件（使用 parentId，避免路径解析的事务时序问题） */
  async createFile(name: string, content: string, parentId: string | null): Promise<FileSystemItem> {
    const store = this.getStore('readwrite')
    const now = Date.now()

    const file: FileSystemItem = {
      id: this.genId('file'),
      name,
      type: 'file',
      parentId,
      content,
      created: now,
      modified: now,
      size: new Blob([content]).size,
      mimeType: this.guessMimeType(name)
    }

    return new Promise((resolve, reject) => {
      const request = store.add(file)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(file)
    })
  }

  /** 读取文件内容 */
  async readFile(id: string): Promise<string | null> {
    const item = await this.getItem(id)
    return item?.content ?? null
  }

  /** 删除文件或文件夹（递归删除子项） */
  async deleteItem(id: string): Promise<void> {
    const idsToDelete = await this.collectIdsToDelete(id)
    if (idsToDelete.length === 0) return

    const store = this.getStore('readwrite')
    return new Promise((resolve, reject) => {
      let resolved = 0
      let errored = false
      for (const deleteId of idsToDelete) {
        const request = store.delete(deleteId)
        request.onerror = () => {
          if (!errored) { errored = true; reject(request.error) }
        }
        request.onsuccess = () => {
          resolved++
          if (resolved === idsToDelete.length && !errored) resolve()
        }
      }
    })
  }

  /** 递归收集需要删除的所有 ID（先收集子项，再收集自身，保证子项先删除） */
  private async collectIdsToDelete(id: string): Promise<string[]> {
    const item = await this.getItem(id)
    if (!item) return []

    const ids: string[] = []
    if (item.type === 'folder') {
      const children = await this.listFiles(id)
      for (const child of children) {
        const childIds = await this.collectIdsToDelete(child.id)
        ids.push(...childIds)
      }
    }
    ids.push(id)
    return ids
  }

  /** 重命名 */
  async rename(id: string, newName: string): Promise<void> {
    const store = this.getStore('readwrite')
    const item = await this.getItem(id)
    if (!item) return

    item.name = newName
    item.modified = Date.now()
    if (item.type === 'file') {
      item.mimeType = this.guessMimeType(newName)
    }

    return new Promise((resolve, reject) => {
      const request = store.put(item)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  /** 移动到新目录 */
  async move(id: string, newParentId: string | null): Promise<void> {
    const store = this.getStore('readwrite')
    const item = await this.getItem(id)
    if (!item) return
    if (id === newParentId) return

    // 防止将文件夹移动到它自己的子目录中
    if (newParentId) {
      let current: string | null = newParentId
      while (current) {
        if (current === id) {
          throw new Error('不能将文件夹移动到自身的子目录中')
        }
        const parent = await this.getItem(current)
        current = parent?.parentId ?? null
      }
    }

    item.parentId = newParentId
    item.modified = Date.now()

    return new Promise((resolve, reject) => {
      const request = store.put(item)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  /** 复制文件或文件夹到新目录（递归复制） */
  async copy(id: string, newParentId: string | null): Promise<FileSystemItem | null> {
    const item = await this.getItem(id)
    if (!item) return null

    const now = Date.now()
    const store = this.getStore('readwrite')

    // 复制单个项目
    const clone: FileSystemItem = {
      ...item,
      id: this.genId(item.type === 'folder' ? 'folder' : 'file'),
      parentId: newParentId,
      name: await this.getUniqueName(item.name, newParentId),
      created: now,
      modified: now
    }

    await new Promise<void>((resolve, reject) => {
      const request = store.add(clone)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })

    // 递归复制子项
    if (item.type === 'folder') {
      const children = await this.listFiles(id)
      for (const child of children) {
        await this.copy(child.id, clone.id)
      }
    }

    return clone
  }

  /** 在目标目录下生成不重名的文件名（如 '新建文件夹' 已存在则返回 '新建文件夹 (2)'） */
  private async getUniqueName(name: string, parentId: string | null): Promise<string> {
    const children = await this.listFiles(parentId)
    if (!children.some(c => c.name === name)) return name

    const dotIndex = name.lastIndexOf('.')
    const base = dotIndex > 0 ? name.slice(0, dotIndex) : name
    const ext = dotIndex > 0 ? name.slice(dotIndex) : ''
    let counter = 2
    while (children.some(c => c.name === `${base} (${counter})${ext}`)) {
      counter++
    }
    return `${base} (${counter})${ext}`
  }

  /** 获取项目的完整路径，例如 '/Documents/report.txt' */
  async getPath(id: string): Promise<string> {
    const parts: string[] = []
    let current: FileSystemItem | null = await this.getItem(id)

    while (current) {
      parts.unshift(current.name)
      current = current.parentId ? await this.getItem(current.parentId) : null
    }

    return '/' + parts.join('/')
  }

  /** 上传本地文件到指定目录（targetPath 如 '/' 或 '/Desktop'） */
  async uploadFile(file: File, targetPath: string): Promise<FileSystemItem> {
    let parentId: string | null = null
    if (targetPath && targetPath !== '/') {
      const folder = await this.getByPath(targetPath.replace(/^\//, ''))
      parentId = folder?.id || null
    }
    const content = await file.text()
    return this.createFile(file.name, content, parentId)
  }

  /** 搜索文件名（不区分大小写），可选限定在某个目录下 */
  async search(keyword: string, parentId?: string | null): Promise<FileSystemItem[]> {
    const lower = keyword.toLowerCase()
    const results: FileSystemItem[] = []

    if (parentId !== undefined) {
      // 限定目录：递归搜索
      await this.searchInDir(lower, parentId, results)
    } else {
      // 全局搜索：遍历所有记录
      const store = this.getStore()
      await new Promise<void>((resolve, reject) => {
        const request = store.openCursor()
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const cursor = request.result
          if (cursor) {
            const item = cursor.value as FileSystemItem
            if (item.name.toLowerCase().includes(lower)) {
              results.push(item)
            }
            cursor.continue()
          } else {
            resolve()
          }
        }
      })
    }

    // 文件夹优先，再按名称排序
    return results.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name, 'zh-CN')
    })
  }

  /** 在指定目录下递归搜索 */
  private async searchInDir(keyword: string, parentId: string | null, results: FileSystemItem[]): Promise<void> {
    const children = await this.listFiles(parentId)
    for (const child of children) {
      if (child.name.toLowerCase().includes(keyword)) {
        results.push(child)
      }
      if (child.type === 'folder') {
        await this.searchInDir(keyword, child.id, results)
      }
    }
  }
}
