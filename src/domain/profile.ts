import { z } from 'zod';

export const CourseLevel = z.enum([
  'class9_10',
  'class11_12',
  'diploma',
  'ug',
  'pg',
  'phd',
]);
export type CourseLevel = z.infer<typeof CourseLevel>;

export const Category = z.enum(['general', 'obc', 'sc', 'st', 'ews']);
export type Category = z.infer<typeof Category>;

export const Gender = z.enum(['female', 'male', 'other']);
export type Gender = z.infer<typeof Gender>;

export const InstitutionType = z.enum(['government', 'aided', 'private', 'central']);
export type InstitutionType = z.infer<typeof InstitutionType>;

export const StudentProfile = z.object({
  id: z.string(), // e.g. "friend-1"
  displayName: z.string(), // used in messages
  fullNameOnDocuments: z.string(), // for name-mismatch checks (local only)
  language: z.enum(['en', 'hi']).default('en'),
  homeState: z.string(), // domicile state
  studyState: z.string(),
  courseLevel: CourseLevel,
  courseName: z.string(),
  yearOfStudy: z.number().int().min(1).max(8),
  institutionType: InstitutionType.optional(),
  category: Category.optional(), // optional + sensitive
  minority: z.boolean().optional(), // optional + sensitive
  gender: Gender.optional(),
  hasDisability: z.boolean().optional(),
  annualFamilyIncomeInr: z.number().int().nonnegative().optional(), // optional + sensitive
  lastExamPercent: z.number().min(0).max(100).optional(),
  bankAccountAadhaarSeeded: z.boolean().optional(), // boolean only
  isRenewal: z.record(z.string(), z.boolean()).default({}), // schemeId -> renewal?
  telegramChatId: z.string().optional(),
});

export type StudentProfile = z.infer<typeof StudentProfile>;

