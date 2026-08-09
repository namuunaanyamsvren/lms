import { describe, expect, it } from 'vitest';
import { serializeCsv as serializeGradeCsv, parseCsv } from '../academic-service/src/services/grade-csv.service';
import { serializeCsv as serializeAttendanceCsv } from '../academic-service/src/services/attendance-csv.service';

const BOM = '﻿';

describe('CSV export UTF-8 BOM', () => {
  it('prefixes grade CSV exports with a UTF-8 BOM so Excel renders Cyrillic correctly', () => {
    const csv = serializeGradeCsv([{ studentEmail: 'a@b.mn', score: 90, feedback: 'Сайн ажилласан' }]);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv).toContain('Сайн ажилласан');
  });

  it('prefixes attendance CSV exports with a UTF-8 BOM', () => {
    const csv = serializeAttendanceCsv([{ studentEmail: 'a@b.mn', date: '2026-08-07', status: 'ABSENT', note: 'Өвчтэй' }]);
    expect(csv.startsWith(BOM)).toBe(true);
  });

  it('round-trips: a BOM-prefixed exported grade CSV can be re-parsed for bulk import', () => {
    const csv = serializeGradeCsv([{ studentEmail: 'a@b.mn', score: 90, feedback: 'ok' }]);
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].value.studentEmail).toBe('a@b.mn');
    expect(rows[0].value.score).toBe('90');
  });

  it('parseCsv also strips a BOM from externally-produced (e.g. Excel) input', () => {
    const rows = parseCsv(`${BOM}studentEmail,score,feedback\na@b.mn,80,\n`);
    expect(rows[0].value.studentEmail).toBe('a@b.mn');
  });
});
