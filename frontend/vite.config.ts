import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

export function repositoryMarkdownPlugin(): Plugin {
  const docsRoot = resolve(import.meta.dirname, '../docs')
  const publicId = 'virtual:embedkit-repository-markdown'
  const resolvedId = '\0embedkit-repository-markdown'
  const documents = {
    aiConstraints: 'AI嵌入式开发约束.md',
    generalGuide: 'AI辅助嵌入式产品开发通用指南.md',
    a22Summary: 'FreeRTOS_A22家用燃气灶项目开发总结与整理建议.md',
    rv1106Summary: 'RV1106_Linux用户应用项目开发总结与整理建议.md',
    knowledgeOverview: '嵌入式开发知识库/README.md',
    engineeringMethod: '嵌入式开发知识库/01-通用工程方法.md',
    mcuRtos: '嵌入式开发知识库/02-MCU与RTOS开发.md',
    embeddedLinux: '嵌入式开发知识库/03-嵌入式Linux开发.md',
    communicationStorage: '嵌入式开发知识库/04-通信存储升级与安全.md',
    testingEvidence: '嵌入式开发知识库/05-测试证据故障与发布.md',
    caseBoundaries: '嵌入式开发知识库/06-案例经验与复用边界.md',
    engineeringTemplates: '嵌入式开发知识库/07-工程模板.md',
  }
  return {
    name: 'embedkit-repository-markdown',
    enforce: 'pre',
    resolveId(source) {
      if (source === publicId) return resolvedId
    },
    load(id) {
      if (id !== resolvedId) return
      const contents = Object.fromEntries(Object.entries(documents).map(([key, path]) => [key, readFileSync(resolve(docsRoot, path), 'utf8')]))
      return `export default ${JSON.stringify(contents)}`
    },
  }
}

export default defineConfig({
  base: '/EmbedKit/',
  plugins: [repositoryMarkdownPlugin(), react(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
