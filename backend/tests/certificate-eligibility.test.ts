import { describe, expect, it } from 'vitest';
import { isPassingGrade } from '../academic-service/src/services/certificate.service';

describe('certificate eligibility (passing-grade check)', () => {
  it('is not eligible when the student has no grades at all', () => {
    expect(isPassingGrade({ hasGrades: false, letter: null })).toBe(false);
  });

  it('is not eligible on a failing letter grade', () => {
    expect(isPassingGrade({ hasGrades: true, letter: 'F' })).toBe(false);
  });

  it('is eligible on any passing letter grade', () => {
    for (const letter of ['A+', 'A', 'B', 'C-', 'D']) {
      expect(isPassingGrade({ hasGrades: true, letter })).toBe(true);
    }
  });

  it('is not eligible when hasGrades is true but letter is somehow null', () => {
    expect(isPassingGrade({ hasGrades: true, letter: null })).toBe(false);
  });
});
