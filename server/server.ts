import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import fsPromises from 'fs/promises'

const app = express()
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001

// 文件系统根目录（可配置）
const FS_ROOT = path.resolve(process.env.FS_ROOT || './user-files')

// 确保根目录存在
if (!fs.existsSync(FS_ROOT)) {
  fs.mkdirSync(FS_ROOT, { recursive: true })
  console.log(`[Server] 创建文件系统根目录: ${FS_ROOT}`)
}

app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true }))

// 安全检查：防止路径遍历攻击
function safePath(userPath: string): string {
  const normalized = path.normalize(userPath).replace(/^(\.\.(\/|\\|$))+/, '')
  const fullPath = path.join(FS_ROOT, normalized)
  if (!fullPath.startsWith(FS_ROOT)) {
    throw new Error('访问被拒绝：路径超出允许范围')
  }
  return fullPath
}

// 转换为相对路径
function relativePath(fullPath: string): string {
  const rel = path.relative(FS_ROOT, fullPath)
  return rel ? '/' + rel.replace(/\\/g, '/') : '/'
}

// 获取文件/文件夹信息
function getStatInfo(fullPath: string): any {
  const stat = fs.statSync(fullPath)
  return {
    name: path.basename(fullPath),
    path: relativePath(fullPath),
    type: stat.isDirectory() ? 'folder' : 'file',
    size: stat.size,
    created: stat.birthtimeMs,
    modified: stat.mtimeMs,
    mimeType: stat.isDirectory() ? null : guessMimeType(path.basename(fullPath))
  }
}

// 猜测 MIME 类型
function guessMimeType(name: string): string {
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
    webm: 'video/webm',
    pdf: 'application/pdf'
  }
  return map[ext] || 'application/octet-stream'
}

// ========== API 路由 ==========

// 列出目录内容
app.get('/api/fs/list', (req, res) => {
  try {
    const dirPath = (req.query.path as string) || '/'
    const fullPath = safePath(dirPath)

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
        return getStatInfo(itemPath)
      } catch {
        return null
      }
    }).filter(Boolean)

    // 文件夹在前，文件在后，按名称排序
    items.sort((a: any, b: any) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name, 'zh-CN')
    })

    res.json({ items, path: dirPath })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// 获取文件/文件夹信息
app.get('/api/fs/stat', (req, res) => {
  try {
    const filePath = (req.query.path as string) || '/'
    const fullPath = safePath(filePath)

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: '路径不存在' })
    }

    res.json(getStatInfo(fullPath))
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// 读取文件内容（文本）
app.get('/api/fs/read', async (req, res) => {
  try {
    const filePath = (req.query.path as string) || '/'
    const fullPath = safePath(filePath)

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: '文件不存在' })
    }

    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      return res.status(400).json({ error: '不能读取目录' })
    }

    const content = await fsPromises.readFile(fullPath, 'utf-8')
    res.json({ content, stat: getStatInfo(fullPath) })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// 下载文件（二进制）
app.get('/api/fs/download', (req, res) => {
  try {
    const filePath = (req.query.path as string) || '/'
    const fullPath = safePath(filePath)

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: '文件不存在' })
    }

    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      return res.status(400).json({ error: '不能下载目录' })
    }

    res.download(fullPath, path.basename(fullPath))
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// 写入文件（创建或覆盖）
app.post('/api/fs/write', async (req, res) => {
  try {
    const filePath = (req.body.path as string) || '/'
    const content = req.body.content ?? ''
    const fullPath = safePath(filePath)

    // 确保父目录存在
    const parentDir = path.dirname(fullPath)
    if (!fs.existsSync(parentDir)) {
      await fsPromises.mkdir(parentDir, { recursive: true })
    }

    await fsPromises.writeFile(fullPath, content, 'utf-8')
    res.json({ success: true, stat: getStatInfo(fullPath) })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// 创建目录
app.post('/api/fs/mkdir', async (req, res) => {
  try {
    const dirPath = (req.body.path as string) || '/'
    const fullPath = safePath(dirPath)

    if (fs.existsSync(fullPath)) {
      return res.status(400).json({ error: '路径已存在' })
    }

    await fsPromises.mkdir(fullPath, { recursive: true })
    res.json({ success: true, stat: getStatInfo(fullPath) })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// 删除文件/文件夹
app.delete('/api/fs/delete', async (req, res) => {
  try {
    const targetPath = (req.body.path as string) || '/'
    const fullPath = safePath(targetPath)

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: '路径不存在' })
    }

    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      await fsPromises.rm(fullPath, { recursive: true, force: true })
    } else {
      await fsPromises.unlink(fullPath)
    }

    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// 重命名
app.post('/api/fs/rename', async (req, res) => {
  try {
    const oldPath = req.body.oldPath as string
    const newName = req.body.newName as string

    if (!oldPath || !newName) {
      return res.status(400).json({ error: '参数不完整' })
    }

    const oldFullPath = safePath(oldPath)
    const newFullPath = safePath(path.join(path.dirname(oldPath), newName))

    if (!fs.existsSync(oldFullPath)) {
      return res.status(404).json({ error: '源路径不存在' })
    }

    if (fs.existsSync(newFullPath)) {
      return res.status(400).json({ error: '目标路径已存在' })
    }

    await fsPromises.rename(oldFullPath, newFullPath)
    res.json({ success: true, stat: getStatInfo(newFullPath) })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// 移动
app.post('/api/fs/move', async (req, res) => {
  try {
    const sourcePath = req.body.source as string
    const targetPath = req.body.target as string

    if (!sourcePath || !targetPath) {
      return res.status(400).json({ error: '参数不完整' })
    }

    const sourceFull = safePath(sourcePath)
    const targetFull = safePath(targetPath)

    if (!fs.existsSync(sourceFull)) {
      return res.status(404).json({ error: '源路径不存在' })
    }

    // 确保目标父目录存在
    const targetParent = path.dirname(targetFull)
    if (!fs.existsSync(targetParent)) {
      await fsPromises.mkdir(targetParent, { recursive: true })
    }

    await fsPromises.rename(sourceFull, targetFull)
    res.json({ success: true, stat: getStatInfo(targetFull) })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// 复制
app.post('/api/fs/copy', async (req, res) => {
  try {
    const sourcePath = req.body.source as string
    const targetPath = req.body.target as string

    if (!sourcePath || !targetPath) {
      return res.status(400).json({ error: '参数不完整' })
    }

    const sourceFull = safePath(sourcePath)
    let targetFull = safePath(targetPath)

    if (!fs.existsSync(sourceFull)) {
      return res.status(404).json({ error: '源路径不存在' })
    }

    // 如果目标是目录，则复制到目录内
    if (fs.existsSync(targetFull) && fs.statSync(targetFull).isDirectory()) {
      targetFull = path.join(targetFull, path.basename(sourceFull))
    }

    // 确保目标父目录存在
    const targetParent = path.dirname(targetFull)
    if (!fs.existsSync(targetParent)) {
      await fsPromises.mkdir(targetParent, { recursive: true })
    }

    const stat = fs.statSync(sourceFull)
    if (stat.isDirectory()) {
      await fsPromises.cp(sourceFull, targetFull, { recursive: true })
    } else {
      await fsPromises.copyFile(sourceFull, targetFull)
    }

    res.json({ success: true, stat: getStatInfo(targetFull) })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// 搜索文件
app.get('/api/fs/search', (req, res) => {
  try {
    const keyword = (req.query.keyword as string) || ''
    const dirPath = (req.query.path as string) || '/'
    const fullPath = safePath(dirPath)

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: '路径不存在' })
    }

    const results: any[] = []
    const lower = keyword.toLowerCase()

    function walk(dir: string) {
      const items = fs.readdirSync(dir)
      for (const name of items) {
        const itemPath = path.join(dir, name)
        try {
          const stat = fs.statSync(itemPath)
          if (name.toLowerCase().includes(lower)) {
            results.push(getStatInfo(itemPath))
          }
          if (stat.isDirectory()) {
            walk(itemPath)
          }
        } catch {
          // 跳过无法访问的文件
        }
      }
    }

    walk(fullPath)

    results.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name, 'zh-CN')
    })

    res.json({ results })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// 获取磁盘空间信息
app.get('/api/fs/storage', (req, res) => {
  try {
    // 简单计算根目录下的文件总大小
    let totalSize = 0
    let fileCount = 0
    let folderCount = 0

    function walk(dir: string) {
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
          // 跳过
        }
      }
    }

    walk(FS_ROOT)

    res.json({
      root: FS_ROOT,
      totalSize,
      fileCount,
      folderCount,
      freeSpace: null
    })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// 上传文件
import multer from 'multer'

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const targetDir = (req.body.path as string) || '/'
      const fullPath = safePath(targetDir)
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true })
      }
      cb(null, fullPath)
    },
    filename: (req, file, cb) => {
      cb(null, file.originalname)
    }
  }),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
})

app.post('/api/fs/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' })
    }
    const fullPath = req.file.path
    res.json({ success: true, stat: getStatInfo(fullPath) })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', fsRoot: FS_ROOT })
})

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║                                          ║
║   HT OS 文件服务已启动                    ║
║                                          ║
║   端口: ${PORT}                            ║
║   文件根目录: ${FS_ROOT.slice(0, 30).padEnd(30)}  ║
║   API: http://localhost:${PORT}/api/fs      ║
║                                          ║
╚══════════════════════════════════════════╝
  `)
})
