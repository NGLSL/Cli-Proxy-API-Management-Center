import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VisualConfigEditor } from './VisualConfigEditor';
import { DEFAULT_VISUAL_VALUES } from '@/types/visualConfig';

describe('VisualConfigEditor', () => {
  it('emits routingSourcePreference when the source layer changes', () => {
    const onChange = vi.fn();

    render(<VisualConfigEditor values={DEFAULT_VISUAL_VALUES} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /Source Preference/i }));
    fireEvent.click(screen.getByRole('option', { name: /Prefer API configuration/i }));

    expect(onChange).toHaveBeenCalledWith({ routingSourcePreference: 'api-first' });
  });
});
