import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { applyOps } from '../../shared/ops';
import type {
  Entry,
  FamilyState,
  Id,
  Op,
  Parent,
} from '../../shared/types';
import {
  ApiFailure,
  NetworkFailure,
  fetchState,
  pushOps,
} from './api';
import * as cache from './localCache';
import type { QueuedBatch } from './localCache';

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

/** 'blocked' means the network failed and retrying now would just spin. */
type FlushOutcome = 'done' | 'blocked';

export interface AppStateValue {
  /** Null until the device has joined a household. */
  state: FamilyState | null;
  familyCode: string | null;
  /** Which parent this device belongs to. Self-asserted; nothing verifies it. */
  deviceParentId: Id | null;
  deviceParent: Parent | null;
  otherParent: Parent | null;
  /** True while the first load is in flight and nothing is cached. */
  booting: boolean;
  sync: SyncStatus;
  pendingCount: number;
  lastSyncedAt: string | null;
  /** Set when a load failed in a way the user needs to know about. */
  error: string | null;

  dispatch: (ops: Op[]) => void;
  upsert: (entry: Entry) => void;
  refresh: () => Promise<void>;
  adopt: (args: { familyCode: string; state: FamilyState; rev: string }) => void;
  setDeviceParentId: (id: Id) => void;
  leave: () => void;
}

export const AppStateContext = createContext<AppStateValue | null>(null);

const REFRESH_DEBOUNCE_MS = 800;

export function AppStateProvider({ children }: { children: ReactNode }) {
  const cached = useMemo(() => cache.loadCachedState(), []);

  const [familyCode, setFamilyCode] = useState<string | null>(() =>
    cache.loadFamilyCode(),
  );
  const [deviceParentId, setDeviceParentIdState] = useState<Id | null>(() =>
    cache.loadDeviceParentId(),
  );
  const [state, setState] = useState<FamilyState | null>(cached?.state ?? null);
  const [booting, setBooting] = useState(() => Boolean(cache.loadFamilyCode()) && !cached);
  const [sync, setSync] = useState<SyncStatus>('idle');
  const [queue, setQueue] = useState<QueuedBatch[]>(() => cache.loadQueue());
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(
    cached?.cachedAt ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  const revRef = useRef<string>(cached?.rev ?? '');
  const queueRef = useRef<QueuedBatch[]>(queue);
  const familyCodeRef = useRef<string | null>(familyCode);
  const flushingRef = useRef<Promise<void> | null>(null);

  familyCodeRef.current = familyCode;

  const writeQueue = useCallback((next: QueuedBatch[]) => {
    queueRef.current = next;
    cache.saveQueue(next);
    setQueue(next);
  }, []);

  const adoptServerState = useCallback(
    (next: FamilyState, rev: string) => {
      revRef.current = rev;
      setState(next);
      cache.saveCachedState(next, rev);
      const at = new Date().toISOString();
      setLastSyncedAt(at);
    },
    [],
  );

  // ── Flushing the queue ────────────────────────────────────────────────────
  //
  // One request in flight at a time. Two fast taps must not race each other
  // into the same document, and each batch carries client-generated ids so a
  // replay after a dropped response is a no-op rather than a duplicate.

  const flush = useCallback(async (): Promise<FlushOutcome> => {
    const code = familyCodeRef.current;
    if (!code) return 'done';

    while (queueRef.current.length > 0) {
      const batch = queueRef.current[0]!;
      try {
        setSync('syncing');
        const res = await pushOps(code, batch.actorParentId, batch.now, batch.ops);
        adoptServerState(res.state, res.rev);
        writeQueue(queueRef.current.slice(1));
        setSync('idle');
        setError(null);
      } catch (err) {
        if (err instanceof NetworkFailure) {
          // Keep the batch queued and stop. Returning 'blocked' matters: the
          // queue is still non-empty, so an unconditional re-schedule here
          // would spin in a tight retry loop for as long as the device is
          // offline. The `online` and `visibilitychange` handlers restart it.
          setSync('offline');
          return 'blocked';
        }
        if (err instanceof ApiFailure && err.code === 'conflict') {
          // Six CAS attempts lost. Re-read and let the next loop retry on top
          // of fresh state; the ops are idempotent so this is safe.
          try {
            const fresh = await fetchState(code);
            adoptServerState(fresh.state, fresh.rev);
            continue;
          } catch {
            setSync('offline');
            return 'blocked';
          }
        }
        // invalid_input / not_found / too_large: retrying will never succeed,
        // so drop the batch rather than wedging every later write behind it.
        console.error('[sync] dropping unrecoverable batch', err);
        writeQueue(queueRef.current.slice(1));
        setSync('error');
        setError(
          err instanceof ApiFailure && err.message
            ? err.message
            : 'A change could not be saved.',
        );
      }
    }
    if (queueRef.current.length === 0) setSync('idle');
    return 'done';
  }, [adoptServerState, writeQueue]);

  /** Serialises flushes so only one runs at a time. */
  const scheduleFlush = useCallback(() => {
    if (flushingRef.current) return;
    flushingRef.current = flush()
      .then((outcome) => {
        flushingRef.current = null;
        // Pick up anything queued while we were flushing — but never retry
        // straight into a network failure, or this becomes a spin loop.
        if (outcome !== 'blocked' && queueRef.current.length > 0) scheduleFlush();
      })
      .catch(() => {
        flushingRef.current = null;
      });
  }, [flush]);

  // ── Dispatch ──────────────────────────────────────────────────────────────

  const dispatch = useCallback(
    (ops: Op[]) => {
      if (ops.length === 0) return;
      const actor = deviceParentId;
      const current = state;
      if (!actor || !current) return;

      const now = new Date().toISOString();

      // Apply locally first. The UI never waits on the network.
      const optimistic = applyOps(current, ops, { actorParentId: actor, now });
      setState(optimistic);
      cache.saveCachedState(optimistic, revRef.current);

      writeQueue([
        ...queueRef.current,
        { id: `${now}#${Math.random().toString(36).slice(2, 8)}`, actorParentId: actor, now, ops },
      ]);
      scheduleFlush();
    },
    [deviceParentId, state, writeQueue, scheduleFlush],
  );

  const upsert = useCallback(
    (entry: Entry) => dispatch([{ type: 'upsertEntry', entry }]),
    [dispatch],
  );

  // ── Refresh ───────────────────────────────────────────────────────────────

  const lastRefreshRef = useRef(0);

  const refresh = useCallback(async () => {
    const code = familyCodeRef.current;
    if (!code) return;
    // Pending writes are the source of truth until they land; pulling now would
    // stomp the optimistic state.
    if (queueRef.current.length > 0) {
      scheduleFlush();
      return;
    }
    const since = Date.now() - lastRefreshRef.current;
    if (since < REFRESH_DEBOUNCE_MS) return;
    lastRefreshRef.current = Date.now();

    try {
      setSync('syncing');
      const res = await fetchState(code);
      adoptServerState(res.state, res.rev);
      setSync('idle');
      setError(null);
    } catch (err) {
      if (err instanceof NetworkFailure) {
        setSync('offline');
      } else if (err instanceof ApiFailure && err.code === 'not_found') {
        // The household is gone, or the code was rotated on the other device.
        setSync('error');
        setError('This family code no longer works. It may have been rotated.');
      } else {
        setSync('error');
      }
    } finally {
      setBooting(false);
    }
  }, [adoptServerState, scheduleFlush]);

  // First load, and whenever the code changes.
  useEffect(() => {
    if (!familyCode) {
      setBooting(false);
      return;
    }
    void refresh();
    if (queueRef.current.length > 0) scheduleFlush();
  }, [familyCode, refresh, scheduleFlush]);

  // Re-sync when the device comes back or the tab is looked at again. This is
  // the whole offline story: a parent logs something at a campsite with no
  // signal, and it lands when they next open the app somewhere with bars.
  useEffect(() => {
    const onOnline = () => {
      scheduleFlush();
      void refresh();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') onOnline();
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh, scheduleFlush]);

  // ── Membership ────────────────────────────────────────────────────────────

  const adopt = useCallback(
    ({
      familyCode: code,
      state: next,
      rev,
    }: {
      familyCode: string;
      state: FamilyState;
      rev: string;
    }) => {
      cache.saveFamilyCode(code);
      setFamilyCode(code);
      familyCodeRef.current = code;
      adoptServerState(next, rev);
      setBooting(false);
      setError(null);
    },
    [adoptServerState],
  );

  const setDeviceParentId = useCallback((id: Id) => {
    cache.saveDeviceParentId(id);
    setDeviceParentIdState(id);
  }, []);

  const leave = useCallback(() => {
    cache.clearAll();
    queueRef.current = [];
    revRef.current = '';
    setQueue([]);
    setFamilyCode(null);
    setDeviceParentIdState(null);
    setState(null);
    setError(null);
    setSync('idle');
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

  const { deviceParent, otherParent } = useMemo(() => {
    const parents = state?.household.parents;
    if (!parents || !deviceParentId) {
      return { deviceParent: null, otherParent: null };
    }
    const me = parents.find((p) => p.id === deviceParentId) ?? null;
    const them = parents.find((p) => p.id !== deviceParentId) ?? null;
    return { deviceParent: me, otherParent: them };
  }, [state, deviceParentId]);

  const value = useMemo<AppStateValue>(
    () => ({
      state,
      familyCode,
      deviceParentId,
      deviceParent,
      otherParent,
      booting,
      sync,
      pendingCount: queue.length,
      lastSyncedAt,
      error,
      dispatch,
      upsert,
      refresh,
      adopt,
      setDeviceParentId,
      leave,
    }),
    [
      state,
      familyCode,
      deviceParentId,
      deviceParent,
      otherParent,
      booting,
      sync,
      queue.length,
      lastSyncedAt,
      error,
      dispatch,
      upsert,
      refresh,
      adopt,
      setDeviceParentId,
      leave,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}
