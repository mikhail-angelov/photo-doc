export type ProgressEvent = {
  label: string;
  detail?: string;
  current?: number;
  total?: number;
  percent?: number;
};

export type ProgressCallback = (event: ProgressEvent) => void;

const memoryCache = new Map<string, Promise<Uint8Array>>();

export async function fetchUint8WithProgress(
  url: string,
  label: string,
  onProgress?: ProgressCallback
): Promise<Uint8Array> {
  const cached = memoryCache.get(url);
  if (cached) {
    onProgress?.({
      label,
      detail: "The model is already loaded in this tab.",
      percent: 100
    });
    return cached;
  }

  const promise = downloadUint8(url, label, onProgress);
  memoryCache.set(url, promise);

  try {
    return await promise;
  } catch (error) {
    memoryCache.delete(url);
    throw error;
  }
}

async function downloadUint8(url: string, label: string, onProgress?: ProgressCallback): Promise<Uint8Array> {
  onProgress?.({ label, detail: "Starting model download...", percent: 0 });

  const response = await fetch(url, { mode: "cors", cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`Could not load model ${label}: HTTP ${response.status}`);
  }

  const total = Number(response.headers.get("content-length")) || 0;

  if (!response.body) {
    onProgress?.({ label, detail: "The browser did not provide a progress stream, waiting for the full file..." });
    return new Uint8Array(await response.arrayBuffer());
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    chunks.push(value);
    received += value.byteLength;

    onProgress?.({
      label,
      detail: total > 0 ? `${formatBytes(received)} / ${formatBytes(total)}` : `${formatBytes(received)} loaded`,
      current: received,
      total: total || undefined,
      percent: total > 0 ? Math.round((received / total) * 100) : undefined
    });
  }

  const result = concatChunks(chunks, received);
  onProgress?.({ label, detail: `Done: ${formatBytes(result.byteLength)}`, percent: 100 });
  return result;
}

function concatChunks(chunks: Uint8Array[], size: number) {
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export function formatProgressDetail(current?: number, total?: number) {
  if (typeof current !== "number") return undefined;
  if (typeof total === "number" && total > 0) return `${formatBytes(current)} / ${formatBytes(total)}`;
  return `${formatBytes(current)} loaded`;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}
