import { describe, expect, it } from 'vitest';
import { payload, resourceParams, rolloverBody, updatePayload } from '../academic-service/src/validators/academic-structure.validator';

describe('academic structure validation', () => {
  it('accepts known resources and rejects arbitrary model access', () => {
    expect(resourceParams.parse({ resource: 'years' }).resource).toBe('years');
    expect(() => resourceParams.parse({ resource: 'users' })).toThrow();
  });
  it('validates term and room hierarchy payloads', () => {
    expect(payload.parse({ name: 'Fall', code: '2026-FALL', academicYearId: '11111111-1111-4111-8111-111111111111', startDate: '2026-09-01', endDate: '2026-12-20' })).toMatchObject({ code: '2026-FALL' });
    expect(payload.parse({ name: '101', code: 'R101', buildingId: '11111111-1111-4111-8111-111111111111', capacity: 30, type: 'CLASSROOM' })).toMatchObject({ capacity: 30 });
  });
  it('protects tenant fields and validates rollover input', () => {
    expect(() => updatePayload.parse({ organizationId: 'other-tenant' })).toThrow();
    expect(rolloverBody.parse({ name: '2027', startDate: '2027-01-01', endDate: '2027-12-31', codePrefix: '2027' }).cloneSchedules).toBe(true);
  });
});
