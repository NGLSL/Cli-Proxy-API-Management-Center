/**
 * Quota management page - coordinates the quota sections.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { useAuthStore, useQuotaStore } from '@/stores';
import { authFilesApi, configFileApi, quotaCacheApi } from '@/services/api';
import {
  QuotaSection,
  ANTIGRAVITY_CONFIG,
  CLAUDE_CONFIG,
  CODEX_CONFIG,
  GEMINI_CLI_CONFIG,
  KIMI_CONFIG,
  buildQuotaStoresFromSnapshot,
} from '@/components/quota';
import type { AuthFileItem } from '@/types';
import styles from './QuotaPage.module.scss';

export function QuotaPage() {
  const { t } = useTranslation();
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const setAntigravityQuota = useQuotaStore((state) => state.setAntigravityQuota);
  const setClaudeQuota = useQuotaStore((state) => state.setClaudeQuota);
  const setCodexQuota = useQuotaStore((state) => state.setCodexQuota);
  const setGeminiCliQuota = useQuotaStore((state) => state.setGeminiCliQuota);
  const setKimiQuota = useQuotaStore((state) => state.setKimiQuota);

  const [files, setFiles] = useState<AuthFileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const disableControls = connectionStatus !== 'connected';

  const hydrateQuotaSnapshot = useCallback(async () => {
    const snapshot = await quotaCacheApi.getSnapshot();
    const stores = buildQuotaStoresFromSnapshot(snapshot, t);
    setAntigravityQuota(stores.antigravityQuota);
    setClaudeQuota(stores.claudeQuota);
    setCodexQuota(stores.codexQuota);
    setGeminiCliQuota(stores.geminiCliQuota);
    setKimiQuota(stores.kimiQuota);
  }, [setAntigravityQuota, setClaudeQuota, setCodexQuota, setGeminiCliQuota, setKimiQuota, t]);

  const loadConfig = useCallback(async () => {
    try {
      await configFileApi.fetchConfigYaml();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t('notification.refresh_failed');
      setError((prev) => prev || errorMessage);
    }
  }, [t]);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await authFilesApi.list();
      setFiles(data?.files || []);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t('notification.refresh_failed');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadQuotaSnapshot = useCallback(async () => {
    try {
      await hydrateQuotaSnapshot();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t('notification.refresh_failed');
      setError((prev) => prev || errorMessage);
    }
  }, [hydrateQuotaSnapshot, t]);

  const handleHeaderRefresh = useCallback(async () => {
    await Promise.all([loadConfig(), loadFiles(), loadQuotaSnapshot()]);
  }, [loadConfig, loadFiles, loadQuotaSnapshot]);

  useHeaderRefresh(handleHeaderRefresh);

  useEffect(() => {
    void handleHeaderRefresh();
  }, [handleHeaderRefresh]);

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t('quota_management.title')}</h1>
        <p className={styles.description}>{t('quota_management.description')}</p>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      <QuotaSection
        config={CLAUDE_CONFIG}
        files={files}
        loading={loading}
        disabled={disableControls}
      />
      <QuotaSection
        config={ANTIGRAVITY_CONFIG}
        files={files}
        loading={loading}
        disabled={disableControls}
      />
      <QuotaSection
        config={CODEX_CONFIG}
        files={files}
        loading={loading}
        disabled={disableControls}
      />
      <QuotaSection
        config={GEMINI_CLI_CONFIG}
        files={files}
        loading={loading}
        disabled={disableControls}
      />
      <QuotaSection
        config={KIMI_CONFIG}
        files={files}
        loading={loading}
        disabled={disableControls}
      />
    </div>
  );
}
