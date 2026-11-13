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
    aiStandardsOverview: 'AI嵌入式开发规范/README.md',
    aiStartupProtocol: 'AI嵌入式开发规范/00-AI项目启动与推进协议.md',
    aiExecutionRules: 'AI嵌入式开发规范/01-AI执行总则.md',
    aiProjectInputs: 'AI嵌入式开发规范/01A-项目输入与立项.md',
    aiProjectWorkflow: 'AI嵌入式开发规范/02-完整项目开发流程.md',
    aiSoftwareStandard: 'AI嵌入式开发规范/03-软件编程技术规范.md',
    aiHardwareStandard: 'AI嵌入式开发规范/04-原理图与PCB设计规范.md',
    aiVerificationStandard: 'AI嵌入式开发规范/05-验证与交付规范.md',
    aiProjectVariables: 'AI嵌入式开发规范/06-项目变量模板.md',
    aiDeliverableTemplates: 'AI嵌入式开发规范/07-交付物模板库.md',
    aiGateDirectoryMap: 'AI嵌入式开发规范/08-阶段门禁与目录映射表.md',
    generalGuide: 'AI辅助嵌入式产品开发通用指南.md',
    mcuProblemReview: 'MCU与RTOS问题解决及开发规避.md',
    linuxProblemReview: '嵌入式Linux问题解决及开发规避.md',
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
