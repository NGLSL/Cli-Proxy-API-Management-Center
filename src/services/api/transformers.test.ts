import { describe, expect, it } from 'vitest';
import { normalizeConfigResponse } from './transformers';

describe('normalizeConfigResponse', () => {
  it('defaults missing routing source preference to none', () => {
    const config = normalizeConfigResponse({ routing: { strategy: 'round-robin' } });
    expect(config.routingSourcePreference).toBe('none');
  });

  it('normalizes valid routing source preference values', () => {
    const config = normalizeConfigResponse({
      routing: {
        'source-preference': 'file-first',
      },
    });

    expect(config.routingSourcePreference).toBe('file-first');
  });

  it('normalizes invalid routing source preference values to none', () => {
    const config = normalizeConfigResponse({
      routing: {
        'source-preference': 'unexpected',
      },
    });

    expect(config.routingSourcePreference).toBe('none');
  });
});
