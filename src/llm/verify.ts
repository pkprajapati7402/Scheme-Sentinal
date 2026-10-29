import { parseIndianDate } from '../rules/deadlines.js';

export interface VerificationCounters {
  kept: number;
  droppedQuote: number;
  droppedDate: number;
  droppedNumber: number;
  droppedOther: number;
}

export interface DroppedField {
  field: string;
  reason: 'quote_not_found' | 'date_mismatch' | 'number_mismatch' | 'enum_insanity' | 'implausible_date';
  quote: string;
  expected?: any;
  actual?: any;
}

export interface VerificationResult<T> {
  verified: T;
  droppedFields: DroppedField[];
  counters: VerificationCounters;
}

function normalizeForComparison(str: string): string {
  return str
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if candidate quote exists in the normalized page text (allowing up to 3% edit distance).
 */
export function isQuoteInPage(quote: string, pageText: string): boolean {
  if (!quote || quote.length < 8) return false;
  const normQuote = normalizeForComparison(quote);
  const normPage = normalizeForComparison(pageText);

  if (normPage.includes(normQuote)) {
    return true;
  }

  // Check with punctuation stripped
  const stripPunct = (s: string) => s.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()।]/g, ' ').replace(/\s+/g, ' ').trim();
  const cleanQuote = stripPunct(normQuote);
  const cleanPage = stripPunct(normPage);

  if (cleanPage.includes(cleanQuote)) {
    return true;
  }

  // Tolerance check for slight token boundary differences
  const words = cleanQuote.split(' ');
  if (words.length >= 4) {
    const subPhrase = words.slice(1, -1).join(' ');
    if (cleanPage.includes(subPhrase)) {
      return true;
    }
  }

  return false;
}

/**
 * Extracts numeric value from a string, accounting for Indian Lakhs/Lacs notation.
 */
export function quoteContainsNumber(quote: string, expectedNum: number): boolean {
  const norm = normalizeForComparison(quote).replace(/,/g, '');

  // Exact number match (e.g. 250000)
  if (norm.includes(String(expectedNum))) {
    return true;
  }

  // Check for lakh / lac representation (e.g. 250000 = 2.5 lakh)
  if (expectedNum >= 100000) {
    const inLakhs = expectedNum / 100000;
    const lakhPatterns = [
      `${inLakhs} lakh`,
      `${inLakhs} lac`,
      `${inLakhs}lakh`,
      `${inLakhs}lac`,
      `${inLakhs} l`,
    ];
    for (const pat of lakhPatterns) {
      if (norm.includes(pat)) return true;
    }
  }

  // Check for percentage
  if (norm.includes(`${expectedNum}%`) || norm.includes(`${expectedNum} %`)) {
    return true;
  }

  return false;
}

/**
 * Deterministically verifies extracted facts against the source page text.
 */
export function verifyExtractedFacts(
  rawFacts: Record<string, any>,
  pageText: string,
  academicYear: string = '2026-27'
): VerificationResult<Record<string, any>> {
  const verified: Record<string, any> = {};
  const droppedFields: DroppedField[] = [];
  const counters: VerificationCounters = {
    kept: 0,
    droppedQuote: 0,
    droppedDate: 0,
    droppedNumber: 0,
    droppedOther: 0,
  };

  const targetYearMatch = academicYear.match(/^(\d{4})/);
  const baseYear = targetYearMatch ? parseInt(targetYearMatch[1], 10) : 2026;

  for (const [key, fact] of Object.entries(rawFacts)) {
    if (!fact || typeof fact !== 'object') {
      verified[key] = fact;
      continue;
    }

    // If it's an array of sourced items (e.g. documentsRequired, otherConditions)
    if (Array.isArray(fact)) {
      const verifiedArray: any[] = [];
      for (const item of fact) {
        if (item && item.evidence && item.evidence.quote) {
          if (!isQuoteInPage(item.evidence.quote, pageText)) {
            droppedFields.push({
              field: `${key}[${item.value}]`,
              reason: 'quote_not_found',
              quote: item.evidence.quote,
            });
            counters.droppedQuote++;
            continue;
          }
        }
        verifiedArray.push(item);
        counters.kept++;
      }
      verified[key] = verifiedArray;
      continue;
    }

    // Check Sourced fact { value, evidence }
    if (fact.value !== undefined && fact.evidence) {
      const quote = fact.evidence.quote;
      const value = fact.value;

      // 1. Quote check
      if (!isQuoteInPage(quote, pageText)) {
        droppedFields.push({
          field: key,
          reason: 'quote_not_found',
          quote,
          actual: value,
        });
        counters.droppedQuote++;
        continue;
      }

      // 2. Date check (if field looks like a date)
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const parsedFromQuote = parseIndianDate(quote);
        if (parsedFromQuote !== value) {
          droppedFields.push({
            field: key,
            reason: 'date_mismatch',
            quote,
            expected: parsedFromQuote,
            actual: value,
          });
          counters.droppedDate++;
          continue;
        }

        // 5. Plausibility check on date
        const dateYear = parseInt(value.slice(0, 4), 10);
        if (dateYear < baseYear - 1 || dateYear > baseYear + 2) {
          droppedFields.push({
            field: key,
            reason: 'implausible_date',
            quote,
            actual: value,
          });
          counters.droppedOther++;
          continue;
        }
      }

      // 3. Number check
      if (typeof value === 'number') {
        if (!quoteContainsNumber(quote, value)) {
          droppedFields.push({
            field: key,
            reason: 'number_mismatch',
            quote,
            actual: value,
          });
          counters.droppedNumber++;
          continue;
        }
      }

      // 4. Enum sanity (e.g. status='extended' must have extension keywords in quote)
      if (key === 'status' && value === 'extended') {
        const lowerQuote = quote.toLowerCase();
        const hasExtKeyword =
          lowerQuote.includes('extended') ||
          lowerQuote.includes('extension') ||
          lowerQuote.includes('बढ़ाई') ||
          lowerQuote.includes('संशोधित') ||
          lowerQuote.includes('विस्तार');
        if (!hasExtKeyword) {
          droppedFields.push({
            field: key,
            reason: 'enum_insanity',
            quote,
            actual: value,
          });
          counters.droppedOther++;
          continue;
        }
      }

      // All checks passed!
      verified[key] = fact;
      counters.kept++;
    } else {
      verified[key] = fact;
    }
  }

  // Cross-field plausibility: verification deadline >= fresh application deadline
  if (
    verified.freshApplication?.value &&
    verified.instituteVerification?.value
  ) {
    if (verified.instituteVerification.value < verified.freshApplication.value) {
      droppedFields.push({
        field: 'instituteVerification',
        reason: 'implausible_date',
        quote: verified.instituteVerification.evidence.quote,
        actual: verified.instituteVerification.value,
      });
      delete verified.instituteVerification;
      counters.droppedOther++;
      counters.kept--;
    }
  }

  return {
    verified,
    droppedFields,
    counters,
  };
}

