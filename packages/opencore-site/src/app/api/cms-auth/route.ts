import { type NextRequest } from 'next/server';

const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

/**
 * netlify-cms 2.x GitHub OAuth handler — implements full 2-step handshake.
 *
 * Flow:
 *  1. CMS opens popup → GET /api/cms-auth?provider=github
 *     → return HTML page that:
 *        a) sends  "authorizing:github"  to window.opener (CMS)
 *        b) waits for CMS to echo it back as acknowledgement
 *        c) then redirects to GitHub authorize URL
 *  2. GitHub redirects back → GET /api/cms-auth?code=xxx
 *     → exchange code for access_token server-side
 *     → return HTML that postMessages "authorization:github:success:{token}" to opener
 *
 * netlify-cms 2.x only registers the success-message listener AFTER receiving
 * the handshake, so skipping step 1a-1c causes the success message to be ignored.
 */
export async function GET(request: NextRequest) {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return new Response('Server misconfigured: missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET', {
      status: 500,
    });
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  // Step 1: No code — serve handshake HTML that drives popup through GitHub OAuth
  if (!code) {
    const githubAuthUrl =
      `https://github.com/login/oauth/authorize?` +
      new URLSearchParams({ client_id: CLIENT_ID, scope: 'repo,user' }).toString();

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Đang xác thực…</title></head><body>
<script>(function(){
  var provider = new URLSearchParams(window.location.search).get('provider') || 'github';
  var githubUrl = ${JSON.stringify(githubAuthUrl)};
  function start() {
    if (window.opener) {
      // Step 1a: send handshake to CMS
      window.opener.postMessage('authorizing:' + provider, window.location.origin);
      // Step 1b: wait for CMS to echo acknowledgement
      window.addEventListener('message', function handler(e) {
        if (e.data === 'authorizing:' + provider) {
          window.removeEventListener('message', handler);
          // Step 1c: CMS acknowledged — now go to GitHub
          window.location.href = githubUrl;
        }
      });
    } else {
      setTimeout(start, 100);
    }
  }
  start();
})();\x3c/script></body></html>`;

    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
  }

  // Step 2: Exchange authorization code for access token
  let accessToken: string;
  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (tokenData.error || !tokenData.access_token) {
      return postMessageResponse(
        'error',
        tokenData.error_description ?? 'GitHub OAuth exchange failed',
      );
    }

    accessToken = tokenData.access_token;
  } catch {
    return postMessageResponse('error', 'Network error during token exchange');
  }

  return postMessageResponse('success', { token: accessToken, provider: 'github' });
}

function postMessageResponse(status: 'success' | 'error', content: unknown) {
  const message = `authorization:github:${status}:${JSON.stringify(content)}`;
  const html = `<!doctype html><html><body><script>
(function(){
  var msg = ${JSON.stringify(message)};
  function send() {
    if (window.opener) {
      window.opener.postMessage(msg, '*');
      setTimeout(function(){ window.close(); }, 200);
    } else {
      setTimeout(send, 100);
    }
  }
  send();
})();
\x3c/script></body></html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
    status: status === 'error' ? 400 : 200,
  });
}
