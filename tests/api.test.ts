import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../src/api/server.js';
import { Database, setDatabase } from '../src/store/db.js';
import {
  SchemeStateRepository,
  DocumentRepository,
  AlertRepository,
} from '../src/store/repositories.js';

describe('Hono API Endpoints Suite', () => {
  beforeEach(() => {
    const db = new Database(':memory:');
    setDatabase(db);
    const stateRepo = new SchemeStateRepository(db);
    const docRepo = new DocumentRepository(db);
    const alertRepo = new AlertRepository(db);

    stateRepo.upsert({
      schemeId: 'nsp-sc',
      stage: 'eligible',
      eligibility: 'ELIGIBLE',
      eligibilityReasons: ['Course level matches UG/PG', 'Income is under ₹2.5L limit'],
      deadlinesJson: JSON.stringify({
        freshApplication: '2026-10-31',
        instituteVerification: '2026-11-15',
      }),
      conflictsJson: '[]',
      updatedAt: new Date().toISOString(),
    });

    docRepo.upsert({
      id: 'doc-income',
      doc_type: 'income_certificate',
      status: 'have',
      issued_on: '2026-04-01',
      valid_until: '2027-03-31',
      updated_at: new Date().toISOString(),
    });

    alertRepo.insertWithDedupe({
      id: 'alert-1',
      schemeId: 'nsp-sc',
      type: 'reminder',
      severity: 'info',
      dedupeKey: 'rem:nsp-sc:2026-10-31:T-7',
      sourceUrl: 'https://scholarships.gov.in/scheme/sc',
      quote: 'The last date for application is 31-10-2026.',
      trustTier: 1,
      textEn: '7 days left to apply',
      channel: 'telegram',
      sentAt: new Date().toISOString(),
      ackedAt: null,
    });
  });

  it('GET /api/overview returns tracked schemes with days left', async () => {
    const res = await app.request('/api/overview');
    expect(res.status).toBe(200);

    const data = (await res.json()) as any;
    expect(data.success).toBe(true);
    expect(data.schemes.length).toBeGreaterThan(0);
    expect(data.schemes[0].schemeId).toBe('nsp-sc');
    expect(data.schemes[0].freshDeadline).toBe('2026-10-31');
  });

  it('GET /api/schemes/:id returns detail, deadlines, and alerts', async () => {
    const res = await app.request('/api/schemes/nsp-sc');
    expect(res.status).toBe(200);

    const data = (await res.json()) as any;
    expect(data.success).toBe(true);
    expect(data.scheme.schemeId).toBe('nsp-sc');
    expect(data.scheme.deadlines.freshApplication).toBe('2026-10-31');
    expect(data.alerts.length).toBeGreaterThan(0);
  });

  it('GET /api/docs returns document checklist', async () => {
    const res = await app.request('/api/docs');
    expect(res.status).toBe(200);

    const data = (await res.json()) as any;
    expect(data.success).toBe(true);
    expect(data.documents.some((d: any) => d.doc_type === 'income_certificate')).toBe(true);
  });

  it('GET /api/metrics returns aggregated metrics', async () => {
    const res = await app.request('/api/metrics');
    expect(res.status).toBe(200);

    const data = (await res.json()) as any;
    expect(data.success).toBe(true);
    expect(data.metrics).toBeDefined();
  });

  it('POST /api/signal/:schemeId advances stage to applied', async () => {
    const res = await app.request('/api/signal/nsp-sc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'applied' }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);

    const detailRes = await app.request('/api/schemes/nsp-sc');
    const detail = (await detailRes.json()) as any;
    expect(detail.scheme.stage).toBe('applied');
  });
});
