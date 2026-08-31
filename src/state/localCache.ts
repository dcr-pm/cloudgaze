import type { FamilyState, Id, Op } from '../../shared/types';

/**
 * localStorage is the offline substrate: the family code, which parent this
 * device is, the last known state, and any ops not yet acknowledged by the
 * server.
 *
 * Every access is wrapped — Safari private mode and "block site data" settings
 * make even reading `localStorage` throw, and the app must still run.
 */

const KEY_CODE = 'kin.familyCode';
const KEY_PARENT = 'kin.deviceParentId';
const KEY_STATE = 'kin.state';
const KEY_QUEUE = 'kin.queue';
const KEY_PREFS = 'kin.prefs';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Quota exceeded or storage blocked. The app stays usable; it just won't
    // survive a reload.
  }
}

function remove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function readJson<T>(key: string): T | null {
  const raw = read(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Corrupt entry — drop it rather than wedging startup.
    remove(key);
    return null;
  }
}

// ── Family code ─────────────────────────────────────────────────────────────

export const loadFamilyCode = (): string | null => read(KEY_CODE);
export const saveFamilyCode = (code: string): void => write(KEY_CODE, code);

// ── Which parent is this device ─────────────────────────────────────────────

export const loadDeviceParentId = (): Id | null => read(KEY_PARENT);
export const saveDeviceParentId = (id: Id): void => write(KEY_PARENT, id);

// ── Cached state ────────────────────────────────────────────────────────────

export interface CachedState {
  state: FamilyState;
  rev: string;
  cachedAt: string;
}

export const loadCachedState = (): CachedState | null =>
  readJson<CachedState>(KEY_STATE);

export function saveCachedState(state: FamilyState, rev: string): void {
  write(
    KEY_STATE,
    JSON.stringify({ state, rev, cachedAt: new Date().toISOString() }),
  );
}

// ── Pending ops ─────────────────────────────────────────────────────────────

export interface QueuedBatch {
  id: string;
  actorParentId: Id;
  now: string;
  ops: Op[];
}

export const loadQueue = (): QueuedBatch[] => readJson<QueuedBatch[]>(KEY_QUEUE) ?? [];
export const saveQueue = (queue: readonly QueuedBatch[]): void =>
  write(KEY_QUEUE, JSON.stringify(queue));

// ── Entry-form conveniences ─────────────────────────────────────────────────

export interface Prefs {
  /** Pre-selected on the next new entry, so repeat logging is faster. */
  lastKidIds?: Id[];
}

export const loadPrefs = (): Prefs => readJson<Prefs>(KEY_PREFS) ?? {};
export const savePrefs = (prefs: Prefs): void => write(KEY_PREFS, JSON.stringify(prefs));

// ── Reset ───────────────────────────────────────────────────────────────────

/** Used when leaving a household or after rotating a code. */
export function clearAll(): void {
  [KEY_CODE, KEY_PARENT, KEY_STATE, KEY_QUEUE, KEY_PREFS].forEach(remove);
}
