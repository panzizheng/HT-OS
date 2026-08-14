import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  server: {
    open: true,
    watch: {
      // 排除 Visual Studio / 构建产物等目录，避免文件被锁定导致 EBUSY
      ignored: [
        '**/.vs/**',
        '**/.vscode/**',
        '**/obj/**',
        '**/dist/**',
        '**/node_modules/**',
        '**/user-files/**',
        '**/bin/**'
      ]
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // 确保 cookie 头被正确转发到后端
            if (req.headers.cookie) {
              proxyReq.setHeader('Cookie', req.headers.cookie)
            }
          })
        }
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})