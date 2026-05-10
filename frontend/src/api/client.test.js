import apiClient, { isAuthPublicEndpoint } from './client';

describe('isAuthPublicEndpoint', () => {
  it('matches login endpoint to bypass global 401 redirect', () => {
    expect(isAuthPublicEndpoint('/auth/token/')).toBe(true);
    expect(isAuthPublicEndpoint('/auth/token')).toBe(true);
  });

  it('matches other public auth endpoints', () => {
    expect(isAuthPublicEndpoint('/auth/register/')).toBe(true);
    expect(isAuthPublicEndpoint('/auth/verify-email/')).toBe(true);
    expect(isAuthPublicEndpoint('/auth/resend-verification/')).toBe(true);
    expect(isAuthPublicEndpoint('/auth/token/refresh/')).toBe(true);
  });

  it('does not match protected or unrelated endpoints', () => {
    expect(isAuthPublicEndpoint('/portfolio/userconfig/')).toBe(false);
    expect(isAuthPublicEndpoint('/stock-management/stocks/HPG/overview/')).toBe(false);
    expect(isAuthPublicEndpoint('/auth/me/')).toBe(false);
    expect(isAuthPublicEndpoint('')).toBe(false);
  });

  it('applies a bounded request timeout to the shared client', () => {
    expect(apiClient.defaults.timeout).toBe(20000);
  });
});
