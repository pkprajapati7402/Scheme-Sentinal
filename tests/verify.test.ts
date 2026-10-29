import { describe, it, expect } from 'vitest';
import { verifyExtractedFacts, isQuoteInPage, quoteContainsNumber } from '../src/llm/verify.js';

describe('Deterministic Evidence & Date Verifier (Hard Rule 3 & 4)', () => {
  const samplePage = `
    Post Matric Scholarships Scheme for SC Students.
    The last date for submission of online applications is 31-10-2026.
    Institute verification deadline is 15-11-2026.
    Annual family income should not exceed ₹2,50,000 per annum.
    Minimum 60% marks in the last examination.
    Required Documents: Caste Certificate, Income Certificate, Bonafide Student Certificate.
  `;

  it('verifies facts when quote and dates are verbatim and correct', () => {
    const rawFacts = {
      freshApplication: {
        value: '2026-10-31',
        evidence: {
          quote: 'The last date for submission of online applications is 31-10-2026.',
          sourceUrl: 'https://scholarships.gov.in',
        },
      },
      instituteVerification: {
        value: '2026-11-15',
        evidence: {
          quote: 'Institute verification deadline is 15-11-2026.',
          sourceUrl: 'https://scholarships.gov.in',
        },
      },
      maxFamilyIncomeInr: {
        value: 250000,
        evidence: {
          quote: 'Annual family income should not exceed ₹2,50,000 per annum.',
          sourceUrl: 'https://scholarships.gov.in',
        },
      },
    };

    const res = verifyExtractedFacts(rawFacts, samplePage, '2026-27');
    expect(res.counters.kept).toBe(3);
    expect(res.droppedFields).toHaveLength(0);
    expect(res.verified.freshApplication.value).toBe('2026-10-31');
  });

  it('DROPS fact when quote is fabricated / hallucinated (quote_not_found)', () => {
    const rawFacts = {
      freshApplication: {
        value: '2026-12-31',
        evidence: {
          quote: 'All candidates can apply until 31st December 2026 completely free of cost.', // fabricated
          sourceUrl: 'https://scholarships.gov.in',
        },
      },
    };

    const res = verifyExtractedFacts(rawFacts, samplePage, '2026-27');
    expect(res.counters.droppedQuote).toBe(1);
    expect(res.counters.kept).toBe(0);
    expect(res.droppedFields[0].reason).toBe('quote_not_found');
    expect(res.verified.freshApplication).toBeUndefined();
  });

  it('DROPS fact when model date does not match the date in the quote (date_mismatch)', () => {
    const rawFacts = {
      freshApplication: {
        value: '2026-11-30', // Model claims 30 Nov, but quote says 31-10-2026
        evidence: {
          quote: 'The last date for submission of online applications is 31-10-2026.',
          sourceUrl: 'https://scholarships.gov.in',
        },
      },
    };

    const res = verifyExtractedFacts(rawFacts, samplePage, '2026-27');
    expect(res.counters.droppedDate).toBe(1);
    expect(res.droppedFields[0].reason).toBe('date_mismatch');
    expect(res.verified.freshApplication).toBeUndefined();
  });

  it('DROPS fact when income number is not supported by quote (number_mismatch)', () => {
    const rawFacts = {
      maxFamilyIncomeInr: {
        value: 800000, // Fabricated 8 lakh
        evidence: {
          quote: 'Annual family income should not exceed ₹2,50,000 per annum.',
          sourceUrl: 'https://scholarships.gov.in',
        },
      },
    };

    const res = verifyExtractedFacts(rawFacts, samplePage, '2026-27');
    expect(res.counters.droppedNumber).toBe(1);
    expect(res.droppedFields[0].reason).toBe('number_mismatch');
  });

  it('DROPS status=extended when quote does not contain extension keyword (enum_insanity)', () => {
    const rawFacts = {
      status: {
        value: 'extended',
        evidence: {
          quote: 'The last date for submission of online applications is 31-10-2026.',
          sourceUrl: 'https://scholarships.gov.in',
        },
      },
    };

    const res = verifyExtractedFacts(rawFacts, samplePage, '2026-27');
    expect(res.counters.droppedOther).toBe(1);
    expect(res.droppedFields[0].reason).toBe('enum_insanity');
  });

  it('DROPS institute verification date when it is earlier than fresh application date (implausible)', () => {
    const rawFacts = {
      freshApplication: {
        value: '2026-10-31',
        evidence: {
          quote: 'The last date for submission of online applications is 31-10-2026.',
          sourceUrl: 'https://scholarships.gov.in',
        },
      },
      instituteVerification: {
        value: '2026-10-15', // Earlier than fresh application!
        evidence: {
          quote: 'Institute verification deadline is 15-11-2026.', // Date in quote is Nov, but model parsed as Oct
          sourceUrl: 'https://scholarships.gov.in',
        },
      },
    };

    const res = verifyExtractedFacts(rawFacts, samplePage, '2026-27');
    expect(res.verified.freshApplication).toBeDefined();
    expect(res.verified.instituteVerification).toBeUndefined();
  });
});

