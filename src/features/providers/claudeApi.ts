import type { ProviderKeyConfig } from '@/types';

export const CLAUDE_API_DISPLAY_NAME = 'ClaudeAPI';
export const CLAUDE_API_BASE_URL = 'https://gw.claudeapi.com';
// CPA 不在管理页面或构建产物中分发供应商返利注册链接。
export const CLAUDE_API_AFFILIATE_URL = '';

const normalizeBaseUrl = (value: string | undefined | null): string =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\/+$/, '');

export const isClaudeApiProvider = (
  config: ProviderKeyConfig | undefined | null
): boolean => {
  if (!config) return false;
  return normalizeBaseUrl(config.baseUrl) === normalizeBaseUrl(CLAUDE_API_BASE_URL);
};
