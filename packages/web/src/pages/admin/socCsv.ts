import { authTokenStorage, resolveCoreApiBase } from '../../adapters/core/transport.js';

/**
 * R8.3: tải CSV từ endpoint SOC (download=csv) với auth hiện tại.
 * Dùng fetch thô vì coreGet parse JSON — CSV cần blob.
 */
export async function downloadSocCsv(path: string, params: Record<string, string | number | undefined>, filename: string) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && String(v) !== '') qs.set(k, String(v));
  }
  qs.set('download', 'csv');
  const base = resolveCoreApiBase({});
  const token = authTokenStorage.getAccessToken();
  const res = await fetch(`${base}${path}${qs.toString() ? `?${qs.toString()}` : ''}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`CSV export failed: ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
