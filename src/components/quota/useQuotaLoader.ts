/**
 * 通用 quota cache 刷新与状态管理 hook。
 */

import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { AuthFileItem, QuotaCacheEntry } from '@/types';
import { quotaCacheApi } from '@/services/api';
import { useQuotaStore } from '@/stores';
import { getStatusFromError } from '@/utils/quota';
import { normalizeAuthIndex } from '@/utils/usage';
import type { QuotaConfig } from './quotaConfigs';
import { buildQuotaStateMapFromEntries } from './quotaConfigs';

type QuotaScope = 'page' | 'all';

type QuotaUpdater<T> = T | ((prev: T) => T);

type QuotaSetter<T> = (updater: QuotaUpdater<T>) => void;

interface RefreshTargetGroups {
  validTargets: AuthFileItem[];
  invalidTargets: AuthFileItem[];
  authIndexes: string[];
}

/**
 * 按 auth_index 拆分可刷新的目标，避免缺失索引时误触发后端全量刷新。
 */
const splitRefreshTargets = (targets: AuthFileItem[]): RefreshTargetGroups => {
  const seen = new Set<string>();
  const authIndexes: string[] = [];
  const validTargets: AuthFileItem[] = [];
  const invalidTargets: AuthFileItem[] = [];

  targets.forEach((file) => {
    const authIndex = normalizeAuthIndex(file['auth_index'] ?? file.authIndex);
    if (!authIndex) {
      invalidTargets.push(file);
      return;
    }

    validTargets.push(file);
    if (seen.has(authIndex)) return;
    seen.add(authIndex);
    authIndexes.push(authIndex);
  });

  return { validTargets, invalidTargets, authIndexes };
};

export function useQuotaLoader<TState extends object, TData>(config: QuotaConfig<TState, TData>) {
  const { t } = useTranslation();
  const quota = useQuotaStore(config.storeSelector);
  const setQuota = useQuotaStore((state) => state[config.storeSetter]) as QuotaSetter<
    Record<string, TState>
  >;

  const loadingRef = useRef(false);
  const requestIdRef = useRef(0);

  const loadQuota = useCallback(
    async (
      targets: AuthFileItem[],
      scope: QuotaScope,
      setLoading: (loading: boolean, scope?: QuotaScope | null) => void
    ) => {
      if (loadingRef.current) return;
      if (targets.length === 0) return;

      const { validTargets, invalidTargets, authIndexes } = splitRefreshTargets(targets);
      const missingAuthIndexMessage = t(`${config.i18nPrefix}.missing_auth_index`);
      const invalidTargetState = invalidTargets.reduce<Record<string, TState>>((result, file) => {
        result[file.name] = config.buildErrorState(missingAuthIndexMessage);
        return result;
      }, {});

      loadingRef.current = true;
      const requestId = ++requestIdRef.current;
      setLoading(true, scope);

      try {
        setQuota((prev) => {
          const nextState = { ...prev, ...invalidTargetState };
          validTargets.forEach((file) => {
            nextState[file.name] = config.buildLoadingState();
          });
          return nextState;
        });

        if (validTargets.length === 0 || authIndexes.length === 0) {
          throw new Error(missingAuthIndexMessage);
        }

        const response = await quotaCacheApi.refresh({
          auth_indexes: authIndexes,
          force: true
        });

        if (requestId !== requestIdRef.current) return;

        const entries = Array.isArray(response.entries) ? (response.entries as QuotaCacheEntry[]) : [];
        const nextState = {
          ...invalidTargetState,
          ...buildQuotaStateMapFromEntries(config, validTargets, entries, t)
        };
        setQuota((prev) => ({ ...prev, ...nextState }));
      } catch (err: unknown) {
        if (requestId === requestIdRef.current) {
          const message = err instanceof Error ? err.message : t('common.unknown_error');
          const status = getStatusFromError(err);
          const errorState = { ...invalidTargetState };

          validTargets.forEach((file) => {
            errorState[file.name] = config.buildErrorState(message, status);
          });

          setQuota((prev) => ({ ...prev, ...errorState }));
        }
        throw err;
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          loadingRef.current = false;
        }
      }
    },
    [config, setQuota, t]
  );

  return { quota, loadQuota };
}
