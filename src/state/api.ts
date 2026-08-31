import type {
  ApiErrorCode,
  CreateHouseholdResponse,
  Id,
  Op,
  StateResponse,
} from '../../shared/types';
import type { CreateHouseholdRequest } from '../../shared/schema';

/**
 * Typed fetch wrappers. The family code always travels in a header, never in a
 * URL, so it can't leak through logs, history or a shared screenshot.
 */

export class ApiFailure extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'ApiFailure';
  }
}

/** Thrown when the request never reached the server — the offline signal. */
export class NetworkFailure extends Error {
  constructor(cause?: unknown) {
    super('Could not reach the server');
    this.name = 'NetworkFailure';
    this.cause = cause;
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { familyCode?: string } = {},
): Promise<T> {
  const { familyCode, headers, ...rest } = init;

  let res: Response;
  try {
    res = await fetch(path, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(familyCode ? { 'X-Family-Code': familyCode } : {}),
        ...headers,
      },
    });
  } catch (err) {
    throw new NetworkFailure(err);
  }

  if (!res.ok) {
    // A rate-limit response comes from Netlify's edge, not our handler, so it
    // won't have our JSON error body.
    if (res.status === 429) {
      throw new ApiFailure('rate_limited', 'Too many attempts. Wait a minute.');
    }
    const body = (await res.json().catch(() => null)) as
      | { error?: ApiErrorCode; message?: string }
      | null;
    throw new ApiFailure(body?.error ?? 'server_error', body?.message);
  }

  return (await res.json()) as T;
}

export function createHousehold(
  body: CreateHouseholdRequest,
): Promise<CreateHouseholdResponse> {
  return request<CreateHouseholdResponse>('/api/household', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function joinHousehold(familyCode: string): Promise<StateResponse> {
  return request<StateResponse>('/api/household/join', {
    method: 'POST',
    body: JSON.stringify({ familyCode }),
  });
}

export function fetchState(familyCode: string): Promise<StateResponse> {
  return request<StateResponse>('/api/state', { method: 'GET', familyCode });
}

export function pushOps(
  familyCode: string,
  actorParentId: Id,
  now: string,
  ops: readonly Op[],
): Promise<StateResponse> {
  return request<StateResponse>('/api/mutate', {
    method: 'POST',
    familyCode,
    body: JSON.stringify({ actorParentId, now, ops }),
  });
}
