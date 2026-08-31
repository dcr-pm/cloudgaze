import {
  AUDIT_LIMIT,
  type AuditRecord,
  type Entry,
  type FamilyState,
  type Id,
  type Instant,
  type Op,
} from './types';

/**
 * The single reducer. The server runs it inside the compare-and-swap loop
 * (after zod validation); the client runs the identical function for its
 * optimistic update. Client and server therefore cannot disagree about what an
 * op means.
 *
 * CRITICAL: this must be PURE and RE-RUNNABLE. It is re-invoked from scratch on
 * every CAS retry against freshly-read state, so it must contain no Date.now(),
 * no crypto.randomUUID(), and no captured mutable state. Timestamps and IDs
 * come in as arguments.
 */

/** Soft-deleted entries are purged after this long, to bound document growth. */
const PURGE_AFTER_DAYS = 90;

export interface ApplyContext {
  actorParentId: Id;
  /** Supplied by the caller, not read from the clock, so retries are identical. */
  now: Instant;
  /**
   * Deterministic id source for audit records. Must produce the same sequence
   * for the same (ops, now) pair — the default derives ids from the op index.
   */
  auditIdFor?: (index: number) => Id;
}

export function applyOps(
  state: FamilyState,
  ops: readonly Op[],
  ctx: ApplyContext,
): FamilyState {
  let entries = state.entries;
  let household = state.household;
  const newAudit: AuditRecord[] = [];

  const auditId =
    ctx.auditIdFor ?? ((i: number) => `${ctx.now}#${ctx.actorParentId}#${i}`);

  const record = (
    index: number,
    action: AuditRecord['action'],
    summary: string,
    entryId?: Id,
  ) => {
    const rec: AuditRecord = {
      id: auditId(index),
      at: ctx.now,
      byParentId: ctx.actorParentId,
      action,
      summary,
    };
    if (entryId !== undefined) rec.entryId = entryId;
    newAudit.push(rec);
  };

  ops.forEach((op, i) => {
    switch (op.type) {
      case 'upsertEntry': {
        const incoming = op.entry;
        const existingIndex = entries.findIndex((e) => e.id === incoming.id);
        const existing = existingIndex >= 0 ? entries[existingIndex] : undefined;

        // Preserve the original authorship. A later edit by the other parent
        // must not rewrite who first created the entry.
        const merged: Entry = {
          ...incoming,
          createdAt: existing?.createdAt ?? incoming.createdAt,
          createdByParentId:
            existing?.createdByParentId ?? ctx.actorParentId,
          updatedAt: ctx.now,
          updatedByParentId: ctx.actorParentId,
        } as Entry;

        if (existing) {
          entries = entries.map((e, idx) => (idx === existingIndex ? merged : e));
          record(i, 'update', `Updated ${describe(merged)}`, merged.id);
        } else {
          entries = [...entries, merged];
          record(i, 'create', `Added ${describe(merged)}`, merged.id);
        }
        break;
      }

      case 'deleteEntry': {
        const target = entries.find((e) => e.id === op.id);
        if (!target || target.deletedAt) break;
        entries = entries.map((e) =>
          e.id === op.id
            ? { ...e, deletedAt: ctx.now, updatedAt: ctx.now, updatedByParentId: ctx.actorParentId }
            : e,
        );
        record(i, 'delete', `Deleted ${describe(target)}`, op.id);
        break;
      }

      case 'restoreEntry': {
        const target = entries.find((e) => e.id === op.id);
        if (!target || !target.deletedAt) break;
        entries = entries.map((e) => {
          if (e.id !== op.id) return e;
          const { deletedAt: _removed, ...rest } = e;
          return {
            ...rest,
            updatedAt: ctx.now,
            updatedByParentId: ctx.actorParentId,
          } as Entry;
        });
        record(i, 'restore', `Restored ${describe(target)}`, op.id);
        break;
      }

      case 'setReimbursed': {
        const ids = new Set(op.ids);
        let changed = 0;
        entries = entries.map((e) => {
          if (e.kind !== 'expense' || !ids.has(e.id)) return e;
          if (e.reimbursed === op.reimbursed) return e;
          changed++;
          const next = {
            ...e,
            reimbursed: op.reimbursed,
            updatedAt: ctx.now,
            updatedByParentId: ctx.actorParentId,
          };
          if (op.reimbursed) {
            next.reimbursedAt = ctx.now;
          } else {
            delete next.reimbursedAt;
          }
          return next;
        });
        if (changed > 0) {
          record(
            i,
            'settle',
            op.reimbursed
              ? `Marked ${changed} expense${changed === 1 ? '' : 's'} settled`
              : `Reopened ${changed} expense${changed === 1 ? '' : 's'}`,
          );
        }
        break;
      }

      case 'updateHousehold': {
        const patch = op.patch;
        household = {
          ...household,
          ...(patch.timezone !== undefined ? { timezone: patch.timezone } : {}),
          ...(patch.parents !== undefined ? { parents: patch.parents } : {}),
          ...(patch.kids !== undefined ? { kids: patch.kids } : {}),
        };
        record(i, 'household', summariseHouseholdPatch(patch));
        break;
      }
    }
  });

  if (newAudit.length === 0 && entries === state.entries && household === state.household) {
    return state;
  }

  return {
    ...state,
    household,
    entries: purgeExpired(entries, ctx.now),
    audit: [...state.audit, ...newAudit].slice(-AUDIT_LIMIT),
    updatedAt: ctx.now,
  };
}

/** Drop soft-deleted entries once they're past the retention window. */
function purgeExpired(entries: readonly Entry[], now: Instant): Entry[] {
  const cutoff = new Date(now).getTime() - PURGE_AFTER_DAYS * 86_400_000;
  if (!Number.isFinite(cutoff)) return [...entries];
  return entries.filter(
    (e) => !e.deletedAt || new Date(e.deletedAt).getTime() > cutoff,
  );
}

function summariseHouseholdPatch(patch: {
  timezone?: string;
  parents?: unknown;
  kids?: unknown;
}): string {
  const parts: string[] = [];
  if (patch.parents) parts.push('parents');
  if (patch.kids) parts.push('kids');
  if (patch.timezone) parts.push('timezone');
  return parts.length ? `Updated household ${parts.join(', ')}` : 'Updated household';
}

/** Short human description used in audit summaries. */
export function describe(entry: Entry): string {
  switch (entry.kind) {
    case 'plan':
      return `plan: ${entry.title}`;
    case 'activity':
      return `activity: ${entry.name}`;
    case 'expense':
      return `expense: ${entry.description} ${formatCentsPlain(entry.amountCents)}`;
  }
}

/** Locale-independent, for audit strings that are stored rather than rendered. */
function formatCentsPlain(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** A fresh, empty document for a brand-new household. */
export function emptyState(
  household: FamilyState['household'],
  now: Instant,
): FamilyState {
  return {
    schemaVersion: 1,
    household,
    entries: [],
    audit: [
      {
        id: `${now}#init`,
        at: now,
        byParentId: household.parents[0].id,
        action: 'household',
        summary: 'Household created',
      },
    ],
    updatedAt: now,
  };
}
