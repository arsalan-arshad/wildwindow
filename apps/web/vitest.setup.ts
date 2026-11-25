import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

class IntersectionObserverStub implements IntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin = '';
  readonly thresholds: ReadonlyArray<number> = [];
  constructor(private readonly callback: IntersectionObserverCallback) {}
  disconnect(): void {}
  observe(): void {
    const entry = {
      isIntersecting: true,
      target: document.body,
      boundingClientRect: DOMRectReadOnly.fromRect(),
      intersectionRatio: 1,
      intersectionRect: DOMRectReadOnly.fromRect(),
      rootBounds: null,
      time: 0,
    } satisfies IntersectionObserverEntry;
    this.callback([entry], this);
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  unobserve(): void {}
}

vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});
