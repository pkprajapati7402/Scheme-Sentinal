import { StudentProfile } from '../domain/profile.js';
import { CriteriaFacts } from '../domain/facts.js';
import { EligibilityVerdict } from '../domain/scheme.js';

export interface CriterionResult {
  criterion: string;
  verdict: EligibilityVerdict;
  reason: string;
  missingProfileField?: string;
  evidence?: { quote: string; sourceUrl: string };
}

export interface EligibilityResult {
  overall: EligibilityVerdict;
  results: CriterionResult[];
  unverifiedConditions: string[];
}

/**
 * Pure, deterministic eligibility evaluation engine.
 * Rule: Any NOT_ELIGIBLE -> overall NOT_ELIGIBLE;
 * Else any UNKNOWN or unverified conditions -> overall UNKNOWN;
 * Else ELIGIBLE.
 */
export function evaluateEligibility(
  profile: StudentProfile,
  criteria: CriteriaFacts | Record<string, any>
): EligibilityResult {
  const results: CriterionResult[] = [];
  const unverifiedConditions: string[] = [];

  // 1. Course Levels
  const courseLevelsFact = criteria.courseLevels;
  if (courseLevelsFact && courseLevelsFact.value && Array.isArray(courseLevelsFact.value)) {
    const allowed = courseLevelsFact.value.map((c: string) => c.toLowerCase());
    const evidence = courseLevelsFact.evidence;
    if (!profile.courseLevel) {
      results.push({
        criterion: 'courseLevels',
        verdict: 'UNKNOWN',
        reason: 'Course level is not provided in student profile',
        missingProfileField: 'courseLevel',
        evidence,
      });
    } else if (allowed.includes(profile.courseLevel.toLowerCase())) {
      results.push({
        criterion: 'courseLevels',
        verdict: 'ELIGIBLE',
        reason: `Student course level "${profile.courseLevel}" is eligible (${allowed.join(', ')})`,
        evidence,
      });
    } else {
      results.push({
        criterion: 'courseLevels',
        verdict: 'NOT_ELIGIBLE',
        reason: `Student course level "${profile.courseLevel}" is not in eligible list (${allowed.join(', ')})`,
        evidence,
      });
    }
  }

  // 2. Categories
  const categoriesFact = criteria.categories;
  if (categoriesFact && categoriesFact.value && Array.isArray(categoriesFact.value)) {
    const allowed = categoriesFact.value.map((c: string) => c.toLowerCase());
    const evidence = categoriesFact.evidence;
    if (!profile.category) {
      results.push({
        criterion: 'categories',
        verdict: 'UNKNOWN',
        reason: 'Category is not specified in profile',
        missingProfileField: 'category',
        evidence,
      });
    } else if (allowed.includes(profile.category.toLowerCase())) {
      results.push({
        criterion: 'categories',
        verdict: 'ELIGIBLE',
        reason: `Category "${profile.category}" is eligible (${allowed.join(', ')})`,
        evidence,
      });
    } else {
      results.push({
        criterion: 'categories',
        verdict: 'NOT_ELIGIBLE',
        reason: `Category "${profile.category}" is not eligible (${allowed.join(', ')})`,
        evidence,
      });
    }
  }

  // 3. States
  const statesFact = criteria.states;
  if (statesFact && statesFact.value && Array.isArray(statesFact.value) && statesFact.value.length > 0) {
    const allowed = statesFact.value.map((s: string) => s.toLowerCase());
    const evidence = statesFact.evidence;
    const home = profile.homeState?.toLowerCase();
    const study = profile.studyState?.toLowerCase();

    if (!home && !study) {
      results.push({
        criterion: 'states',
        verdict: 'UNKNOWN',
        reason: 'Neither home state nor study state specified in profile',
        missingProfileField: 'homeState',
        evidence,
      });
    } else if ((home && allowed.includes(home)) || (study && allowed.includes(study))) {
      results.push({
        criterion: 'states',
        verdict: 'ELIGIBLE',
        reason: `State matches eligible states (${statesFact.value.join(', ')})`,
        evidence,
      });
    } else {
      results.push({
        criterion: 'states',
        verdict: 'NOT_ELIGIBLE',
        reason: `Neither home (${profile.homeState}) nor study state (${profile.studyState}) is in ${statesFact.value.join(', ')}`,
        evidence,
      });
    }
  }

  // 4. Maximum Family Income
  const maxIncomeFact = criteria.maxFamilyIncomeInr;
  if (maxIncomeFact && typeof maxIncomeFact.value === 'number') {
    const limit = maxIncomeFact.value;
    const evidence = maxIncomeFact.evidence;
    if (profile.annualFamilyIncomeInr === undefined || profile.annualFamilyIncomeInr === null) {
      results.push({
        criterion: 'maxFamilyIncomeInr',
        verdict: 'UNKNOWN',
        reason: `Annual family income is not set in profile (limit is ₹${limit.toLocaleString('en-IN')})`,
        missingProfileField: 'annualFamilyIncomeInr',
        evidence,
      });
    } else if (profile.annualFamilyIncomeInr <= limit) {
      results.push({
        criterion: 'maxFamilyIncomeInr',
        verdict: 'ELIGIBLE',
        reason: `Income ₹${profile.annualFamilyIncomeInr.toLocaleString('en-IN')} is within limit ₹${limit.toLocaleString('en-IN')}`,
        evidence,
      });
    } else {
      results.push({
        criterion: 'maxFamilyIncomeInr',
        verdict: 'NOT_ELIGIBLE',
        reason: `Income ₹${profile.annualFamilyIncomeInr.toLocaleString('en-IN')} exceeds limit ₹${limit.toLocaleString('en-IN')}`,
        evidence,
      });
    }
  }

  // 5. Minimum Percentage
  const minPercentFact = criteria.minPercent;
  if (minPercentFact && typeof minPercentFact.value === 'number') {
    const limit = minPercentFact.value;
    const evidence = minPercentFact.evidence;
    if (profile.lastExamPercent === undefined || profile.lastExamPercent === null) {
      results.push({
        criterion: 'minPercent',
        verdict: 'UNKNOWN',
        reason: `Last exam percentage is not set in profile (minimum required is ${limit}%)`,
        missingProfileField: 'lastExamPercent',
        evidence,
      });
    } else if (profile.lastExamPercent >= limit) {
      results.push({
        criterion: 'minPercent',
        verdict: 'ELIGIBLE',
        reason: `Last exam marks ${profile.lastExamPercent}% meet minimum required ${limit}%`,
        evidence,
      });
    } else {
      results.push({
        criterion: 'minPercent',
        verdict: 'NOT_ELIGIBLE',
        reason: `Last exam marks ${profile.lastExamPercent}% is below required ${limit}%`,
        evidence,
      });
    }
  }

  // 6. Gender Restriction
  const genderFact = criteria.genderRestriction;
  if (genderFact && genderFact.value === 'female_only') {
    const evidence = genderFact.evidence;
    if (!profile.gender) {
      results.push({
        criterion: 'genderRestriction',
        verdict: 'UNKNOWN',
        reason: 'Gender is not specified in profile',
        missingProfileField: 'gender',
        evidence,
      });
    } else if (profile.gender === 'female') {
      results.push({
        criterion: 'genderRestriction',
        verdict: 'ELIGIBLE',
        reason: 'Scheme is for female students and student is female',
        evidence,
      });
    } else {
      results.push({
        criterion: 'genderRestriction',
        verdict: 'NOT_ELIGIBLE',
        reason: `Scheme is female_only, student gender is ${profile.gender}`,
        evidence,
      });
    }
  }

  // 7. Disability Required
  const disabilityFact = criteria.disabilityRequired;
  if (disabilityFact && disabilityFact.value === true) {
    const evidence = disabilityFact.evidence;
    if (profile.hasDisability === undefined || profile.hasDisability === null) {
      results.push({
        criterion: 'disabilityRequired',
        verdict: 'UNKNOWN',
        reason: 'Disability status is not specified in profile',
        missingProfileField: 'hasDisability',
        evidence,
      });
    } else if (profile.hasDisability === true) {
      results.push({
        criterion: 'disabilityRequired',
        verdict: 'ELIGIBLE',
        reason: 'Scheme requires disability quota and student is eligible',
        evidence,
      });
    } else {
      results.push({
        criterion: 'disabilityRequired',
        verdict: 'NOT_ELIGIBLE',
        reason: 'Scheme is specifically for students with disabilities',
        evidence,
      });
    }
  }

  // 8. Other Conditions (manual human review required)
  const otherConditionsFact = criteria.otherConditions;
  if (Array.isArray(otherConditionsFact)) {
    for (const cond of otherConditionsFact) {
      const val = typeof cond === 'string' ? cond : cond?.value;
      if (val && typeof val === 'string') {
        unverifiedConditions.push(val);
      }
    }
  }

  // Overall aggregation
  let overall: EligibilityVerdict = 'ELIGIBLE';

  const hasNotEligible = results.some((r) => r.verdict === 'NOT_ELIGIBLE');
  const hasUnknown = results.some((r) => r.verdict === 'UNKNOWN');
  const hasUnverified = unverifiedConditions.length > 0;

  if (hasNotEligible) {
    overall = 'NOT_ELIGIBLE';
  } else if (hasUnknown || hasUnverified) {
    overall = 'UNKNOWN';
  } else {
    overall = 'ELIGIBLE';
  }

  return {
    overall,
    results,
    unverifiedConditions,
  };
}

