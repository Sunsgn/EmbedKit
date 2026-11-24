import http from 'http';
import https from 'https';
import { SerialPort } from 'serialport';
import { spawn } from 'child_process';
import { join } from 'path';
import { URL, pathToFileURL } from 'url';
import { AGENT_PROTOCOL_VERSION, listAgentCapabilities, validateAgentContract } from '../contracts/agent-api.js';
import { createHttpBoundary } from './server/http.js';
import { AgentRouter } from './server/router.js';
import { createAiDiscovery } from './server/ai-discovery.js';
import { createForwardProxy } from './server/forward-proxy.js';
import { createBuildService, createBuildCommand, parseBuildDiagnostic } from './server/build-service.js';
import { scanProjectDirectory } from './server/project-scanner.js';
import { createFileSelectionService } from './server/file-selection-service.js';
import { createElfAnalysisService } from './server/elf-analysis-service.js';
import { createSerialSessionService, receiveSerialData, validateSerialOptions } from './server/serial-session-service.js';
import { createNetworkSessionService, decodeNetworkPayload, validateHostAndPort } from './server/network-session-service.js';
import { createSoftwareEnvironmentService, extractSoftwareVersion, validateArchiveEntries, validateInstallManifest } from './server/software-environment-service.js';
import { classifySerialDriverDevice, createSerialDriverService, extractUsbHardwareIdentity, parsePnpUtilProblemDevices } from './server/serial-driver-service.js';
import { createAgentLogger } from './server/agent-logger.js';
import { createPartDocumentService, extractOfficialDocuments } from './server/part-document-service.js';
import { registerAiServiceRoutes } from './routes/ai-services.js';
import { registerBuildArtifactRoutes } from './routes/build-artifacts.js';
import { registerBuildRoutes } from './routes/build.js';
import { registerEnvironmentRoutes } from './routes/environment.js';
import { registerFileAnalysisRoutes } from './routes/files-analysis.js';
import { registerNetworkSessionRoutes } from './routes/network-sessions.js';
import { registerPartRoutes } from './routes/parts.js';
import { registerSerialSessionRoutes } from './routes/serial-sessions.js';
import { registerSerialSystemRoutes } from './routes/serial-system.js';

const PORT = process.env.EMBEDKIT_PROXY_PORT || 9999;
const HOST = process.env.EMBEDKIT_PROXY_HOST || '127.0.0.1';
const AGENT_VERSION = '1.1.1';
const MAX_REQUEST_BYTES = Number(process.env.EMBEDKIT_MAX_REQUEST_BYTES || 2 * 1024 * 1024);
const MAX_NETWORK_SESSIONS = 16;
const MAX_NETWORK_EVENTS = 2000;
const MAX_NETWORK_PEERS = 64;
const MAX_NETWORK_FRAME_BYTES = 64 * 1024;
const DEFAULT_NETWORK_CONNECT_TIMEOUT_MS = 10_000;
const DEFAULT_NETWORK_FRAME_GAP_MS = 30;
const MAX_SERIAL_SESSIONS = 16;
const MAX_ARTIFACT_HASH_JOBS = 2;
const MAX_FILE_SELECTIONS = 32;
const MAX_SELECTED_FILE_BYTES = Number(process.env.EMBEDKIT_MAX_SELECTED_FILE_BYTES || 512 * 1024 * 1024);
const MAX_FILE_CHUNK_BYTES = 256 * 1024;
const FILE_SELECTION_TTL_MS = 15 * 60 * 1000;
const SOFTWARE_DETECTION_TIMEOUT_MS = 4000;
const SOFTWARE_VERSION_OUTPUT_LIMIT = 16 * 1024;
const MAX_INSTALL_JOBS = 20;
const MAX_ACTIVE_INSTALL_JOBS = 2;
const MAX_INSTALL_DOWNLOAD_BYTES = 128 * 1024 * 1024;
const SERIAL_STATE_FILE = process.env.EMBEDKIT_SERIAL_STATE_FILE || join(process.cwd(), '.embedkit-state', 'serial-sessions.json');
const NETWORK_STATE_FILE = process.env.EMBEDKIT_NETWORK_STATE_FILE || join(process.cwd(), '.embedkit-state', 'network-sessions.json');
const AGENT_LOG_FILE = process.env.EMBEDKIT_AGENT_LOG_FILE || join(process.cwd(), '.embedkit-state', 'agent.log');
const AGENT_LOG_MAX_BYTES = Number(process.env.EMBEDKIT_AGENT_LOG_MAX_BYTES || 1024 * 1024);
const SOFTWARE_INSTALLATION_STATE_FILE = process.env.EMBEDKIT_SOFTWARE_STATE_FILE || join(process.cwd(), '.embedkit-state', 'software-installations.json');
const PART_DOCUMENT_MAX_HTML_BYTES = 2 * 1024 * 1024;
const PART_DOCUMENT_MAX_PDF_BYTES = 50 * 1024 * 1024;
const PART_DOCUMENT_MAX_RESULTS = 24;
const PART_DOCUMENT_CACHE_TTL_MS = 10 * 60 * 1000;
const systemSerialAdapter = {
  list: () => SerialPort.list(),
  create: options => new SerialPort(options),
};
const { detectServers } = createAiDiscovery();

function runPickerProcess(executable, args) {
  return new Promise((resolvePicker, reject) => {
    const child = spawn(executable, args, { windowsHide: false, shell: false });
    let stdout = '', stderr = '', finished = false;
    const timer = setTimeout(() => { if (!finished) child.kill(); }, 5 * 60 * 1000);
    const finish = (error, value) => { if (finished) return; finished = true; clearTimeout(timer); if (error) reject(error); else resolvePicker(value); };
    child.stdout.on('data', data => { stdout += data.toString(); });
    child.stderr.on('data', data => { stderr += data.toString(); });
    child.on('error', error => finish(error));
    child.on('close', code => {
      const path = stdout.trim();
      if (path) finish(null, { cancelled: false, path });
      else if (code === 0 || code === 1) finish(null, { cancelled: true });
      else finish(new Error(stderr.trim() || `System picker exited with code ${code}`));
    });
  });
}

const systemFilePickerAdapter = {
  select: ({ kind, purpose }) => {
    if (process.platform === 'win32') {
      const script = kind === 'directory'
        ? "Add-Type -AssemblyName System.Windows.Forms; $d=New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description='Select an embedded project directory'; if($d.ShowDialog() -eq 'OK'){[Console]::Out.Write($d.SelectedPath)}"
        : purpose === 'serial-driver-inf'
          ? "Add-Type -AssemblyName System.Windows.Forms; $d=New-Object System.Windows.Forms.OpenFileDialog; $d.Title='Select an extracted Windows serial driver INF'; $d.Filter='Windows driver INF|*.inf'; if($d.ShowDialog() -eq 'OK'){[Console]::Out.Write($d.FileName)}"
          : "Add-Type -AssemblyName System.Windows.Forms; $d=New-Object System.Windows.Forms.OpenFileDialog; $d.Title='Select an embedded development file'; $d.Filter='Embedded files|*.map;*.elf;*.axf;*.out;*.bin;*.hex;*.srec;*.s19|All files|*.*'; if($d.ShowDialog() -eq 'OK'){[Console]::Out.Write($d.FileName)}";
      return runPickerProcess('powershell.exe', ['-NoProfile', '-STA', '-Command', script]);
    }
    if (process.platform === 'darwin') return runPickerProcess('osascript', ['-e', kind === 'directory' ? 'POSIX path of (choose folder with prompt "Select an embedded project directory")' : 'POSIX path of (choose file with prompt "Select an embedded development file")']);
    return runPickerProcess('zenity', ['--file-selection', ...(kind === 'directory' ? ['--directory'] : []), '--title', kind === 'directory' ? 'Select an embedded project directory' : 'Select an embedded development file']);
  },
};

export function configureSerialAdapter(adapter) {
  serialSessionService.configureAdapter(adapter || systemSerialAdapter);
}

export function configureFilePickerAdapter(adapter) {
  fileSelectionService.configurePicker(adapter || systemFilePickerAdapter);
}

async function scanSelectedProject(selectionId, options) {
  const selection = fileSelectionService.getSelection(selectionId, 'directory');
  return scanProjectDirectory(selection.path, options);
}

const agentLogger = createAgentLogger({ file: AGENT_LOG_FILE, maxBytes: AGENT_LOG_MAX_BYTES });
const allowedOrigins = new Set((process.env.EMBEDKIT_ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000,https://sunsgn.github.io')
  .split(',').map(value => value.trim()).filter(Boolean));
const allowedTargets = new Set((process.env.EMBEDKIT_ALLOWED_TARGETS || [
  'http://localhost:11434',
  'http://127.0.0.1:11434',
  'http://localhost:1234',
  'http://127.0.0.1:1234',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3123',
  'http://127.0.0.1:3123',
  'http://localhost:1337',
  'http://127.0.0.1:1337',
  'http://localhost:4891',
  'http://127.0.0.1:4891',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://localhost:5001',
  'http://127.0.0.1:5001',
  'http://localhost:7860',
  'http://127.0.0.1:7860',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
].join(',')).split(',').map(value => value.trim()).filter(Boolean));

const httpBoundary = createHttpBoundary({ allowedOrigins, maxRequestBytes: MAX_REQUEST_BYTES });
export const isAllowedOrigin = httpBoundary.isAllowedOrigin;
const setCORS = httpBoundary.setCors;
const jsonRes = httpBoundary.jsonResponse;

export function validateProxyTarget(targetUrl) {
  let target;
  try {
    target = new URL(targetUrl);
  } catch {
    throw new Error('Invalid proxy target URL');
  }
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) {
    throw new Error('Only credential-free HTTP(S) targets are allowed');
  }
  if (!allowedTargets.has(target.origin)) {
    throw new Error(`Proxy target is not allowed: ${target.origin}`);
  }
  return target;
}

const readJSONBody = httpBoundary.readJsonBody;
const proxyRequest = createForwardProxy({
  validateTarget: validateProxyTarget,
  readRequestBody: httpBoundary.readRequestBody,
  jsonResponse: jsonRes,
});

const fileSelectionService = createFileSelectionService({
  picker: systemFilePickerAdapter,
  maxSelections: MAX_FILE_SELECTIONS,
  maxFileBytes: MAX_SELECTED_FILE_BYTES,
  maxChunkBytes: MAX_FILE_CHUNK_BYTES,
  ttlMs: FILE_SELECTION_TTL_MS,
});
const elfAnalysisService = createElfAnalysisService({ getSelection: fileSelectionService.getSelection });
const serialDriverService = createSerialDriverService({
  listPorts: systemSerialAdapter.list,
  getSelection: fileSelectionService.getSelection,
});
const partDocumentService = createPartDocumentService({
  agentVersion: AGENT_VERSION,
  maxHtmlBytes: PART_DOCUMENT_MAX_HTML_BYTES,
  maxPdfBytes: PART_DOCUMENT_MAX_PDF_BYTES,
  maxResults: PART_DOCUMENT_MAX_RESULTS,
  cacheTtlMs: PART_DOCUMENT_CACHE_TTL_MS,
});
const softwareEnvironmentService = createSoftwareEnvironmentService({
  stateFile: SOFTWARE_INSTALLATION_STATE_FILE,
  getDirectorySelection: fileSelectionService.getSelection,
  agentVersion: AGENT_VERSION,
  maxDownloadBytes: MAX_INSTALL_DOWNLOAD_BYTES,
  maxJobs: MAX_INSTALL_JOBS,
  maxActiveJobs: MAX_ACTIVE_INSTALL_JOBS,
  detectionTimeoutMs: SOFTWARE_DETECTION_TIMEOUT_MS,
  outputLimit: SOFTWARE_VERSION_OUTPUT_LIMIT,
});
const serialSessionService = createSerialSessionService({
  adapter: systemSerialAdapter,
  stateFile: SERIAL_STATE_FILE,
  maxSessions: MAX_SERIAL_SESSIONS,
  maxEvents: MAX_NETWORK_EVENTS,
});
const networkSessionService = createNetworkSessionService({
  stateFile: NETWORK_STATE_FILE,
  maxSessions: MAX_NETWORK_SESSIONS,
  maxEvents: MAX_NETWORK_EVENTS,
  maxPeers: MAX_NETWORK_PEERS,
  maxFrameBytes: MAX_NETWORK_FRAME_BYTES,
  defaultConnectTimeoutMs: DEFAULT_NETWORK_CONNECT_TIMEOUT_MS,
  defaultFrameGapMs: DEFAULT_NETWORK_FRAME_GAP_MS,
});
const buildService = createBuildService({
  createSelection: fileSelectionService.createSelection,
  maxHashJobs: MAX_ARTIFACT_HASH_JOBS,
  maxArtifactBytes: MAX_SELECTED_FILE_BYTES,
});

export { createBuildCommand, parseBuildDiagnostic };
export { scanProjectDirectory };
export { receiveSerialData, validateSerialOptions };
export { decodeNetworkPayload, validateHostAndPort };
export { extractSoftwareVersion, validateArchiveEntries, validateInstallManifest };
export { classifySerialDriverDevice, extractUsbHardwareIdentity, parsePnpUtilProblemDevices };
export { extractOfficialDocuments };
export const configureInstallManifestRegistry = manifests => softwareEnvironmentService.configureManifests(manifests);
export const configureSoftwareInstallerAdapter = adapter => softwareEnvironmentService.configureInstaller(adapter);
export const detectDevelopmentSoftware = () => softwareEnvironmentService.detect();
export const configureSerialDriverAdapter = adapter => serialDriverService.configureAdapter(adapter);
export const scanSerialDriverDevices = () => serialDriverService.scan();
export const installSelectedSerialDriver = options => serialDriverService.install(options);
export const configurePartDocumentFetcher = fetcher => partDocumentService.configureFetcher(fetcher);
export const configurePartDocumentBinaryFetcher = fetcher => partDocumentService.configureBinaryFetcher(fetcher);
export const validateOfficialPartDocumentUrl = value => partDocumentService.validateUrl(value);
export const readOfficialPartDocument = value => partDocumentService.read(value);
export const discoverOfficialPartDocuments = options => partDocumentService.discover(options);
export const authorizeBuildArtifact = (job, indexValue) => buildService.authorizeArtifact(job, indexValue);
export const hashBuildArtifact = (job, indexValue) => buildService.hashArtifact(job, indexValue);

const agentRouter = new AgentRouter().register({
  id: 'agent.status', method: 'GET', path: '/api/agent/status',
  handler: async ({ res }) => jsonRes(res, 200, { available: true, name: 'EmbedKit Local Agent', version: AGENT_VERSION, protocolVersion: AGENT_PROTOCOL_VERSION, uptimeSeconds: Math.floor(process.uptime()), serialSessions: serialSessionService.size(), networkSessions: networkSessionService.size(), buildJobs: buildService.size(), capabilities: listAgentCapabilities(process.platform) }),
});
registerAiServiceRoutes(agentRouter, { jsonResponse: jsonRes, detectServers, proxyRequest });
registerPartRoutes(agentRouter, { jsonResponse: jsonRes, discoverDocuments: partDocumentService.discover, readDocument: partDocumentService.read, readPartDetails: getChipDetails, maxDocumentResults: PART_DOCUMENT_MAX_RESULTS });
registerFileAnalysisRoutes(agentRouter, {
  jsonResponse: jsonRes,
  selectPath: async req => fileSelectionService.selectPath(await readJSONBody(req)),
  scanProject: async req => {
    const body = await readJSONBody(req);
    return scanSelectedProject(body.selectionId, body);
  },
  revokeSelection: fileSelectionService.revoke,
  getSelection: fileSelectionService.getSelection,
  readChunk: fileSelectionService.readChunk,
  analyzeElf: elfAnalysisService.analyze,
  lookupElf: elfAnalysisService.lookup,
  disassembleElf: elfAnalysisService.disassemble,
});
registerEnvironmentRoutes(agentRouter, {
  jsonResponse: jsonRes,
  detectInstallations: softwareEnvironmentService.detect,
  listInstallManifests: softwareEnvironmentService.listManifests,
  startInstallJob: async req => softwareEnvironmentService.startJob(await readJSONBody(req)),
  getInstallJob: softwareEnvironmentService.getJob,
  publicInstallJob: softwareEnvironmentService.publicJob,
  cancelInstallJob: softwareEnvironmentService.cancelJob,
});
registerBuildRoutes(agentRouter, {
  jsonResponse: jsonRes,
  readJsonBody: readJSONBody,
  detectEnvironment: rootPath => buildService.detectEnvironment(rootPath),
  listJobs: buildService.listJobs,
  startJob: options => buildService.startJob(options),
  getJob: buildService.getJob,
  publicJob: buildService.publicJob,
  stopJob: buildService.stopJob,
});
registerBuildArtifactRoutes(agentRouter, {
  jsonResponse: jsonRes,
  getJob: buildService.getJob,
  authorizeArtifact: buildService.authorizeArtifact,
  hashArtifact: buildService.hashArtifact,
});
registerSerialSystemRoutes(agentRouter, {
  jsonResponse: jsonRes,
  readJsonBody: readJSONBody,
  status: () => ({ available: true, activeSessions: serialSessionService.size(), maxSessions: serialSessionService.maxSessions }),
  listPorts: serialSessionService.listPorts,
  scanDrivers: serialDriverService.scan,
  installDriver: serialDriverService.install,
});
registerSerialSessionRoutes(agentRouter, {
  jsonResponse: jsonRes,
  readJsonBody: readJSONBody,
  listSessions: serialSessionService.listSessions,
  getSession: serialSessionService.getSession,
  createSession: serialSessionService.createSession,
  publicSession: serialSessionService.publicSession,
  decodePayload: decodeNetworkPayload,
  pushEvent: serialSessionService.pushEvent,
  persistSessions: serialSessionService.persist,
  closeSession: serialSessionService.closeSession,
  removeSession: serialSessionService.removeSession,
});
registerNetworkSessionRoutes(agentRouter, {
  jsonResponse: jsonRes,
  readJsonBody: readJSONBody,
  status: () => ({ available: true, protocols: ['tcp', 'udp'], modes: ['client', 'server'], activeSessions: networkSessionService.size(), maxSessions: networkSessionService.maxSessions }),
  listSessions: networkSessionService.listSessions,
  getSession: networkSessionService.getSession,
  createSession: body => networkSessionService.createSession(body.type, body.host, body.port, body.localPort, body.mode, body.connectTimeoutMs, body.frameMode, body.frameGapMs),
  publicSession: networkSessionService.publicSession,
  decodePayload: decodeNetworkPayload,
  writeTcp: networkSessionService.writeTcp,
  sendUdp: networkSessionService.sendUdp,
  pushEvent: networkSessionService.pushEvent,
  persistSessions: networkSessionService.persist,
  closeSession: networkSessionService.closeSession,
  removeSession: networkSessionService.removeSession,
});

function fetchHTML(urlStr, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const client = url.protocol === 'https:' ? https : http;
    const req = client.get(urlStr, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`Timeout after ${timeoutMs}ms for ${urlStr}`));
    });
  });
}

function fetchSnapEDAJSON(urlStr, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const req = https.get(urlStr, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.snapeda.com/',
        'Origin': 'https://www.snapeda.com',
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Invalid JSON from SnapEDA: ${data.substring(0, 100)}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`Timeout after ${timeoutMs}ms for SnapEDA: ${urlStr}`));
    });
  });
}

async function getSnapEDASpecs(chipName) {
  const result = {
    productName: '',
    productFamily: '',
    description: '',
    specs: {},
    features: [],
    hierarchy: [],
    stUrl: '',
    datasheetUrl: '',
    productUrl: '',
    manufacturer: '',
    source: 'SnapEDA/Mouser',
  };

  try {
    const suggestions = await fetchSnapEDAJSON(`https://www.snapeda.com/api/v1/search_autocomplete?q=${chipName}`);
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      return null;
    }

    const partNames = [chipName, ...suggestions.filter(s => s.startsWith(chipName))];
    let partData = null;

    for (const partName of partNames) {
      const data = await fetchSnapEDAJSON(`https://www.snapeda.com/api/get_mouser_info_api?part_name=${partName}`);
      if (data && data.ManufacturerPartNumber) {
        partData = data;
        break;
      }
    }

    if (!partData) {
      return null;
    }

    result.productName = partData.ManufacturerPartNumber;
    result.productFamily = partData.Category || '';
    result.manufacturer = partData.Manufacturer || '';
    result.description = partData.Description || '';
    result.specs = {
      manufacturer: partData.Manufacturer || '',
      category: partData.Category || '',
      price: partData.Price || '',
      stock: partData.AvailabilityInStock || 'N/A',
      rohs: partData.ROHSStatus || '',
      lifecycle: partData.LifecycleStatus || '',
    };

    if (partData.DataSheetUrl) {
      result.stUrl = partData.DataSheetUrl;
      result.datasheetUrl = partData.DataSheetUrl;
    }

    if (partData.ProductAttributes) {
      const seen = new Set();
      partData.ProductAttributes.forEach(attr => {
        const key = attr.AttributeName;
        if (!seen.has(key)) {
          result.specs[key.toLowerCase()] = attr.AttributeValue;
          seen.add(key);
        }
      });
    }

    const desc = partData.Description || '';
    const clockMatch = desc.match(/(\d+)\s*MHz/);
    if (clockMatch) result.specs.maxClock = `${clockMatch[1]} MHz`;
    const flashMatch = desc.match(/(\d+)\s*[Kk](?:bytes?)?\s*Flash/i);
    if (flashMatch) result.specs.flashMemory = `${flashMatch[1]} KB Flash`;
    const sramMatch = desc.match(/(\d+)\s*[Kk](?:bytes?)?\s*RAM/i);
    if (sramMatch) result.specs.sram = `${sramMatch[1]} KB RAM`;

    const mouserUrl = partData.ProductDetailUrl;
    if (mouserUrl) {
      result.mouserUrl = mouserUrl;
    }

    if (partData.SuggestedReplacement && partData.SuggestedReplacement.length > 0) {
      result.alternatives = partData.SuggestedReplacement.slice(0, 5);
    }

    return result;
  } catch (e) {
    console.log(`SnapEDA lookup failed: ${e.message}`);
    return null;
  }
}

function parseSTProduct(html) {
  const result = {
    productName: '',
    productFamily: '',
    description: '',
    specs: {},
    features: [],
    hierarchy: [],
    stUrl: '',
  };

  // Extract meta description
  const metaDesc = html.match(/<meta name="description" content="([^"]+)"/)?.[1];
  if (metaDesc) result.description = metaDesc.replace(/&[^;]+;/g, ' ');

  // Extract from window.digitalData
  const dataMatch = html.match(/window\.digitalData\s*=\s*({[\s\S]*?});/);
  if (dataMatch) {
    try {
      const digitalData = JSON.parse(dataMatch[1]);
      const prod = digitalData.product?.[0]?.productInfo;
      if (prod) {
        result.productName = prod.productName || '';
        result.specs = { ...prod };
        const tree = prod.tree || {};
        result.productFamily = tree.level4 || tree.level3 || '';
      }
    } catch (e) {}
  }

  // Extract JSON-LD breadcrumbs
  const jsonLdScripts = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
  if (jsonLdScripts) {
    jsonLdScripts.forEach(script => {
      const json = script.replace(/<script[^>]*>|<\/script>/g, '').trim();
      try {
        const data = JSON.parse(json);
        if (data.itemListElement) {
          data.itemListElement.forEach(item => {
            result.hierarchy.push({ name: item.item?.['@type'] === 'WebPage' ? item.name : item.name, url: item.item });
          });
        }
      } catch (e) {}
    });
  }

  // Extract from st-stage-product__copy (short product description)
  const copyMatch = html.match(/<span class="st-stage-product__copy">([\s\S]*?)<\/span>/);
  if (copyMatch) {
    result.shortDescription = copyMatch[1].replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Extract from og:description
  const ogDescMatch = html.match(/<meta property="og:description" content="([^"]+)"/);
  if (ogDescMatch) {
    result.ogDescription = ogDescMatch[1].replace(/&[^;]+;/g, ' ');
  }

  // Extract main product description from overview text
  const overviewIdx = html.indexOf('st-overview');
  if (overviewIdx > 0) {
    const overviewSection = html.slice(overviewIdx, overviewIdx + 3000);
    const textMatch = overviewSection.match(/>([^<]{50,})</);
    if (textMatch && !result.description) {
      result.description = textMatch[1].replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }

  // Fallback: extract from og:description
  if (!result.description && result.ogDescription) {
    result.description = result.ogDescription;
  }

  // Extract "All features" section
  const featuresIdx = html.indexOf('All features');
  if (featuresIdx > 0) {
    const section = html.slice(featuresIdx, featuresIdx + 5000);
    const text = section.replace(/<[^>]*>/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && l !== 'All features');
    result.features = lines.slice(0, 40);
  }

  // Extract key specs from description and features
  const clockMatch = html.match(/(\d+)\s*MHz/);
  if (clockMatch) result.specs.maxClock = `${clockMatch[1]} MHz`;

  const flashMatch = html.match(/(\d+)\s*Kbytes?\s*of\s*Flash/i);
  if (flashMatch) result.specs.flashMemory = `${flashMatch[1]} KB Flash`;

  const sramMatch = html.match(/(\d+)\s*Kbytes?\s*of\s*SRAM/i);
  if (sramMatch) result.specs.sram = `${sramMatch[1]} KB SRAM`;

  const voltageMatch = html.match(/([\d.]+)\s*to\s*([\d.]+)\s*V/i);
  if (voltageMatch) result.specs.voltageRange = `${voltageMatch[1]}-${voltageMatch[2]} V`;

  const adcMatch = html.match(/(\d+)x\s*(\d+)-bit.*ADC/i);
  if (adcMatch) result.specs.adc = `${adcMatch[1]}x ${adcMatch[2]}-bit ADC`;

  return result;
}

async function getChipDetails(chipName) {
  const rule = detectManufacturer(chipName);
  const productUrl = rule ? rule.productUrl(chipName) : null;
  const snapResult = await getSnapEDASpecs(chipName);
  if (snapResult && snapResult.description && snapResult.description !== 'N/A') {
    if (productUrl) snapResult.productUrl = productUrl;
    return snapResult;
  }

  return {
    error: `No data found for ${chipName}`,
    productUrl: productUrl || `https://www.snapeda.com/search?q=${encodeURIComponent(chipName)}`,
    source: 'Unavailable',
  };
}

function generateStUrlCandidates(name) {
  return [name.toLowerCase()];
}

function detectManufacturer(name) {
  const n = name.toUpperCase();
  const manufacturerRules = [
    { name: 'STMicroelectronics', prefixes: ['STM32', 'STM8'], productUrl: q => `https://www.st.com/en/microcontrollers-microprocessors/${generateStUrlCandidates(q)[0]}.html` },
    { name: 'Texas Instruments', prefixes: ['MSP430', 'LM4F', 'TM4C'], productUrl: q => `https://www.ti.com/product/${q}` },
    { name: 'Espressif', prefixes: ['ESP'], productUrl: q => `https://www.espressif.com/en/products/socs/details/${q.toLowerCase()}` },
    { name: 'Raspberry Pi', prefixes: ['RP2'], productUrl: q => `https://www.raspberrypi.com/documentation/microcontrollers/${q.toLowerCase()}.html` },
  ];
  for (const rule of manufacturerRules) {
    for (const prefix of rule.prefixes) {
      if (n.startsWith(prefix.toUpperCase())) {
        return rule;
      }
    }
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = requestUrl.pathname;

  setCORS(req, res);
  if (!isAllowedOrigin(req.headers.origin)) {
    jsonRes(res, 403, { error: 'Origin is not allowed' });
    return;
  }
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (!['GET', 'POST', 'DELETE'].includes(req.method || '')) {
    jsonRes(res, 405, { error: 'Only GET, POST and DELETE are supported' });
    return;
  }

  if (await agentRouter.dispatch({ req, res, requestUrl, pathname })) return;

  const targetUrl = requestUrl.searchParams.get('target');
  if (targetUrl) {
    await proxyRequest(req, res, targetUrl);
    return;
  }

  jsonRes(res, 404, { error: 'Unknown path. Use /api/network/*, /api/chip-details, /api/servers, /api/models, or /proxy/<url>' });
});

export function startServer({ detectAi = true, restoreSerial = true, restoreNetwork = restoreSerial, host = HOST, port = PORT } = {}) {
  validateAgentContract();
  agentLogger.install();
  return server.listen(port, host, async () => {
    const address = server.address();
    const listeningHost = typeof address === 'object' && address ? address.address : host;
    const listeningPort = typeof address === 'object' && address ? address.port : port;
    console.log(`\n✅ EmbedKit local proxy running on http://${listeningHost}:${listeningPort}`);
    if (restoreSerial) await serialSessionService.restore();
    if (restoreNetwork) await networkSessionService.restore();
    if (!detectAi) return;
    const servers = await detectServers();
    if (servers.length > 0) {
      console.log(`\n🔍 Detected local AI servers:`);
      for (const s of servers) {
        console.log(`   ${s.name} at ${s.url} — ${s.models.length} model(s)`);
        const shown = s.models.slice(0, 5);
        for (const m of shown) {
          console.log(`     • ${m.name}`);
        }
        if (s.models.length > 5) {
          console.log(`     ... and ${s.models.length - 5} more`);
        }
      }
    } else {
      console.log(`\n⚠️  No local AI servers detected. Start Ollama or LM Studio.`);
    }
    console.log(`\n在 EmbedKit 中设置端点为: http://${listeningHost}:${listeningPort}/proxy/http://localhost:11434/v1/chat/completions`);
    console.log(`\n按 Ctrl+C 停止代理\n`);
  });
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) startServer();
