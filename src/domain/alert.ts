import { z } from 'zod';

export const AlertType = z.enum([
  'reminder',
  'deadline_changed',
  'status_changed',
  'criteria_changed',
  'conflict',
  'doc_issue',
  'discovery',
]);
export type AlertType = z.infer<typeof AlertType>;

export const AlertSeverity = z.enum(['info', 'warning', 'critical']);
export type AlertSeverity = z.infer<typeof AlertSeverity>;

export const Alert = z.object({
  id: z.string(),
  schemeId: z.string().nullable().default(null),
  type: AlertType,
  severity: AlertSeverity,
  dedupeKey: z.string().min(1),
  sourceUrl: z.string().url(),
  quote: z.string().min(8),
  trustTier: z.number().int().min(1).max(3),
  textEn: z.string().min(1),
  textHi: z.string().nullable().optional(),
  channel: z.enum(['telegram', 'system']).default('telegram'),
  sentAt: z.string().nullable().default(null),
  ackedAt: z.string().nullable().default(null),
});
export type Alert = z.infer<typeof Alert>;

