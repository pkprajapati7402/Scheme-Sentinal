import { z } from 'zod';

export const Evidence = z.object({
  quote: z.string().min(8), // MUST be a verbatim substring of the normalised page text
  sourceUrl: z.string().url(),
  snapshotId: z.string(),
});
export type Evidence = z.infer<typeof Evidence>;

export function Sourced<T extends z.ZodTypeAny>(schema: T) {
  return z.object({
    value: schema,
    evidence: Evidence,
  });
}

export type SourcedValue<T> = {
  value: T;
  evidence: Evidence;
};

export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const DeadlineStatus = z.enum(['upcoming', 'open', 'closed', 'extended', 'unknown']);
export type DeadlineStatus = z.infer<typeof DeadlineStatus>;

export const NoticeType = z.enum([
  'extension',
  'revision',
  'new_scheme',
  'corrigendum',
  'none',
]);
export type NoticeType = z.infer<typeof NoticeType>;

export const DeadlineFacts = z.object({
  status: Sourced(DeadlineStatus).nullable().default(null),
  freshApplication: Sourced(IsoDate).nullable().default(null),
  renewal: Sourced(IsoDate).nullable().default(null),
  instituteVerification: Sourced(IsoDate).nullable().default(null),
  stateVerification: Sourced(IsoDate).nullable().default(null),
  noticeType: Sourced(NoticeType).nullable().default(null),
});
export type DeadlineFacts = z.infer<typeof DeadlineFacts>;

export const GenderRestriction = z.enum(['female_only', 'none']);
export type GenderRestriction = z.infer<typeof GenderRestriction>;

export const CriteriaFacts = z.object({
  courseLevels: Sourced(z.array(z.string())).nullable().default(null),
  categories: Sourced(z.array(z.string())).nullable().default(null),
  states: Sourced(z.array(z.string())).nullable().default(null),
  maxFamilyIncomeInr: Sourced(z.number()).nullable().default(null),
  minPercent: Sourced(z.number()).nullable().default(null),
  genderRestriction: Sourced(GenderRestriction).nullable().default(null),
  disabilityRequired: Sourced(z.boolean()).nullable().default(null),
  otherConditions: z.array(Sourced(z.string())).default([]),
});
export type CriteriaFacts = z.infer<typeof CriteriaFacts>;

export const DocumentFacts = z.object({
  documentsRequired: z.array(Sourced(z.string())).default([]),
});
export type DocumentFacts = z.infer<typeof DocumentFacts>;

export const VerifiedFacts = z.object({
  schemeId: z.string(),
  deadlines: DeadlineFacts.optional(),
  criteria: CriteriaFacts.optional(),
  documents: DocumentFacts.optional(),
  sourceId: z.string(),
  trustTier: z.number().int().min(1).max(3),
  sourceUrl: z.string().url(),
  snapshotId: z.string(),
  extractedAt: z.string(),
});
export type VerifiedFacts = z.infer<typeof VerifiedFacts>;

