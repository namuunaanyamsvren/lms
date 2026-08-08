const spreadsheetSafe = (value: unknown) => {
  const text = String(value ?? '');
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
};

const cell = (value: unknown) => {
  const valueString = spreadsheetSafe(value);
  return /[",\r\n]/.test(valueString)
    ? `"${valueString.replace(/"/g, '""')}"`
    : valueString;
};

export const ATTENDANCE_CSV_COLUMNS = ['studentEmail', 'date', 'status', 'note'] as const;

// Leading BOM so Excel detects UTF-8 instead of mis-rendering Cyrillic notes —
// matches the convention already used by report-storage.service.ts's CSV exports.
export const serializeCsv = (rows: Array<Record<string, unknown>>) => '﻿' + [
  ATTENDANCE_CSV_COLUMNS.join(','),
  ...rows.map(row => ATTENDANCE_CSV_COLUMNS.map(column => cell(row[column])).join(',')),
].join('\r\n');
