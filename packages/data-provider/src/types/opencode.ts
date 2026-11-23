export interface OpenCodeStatusResponse {
  enabled: boolean;
  reachable: boolean;
  version: string | null;
  isPlatformAdmin?: boolean;
}

export interface OpenCodeDirTreeEntry {
  name: string;
  path: string;
  type: 'directory' | 'file';
  size?: number;
  children?: OpenCodeDirTreeEntry[];
}

export interface OpenCodeTreeResponse {
  rootPath: string;
  projectName: string;
  tree: OpenCodeDirTreeEntry[];
}

export interface OpenCodeFileReadResponse {
  path: string;
  content: string;
  size: number;
}

export interface OpenCodeFileWriteResponse {
  ok: boolean;
  path: string;
}

export interface OpenCodeFileDeleteResponse {
  ok: boolean;
  path: string;
}

export interface OpenCodeFileRenameResponse {
  ok: boolean;
  fromPath: string;
  toPath: string;
}

export interface OpenCodeSearchMatch {
  path: string;
  line: number;
  column: number;
  text: string;
  matchLength: number;
}

export interface OpenCodeSearchResponse {
  ok: boolean;
  matches: OpenCodeSearchMatch[];
  truncated: boolean;
}

export interface OpenCodeSessionDto {
  id: string;
  slug?: string;
  projectID?: string;
  workspaceID?: string;
  directory: string;
  parentID?: string;
  title?: string;
  time?: {
    created?: number;
    updated?: number;
  };
  summary?: {
    additions: number;
    deletions: number;
    files: number;
  };
}

export interface OpenCodeMessageInfoDto {
  id: string;
  sessionID: string;
  role: 'user' | 'assistant' | string;
  time?: {
    created?: number;
    completed?: number;
  };
  modelID?: string;
  providerID?: string;
  agent?: string;
  error?: Record<string, unknown>;
}

export type OpenCodeToolStateDto =
  | {
      status: 'pending';
      input: Record<string, unknown>;
      raw: string;
    }
  | {
      status: 'running';
      input: Record<string, unknown>;
      title?: string;
      metadata?: Record<string, unknown>;
      time: { start: number };
    }
  | {
      status: 'completed';
      input: Record<string, unknown>;
      output: string;
      title: string;
      metadata?: Record<string, unknown>;
      time: { start: number; end: number; compacted?: number };
    }
  | {
      status: 'error';
      input: Record<string, unknown>;
      error: string;
      metadata?: Record<string, unknown>;
      time: { start: number; end: number };
    };

export interface OpenCodePartDto {
  id: string;
  sessionID: string;
  messageID: string;
  type: string;
  text?: string;
  callID?: string;
  tool?: string;
  state?: OpenCodeToolStateDto;
  mime?: string;
  filename?: string;
  url?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface OpenCodeMessageEnvelope {
  info: OpenCodeMessageInfoDto;
  parts: OpenCodePartDto[];
}

export interface OpenCodeDiffDto {
  file?: string;
  patch?: string;
  additions: number;
  deletions: number;
  status?: 'added' | 'deleted' | 'modified';
}

export interface OpenCodePermissionRequestDto {
  id: string;
  sessionID: string;
  permission: string;
  patterns: string[];
  metadata: Record<string, unknown>;
  always: string[];
  tool?: {
    messageID: string;
    callID: string;
  };
}

export interface OpenCodeQuestionOptionDto {
  label: string;
  description: string;
}

export interface OpenCodeQuestionInfoDto {
  question: string;
  header: string;
  options: OpenCodeQuestionOptionDto[];
  multiple?: boolean;
  custom?: boolean;
}

export interface OpenCodeQuestionRequestDto {
  id: string;
  sessionID: string;
  questions: OpenCodeQuestionInfoDto[];
  tool?: {
    messageID: string;
    callID: string;
  };
}

export interface OpenCodeTodoDto {
  content: string;
  status: string;
  priority: string;
}

export interface OpenCodeAgentDto {
  name: string;
  description?: string;
  mode: 'subagent' | 'primary' | 'all' | string;
  native?: boolean;
  hidden?: boolean;
}

export interface OpenCodeProviderModelDto {
  id: string;
  name?: string;
}

export interface OpenCodeProviderDto {
  id: string;
  name: string;
  models: Record<string, OpenCodeProviderModelDto>;
}

export interface OpenCodeProvidersResponse {
  providers: OpenCodeProviderDto[];
  default: Record<string, string>;
}

export interface OpenCodePtyResponse {
  id: string;
  title: string;
  command: string;
  args: string[];
  cwd: string;
  status: 'running' | 'exited';
  pid: number;
  exitCode?: number;
  connectTicket: string;
  expiresIn: number;
}

export interface OpenCodeEventEnvelope {
  id?: string;
  type: string;
  properties?: Record<string, unknown>;
}

export interface OpenCodeVcsInfoDto {
  branch?: string;
  default_branch?: string;
}

export interface OpenCodeVcsFileStatusDto {
  file: string;
  additions: number;
  deletions: number;
  status: 'added' | 'deleted' | 'modified';
}

export interface OpenCodeVcsResponse {
  info: OpenCodeVcsInfoDto;
  status: OpenCodeVcsFileStatusDto[];
  diff: OpenCodeDiffDto[];
}

export interface OpenCodePreviewStatusResponse {
  running: boolean;
  ptyId: string | null;
  port: number | null;
  proxyPath: string | null;
  command: string | null;
  logs: string[];
  availableScripts?: string[];
  recommendedCommand?: string;
}

export interface OpenCodePromptImageAttachment {
  name?: string;
  mime?: string;
  dataUrl: string;
}
