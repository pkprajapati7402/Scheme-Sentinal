import { getNineAmIst } from './deadlines.js';

export const REMINDER_OFFSETS = [30, 14, 7, 3, 1, 0] as const;
export type ReminderOffset = (typeof REMINDER_OFFSETS)[number];

export type OffsetLabel = 'T-30' | 'T-14' | 'T-7' | 'T-3' | 'T-1' | 'T-0';

export interface PlannedReminder {
  offsetDays: ReminderOffset;
  offsetLabel: OffsetLabel;
  scheduledTime: Date; // 09:00 IST on (deadline - offsetDays)
  scheduledIsoIst: string; // ISO string with time
  dedupeKey: string;
}

export function getOffsetLabel(offset: ReminderOffset): OffsetLabel {
  return `T-${offset}` as OffsetLabel;
}

/**
 * Given a deadline in YYYY-MM-DD, compute all reminder schedules at 09:00 IST.
 * Offsets that are strictly in the past relative to `now` are skipped.
 */
export function planReminders(
  schemeId: string,
  deadlineIso: string,
  now: Date = new Date()
): PlannedReminder[] {
  const [dy, dm, dd] = deadlineIso.split('-').map(Number);
  const deadlineUtc = Date.UTC(dy, dm - 1, dd);

  const reminders: PlannedReminder[] = [];

  for (const offset of REMINDER_OFFSETS) {
    // Offset date: deadline - offset days
    const offsetTimeMs = deadlineUtc - offset * 24 * 60 * 60 * 1000;
    const offsetDate = new Date(offsetTimeMs);

    const year = offsetDate.getUTCFullYear();
    const month = String(offsetDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(offsetDate.getUTCDate()).padStart(2, '0');
    const targetIsoDate = `${year}-${month}-${day}`;

    // 09:00 IST on that target date
    const scheduledTime = getNineAmIst(targetIsoDate);

    // Skip if already past
    if (scheduledTime.getTime() <= now.getTime()) {
      continue;
    }

    const offsetLabel = getOffsetLabel(offset);
    const dedupeKey = `reminder:${schemeId}:${deadlineIso}:${offsetLabel}`;

    reminders.push({
      offsetDays: offset,
      offsetLabel,
      scheduledTime,
      scheduledIsoIst: `${targetIsoDate}T09:00:00+05:30`,
      dedupeKey,
    });
  }

  // Sort chronologically ascending
  reminders.sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());

  return reminders;
}

