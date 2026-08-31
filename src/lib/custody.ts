import type { Entry, Id, PlanEntry } from '../../shared/types';
import { atLocal } from './dates';

/**
 * "Who's got the kid right now."
 *
 * There is no custody-schedule model in v1, so this is derived from 🏠 Handoff
 * plan entries: a handoff records that the kid transfers to `withParentId` at
 * that date and time, and current custody is whichever handoff most recently
 * took effect. When nothing has been logged we say so rather than guessing — a
 * wrong answer here is worse than no answer.
 *
 * A real rotation schedule (week-on/week-off, 2-2-3) is the obvious next step.
 */

export interface CustodyStatus {
  kidId: Id;
  parentId: Id | null;
  /** When the current arrangement started. */
  since: Date | null;
  /** The next scheduled handoff, if one is on the calendar. */
  nextHandoffAt: Date | null;
  nextParentId: Id | null;
}

interface Handoff {
  at: Date;
  to: Id;
}

function handoffsForKid(entries: readonly Entry[], kidId: Id): Handoff[] {
  return entries
    .filter(
      (e): e is PlanEntry =>
        e.kind === 'plan' &&
        e.category === 'handoff' &&
        !e.deletedAt &&
        e.kidIds.includes(kidId) &&
        Boolean(e.withParentId),
    )
    .map((e) => ({ at: atLocal(e.date, e.startTime ?? '00:00'), to: e.withParentId! }))
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

export function custodyFor(
  entries: readonly Entry[],
  kidId: Id,
  now: Date = new Date(),
): CustodyStatus {
  const handoffs = handoffsForKid(entries, kidId);
  const past = handoffs.filter((h) => h.at <= now);
  const future = handoffs.filter((h) => h.at > now);

  const current = past.at(-1) ?? null;
  const next = future[0] ?? null;

  return {
    kidId,
    parentId: current?.to ?? null,
    since: current?.at ?? null,
    nextHandoffAt: next?.at ?? null,
    nextParentId: next?.to ?? null,
  };
}

export function custodyForAll(
  entries: readonly Entry[],
  kidIds: readonly Id[],
  now: Date = new Date(),
): CustodyStatus[] {
  return kidIds.map((id) => custodyFor(entries, id, now));
}

/**
 * True when every kid is with the same parent, which lets the banner collapse
 * to one line instead of one per kid.
 */
export function allWithSameParent(statuses: readonly CustodyStatus[]): Id | null {
  if (statuses.length === 0) return null;
  const first = statuses[0]!.parentId;
  if (!first) return null;
  return statuses.every((s) => s.parentId === first) ? first : null;
}
