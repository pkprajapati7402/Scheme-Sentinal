import { describe, it, expect } from 'vitest';
import { planReminders, REMINDER_OFFSETS } from '../src/rules/reminders.js';
import { getNineAmIst } from '../src/rules/deadlines.js';

describe('Reminder Planning', () => {
  const schemeId = 'nsp-post-matric-sc';
  const deadline = '2026-10-31';

  it('generates all standard offsets (T-30, T-14, T-7, T-3, T-1, T-0) when planned well in advance', () => {
    // Current time: 2026-09-01 (before T-30, which is 2026-10-01)
    const now = new Date('2026-09-01T00:00:00Z');
    const reminders = planReminders(schemeId, deadline, now);

    expect(reminders).toHaveLength(6);
    expect(reminders.map((r) => r.offsetDays)).toEqual([30, 14, 7, 3, 1, 0]);
    expect(reminders.map((r) => r.offsetLabel)).toEqual([
      'T-30',
      'T-14',
      'T-7',
      'T-3',
      'T-1',
      'T-0',
    ]);
  });

  it('schedules each reminder at exactly 09:00 IST', () => {
    const now = new Date('2026-09-01T00:00:00Z');
    const reminders = planReminders(schemeId, deadline, now);

    for (const r of reminders) {
      expect(r.scheduledIsoIst).toMatch(/T09:00:00\+05:30$/);
      // In UTC, 09:00 IST is 03:30 UTC
      expect(r.scheduledTime.getUTCHours()).toBe(3);
      expect(r.scheduledTime.getUTCMinutes()).toBe(30);
    }
  });

  it('formats dedupe keys consistently for idempotency', () => {
    const now = new Date('2026-09-01T00:00:00Z');
    const reminders = planReminders(schemeId, deadline, now);

    expect(reminders[0].dedupeKey).toBe('reminder:nsp-post-matric-sc:2026-10-31:T-30');
    expect(reminders[2].dedupeKey).toBe('reminder:nsp-post-matric-sc:2026-10-31:T-7');
    expect(reminders[5].dedupeKey).toBe('reminder:nsp-post-matric-sc:2026-10-31:T-0');
  });

  it('skips past offsets automatically', () => {
    // On 2026-10-25 at 12:00 IST (after T-7 on 2026-10-24 09:00 IST)
    const now = new Date('2026-10-25T06:30:00Z');
    const reminders = planReminders(schemeId, deadline, now);

    // Remaining should be T-3 (28 Oct), T-1 (30 Oct), T-0 (31 Oct)
    expect(reminders.map((r) => r.offsetLabel)).toEqual(['T-3', 'T-1', 'T-0']);
  });

  it('returns empty list if deadline is already past', () => {
    // Current time: 2026-11-05
    const now = new Date('2026-11-05T00:00:00Z');
    const reminders = planReminders(schemeId, deadline, now);
    expect(reminders).toHaveLength(0);
  });

  it('re-planning on deadline extension generates updated offsets and keys', () => {
    const extendedDeadline = '2026-11-30';
    const now = new Date('2026-10-25T06:30:00Z');
    const reminders = planReminders(schemeId, extendedDeadline, now);

    // T-30 for 30 Nov is 31 Oct, which is in the future! So all 6 offsets should be present
    expect(reminders).toHaveLength(6);
    expect(reminders[0].dedupeKey).toBe('reminder:nsp-post-matric-sc:2026-11-30:T-30');
  });
});

