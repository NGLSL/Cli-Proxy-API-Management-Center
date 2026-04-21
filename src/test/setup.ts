import '@/i18n';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import i18n from 'i18next';
import { afterEach, beforeAll, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

beforeAll(async () => {
  await i18n.changeLanguage('en');
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock);

Object.defineProperty(window, 'requestAnimationFrame', {
  writable: true,
  value: (callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(performance.now()), 0),
});

Object.defineProperty(window, 'cancelAnimationFrame', {
  writable: true,
  value: (id: number) => window.clearTimeout(id),
});

Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  writable: true,
  value: vi.fn(),
});

Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
  writable: true,
  value: () => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 240,
    bottom: 40,
    width: 240,
    height: 40,
    toJSON() {
      return {};
    },
  }),
});
