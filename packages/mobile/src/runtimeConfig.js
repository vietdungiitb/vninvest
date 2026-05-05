export function normalizeBaseUrl(value, fallback) {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

export function createMobileRuntimeConfig(env = process.env) {
  const apiBaseUrl = normalizeBaseUrl(env.EXPO_PUBLIC_API_BASE_URL, 'http://127.0.0.1:8000');
  const wsBaseUrl = normalizeBaseUrl(env.EXPO_PUBLIC_WS_BASE_URL, 'ws://127.0.0.1:8000');

  return {
    API_BASE_URL: apiBaseUrl,
    API_PREFIX: `${apiBaseUrl}/api`,
    WS_BASE_URL: wsBaseUrl,
    DEMO_USERNAME: String(env.EXPO_PUBLIC_DEMO_USERNAME || '').trim(),
    DEMO_PASSWORD: String(env.EXPO_PUBLIC_DEMO_PASSWORD || '').trim(),
  };
}

export const mobileRuntimeConfig = createMobileRuntimeConfig();
export const API_BASE_URL = mobileRuntimeConfig.API_BASE_URL;
export const API_PREFIX = mobileRuntimeConfig.API_PREFIX;
export const WS_BASE_URL = mobileRuntimeConfig.WS_BASE_URL;
export const DEMO_USERNAME = mobileRuntimeConfig.DEMO_USERNAME;
export const DEMO_PASSWORD = mobileRuntimeConfig.DEMO_PASSWORD;