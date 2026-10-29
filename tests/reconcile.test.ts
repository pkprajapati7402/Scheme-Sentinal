import { describe, it, expect } from 'vitest';
import { reconcileFacts } from '../src/sources/reconcile.js';
import { VerifiedFacts } from '../src/domain/facts.js';

describe('Trust-Tier Reconciliation', () => {
  it('official source (Tier 1) takes priority over aggregator (Tier 3) on conflict', () => {
    const officialFacts: VerifiedFacts = {
      schemeId: 'nsp-sc',
      sourceId: 'nsp-official',
      trustTier: 1,
      sourceUrl: 'https://scholarships.gov.in/scheme/sc',
      snapshotId: 'snap-1',
      extractedAt: new Date().toISOString(),
      deadlines: {
        status: { value: 'open', evidence: { quote: 'Portal is open for applications', sourceUrl: 'https://scholarships.gov.in/scheme/sc', snapshotId: 'snap-1' } },
        freshApplication: { value: '2026-10-31', evidence: { quote: 'Last date is 31-10-2026', sourceUrl: 'https://scholarships.gov.in/scheme/sc', snapshotId: 'snap-1' } },
        renewal: null,
        instituteVerification: null,
        stateVerification: null,
        noticeType: null,
      },
    };

    const aggregatorFacts: VerifiedFacts = {
      schemeId: 'nsp-sc',
      sourceId: 'aggregator-buddy',
      trustTier: 3,
      sourceUrl: 'https://buddy4study.com/scheme',
      snapshotId: 'snap-2',
      extractedAt: new Date().toISOString(),
      deadlines: {
        status: null,
        freshApplication: { value: '2026-10-15', evidence: { quote: 'Deadline: 15 Oct 2026', sourceUrl: 'https://buddy4study.com/scheme', snapshotId: 'snap-2' } },
        renewal: null,
        instituteVerification: null,
        stateVerification: null,
        noticeType: null,
      },
    };

    const reconciled = reconcileFacts('nsp-sc', [aggregatorFacts, officialFacts]);

    // Tier 1 wins
    expect(reconciled.deadlines.freshApplication).toBe('2026-10-31');
    expect(reconciled.highestTrustTier).toBe(1);

    // Conflict is logged
    expect(reconciled.conflicts).toHaveLength(1);
    expect(reconciled.conflicts[0].officialValue).toBe('2026-10-31');
    expect(reconciled.conflicts[0].aggregatorValue).toBe('2026-10-15');
    expect(reconciled.conflicts[0].message).toContain('Official portal says 2026-10-31');
  });

  it('marks unverifiedReportOnly if only tier 3 sources are present', () => {
    const aggregatorFacts: VerifiedFacts = {
      schemeId: 'nsp-sc',
      sourceId: 'aggregator-buddy',
      trustTier: 3,
      sourceUrl: 'https://buddy4study.com/scheme',
      snapshotId: 'snap-2',
      extractedAt: new Date().toISOString(),
      deadlines: {
        status: null,
        freshApplication: { value: '2026-11-15', evidence: { quote: 'Extended to 15 Nov', sourceUrl: 'https://buddy4study.com/scheme', snapshotId: 'snap-2' } },
        renewal: null,
        instituteVerification: null,
        stateVerification: null,
        noticeType: null,
      },
    };

    const reconciled = reconcileFacts('nsp-sc', [aggregatorFacts]);
    expect(reconciled.unverifiedReportOnly).toBe(true);
    expect(reconciled.highestTrustTier).toBe(3);
  });
});

