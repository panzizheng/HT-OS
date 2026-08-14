// ============================================================
// 命令注册系统
// 类似 Windows 的 PATH 机制：应用安装后可以注册命令关键字，
// 终端通过这些关键字调用对应应用的工具。
// 例如：epp-compiler 注册 `eppc` 命令用于编译 .epproj 项目
// ============================================================

/** 命令上下文：传递给命令处理函数的运行环境 */
export interface CommandContext {
  /** 终端当前工作目录（绝对路径，如 '/Users/Admin/Documents'） */
  cwd: string
  /** 输出文本到终端 */
  print: (text: string) => void
  /** 输出错误文本到终端 */
  printError: (text: string) => void
  /** 输出 HTML 到终端（用于带样式的输出） */
  printHtml: (html: string) => void
  /** 切换终端工作目录 */
  setCwd: (path: string) => void
  /** 文件系统实例 */
  fs: any
  /** 窗口管理器 */
  wm: any
  /** 事件总线 */
  eventBus: any
}

/** 命令定义 */
export interface CommandDefinition {
  /** 命令名（如 'eppc'、'notepad'），不区分大小写 */
  name: string
  /** 简短描述 */
  description: string
  /** 用法示例，如 'eppc <项目路径> [--config Debug|Release]' */
  usage?: string
  /** 所属应用名（如 'EPP 编译器'） */
  app: string
  /** 处理函数，args 为参数数组（不含命令名本身） */
  handler: (args: string[], ctx: CommandContext) => Promise<void> | void
}

/**
 * 命令注册中心
 * 全局单例，应用启动时调用 register() 注册自己的命令，
 * 终端调用 resolve() 查找命令并执行。
 */
export class CommandRegistry {
  private commands: Map<string, CommandDefinition> = new Map()

  /** 注册一个命令。若同名命令已存在则覆盖 */
  register(cmd: CommandDefinition): void {
    this.commands.set(cmd.name.toLowerCase(), cmd)
  }

  /** 注销命令 */
  unregister(name: string): void {
    this.commands.delete(name.toLowerCase())
  }

  /** 查找命令定义 */
  resolve(name: string): CommandDefinition | undefined {
    return this.commands.get(name.toLowerCase())
  }

  /** 列出所有已注册命令 */
  list(): CommandDefinition[] {
    return Array.from(this.commands.values())
  }

  /** 判断是否已注册 */
  has(name: string): boolean {
    return this.commands.has(name.toLowerCase())
  }
}

// 全局单例
let globalRegistry: CommandRegistry | null = null

/** 获取全局命令注册中心单例 */
export function getCommandRegistry(): CommandRegistry {
  if (!globalRegistry) {
    globalRegistry = new CommandRegistry()
  }
  return globalRegistry
}
