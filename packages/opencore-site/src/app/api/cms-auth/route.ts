import { type NextRequest, NextResponse } from 'next/server';

const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

/**
 * Decap CMS GitHub OAuth handler.
 *
 * Flow:
 *  1. Decap opens popup → GET /api/cms-auth?provider=github&scope=repo
 *     → we redirect to GitHub authorize page
 *  2. GitHub redirects back → GET /api/cms-auth?code=xxx
 *     → we exchange code for access_token
 *     → respond with postMessage HTML that sends token to opener window
 */
export async function GET(request: NextRequest) {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return new Response('Server misconfigured: missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET', {
      status: 500,
    });
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  // Step 1: No code yet — initiate GitHub OAuth redirect
  if (!code) {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      scope: 'repo',
    });
    return NextResponse.redirect(
      `https://github.com/login/oauth/authorize?${params.toString()}`,
    );
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
