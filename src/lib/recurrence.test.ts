import { describe, expect, it } from 'vitest';
import { expandActivities, activityRunsOn, seasonStatus } from './recurrence';
import type { ActivityEntry } from '../../shared/types';

function activity(over: Partial<ActivityEntry> = {}): ActivityEntry {
  return {
    kind: 'activity',
    id: 'a1',
    kidIds: ['kid'],
    createdAt: '2026-08-01T00:00:00.000Z',
    createdByParentId: 'p0',
    updatedAt: '2026-08-01T00:00:00.000Z',
    updatedByParentId: 'p0',
    name: 'Soccer',
    emoji: '⚽',
    weekdays: [2, 4], // Tue & Thu
    startTime: '17:00',
    durationMinutes: 60,
    seasonStart: '2026-09-01',
    seasonEnd: '2026-11-30',
    ...over,
  };
}

describe('expandActivities', () => {
  it('emits one occurrence per matching weekday in the window', () => {
    // 2026-09-01 is a Tuesday. Tue+Thu across the first week.
    const out = expandActivities([activity()], '2026-09-01', '2026-09-07');
    expect(out.map((o) => o.date)).toEqual(['2026-09-01', '2026-09-03']);
  });

  it('computes the end time from the duration', () => {
    const out = expandActivities([activity()], '2026-09-01', '2026-09-01');
    expect(out[0]).toMatchObject({ startTime: '17:00', endTime: '18:00' });
  });

  it('clamps to the season, not the requested window', () => {
    // Window is all of August; season does not start until September.
    const before = expandActivities([activity()], '2026-08-01', '2026-08-31');
    expect(before).toHaveLength(0);

    // Window spans the season start; only the in-season days appear.
    const spanning = expandActivities([activity()], '2026-08-25', '2026-09-03');
    expect(spanning.map((o) => o.date)).toEqual(['2026-09-01', '2026-09-03']);
  });

  it('clamps to the season end', () => {
    const a = activity({ seasonEnd: '2026-09-03' });
    const out = expandActivities([a], '2026-09-01', '2026-09-30');
    expect(out.map((o) => o.date)).toEqual(['2026-09-01', '2026-09-03']);
  });

  it('treats a null season end as open-ended', () => {
    const a = activity({ seasonEnd: null });
    const out = expandActivities([a], '2027-06-01', '2027-06-07');
    expect(out.length).toBeGreaterThan(0);
  });

  it('returns nothing when the season does not overlap the window', () => {
    const out = expandActivities([activity()], '2027-01-01', '2027-01-31');
    expect(out).toHaveLength(0);
  });

  it('skips dates listed as exceptions', () => {
    const a = activity({ exceptions: ['2026-09-03'] });
    const out = expandActivities([a], '2026-09-01', '2026-09-07');
    expect(out.map((o) => o.date)).toEqual(['2026-09-01']);
  });

  it('omits soft-deleted activities', () => {
    const a = activity({ deletedAt: '2026-08-15T00:00:00.000Z' });
    expect(expandActivities([a], '2026-09-01', '2026-09-30')).toHaveLength(0);
  });

  it('omits activities with no weekdays set', () => {
    const a = activity({ weekdays: [] });
    expect(expandActivities([a], '2026-09-01', '2026-09-30')).toHaveLength(0);
  });

  it('handles an inverted window without hanging', () => {
    expect(expandActivities([activity()], '2026-09-30', '2026-09-01')).toEqual([]);
  });

  it('sorts by date then start time across several activities', () => {
    const soccer = activity({ id: 'a1', weekdays: [2], startTime: '17:00' });
    const piano = activity({ id: 'a2', weekdays: [2], startTime: '09:00', emoji: '🎹' });
    const out = expandActivities([soccer, piano], '2026-09-01', '2026-09-01');
    expect(out.map((o) => o.activityId)).toEqual(['a2', 'a1']);
  });

  it('produces stable synthetic ids', () => {
    const a = expandActivities([activity()], '2026-09-01', '2026-09-01');
    const b = expandActivities([activity()], '2026-09-01', '2026-09-01');
    expect(a[0]!.id).toBe('a1@2026-09-01');
    expect(a[0]!.id).toBe(b[0]!.id);
  });

  it('covers every weekday when all seven are selected', () => {
    const a = activity({ weekdays: [0, 1, 2, 3, 4, 5, 6] });
    const out = expandActivities([a], '2026-09-01', '2026-09-07');
    expect(out).toHaveLength(7);
  });

  it('crosses a DST boundary without dropping or duplicating a day', () => {
    // US DST ends 2026-11-01 (clocks go back). A midnight-anchored loop can
    // stall or repeat here; the noon anchor must not.
    const a = activity({
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      seasonStart: '2026-10-30',
      seasonEnd: '2026-11-03',
    });
    const out = expandActivities([a], '2026-10-30', '2026-11-03');
    expect(out.map((o) => o.date)).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
    ]);
  });

  it('crosses a spring-forward boundary without dropping a day', () => {
    // US DST begins 2027-03-14.
    const a = activity({
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      seasonStart: '2027-03-12',
      seasonEnd: '2027-03-16',
    });
    const out = expandActivities([a], '2027-03-12', '2027-03-16');
    expect(out.map((o) => o.date)).toEqual([
      '2027-03-12',
      '2027-03-13',
      '2027-03-14',
      '2027-03-15',
      '2027-03-16',
    ]);
  });

  it('clamps an end time that would run past midnight', () => {
    const a = activity({ startTime: '23:30', durationMinutes: 120 });
    const out = expandActivities([a], '2026-09-01', '2026-09-01');
    expect(out[0]!.endTime).toBe('23:59');
  });
});

describe('activityRunsOn', () => {
  it('is true on an in-season matching weekday', () => {
    expect(activityRunsOn(activity(), '2026-09-01')).toBe(true);
  });

  it('is false on a non-matching weekday', () => {
    expect(activityRunsOn(activity(), '2026-09-02')).toBe(false);
  });

  it('is false outside the season and on exception dates', () => {
    expect(activityRunsOn(activity(), '2026-08-25')).toBe(false);
    expect(activityRunsOn(activity(), '2026-12-01')).toBe(false);
    expect(
      activityRunsOn(activity({ exceptions: ['2026-09-01'] }), '2026-09-01'),
    ).toBe(false);
  });
});

describe('seasonStatus', () => {
  it('reports upcoming, active and ended', () => {
    expect(seasonStatus(activity(), '2026-08-01')).toBe('upcoming');
    expect(seasonStatus(activity(), '2026-10-01')).toBe('active');
    expect(seasonStatus(activity(), '2026-12-25')).toBe('ended');
    expect(seasonStatus(activity({ seasonEnd: null }), '2030-01-01')).toBe('active');
  });
});
