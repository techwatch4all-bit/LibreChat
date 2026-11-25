export type OpenCodeErrorCode =
  | 'OPENCODE_DISABLED'
  | 'OPENCODE_MISCONFIGURED'
  | 'OPENCODE_UNAUTHORIZED'
  | 'PROJECT_NOT_FOUND'
  | 'PROJECT_PATH_INVALID'
  | 'PATH_OUTSIDE_ROOT'
  | 'PATH_INVALID'
  | 'WRITE_FORBIDDEN'
  | 'FILE_NOT_FOUND'
  | 'FILE_TOO_LARGE'
  | 'PROVIDER_NOT_ALLOWED'
  | 'INVALID_REQUEST'
  | 'UPSTREAM_AUTH_FAILED'
  | 'UPSTREAM_UNAVAILABLE'
  | 'LOCAL_MODEL_NOT_LOADED'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_ERROR'
  | 'INTERNAL_ERROR';

export interface OpenCodeError {
  readonly code: OpenCodeErrorCode;
  readonly status: number;
}

export type OpenCodeResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: OpenCodeError };

export function ok<T>(value: T): OpenCodeResult<T> {
  return { ok: true, value };
}

export function err<T = never>(code: OpenCodeErrorCode, status: number): OpenCodeResult<T> {
  return { ok: false, error: { code, status } };
}
