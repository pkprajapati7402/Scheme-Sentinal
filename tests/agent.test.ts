import { describe, it, expect, beforeEach } from 'vitest';
import {
  getProfileSummaryTool,
  listSchemesTool,
  getUpcomingDeadlinesTool,
} from '../src/agent/tools/index.js';
import { redactSensitiveData } from '../src/observability/metrics.js';
import { getDatabase } from '../src/store/db.js';
import { SchemeStateRepository } from '../src/store/repositories.js';

describe('Mastra Tools & Observability', () => {
  beforeEach(() => {
    const db = getDatabase(':memory:');
    const repo = new SchemeStateRepository(db);
    repo.upsert({
      schemeId: 'test-scheme-1',
      stage: 'eligible',
      eligibility: 'ELIGIBLE',
      eligibilityReasons: ['Meets all criteria'],
      deadlinesJson: JSON.stringify({ freshApplication: '2026-10-31' }),
      conflictsJson: '[]',
      updatedAt: new Date().toISOString(),
    });
  });

  it('getProfileSummaryTool returns student information without sensitive raw identifiers', async () => {
    const res = await (getProfileSummaryTool.execute as any)({});
    expect(res.courseLevel).toBe('ug');
    expect(res).not.toHaveProperty('aadhaar');
    expect(res).not.toHaveProperty('bankAccount');
  });

  it('redactSensitiveData masks Aadhaar numbers and sensitive tokens', () => {
    const textWithAadhaar = 'Student Aadhaar number is 1234 5678 9012 for verification';
    const redacted = redactSensitiveData(textWithAadhaar);
    expect(redacted).not.toContain('1234 5678 9012');
    expect(redacted).toContain('XXXX-XXXX-XXXX');

    const textWithSecret = 'Config has token: secret_abc123';
    expect(redactSensitiveData(textWithSecret)).toContain('token=REDACTED');
  });
});

