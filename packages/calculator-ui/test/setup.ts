// Vitest setup file for React component testing
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'fs';
import { gunzipSync } from 'zlib';
import { join } from 'path';

// Mock window.matchMedia for components that use responsive hooks
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock fetch for Node.js environment
// The data loading functions in src/data/index.ts use fetch() with relative URLs
// that work in the browser but fail in Node.js. This mock intercepts those calls
// and loads from the filesystem instead.
//
// Additionally, DecompressionStream (used for gzip decompression) is a browser-only
// API, so we decompress the content here and set content-encoding: gzip to signal
// that the content is already decompressed.
const originalFetch = globalThis.fetch;

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  // Handle relative URLs that point to gzipped data files
  if (url.startsWith('/src/data/') && url.endsWith('.gz')) {
    try {
      // Convert /src/data/file.gz to actual filesystem path
      const relativePath = url.replace('/src/data/', '');
      const filePath = join(__dirname, '../src/data', relativePath);
      const compressedContent = readFileSync(filePath);

      // Decompress the gzipped content using Node.js zlib
      const decompressedContent = gunzipSync(compressedContent);

      // Return decompressed content with content-encoding: gzip header
      // This signals to the data loader that the content is already decompressed
      return new Response(decompressedContent, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'content-encoding': 'gzip',
        },
      });
    } catch (error) {
      return new Response(null, { status: 404, statusText: 'Not Found' });
    }
  }

  // Fall back to original fetch for other URLs
  return originalFetch(input, init);
};
