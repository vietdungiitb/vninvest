import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShellWhaleAlertsPage } from '@vninvest/web';

const shellEnv = {
  VNINVEST_API_BASE_URL: process.env.REACT_APP_API_BASE_URL || '/api',
  VNINVEST_CORE_BASE_URL: process.env.REACT_APP_PACKAGE_SHELL_CORE_BASE_URL || 'http://127.0.0.1:8100/core/v1',
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

async function shellHostFetch(input, init = {}) {
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

export default function WhaleAlertsShellHost() {
  const location = useLocation();

  return (
    <div className="min-h-full bg-slate-950 px-4 py-4 xl:px-5">
      <div className="mx-auto max-w-[1600px] space-y-4">
        <section className="rounded-3xl border border-amber-800/40 bg-amber-950/20 px-5 py-4 text-amber-50 shadow-[0_24px_60px_rgba(120,53,15,0.16)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-4xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-300">Package shell host</p>
              <h1 className="mt-2 text-2xl font-semibold text-amber-50">Whale alerts shell chạy trong frontend thật</h1>
              <p className="mt-2 text-sm leading-7 text-amber-100/80">
                Route này mount trực tiếp `ShellWhaleAlertsPage` từ `@vninvest/web`, dùng JWT hiện tại cho `/api` và gọi core stub qua `:8100` để auditor kiểm tra shell route trong runtime thật thay vì chỉ xem SSR proof.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to={`/whale-alerts${location.search || ''}`}
                className="rounded-full border border-amber-500/40 px-4 py-2 text-sm font-semibold text-amber-100 transition-colors hover:border-amber-300 hover:text-white"
              >
                Quay lại trung tâm whale
              </Link>
            </div>
          </div>
        </section>

        <ShellWhaleAlertsPage
          env={shellEnv}
          fetchImpl={shellHostFetch}
          whaleSearch={location.search}
        />
      </div>
    </div>
  );
}