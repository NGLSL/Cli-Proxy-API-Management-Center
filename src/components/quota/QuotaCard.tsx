/**
 * 通用 quota 卡片组件。
 */

import { useTranslation } from 'react-i18next';
import type { ReactElement, ReactNode } from 'react';
import type { TFunction } from 'i18next';
import type {
  AuthFileItem,
  QuotaCacheStatus,
  QuotaStateBase,
  ResolvedTheme,
  ThemeColors
} from '@/types';
import { formatQuotaResetTime, TYPE_COLORS } from '@/utils/quota';
import styles from '@/pages/QuotaPage.module.scss';

export type QuotaStatusState = QuotaStateBase;

export interface QuotaProgressBarProps {
  percent: number | null;
  highThreshold: number;
  mediumThreshold: number;
}

export function QuotaProgressBar({
  percent,
  highThreshold,
  mediumThreshold
}: QuotaProgressBarProps) {
  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));
  const normalized = percent === null ? null : clamp(percent, 0, 100);
  const fillClass =
    normalized === null
      ? styles.quotaBarFillMedium
      : normalized >= highThreshold
        ? styles.quotaBarFillHigh
        : normalized >= mediumThreshold
          ? styles.quotaBarFillMedium
          : styles.quotaBarFillLow;
  const widthPercent = Math.round(normalized ?? 0);

  return (
    <div className={styles.quotaBar}>
      <div
        className={`${styles.quotaBarFill} ${fillClass}`}
        style={{ width: `${widthPercent}%` }}
      />
    </div>
  );
}

export interface QuotaRenderHelpers {
  styles: typeof styles;
  QuotaProgressBar: (props: QuotaProgressBarProps) => ReactElement;
}

interface QuotaCardProps<TState extends QuotaStatusState> {
  item: AuthFileItem;
  quota?: TState;
  resolvedTheme: ResolvedTheme;
  i18nPrefix: string;
  cardIdleMessageKey?: string;
  cardClassName: string;
  defaultType: string;
  canRefresh?: boolean;
  onRefresh?: () => void;
  renderQuotaItems: (quota: TState, t: TFunction, helpers: QuotaRenderHelpers) => ReactNode;
}

/**
 * 根据后端缓存状态选择对应的徽标样式，方便在卡片底部统一展示缓存健康度。
 */
const resolveCacheStatusClassName = (status: QuotaCacheStatus): string => {
  switch (status) {
    case 'fresh':
      return styles.quotaCacheBadgeFresh;
    case 'refreshing':
      return styles.quotaCacheBadgeRefreshing;
    case 'rate_limited':
      return styles.quotaCacheBadgeRateLimited;
    case 'unauthorized':
      return styles.quotaCacheBadgeUnauthorized;
    case 'error':
      return styles.quotaCacheBadgeError;
    case 'pending':
      return styles.quotaCacheBadgePending;
    default:
      return '';
  }
};

export function QuotaCard<TState extends QuotaStatusState>({
  item,
  quota,
  resolvedTheme,
  i18nPrefix,
  cardIdleMessageKey,
  cardClassName,
  defaultType,
  canRefresh = false,
  onRefresh,
  renderQuotaItems
}: QuotaCardProps<TState>) {
  const { t } = useTranslation();

  const displayType = item.type || item.provider || defaultType;
  const typeColorSet = TYPE_COLORS[displayType] || TYPE_COLORS.unknown;
  const typeColor: ThemeColors =
    resolvedTheme === 'dark' && typeColorSet.dark ? typeColorSet.dark : typeColorSet.light;

  const quotaStatus = quota?.status ?? 'idle';
  const quotaErrorMessage = resolveQuotaErrorMessage(
    t,
    quota?.errorStatus,
    quota?.error || t('common.unknown_error')
  );
  const idleMessageKey = onRefresh ? `${i18nPrefix}.idle` : (cardIdleMessageKey ?? `${i18nPrefix}.idle`);
  const cacheStatus = quota?.cacheStatus;
  const cacheStatusLabel = cacheStatus ? t(`quota_management.cache_status_${cacheStatus}`) : null;
  const lastRefreshLabel = quota?.lastRefreshAt ? formatQuotaResetTime(quota.lastRefreshAt) : null;
  const quotaRecoverLabel = quota?.quotaRecoverAt ? formatQuotaResetTime(quota.quotaRecoverAt) : null;
  const showCacheMeta = Boolean(cacheStatusLabel || lastRefreshLabel || quotaRecoverLabel);

  const getTypeLabel = (type: string): string => {
    const key = `auth_files.filter_${type}`;
    const translated = t(key);
    if (translated !== key) return translated;
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <div className={`${styles.fileCard} ${cardClassName}`}>
      <div className={styles.cardHeader}>
        <span
          className={styles.typeBadge}
          style={{
            backgroundColor: typeColor.bg,
            color: typeColor.text,
            ...(typeColor.border ? { border: typeColor.border } : {})
          }}
        >
          {getTypeLabel(displayType)}
        </span>
        <span className={styles.fileName}>{item.name}</span>
      </div>

      <div className={styles.quotaSection}>
        {quotaStatus === 'loading' ? (
          <div className={styles.quotaMessage}>{t(`${i18nPrefix}.loading`)}</div>
        ) : quotaStatus === 'idle' ? (
          onRefresh ? (
            <button
              type="button"
              className={`${styles.quotaMessage} ${styles.quotaMessageAction}`}
              onClick={onRefresh}
              disabled={!canRefresh}
            >
              {t(idleMessageKey)}
            </button>
          ) : (
            <div className={styles.quotaMessage}>{t(idleMessageKey)}</div>
          )
        ) : quotaStatus === 'error' ? (
          <div className={styles.quotaError}>
            {t(`${i18nPrefix}.load_failed`, {
              message: quotaErrorMessage
            })}
          </div>
        ) : quota ? (
          renderQuotaItems(quota, t, { styles, QuotaProgressBar })
        ) : (
          <div className={styles.quotaMessage}>{t(idleMessageKey)}</div>
        )}
      </div>

      {showCacheMeta && (
        <div className={styles.quotaCacheMeta}>
          {cacheStatusLabel && cacheStatus && (
            <div className={styles.quotaCacheItem}>
              <span className={styles.quotaCacheLabel}>{t('quota_management.cache_status_label')}</span>
              <span
                className={`${styles.quotaCacheBadge} ${resolveCacheStatusClassName(cacheStatus)}`}
              >
                {cacheStatusLabel}
              </span>
            </div>
          )}
          {lastRefreshLabel && (
            <div className={styles.quotaCacheItem}>
              <span className={styles.quotaCacheLabel}>{t('quota_management.last_refresh')}</span>
              <span className={styles.quotaCacheValue}>{lastRefreshLabel}</span>
            </div>
          )}
          {quotaRecoverLabel && (
            <div className={styles.quotaCacheItem}>
              <span className={styles.quotaCacheLabel}>{t('quota_management.quota_recover_at')}</span>
              <span className={styles.quotaCacheValue}>{quotaRecoverLabel}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const resolveQuotaErrorMessage = (
  t: TFunction,
  status: number | undefined,
  fallback: string
): string => {
  if (status === 404) return t('common.quota_update_required');
  if (status === 403) return t('common.quota_check_credential');
  return fallback;
};
