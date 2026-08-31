import type { ApiError, ApiErrorCode } from '../../../shared/types';
import { isPlausibleCode, normalizeCode } from './familyCode';

const BASE_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, private',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
};

export function json(
  body: unknown,
  status = 200,
  extra: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...BASE_HEADERS, ...extra },
  });
}

const STATUS_FOR: Record<ApiErrorCode, number> = {
  not_found: 404,
  invalid_input: 400,
  conflict: 409,
  too_large: 413,
  rate_limited: 429,
  server_error: 500,
};

export function fail(code: ApiErrorCode, message?: string): Response {
  const body: ApiError = message ? { error: code, message } : { error: code };
  return json(body, STATUS_FOR[code]);
}

/**
 * A wrong code and a code that was never issued return the identical response,
 * so the endpoint can't be used as an oracle to confirm a guess.
 */
export const NOT_FOUND = () => fail('not_found');

/**
 * The family code travels in a header or a POST body — never in a URL path or
 * query string, which would leak it into server logs, browser history, Referer
 * headers, and any shared screenshot.
 */
export function codeFromHeader(req: Request): string | null {
  const raw = req.headers.get('x-family-code');
  if (!raw) return null;
  const code = normalizeCode(raw);
  return isPlausibleCode(code) ? code : null;
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

/** Wraps a handler so an unexpected throw becomes a 500 instead of a stack trace. */
export function guard(
  fn: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req) => {
    try {
      return await fn(req);
    } catch (err) {
      console.error('[api] unhandled error', err);
      return fail('server_error');
    }
  };
}
