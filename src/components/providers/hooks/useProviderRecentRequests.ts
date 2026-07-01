import { useCallback, useEffect, useState } from 'react';
import { useInterval } from '@/hooks/useInterval';
import { apiKeyUsageApi, usageApi } from '@/services/api';
import { normalizeAuthIndex, normalizeUsageSourceId } from '@/utils/usage';
import {
  normalizeRecentRequestUsageEntry,
  type ApiKeyUsageResponse,
  type RecentRequestBucket,
  type RecentRequestUsageEntry,
} from '@/utils/recentRequests';

const PROVIDER_RECENT_REQUESTS_STALE_TIME_MS = 240_000;
const USAGE_FALLBACK_PROVIDER_KEY = '__usage_fallback__';
const RECENT_REQUEST_BLOCK_COUNT = 20;
const RECENT_REQUEST_BLOCK_DURATION_MS = 10 * 60 * 1000;

export type ProviderRecentRequests = Map<string, Map<string, RecentRequestUsageEntry>>;

export type UseProviderRecentRequestsOptions = {
  enabled?: boolean;
};

const EMPTY_USAGE_BY_PROVIDER: ProviderRecentRequests = new Map();

let cachedUsageByProvider: ProviderRecentRequests = EMPTY_USAGE_BY_PROVIDER;
let cachedAt = 0;
let inFlightRequest: Promise<ProviderRecentRequests> | null = null;

const normalizeProviderKey = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const parseTimestampMs = (value: unknown): number | null => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const createEmptyRecentBuckets = (now: number): RecentRequestBucket[] => {
  const windowStart = now - RECENT_REQUEST_BLOCK_COUNT * RECENT_REQUEST_BLOCK_DURATION_MS;
  return Array.from({ length: RECENT_REQUEST_BLOCK_COUNT }, (_, index) => ({
    time: new Date(windowStart + index * RECENT_REQUEST_BLOCK_DURATION_MS).toISOString(),
    success: 0,
    failed: 0,
  }));
};

const getUsageSnapshotRoot = (payload: unknown): Record<string, unknown> | null => {
  const record = isRecord(payload) ? payload : null;
  if (!record) return null;
  return isRecord(record.usage) ? record.usage : record;
};

const normalizeApiKeyUsageResponse = (payload: ApiKeyUsageResponse): ProviderRecentRequests => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return EMPTY_USAGE_BY_PROVIDER;
  }

  const usageByProvider: ProviderRecentRequests = new Map();

  Object.entries(payload).forEach(([provider, entries]) => {
    const providerKey = normalizeProviderKey(provider);
    if (!providerKey || !entries || typeof entries !== 'object' || Array.isArray(entries)) {
      return;
    }

    const usageByCompositeKey = new Map<string, RecentRequestUsageEntry>();
    Object.entries(entries).forEach(([compositeKey, entry]) => {
      usageByCompositeKey.set(compositeKey, normalizeRecentRequestUsageEntry(entry));
    });

    usageByProvider.set(providerKey, usageByCompositeKey);
  });

  return usageByProvider;
};

const ensureUsageFallbackEntry = (
  usageByCompositeKey: Map<string, RecentRequestUsageEntry>,
  compositeKey: string,
  now: number
): RecentRequestUsageEntry => {
  const existing = usageByCompositeKey.get(compositeKey);
  if (existing) return existing;
  const created: RecentRequestUsageEntry = {
    success: 0,
    failed: 0,
    recentRequests: createEmptyRecentBuckets(now),
  };
  usageByCompositeKey.set(compositeKey, created);
  return created;
};

const addUsageFallbackDetail = (
  usageByCompositeKey: Map<string, RecentRequestUsageEntry>,
  compositeKey: string,
  failed: boolean,
  timestampMs: number | null,
  now: number
) => {
  const entry = ensureUsageFallbackEntry(usageByCompositeKey, compositeKey, now);
  if (failed) {
    entry.failed += 1;
  } else {
    entry.success += 1;
  }

  if (timestampMs === null) return;
  const windowStart = now - RECENT_REQUEST_BLOCK_COUNT * RECENT_REQUEST_BLOCK_DURATION_MS;
  const bucketIndex = Math.floor((timestampMs - windowStart) / RECENT_REQUEST_BLOCK_DURATION_MS);
  if (bucketIndex < 0 || bucketIndex >= RECENT_REQUEST_BLOCK_COUNT) return;

  const bucket = entry.recentRequests[bucketIndex];
  if (!bucket) return;
  if (failed) {
    bucket.failed += 1;
  } else {
    bucket.success += 1;
  }
};

const normalizeUsageFallbackResponse = (
  payload: unknown,
  now = Date.now()
): ProviderRecentRequests => {
  const usageRoot = getUsageSnapshotRoot(payload);
  const apis = isRecord(usageRoot?.apis) ? usageRoot.apis : null;
  if (!apis) return EMPTY_USAGE_BY_PROVIDER;

  const usageByCompositeKey = new Map<string, RecentRequestUsageEntry>();

  Object.values(apis).forEach((apiEntry) => {
    if (!isRecord(apiEntry) || !isRecord(apiEntry.models)) return;

    Object.values(apiEntry.models).forEach((modelEntry) => {
      if (!isRecord(modelEntry) || !Array.isArray(modelEntry.details)) return;

      modelEntry.details.forEach((detail) => {
        if (!isRecord(detail)) return;
        const candidateKeys = new Set<string>();
        const sourceKey = normalizeUsageSourceId(detail.source);
        const authIndexKey = normalizeAuthIndex(detail.auth_index);
        if (sourceKey) candidateKeys.add(sourceKey);
        if (authIndexKey) candidateKeys.add(authIndexKey);
        if (candidateKeys.size === 0) return;

        const failed = detail.failed === true;
        const timestampMs = parseTimestampMs(detail.timestamp);
        candidateKeys.forEach((candidateKey) =>
          addUsageFallbackDetail(usageByCompositeKey, candidateKey, failed, timestampMs, now)
        );
      });
    });
  });

  if (usageByCompositeKey.size === 0) {
    return EMPTY_USAGE_BY_PROVIDER;
  }

  const usageByProvider: ProviderRecentRequests = new Map();
  usageByProvider.set(USAGE_FALLBACK_PROVIDER_KEY, usageByCompositeKey);
  return usageByProvider;
};

const mergeProviderRecentRequests = (
  primary: ProviderRecentRequests,
  fallback: ProviderRecentRequests
): ProviderRecentRequests => {
  if (fallback.size === 0) return primary;
  if (primary.size === 0) return fallback;

  const merged: ProviderRecentRequests = new Map(primary);
  fallback.forEach((fallbackEntries, provider) => {
    const providerKey = normalizeProviderKey(provider);
    const nextEntries = new Map(merged.get(providerKey) ?? []);
    fallbackEntries.forEach((entry, compositeKey) => {
      if (!nextEntries.has(compositeKey)) {
        nextEntries.set(compositeKey, entry);
      }
    });
    merged.set(providerKey, nextEntries);
  });
  return merged;
};

const fetchProviderRecentRequests = async (): Promise<ProviderRecentRequests> => {
  if (!inFlightRequest) {
    inFlightRequest = Promise.allSettled([apiKeyUsageApi.getUsage(), usageApi.getUsage()])
      .then(([apiKeyUsageResult, usageResult]) => {
        if (apiKeyUsageResult.status === 'rejected' && usageResult.status === 'rejected') {
          throw apiKeyUsageResult.reason;
        }
        const primary =
          apiKeyUsageResult.status === 'fulfilled'
            ? normalizeApiKeyUsageResponse(apiKeyUsageResult.value)
            : EMPTY_USAGE_BY_PROVIDER;
        // `/api-key-usage` 是主数据源；`/usage` 只作为历史/裁剪场景的补洞来源。
        const fallback =
          usageResult.status === 'fulfilled'
            ? normalizeUsageFallbackResponse(usageResult.value)
            : EMPTY_USAGE_BY_PROVIDER;
        const merged = mergeProviderRecentRequests(primary, fallback);
        cachedUsageByProvider = merged;
        cachedAt = Date.now();
        return merged;
      })
      .finally(() => {
        inFlightRequest = null;
      });
  }

  return inFlightRequest;
};

export function useProviderRecentRequests(options: UseProviderRecentRequestsOptions = {}) {
  const enabled = options.enabled ?? true;
  const [usageByProvider, setUsageByProvider] =
    useState<ProviderRecentRequests>(cachedUsageByProvider);
  const [isLoading, setIsLoading] = useState(false);

  const loadRecentRequests = useCallback(
    async (loadOptions: { force?: boolean } = {}) => {
      if (!enabled) {
        return EMPTY_USAGE_BY_PROVIDER;
      }

      const hasFreshCache =
        cachedAt > 0 && Date.now() - cachedAt < PROVIDER_RECENT_REQUESTS_STALE_TIME_MS;

      if (!loadOptions.force && hasFreshCache) {
        setUsageByProvider(cachedUsageByProvider);
        return cachedUsageByProvider;
      }

      setIsLoading(true);
      try {
        const nextUsage = await fetchProviderRecentRequests();
        setUsageByProvider(nextUsage);
        return nextUsage;
      } catch {
        if (cachedAt > 0) {
          setUsageByProvider(cachedUsageByProvider);
        }
        return cachedUsageByProvider;
      } finally {
        setIsLoading(false);
      }
    },
    [enabled]
  );

  const refreshRecentRequests = useCallback(
    async () => loadRecentRequests({ force: true }),
    [loadRecentRequests]
  );

  useEffect(() => {
    if (!enabled) {
      setUsageByProvider(EMPTY_USAGE_BY_PROVIDER);
      return;
    }
    void loadRecentRequests().catch(() => {});
  }, [enabled, loadRecentRequests]);

  useInterval(
    () => {
      void refreshRecentRequests().catch(() => {});
    },
    enabled ? PROVIDER_RECENT_REQUESTS_STALE_TIME_MS : null
  );

  return {
    usageByProvider: enabled ? usageByProvider : EMPTY_USAGE_BY_PROVIDER,
    isLoading: enabled ? isLoading : false,
    loadRecentRequests,
    refreshRecentRequests,
  };
}
