# EPP 程序编写规范和指南

## 概述

EPP (Executable Program Package) 是 HT OS 的专属应用程序格式。
源代码文件后缀为 `.e`，编译后生成 `.epp` 可执行文件。

## 文件类型

| 后缀 | 类型 | 说明 |
|------|------|------|
| .e   | 源代码 | 纯文本，使用 EPP 语法编写 |
| .epp | 可执行文件 | 编译后的二进制格式，可直接运行 |

## 程序类型

EPP 不区分窗口程序和控制台程序。程序类型由代码决定：
- 如果代码中调用了 `createWindow()`，则打开 GUI 窗口
- 如果没有调用 `createWindow()`，则在控制台输出

所有程序都有控制台可用于输出。

## 语法规则

EPP 基于 JavaScript 语法，支持以下特性：

### 变量声明
```javascript
var x = 10          // 函数级作用域
let y = 20          // 块级作用域
const PI = 3.14     // 常量
```

### 数据类型
- 数字 (Number): `1`, `3.14`, `-5`
- 字符串 (String): `'hello'`, `"world"`
- 布尔值 (Boolean): `true`, `false`
- 数组 (Array): `[1, 2, 3]`
- 对象 (Object): `{ name: 'test' }`
- 空值 (Null): `null`
- 未定义 (Undefined): `undefined`

### 控制流

#### 条件语句
```javascript
if (condition) {
  // ...
} else if (otherCondition) {
  // ...
} else {
  // ...
}
```

#### switch 语句
```javascript
switch (value) {
  case 1:
    // ...
    break
  default:
    // ...
}
```

### 循环语句

#### for 循环
```javascript
for (let i = 0; i < 10; i++) {
  println(i)
}
```

#### while 循环
```javascript
while (condition) {
  // ...
}
```

#### for...of 循环
```javascript
for (const item of array) {
  println(item)
}
```

### 函数定义
```javascript
function add(a, b) {
  return a + b
}

// 异步函数
async function main() {
  const name = await readLine('名字: ')
  println(name)
}
```

### 异常处理
```javascript
try {
  // 可能出错的代码
} catch (e) {
  println('错误: ' + e.message)
} finally {
  // 总是执行
}
```

---

## 运行时 API

EPP 程序可直接调用以下系统 API（无需导入）：

---

### 控制台 IO

#### print(text)
输出文本（不换行）。
```javascript
print('Hello')
print(' World')
```

#### println(text)
输出文本并换行。
```javascript
println('Hello, World!')
```

#### readLine(prompt?) -> Promise<string>
读取用户输入（异步）。
```javascript
const name = await readLine('请输入名字: ')
println('你好, ' + name)
```

---

### 对话框

#### showMessage(title, message)
显示消息对话框。
```javascript
showMessage('提示', '操作完成！')
```

#### showConfirm(title, message) -> Promise<boolean>
显示确认对话框，返回 true/false。
```javascript
if (await showConfirm('确认', '确定删除吗？')) {
  println('已删除')
}
```

#### showPrompt(title, message, defaultValue?) -> Promise<string|null>
显示输入对话框，返回用户输入或 null。
```javascript
const value = await showPrompt('输入', '请输入数字', '0')
```

#### showOpenDialog(options?) -> Promise<string|null>
显示文件打开对话框，返回选中的文件完整路径或 null。
```javascript
const path = await showOpenDialog({
  title: '打开文件',
  filters: ['txt', 'md'],
  defaultPath: '/Users/Admin/Documents'
})
if (path) {
  const content = await readFile(path)
  println(content)
}
```

#### showSaveDialog(options?) -> Promise<string|null>
显示文件保存对话框，返回保存路径或 null。
```javascript
const path = await showSaveDialog({
  title: '保存文件',
  filters: ['txt'],
  defaultPath: '/Users/Admin/Documents',
  defaultName: '未命名'
})
if (path) {
  await writeFile(path, 'Hello World')
}
```

#### showFolderDialog(options?) -> Promise<string|null>
显示文件夹选择对话框，返回选中的文件夹路径或 null。
```javascript
const folder = await showFolderDialog({
  title: '选择保存位置',
  defaultPath: '/Users/Admin'
})
if (folder) {
  println('选中: ' + folder)
}
```

---

### 窗口控制

#### createWindow(options) -> string
创建并打开新窗口，返回窗口 ID。
```javascript
const winId = createWindow({
  title: '我的窗口',
  width: 600,
  height: 400
})
```

#### openWindow(options) -> string
打开窗口并设置初始内容，返回窗口 ID。
```javascript
const winId = openWindow({
  title: '欢迎',
  width: 400,
  height: 300,
  content: '<h1>Hello</h1>'
})
```

#### closeWindow(windowId?)
关闭窗口。不传参数则关闭当前窗口。
```javascript
closeWindow()      // 关闭当前窗口
closeWindow(winId) // 关闭指定窗口
```

#### setWindowTitle(title)
设置窗口标题。
```javascript
setWindowTitle('我的程序')
```

#### setWindowContent(html)
设置窗口内容（支持 HTML）。
```javascript
setWindowContent('<div style="padding:20px;"><h1>Hello</h1></div>')
```

#### setWindowSize(width, height)
设置窗口大小。
```javascript
setWindowSize(800, 600)
```

#### getWindowSize() -> { width: number, height: number }
获取窗口大小。
```javascript
const { width, height } = getWindowSize()
println(`窗口: ${width}x${height}`)
```

#### centerWindow()
窗口居中显示。
```javascript
centerWindow()
```

#### minimizeWindow()
最小化窗口。
```javascript
minimizeWindow()
```

#### maximizeWindow()
最大化/还原窗口。
```javascript
maximizeWindow()
```

#### isWindowMaximized() -> boolean
判断窗口是否最大化。
```javascript
if (isWindowMaximized()) {
  println('窗口已最大化')
}
```

#### onWindowClose(callback)
注册窗口关闭事件回调。
```javascript
onWindowClose(() => {
  println('窗口即将关闭')
})
```

---

### DOM 操作

#### getElementById(id) -> HTMLElement | null
在窗口内容中查找元素。
```javascript
const el = getElementById('myDiv')
if (el) {
  el.textContent = '新内容'
}
```

#### createElement(tag, options?) -> HTMLElement
创建 DOM 元素。
```javascript
const btn = createElement('button', {
  id: 'btn1',
  className: 'my-btn',
  text: '点击我',
  style: { color: 'red', fontSize: '16px' }
})
```

#### appendElement(element)
向窗口追加元素。
```javascript
const btn = createElement('button', { text: '点击' })
appendElement(btn)
```

#### onEvent(element, event, callback)
绑定事件。
```javascript
const btn = createElement('button', { text: '点击' })
appendElement(btn)
onEvent(btn, 'click', () => {
  showMessage('提示', '按钮被点击')
})
```

---

### 文件系统

#### readFile(path) -> Promise<string>
读取文件内容。
```javascript
const content = await readFile('/Users/Admin/Documents/test.txt')
```

#### writeFile(path, content) -> Promise<void>
写入文件。
```javascript
await writeFile('/Users/Admin/Documents/output.txt', 'Hello')
```

#### listFiles(path?) -> Promise<string[]>
列出目录下的文件名。
```javascript
const files = await listFiles('/Users/Admin/Documents')
for (const f of files) {
  println(f)
}
```

#### createDirectory(path) -> Promise<void>
创建目录。
```javascript
await createDirectory('/Users/Admin/Documents/myfolder')
```

#### deleteFile(path) -> Promise<void>
删除文件。
```javascript
await deleteFile('/Users/Admin/Documents/old.txt')
```

#### fileExists(path) -> Promise<boolean>
判断文件是否存在。
```javascript
if (await fileExists('/Users/Admin/test.txt')) {
  println('文件存在')
}
```

#### copyFile(source, destination) -> Promise<void>
复制文件。
```javascript
await copyFile('/Users/Admin/a.txt', '/Users/Admin/b.txt')
```

#### moveFile(source, destination) -> Promise<void>
移动文件。
```javascript
await moveFile('/Users/Admin/a.txt', '/Users/Admin/Docs/a.txt')
```

---

### 定时器

#### setTimeout(callback, ms) -> number
设置定时器，返回定时器 ID。
```javascript
const id = setTimeout(() => {
  println('2秒后执行')
}, 2000)
```

#### setInterval(callback, ms) -> number
设置循环定时器。
```javascript
const id = setInterval(() => {
  println('每秒执行一次')
}, 1000)
```

#### clearTimeout(id)
清除定时器。
```javascript
clearTimeout(id)
```

#### clearInterval(id)
清除循环定时器。
```javascript
clearInterval(id)
```

---

### 网络

#### httpRequest(url, options?) -> Promise<{ status, data, ok }>
发送 HTTP 请求。
```javascript
const res = await httpRequest('https://api.example.com/data', {
  method: 'GET',
  headers: { 'Content-Type': 'application/json' }
})
if (res.ok) {
  println('响应: ' + res.data)
}
```

---

### 剪贴板

#### clipboardWrite(text)
写入剪贴板。
```javascript
clipboardWrite('复制的内容')
```

#### clipboardRead() -> string
读取剪贴板。
```javascript
const text = clipboardRead()
println('剪贴板: ' + text)
```

---

### 系统工具

#### getEnv(name) -> string | undefined
获取环境变量。
```javascript
const path = getEnv('PATH')
```

#### setEnv(name, value)
设置环境变量。
```javascript
setEnv('MY_VAR', 'hello')
```

#### getTimestamp() -> number
获取当前时间戳（毫秒）。
```javascript
const ts = getTimestamp()
println('时间戳: ' + ts)
```

#### formatDate(format, timestamp?) -> string
格式化日期。支持: YYYY, MM, DD, HH, mm, ss。
```javascript
const date = formatDate('YYYY-MM-DD HH:mm:ss')
println('当前时间: ' + date)
```

#### random(min, max) -> number
生成随机整数（包含 min 和 max）。
```javascript
const num = random(1, 100)
println('随机数: ' + num)
```

#### getScreenWidth() -> number
获取屏幕宽度。
```javascript
println('屏幕宽度: ' + getScreenWidth())
```

#### getScreenHeight() -> number
获取屏幕高度。
```javascript
println('屏幕高度: ' + getScreenHeight())
```

---

### 3D 游戏（g3d）

EPP 内置了自研的 WebGL 3D 引擎 `g3d`，可直接开发 3D 游戏，无需任何外部库。
通过 `g3d.createWindow()` 打开 3D 窗口后，创建几何体、设置变换与颜色，再用 `g3d.animate()` 实现游戏逻辑。鼠标左键拖拽可环绕观察场景，滚轮缩放（可用 `g3d.enableOrbit(false)` 关闭）。

#### createWindow(width, height, title?) -> boolean
创建 3D 窗口并开始渲染。
```javascript
g3d.createWindow(800, 600, '我的 3D 游戏')
```

#### 几何体
| 函数 | 说明 |
|------|------|
| `g3d.createCube(w?, h?, d?) -> id` | 创建立方体 |
| `g3d.createSphere(radius?, segments?) -> id` | 创建球体 |
| `g3d.createPlane(width?, depth?) -> id` | 创建平面（常作地面） |
| `g3d.remove(id)` | 删除物体 |
| `g3d.clear()` | 清空所有物体 |
| `g3d.count() -> number` | 物体数量 |

#### 变换
| 函数 | 说明 |
|------|------|
| `g3d.setPosition(id, x, y, z)` | 设置位置 |
| `g3d.setRotation(id, rx, ry, rz)` | 设置旋转（弧度） |
| `g3d.setScale(id, sx, sy, sz)` | 设置缩放 |
| `g3d.translate(id, dx, dy, dz)` | 平移增量 |
| `g3d.rotate(id, drx, dry, drz)` | 旋转增量（弧度） |

#### 外观
| 函数 | 说明 |
|------|------|
| `g3d.setColor(id, r, g, b, a?)` | 设置颜色（0-1） |
| `g3d.setWireframe(id, bool)` | 线框模式 |
| `g3d.setVisible(id, bool)` | 显示 / 隐藏 |

#### 相机与环境
| 函数 | 说明 |
|------|------|
| `g3d.setCamera(x, y, z)` | 设置相机位置（看向目标点） |
| `g3d.lookAt(x, y, z)` | 设置观察目标点 |
| `g3d.setDistance(d)` | 相机到目标点的距离 |
| `g3d.setFov(deg)` | 视野角度 |
| `g3d.setBackground(r, g, b)` | 背景色（0-1） |
| `g3d.setLightDirection(x, y, z)` | 光照方向 |
| `g3d.enableOrbit(bool)` | 是否启用鼠标环绕观察 |

#### 动画与时间
| 函数 | 说明 |
|------|------|
| `g3d.start()` / `g3d.stop()` | 开始 / 停止渲染 |
| `g3d.animate(callback)` | 每帧调用回调（实现游戏逻辑） |
| `g3d.clearAnimate()` | 清除所有动画回调 |
| `g3d.getTime() -> number` | 运行时间（秒） |
| `g3d.getDelta() -> number` | 上一帧耗时（秒） |

#### 输入事件
`g3d.onMouseDown(cb)`、`g3d.onMouseMove(cb)`、`g3d.onMouseUp(cb)`、`g3d.onWheel(cb)`
回调参数为 `{ x, y, button, dx, dy }`。
```javascript
g3d.onMouseDown(function(e) {
  println('鼠标点击: ' + e.x + ', ' + e.y)
})
```

#### 3D 游戏示例
```javascript
// 创建一个旋转的 3D 方块
g3d.createWindow(800, 600, '旋转方块')
g3d.setBackground(0.1, 0.15, 0.3)

const cube = g3d.createCube(1, 1, 1)
g3d.setColor(cube, 0.9, 0.2, 0.2)     // 红色
g3d.setPosition(cube, 0, 0.8, 0)

const ground = g3d.createPlane(8, 8)  // 地面
g3d.setColor(ground, 0.25, 0.45, 0.3)

let t = 0
g3d.animate(function() {
  t = t + g3d.getDelta()
  g3d.rotate(cube, 0.8 * g3d.getDelta(), 1.2 * g3d.getDelta(), 0)
  g3d.setPosition(cube, Math.sin(t), 1.0 + Math.abs(Math.sin(t * 2)) * 0.6, 0)
})
```

---

## 完整示例

### 控制台程序示例
```javascript
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
```

### 窗口程序示例
```javascript
function main() {
  createWindow({ title: '我的应用', width: 600, height: 400 })
  centerWindow()
  setWindowContent(`
    <div style="padding: 20px; font-family: sans-serif;">
      <h2>欢迎使用</h2>
      <p>这是一个 EPP 窗口程序。</p>
    </div>
  `)
}

main()
```

### 文件编辑器示例
```javascript
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
```

---
## 编译和运行

1. 在 EPP 编译器中编写 `.e` 源代码
2. 点击"编译"按钮，选择保存位置生成 `.epp` 文件
3. 点击"运行"按钮可直接在编译器中运行
4. 双击 `.epp` 文件可用 EPP 运行器直接运行

---

## 安全要求

### 用户账户控制（UAC）

运行 EPP 程序时，系统会弹出 UAC 用户账户控制确认对话框，要求用户确认是否允许运行该程序。这是为了保护系统安全，防止未经授权的程序执行。

- 运行 EPP 程序时，UAC 对话框会显示程序路径
- 用户点击"是"才允许运行，点击"否"则取消运行
- 该机制由系统自动处理，开发者无需额外配置

---

## 注意事项

- 所有异步 API（返回 Promise）需要使用 `await` 调用
- 入口函数需要在代码末尾手动调用，如 `main()`
- 控制台程序在编译器输出面板运行
- 窗口程序在新窗口中运行
- 文件路径使用 `/Users/Admin/Documents/` 等完整路径
