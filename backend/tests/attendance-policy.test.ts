import { describe, expect, it } from 'vitest';
import { parseAttendanceRule } from '../organization-service/src/controllers/organization.controller';

describe('attendance rule policy parsing', () => {
  const defaults = {
    absenceThreshold: 3,
    lateAfterMinutes: 10,
    riskGradeThreshold: 60,
    riskAttendanceThreshold: 80,
  };

  it('falls back to the historical defaults (threshold 3, late-after 10min) when unset', () => {
    expect(parseAttendanceRule(null)).toEqual(defaults);
    expect(parseAttendanceRule(undefined)).toEqual(defaults);
    expect(parseAttendanceRule('')).toEqual(defaults);
  });

  it('falls back to defaults on malformed JSON instead of throwing', () => {
    expect(parseAttendanceRule('{not json')).toEqual(defaults);
  });

  it('reads a fully configured organization policy', () => {
    expect(parseAttendanceRule(JSON.stringify({
      absenceThreshold: 5,
      lateAfterMinutes: 15,
      riskGradeThreshold: 55,
      riskAttendanceThreshold: 75,
    })))
      .toEqual({
        absenceThreshold: 5,
        lateAfterMinutes: 15,
        riskGradeThreshold: 55,
        riskAttendanceThreshold: 75,
      });
  });

  it('fills in the default for whichever field is missing', () => {
    expect(parseAttendanceRule(JSON.stringify({ absenceThreshold: 7 })))
      .toEqual({ ...defaults, absenceThreshold: 7 });
    expect(parseAttendanceRule(JSON.stringify({ lateAfterMinutes: 20 })))
      .toEqual({ ...defaults, lateAfterMinutes: 20 });
  });

  it('rejects non-integer or non-positive values and falls back to defaults', () => {
    expect(parseAttendanceRule(JSON.stringify({ absenceThreshold: 0 })).absenceThreshold).toBe(3);
    expect(parseAttendanceRule(JSON.stringify({ absenceThreshold: -1 })).absenceThreshold).toBe(3);
    expect(parseAttendanceRule(JSON.stringify({ absenceThreshold: 2.5 })).absenceThreshold).toBe(3);
    expect(parseAttendanceRule(JSON.stringify({ lateAfterMinutes: -5 })).lateAfterMinutes).toBe(10);
    expect(parseAttendanceRule(JSON.stringify({ riskGradeThreshold: 101 })).riskGradeThreshold).toBe(60);
    expect(parseAttendanceRule(JSON.stringify({ riskAttendanceThreshold: -1 })).riskAttendanceThreshold).toBe(80);
  });
});
