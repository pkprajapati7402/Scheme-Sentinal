import { Hono } from 'hono';
import { getDatabase } from '../store/db.js';
import {
  SchemeStateRepository,
  ChangeRepository,
  AlertRepository,
  MetricRepository,
  DocumentRepository,
} from '../store/repositories.js';
import { getDaysLeft } from '../rules/deadlines.js';

export const api = new Hono();

// 1. Overview
api.get('/overview', (c) => {
  const db = getDatabase();
  const stateRepo = new SchemeStateRepository(db);
  const schemes = stateRepo.listAll();

  const overview = schemes.map((s) => {
    let deadlines: Record<string, any> = {};
    let conflicts: any[] = [];
    try {
      deadlines = JSON.parse(s.deadlinesJson || '{}');
      conflicts = JSON.parse(s.conflictsJson || '[]');
    } catch {}

    const freshDate = deadlines.freshApplication;
    const daysLeft = freshDate ? getDaysLeft(freshDate) : null;

    return {
      schemeId: s.schemeId,
      stage: s.stage,
      eligibility: s.eligibility,
      eligibilityReasons: s.eligibilityReasons,
      freshDeadline: freshDate,
      daysLeft,
      hasConflicts: conflicts.length > 0,
      updatedAt: s.updatedAt,
    };
  });

  return c.json({ success: true, count: overview.length, schemes: overview });
});

// 2. Scheme Detail
api.get('/schemes/:id', (c) => {
  const schemeId = c.req.param('id');
  const db = getDatabase();
  const stateRepo = new SchemeStateRepository(db);
  const alertRepo = new AlertRepository(db);
  const docRepo = new DocumentRepository(db);

  const state = stateRepo.findById(schemeId);
  if (!state) {
    return c.json({ success: false, error: 'Scheme not found' }, 404);
  }

  let deadlines: Record<string, any> = {};
  let conflicts: any[] = [];
  try {
    deadlines = JSON.parse(state.deadlinesJson || '{}');
    conflicts = JSON.parse(state.conflictsJson || '[]');
  } catch {}

  const allAlerts = alertRepo.listRecent(50);
  const schemeAlerts = allAlerts.filter((a) => a.schemeId === schemeId);
  const docs = docRepo.listAll();

  return c.json({
    success: true,
    scheme: {
      schemeId: state.schemeId,
      stage: state.stage,
      eligibility: state.eligibility,
      reasons: state.eligibilityReasons,
      deadlines,
      conflicts,
      updatedAt: state.updatedAt,
    },
    alerts: schemeAlerts,
    documents: docs,
  });
});

// 3. Changes
api.get('/changes', (c) => {
  const db = getDatabase();
  const changeRepo = new ChangeRepository(db);
  const changes = changeRepo.listRecent(20);

  return c.json({
    success: true,
    changes: changes.map((ch) => ({
      id: ch.id,
      sourceId: ch.source_id,
      material: Boolean(ch.material),
      reasons: ch.material_reasons ? ch.material_reasons.split('; ') : [],
      createdAt: ch.created_at,
    })),
  });
});

// 4. Alerts
api.get('/alerts', (c) => {
  const db = getDatabase();
  const alertRepo = new AlertRepository(db);
  const alerts = alertRepo.listRecent(50);
  return c.json({ success: true, count: alerts.length, alerts });
});

// 5. Metrics
api.get('/metrics', (c) => {
  const db = getDatabase();
  const metricRepo = new MetricRepository(db);
  const summary = metricRepo.getSummary();
  return c.json({ success: true, metrics: summary });
});

// 6. Documents Checklist
api.get('/docs', (c) => {
  const db = getDatabase();
  const docRepo = new DocumentRepository(db);
  const docs = docRepo.listAll();
  return c.json({ success: true, count: docs.length, documents: docs });
});

// 7. Workflow Signal
api.post('/signal/:schemeId', async (c) => {
  const schemeId = c.req.param('schemeId');
  const body = await c.req.json().catch(() => ({}));
  const action = body.action || 'applied';

  const db = getDatabase();
  const stateRepo = new SchemeStateRepository(db);
  const state = stateRepo.findById(schemeId);

  if (!state) {
    return c.json({ success: false, error: 'Scheme not found' }, 404);
  }

  if (action === 'applied') {
    state.stage = 'applied';
    state.updatedAt = new Date().toISOString();
    stateRepo.upsert(state);
    return c.json({ success: true, message: `Moved ${schemeId} to applied stage` });
  }

  if (action === 'stageAdvanced' && body.stage) {
    state.stage = body.stage;
    state.updatedAt = new Date().toISOString();
    stateRepo.upsert(state);
    return c.json({ success: true, message: `Stage advanced to ${body.stage}` });
  }

  return c.json({ success: true, message: 'Signal processed' });
});

