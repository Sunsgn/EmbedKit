export const AGENT_PROTOCOL_VERSION = 1;

export const AGENT_CAPABILITIES = Object.freeze({
  SERIAL: 'serial',
  SERIAL_DRIVER_DIAGNOSTICS: 'serial-driver-diagnostics',
  SERIAL_DRIVER_INSTALLATION: 'serial-driver-installation',
  TCP_CLIENT: 'tcp-client',
  TCP_SERVER: 'tcp-server',
  UDP_CLIENT: 'udp-client',
  UDP_SERVER: 'udp-server',
  NETWORK_FRAMING: 'network-framing',
  SESSION_RESTORE: 'session-restore',
  NETWORK_SESSION_RESTORE: 'network-session-restore',
  STRUCTURED_ERRORS: 'structured-errors',
  PROJECT_BUILD: 'project-build',
  PROJECT_SCAN: 'project-scan',
  LOCAL_PICKER: 'local-picker',
  LOCAL_FILE_READ: 'local-file-read',
  ELF_ANALYSIS: 'elf-analysis',
  SOFTWARE_ENVIRONMENT: 'software-environment',
  SOFTWARE_INSTALLATION: 'software-installation',
  PART_SOURCE_STATUS: 'part-source-status',
  PART_DETAILS_ONLINE: 'part-details-online',
  PART_DOCUMENT_DISCOVERY: 'part-document-discovery',
  PART_DOCUMENT_READ: 'part-document-read',
});

const route = (id, method, path, capability, options = {}) => Object.freeze({
  id,
  method,
  path,
  capability,
  timeoutMs: options.timeoutMs ?? 5_000,
  binary: options.binary === true,
});

export const AGENT_ROUTES = Object.freeze({
  status: route('agent.status', 'GET', '/api/agent/status', null, { timeoutMs: 2_000 }),
  environmentInstallations: route('environment.installations', 'GET', '/api/environment/installations', AGENT_CAPABILITIES.SOFTWARE_ENVIRONMENT, { timeoutMs: 20_000 }),
  environmentInstallManifests: route('environment.install-manifests', 'GET', '/api/environment/install-manifests', AGENT_CAPABILITIES.SOFTWARE_INSTALLATION),
  environmentInstallJobs: route('environment.install-jobs', 'POST', '/api/environment/install-jobs', AGENT_CAPABILITIES.SOFTWARE_INSTALLATION, { timeoutMs: 20_000 }),
  environmentInstallJob: route('environment.install-job', 'GET', '/api/environment/install-jobs/:jobId', AGENT_CAPABILITIES.SOFTWARE_INSTALLATION),
  environmentInstallJobCancel: route('environment.install-job-cancel', 'DELETE', '/api/environment/install-jobs/:jobId', AGENT_CAPABILITIES.SOFTWARE_INSTALLATION),
  environmentInstallJobUnsupported: route('environment.install-job-unsupported', 'POST', '/api/environment/install-jobs/:jobId', AGENT_CAPABILITIES.SOFTWARE_INSTALLATION),
  fileSelect: route('files.select', 'POST', '/api/files/select', AGENT_CAPABILITIES.LOCAL_PICKER, { timeoutMs: 300_000 }),
  fileSelection: route('files.selection', 'GET', '/api/files/selections/:selectionId', AGENT_CAPABILITIES.LOCAL_FILE_READ),
  fileRevoke: route('files.revoke', 'DELETE', '/api/files/selections/:selectionId', AGENT_CAPABILITIES.LOCAL_FILE_READ),
  fileChunk: route('files.chunk', 'GET', '/api/files/selections/:selectionId/chunk', AGENT_CAPABILITIES.LOCAL_FILE_READ),
  projectScan: route('projects.scan', 'POST', '/api/projects/scan', AGENT_CAPABILITIES.PROJECT_SCAN, { timeoutMs: 20_000 }),
  elfAnalyze: route('elf.analyze', 'GET', '/api/elf/analyze/:selectionId', AGENT_CAPABILITIES.ELF_ANALYSIS, { timeoutMs: 30_000 }),
  elfLookup: route('elf.lookup', 'GET', '/api/elf/analyses/:analysisId/lookup', AGENT_CAPABILITIES.ELF_ANALYSIS),
  elfDisassemble: route('elf.disassemble', 'GET', '/api/elf/analyses/:analysisId/disassemble', AGENT_CAPABILITIES.ELF_ANALYSIS, { timeoutMs: 10_000 }),
  buildDetect: route('build.detect', 'POST', '/api/build/detect', AGENT_CAPABILITIES.PROJECT_BUILD),
  buildJobs: route('build.jobs', 'POST', '/api/build/jobs', AGENT_CAPABILITIES.PROJECT_BUILD),
  buildJobsList: route('build.jobs-list', 'GET', '/api/build/jobs', AGENT_CAPABILITIES.PROJECT_BUILD),
  buildJob: route('build.job', 'GET', '/api/build/jobs/:jobId', AGENT_CAPABILITIES.PROJECT_BUILD),
  buildJobCancel: route('build.job-cancel', 'DELETE', '/api/build/jobs/:jobId', AGENT_CAPABILITIES.PROJECT_BUILD),
  buildJobUnsupported: route('build.job-unsupported', 'POST', '/api/build/jobs/:jobId', AGENT_CAPABILITIES.PROJECT_BUILD),
  buildArtifactSelect: route('build.artifact-select', 'POST', '/api/build/jobs/:jobId/artifacts/:artifactIndex/select', AGENT_CAPABILITIES.PROJECT_BUILD),
  buildArtifactSelectReadUnsupported: route('build.artifact-select-read-unsupported', 'GET', '/api/build/jobs/:jobId/artifacts/:artifactIndex/select', AGENT_CAPABILITIES.PROJECT_BUILD),
  buildArtifactSelectDeleteUnsupported: route('build.artifact-select-delete-unsupported', 'DELETE', '/api/build/jobs/:jobId/artifacts/:artifactIndex/select', AGENT_CAPABILITIES.PROJECT_BUILD),
  buildArtifactHash: route('build.artifact-hash', 'POST', '/api/build/jobs/:jobId/artifacts/:artifactIndex/hash', AGENT_CAPABILITIES.PROJECT_BUILD),
  buildArtifactHashReadUnsupported: route('build.artifact-hash-read-unsupported', 'GET', '/api/build/jobs/:jobId/artifacts/:artifactIndex/hash', AGENT_CAPABILITIES.PROJECT_BUILD),
  buildArtifactHashDeleteUnsupported: route('build.artifact-hash-delete-unsupported', 'DELETE', '/api/build/jobs/:jobId/artifacts/:artifactIndex/hash', AGENT_CAPABILITIES.PROJECT_BUILD),
  serialPorts: route('serial.ports', 'GET', '/api/serial/ports', AGENT_CAPABILITIES.SERIAL),
  serialSessions: route('serial.sessions', 'POST', '/api/serial/sessions', AGENT_CAPABILITIES.SERIAL),
  serialDrivers: route('serial.drivers', 'GET', '/api/serial/drivers', AGENT_CAPABILITIES.SERIAL_DRIVER_DIAGNOSTICS, { timeoutMs: 20_000 }),
  serialDriverInstall: route('serial.driver-install', 'POST', '/api/serial/drivers/install', AGENT_CAPABILITIES.SERIAL_DRIVER_INSTALLATION, { timeoutMs: 150_000 }),
  networkStatus: route('network.status', 'GET', '/api/network/status', AGENT_CAPABILITIES.TCP_CLIENT),
  networkSessions: route('network.sessions', 'POST', '/api/network/sessions', AGENT_CAPABILITIES.TCP_CLIENT),
  partSources: route('parts.sources', 'GET', '/api/parts/sources', AGENT_CAPABILITIES.PART_SOURCE_STATUS, { timeoutMs: 3_000 }),
  partDetails: route('parts.details', 'GET', '/api/component-details', AGENT_CAPABILITIES.PART_DETAILS_ONLINE, { timeoutMs: 12_000 }),
  partDocuments: route('parts.documents', 'GET', '/api/parts/documents', AGENT_CAPABILITIES.PART_DOCUMENT_DISCOVERY, { timeoutMs: 30_000 }),
  partDocumentContent: route('parts.document-content', 'GET', '/api/parts/document-content', AGENT_CAPABILITIES.PART_DOCUMENT_READ, { timeoutMs: 45_000, binary: true }),
});

export function listAgentCapabilities(platform = '') {
  const capabilities = Object.values(AGENT_CAPABILITIES).filter(value => value !== AGENT_CAPABILITIES.SERIAL_DRIVER_INSTALLATION);
  if (platform === 'win32') capabilities.push(AGENT_CAPABILITIES.SERIAL_DRIVER_INSTALLATION);
  return capabilities;
}

export function validateAgentContract() {
  const routeIds = new Set();
  for (const definition of Object.values(AGENT_ROUTES)) {
    if (routeIds.has(definition.id)) throw new Error(`Duplicate Agent route id: ${definition.id}`);
    if (!definition.path.startsWith('/api/')) throw new Error(`Agent route must start with /api/: ${definition.id}`);
    if (definition.capability && !Object.values(AGENT_CAPABILITIES).includes(definition.capability)) throw new Error(`Unknown Agent capability: ${definition.capability}`);
    routeIds.add(definition.id);
  }
  return { protocolVersion: AGENT_PROTOCOL_VERSION, routes: routeIds.size, capabilities: Object.keys(AGENT_CAPABILITIES).length };
}
