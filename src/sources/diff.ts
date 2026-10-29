import { diffArrays } from 'diff';

export interface DiffResult {
  added: string[];
  removed: string[];
  material: boolean;
  materialReasons: string[];
  diffJson: string;
}

const MATERIAL_KEYWORDS = [
  'last date',
  'extended',
  'extension',
  'revised',
  'corrigendum',
  'notice',
  'open',
  'closed',
  'deadline',
  'verification',
  'last date to apply',
  'fresh application',
  'renewal',
  // Hindi keywords
  'अंतिम तिथि',
  'बढ़ाई',
  'संशोधित',
  'विस्तार',
  'सूचना',
  'तिथि',
];

const DATE_REGEX = /\b(?:\d{1,2}[-/.](?:\d{1,2}|[A-Za-z\u0900-\u097F]+)[-/.]\d{2,4}|\d{4}-\d{2}-\d{2}|(?:[A-Za-z\u0900-\u097F]+)\s+\d{1,2},\s*\d{4})\b/i;
const NUMBER_CRITERIA_REGEX = /(?:₹|rs\.?|inr|lakh|lac|crore|percent|%|\b\d{5,7}\b)/i;

/**
 * Evaluates whether a sentence contains meaningful scheme updates (dates, amounts, criteria, status).
 */
export function isSentenceMaterial(sentence: string): { isMaterial: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const lower = sentence.toLowerCase();

  // Keyword check
  for (const kw of MATERIAL_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) {
      reasons.push(`Contains keyword: "${kw}"`);
    }
  }

  // Date pattern check
  if (DATE_REGEX.test(sentence)) {
    reasons.push('Contains date pattern');
  }

  // Financial / percentage / boundary number check
  if (NUMBER_CRITERIA_REGEX.test(sentence)) {
    reasons.push('Contains financial amount, percentage or threshold');
  }

  return {
    isMaterial: reasons.length > 0,
    reasons,
  };
}

/**
 * Computes sentence-level diff between two snapshots and applies material heuristics.
 */
export function diffSnapshots(prevSentences: string[], newSentences: string[]): DiffResult {
  const changes = diffArrays(prevSentences, newSentences);

  const added: string[] = [];
  const removed: string[] = [];
  const materialReasons: string[] = [];

  for (const part of changes) {
    if (part.added) {
      for (const s of part.value) {
        added.push(s);
        const check = isSentenceMaterial(s);
        if (check.isMaterial) {
          materialReasons.push(...check.reasons.map((r) => `Added: ${r} ("${s.slice(0, 80)}")`));
        }
      }
    } else if (part.removed) {
      for (const s of part.value) {
        removed.push(s);
        const check = isSentenceMaterial(s);
        if (check.isMaterial) {
          materialReasons.push(...check.reasons.map((r) => `Removed: ${r} ("${s.slice(0, 80)}")`));
        }
      }
    }
  }

  const isMaterial = materialReasons.length > 0;

  return {
    added,
    removed,
    material: isMaterial,
    materialReasons,
    diffJson: JSON.stringify({ added, removed }),
  };
}

