import type { Config } from '@netlify/functions';
import { zJoinRequest } from '../../shared/schema';
import type { StateResponse } from '../../shared/types';
import { codeToKey, isPlausibleCode, normalizeCode } from './_lib/familyCode';
import { NotFoundError, readFamily } from './_lib/store';
import { NOT_FOUND, fail, guard, json, readJson } from './_lib/http';

export default guard(async (req: Request) => {
  if (req.method !== 'POST') return fail('invalid_input', 'POST only');

  const parsed = zJoinRequest.safeParse(await readJson(req));
  if (!parsed.success) return NOT_FOUND();

  const code = normalizeCode(parsed.data.familyCode);
  // A malformed code and a valid-but-unissued code return the same response, so
  // this can't be used to probe which shapes are real.
  if (!isPlausibleCode(code)) return NOT_FOUND();

  try {
    const { state, rev } = await readFamily(await codeToKey(code));
    const body: StateResponse = { state, rev };
    return json(body);
  } catch (err) {
    if (err instanceof NotFoundError) return NOT_FOUND();
    throw err;
  }
});

export const config: Config = {
  path: '/api/household/join',
  // This is the enumeration surface, so it is the strictest limit in the app.
  // At 5/min against a ~2^59 keyspace, brute force is not a threat.
  rateLimit: { windowSize: 60, windowLimit: 5, aggregateBy: 'ip' },
};
