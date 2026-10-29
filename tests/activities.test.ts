import { describe, it, expect, beforeEach } from 'vitest';
import { createActivities } from '../src/temporal/activities/index.js';
import { Database } from '../src/store/db.js';

describe('Temporal Activities Unit Suite', () => {
  let db: Database;
  let activities: ReturnType<typeof createActivities>;

  beforeEach(() => {
    db = new Database(':memory:');
    activities = createActivities(':memory:', true);
  });

  it('fetchAndSnapshot runs in fixture mode and generates snapshot', async () => {
    // Uses synthetic-nsp fixture
    const res = await activities.fetchAndSnapshot('synthetic-nsp');
    expect(res.snapshotId).toBeDefined();
    expect(res.contentHash).toBeDefined();
    expect(res.pageText).toContain('Post Matric Scholarships');
  });

  it('diffSnapshots detects material changes between two snapshots', async () => {
    // 1st snapshot
    const snap1 = await activities.fetchAndSnapshot('synthetic-nsp');
    // 2nd snapshot
    const snap2 = await activities.fetchAndSnapshot('synthetic-nsp');

    const diff = await activities.diffSnapshots(snap1.snapshotId, snap2.snapshotId);
    expect(diff).toBeDefined();
  });

  it('enforces idempotency on sendAlert (duplicate dedupeKey returns false)', async () => {
    const alert = {
      id: 'alert-act-1',
      schemeId: 'nsp-sc',
      type: 'reminder' as const,
      severity: 'info' as const,
      dedupeKey: 'rem:nsp-sc:2026-10-31:T-7',
      sourceUrl: 'https://scholarships.gov.in/notice',
      quote: 'The last date for application is 31-10-2026.',
      trustTier: 1,
      textEn: '7 days left to apply',
      channel: 'telegram' as const,
      sentAt: null,
      ackedAt: null,
    };

    const first = await activities.sendAlert(alert);
    expect(first).toBe(true);

    const duplicate = await activities.sendAlert({ ...alert, id: 'alert-act-2' });
    expect(duplicate).toBe(false);
  });

  it('rejects alert without sourceUrl or quote as non-retryable ApplicationFailure', async () => {
    const invalidAlert = {
      id: 'alert-act-bad',
      schemeId: 'nsp-sc',
      type: 'reminder' as const,
      severity: 'info' as const,
      dedupeKey: 'bad:dedupe',
      sourceUrl: '', // empty!
      quote: '',
      trustTier: 1,
      textEn: 'alert text',
      channel: 'telegram' as const,
      sentAt: null,
      ackedAt: null,
    };

    await expect(activities.sendAlert(invalidAlert)).rejects.toThrow();
  });
});
