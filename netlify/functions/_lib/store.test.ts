import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FamilyState } from '../../../shared/types';

/**
 * Exercises the compare-and-swap loop against a stub implementing the
 * documented @netlify/blobs contract: a rejected conditional write RESOLVES
 * with { modified: false } rather than throwing.
 *
 * This verifies our loop is correct against that contract. It does not verify
 * that the deployed service honours the contract — that needs a real deploy,
 * and the README says so.
 */

interface StoredBlob {
  data: unknown;
  etag: string;
}

const blobs = new Map<string, StoredBlob>();
let etagCounter = 0;
/** Lets a test simulate the other parent committing mid-flight. */
let beforeWrite: (() => void) | null = null;

const store = {
  getWithMetadata: vi.fn(async (key: string) => {
    const found = blobs.get(key);
    return found ? { data: found.data, etag: found.etag, metadata: {} } : null;
  }),
  setJSON: vi.fn(
    async (
      key: string,
      data: unknown,
      opts?: { onlyIfMatch?: string; onlyIfNew?: boolean },
    ) => {
      beforeWrite?.();
      const existing = blobs.get(key);

      if (opts?.onlyIfNew && existing) return { modified: false };
      if (opts?.onlyIfMatch !== undefined && existing?.etag !== opts.onlyIfMatch) {
        return { modified: false };
      }

      const etag = `"e${++etagCounter}"`;
      blobs.set(key, { data: structuredClone(data), etag });
      return { modified: true, etag };
    },
  ),
  delete: vi.fn(async (key: string) => {
    blobs.delete(key);
  }),
};

vi.mock('@netlify/blobs', () => ({ getStore: () => store }));

const { mutateFamily, createFamily, readFamily, NotFoundError, ConflictError } =
  await import('./store');

const KEY = 'family/abc';

function seed(): FamilyState {
  return {
    schemaVersion: 1,
    household: {
      id: 'h',
      createdAt: '2026-08-01T00:00:00.000Z',
      timezone: 'UTC',
      parents: [
        { id: 'p0', name: 'Sam', color: 'indigo' },
        { id: 'p1', name: 'Jordan', color: 'teal' },
      ],
      kids: [],
    },
    entries: [],
    audit: [],
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
}

beforeEach(() => {
  blobs.clear();
  etagCounter = 0;
  beforeWrite = null;
  vi.clearAllMocks();
});

describe('createFamily', () => {
  it('creates when the key is free', async () => {
    expect(await createFamily(KEY, seed())).toBe(true);
  });

  it('reports a collision instead of overwriting', async () => {
    await createFamily(KEY, seed());
    const other = { ...seed(), updatedAt: 'later' };
    expect(await createFamily(KEY, other)).toBe(false);
    // The original household must survive an unlucky code collision.
    expect((blobs.get(KEY)!.data as FamilyState).updatedAt).toBe(
      '2026-08-01T00:00:00.000Z',
    );
  });
});

describe('mutateFamily', () => {
  it('throws NotFoundError for an unknown family', async () => {
    await expect(mutateFamily(KEY, (s) => s)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('commits a change and returns the new revision', async () => {
    await createFamily(KEY, seed());
    const { state, rev } = await mutateFamily(KEY, (s) => ({
      ...s,
      updatedAt: 'changed',
    }));
    expect(state.updatedAt).toBe('changed');
    expect(rev).toBeTruthy();
    expect((blobs.get(KEY)!.data as FamilyState).updatedAt).toBe('changed');
  });

  it('does not mutate the caller’s stored object', async () => {
    await createFamily(KEY, seed());
    const before = structuredClone(blobs.get(KEY)!.data);
    await mutateFamily(KEY, (s) => {
      // A reducer that mutates its argument must not corrupt the store copy
      // before the conditional write decides whether to accept it.
      s.entries.push({} as never);
      return { ...s, updatedAt: 'x' };
    });
    expect(before).not.toBe(blobs.get(KEY)!.data);
  });

  it('retries and still lands after losing a race', async () => {
    await createFamily(KEY, seed());
    vi.clearAllMocks(); // don't count createFamily's own write

    let raced = false;
    beforeWrite = () => {
      if (raced) return;
      raced = true;
      // The other parent commits first, invalidating our etag.
      blobs.set(KEY, {
        data: { ...seed(), updatedAt: 'theirs' },
        etag: '"other"',
      });
    };

    const { state } = await mutateFamily(KEY, (s) => ({
      ...s,
      updatedAt: `${s.updatedAt}+mine`,
    }));

    // The retry re-read their commit and applied on top of it — no clobber.
    expect(state.updatedAt).toBe('theirs+mine');
    expect(store.setJSON).toHaveBeenCalledTimes(2);
  });

  it('gives up with ConflictError when the race never resolves', async () => {
    await createFamily(KEY, seed());
    // Somebody else commits before every single attempt.
    beforeWrite = () => {
      blobs.set(KEY, { data: seed(), etag: `"moving-${++etagCounter}"` });
    };

    await expect(
      mutateFamily(KEY, (s) => ({ ...s, updatedAt: 'mine' })),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('refuses to write when no etag is available', async () => {
    // Degrading to an unconditional write here would silently clobber the
    // other parent's concurrent changes, so it must fail loudly instead.
    blobs.set(KEY, { data: seed(), etag: undefined as unknown as string });
    await expect(mutateFamily(KEY, (s) => s)).rejects.toBeInstanceOf(ConflictError);
    expect(store.setJSON).not.toHaveBeenCalled();
  });

  it('skips the write entirely when the reducer returns the same object', async () => {
    await createFamily(KEY, seed());
    vi.clearAllMocks();
    await mutateFamily(KEY, (s) => s);
    expect(store.setJSON).not.toHaveBeenCalled();
  });

  it('reads back what was written', async () => {
    await createFamily(KEY, seed());
    const { state, rev } = await readFamily(KEY);
    expect(state.household.parents[0].name).toBe('Sam');
    expect(rev).toBeTruthy();
  });
});
