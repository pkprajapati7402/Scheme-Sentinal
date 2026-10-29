import { describe, it, expect } from 'vitest';
import { diffSnapshots, isSentenceMaterial } from '../src/sources/diff.js';

describe('Diff and Material Significance Heuristics', () => {
  it('flags sentences with extension keywords and dates as material', () => {
    const s1 = 'The last date for submission of online application has been extended up to 30-11-2026.';
    const res1 = isSentenceMaterial(s1);
    expect(res1.isMaterial).toBe(true);
    expect(res1.reasons.some((r) => r.includes('extended'))).toBe(true);
    expect(res1.reasons.some((r) => r.includes('date pattern'))).toBe(true);
  });

  it('flags sentences with Hindi keywords as material', () => {
    const s2 = 'आवेदन की अंतिम तिथि बढ़ाकर 30 नवंबर 2026 कर दी गई है।';
    const res2 = isSentenceMaterial(s2);
    expect(res2.isMaterial).toBe(true);
    expect(res2.reasons.some((r) => r.includes('अंतिम तिथि'))).toBe(true);
  });

  it('marks sentences with income or percentage thresholds as material', () => {
    const s3 = 'Annual family income limit is ₹2,50,000 with minimum 60% marks in previous exam.';
    const res3 = isSentenceMaterial(s3);
    expect(res3.isMaterial).toBe(true);
  });

  it('ignores cosmetic text without dates or material keywords', () => {
    const s4 = 'Please read the user manual carefully before filling the application form.';
    const res4 = isSentenceMaterial(s4);
    expect(res4.isMaterial).toBe(false);
  });

  it('computes sentence diff between snapshots and detects material additions', () => {
    const prev = [
      'Post Matric Scholarships Scheme for SC Students',
      'The last date for submission of online applications is 31-10-2026.',
    ];
    const next = [
      'Post Matric Scholarships Scheme for SC Students',
      'URGENT NOTICE: The last date for submission of online application has been extended up to 30-11-2026.',
    ];

    const diff = diffSnapshots(prev, next);
    expect(diff.material).toBe(true);
    expect(diff.added).toHaveLength(1);
    expect(diff.removed).toHaveLength(1);
    expect(diff.materialReasons.length).toBeGreaterThan(0);
  });
});

