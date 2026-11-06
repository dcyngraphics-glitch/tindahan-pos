import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';

// happy-dom ships no IndexedDB; fake-indexeddb provides a working shim so the
// real IndexedDB-backed services (products, db) can run under vitest.
if (typeof globalThis.indexedDB === 'undefined') {
  (globalThis as any).indexedDB = indexedDB;
}
if (typeof globalThis.IDBKeyRange === 'undefined') {
  (globalThis as any).IDBKeyRange = IDBKeyRange;
}
if (typeof globalThis.IDBObjectStore !== 'undefined') {
  // no-op guard kept minimal
}

// Clear the DOM between tests so no leftover nodes leak across cases.
afterEach(() => {
  cleanup();
});
