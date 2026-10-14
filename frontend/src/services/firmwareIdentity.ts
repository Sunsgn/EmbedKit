import type { BuildArtifact, BuildArtifactKind, FirmwareIdentity } from '../types/lifecycle';

export interface FirmwareIdentityInput {
  fileName: string;
  bytes: Uint8Array;
  decodedFormat?: string;
  buildId?: string;
  artifactIndex?: number;
  expectedSha256?: string;
  capturedAt?: string;
}

export interface FirmwareCatalogEntry {
  id: string;
  firmwareId: string;
  buildId: string;
  fileName: string;
  artifactType: BuildArtifactKind;
  size: number;
  capturedAt: string;
  sha256: string;
}

const stablePart = (value: unknown, limit = 60) => {
  const text = typeof value === 'string' ? value.slice(0, limit) : '';
  return /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(text) ? text : '';
};

const extension = (name: string) => name.split('.').at(-1)?.toLowerCase() ?? '';

function formats(name: string, decodedFormat = ''): { artifact: BuildArtifactKind; firmware: FirmwareIdentity['format'] } {
  const suffix = extension(name);
  if (decodedFormat === 'intel-hex' || ['hex', 'ihx'].includes(suffix)) return { artifact: 'hex', firmware: 'hex' };
  if (decodedFormat === 'bin' || suffix === 'bin') return { artifact: 'bin', firmware: 'bin' };
  if (suffix === 'elf' || suffix === 'axf' || suffix === 'out') return { artifact: 'elf', firmware: 'elf' };
  if (suffix === 'uf2') return { artifact: 'uf2', firmware: 'uf2' };
  return { artifact: 'other', firmware: 'other' };
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = Uint8Array.from(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copy.buffer);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}

export async function createFirmwareIdentityRecords(input: FirmwareIdentityInput): Promise<{ artifact: BuildArtifact; firmware: FirmwareIdentity }> {
  if (!input.bytes || !Number.isSafeInteger(input.bytes.byteLength) || !input.bytes.byteLength) throw new Error('固件文件为空，无法建立身份');
  const digest = await sha256Hex(input.bytes);
  const expected = String(input.expectedSha256 ?? '').toLowerCase();
  if (expected && (!/^[0-9a-f]{64}$/.test(expected) || expected !== digest)) throw new Error('构建记录 SHA-256 与实际读取文件不一致，未保存固件身份');
  const capturedAt = input.capturedAt ?? new Date().toISOString();
  const buildId = stablePart(input.buildId) || `local:${digest.slice(0, 16)}`;
  const artifactIndex = Number.isSafeInteger(input.artifactIndex) && Number(input.artifactIndex) >= 0 ? Number(input.artifactIndex) : undefined;
  const artifactId = artifactIndex === undefined
    ? `artifact:sha256:${digest}`
    : `artifact:${buildId}:${artifactIndex}:${digest.slice(0, 16)}`;
  const selectedFormats = formats(input.fileName, input.decodedFormat);
  const artifact: BuildArtifact = {
    schemaVersion: 1,
    id: artifactId,
    buildId,
    kind: selectedFormats.artifact,
    fileName: input.fileName,
    byteLength: input.bytes.byteLength,
    sha256: digest,
    capturedAt,
  };
  const firmware: FirmwareIdentity = {
    schemaVersion: 1,
    id: `firmware:${artifactId}`,
    buildArtifactId: artifactId,
    sha256: digest,
    byteLength: input.bytes.byteLength,
    format: selectedFormats.firmware,
    capturedAt,
  };
  return { artifact, firmware };
}

export function createFirmwareCatalog(artifacts: BuildArtifact[], identities: FirmwareIdentity[]): FirmwareCatalogEntry[] {
  const artifactById = new Map(artifacts.map(artifact => [artifact.id, artifact]));
  return identities.flatMap(identity => {
    const artifact = artifactById.get(identity.buildArtifactId);
    if (!artifact || artifact.sha256 !== identity.sha256 || artifact.byteLength !== identity.byteLength) return [];
    return [{
      id: identity.id,
      firmwareId: identity.id,
      buildId: artifact.buildId,
      fileName: artifact.fileName,
      artifactType: artifact.kind,
      size: artifact.byteLength,
      capturedAt: identity.capturedAt,
      sha256: identity.sha256,
    }];
  }).sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
}
