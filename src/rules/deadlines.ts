/**
 * Date and deadline utilities with strict Asia/Kolkata (IST) day-first semantics.
 */

// Month name mappings in English and common Hindi transliterations/names
const MONTH_MAP: Record<string, number> = {
  jan: 1, january: 1, 'जनवरी': 1,
  feb: 2, february: 2, 'फ़रवरी': 2, 'फरवरी': 2,
  mar: 3, march: 3, 'मार्च': 3,
  apr: 4, april: 4, 'अप्रैल': 4,
  may: 5, 'मई': 5,
  jun: 6, june: 6, 'जून': 6,
  jul: 7, july: 7, 'जुलाई': 7,
  aug: 8, august: 8, 'अगस्त': 8,
  sep: 9, sept: 9, september: 9, 'सितंबर': 9,
  oct: 10, october: 10, 'अक्टूबर': 10, 'अक्तूबर': 10,
  nov: 11, november: 11, 'नवंबर': 11,
  dec: 12, december: 12, 'दिसंबर': 12,
};

/**
 * Format day/month/year to YYYY-MM-DD
 */
function toIsoDate(year: number, month: number, day: number): string | null {
  if (year < 2000 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  // Basic month length validation
  const maxDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > maxDays) return null;

  const y = String(year);
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parses dates strictly respecting Indian day-first conventions.
 * Supported patterns:
 * - DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY
 * - YYYY-MM-DD
 * - 31st October 2026, 31 October 2026, 31-Oct-2026
 * - October 31, 2026
 * - Hindi representations like "31 अक्टूबर 2026"
 */
export function parseIndianDate(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const text = raw.trim();

  // Pattern 1: ISO YYYY-MM-DD
  const isoMatch = text.match(/\b(20\d{2})[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])\b/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    return toIsoDate(y, m, d);
  }

  // Pattern 2: Indian day-first DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmyMatch = text.match(/\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](20\d{2})\b/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    const y = parseInt(dmyMatch[3], 10);
    return toIsoDate(y, m, d);
  }

  // Pattern 3: Day + Month Name + Year e.g. "31st October 2026", "31-Oct-2026", "31 Oct, 2026"
  const dayNameYearMatch = text.match(
    /\b(0?[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?[\s,-]+([A-Za-z\u0900-\u097F]+)[\s,-]+(20\d{2})\b/i
  );
  if (dayNameYearMatch) {
    const d = parseInt(dayNameYearMatch[1], 10);
    const monthKey = dayNameYearMatch[2].toLowerCase();
    const month = MONTH_MAP[monthKey];
    const y = parseInt(dayNameYearMatch[3], 10);
    if (month) {
      return toIsoDate(y, month, d);
    }
  }

  // Pattern 4: Month Name + Day + Year e.g. "October 31, 2026", "Oct 31 2026"
  const monthDayYearMatch = text.match(
    /\b([A-Za-z\u0900-\u097F]+)[\s,-]+(0?[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?[\s,-]+(20\d{2})\b/i
  );
  if (monthDayYearMatch) {
    const monthKey = monthDayYearMatch[1].toLowerCase();
    const month = MONTH_MAP[monthKey];
    const d = parseInt(monthDayYearMatch[2], 10);
    const y = parseInt(monthDayYearMatch[3], 10);
    if (month) {
      return toIsoDate(y, month, d);
    }
  }

  return null;
}

/**
 * Returns a Date object for the end-of-day in Asia/Kolkata (23:59:59.999 IST)
 * Asia/Kolkata is UTC+5:30, so 23:59:59 IST is 18:29:59 UTC on the same day.
 */
export function getEndOfDayIst(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  // 23:59:59.999 in IST (+05:30) is 18:29:59.999 UTC
  return new Date(Date.UTC(y, m - 1, d, 18, 29, 59, 999));
}

/**
 * Returns a Date object for 09:00:00.000 IST on a given ISO date.
 * 09:00:00 IST (+05:30) is 03:30:00 UTC.
 */
export function getNineAmIst(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 3, 30, 0, 0));
}

/**
 * Get the current date in Asia/Kolkata as an ISO string YYYY-MM-DD
 */
export function getTodayIst(now: Date = new Date()): string {
  // IST offset is +5.5 hours = 330 minutes
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffsetMs);
  return istTime.toISOString().slice(0, 10);
}

/**
 * Calculates calendar days left until the deadline in IST.
 * If today in IST is 2026-10-24 and deadline is 2026-10-31, days left = 7.
 * If today is 2026-10-31, days left = 0.
 * If past, returns negative.
 */
export function getDaysLeft(deadlineIso: string, fromDate: Date = new Date()): number {
  const todayIso = getTodayIst(fromDate);
  const [ty, tm, td] = todayIso.split('-').map(Number);
  const [dy, dm, dd] = deadlineIso.split('-').map(Number);

  const tUtc = Date.UTC(ty, tm - 1, td);
  const dUtc = Date.UTC(dy, dm - 1, dd);

  const diffMs = dUtc - tUtc;
  return Math.round(diffMs / (24 * 60 * 60 * 1000));
}

