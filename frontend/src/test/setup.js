/** Isolate DOM and browser-local state for every identity test. */
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});
