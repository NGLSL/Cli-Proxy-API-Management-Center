import { act, renderHook } from '@testing-library/react';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { useVisualConfig } from './useVisualConfig';

describe('useVisualConfig', () => {
  it('defaults missing routing source preference to none', () => {
    const { result } = renderHook(() => useVisualConfig());

    act(() => {
      result.current.loadVisualValuesFromYaml('routing:\n  strategy: round-robin\n');
    });

    expect(result.current.visualValues.routingSourcePreference).toBe('none');
  });

  it('writes and removes routing.source-preference', () => {
    const { result } = renderHook(() => useVisualConfig());

    act(() => {
      result.current.loadVisualValuesFromYaml('routing:\n  strategy: round-robin\n');
      result.current.setVisualValues({ routingSourcePreference: 'api-first' });
    });

    const withPreference = result.current.applyVisualChangesToYaml(
      'routing:\n  strategy: round-robin\n'
    );
    expect(
      (parse(withPreference) as { routing?: Record<string, string> }).routing?.[
        'source-preference'
      ]
    ).toBe('api-first');

    act(() => {
      result.current.setVisualValues({ routingSourcePreference: 'none' });
    });

    const withoutPreference = result.current.applyVisualChangesToYaml(withPreference);
    expect(
      (parse(withoutPreference) as { routing?: Record<string, string> }).routing?.[
        'source-preference'
      ]
    ).toBeUndefined();
  });
});
