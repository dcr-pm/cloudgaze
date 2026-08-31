import { getStore, type Store } from '@netlify/blobs';
import type { FamilyState } from '../../../shared/types';

/**
 * Compare-and-swap access to the one-blob-per-family document.
 *
 * Three things here will silently destroy data if changed carelessly:
 *
 *  1. `getStore`, NOT `getDeployStore`. Deploy-scoped stores are garbage
 *     collected along with the deploy that created them — using one would wipe
 *     every family's data on every push, with no error anywhere.
 *
 *  2. `consistency: 'strong'`. Under the default eventual consistency, the
 *     re-read after a lost CAS race can return the stale value, so the retry
 *     loop spins against stale data until it gives up.
 *
 *  3. A rejected conditional write RESOLVES with `{ modified: false }` — it
 *     does NOT throw. Wrapping setJSON in a bare try/catch would swallow every
 *     lost race and report success.
 */

const MAX_ATTEMPTS = 6;

/** Bounds how large a single client can grow a document, so no one can balloon
 *  a blob and burn the site's storage credits. ~1.3MB is the realistic ceiling
 *  for five years of a three-kid household, so this is generous. */
const MAX_STATE_BYTES = 4 * 1024 * 1024;

export class NotFoundError extends Error {
  constructor() {
    super('family not found');
  }
}
export class ConflictError extends Error {}
export class TooLargeError extends Error {
  constructor() {
    super('family document too large');
  }
}

export function familyStore(): Store {
  return getStore({ name: 'families', consistency: 'strong' });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface StoredFamily {
  state: FamilyState;
  rev: string;
}

export async function readFamily(key: string): Promise<StoredFamily> {
  const found = await familyStore().getWithMetadata(key, {
    type: 'json',
    consistency: 'strong',
  });
  if (!found) throw new NotFoundError();
  return { state: found.data as FamilyState, rev: found.etag ?? '' };
}

/**
 * Read → apply → conditional write, retrying on a lost race.
 *
 * `apply` MUST be pure and re-runnable: it is called again from scratch against
 * freshly-read state on every retry. No Date.now(), no randomUUID(), no
 * captured mutable state — timestamps and ids come from the request payload.
 */
export async function mutateFamily(
  key: string,
  apply: (state: FamilyState) => FamilyState,
): Promise<StoredFamily> {
  const store = familyStore();

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const current = await store.getWithMetadata(key, {
      type: 'json',
      consistency: 'strong',
    });
    if (!current) throw new NotFoundError();

    // etag is typed `string | undefined`. Without one there is no safe
    // compare-and-swap available, so refuse rather than silently degrading to
    // last-write-wins on a document two people are editing.
    if (!current.etag) {
      throw new ConflictError('no etag returned; refusing an unsafe write');
    }

    const next = apply(structuredClone(current.data) as FamilyState);

    // Nothing changed (e.g. deleting an already-deleted entry). Skip the write.
    if (next === current.data) {
      return { state: next, rev: current.etag };
    }

    const payload = JSON.stringify(next);
    if (payload.length > MAX_STATE_BYTES) throw new TooLargeError();

    // A rejected conditional write resolves with modified:false. Do not catch.
    const res = await store.setJSON(key, next, { onlyIfMatch: current.etag });

    if (res.modified) {
      return { state: next, rev: res.etag ?? '' };
    }

    // Lost the race against the other parent. Re-read and re-apply.
    await sleep(25 * 2 ** attempt + Math.random() * 50);
  }

  throw new ConflictError(`could not commit after ${MAX_ATTEMPTS} attempts`);
}

/**
 * Create-if-absent. Returns false when the key is already taken, which is how
 * a family-code collision is detected without a read-then-write race.
 */
export async function createFamily(
  key: string,
  initial: FamilyState,
): Promise<boolean> {
  const res = await familyStore().setJSON(key, initial, { onlyIfNew: true });
  return res.modified;
}

/** Used by code rotation: write the new key, then drop the old one. */
export async function deleteFamily(key: string): Promise<void> {
  await familyStore().delete(key);
}
