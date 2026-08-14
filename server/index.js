import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import multer from 'multer'
import { fileURLToPath } from 'url'
import https from 'https'
import http from 'http'
import { URL } from 'url'
import crypto from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001

const FS_ROOT = path.resolve(process.env.FS_ROOT || path.join(__dirname, '..', 'user-files'))

if (!fs.existsSync(FS_ROOT)) {
  fs.mkdirSync(FS_ROOT, { recursive: true })
  console.log(`[Server] 创建文件系统根目录: ${FS_ROOT}`)
}

// CORS 配置：允许前端携带 cookie
app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true }))

// 解析 cookie
function parseCookie(header) {
  const cookies = {}
  if (!header) return cookies
  header.split(';').forEach(str => {
    const [k, v] = str.trim().split('=')
    if (k) cookies[k] = decodeURIComponent(v || '')
  })
  return cookies
}

// 生成用户 session ID
function getOrCreateSessionId(req, res) {
  const cookies = parseCookie(req.headers.cookie)
  let sid = cookies['ht-session']
  if (!sid || !/^[a-f0-9]{32}$/.test(sid)) {
    sid = crypto.randomBytes(16).toString('hex')
    res.setHeader('Set-Cookie', `ht-session=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}`)
  }
  return sid
}

// 获取当前用户的文件根目录
function getUserRoot(req, res) {
  const sid = getOrCreateSessionId(req, res)
  const userRoot = path.join(FS_ROOT, sid)
  if (!fs.existsSync(userRoot)) {
    fs.mkdirSync(userRoot, { recursive: true })
    // 创建 Windows 风格的根目录结构
    ;['Windows', 'Program Files', 'Program Files (x86)', 'Users', 'PerfLogs'].forEach(dir => {
      fs.mkdirSync(path.join(userRoot, dir), { recursive: true })
    })

    // 在 Windows 目录下创建系统文件
    try {
      fs.writeFileSync(path.join(userRoot, 'Windows', 'about.txt'),
        'HT OS v1.0.0\n\n' +
        '一个使用 TypeScript + Vite 开发的网页操作系统。\n\n' +
        '技术栈：\n' +
        '- TypeScript 5\n' +
        '- Vite 5\n' +
        '- Express.js（文件系统后端）\n' +
        '- localStorage（设置持久化）\n' +
        '- 原生 DOM API（窗口管理）\n\n' +
        'License: MIT',
        'utf-8')
    } catch { /* ignore */ }

    try {
      fs.writeFileSync(path.join(userRoot, 'Windows', 'system-info.txt'),
        '系统信息\n\n' +
        '产品名: HT OS\n' +
        '版本: 1.0.0\n' +
        '构建: 稳定版\n' +
        '内核: HT Kernel 1.0\n' +
        '窗口系统: HT Window Manager\n' +
        '文件系统: HT Virtual File System',
        'utf-8')
    } catch { /* ignore */ }

    // 在 Users 下创建默认用户 Admin 及其子目录
    const adminRoot = path.join(userRoot, 'Users', 'Admin')
    ;['Desktop', 'Documents', 'Downloads', 'Pictures', 'Music', 'Videos'].forEach(dir => {
      fs.mkdirSync(path.join(adminRoot, dir), { recursive: true })
    })

    // 在桌面创建欢迎文件
    try {
      fs.writeFileSync(path.join(adminRoot, 'Desktop', 'welcome.txt'),
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
        'utf-8')
    } catch { /* ignore */ }

    // 在 PerfLogs 创建示例日志
    try {
      fs.writeFileSync(path.join(userRoot, 'PerfLogs', 'system.log'),
        '[启动] HT OS 初始化完成\n[启动] 窗口管理器就绪\n[启动] 文件系统已挂载\n[启动] 所有服务已启动\n',
        'utf-8')
    } catch { /* ignore */ }

    // 在 Documents 里放 EPP 编程指南
    try {
      fs.writeFileSync(path.join(adminRoot, 'Documents', 'EPP_Programming_Guide.md'),
        getEPPGuideContent(), 'utf-8')
    } catch { /* ignore */ }

    // 在 Program Files 下创建各系统程序子文件夹
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
      const appDir = path.join(userRoot, 'Program Files', app.name)
      fs.mkdirSync(appDir, { recursive: true })
      try {
        fs.writeFileSync(path.join(appDir, 'info.txt'), `${app.name}\n${app.desc}\n`, 'utf-8')
      } catch { /* ignore */ }
    }
  } else {
    // 兼容旧版：如果存在旧的 System 目录但没有 Windows 目录，迁移到新结构
    const oldSystemDir = path.join(userRoot, 'System')
    const windowsDir = path.join(userRoot, 'Windows')
    if (fs.existsSync(oldSystemDir) && !fs.existsSync(windowsDir)) {
      // 旧版结构，需要迁移：删除旧的用户目录内容，重建新结构
      const entries = fs.readdirSync(userRoot)
      for (const entry of entries) {
        const entryPath = path.join(userRoot, entry)
        fs.rmSync(entryPath, { recursive: true, force: true })
      }
      // 重新调用自身来创建新结构（删除 userRoot 后重新检测）
      fs.rmSync(userRoot, { recursive: true, force: true })
      return getUserRoot(req, res)
    }
    // 确保 Windows 目录和系统文件始终存在
    if (!fs.existsSync(windowsDir)) {
      fs.mkdirSync(windowsDir, { recursive: true })
    }
    const aboutFile = path.join(windowsDir, 'about.txt')
    if (!fs.existsSync(aboutFile)) {
      try {
        fs.writeFileSync(aboutFile,
          'HT OS v1.0.0\n\n一个使用 TypeScript + Vite 开发的网页操作系统。',
          'utf-8')
      } catch { /* ignore */ }
    }

    // 确保开发者文档存在于所有用户的 Documents 目录
    const usersDir = path.join(userRoot, 'Users')
    if (fs.existsSync(usersDir)) {
      const userDirs = fs.readdirSync(usersDir)
      for (const userDir of userDirs) {
        const docsDir = path.join(usersDir, userDir, 'Documents')
        if (fs.existsSync(docsDir)) {
          const guideFile = path.join(docsDir, 'EPP_Programming_Guide.md')
          if (!fs.existsSync(guideFile)) {
            try {
              fs.writeFileSync(guideFile, getEPPGuideContent(), 'utf-8')
            } catch { /* ignore */ }
          }
        }
      }
    }
  }
  return userRoot
}

function safePath(userPath, userRoot) {
  const normalized = path.normalize(userPath).replace(/^(\.\.(\/|\\|$))+/, '')
  const fullPath = path.join(userRoot, normalized)
  // 确保在 userRoot 内（防止路径遍历）
  const resolvedRoot = path.resolve(userRoot)
  const resolvedFull = path.resolve(fullPath)
  if (!resolvedFull.startsWith(resolvedRoot + path.sep) && resolvedFull !== resolvedRoot) {
    throw new Error('访问被拒绝：路径超出允许范围')
  }
  return fullPath
}

function relativePath(fullPath, userRoot) {
  const rel = path.relative(userRoot, fullPath)
  return rel ? '/' + rel.replace(/\\/g, '/') : '/'
}

function getStatInfo(fullPath, userRoot) {
  const stat = fs.statSync(fullPath)
  return {
    name: path.basename(fullPath),
    path: relativePath(fullPath, userRoot),
    type: stat.isDirectory() ? 'folder' : 'file',
    size: stat.size,
    created: stat.birthtimeMs,
    modified: stat.mtimeMs,
    mimeType: stat.isDirectory() ? null : guessMimeType(path.basename(fullPath))
  }
}

function guessMimeType(name) {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const map = {
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
    webm: 'video/webm',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  }
  return map[ext] || 'application/octet-stream'
}

app.get('/api/fs/list', (req, res) => {
  try {
    const userRoot = getUserRoot(req, res)
    const dirPath = req.query.path || '/'
    const fullPath = safePath(dirPath, userRoot)

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: '路径不存在' })
    }

    const stat = fs.statSync(fullPath)
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: '不是目录' })
    }

    const items = fs.readdirSync(fullPath).map(name => {
      const itemPath = path.join(fullPath, name)
      try {
        return getStatInfo(itemPath, userRoot)
      } catch {
        return null
      }
    }).filter(Boolean)

    items.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name, 'zh-CN')
    })

    res.json({ items, path: dirPath })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/fs/stat', (req, res) => {
  try {
    const userRoot = getUserRoot(req, res)
    const filePath = req.query.path || '/'
    const fullPath = safePath(filePath, userRoot)

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: '路径不存在' })
    }

    res.json(getStatInfo(fullPath, userRoot))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/fs/read', async (req, res) => {
  try {
    const userRoot = getUserRoot(req, res)
    const filePath = req.query.path || '/'
    const fullPath = safePath(filePath, userRoot)

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: '文件不存在' })
    }

    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      return res.status(400).json({ error: '不能读取目录' })
    }

    const content = await fs.promises.readFile(fullPath, 'utf-8')
    res.json({ content, stat: getStatInfo(fullPath, userRoot) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/fs/download', (req, res) => {
  try {
    const userRoot = getUserRoot(req, res)
    const filePath = req.query.path || '/'
    const fullPath = safePath(filePath, userRoot)

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: '文件不存在' })
    }

    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      return res.status(400).json({ error: '不能下载目录' })
    }

    res.download(fullPath, path.basename(fullPath))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// 内联预览文件（用于 PDF/图片等浏览器可渲染的格式，不会触发下载）
app.get('/api/fs/preview', (req, res) => {
  try {
    const userRoot = getUserRoot(req, res)
    const filePath = req.query.path || '/'
    const fullPath = safePath(filePath, userRoot)

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: '文件不存在' })
    }

    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      return res.status(400).json({ error: '不能预览目录' })
    }

    const mimeType = guessMimeType(path.basename(fullPath))
    // 设置内联显示，不触发下载
    res.setHeader('Content-Type', mimeType)
    res.setHeader('Content-Disposition', 'inline')
    res.setHeader('Content-Length', stat.size)

    const stream = fs.createReadStream(fullPath)
    stream.on('error', (err) => {
      if (!res.headersSent) {
        res.status(500).json({ error: err.message })
      }
    })
    stream.pipe(res)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/fs/write', async (req, res) => {
  try {
    const userRoot = getUserRoot(req, res)
    const filePath = req.body.path || '/'
    const content = req.body.content ?? ''
    const fullPath = safePath(filePath, userRoot)

    const parentDir = path.dirname(fullPath)
    if (!fs.existsSync(parentDir)) {
      await fs.promises.mkdir(parentDir, { recursive: true })
    }

    await fs.promises.writeFile(fullPath, content, 'utf-8')
    res.json({ success: true, stat: getStatInfo(fullPath, userRoot) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/fs/mkdir', async (req, res) => {
  try {
    const userRoot = getUserRoot(req, res)
    const dirPath = req.body.path || '/'
    const fullPath = safePath(dirPath, userRoot)

    if (fs.existsSync(fullPath)) {
      return res.status(400).json({ error: '路径已存在' })
    }

    await fs.promises.mkdir(fullPath, { recursive: true })
    res.json({ success: true, stat: getStatInfo(fullPath, userRoot) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.delete('/api/fs/delete', async (req, res) => {
  try {
    const userRoot = getUserRoot(req, res)
    const targetPath = req.body.path || '/'
    const fullPath = safePath(targetPath, userRoot)

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: '路径不存在' })
    }

    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      await fs.promises.rm(fullPath, { recursive: true, force: true })
    } else {
      await fs.promises.unlink(fullPath)
    }

    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/fs/rename', async (req, res) => {
  try {
    const userRoot = getUserRoot(req, res)
    const oldPath = req.body.oldPath
    const newName = req.body.newName

    if (!oldPath || !newName) {
      return res.status(400).json({ error: '参数不完整' })
    }

    const oldFullPath = safePath(oldPath, userRoot)
    const newFullPath = safePath(path.join(path.dirname(oldPath), newName), userRoot)

    if (!fs.existsSync(oldFullPath)) {
      return res.status(404).json({ error: '源路径不存在' })
    }

    if (fs.existsSync(newFullPath)) {
      return res.status(400).json({ error: '目标路径已存在' })
    }

    await fs.promises.rename(oldFullPath, newFullPath)
    res.json({ success: true, stat: getStatInfo(newFullPath, userRoot) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/fs/move', async (req, res) => {
  try {
    const userRoot = getUserRoot(req, res)
    const sourcePath = req.body.source
    const targetPath = req.body.target

    if (!sourcePath || !targetPath) {
      return res.status(400).json({ error: '参数不完整' })
    }

    const sourceFull = safePath(sourcePath, userRoot)
    const targetFull = safePath(targetPath, userRoot)

    if (!fs.existsSync(sourceFull)) {
      return res.status(404).json({ error: '源路径不存在' })
    }

    const targetParent = path.dirname(targetFull)
    if (!fs.existsSync(targetParent)) {
      await fs.promises.mkdir(targetParent, { recursive: true })
    }

    await fs.promises.rename(sourceFull, targetFull)
    res.json({ success: true, stat: getStatInfo(targetFull, userRoot) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/fs/copy', async (req, res) => {
  try {
    const userRoot = getUserRoot(req, res)
    const sourcePath = req.body.source
    const targetPath = req.body.target

    if (!sourcePath || !targetPath) {
      return res.status(400).json({ error: '参数不完整' })
    }

    const sourceFull = safePath(sourcePath, userRoot)
    let targetFull = safePath(targetPath, userRoot)

    if (!fs.existsSync(sourceFull)) {
      return res.status(404).json({ error: '源路径不存在' })
    }

    if (fs.existsSync(targetFull) && fs.statSync(targetFull).isDirectory()) {
      targetFull = path.join(targetFull, path.basename(sourceFull))
    }

    const targetParent = path.dirname(targetFull)
    if (!fs.existsSync(targetParent)) {
      await fs.promises.mkdir(targetParent, { recursive: true })
    }

    const stat = fs.statSync(sourceFull)
    if (stat.isDirectory()) {
      await fs.promises.cp(sourceFull, targetFull, { recursive: true })
    } else {
      await fs.promises.copyFile(sourceFull, targetFull)
    }

    res.json({ success: true, stat: getStatInfo(targetFull, userRoot) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/fs/search', (req, res) => {
  try {
    const userRoot = getUserRoot(req, res)
    const keyword = req.query.keyword || ''
    const dirPath = req.query.path || '/'
    const fullPath = safePath(dirPath, userRoot)

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: '路径不存在' })
    }

    const results = []
    const lower = keyword.toLowerCase()

    function walk(dir) {
      const items = fs.readdirSync(dir)
      for (const name of items) {
        const itemPath = path.join(dir, name)
        try {
          const stat = fs.statSync(itemPath)
          if (name.toLowerCase().includes(lower)) {
            results.push(getStatInfo(itemPath, userRoot))
          }
          if (stat.isDirectory()) {
            walk(itemPath)
          }
        } catch {
          // skip
        }
      }
    }

    walk(fullPath)

    results.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name, 'zh-CN')
    })

    res.json({ results })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/fs/storage', (req, res) => {
  try {
    const userRoot = getUserRoot(req, res)
    let totalSize = 0
    let fileCount = 0
    let folderCount = 0

    function walk(dir) {
      const items = fs.readdirSync(dir)
      for (const name of items) {
        const itemPath = path.join(dir, name)
        try {
          const stat = fs.statSync(itemPath)
          if (stat.isDirectory()) {
            folderCount++
            walk(itemPath)
          } else {
            fileCount++
            totalSize += stat.size
          }
        } catch {
          // skip
        }
      }
    }

    walk(userRoot)

    res.json({
      root: userRoot,
      totalSize,
      fileCount,
      folderCount,
      freeSpace: null
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// multer 需要 req/res 来确定用户目录，所以用工厂函数
function createUploadMiddleware() {
  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const targetDir = req.body.path || '/'
        // multer 里无法直接调用 res，先用一个固定用户根处理
        // 实际会在路由中做校验
        const userRoot = getUserRoot(req, { setHeader: () => {} })
        const fullPath = safePath(targetDir, userRoot)
        if (!fs.existsSync(fullPath)) {
          fs.mkdirSync(fullPath, { recursive: true })
        }
        cb(null, fullPath)
      },
      filename: (req, file, cb) => {
        // multer/busboy 按 latin1 解码 multipart 文件名，中文会乱码。
        // 尝试转回 UTF-8；若结果出现替换字符，说明原名可能已是 UTF-8，则直接使用原名。
        try {
          const raw = file.originalname || ''
          const decoded = Buffer.from(raw, 'latin1').toString('utf8')
          const fixed = decoded.includes('\uFFFD') ? raw : decoded
          cb(null, fixed)
        } catch {
          cb(null, file.originalname || 'upload')
        }
      }
    }),
    limits: { fileSize: 100 * 1024 * 1024 }
  })
}

const upload = createUploadMiddleware()

app.post('/api/fs/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' })
    }
    const userRoot = getUserRoot(req, res)
    const fullPath = req.file.path
    res.json({ success: true, stat: getStatInfo(fullPath, userRoot) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/proxy', async (req, res) => {
  try {
    const targetUrl = req.query.url
    if (!targetUrl) {
      return res.status(400).json({ error: '缺少 url 参数' })
    }

    let parsedUrl
    try {
      parsedUrl = new URL(targetUrl)
    } catch {
      return res.status(400).json({ error: '无效的 URL' })
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).json({ error: '只支持 http 和 https 协议' })
    }

    const MAX_REDIRECTS = 5
    let redirectCount = 0
    const timeout = 15000

    const doRequest = (currentUrl) => {
      const client = currentUrl.protocol === 'https:' ? https : http

      const proxyReq = client.request({
        hostname: currentUrl.hostname,
        port: currentUrl.port || (currentUrl.protocol === 'https:' ? 443 : 80),
        path: currentUrl.pathname + currentUrl.search,
        method: 'GET',
        timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Referer': currentUrl.origin + '/'
        }
      }, (proxyRes) => {
        // 处理重定向
        if ([301, 302, 303, 307, 308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
          redirectCount++
          if (redirectCount > MAX_REDIRECTS) {
            if (!res.headersSent) {
              res.status(500).json({ error: '重定向次数过多' })
            }
            return
          }

          let redirectUrl
          try {
            redirectUrl = new URL(proxyRes.headers.location, currentUrl)
          } catch {
            if (!res.headersSent) {
              res.status(500).json({ error: '无效的重定向地址' })
            }
            return
          }

          proxyRes.resume()
          doRequest(redirectUrl)
          return
        }

        const headersToRemove = ['x-frame-options', 'content-security-policy', 'content-security-policy-report-only', 'location', 'set-cookie', 'transfer-encoding']

        for (const [key, value] of Object.entries(proxyRes.headers)) {
          if (headersToRemove.includes(key.toLowerCase())) continue
          res.setHeader(key, value)
        }

        res.setHeader('X-Frame-Options', 'ALLOWALL')
        res.setHeader('Content-Security-Policy', "frame-ancestors *")
        res.setHeader('Access-Control-Allow-Origin', '*')

        res.status(proxyRes.statusCode || 200)

        const contentType = (proxyRes.headers['content-type'] || '').toLowerCase()
        const isHtml = contentType.includes('text/html')

        if (isHtml) {
          const chunks = []
          proxyRes.on('data', chunk => chunks.push(chunk))
          proxyRes.on('end', () => {
            let html = Buffer.concat(chunks).toString('utf-8')
            const finalUrl = currentUrl.href

            if (!/<base\s/i.test(html)) {
              html = html.replace(/<head([^>]*)>/i, `<head$1><base href="${finalUrl}">`)
            }

            // 移除 form 和 a 标签的 target 属性，防止打开新窗口
            html = html.replace(/<form\b([^>]*?)\btarget\s*=\s*["'][^"']*["']([^>]*)>/gi, '<form$1$2>')
            html = html.replace(/<form\b([^>]*?)\btarget\s*=\s*\S+([^>]*)>/gi, '<form$1$2>')
            html = html.replace(/<a\b([^>]*?)\btarget\s*=\s*["'][^"']*["']([^>]*)>/gi, '<a$1$2>')
            html = html.replace(/<a\b([^>]*?)\btarget\s*=\s*\S+([^>]*)>/gi, '<a$1$2>')

            // 移除 rel="noopener noreferrer" 中的 window.open 相关属性
            html = html.replace(/<a\b([^>]*?)\brel\s*=\s*["'][^"']*noopener[^"']*["']([^>]*)>/gi, '<a$1$2>')

            const navInterceptor = `<script>(function(){
var REAL_PARENT=window.parent;
var PROXY_BASE=location.origin+'/api/proxy?url=';
function go(u){
  try{REAL_PARENT.postMessage({__htNav:true,url:u.toString()},'*')}catch(e){}
  location.assign(PROXY_BASE+encodeURIComponent(u.toString()));
}
try{
// 阻止 window.open 弹出新窗口
window.open=function(){return null};
// 拦截表单提交（GET 表单走代理）
document.addEventListener('submit',function(e){
  var form=e.target;
  if(!(form instanceof HTMLFormElement))return;
  if((form.getAttribute('method')||'get').toUpperCase()!=='GET')return;
  var url;
  try{
    var action=form.getAttribute('action')||'';
    if(action){
      url=new URL(action,document.baseURI);
    }else{
      url=new URL(document.baseURI);
      url.search='';
    }
    var fd=new FormData(form);
    var sp=new URLSearchParams();
    fd.forEach(function(v,k){sp.append(k,v)});
    sp.forEach(function(v,k){url.searchParams.set(k,v)});
  }catch(err){return}
  e.preventDefault();
  e.stopPropagation();
  go(url);
},true);
// 拦截链接点击
document.addEventListener('click',function(e){
  var a=e.target.closest('a');
  if(!a)return;
  var href=a.getAttribute('href');
  if(!href||href.indexOf('#')===0||href.indexOf('mailto:')===0||href.indexOf('tel:')===0||href.indexOf('javascript:')===0)return;
  if(e.button===1||e.ctrlKey||e.metaKey||e.shiftKey){e.preventDefault();}
  var url;
  try{url=new URL(href,document.baseURI)}catch(err){return}
  if(!['http:','https:'].includes(url.protocol))return;
  e.preventDefault();
  e.stopPropagation();
  go(url);
},true);
// 移除 target 属性，防止打开新窗口
var _sa=Element.prototype.setAttribute;
Element.prototype.setAttribute=function(n,v){if(n==='target'&&v&&v!=='_self'){return}return _sa.apply(this,arguments)};
new MutationObserver(function(muts){
  muts.forEach(function(m){
    m.addedNodes.forEach(function(n){
      if(n.nodeType!==1)return;
      var list=n.querySelectorAll?n.querySelectorAll('a,form'):[];
      list.forEach(function(el){var t=el.getAttribute('target');if(t&&t!=='_self'){el.removeAttribute('target')}});
      if((n.tagName==='A'||n.tagName==='FORM')&&n.getAttribute('target')&&n.getAttribute('target')!=='_self'){n.removeAttribute('target')}
    });
  });
}).observe(document.documentElement,{childList:true,subtree:true});
// 通知父页面真实 URL（document.baseURI 即注入的 <base> 指向的真实站点地址）
try{REAL_PARENT.postMessage({__htNav:true,url:document.baseURI},'*')}catch(e){}
}catch(e){}
})();</script>`

            const antiBust = `<script>(function(){try{Object.defineProperty(window,'top',{get:function(){return window},configurable:false});Object.defineProperty(window,'parent',{get:function(){return window},configurable:false});var o=window.location;Object.defineProperty(window,'location',{get:function(){return o},set:function(v){if(typeof v==='string'&&v.indexOf('javascript:')===0){o.href=v;return}return}})}catch(e){}})();</script>`

            html = html.replace(/<head([^>]*)>/i, `<head$1>${navInterceptor}${antiBust}`)

            res.removeHeader('Content-Length')
            res.removeHeader('content-length')
            res.send(html)
          })
          proxyRes.on('error', () => {
            if (!res.headersSent) res.status(502).end()
          })
        } else {
          proxyRes.pipe(res)
        }
      })

      proxyReq.on('error', (err) => {
        if (!res.headersSent) {
          res.status(502).json({ error: '代理请求失败: ' + err.message })
        }
      })

      proxyReq.on('timeout', () => {
        proxyReq.destroy()
        if (!res.headersSent) {
          res.status(504).json({ error: '请求超时' })
        }
      })

      proxyReq.end()
    }

    doRequest(parsedUrl)
  } catch (e) {
    if (!res.headersSent) {
      res.status(500).json({ error: e.message })
    }
  }
})

// 从指定 URL 下载文件并保存到用户的 Downloads 文件夹
app.get('/api/browser/download', async (req, res) => {
  try {
    const userRoot = getUserRoot(req, res)
    const url = req.query.url
    if (!url) {
      return res.status(400).json({ error: '缺少 url 参数' })
    }

    let parsedUrl
    try {
      parsedUrl = new URL(url)
    } catch {
      return res.status(400).json({ error: '无效的 URL' })
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).json({ error: '只支持 http 和 https 协议' })
    }

    const downloadsDir = path.join(userRoot, 'Users', 'Admin', 'Downloads')
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true })
    }

    // 从 URL 提取文件名
    let fileName = path.basename(parsedUrl.pathname) || 'download'
    if (!fileName || fileName === '/' || !fileName.includes('.')) {
      fileName = 'download'
    }
    // 解码 URL 编码的文件名
    try {
      fileName = decodeURIComponent(fileName)
    } catch { /* 忽略 */ }

    const client = parsedUrl.protocol === 'https:' ? https : http

    const doDownload = (currentUrl, attempt = 0) => {
      if (attempt > 5) {
        return res.status(500).json({ error: '重定向次数过多' })
      }

      const reqClient = currentUrl.protocol === 'https:' ? https : http
      const downloadReq = reqClient.get({
        hostname: currentUrl.hostname,
        port: currentUrl.port || (currentUrl.protocol === 'https:' ? 443 : 80),
        path: currentUrl.pathname + currentUrl.search,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Referer': currentUrl.origin + '/'
        },
        timeout: 60000
      }, (downloadRes) => {
        // 处理重定向
        if ([301, 302, 303, 307, 308].includes(downloadRes.statusCode) && downloadRes.headers.location) {
          downloadRes.resume()
          try {
            const redirectUrl = new URL(downloadRes.headers.location, currentUrl)
            doDownload(redirectUrl, attempt + 1)
          } catch {
            res.status(500).json({ error: '无效的重定向地址' })
          }
          return
        }

        if (downloadRes.statusCode !== 200) {
          downloadRes.resume()
          res.status(downloadRes.statusCode || 500).json({ error: `下载失败: HTTP ${downloadRes.statusCode}` })
          return
        }

        // 尝试从 Content-Disposition 获取文件名
        const contentDisposition = downloadRes.headers['content-disposition']
        if (contentDisposition) {
          const match = contentDisposition.match(/filename\*?=(?:UTF-8'')?"?([^";\n]+)"?/i)
          if (match && match[1]) {
            try {
              fileName = decodeURIComponent(match[1].replace(/^UTF-8''/i, ''))
            } catch { /* 忽略 */ }
          }
        }

        const totalSize = parseInt(downloadRes.headers['content-length'] || '0', 10)
        const mimeType = downloadRes.headers['content-type'] || 'application/octet-stream'

        // 处理文件名冲突
        const safeFileName = getSafeFileName(downloadsDir, fileName)
        const filePath = path.join(downloadsDir, safeFileName)

        const fileStream = fs.createWriteStream(filePath)
        let downloaded = 0

        downloadRes.on('data', (chunk) => {
          downloaded += chunk.length
        })

        downloadRes.pipe(fileStream)

        fileStream.on('finish', () => {
          fileStream.close()
          const stat = getStatInfo(filePath, userRoot)
          res.json({
            success: true,
            file: stat,
            totalSize,
            downloaded,
            mimeType
          })
        })

        fileStream.on('error', (err) => {
          fs.unlink(filePath, () => {})
          res.status(500).json({ error: '保存文件失败: ' + err.message })
        })

        downloadRes.on('error', (err) => {
          fileStream.destroy()
          fs.unlink(filePath, () => {})
          res.status(500).json({ error: '下载失败: ' + err.message })
        })
      })

      downloadReq.on('error', (err) => {
        res.status(502).json({ error: '下载请求失败: ' + err.message })
      })

      downloadReq.on('timeout', () => {
        downloadReq.destroy()
        res.status(504).json({ error: '下载超时' })
      })
    }

    doDownload(parsedUrl)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

function getSafeFileName(dir, fileName) {
  if (!fs.existsSync(path.join(dir, fileName))) return fileName
  const ext = path.extname(fileName)
  const base = path.basename(fileName, ext)
  let count = 1
  let newName
  do {
    newName = `${base} (${count})${ext}`
    count++
  } while (fs.existsSync(path.join(dir, newName)))
  return newName
}

function getEPPGuideContent() {
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

EPP 不区分窗口程序和控制台程序。程序类型由代码决定：
- 如果代码中调用了 \`createWindow()\`，则打开 GUI 窗口
- 如果没有调用 \`createWindow()\`，则在控制台输出

所有程序都有控制台可用于输出。

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
- 字符串 (String): \`'hello'\`, \`"world"\`
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

---

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
  createWindow({ title: '我的应用', width: 600, height: 400 })
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

app.get('/api/health', (req, res) => {
  const userRoot = getUserRoot(req, res)
  res.json({ status: 'ok', userRoot })
})

// 生产环境：提供前端静态文件
const DIST_DIR = path.join(__dirname, '..', 'dist')
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR))
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API 不存在' })
    }
    res.sendFile(path.join(DIST_DIR, 'index.html'))
  })
}

app.listen(PORT, () => {
  const hasDist = fs.existsSync(DIST_DIR)
  console.log(`
╔══════════════════════════════════════════╗
║                                          ║
║   HT OS 服务已启动                        ║
║                                          ║
║   端口: ${PORT}                            ║
║   文件根目录: ${FS_ROOT.slice(0, 30).padEnd(30)}  ║
║   前端页面: ${hasDist ? '已提供 (dist)' : '未构建'}              ║
║   访问: http://localhost:${PORT}              ║
║                                          ║
╚══════════════════════════════════════════╝
  `)
})
