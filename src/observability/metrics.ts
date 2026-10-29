import { getDatabase } from '../store/db.js';
import { MetricRepository } from '../store/repositories.js';
import { config } from '../config.js';

export function redactSensitiveData(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input
    // Mask potential Aadhaar numbers (12 digits)
    .replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, 'XXXX-XXXX-XXXX')
    // Mask bank account numbers (9 to 18 digits)
    .replace(/\b\d{9,18}\b/g, (match) => 'X'.repeat(match.length - 4) + match.slice(-4))
    // Mask passwords/tokens
    .replace(/(password|token|secret|otp)\s*[:=]\s*\S+/gi, '$1=REDACTED');
}

export interface TraceSpan {
  id: string;
  workflowId?: string;
  kind: 'watch' | 'extract' | 'notify' | 'qa';
  startedAt: string;
  durationMs: number;
  llmCalls: number;
  skippedByDiff: number;
  inputTokens: number;
  outputTokens: number;
  costInr: number;
  metadata?: Record<string, any>;
}

export function recordTraceSpan(span: TraceSpan): void {
  const db = getDatabase();
  const repo = new MetricRepository(db);

  repo.record({
    id: span.id,
    workflow_id: span.workflowId || null,
    kind: span.kind,
    started_at: span.startedAt,
    duration_ms: span.durationMs,
    llm_calls: span.llmCalls,
    skipped_by_diff: span.skippedByDiff,
    input_tokens: span.inputTokens,
    output_tokens: span.outputTokens,
    cost_inr: span.costInr,
  });

  if (config.SENTRY_DSN) {
    // Sentry agent tracing span hook
    // If SENTRY_DSN is provided and TRACE_CAPTURE_IO is true, record I/O; otherwise redact
  }
}

