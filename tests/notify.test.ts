import { describe, it, expect } from 'vitest';
import {
  formatReminderAlertEn,
  formatReminderAlertHi,
  formatDeadlineChangedAlertEn,
  validateAlertEvidence,
} from '../src/notify/templates.js';

describe('Notification Templates & Hard Rule 4 Evidence Guard', () => {
  const validReminder = {
    schemeName: 'Post Matric SC Scholarship',
    deadline: '2026-10-31',
    daysLeft: 7,
    eligibilityLabel: 'Eligible',
    eligibilityLabelHi: 'पात्र',
    docsReady: 4,
    docsTotal: 5,
    sourceUrl: 'https://scholarships.gov.in/scheme/sc',
    quote: 'The last date for submission of online application is 31-10-2026.',
    trustLabel: 'Official',
    trustLabelHi: 'आधिकारिक',
  };

  it('formats English reminder with all mandatory evidence components', () => {
    const text = formatReminderAlertEn(validReminder);
    expect(text).toContain('⏰ Post Matric SC Scholarship: last date 2026-10-31 (7 days left)');
    expect(text).toContain('Source (Official): https://scholarships.gov.in/scheme/sc');
    expect(text).toContain('"The last date for submission of online application is 31-10-2026."');
    expect(text).toContain('Please verify on the official portal before acting.');
  });

  it('formats Hindi reminder with verified Hindi phrasing and quote', () => {
    const text = formatReminderAlertHi(validReminder);
    expect(text).toContain('अंतिम तिथि 2026-10-31');
    expect(text).toContain('स्रोत (आधिकारिक): https://scholarships.gov.in/scheme/sc');
    expect(text).toContain('"The last date for submission of online application is 31-10-2026."');
    expect(text).toContain('कृपया कार्रवाई से पहले आधिकारिक पोर्टल पर तारीख़ ज़रूर जाँच लें।');
  });

  it('formats deadline changed alert with before and after dates', () => {
    const text = formatDeadlineChangedAlertEn({
      schemeName: 'Post Matric SC',
      oldDate: '2026-10-31',
      newDate: '2026-11-30',
      sourceUrl: 'https://scholarships.gov.in/notice',
      quote: 'Application deadline extended up to 30-11-2026.',
      trustLabel: 'Official',
    });

    expect(text).toContain('last date changed 2026-10-31 → 2026-11-30');
    expect(text).toContain('https://scholarships.gov.in/notice');
  });

  it('enforces Hard Rule 4: throws if sourceUrl is missing or invalid', () => {
    expect(() =>
      validateAlertEvidence('', 'valid quote that is long enough', 'Official')
    ).toThrow(/Hard Rule 4 Violation/);

    expect(() =>
      validateAlertEvidence('ftp://invalid', 'valid quote that is long enough', 'Official')
    ).toThrow(/Hard Rule 4 Violation/);
  });

  it('enforces Hard Rule 4: throws if quote is missing or too short', () => {
    expect(() =>
      validateAlertEvidence('https://gov.in', 'short', 'Official')
    ).toThrow(/Hard Rule 4 Violation/);
  });

  it('enforces Hard Rule 4: throws if trustLabel is missing', () => {
    expect(() =>
      validateAlertEvidence('https://gov.in', 'Valid quote text from the notice', '')
    ).toThrow(/Hard Rule 4 Violation/);
  });
});

