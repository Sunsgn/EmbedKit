export type {
  EvidenceKind,
  EvidenceLocation,
  EvidenceOrigin,
  EvidenceReference,
  Finding,
  FindingConclusionType,
  FindingConfidence,
} from './evidence';
export type {
  BuildArtifact,
  BuildArtifactKind,
  CommunicationSession,
  CommunicationSessionStatus,
  FirmwareIdentity,
  ProjectRevision,
  ProjectRevisionSource,
} from './lifecycle';

export interface Chip {
  id: string;
  name: string;
  manufacturer: string;
  series: string;
  cores: string;
  frequency: string;
  flash: string;
  ram: string;
  peripherals: string[];
  package: string;
  datasheetUrl?: string;
  reference?: string;
}

export interface ElectronicComponent {
  id: string;
  name: string;
  manufacturer: string;
  category: string;
  subcategory: string;
  description: string;
  package: string;
  parameters: Record<string, string>;
  tags: string[];
  datasheetUrl?: string;
  reference?: string;
}

export interface FileNode {
  name: string;
  path: string;
  content: string;
  language: 'c' | 'cpp' | 'h' | 'makefile' | 'toml' | 'text';
  size?: number;
  lastModified?: number;
}

export interface Project {
  id: string;
  name: string;
  chip: Chip;
  files: FileNode[];
  createdAt: string;
  updatedAt: string;
}

export interface CompileResult {
  success: boolean;
  output: string;
  binary?: string;
  size?: number;
}

export interface SerialPort {
  name: string;
  baudRate: number;
  dataBits: number;
  stopBits: number;
  parity: string;
}

export interface ExternalResource {
  title: string;
  url: string;
  lang: 'zh' | 'en';
  type: 'video' | 'doc' | 'course' | 'book' | 'project';
}

export interface RoadmapTopic {
  name: string;
  content?: string;
}

export interface RoadmapModule {
  id: string;
  title: string;
  description: string;
  topics: (string | RoadmapTopic)[];
  resources: ExternalResource[];
  codeExample?: string;
  codeLang?: 'c' | 'cpp' | 'python' | 'makefile' | 'text' | 'verilog' | 'bash' | 'cmake';
}

export interface RoadmapPhase {
  id: string;
  title: string;
  icon: string;
  color: string;
  description: string;
  duration: string;
  prerequisites?: string[];
  modules: RoadmapModule[];
}

export interface Tutorial {
  id: string;
  title: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  content: string;
  codeExample?: string;
}

export type ResourceFilter = 'all' | 'zh' | 'en' | 'video' | 'doc' | 'course';
