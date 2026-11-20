import { getTokenHeader } from 'librechat-data-provider';

/**
 * Universal authenticated fetch client for LibreChat Admin API.
 * Automatically resolves and attaches:
 * 1. Bearer Token from axios default headers (`getTokenHeader()`) or sessionStorage fallback (`sessionStorage.getItem('token')`).
 * 2. Step-Up TOTP Token (`X-Admin-StepUp-Token`) from `sessionStorage.getItem('stepUpToken')`.
 * 3. `credentials: 'include'` for secure cookie support.
 */
export async function adminFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);

  // 1. Resolve Authorization Token
  if (!headers.has('Authorization')) {
    const headerToken = getTokenHeader();
    const sessionToken = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
    const bearer = headerToken ?? (sessionToken ? `Bearer ${sessionToken}` : undefined);
    if (bearer) {
      headers.set('Authorization', bearer);
    }
  }

  // 2. Resolve Step-Up Token for protected operations (e.g. grants, 2FA, audit logs)
  if (!headers.has('X-Admin-StepUp-Token')) {
    const stepUpToken = typeof window !== 'undefined' ? sessionStorage.getItem('stepUpToken') : null;
    if (stepUpToken) {
      headers.set('X-Admin-StepUp-Token', stepUpToken);
    }
  }

  return fetch(input, {
    credentials: 'include',
    ...init,
    headers,
  });
}
