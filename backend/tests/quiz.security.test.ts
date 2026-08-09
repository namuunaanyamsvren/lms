import { describe, expect, it, vi } from 'vitest';
import { autosave, submit } from '../academic-service/src/validators/quiz.validator';
import { buildQuestionSnapshot, computeAttemptExpiry, scoreSnapshot } from '../academic-service/src/services/quiz.service';

const quiz = (overrides: Record<string, unknown> = {}) => ({
  shuffleQuestions: false,
  shuffleOptions: false,
  questionLinks: [{
    order: 1,
    pointsOverride: 4,
    question: {
      id: 'q1', text: '2 + 2?', type: 'SINGLE_CHOICE',
      optionsJson: JSON.stringify([{ id: 'a', text: '3' }, { id: 'b', text: '4' }]),
      correctAnswer: JSON.stringify('b'), points: 1,
    },
  }],
  ...overrides,
});

describe('quiz security integration contract', () => {
  it('creates a self-contained immutable grading snapshot', () => {
    const source = quiz();
    const snapshot = buildQuestionSnapshot(source);
    source.questionLinks[0].question.text = 'tampered';
    source.questionLinks[0].question.correctAnswer = JSON.stringify('a');
    expect(snapshot[0]).toMatchObject({ text: '2 + 2?', correctAnswer: 'b', points: 4 });
  });

  it('calculates scores only from server snapshot and answer payload', () => {
    const snapshot = buildQuestionSnapshot(quiz());
    const result = scoreSnapshot(snapshot, new Map([['q1', 'b']]));
    expect(result).toMatchObject({ earned: 4, total: 4, percent: 100, manual: false });
    expect(() => autosave.parse({ answer: 'a', score: 100, passed: true })).toThrow();
  });

  it('routes essays to manual grading and permits only an idempotency token on submit', () => {
    const snapshot = buildQuestionSnapshot(quiz({ questionLinks: [{
      order: 1, pointsOverride: null,
      question: { id: 'essay', text: 'Explain', type: 'ESSAY', optionsJson: '[]', correctAnswer: null, points: 10 },
    }] }));
    expect(scoreSnapshot(snapshot, new Map([['essay', 'response']])).manual).toBe(true);
    expect(submit.parse({ idempotencyKey: '11111111-1111-4111-8111-111111111111' })).toBeTruthy();
    expect(() => submit.parse({ score: 100 })).toThrow();
  });

  it('randomizes order without changing question identity or answer keys', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const source = quiz({ shuffleOptions: true });
    const snapshot = buildQuestionSnapshot(source);
    expect(snapshot[0].options.map(x => x.id)).toEqual(['b', 'a']);
    expect(snapshot[0].correctAnswer).toBe('b');
    vi.restoreAllMocks();
  });
});

describe('quiz attempt expiry (server-independent time limit)', () => {
  const now = new Date('2026-01-01T00:00:00Z');

  it('has no deadline when the quiz has neither a time limit nor an availability window', () => {
    expect(computeAttemptExpiry({ timeLimitMins: null, availableUntil: null }, now)).toBeNull();
  });

  it('derives the deadline from now + timeLimitMins when there is no availability window', () => {
    const expiry = computeAttemptExpiry({ timeLimitMins: 30, availableUntil: null }, now);
    expect(expiry).toEqual(new Date('2026-01-01T00:30:00Z'));
  });

  it('is clamped to availableUntil when the quiz window closes before the time limit would', () => {
    const availableUntil = new Date('2026-01-01T00:10:00Z');
    const expiry = computeAttemptExpiry({ timeLimitMins: 30, availableUntil }, now);
    expect(expiry).toEqual(availableUntil);
  });

  it('uses the time limit when it is stricter than the availability window', () => {
    const availableUntil = new Date('2026-01-01T05:00:00Z');
    const expiry = computeAttemptExpiry({ timeLimitMins: 30, availableUntil }, now);
    expect(expiry).toEqual(new Date('2026-01-01T00:30:00Z'));
  });

  it('falls back to availableUntil alone when there is no time limit', () => {
    const availableUntil = new Date('2026-01-01T05:00:00Z');
    expect(computeAttemptExpiry({ timeLimitMins: null, availableUntil }, now)).toEqual(availableUntil);
  });
});
