// Single source of truth for turning a late submission into a score
// deduction. Used at grading time by both the single-submission grading
// endpoint and the bulk CSV grade importer — keep them in lock-step here
// instead of re-deriving the formula in each caller.
export type LatePenaltyInput = {
  isLate: boolean;
  daysLate: number;
  latePenaltyPercentPerDay: number;
  score: number;
};

export type LatePenaltyResult = {
  latePenaltyPercent: number;
  score: number;
};

export const computeLatePenalty = ({
  isLate,
  daysLate,
  latePenaltyPercentPerDay,
  score,
}: LatePenaltyInput): LatePenaltyResult => {
  if (!isLate || latePenaltyPercentPerDay <= 0) {
    return { latePenaltyPercent: 0, score };
  }
  const latePenaltyPercent = Math.min(100, daysLate * latePenaltyPercentPerDay);
  const penalizedScore = Math.round(Math.max(0, score * (1 - latePenaltyPercent / 100)) * 100) / 100;
  return { latePenaltyPercent, score: penalizedScore };
};
