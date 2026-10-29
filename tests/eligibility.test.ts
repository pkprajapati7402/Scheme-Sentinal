import { describe, it, expect } from 'vitest';
import { evaluateEligibility } from '../src/rules/eligibility.js';
import { StudentProfile } from '../src/domain/profile.js';

const baseProfile: StudentProfile = {
  id: 'test-student-1',
  displayName: 'Aman Sharma',
  fullNameOnDocuments: 'Aman Sharma',
  language: 'en',
  homeState: 'Uttar Pradesh',
  studyState: 'Delhi',
  courseLevel: 'ug',
  courseName: 'B.Tech Computer Science',
  yearOfStudy: 2,
  institutionType: 'government',
  category: 'obc',
  minority: false,
  gender: 'male',
  hasDisability: false,
  annualFamilyIncomeInr: 200000,
  lastExamPercent: 78.5,
  bankAccountAadhaarSeeded: true,
  isRenewal: {},
};

describe('Eligibility Engine', () => {
  it('returns ELIGIBLE when all criteria are satisfied', () => {
    const criteria = {
      courseLevels: { value: ['ug', 'pg'], evidence: { quote: 'UG/PG students', sourceUrl: 'https://gov.in', snapshotId: 's1' } },
      categories: { value: ['obc', 'sc', 'st'], evidence: { quote: 'OBC/SC/ST', sourceUrl: 'https://gov.in', snapshotId: 's1' } },
      states: { value: ['delhi', 'uttar pradesh'], evidence: { quote: 'Delhi/UP students', sourceUrl: 'https://gov.in', snapshotId: 's1' } },
      maxFamilyIncomeInr: { value: 250000, evidence: { quote: 'income under 2.5 lakh', sourceUrl: 'https://gov.in', snapshotId: 's1' } },
      minPercent: { value: 60, evidence: { quote: 'min 60%', sourceUrl: 'https://gov.in', snapshotId: 's1' } },
    };

    const res = evaluateEligibility(baseProfile, criteria);
    expect(res.overall).toBe('ELIGIBLE');
    expect(res.results.every((r) => r.verdict === 'ELIGIBLE')).toBe(true);
    expect(res.unverifiedConditions).toHaveLength(0);
  });

  it('handles income boundary: exact limit is ELIGIBLE', () => {
    const profile = { ...baseProfile, annualFamilyIncomeInr: 250000 };
    const criteria = {
      maxFamilyIncomeInr: { value: 250000, evidence: { quote: 'income upto 2.5L', sourceUrl: 'https://gov.in', snapshotId: 's1' } },
    };
    const res = evaluateEligibility(profile, criteria);
    expect(res.overall).toBe('ELIGIBLE');
  });

  it('handles income boundary: limit + 1 is NOT_ELIGIBLE', () => {
    const profile = { ...baseProfile, annualFamilyIncomeInr: 250001 };
    const criteria = {
      maxFamilyIncomeInr: { value: 250000, evidence: { quote: 'income upto 2.5L', sourceUrl: 'https://gov.in', snapshotId: 's1' } },
    };
    const res = evaluateEligibility(profile, criteria);
    expect(res.overall).toBe('NOT_ELIGIBLE');
  });

  it('returns UNKNOWN if income is missing from profile', () => {
    const profile = { ...baseProfile, annualFamilyIncomeInr: undefined };
    const criteria = {
      maxFamilyIncomeInr: { value: 250000, evidence: { quote: 'income upto 2.5L', sourceUrl: 'https://gov.in', snapshotId: 's1' } },
    };
    const res = evaluateEligibility(profile, criteria);
    expect(res.overall).toBe('UNKNOWN');
    expect(res.results[0].missingProfileField).toBe('annualFamilyIncomeInr');
  });

  it('evaluates minimum marks percentage boundary: exact min marks is ELIGIBLE', () => {
    const profile = { ...baseProfile, lastExamPercent: 75 };
    const criteria = {
      minPercent: { value: 75, evidence: { quote: 'minimum 75%', sourceUrl: 'https://gov.in', snapshotId: 's1' } },
    };
    const res = evaluateEligibility(profile, criteria);
    expect(res.overall).toBe('ELIGIBLE');
  });

  it('evaluates minimum marks percentage: 0.1 below is NOT_ELIGIBLE', () => {
    const profile = { ...baseProfile, lastExamPercent: 74.9 };
    const criteria = {
      minPercent: { value: 75, evidence: { quote: 'minimum 75%', sourceUrl: 'https://gov.in', snapshotId: 's1' } },
    };
    const res = evaluateEligibility(profile, criteria);
    expect(res.overall).toBe('NOT_ELIGIBLE');
  });

  it('returns UNKNOWN if lastExamPercent is missing', () => {
    const profile = { ...baseProfile, lastExamPercent: undefined };
    const criteria = {
      minPercent: { value: 60, evidence: { quote: 'min 60%', sourceUrl: 'https://gov.in', snapshotId: 's1' } },
    };
    const res = evaluateEligibility(profile, criteria);
    expect(res.overall).toBe('UNKNOWN');
    expect(res.results[0].missingProfileField).toBe('lastExamPercent');
  });

  it('fails if course level does not match', () => {
    const criteria = {
      courseLevels: { value: ['class11_12', 'diploma'], evidence: { quote: 'classes 11-12', sourceUrl: 'https://gov.in', snapshotId: 's1' } },
    };
    const res = evaluateEligibility(baseProfile, criteria);
    expect(res.overall).toBe('NOT_ELIGIBLE');
  });

  it('returns UNKNOWN if category is not set in profile', () => {
    const profile = { ...baseProfile, category: undefined };
    const criteria = {
      categories: { value: ['sc', 'st'], evidence: { quote: 'SC/ST only', sourceUrl: 'https://gov.in', snapshotId: 's1' } },
    };
    const res = evaluateEligibility(profile, criteria);
    expect(res.overall).toBe('UNKNOWN');
    expect(res.results[0].missingProfileField).toBe('category');
  });

  it('returns NOT_ELIGIBLE if student category is not in allowed list', () => {
    const profile = { ...baseProfile, category: 'general' as const };
    const criteria = {
      categories: { value: ['sc', 'st'], evidence: { quote: 'SC/ST only', sourceUrl: 'https://gov.in', snapshotId: 's1' } },
    };
    const res = evaluateEligibility(profile, criteria);
    expect(res.overall).toBe('NOT_ELIGIBLE');
  });

  it('enforces female_only gender restriction: male student is NOT_ELIGIBLE', () => {
    const criteria = {
      genderRestriction: { value: 'female_only' as const, evidence: { quote: 'Pragati scheme for girls', sourceUrl: 'https://gov.in', snapshotId: 's1' } },
    };
    const res = evaluateEligibility(baseProfile, criteria);
    expect(res.overall).toBe('NOT_ELIGIBLE');
  });

  it('enforces female_only gender restriction: female student is ELIGIBLE', () => {
    const profile = { ...baseProfile, gender: 'female' as const };
    const criteria = {
      genderRestriction: { value: 'female_only' as const, evidence: { quote: 'Pragati scheme for girls', sourceUrl: 'https://gov.in', snapshotId: 's1' } },
    };
    const res = evaluateEligibility(profile, criteria);
    expect(res.overall).toBe('ELIGIBLE');
  });

  it('returns UNKNOWN if gender is missing for gender-restricted scheme', () => {
    const profile = { ...baseProfile, gender: undefined };
    const criteria = {
      genderRestriction: { value: 'female_only' as const, evidence: { quote: 'Girls only', sourceUrl: 'https://gov.in', snapshotId: 's1' } },
    };
    const res = evaluateEligibility(profile, criteria);
    expect(res.overall).toBe('UNKNOWN');
  });

  it('enforces disability requirement: non-disabled is NOT_ELIGIBLE', () => {
    const criteria = {
      disabilityRequired: { value: true, evidence: { quote: 'PwD quota', sourceUrl: 'https://gov.in', snapshotId: 's1' } },
    };
    const res = evaluateEligibility(baseProfile, criteria);
    expect(res.overall).toBe('NOT_ELIGIBLE');
  });

  it('enforces disability requirement: disabled student is ELIGIBLE', () => {
    const profile = { ...baseProfile, hasDisability: true };
    const criteria = {
      disabilityRequired: { value: true, evidence: { quote: 'PwD quota', sourceUrl: 'https://gov.in', snapshotId: 's1' } },
    };
    const res = evaluateEligibility(profile, criteria);
    expect(res.overall).toBe('ELIGIBLE');
  });

  it('NOT_ELIGIBLE overrides any UNKNOWN criteria', () => {
    const profile = { ...baseProfile, category: undefined, annualFamilyIncomeInr: 900000 };
    const criteria = {
      categories: { value: ['sc', 'st'], evidence: { quote: 'SC/ST', sourceUrl: 'https://gov.in', snapshotId: 's1' } }, // UNKNOWN
      maxFamilyIncomeInr: { value: 250000, evidence: { quote: '2.5L', sourceUrl: 'https://gov.in', snapshotId: 's1' } }, // NOT_ELIGIBLE
    };
    const res = evaluateEligibility(profile, criteria);
    expect(res.overall).toBe('NOT_ELIGIBLE');
  });

  it('surfaces otherConditions and marks overall as UNKNOWN if no NOT_ELIGIBLE', () => {
    const criteria = {
      minPercent: { value: 50, evidence: { quote: 'min 50%', sourceUrl: 'https://gov.in', snapshotId: 's1' } },
      otherConditions: [
        { value: 'Must not be receiving another government scholarship simultaneously' },
      ],
    };
    const res = evaluateEligibility(baseProfile, criteria);
    expect(res.overall).toBe('UNKNOWN');
    expect(res.unverifiedConditions).toContain(
      'Must not be receiving another government scholarship simultaneously'
    );
  });

  it('state matching succeeds on studyState', () => {
    const profile = { ...baseProfile, homeState: 'Bihar', studyState: 'Karnataka' };
    const criteria = {
      states: { value: ['Karnataka', 'Kerala'], evidence: { quote: 'Students studying in KA/KL', sourceUrl: 'https://gov.in', snapshotId: 's1' } },
    };
    const res = evaluateEligibility(profile, criteria);
    expect(res.overall).toBe('ELIGIBLE');
  });

  it('state matching fails when neither home nor study state matches', () => {
    const profile = { ...baseProfile, homeState: 'Bihar', studyState: 'Jharkhand' };
    const criteria = {
      states: { value: ['Karnataka', 'Kerala'], evidence: { quote: 'Students in KA/KL', sourceUrl: 'https://gov.in', snapshotId: 's1' } },
    };
    const res = evaluateEligibility(profile, criteria);
    expect(res.overall).toBe('NOT_ELIGIBLE');
  });

  it('satisfies monotonicity property: adding missing fields turns UNKNOWN into definite verdict', () => {
    const partialProfile: StudentProfile = {
      ...baseProfile,
      category: undefined,
      annualFamilyIncomeInr: undefined,
    };
    const criteria = {
      categories: { value: ['obc'], evidence: { quote: 'OBC', sourceUrl: 'https://gov.in', snapshotId: 's1' } },
      maxFamilyIncomeInr: { value: 250000, evidence: { quote: '2.5L', sourceUrl: 'https://gov.in', snapshotId: 's1' } },
    };

    const initial = evaluateEligibility(partialProfile, criteria);
    expect(initial.overall).toBe('UNKNOWN');

    // Add category -> still UNKNOWN because income is missing
    const withCategory = { ...partialProfile, category: 'obc' as const };
    expect(evaluateEligibility(withCategory, criteria).overall).toBe('UNKNOWN');

    // Add income within limit -> becomes ELIGIBLE
    const completeEligible = { ...withCategory, annualFamilyIncomeInr: 180000 };
    expect(evaluateEligibility(completeEligible, criteria).overall).toBe('ELIGIBLE');

    // Add income exceeding limit -> becomes NOT_ELIGIBLE
    const completeIneligible = { ...withCategory, annualFamilyIncomeInr: 300000 };
    expect(evaluateEligibility(completeIneligible, criteria).overall).toBe('NOT_ELIGIBLE');
  });
});

