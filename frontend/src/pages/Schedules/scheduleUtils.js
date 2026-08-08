export const SCHEDULE_TIMEZONE = 'Asia/Ulaanbaatar';

export const DAYS = [
  { value: 'MONDAY', label: 'Даваа' },
  { value: 'TUESDAY', label: 'Мягмар' },
  { value: 'WEDNESDAY', label: 'Лхагва' },
  { value: 'THURSDAY', label: 'Пүрэв' },
  { value: 'FRIDAY', label: 'Баасан' },
  { value: 'SATURDAY', label: 'Бямба' },
  { value: 'SUNDAY', label: 'Ням' },
];

export const DAY_LABELS = Object.fromEntries(DAYS.map(day => [day.value, day.label]));
const weekdayToScheduleDay = {
  Mon: 'MONDAY',
  Tue: 'TUESDAY',
  Wed: 'WEDNESDAY',
  Thu: 'THURSDAY',
  Fri: 'FRIDAY',
  Sat: 'SATURDAY',
  Sun: 'SUNDAY',
};
const calendarPartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: SCHEDULE_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
});

const calendarParts = value => {
  const parts = Object.fromEntries(
    calendarPartsFormatter.formatToParts(new Date(value)).map(part => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: weekdayToScheduleDay[parts.weekday],
  };
};

// UTC 04:00 is local noon in Ulaanbaatar. Keeping calendar values at noon
// avoids crossing a day boundary when they are passed through Date/Intl.
const fromCalendarParts = (year, month, day) => new Date(Date.UTC(year, month - 1, day, 4));

export const compareSchedules = (left, right) => {
  const dayDifference = DAYS.findIndex(day => day.value === left.dayOfWeek)
    - DAYS.findIndex(day => day.value === right.dayOfWeek);
  return dayDifference || left.startTime.localeCompare(right.startTime);
};

export const startOfWeek = value => {
  const parts = calendarParts(value);
  const dayIndex = DAYS.findIndex(day => day.value === parts.weekday);
  return fromCalendarParts(parts.year, parts.month, parts.day - dayIndex);
};

export const weekDates = value => {
  const monday = startOfWeek(value);
  return DAYS.map((_, index) => addCalendarDays(monday, index));
};

export const monthGrid = value => {
  const parts = calendarParts(value);
  const first = fromCalendarParts(parts.year, parts.month, 1);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, index) => addCalendarDays(start, index));
};

export const scheduleDayForDate = date => calendarParts(date).weekday;

export const addCalendarDays = (value, amount) => {
  const parts = calendarParts(value);
  return fromCalendarParts(parts.year, parts.month, parts.day + amount);
};

export const addCalendarMonths = (value, amount) => {
  const parts = calendarParts(value);
  const monthIndex = parts.year * 12 + parts.month - 1 + amount;
  const year = Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12 + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return fromCalendarParts(year, month, Math.min(parts.day, lastDay));
};

export const sameCalendarMonth = (left, right) => {
  const leftParts = calendarParts(left);
  const rightParts = calendarParts(right);
  return leftParts.year === rightParts.year && leftParts.month === rightParts.month;
};

export const calendarDayNumber = value => calendarParts(value).day;

const localDateKey = date => {
  const parts = calendarParts(date);
  return [
    parts.year,
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
  ].join('-');
};

export const occursOnDate = (schedule, date) => {
  if (schedule.dayOfWeek !== scheduleDayForDate(date)) return false;
  if (!schedule.term) return true;
  const key = localDateKey(date);
  const start = String(schedule.term.startDate).slice(0, 10);
  const end = String(schedule.term.endDate).slice(0, 10);
  return key >= start && key <= end;
};

export const formatDate = date => new Intl.DateTimeFormat('mn-MN', {
  timeZone: SCHEDULE_TIMEZONE,
  month: 'short',
  day: 'numeric',
}).format(date);

export const formatMonth = date => new Intl.DateTimeFormat('mn-MN', {
  timeZone: SCHEDULE_TIMEZONE,
  year: 'numeric',
  month: 'long',
}).format(date);
