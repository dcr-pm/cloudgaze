import type { Config } from '@netlify/functions';
import type { StateResponse } from '../../shared/types';
import { codeToKey } from './_lib/familyCode';
import { NotFoundError, readFamily } from './_lib/store';
import { NOT_FOUND, codeFromHeader, fail, guard, json } from './_lib/http';

export default guard(async (req: Request) => {
  if (req.method !== 'GET') return fail('invalid_input', 'GET only');

  const code = codeFromHeader(req);
  if (!code) return NOT_FOUND();

  try {
    const { state, rev } = await readFamily(await codeToKey(code));

    // Cheap polling: an unchanged document costs a 304 with no body.
    const ifNoneMatch = req.headers.get('if-none-match');
    if (ifNoneMatch && rev && ifNoneMatch === rev) {
      return new Response(null, {
        status: 304,
        headers: { ETag: rev, 'Cache-Control': 'no-store, private' },
      });
    }

    const body: StateResponse = { state, rev };
    return json(body, 200, rev ? { ETag: rev } : {});
  } catch (err) {
    if (err instanceof NotFoundError) return NOT_FOUND();
    throw err;
  }
});

export const config: Config = {
  path: '/api/state',
  rateLimit: { windowSize: 60, windowLimit: 60, aggregateBy: 'ip' },
};
