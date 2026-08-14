import type { FileSystem } from '../../fs/FileSystem'
import type { CompileConfig, CompileResult, EPPFile, EPPManifest, EPPProject, EPPSolution } from './types'

// ============================================================
// [SYNC] 编译核心 — 与 epp_compiler.py 保持同步
// 函数: stripComments, minify, compileCode, compileProject,
//       compileSingleFile, generateSolution, ensureDirectory, loadProject
// 修改任一文件时，请同步修改另一文件！
// ============================================================

/** 移除单行和多行注释 */
function stripComments(code: string): string {
  let result = ''
  let i = 0
  let inString: string | null = null
  while (i < code.length) {
    const ch = code[i]
    const next = code[i + 1]
    // 字符串内不处理注释
    if (inString) {
      result += ch
      if (ch === '\\' && i + 1 < code.length) {
        result += code[i + 1]
        i += 2
        continue
      }
      if (ch === inString) inString = null
      i++
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch
      result += ch
      i++
      continue
    }
    // 单行注释 //
    if (ch === '/' && next === '/') {
      while (i < code.length && code[i] !== '\n') i++
      continue
    }
    // 多行注释 /* */
    if (ch === '/' && next === '*') {
      i += 2
      while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i++
      i += 2
      continue
    }
    result += ch
    i++
  }
  return result
}

/** 压缩空白（Release 模式使用） */
function minify(code: string): string {
  return code
    .replace(/\s*([\n;{}(),=+\-*/<>!&|?:]+)\s*/g, '$1')
    .replace(/\n+/g, '\n')
    .trim()
}

/**
 * 编译源代码为字节码
 * @param code 源代码
 * @param projectName 项目名
 * @param projectVersion 项目版本
 * @param config 编译配置
 */
export function compileCode(
  code: string,
  projectName: string,
  projectVersion: string,
  config: CompileConfig
): EPPFile {
  const manifest: EPPManifest = {
    name: projectName,
    version: projectVersion,
    defaultWidth: 600,
    defaultHeight: 400,
    entry: 'main'
  }

  let processedCode = code
  if (config === 'Release') {
    // Release 模式：移除注释并压缩空白
    const noComments = stripComments(code)
    processedCode = minify(noComments)
  } else {
    // Debug 模式：保留源代码原样，仅附加调试标记
    processedCode = code
  }

  const payload = {
    manifest,
    code: processedCode,
    config,
    timestamp: Date.now()
  }
  const bytecode = btoa(encodeURIComponent(JSON.stringify(payload)))
  return { manifest, bytecode }
}

/**
 * 编译项目，输出到 bin/<Config>/ 目录
 * @param fs 文件系统
 * @param projectPath 项目文件夹路径（无前导 /）
 * @param project 项目对象
 * @param config 编译配置
 * @returns 编译结果
 */
export async function compileProject(
  fs: FileSystem,
  projectPath: string,
  project: EPPProject,
  config: CompileConfig
): Promise<CompileResult> {
  const startTime = Date.now()

  // 读取主源文件
  const mainPath = `${projectPath}/${project.main}`
  const mainItem = await fs.getByPath(mainPath)
  if (!mainItem || mainItem.type !== 'file') {
    throw new Error(`主源文件不存在: ${mainPath}`)
  }
  const code = await fs.readFile(mainItem.id)
  if (code === null) {
    throw new Error(`无法读取主源文件: ${mainPath}`)
  }

  // 编译
  const eppFile = compileCode(code, project.name, project.version, config)

  // 输出到 bin/<Config>/<项目名>.epp
  const binDir = `${projectPath}/bin/${config}`
  // 确保 bin/<Config> 目录存在
  await ensureDirectory(fs, binDir)

  // 清理旧的编译产物（防止项目名变更后旧文件残留）
  try {
    const dirItem = await fs.getByPath(binDir)
    if (dirItem && dirItem.type === 'folder') {
      const oldFiles = await fs.listFiles(dirItem.id)
      for (const oldFile of oldFiles) {
        if (oldFile.name.endsWith('.epp')) {
          await fs.deleteItem(oldFile.id)
        }
      }
    }
  } catch { /* 忽略清理错误 */ }

  const outputPath = `${binDir}/${project.name}.epp`
  await fs.writeFile(outputPath, JSON.stringify(eppFile))

  return {
    outputPath,
    config,
    bytecodeSize: eppFile.bytecode.length,
    projectName: project.name,
    duration: Date.now() - startTime
  }
}

/** 递归确保目录存在 */
async function ensureDirectory(fs: FileSystem, dirPath: string): Promise<void> {
  const parts = dirPath.split('/').filter(Boolean)
  let currentPath = ''
  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part
    const existing = await fs.getByPath(currentPath)
    if (!existing) {
      // 创建
      const parentPath = currentPath.split('/').slice(0, -1).join('/')
      const parent = parentPath ? await fs.getByPath(parentPath) : null
      await fs.createFolder(part, parent?.id || null)
    } else if (existing.type !== 'folder') {
      throw new Error(`路径已存在但不是文件夹: ${currentPath}`)
    }
  }
}

/**
 * [SYNC] 编译单个 .e 源文件，输出 .epp 到同目录
 * 对应 epp_compiler.py 的 compile_single_file()
 */
export async function compileSingleFile(
  fs: FileSystem,
  filePath: string,
  config: CompileConfig
): Promise<CompileResult> {
  const startTime = Date.now()
  const fileItem = await fs.getByPath(filePath)
  if (!fileItem || fileItem.type !== 'file') {
    throw new Error(`文件不存在: ${filePath}`)
  }
  const code = await fs.readFile(fileItem.id)
  if (code === null) {
    throw new Error(`无法读取文件: ${filePath}`)
  }
  const baseName = (filePath.split('/').pop() || 'program').replace(/\.e$/i, '')
  const eppFile = compileCode(code, baseName, '1.0.0', config)
  const outputPath = filePath.replace(/\.e$/i, '.epp')
  await fs.writeFile(outputPath, JSON.stringify(eppFile))
  return {
    outputPath,
    config,
    bytecodeSize: eppFile.bytecode.length,
    projectName: baseName,
    duration: Date.now() - startTime
  }
}

/**
 * [SYNC] 生成解决方案文件 (.esln)
 * 对应 epp_compiler.py 的 generate_solution()
 */
export async function generateSolution(
  fs: FileSystem,
  slnName: string,
  projectNames: string[],
  targetDir: string = '/Users/Admin/Documents'
): Promise<string> {
  const slnDir = targetDir.replace(/^\//, '')
  const slnPath = slnDir ? `${slnDir}/${slnName}` : slnName

  // 检查目录是否已存在
  const existing = await fs.getByPath(slnPath)
  if (existing) {
    throw new Error(`目录已存在: ${slnPath}`)
  }

  // 创建解决方案目录
  const parentItem = await fs.getByPath(slnDir)
  if (!parentItem || parentItem.type !== 'folder') {
    throw new Error(`父目录不存在: ${slnDir}`)
  }
  await fs.createFolder(slnName, parentItem.id)

  // 创建每个项目
  const projects: Array<{ name: string; path: string }> = []
  for (const name of projectNames) {
    const projPath = `${slnPath}/${name}`
    await fs.createFolder(name, (await fs.getByPath(slnPath))!.id)
    await fs.writeFile(`${projPath}/main.e`, `// ${name}\nprintln("Hello, EPP!")\n`)
    const project: EPPProject = {
      name,
      version: '1.0.0',
      main: 'main.e',
      files: ['main.e']
    }
    await fs.writeFile(`${projPath}/project.epproj`, JSON.stringify(project, null, 2))
    projects.push({ name, path: name })
  }

  // 创建解决方案文件
  const solution: EPPSolution = { name: slnName, projects }
  const slnFilePath = `${slnPath}/${slnName}.esln`
  await fs.writeFile(slnFilePath, JSON.stringify(solution, null, 2))
  return slnPath
}

/** [SYNC] 读取并解析项目文件 — 对应 epp_compiler.py 的 load_project() 逻辑 */
export async function loadProject(fs: FileSystem, projectPath: string): Promise<{ project: EPPProject; projectDir: string }> {
  // projectPath 可能是 .epproj 文件路径或项目文件夹路径
  let projFilePath = projectPath
  let projectDir: string
  if (projectPath.toLowerCase().endsWith('.epproj')) {
    projectDir = projectPath.split('/').slice(0, -1).join('/')
  } else {
    projFilePath = `${projectPath}/project.epproj`
    projectDir = projectPath
  }
  const fileItem = await fs.getByPath(projFilePath)
  if (!fileItem || fileItem.type !== 'file') {
    throw new Error(`项目文件不存在: ${projFilePath}`)
  }
  const data = await fs.readFile(fileItem.id)
  if (!data) throw new Error('无法读取项目文件')
  const project = JSON.parse(data) as EPPProject
  return { project, projectDir }
}
