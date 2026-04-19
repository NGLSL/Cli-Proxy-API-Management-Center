import { useCallback, useMemo } from 'react';
import { collectUsageDetails, extractTotalTokens } from '@/utils/usage';
import type { UsagePayload } from './useUsageData';

export interface SparklineData {
  labels: string[];
  datasets: [
    {
      data: number[];
      borderColor: string;
      backgroundColor: string;
      fill: boolean;
      tension: number;
      pointRadius: number;
      borderWidth: number;
    }
  ];
}

export interface SparklineBundle {
  data: SparklineData;
}

export interface UseSparklinesOptions {
  usage: UsagePayload | null;
  loading: boolean;
  nowMs: number;
}

export interface UseSparklinesReturn {
  requestsSparkline: SparklineBundle | null;
  tokensSparkline: SparklineBundle | null;
  rpmSparkline: SparklineBundle | null;
  tpmSparkline: SparklineBundle | null;
  costSparkline: SparklineBundle | null;
  chunksSparkline: SparklineBundle | null;
  trafficSparkline: SparklineBundle | null;
}

export function useSparklines({ usage, loading, nowMs }: UseSparklinesOptions): UseSparklinesReturn {
  const lastHourSeries = useMemo(() => {
    if (!usage) {
      return {
        labels: [],
        requests: [],
        tokens: [],
        chunks: [],
        traffic: []
      };
    }
    const details = collectUsageDetails(usage);
    if (!details.length) {
      return {
        labels: [],
        requests: [],
        tokens: [],
        chunks: [],
        traffic: []
      };
    }

    const minTimestamp = details.reduce((min, detail) => {
      const timestamp = detail.__timestampMs ?? 0;
      return Number.isFinite(timestamp) && timestamp > 0 ? Math.min(min, timestamp) : min;
    }, Number.POSITIVE_INFINITY);
    const maxTimestamp = details.reduce((max, detail) => {
      const timestamp = detail.__timestampMs ?? 0;
      return Number.isFinite(timestamp) && timestamp > 0 ? Math.max(max, timestamp) : max;
    }, 0);
    const fallbackNow = Number.isFinite(nowMs) && nowMs > 0 ? nowMs : 0;
    const windowEnd = maxTimestamp > 0 ? maxTimestamp : fallbackNow;
    if (!Number.isFinite(minTimestamp) || minTimestamp <= 0 || !Number.isFinite(windowEnd) || windowEnd <= 0) {
      return {
        labels: [],
        requests: [],
        tokens: [],
        chunks: [],
        traffic: []
      };
    }

    const maxBuckets = 60;
    const spanMs = Math.max(1, windowEnd - minTimestamp + 1);
    const bucketMs = Math.max(60000, Math.ceil(spanMs / maxBuckets));
    const bucketCount = Math.max(1, Math.min(maxBuckets, Math.ceil(spanMs / bucketMs)));
    const windowStart = windowEnd - bucketMs * bucketCount;
    const requestBuckets = new Array(bucketCount).fill(0);
    const tokenBuckets = new Array(bucketCount).fill(0);
    const chunkBuckets = new Array(bucketCount).fill(0);
    const trafficBuckets = new Array(bucketCount).fill(0);

    details.forEach((detail) => {
      const timestamp = detail.__timestampMs ?? 0;
      if (!Number.isFinite(timestamp) || timestamp < windowStart || timestamp > windowEnd) {
        return;
      }
      const bucketIndex = Math.min(
        bucketCount - 1,
        Math.max(0, Math.floor((timestamp - windowStart) / bucketMs))
      );
      requestBuckets[bucketIndex] += 1;
      tokenBuckets[bucketIndex] += extractTotalTokens(detail);
      chunkBuckets[bucketIndex] +=
        typeof detail.chunk_count === 'number' && Number.isFinite(detail.chunk_count)
          ? Math.max(detail.chunk_count, 0)
          : 0;
      const responseBytes =
        typeof detail.response_bytes === 'number' && Number.isFinite(detail.response_bytes)
          ? Math.max(detail.response_bytes, 0)
          : 0;
      const apiResponseBytes =
        typeof detail.api_response_bytes === 'number' && Number.isFinite(detail.api_response_bytes)
          ? Math.max(detail.api_response_bytes, 0)
          : 0;
      trafficBuckets[bucketIndex] += responseBytes + apiResponseBytes;
    });

    const labels = requestBuckets.map((_, idx) => {
      const date = new Date(windowStart + (idx + 1) * bucketMs);
      const h = date.getHours().toString().padStart(2, '0');
      const m = date.getMinutes().toString().padStart(2, '0');
      return `${h}:${m}`;
    });

    return {
      labels,
      requests: requestBuckets,
      tokens: tokenBuckets,
      chunks: chunkBuckets,
      traffic: trafficBuckets
    };
  }, [nowMs, usage]);

  const buildSparkline = useCallback(
    (
      series: { labels: string[]; data: number[] },
      color: string,
      backgroundColor: string
    ): SparklineBundle | null => {
      if (loading || !series?.data?.length) {
        return null;
      }
      const sliceStart = Math.max(series.data.length - 60, 0);
      const labels = series.labels.slice(sliceStart);
      const points = series.data.slice(sliceStart);
      return {
        data: {
          labels,
          datasets: [
            {
              data: points,
              borderColor: color,
              backgroundColor,
              fill: true,
              tension: 0.45,
              pointRadius: 0,
              borderWidth: 2
            }
          ]
        }
      };
    },
    [loading]
  );

  const requestsSparkline = useMemo(
    () =>
      buildSparkline(
        { labels: lastHourSeries.labels, data: lastHourSeries.requests },
        '#8b8680',
        'rgba(139, 134, 128, 0.18)'
      ),
    [buildSparkline, lastHourSeries.labels, lastHourSeries.requests]
  );

  const tokensSparkline = useMemo(
    () =>
      buildSparkline(
        { labels: lastHourSeries.labels, data: lastHourSeries.tokens },
        '#8b5cf6',
        'rgba(139, 92, 246, 0.18)'
      ),
    [buildSparkline, lastHourSeries.labels, lastHourSeries.tokens]
  );

  const rpmSparkline = useMemo(
    () =>
      buildSparkline(
        { labels: lastHourSeries.labels, data: lastHourSeries.requests },
        '#22c55e',
        'rgba(34, 197, 94, 0.18)'
      ),
    [buildSparkline, lastHourSeries.labels, lastHourSeries.requests]
  );

  const tpmSparkline = useMemo(
    () =>
      buildSparkline(
        { labels: lastHourSeries.labels, data: lastHourSeries.tokens },
        '#f97316',
        'rgba(249, 115, 22, 0.18)'
      ),
    [buildSparkline, lastHourSeries.labels, lastHourSeries.tokens]
  );

  const costSparkline = useMemo(
    () =>
      buildSparkline(
        { labels: lastHourSeries.labels, data: lastHourSeries.tokens },
        '#f59e0b',
        'rgba(245, 158, 11, 0.18)'
      ),
    [buildSparkline, lastHourSeries.labels, lastHourSeries.tokens]
  );

  const chunksSparkline = useMemo(
    () =>
      buildSparkline(
        { labels: lastHourSeries.labels, data: lastHourSeries.chunks },
        '#0ea5e9',
        'rgba(14, 165, 233, 0.18)'
      ),
    [buildSparkline, lastHourSeries.chunks, lastHourSeries.labels]
  );

  const trafficSparkline = useMemo(
    () =>
      buildSparkline(
        { labels: lastHourSeries.labels, data: lastHourSeries.traffic },
        '#14b8a6',
        'rgba(20, 184, 166, 0.18)'
      ),
    [buildSparkline, lastHourSeries.labels, lastHourSeries.traffic]
  );

  return {
    requestsSparkline,
    tokensSparkline,
    rpmSparkline,
    tpmSparkline,
    costSparkline,
    chunksSparkline,
    trafficSparkline
  };
}
