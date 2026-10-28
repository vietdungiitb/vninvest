from urllib.parse import urlencode

import httpx

GOOGLE_OAUTH_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'
GOOGLE_OAUTH_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'


def refresh_google_access_token(
    *,
    client_id: str,
    client_secret: str,
    refresh_token: str,
    timeout_seconds: int = 20,
) -> dict:
    if not client_id or not client_secret or not refresh_token:
        raise ValueError('Thiếu client_id/client_secret/refresh_token cho Google OAuth2.')

    response = httpx.post(
        GOOGLE_OAUTH_TOKEN_URL,
        data={
            'client_id': client_id,
            'client_secret': client_secret,
            'refresh_token': refresh_token,
            'grant_type': 'refresh_token',
        },
        timeout=timeout_seconds,
    )
    response.raise_for_status()
    payload = response.json()
    if 'access_token' not in payload:
        raise ValueError('Google token response không chứa access_token.')
    return payload


def build_google_oauth_authorize_url(
    *,
    client_id: str,
    redirect_uri: str,
    state: str,
    scope: str | None = None,
) -> str:
    if not client_id:
        raise ValueError('Thiếu Google client_id.')

    final_scope = scope or 'https://www.googleapis.com/auth/gmail.send openid email'
    query = urlencode(
        {
            'client_id': client_id,
            'redirect_uri': redirect_uri,
            'response_type': 'code',
            'scope': final_scope,
            'access_type': 'offline',
            'prompt': 'consent',
            'state': state,
        }
    )
    return f'{GOOGLE_OAUTH_AUTHORIZE_URL}?{query}'


def exchange_google_oauth_code(
    *,
    client_id: str,
    client_secret: str,
    code: str,
    redirect_uri: str,
    timeout_seconds: int = 20,
) -> dict:
    response = httpx.post(
        GOOGLE_OAUTH_TOKEN_URL,
        data={
            'client_id': client_id,
            'client_secret': client_secret,
            'code': code,
            'grant_type': 'authorization_code',
            'redirect_uri': redirect_uri,
        },
        timeout=timeout_seconds,
    )
    response.raise_for_status()
    payload = response.json()
    if 'refresh_token' not in payload and 'access_token' not in payload:
        raise ValueError('Google token response không chứa token hợp lệ.')
    return payload


def fetch_google_user_email(*, access_token: str, timeout_seconds: int = 20) -> str:
    if not access_token:
        return ''
    response = httpx.get(
        GOOGLE_OAUTH_USERINFO_URL,
        headers={'Authorization': f'Bearer {access_token}'},
        timeout=timeout_seconds,
    )
    response.raise_for_status()
    payload = response.json()
    email = str(payload.get('email') or '').strip()
    if email and not payload.get('email_verified', False):
        raise ValueError('Google email chưa được xác thực bởi Google. Vui lòng xác thực email trong tài khoản Google trước.')
    return email