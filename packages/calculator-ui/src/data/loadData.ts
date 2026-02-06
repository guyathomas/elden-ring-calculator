/**
 * Shared data loading utilities for compressed static data files.
 * Handles gzip decompression and MessagePack/JSON parsing.
 */
import { decode as msgpackDecode } from "@msgpack/msgpack";

// In production: use MessagePack (opaque binary, fast parsing)
// In development: use JSON (human-readable for debugging)
export const USE_MSGPACK = !import.meta.env.DEV;

/**
 * Decompress gzipped data using the browser's DecompressionStream API
 * Only needed when the server doesn't set content-encoding: gzip
 */
async function decompressGzipToBytes(response: Response): Promise<ArrayBuffer> {
  const blob = await response.blob();
  const ds = new DecompressionStream("gzip");
  const decompressedStream = blob.stream().pipeThrough(ds);
  const decompressedBlob = await new Response(decompressedStream).blob();
  return decompressedBlob.arrayBuffer();
}

/**
 * Get decompressed bytes from response, handling both pre-decompressed and gzipped responses
 * Vite dev server sends content-encoding: gzip which browser auto-decompresses
 * Production build serves raw .gz files that need manual decompression
 */
export async function getDecompressedBytes(
  response: Response,
): Promise<ArrayBuffer> {
  const contentEncoding = response.headers.get("content-encoding");

  // If server sent content-encoding: gzip, browser already decompressed it
  if (contentEncoding === "gzip") {
    return response.arrayBuffer();
  }

  // Otherwise, manually decompress the gzipped file
  // Clone response in case we need to retry
  const clonedResponse = response.clone();
  try {
    return await decompressGzipToBytes(response);
  } catch {
    // Fallback: server may have decompressed without setting header
    return clonedResponse.arrayBuffer();
  }
}

/**
 * Parse data from decompressed bytes based on format
 */
export function parseData<T>(bytes: ArrayBuffer, isMsgpack: boolean): T {
  if (isMsgpack) {
    return msgpackDecode(new Uint8Array(bytes)) as T;
  }
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text) as T;
}

/**
 * Load a compressed data file (gzip + optional MessagePack).
 * Fetches the appropriate URL based on environment, decompresses, and parses.
 */
export async function loadCompressedData<T>(
  msgpackUrl: string,
  jsonGzippedUrl: string,
): Promise<T> {
  const dataUrl = USE_MSGPACK ? msgpackUrl : jsonGzippedUrl;
  const response = await fetch(dataUrl);

  if (!response.ok) {
    throw new Error(`Failed to load data: ${response.status}`);
  }

  const bytes = await getDecompressedBytes(response);
  return parseData<T>(bytes, USE_MSGPACK);
}
