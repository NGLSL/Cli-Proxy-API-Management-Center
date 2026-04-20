/**
 * Quota cache API wrappers.
 */

import type {
  QuotaCacheRefreshRequest,
  QuotaCacheRefreshResponse,
  QuotaCacheSnapshot,
} from '@/types';
import { apiClient } from './client';

const normalizeAuthIndexes = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const normalized: string[] = [];
  value.forEach((item) => {
    const text = String(item ?? '').trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    normalized.push(text);
  });
  return normalized;
};

const normalizeRefreshRequest = (
  request: QuotaCacheRefreshRequest
): QuotaCacheRefreshRequest => {
  const authIndexes = normalizeAuthIndexes(request.auth_indexes);
  return {
    ...(authIndexes.length > 0 ? { auth_indexes: authIndexes } : {}),
    force: Boolean(request.force),
  };
};

export const quotaCacheApi = {
  getSnapshot: async () => apiClient.get<QuotaCacheSnapshot>('/quota-cache'),

  refresh: async (request: QuotaCacheRefreshRequest) =>
    apiClient.post<QuotaCacheRefreshResponse>(
      '/quota-cache/refresh',
      normalizeRefreshRequest(request)
    ),
};
