import { z } from 'zod';
import { Evidence, IsoDate } from './facts.js';

export const SchemeStage = z.enum([
  'discovered',
  'eligible',
  'docs_ready',
  'applied',
  'institute_verified',
  'state_verified',
  'disbursed',
  'closed_missed',
  'not_eligible',
]);
export type SchemeStage = z.infer<typeof SchemeStage>;

export const EligibilityVerdict = z.enum(['ELIGIBLE', 'NOT_ELIGIBLE', 'UNKNOWN']);
export type EligibilityVerdict = z.infer<typeof EligibilityVerdict>;

export const SchemeLevel = z.enum(['central', 'state']);
export type SchemeLevel = z.infer<typeof SchemeLevel>;

export const SchemePortal = z.enum(['nsp', 'state-portal', 'other']);
export type SchemePortal = z.infer<typeof SchemePortal>;

export const SchemeCriterion = z.object({
  value: z.any().nullable(),
  evidence: Evidence.nullable(),
});

export const SchemeDocumentRequirement = z.object({
  docType: z.string(),
  evidence: Evidence.nullable(),
});

export const SchemeDeadline = z.object({
  date: IsoDate,
  evidence: Evidence.nullable(),
});

export const Scheme = z.object({
  id: z.string(),
  name: z.string(),
  authority: z.string(),
  level: SchemeLevel,
  portal: SchemePortal,
  sourceIds: z.array(z.string()),
  academicYear: z.string(),
  criteria: z.record(z.string(), SchemeCriterion).default({}),
  documentsRequired: z.array(SchemeDocumentRequirement).default([]),
  deadlines: z.object({
    freshApplication: SchemeDeadline.nullable().default(null),
    renewal: SchemeDeadline.nullable().default(null),
    instituteVerification: SchemeDeadline.nullable().default(null),
    stateVerification: SchemeDeadline.nullable().default(null),
  }),
  lastVerifiedBy: z.string().default('human'),
  lastVerifiedAt: IsoDate,
});
export type Scheme = z.infer<typeof Scheme>;

export const SchemeState = z.object({
  schemeId: z.string(),
  stage: SchemeStage,
  eligibility: EligibilityVerdict,
  eligibilityReasons: z.array(z.string()).default([]),
  deadlinesJson: z.string().default('{}'),
  conflictsJson: z.string().default('[]'),
  updatedAt: z.string(),
});
export type SchemeState = z.infer<typeof SchemeState>;

