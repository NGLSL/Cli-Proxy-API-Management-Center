/**
 * 认证文件相关类型
 * 基于原项目 src/modules/auth-files.js
 */

export type AuthFileType =
  | 'qwen'
  | 'kimi'
  | 'gemini'
  | 'gemini-cli'
  | 'aistudio'
  | 'claude'
  | 'codex'
  | 'antigravity'
  | 'vertex'
  | 'empty'
  | 'unknown';

export interface AuthFileItem {
  name: string;
  type?: AuthFileType | string;
  provider?: string;
  size?: number;
  authIndex?: string | number | null;
  runtimeOnly?: boolean | string;
  websockets?: boolean | string;
  disabled?: boolean;
  unavailable?: boolean;
  status?: string;
  statusMessage?: string;
  lastRefresh?: string | number;
  modified?: number;
  [key: string]: unknown;
}

export interface AuthFilesResponse {
  files: AuthFileItem[];
  total?: number;
}

export interface AuthFileBatchFailure {
  name: string;
  error: string;
}

export interface AuthFileBatchSkipped {
  name: string;
  reason: string;
}

export interface AuthFilePatchFieldsPayload {
  name?: string;
  names?: string[];
  all?: boolean;
  disabled?: boolean;
  websockets?: boolean;
  prefix?: string;
  proxy_url?: string;
  headers?: Record<string, string>;
  priority?: number | null;
  note?: string;
}

export interface AuthFilePatchFieldsResponse {
  status?: string;
  updated?: unknown;
  skipped?: unknown;
  failed?: unknown;
}

export interface AuthFilePatchFieldsResult {
  status: string;
  updated: string[];
  skipped: AuthFileBatchSkipped[];
  failed: AuthFileBatchFailure[];
}
