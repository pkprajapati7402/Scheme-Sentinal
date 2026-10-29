import { Database } from './db.js';
import { Alert } from '../domain/alert.js';
import { SchemeState } from '../domain/scheme.js';

export interface SourceRow {
  id: string;
  url: string;
  kind: 'html' | 'pdf' | 'rss';
  trust_tier: number;
  poll_minutes: number;
  last_etag?: string | null;
  last_checked_at?: string | null;
}

export interface SnapshotRow {
  id: string;
  source_id: string;
  fetched_at: string;
  content_hash: string;
  normalized_text: string;
  raw_path?: string | null;
  http_status?: number | null;
  fixture?: number;
}

export interface ChangeRow {
  id: string;
  source_id: string;
  from_snapshot?: string | null;
  to_snapshot: string;
  diff_json: string;
  material: number;
  material_reasons?: string | null;
  created_at: string;
}

export interface ExtractionRow {
  id: string;
  snapshot_id: string;
  scheme_id?: string | null;
  model: string;
  prompt_version: string;
  pass: string;
  output_json: string;
  verified_json: string;
  dropped_fields?: string | null;
  latency_ms?: number | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  created_at: string;
}

export interface DocumentRow {
  id: string;
  doc_type: string;
  status: 'missing' | 'have' | 'expiring' | 'expired' | 'mismatch';
  issued_on?: string | null;
  valid_until?: string | null;
  local_path?: string | null;
  check_json?: string | null;
  updated_at: string;
}

export interface RunMetricRow {
  id: string;
  workflow_id?: string | null;
  kind: string;
  started_at: string;
  duration_ms: number;
  llm_calls: number;
  skipped_by_diff: number;
  input_tokens: number;
  output_tokens: number;
  cost_inr: number;
}

export class SourceRepository {
  constructor(private db: Database) {}

  upsert(source: SourceRow): void {
    const stmt = this.db.prepare(`
      INSERT INTO source (id, url, kind, trust_tier, poll_minutes, last_etag, last_checked_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        url = excluded.url,
        kind = excluded.kind,
        trust_tier = excluded.trust_tier,
        poll_minutes = excluded.poll_minutes,
        last_etag = COALESCE(excluded.last_etag, source.last_etag),
        last_checked_at = COALESCE(excluded.last_checked_at, source.last_checked_at)
    `);
    stmt.run(
      source.id,
      source.url,
      source.kind,
      source.trust_tier,
      source.poll_minutes,
      source.last_etag ?? null,
      source.last_checked_at ?? null
    );
  }

  updateChecked(id: string, checkedAt: string, etag?: string | null): void {
    const stmt = this.db.prepare(`
      UPDATE source SET last_checked_at = ?, last_etag = COALESCE(?, last_etag) WHERE id = ?
    `);
    stmt.run(checkedAt, etag ?? null, id);
  }

  findById(id: string): SourceRow | null {
    const stmt = this.db.prepare(`SELECT * FROM source WHERE id = ?`);
    const row = stmt.get(id);
    return (row as SourceRow) ?? null;
  }

  listAll(): SourceRow[] {
    const stmt = this.db.prepare(`SELECT * FROM source ORDER BY id ASC`);
    return stmt.all() as unknown as SourceRow[];
  }
}

export class SnapshotRepository {
  constructor(private db: Database) {}

  insert(snap: SnapshotRow): void {
    const stmt = this.db.prepare(`
      INSERT INTO snapshot (id, source_id, fetched_at, content_hash, normalized_text, raw_path, http_status, fixture)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      snap.id,
      snap.source_id,
      snap.fetched_at,
      snap.content_hash,
      snap.normalized_text,
      snap.raw_path ?? null,
      snap.http_status ?? 200,
      snap.fixture ?? 0
    );
  }

  findLatestBySource(sourceId: string): SnapshotRow | null {
    const stmt = this.db.prepare(`
      SELECT * FROM snapshot WHERE source_id = ? ORDER BY fetched_at DESC LIMIT 1
    `);
    const row = stmt.get(sourceId);
    return (row as SnapshotRow) ?? null;
  }

  findById(id: string): SnapshotRow | null {
    const stmt = this.db.prepare(`SELECT * FROM snapshot WHERE id = ?`);
    const row = stmt.get(id);
    return (row as SnapshotRow) ?? null;
  }
}

export class ChangeRepository {
  constructor(private db: Database) {}

  insert(change: ChangeRow): void {
    const stmt = this.db.prepare(`
      INSERT INTO change (id, source_id, from_snapshot, to_snapshot, diff_json, material, material_reasons, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      change.id,
      change.source_id,
      change.from_snapshot ?? null,
      change.to_snapshot,
      change.diff_json,
      change.material,
      change.material_reasons ?? null,
      change.created_at
    );
  }

  listRecent(limit: number = 20): ChangeRow[] {
    const stmt = this.db.prepare(`
      SELECT * FROM change ORDER BY created_at DESC LIMIT ?
    `);
    return stmt.all(limit) as unknown as ChangeRow[];
  }
}

export class ExtractionRepository {
  constructor(private db: Database) {}

  insert(ext: ExtractionRow): void {
    const stmt = this.db.prepare(`
      INSERT INTO extraction (id, snapshot_id, scheme_id, model, prompt_version, pass, output_json, verified_json, dropped_fields, latency_ms, input_tokens, output_tokens, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      ext.id,
      ext.snapshot_id,
      ext.scheme_id ?? null,
      ext.model,
      ext.prompt_version,
      ext.pass,
      ext.output_json,
      ext.verified_json,
      ext.dropped_fields ?? null,
      ext.latency_ms ?? null,
      ext.input_tokens ?? null,
      ext.output_tokens ?? null,
      ext.created_at
    );
  }

  listBySnapshot(snapshotId: string): ExtractionRow[] {
    const stmt = this.db.prepare(`
      SELECT * FROM extraction WHERE snapshot_id = ? ORDER BY created_at ASC
    `);
    return stmt.all(snapshotId) as unknown as ExtractionRow[];
  }
}

export class SchemeStateRepository {
  constructor(private db: Database) {}

  upsert(state: SchemeState): void {
    const stmt = this.db.prepare(`
      INSERT INTO scheme_state (scheme_id, stage, eligibility, eligibility_reasons, deadlines_json, conflicts_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(scheme_id) DO UPDATE SET
        stage = excluded.stage,
        eligibility = excluded.eligibility,
        eligibility_reasons = excluded.eligibility_reasons,
        deadlines_json = excluded.deadlines_json,
        conflicts_json = excluded.conflicts_json,
        updated_at = excluded.updated_at
    `);
    stmt.run(
      state.schemeId,
      state.stage,
      state.eligibility,
      JSON.stringify(state.eligibilityReasons),
      state.deadlinesJson,
      state.conflictsJson,
      state.updatedAt
    );
  }

  findById(schemeId: string): SchemeState | null {
    const stmt = this.db.prepare(`SELECT * FROM scheme_state WHERE scheme_id = ?`);
    const row = stmt.get(schemeId) as any;
    if (!row) return null;
    return {
      schemeId: row.scheme_id,
      stage: row.stage,
      eligibility: row.eligibility,
      eligibilityReasons: JSON.parse(row.eligibility_reasons || '[]'),
      deadlinesJson: row.deadlines_json,
      conflictsJson: row.conflicts_json,
      updatedAt: row.updated_at,
    };
  }

  listAll(): SchemeState[] {
    const stmt = this.db.prepare(`SELECT * FROM scheme_state ORDER BY scheme_id ASC`);
    const rows = stmt.all() as any[];
    return rows.map((row) => ({
      schemeId: row.scheme_id,
      stage: row.stage,
      eligibility: row.eligibility,
      eligibilityReasons: JSON.parse(row.eligibility_reasons || '[]'),
      deadlinesJson: row.deadlines_json,
      conflictsJson: row.conflicts_json,
      updatedAt: row.updated_at,
    }));
  }
}

export class AlertRepository {
  constructor(private db: Database) {}

  /**
   * Idempotent insert: only returns true if a NEW row was inserted.
   * If dedupe_key already exists, it is ignored and returns false.
   */
  insertWithDedupe(alert: Alert): boolean {
    // Validate hard rule 4: No source, no alert
    if (!alert.sourceUrl || !alert.quote || !alert.trustTier) {
      throw new Error(
        `Cannot create alert without sourceUrl, quote, or trustTier. Scheme: ${alert.schemeId}`
      );
    }

    const check = this.db.prepare(`SELECT id FROM alert WHERE dedupe_key = ?`).get(alert.dedupeKey);
    if (check) {
      return false;
    }

    const stmt = this.db.prepare(`
      INSERT INTO alert (id, scheme_id, type, severity, dedupe_key, source_url, quote, trust_tier, text_en, text_hi, channel, sent_at, acked_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      alert.id,
      alert.schemeId ?? null,
      alert.type,
      alert.severity,
      alert.dedupeKey,
      alert.sourceUrl,
      alert.quote,
      alert.trustTier,
      alert.textEn,
      alert.textHi ?? null,
      alert.channel,
      alert.sentAt ?? null,
      alert.ackedAt ?? null
    );
    return true;
  }

  markSent(id: string, sentAt: string = new Date().toISOString()): void {
    const stmt = this.db.prepare(`UPDATE alert SET sent_at = ? WHERE id = ?`);
    stmt.run(sentAt, id);
  }

  markAcked(id: string, ackedAt: string = new Date().toISOString()): void {
    const stmt = this.db.prepare(`UPDATE alert SET acked_at = ? WHERE id = ?`);
    stmt.run(ackedAt, id);
  }

  listRecent(limit: number = 50): Alert[] {
    const stmt = this.db.prepare(`SELECT * FROM alert ORDER BY sent_at DESC, id DESC LIMIT ?`);
    const rows = stmt.all(limit) as any[];
    return rows.map((r) => ({
      id: r.id,
      schemeId: r.scheme_id,
      type: r.type,
      severity: r.severity,
      dedupeKey: r.dedupe_key,
      sourceUrl: r.source_url,
      quote: r.quote,
      trustTier: r.trust_tier,
      textEn: r.text_en,
      textHi: r.text_hi,
      channel: r.channel,
      sentAt: r.sent_at,
      ackedAt: r.acked_at,
    }));
  }
}

export class DocumentRepository {
  constructor(private db: Database) {}

  upsert(doc: DocumentRow): void {
    const stmt = this.db.prepare(`
      INSERT INTO document (id, doc_type, status, issued_on, valid_until, local_path, check_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        doc_type = excluded.doc_type,
        status = excluded.status,
        issued_on = excluded.issued_on,
        valid_until = excluded.valid_until,
        local_path = excluded.local_path,
        check_json = excluded.check_json,
        updated_at = excluded.updated_at
    `);
    stmt.run(
      doc.id,
      doc.doc_type,
      doc.status,
      doc.issued_on ?? null,
      doc.valid_until ?? null,
      doc.local_path ?? null,
      doc.check_json ?? null,
      doc.updated_at
    );
  }

  listAll(): DocumentRow[] {
    const stmt = this.db.prepare(`SELECT * FROM document ORDER BY doc_type ASC`);
    return stmt.all() as unknown as DocumentRow[];
  }

  findByType(docType: string): DocumentRow | null {
    const stmt = this.db.prepare(`SELECT * FROM document WHERE doc_type = ? LIMIT 1`);
    const row = stmt.get(docType);
    return (row as DocumentRow) ?? null;
  }
}

export class MetricRepository {
  constructor(private db: Database) {}

  record(metric: RunMetricRow): void {
    const stmt = this.db.prepare(`
      INSERT INTO run_metric (id, workflow_id, kind, started_at, duration_ms, llm_calls, skipped_by_diff, input_tokens, output_tokens, cost_inr)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      metric.id,
      metric.workflow_id ?? null,
      metric.kind,
      metric.started_at,
      metric.duration_ms,
      metric.llm_calls,
      metric.skipped_by_diff,
      metric.input_tokens,
      metric.output_tokens,
      metric.cost_inr
    );
  }

  getSummary() {
    const totalChecks = (this.db.prepare(`SELECT COUNT(*) as c FROM run_metric WHERE kind = 'watch'`).get() as any)?.c || 0;
    const skipped = (this.db.prepare(`SELECT SUM(skipped_by_diff) as s FROM run_metric WHERE kind = 'watch'`).get() as any)?.s || 0;
    const llmCalls = (this.db.prepare(`SELECT SUM(llm_calls) as l FROM run_metric`).get() as any)?.l || 0;
    const inTokens = (this.db.prepare(`SELECT SUM(input_tokens) as t FROM run_metric`).get() as any)?.t || 0;
    const outTokens = (this.db.prepare(`SELECT SUM(output_tokens) as t FROM run_metric`).get() as any)?.t || 0;

    const latencies = (this.db.prepare(`SELECT duration_ms FROM run_metric WHERE kind = 'extract' ORDER BY duration_ms ASC`).all() as any[])
      .map((r) => r.duration_ms);

    let p50 = 0;
    let p95 = 0;
    if (latencies.length > 0) {
      p50 = latencies[Math.floor(latencies.length * 0.5)];
      p95 = latencies[Math.floor(latencies.length * 0.95)];
    }

    const totalAlerts = (this.db.prepare(`SELECT COUNT(*) as a FROM alert`).get() as any)?.a || 0;
    const tier1Alerts = (this.db.prepare(`SELECT COUNT(*) as a FROM alert WHERE trust_tier = 1`).get() as any)?.a || 0;

    return {
      totalChecks,
      skippedByDiff: skipped,
      skippedPercent: totalChecks > 0 ? (skipped / totalChecks) * 100 : 0,
      totalLlmCalls: llmCalls,
      inputTokens: inTokens,
      outputTokens: outTokens,
      latencyP50Ms: p50,
      latencyP95Ms: p95,
      totalAlerts,
      tier1Alerts,
    };
  }
}

