import { describe, it, expect, beforeEach } from 'vitest';
import { Database } from '../src/store/db.js';
import {
  SourceRepository,
  SnapshotRepository,
  ChangeRepository,
  SchemeStateRepository,
  AlertRepository,
  MetricRepository,
} from '../src/store/repositories.js';
import { Alert } from '../src/domain/alert.js';

describe('SQLite Store & Repositories', () => {
  let db: Database;
  let sourceRepo: SourceRepository;
  let snapRepo: SnapshotRepository;
  let alertRepo: AlertRepository;
  let metricRepo: MetricRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    sourceRepo = new SourceRepository(db);
    snapRepo = new SnapshotRepository(db);
    alertRepo = new AlertRepository(db);
    metricRepo = new MetricRepository(db);
  });

  it('upserts and retrieves sources', () => {
    sourceRepo.upsert({
      id: 'nsp-main',
      url: 'https://scholarships.gov.in/',
      kind: 'html',
      trust_tier: 1,
      poll_minutes: 360,
    });

    const s = sourceRepo.findById('nsp-main');
    expect(s).not.toBeNull();
    expect(s?.trust_tier).toBe(1);
  });

  it('enforces idempotency on AlertRepository.insertWithDedupe', () => {
    const alert: Alert = {
      id: 'alt-1',
      schemeId: 'nsp-sc',
      type: 'reminder',
      severity: 'info',
      dedupeKey: 'reminder:nsp-sc:2026-10-31:T-7',
      sourceUrl: 'https://scholarships.gov.in/notice',
      quote: 'The last date for application is 31-10-2026.',
      trustTier: 1,
      textEn: '7 days left to apply',
      channel: 'telegram',
      sentAt: null,
      ackedAt: null,
    };

    // First insert succeeds
    const insertedFirst = alertRepo.insertWithDedupe(alert);
    expect(insertedFirst).toBe(true);

    // Second insert with SAME dedupeKey is ignored
    const duplicate = { ...alert, id: 'alt-2' };
    const insertedSecond = alertRepo.insertWithDedupe(duplicate);
    expect(insertedSecond).toBe(false);

    const alerts = alertRepo.listRecent();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].id).toBe('alt-1');
  });

  it('rejects alerts without sourceUrl, quote, or trustTier (Hard Rule 4)', () => {
    const invalidAlert: Alert = {
      id: 'alt-bad',
      schemeId: 'nsp-sc',
      type: 'reminder',
      severity: 'info',
      dedupeKey: 'bad:key',
      sourceUrl: '', // missing
      quote: '',
      trustTier: 1,
      textEn: 'bad alert',
      channel: 'telegram',
      sentAt: null,
      ackedAt: null,
    };

    expect(() => alertRepo.insertWithDedupe(invalidAlert)).toThrow(
      /Cannot create alert without sourceUrl, quote, or trustTier/
    );
  });

  it('aggregates metrics in MetricRepository', () => {
    metricRepo.record({
      id: 'm1',
      kind: 'watch',
      started_at: new Date().toISOString(),
      duration_ms: 250,
      llm_calls: 0,
      skipped_by_diff: 1,
      input_tokens: 0,
      output_tokens: 0,
      cost_inr: 0,
    });

    metricRepo.record({
      id: 'm2',
      kind: 'watch',
      started_at: new Date().toISOString(),
      duration_ms: 1200,
      llm_calls: 3,
      skipped_by_diff: 0,
      input_tokens: 4500,
      output_tokens: 320,
      cost_inr: 0,
    });

    const summary = metricRepo.getSummary();
    expect(summary.totalChecks).toBe(2);
    expect(summary.skippedByDiff).toBe(1);
    expect(summary.skippedPercent).toBe(50);
    expect(summary.totalLlmCalls).toBe(3);
    expect(summary.inputTokens).toBe(4500);
  });
});
