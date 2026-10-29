import { describe, it, expect } from 'vitest';
import { StudentProfile } from '../src/domain/profile.js';

describe('StudentProfile Schema Validation', () => {
  it('validates a complete student profile', () => {
    const raw = {
      id: 'friend-1',
      displayName: 'Rahul Verma',
      fullNameOnDocuments: 'Rahul Kumar Verma',
      language: 'hi',
      homeState: 'Bihar',
      studyState: 'Uttar Pradesh',
      courseLevel: 'ug',
      courseName: 'B.Sc Physics',
      yearOfStudy: 1,
      institutionType: 'government',
      category: 'obc',
      minority: false,
      gender: 'male',
      hasDisability: false,
      annualFamilyIncomeInr: 150000,
      lastExamPercent: 82.4,
      bankAccountAadhaarSeeded: true,
      isRenewal: {},
    };

    const parsed = StudentProfile.parse(raw);
    expect(parsed.id).toBe('friend-1');
    expect(parsed.language).toBe('hi');
  });

  it('allows missing optional sensitive attributes (income, category, minority)', () => {
    const raw = {
      id: 'friend-minimal',
      displayName: 'Anonymous Friend',
      fullNameOnDocuments: 'Anonymous Student',
      homeState: 'Delhi',
      studyState: 'Delhi',
      courseLevel: 'ug',
      courseName: 'B.A Programme',
      yearOfStudy: 1,
    };

    const parsed = StudentProfile.parse(raw);
    expect(parsed.annualFamilyIncomeInr).toBeUndefined();
    expect(parsed.category).toBeUndefined();
    expect(parsed.minority).toBeUndefined();
    expect(parsed.language).toBe('en'); // default
  });

  it('rejects negative family income', () => {
    const invalid = {
      id: 'f1',
      displayName: 'Test',
      fullNameOnDocuments: 'Test',
      homeState: 'Delhi',
      studyState: 'Delhi',
      courseLevel: 'ug',
      courseName: 'B.A',
      yearOfStudy: 1,
      annualFamilyIncomeInr: -5000,
    };
    expect(() => StudentProfile.parse(invalid)).toThrow();
  });

  it('rejects percentage > 100', () => {
    const invalid = {
      id: 'f1',
      displayName: 'Test',
      fullNameOnDocuments: 'Test',
      homeState: 'Delhi',
      studyState: 'Delhi',
      courseLevel: 'ug',
      courseName: 'B.A',
      yearOfStudy: 1,
      lastExamPercent: 105,
    };
    expect(() => StudentProfile.parse(invalid)).toThrow();
  });

  it('rejects yearOfStudy outside 1-8', () => {
    const invalid = {
      id: 'f1',
      displayName: 'Test',
      fullNameOnDocuments: 'Test',
      homeState: 'Delhi',
      studyState: 'Delhi',
      courseLevel: 'ug',
      courseName: 'B.A',
      yearOfStudy: 0,
    };
    expect(() => StudentProfile.parse(invalid)).toThrow();
  });
});

