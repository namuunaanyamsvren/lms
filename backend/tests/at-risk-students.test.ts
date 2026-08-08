import { describe, expect, it } from 'vitest';
import {
  evaluateStudentRisk,
  RISK_GRADE_THRESHOLD,
  RISK_ATTENDANCE_THRESHOLD,
} from '../academic-service/src/services/grade.service';

describe('at-risk student evaluation', () => {
  it('is not at risk when both grade and attendance are healthy', () => {
    expect(evaluateStudentRisk({ percent: 85, attendancePercent: 95 })).toEqual({ atRisk: false, reasons: [] });
  });

  it('flags a low course grade', () => {
    const result = evaluateStudentRisk({ percent: RISK_GRADE_THRESHOLD - 1, attendancePercent: 95 });
    expect(result.atRisk).toBe(true);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toContain('дүн');
  });

  it('flags low attendance', () => {
    const result = evaluateStudentRisk({ percent: 90, attendancePercent: RISK_ATTENDANCE_THRESHOLD - 1 });
    expect(result.atRisk).toBe(true);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toContain('Ирц');
  });

  it('flags both reasons when a student is at risk on grade and attendance', () => {
    const result = evaluateStudentRisk({ percent: 40, attendancePercent: 50 });
    expect(result.atRisk).toBe(true);
    expect(result.reasons).toHaveLength(2);
  });

  it('is not at risk on a threshold-boundary value (>= threshold passes)', () => {
    expect(evaluateStudentRisk({ percent: RISK_GRADE_THRESHOLD, attendancePercent: RISK_ATTENDANCE_THRESHOLD }).atRisk).toBe(false);
  });

  it('does not flag missing data (no grade/attendance yet) as at risk', () => {
    expect(evaluateStudentRisk({ percent: null, attendancePercent: null })).toEqual({ atRisk: false, reasons: [] });
  });
});
