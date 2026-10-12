import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const options = Object.fromEntries(process.argv.slice(2).map(value => value.split('=', 2)));
const platform = options['--platform'] || process.platform;
const arch = options['--arch'] || process.arch;
const output = resolve(root, options['--output'] || join('dist', `embedkit-local-agent-${platform}-${arch}`));
const outputRelative = relative(root, output);
if (isAbsolute(outputRelative) || outputRelative.startsWith('..') || outputRelative === '') throw new Error('输出目录必须位于 proxy 目录内');
if (!existsSync(join(root, 'node_modules', 'serialport', 'package.json'))) throw new Error('缺少生产依赖，请先运行 npm ci --omit=dev');

rmSync(output, { recursive: true, force: true });
mkdirSync(join(output, 'runtime'), { recursive: true });
for (const file of ['proxy.js', 'elf.js', 'dwarf.js', 'websocket-loopback.js', 'package.json', 'README.md']) copyFileSync(join(root, file), join(output, file));
cpSync(join(root, 'node_modules'), join(output, 'node_modules'), { recursive: true });

const runtimeName = platform === 'win32' ? 'node.exe' : 'node';
copyFileSync(process.execPath, join(output, 'runtime', runtimeName));
if (platform !== 'win32') chmodSync(join(output, 'runtime', runtimeName), 0o755);

const windowsLauncher = '@echo off\r\ncd /d "%~dp0"\r\nset "EMBEDKIT_PROXY_HOST=127.0.0.1"\r\n"%~dp0runtime\\node.exe" "%~dp0proxy.js"\r\nif errorlevel 1 pause\r\n';
const unixLauncher = '#!/usr/bin/env sh\nset -eu\ncd "$(dirname "$0")"\nexport EMBEDKIT_PROXY_HOST=127.0.0.1\nexec "./runtime/node" "./proxy.js"\n';
if (platform === 'win32') writeFileSync(join(output, 'start-agent.cmd'), windowsLauncher);
else { writeFileSync(join(output, 'start-agent.sh'), unixLauncher); chmodSync(join(output, 'start-agent.sh'), 0o755); }

const packageInfo = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
writeFileSync(join(output, 'portable-manifest.json'), `${JSON.stringify({ schema: 'embedkit.local-agent-portable', version: 1, agentVersion: packageInfo.version, platform, arch, nodeVersion: process.version, entry: 'proxy.js', host: '127.0.0.1', port: 9999 }, null, 2)}\n`);
writeFileSync(join(output, 'START-HERE.txt'), `EmbedKit Local Agent ${packageInfo.version}\n\n1. 解压整个目录，不要只复制启动脚本。\n2. ${platform === 'win32' ? '双击 start-agent.cmd' : '在终端执行 ./start-agent.sh'}。\n3. 保持窗口运行，网页将通过 http://127.0.0.1:9999 检测 Agent。\n4. 首次访问串口或选择文件时，按系统提示授权。\n\nAgent 默认只监听本机回环地址。退出窗口即停止，不会安装系统服务。\n`);
console.log(`Portable Agent staged at ${output} (${basename(process.execPath)} ${process.version}).`);
