import { describe, expect, it } from 'vitest';
import { REPORT_CATALOG, catalogFor } from '../academic-service/src/services/report-data.service';
import { renderCsv, renderPdf } from '../academic-service/src/services/report-storage.service';

describe('report catalog access control', () => {
  it('only exposes billing/revenue to finance and admin roles', () => {
    const financeTypes = catalogFor('FINANCE').map(e => e.type);
    const instructorTypes = catalogFor('INSTRUCTOR').map(e => e.type);
    expect(financeTypes).toContain('BILLING_REVENUE');
    expect(instructorTypes).not.toContain('BILLING_REVENUE');
  });

  it('restricts teacher workload and org usage reports away from instructors', () => {
    const instructorTypes = catalogFor('INSTRUCTOR').map(e => e.type);
    expect(instructorTypes).not.toContain('TEACHER_WORKLOAD');
    expect(instructorTypes).not.toContain('ORG_USAGE_ADOPTION');
    expect(catalogFor('STAFF').map(e => e.type)).toContain('TEACHER_WORKLOAD');
    expect(catalogFor('ORG_ADMIN').map(e => e.type)).toContain('ORG_USAGE_ADOPTION');
  });

  it('grants students no reports at all', () => {
    expect(catalogFor('STUDENT')).toEqual([]);
  });

  it('every catalog entry has a unique type and non-empty role list', () => {
    const types = REPORT_CATALOG.map(e => e.type);
    expect(new Set(types).size).toBe(types.length);
    REPORT_CATALOG.forEach(entry => expect(entry.roles.length).toBeGreaterThan(0));
  });
});

describe('report CSV rendering', () => {
  const BOM = '﻿';

  it('prefixes a UTF-8 BOM so Excel renders Cyrillic labels correctly', () => {
    const csv = renderCsv({ columns: [{ key: 'name', label: 'Нэр' }], rows: [{ name: 'Болд' }] });
    expect(csv.startsWith(BOM)).toBe(true);
  });

  it('renders a header row and escapes values containing commas/quotes', () => {
    const csv = renderCsv({
      columns: [{ key: 'name', label: 'Нэр' }, { key: 'note', label: 'Тэмдэглэл' }],
      rows: [{ name: 'Bат, Boлд', note: 'Says "hi"' }],
    });
    const lines = csv.slice(BOM.length).split('\r\n');
    expect(lines[0]).toBe('Нэр,Тэмдэглэл');
    expect(lines[1]).toBe('"Bат, Boлд","Says ""hi"""');
  });

  it('neutralizes spreadsheet-formula-injection values', () => {
    const csv = renderCsv({ columns: [{ key: 'value', label: 'Утга' }], rows: [{ value: '=SUM(A1)' }] });
    expect(csv.slice(BOM.length).split('\r\n')[1]).toBe("'=SUM(A1)");
  });
});

describe('report PDF rendering', () => {
  it('produces a non-empty PDF buffer with the correct file signature', async () => {
    const buffer = await renderPdf('ATTENDANCE', new Date('2026-08-08T00:00:00Z'), {
      columns: [{ key: 'cohort', label: 'Анги' }, { key: 'presentPct', label: 'Ирц (%)' }],
      rows: [{ cohort: 'Math — Cohort 1', presentPct: 92 }],
    });
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    // %PDF- magic bytes — proves pdfkit actually produced a valid PDF, not just any buffer.
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('paginates onto additional pages when rows exceed one page (repeats the header)', async () => {
    const manyRows = Array.from({ length: 80 }, (_, i) => ({ cohort: `Cohort ${i}`, presentPct: i }));
    const buffer = await renderPdf('ATTENDANCE', new Date(), {
      columns: [{ key: 'cohort', label: 'Анги' }, { key: 'presentPct', label: 'Ирц (%)' }],
      rows: manyRows,
    });
    // A crude but reliable pagination signal: pdfkit emits a new /Type /Page
    // object per page, so more than one occurrence proves addPage() fired.
    const pageObjectCount = (buffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    expect(pageObjectCount).toBeGreaterThan(1);
  });

  it('handles an empty-rows table without throwing', async () => {
    const buffer = await renderPdf('ATTENDANCE', new Date(), { columns: [{ key: 'x', label: 'X' }], rows: [] });
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
