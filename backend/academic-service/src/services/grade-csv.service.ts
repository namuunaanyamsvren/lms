import { AppError } from '@lms/shared';

export const GRADE_CSV_COLUMNS = ['studentEmail', 'score', 'feedback'] as const;

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

// Leading BOM so Excel (still the primary consumer for Cyrillic feedback/notes
// text) detects UTF-8 instead of mis-rendering as garbled text — matches the
// convention already used by report-storage.service.ts's CSV exports.
export const serializeCsv = (rows: Array<Record<string, unknown>>) => '﻿' + [
  GRADE_CSV_COLUMNS.join(','),
  ...rows.map(row => GRADE_CSV_COLUMNS.map(column => cell(row[column])).join(',')),
].join('\r\n');

export const parseCsv = (input: string, maxRows = 1000) => {
  if (Buffer.byteLength(input, 'utf8') > 5 * 1024 * 1024) {
    throw new AppError('CSV file exceeds 5 MB', 413);
  }
  // Strip a leading BOM so re-uploading a file this service (or Excel) exported
  // doesn't turn the first header into "﻿studentEmail" and fail column validation.
  input = input.replace(/^﻿/, '');
  const records: string[][] = [];
  let record: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === ',') {
      record.push(value);
      value = '';
    } else if (character === '\n') {
      record.push(value.replace(/\r$/, ''));
      if (record.some(item => item.trim())) records.push(record);
      record = [];
      value = '';
      if (records.length > maxRows + 1) throw new AppError(`CSV may contain at most ${maxRows} rows`, 413);
    } else {
      value += character;
    }
  }
  if (quoted) throw AppError.badRequest('CSV contains an unterminated quoted value');
  record.push(value.replace(/\r$/, ''));
  if (record.some(item => item.trim())) records.push(record);
  if (records.length < 2) throw AppError.badRequest('CSV must include a header and at least one data row');

  const headers = records[0].map(header => header.trim());
  const unknown = headers.filter(header => !GRADE_CSV_COLUMNS.includes(header as typeof GRADE_CSV_COLUMNS[number]));
  if (unknown.length) throw AppError.badRequest(`Unknown CSV columns: ${unknown.join(', ')}`);
  for (const required of ['studentEmail', 'score']) {
    if (!headers.includes(required)) throw AppError.badRequest(`CSV is missing required column: ${required}`);
  }

  return records.slice(1).map((values, index) => ({
    rowNumber: index + 2,
    value: Object.fromEntries(headers.map((header, cellIndex) => [
      header,
      values[cellIndex]?.trim() || undefined,
    ])),
  }));
};
