import { describe, expect, it } from 'vitest';
import { resolveQuizAttemptScore } from '../academic-service/src/services/grade.service';

describe('quiz attempt scoring policy (highest vs latest attempt)', () => {
  const attempts = [
    { score: 60, completedAt: new Date('2026-01-01T00:00:00Z') },
    { score: 95, completedAt: new Date('2026-01-02T00:00:00Z') },
    { score: 80, completedAt: new Date('2026-01-03T00:00:00Z') },
  ];

  it('LATEST picks the most recently completed attempt regardless of score', () => {
    expect(resolveQuizAttemptScore(attempts, 'LATEST')).toBe(80);
  });

  it('HIGHEST picks the best score regardless of when it was completed', () => {
    expect(resolveQuizAttemptScore(attempts, 'HIGHEST')).toBe(95);
  });

  it('ignores ungraded attempts (null score) under both policies', () => {
    const withPending = [...attempts, { score: null, completedAt: new Date('2026-01-04T00:00:00Z') }];
    expect(resolveQuizAttemptScore(withPending, 'LATEST')).toBe(80);
    expect(resolveQuizAttemptScore(withPending, 'HIGHEST')).toBe(95);
  });

  it('returns null when there are no scored attempts', () => {
    expect(resolveQuizAttemptScore([], 'LATEST')).toBeNull();
    expect(resolveQuizAttemptScore([{ score: null, completedAt: null }], 'HIGHEST')).toBeNull();
  });

  it('LATEST breaks ties on completedAt order, not array order', () => {
    const reversed = [...attempts].reverse();
    expect(resolveQuizAttemptScore(reversed, 'LATEST')).toBe(80);
  });
});
