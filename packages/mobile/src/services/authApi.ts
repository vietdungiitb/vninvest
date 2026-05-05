import authClient from './http';
import { clearTokens, getAccessToken, saveTokens } from './tokenStorage';
import type { AuthTokens, AuthUser, RegisterPayload } from '../types/auth';

export async function login(username: string, password: string): Promise<AuthUser> {
  const response = await authClient.post<AuthTokens>('/auth/token/', { username, password });
  await saveTokens(response.data.access, response.data.refresh);
  return getMe();
}

export async function register(payload: RegisterPayload): Promise<{ message: string }> {
  const response = await authClient.post<{ message: string }>('/auth/register/', payload);
  return response.data;
}

export async function getMe(): Promise<AuthUser> {
  const response = await authClient.get<AuthUser>('/auth/me/');
  return response.data;
}

export async function restoreSession(): Promise<AuthUser | null> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return null;
  }
  try {
    return await getMe();
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  await clearTokens();
}
