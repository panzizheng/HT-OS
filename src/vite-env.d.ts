/// <reference types="vite/client" />

/** 以原始字符串方式导入 Markdown 文档（docs/ 下的规范文件） */
declare module '*.md?raw' {
  const content: string
  export default content
}
