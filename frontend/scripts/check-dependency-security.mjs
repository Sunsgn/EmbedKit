import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const npmCommand = process.env.npm_execpath ? process.execPath : process.platform === 'win32' ? 'npm.cmd' : 'npm'
const npmPrefix = process.env.npm_execpath ? [process.env.npm_execpath] : []
const allowedProductionAdvisories = new Set([])
const approvedLicenses = new Set([
  '(MPL-2.0 OR Apache-2.0)',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'BlueOak-1.0.0',
  'CC0-1.0',
  'ISC',
  'MIT',
  'MIT-0',
  'MPL-2.0',
])

function runAudit(args, label) {
  const result = spawnSync(npmCommand, [...npmPrefix, 'audit', ...args, '--json'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })

  let report
  try {
    report = JSON.parse(result.stdout)
  } catch {
    const detail = (result.error?.message || result.stderr || result.stdout || 'npm audit 未返回结果').trim()
    throw new Error(`${label}审计无法执行：${detail}`)
  }

  if (report.error || !report.metadata?.vulnerabilities) {
    throw new Error(`${label}审计失败：${report.error?.summary || '报告结构无效'}`)
  }
  return report
}

function advisoryIds(vulnerability, vulnerabilities, visited = new Set()) {
  if (!vulnerability || visited.has(vulnerability.name)) return []
  visited.add(vulnerability.name)
  return (vulnerability.via || []).flatMap((item) => {
    if (typeof item === 'string') return advisoryIds(vulnerabilities[item], vulnerabilities, visited)
    const id = item?.url?.match(/GHSA-[\w-]+/)?.[0]
    return id ? [id] : []
  })
}

function assertProductionPolicy(report) {
  const blocked = []
  for (const vulnerability of Object.values(report.vulnerabilities || {})) {
    if (['critical', 'high'].includes(vulnerability.severity)) {
      blocked.push(`${vulnerability.name}(${vulnerability.severity})`)
      continue
    }
    if (vulnerability.severity === 'moderate') {
      const ids = advisoryIds(vulnerability, report.vulnerabilities)
      if (ids.length === 0 || ids.some((id) => !allowedProductionAdvisories.has(id))) {
        blocked.push(`${vulnerability.name}(moderate: ${ids.join(', ') || '无 advisory ID'})`)
      }
    }
  }
  if (blocked.length > 0) {
    throw new Error(`生产依赖存在未批准风险：${blocked.join('；')}`)
  }
}

function assertToolchainPolicy(report) {
  const blocked = Object.values(report.vulnerabilities || {})
    .filter((item) => ['critical', 'high'].includes(item.severity))
    .map((item) => `${item.name}(${item.severity})`)
  if (blocked.length > 0) {
    throw new Error(`开发/发布工具链存在高风险：${blocked.join('；')}`)
  }
}

function checkLicenses() {
  const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'))
  const packages = Object.entries(lock.packages || {}).filter(([path]) => path !== '')
  const missing = packages.filter(([, metadata]) => !metadata.license).map(([path]) => path)
  const unapproved = packages
    .filter(([, metadata]) => metadata.license && !approvedLicenses.has(metadata.license))
    .map(([path, metadata]) => `${path}(${metadata.license})`)

  if (missing.length > 0) throw new Error(`锁文件中有 ${missing.length} 个依赖缺少许可证声明`)
  if (unapproved.length > 0) throw new Error(`发现未审查的许可证：${unapproved.join('；')}`)

  const productionCount = packages.filter(([, metadata]) => metadata.dev !== true).length
  const licenses = [...new Set(packages.map(([, metadata]) => metadata.license))].sort()
  return { total: packages.length, productionCount, licenses }
}

try {
  const production = runAudit(['--omit=dev'], '生产依赖')
  const all = runAudit([], '完整依赖')
  assertProductionPolicy(production)
  assertToolchainPolicy(all)
  const license = checkLicenses()
  const productionCounts = production.metadata.vulnerabilities
  const allCounts = all.metadata.vulnerabilities

  console.log(
    `依赖安全检查通过：生产 ${productionCounts.total} 项告警，完整工具链 ${allCounts.total} 项告警；` +
      `许可证 ${license.licenses.length} 类，覆盖 ${license.total} 个锁定包（生产 ${license.productionCount} 个）。`,
  )
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
