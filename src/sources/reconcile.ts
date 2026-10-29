import { VerifiedFacts } from '../domain/facts.js';

export interface FieldConflict {
  field: string;
  officialValue?: any;
  officialSourceUrl?: string;
  officialQuote?: string;
  aggregatorValue?: any;
  aggregatorSourceUrl?: string;
  aggregatorQuote?: string;
  message: string;
}

export interface ReconciledSchemeFacts {
  schemeId: string;
  deadlines: {
    status?: string | null;
    freshApplication?: string | null;
    renewal?: string | null;
    instituteVerification?: string | null;
    stateVerification?: string | null;
    noticeType?: string | null;
  };
  criteria: Record<string, any>;
  documentsRequired: string[];
  conflicts: FieldConflict[];
  highestTrustTier: number;
  primarySourceUrl: string;
  primaryQuote: string;
  unverifiedReportOnly: boolean;
}

/**
 * Reconciles multiple verified fact sets from different sources for a scheme.
 * Resolves conflicts by Trust Tier: Tier 1 (Official) > Tier 2 > Tier 3.
 */
export function reconcileFacts(
  schemeId: string,
  factSets: VerifiedFacts[],
  baselineDeadlines: Record<string, any> = {}
): ReconciledSchemeFacts {
  if (factSets.length === 0) {
    return {
      schemeId,
      deadlines: baselineDeadlines,
      criteria: {},
      documentsRequired: [],
      conflicts: [],
      highestTrustTier: 3,
      primarySourceUrl: '',
      primaryQuote: '',
      unverifiedReportOnly: false,
    };
  }

  // Sort by trust tier ascending (1 official is first, 3 aggregator is last)
  const sorted = [...factSets].sort((a, b) => a.trustTier - b.trustTier);

  const highestTrustTier = sorted[0].trustTier;
  const isOnlyLowTrust = sorted.every((f) => f.trustTier > 1);

  const conflicts: FieldConflict[] = [];

  // 1. Reconcile Deadlines
  const deadlineFields = [
    'freshApplication',
    'renewal',
    'instituteVerification',
    'stateVerification',
  ] as const;

  const resolvedDeadlines: Record<string, any> = { ...baselineDeadlines };
  let primarySourceUrl = sorted[0].sourceUrl;
  let primaryQuote = '';

  for (const field of deadlineFields) {
    const reports = sorted
      .map((f) => ({
        tier: f.trustTier,
        val: f.deadlines?.[field]?.value ?? null,
        evidence: f.deadlines?.[field]?.evidence,
      }))
      .filter((r) => r.val !== null);

    if (reports.length === 0) {
      continue;
    }

    const officialReport = reports.find((r) => r.tier === 1);
    const lowTrustReports = reports.filter((r) => r.tier > 1);

    if (officialReport) {
      resolvedDeadlines[field] = officialReport.val;
      primarySourceUrl = officialReport.evidence?.sourceUrl || primarySourceUrl;
      primaryQuote = officialReport.evidence?.quote || primaryQuote;

      // Check for conflict with aggregators
      for (const aggr of lowTrustReports) {
        if (aggr.val !== officialReport.val) {
          conflicts.push({
            field,
            officialValue: officialReport.val,
            officialSourceUrl: officialReport.evidence?.sourceUrl,
            officialQuote: officialReport.evidence?.quote,
            aggregatorValue: aggr.val,
            aggregatorSourceUrl: aggr.evidence?.sourceUrl,
            aggregatorQuote: aggr.evidence?.quote,
            message: `Official portal says ${officialReport.val}; aggregator (${aggr.evidence?.sourceUrl}) says ${aggr.val}. The official source takes priority.`,
          });
        }
      }
    } else {
      // Only low-trust reports available: do NOT overwrite baseline date unless baseline is null
      if (!resolvedDeadlines[field] && reports.length > 0) {
        resolvedDeadlines[field] = reports[0].val;
        primaryQuote = reports[0].evidence?.quote || primaryQuote;
      }
    }
  }

  // Notice type and status
  const statusReport = sorted.find((f) => f.deadlines?.status?.value);
  if (statusReport?.deadlines?.status) {
    resolvedDeadlines.status = statusReport.deadlines.status.value;
    if (!primaryQuote && statusReport.deadlines.status.evidence) {
      primaryQuote = statusReport.deadlines.status.evidence.quote;
    }
  }

  const noticeReport = sorted.find((f) => f.deadlines?.noticeType?.value);
  if (noticeReport?.deadlines?.noticeType) {
    resolvedDeadlines.noticeType = noticeReport.deadlines.noticeType.value;
  }

  // 2. Reconcile Criteria
  const resolvedCriteria: Record<string, any> = {};
  for (const facts of sorted) {
    if (!facts.criteria) continue;
    for (const [key, val] of Object.entries(facts.criteria)) {
      if (val && !resolvedCriteria[key]) {
        resolvedCriteria[key] = val;
      }
    }
  }

  // 3. Reconcile Documents
  const docSet = new Set<string>();
  for (const facts of sorted) {
    if (facts.documents?.documentsRequired) {
      for (const d of facts.documents.documentsRequired) {
        if (d && d.value) {
          docSet.add(d.value);
        }
      }
    }
  }

  return {
    schemeId,
    deadlines: resolvedDeadlines,
    criteria: resolvedCriteria,
    documentsRequired: Array.from(docSet),
    conflicts,
    highestTrustTier,
    primarySourceUrl,
    primaryQuote,
    unverifiedReportOnly: isOnlyLowTrust,
  };
}

