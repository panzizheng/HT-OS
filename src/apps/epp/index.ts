import { assetIcon } from '../system-icons'

export { registerEPPCompilerApp, openESourceFile, openEProjectFile, openESolutionFile, registerEPPCommands } from './compiler'
export { registerEPPRunnerApp, runEPPFromFile } from './runner'
export { compileProject, loadProject, compileCode } from './compiler-core'
export type { EPPFile, EPPManifest, EPPProject, EPPSolution, EPPSolutionProject, CompileConfig, CompileResult, EPPRuntimeAPI } from './types'

// .epp 可执行文件图标（public/assets/epp程序.svg）
export const EPP_ICON = assetIcon('epp程序.svg')

// .e 源代码文件图标
export const E_SOURCE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="#f5f5f5" stroke="#06b6d4" stroke-width="1"/><polyline points="14 2 14 8 20 8" fill="#e0e0e0" stroke="#06b6d4" stroke-width="1"/><text x="12" y="17" font-size="7" fill="#06b6d4" text-anchor="middle" font-family="monospace" font-weight="bold">e</text></svg>'

// .epproj 项目文件图标
export const EPPROJ_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40"><path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z" fill="#f5c542" stroke="#e0a800" stroke-width="1"/><rect x="6" y="10" width="12" height="7" rx="1" fill="#fff" stroke="#e0a800" stroke-width="0.8"/><text x="12" y="15.5" font-size="5" fill="#e0a800" text-anchor="middle" font-family="monospace" font-weight="bold">EPP</text></svg>'

// .esln 解决方案文件图标
export const ESLN_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40"><path d="M3 7l9-4 9 4-9 4z" fill="#8b5cf6" stroke="#7c3aed" stroke-width="1" stroke-linejoin="round"/><path d="M3 12l9 4 9-4" fill="#7c3aed" stroke="#7c3aed" stroke-width="0.8"/><path d="M3 17l9 4 9-4" fill="#6d28d9" stroke="#6d28d9" stroke-width="0.8"/></svg>'

/** 判断是否为 .epp 编译后可执行文件 */
export function isEPPFile(name: string): boolean {
  return name.toLowerCase().endsWith('.epp')
}

/** 判断是否为 .e 源代码文件 */
export function isESourceFile(name: string): boolean {
  return name.toLowerCase().endsWith('.e') && !name.toLowerCase().endsWith('.epp')
}

/** 判断是否为 .epproj 项目文件 */
export function isEProjectFile(name: string): boolean {
  return name.toLowerCase().endsWith('.epproj')
}

/** 判断是否为 .esln 解决方案文件 */
export function isESolutionFile(name: string): boolean {
  return name.toLowerCase().endsWith('.esln')
}
