import { describe, expect, it } from 'vitest';
import {
  DAY_LABELS,
  monthGrid,
  occursOnDate,
  scheduleDayForDate,
  SCHEDULE_TIMEZONE,
  weekDates,
} from './scheduleUtils';

describe('schedule calendar utilities', () => {
  it('uses the Mongolia timezone and renders every day in Mongolian', () => {
    expect(SCHEDULE_TIMEZONE).toBe('Asia/Ulaanbaatar');
    expect(DAY_LABELS).toEqual({
      MONDAY: 'Даваа',
      TUESDAY: 'Мягмар',
      WEDNESDAY: 'Лхагва',
      THURSDAY: 'Пүрэв',
      FRIDAY: 'Баасан',
      SATURDAY: 'Бямба',
      SUNDAY: 'Ням',
    });
  });

  it('builds Monday-first week and six-row month grids', () => {
    const week = weekDates(new Date(2026, 7, 26, 12));
    expect(scheduleDayForDate(week[0])).toBe('MONDAY');
    expect(scheduleDayForDate(week[6])).toBe('SUNDAY');
    expect(monthGrid(new Date(2026, 7, 1, 12))).toHaveLength(42);
  });

  it('uses the Ulaanbaatar calendar day at the UTC date boundary', () => {
    expect(scheduleDayForDate(new Date('2026-08-23T16:30:00.000Z'))).toBe('MONDAY');
  });

  it('shows recurring entries only inside their related term', () => {
    const schedule = {
      dayOfWeek: 'MONDAY',
      term: {
        startDate: '2026-08-20T00:00:00.000Z',
        endDate: '2026-12-20T00:00:00.000Z',
      },
    };
    expect(occursOnDate(schedule, new Date(2026, 7, 24, 12))).toBe(true);
    expect(occursOnDate(schedule, new Date(2027, 0, 4, 12))).toBe(false);
  });
});
