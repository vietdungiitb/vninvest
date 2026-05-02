export const packageShellHostEnv = {
  VNINVEST_API_BASE_URL: process.env.REACT_APP_API_BASE_URL || '/api',
  VNINVEST_CORE_BASE_URL: process.env.REACT_APP_PACKAGE_SHELL_CORE_BASE_URL || '/core/v1',
};

function shouldAttachApiToken(requestUrl) {
  if (!requestUrl) {
    return false;
  }

  if (requestUrl.startsWith('/api/')) {
    return true;
  }

  try {
    const resolvedUrl = new URL(requestUrl, globalThis.location?.origin || 'http://127.0.0.1');
    return resolvedUrl.origin === globalThis.location?.origin && resolvedUrl.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

export async function packageShellHostFetch(input, init = {}) {
  const requestUrl = typeof input === 'string' ? input : input?.url || '';
  const headers = new Headers(init.headers || {});

  if (shouldAttachApiToken(requestUrl)) {
    const accessToken = globalThis.localStorage?.getItem('access_token');
    if (accessToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }
  }

  return fetch(input, {
    ...init,
    headers,
  });
}