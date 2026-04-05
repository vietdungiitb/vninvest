const normalizeBaseUrl = (value: string | undefined, fallback: string): string => {
  const trimmed = (value || '').trim();
  if (!trimmed) {
    return fallback;
  }
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
};

export const API_BASE_URL = normalizeBaseUrl(
  process.env.EXPO_PUBLIC_API_BASE_URL,
  'http://127.0.0.1:8000'
);

export const API_PREFIX = `${API_BASE_URL}/api`;

export const WS_BASE_URL = normalizeBaseUrl(
  process.env.EXPO_PUBLIC_WS_BASE_URL,
  'ws://127.0.0.1:8000'
);
