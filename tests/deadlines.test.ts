import { describe, it, expect } from 'vitest';
import {
  parseIndianDate,
  getEndOfDayIst,
  getNineAmIst,
  getTodayIst,
  getDaysLeft,
} from '../src/rules/deadlines.js';

describe('Deadlines & Indian Date Parsing', () => {
  describe('parseIndianDate', () => {
    it('parses standard ISO YYYY-MM-DD', () => {
      expect(parseIndianDate('2026-10-31')).toBe('2026-10-31');
    });

    it('parses Indian DD-MM-YYYY (day-first, never month-first)', () => {
      expect(parseIndianDate('31-10-2026')).toBe('2026-10-31');
      expect(parseIndianDate('05-08-2026')).toBe('2026-08-05');
      // Crucial Indian format test: 01-02-2026 must be 1st Feb, NOT 2nd Jan
      expect(parseIndianDate('01-02-2026')).toBe('2026-02-01');
    });

    it('parses DD/MM/YYYY with slashes', () => {
      expect(parseIndianDate('31/10/2026')).toBe('2026-10-31');
      expect(parseIndianDate('15/07/2026')).toBe('2026-07-15');
    });

    it('parses DD.MM.YYYY with dots', () => {
      expect(parseIndianDate('31.10.2026')).toBe('2026-10-31');
    });

    it('parses English day-first with month name', () => {
      expect(parseIndianDate('31st October 2026')).toBe('2026-10-31');
      expect(parseIndianDate('31 October 2026')).toBe('2026-10-31');
      expect(parseIndianDate('15th August 2026')).toBe('2026-08-15');
      expect(parseIndianDate('1st Jan 2026')).toBe('2026-01-01');
      expect(parseIndianDate('3-Nov-2026')).toBe('2026-11-03');
    });

    it('parses English month-first formats', () => {
      expect(parseIndianDate('October 31, 2026')).toBe('2026-10-31');
      expect(parseIndianDate('Oct 31 2026')).toBe('2026-10-31');
    });

    it('parses Hindi month names', () => {
      expect(parseIndianDate('31 अक्टूबर 2026')).toBe('2026-10-31');
      expect(parseIndianDate('15 अगस्त 2026')).toBe('2026-08-15');
      expect(parseIndianDate('30 सितंबर 2026')).toBe('2026-09-30');
    });

    it('rejects invalid dates and February 31st', () => {
      expect(parseIndianDate('31-02-2026')).toBeNull();
      expect(parseIndianDate('32-01-2026')).toBeNull();
      expect(parseIndianDate('15-13-2026')).toBeNull();
      expect(parseIndianDate('random text without date')).toBeNull();
      expect(parseIndianDate('')).toBeNull();
    });
  });

  describe('IST End of Day & 9 AM semantics', () => {
    it('computes end of day 23:59:59.999 IST as 18:29:59.999 UTC', () => {
      const eod = getEndOfDayIst('2026-10-31');
      expect(eod.toISOString()).toBe('2026-10-31T18:29:59.999Z');
    });

    it('computes 09:00:00 IST as 03:30:00 UTC', () => {
      const nineAm = getNineAmIst('2026-10-31');
      expect(nineAm.toISOString()).toBe('2026-10-31T03:30:00.000Z');
    });

    it('determines today in IST', () => {
      // 2026-10-31 at 20:00 UTC is already 2026-11-01 in IST (+5:30)
      const lateUtc = new Date('2026-10-31T20:00:00Z');
      expect(getTodayIst(lateUtc)).toBe('2026-11-01');

      // 2026-10-31 at 01:00 UTC is still 2026-10-31 in IST
      const morningUtc = new Date('2026-10-31T01:00:00Z');
      expect(getTodayIst(morningUtc)).toBe('2026-10-31');
    });

    it('calculates calendar days left until deadline', () => {
      const from = new Date('2026-10-24T05:00:00Z'); // 24 Oct
      expect(getDaysLeft('2026-10-31', from)).toBe(7);
      expect(getDaysLeft('2026-10-24', from)).toBe(0);
      expect(getDaysLeft('2026-10-20', from)).toBe(-4);
    });
  });
});

