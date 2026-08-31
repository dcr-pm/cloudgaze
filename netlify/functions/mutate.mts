import type { Config } from '@netlify/functions';
import { zMutateRequest } from '../../shared/schema';
import { applyOps } from '../../shared/ops';
import type { StateResponse } from '../../shared/types';
import { codeToKey } from './_lib/familyCode';
import {
  ConflictError,
  NotFoundError,
  TooLargeError,
  mutateFamily,
} from './_lib/store';
import { NOT_FOUND, codeFromHeader, fail, guard, json, readJson } from './_lib/http';

/**
 * The single write endpoint.
 *
 * With a one-blob-per-family store, every write is the identical
 * read-modify-write against the same document regardless of which entity it
 * touches. One endpoint means one implementation of the compare-and-swap loop
 * (the part that is easy to get subtly wrong), plus natural batching — settling
 * up twelve expenses is one atomic commit.
 */
export default guard(async (req: Request) => {
  if (req.method !== 'POST') return fail('invalid_input', 'POST only');

  const code = codeFromHeader(req);
  if (!code) return NOT_FOUND();

  const parsed = zMutateRequest.safeParse(await readJson(req));
  if (!parsed.success) {
    return fail('invalid_input', parsed.error.issues[0]?.message);
  }
  const { actorParentId, now, ops } = parsed.data;

  try {
    const key = await codeToKey(code);

    const { state, rev } = await mutateFamily(key, (current) => {
      // The actor must actually be one of this household's parents — the only
      // identity check available without accounts, but it stops a stray client
      // from attributing changes to a parent id that isn't in this family.
      const known = current.household.parents.some((p) => p.id === actorParentId);
      if (!known) throw new UnknownActorError();

      // applyOps is pure and re-runnable: this closure is re-invoked from
      // scratch on every CAS retry against freshly-read state.
      return applyOps(current, ops, { actorParentId, now });
    });

    const body: StateResponse = { state, rev };
    return json(body, 200, rev ? { ETag: rev } : {});
  } catch (err) {
    if (err instanceof UnknownActorError) return NOT_FOUND();
    if (err instanceof NotFoundError) return NOT_FOUND();
    if (err instanceof TooLargeError) return fail('too_large');
    if (err instanceof ConflictError) return fail('conflict');
    throw err;
  }
});

class UnknownActorError extends Error {}

export const config: Config = {
  path: '/api/mutate',
  rateLimit: { windowSize: 60, windowLimit: 60, aggregateBy: 'ip' },
};
