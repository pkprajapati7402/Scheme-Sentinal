import { StudentProfile } from '../domain/profile.js';

export const DOCUMENT_TYPES = [
  'income_certificate',
  'category_certificate',
  'domicile_certificate',
  'bonafide_certificate',
  'marksheet_last_exam',
  'bank_passbook_or_statement',
  'photo',
  'disability_certificate',
  'other',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export type DocumentStatus = 'missing' | 'have' | 'expiring' | 'expired' | 'mismatch';

export interface DocumentRecord {
  docType: DocumentType;
  status: DocumentStatus;
  issuedOn?: string | null;
  validUntil?: string | null;
  nameOnDocument?: string | null;
  notes?: string;
}

export interface SchemeDocChecklist {
  schemeId: string;
  schemeName: string;
  requiredDocs: Array<{
    docType: DocumentType;
    status: DocumentStatus;
    reason: string;
  }>;
  totalRequired: number;
  readyCount: number;
  allReady: boolean;
}

/**
 * Evaluates document validity status given issue and expiry dates.
 */
export function evaluateDocumentStatus(
  doc: { issuedOn?: string | null; validUntil?: string | null },
  now: Date = new Date()
): DocumentStatus {
  if (!doc.validUntil) {
    return doc.issuedOn ? 'have' : 'missing';
  }

  const [vy, vm, vd] = doc.validUntil.split('-').map(Number);
  const expiryTime = Date.UTC(vy, vm - 1, vd, 23, 59, 59);
  const diffDays = (expiryTime - now.getTime()) / (24 * 60 * 60 * 1000);

  if (diffDays < 0) {
    return 'expired';
  }
  if (diffDays <= 30) {
    return 'expiring';
  }
  return 'have';
}

/**
 * Checks name match between certificate and student profile with token fuzzy matching.
 */
export function checkNameMatch(
  nameOnDocument: string,
  profileFullName: string
): { matches: boolean; confidence: number; flagForReview: boolean } {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const docTokens = norm(nameOnDocument).split(' ').filter(Boolean);
  const profileTokens = norm(profileFullName).split(' ').filter(Boolean);

  if (norm(nameOnDocument) === norm(profileFullName)) {
    return { matches: true, confidence: 1.0, flagForReview: false };
  }

  // Count matching name tokens (handles initials or middle name omission)
  let shared = 0;
  for (const t of docTokens) {
    if (profileTokens.includes(t)) {
      shared++;
    }
  }

  const confidence = shared / Math.max(docTokens.length, profileTokens.length);

  // If first and last name match or confidence >= 0.66
  if (confidence >= 0.66) {
    return { matches: true, confidence, flagForReview: false };
  }

  return { matches: false, confidence, flagForReview: true };
}

