export const FIXTURE_CLOCK = new Date('2026-07-30T00:00:00.000Z');
export const FIXTURE_ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';

const stableUuid = (namespace: number, index: number) =>
  `00000000-0000-4${String(namespace).padStart(3, '0')}-8000-${String(index).padStart(12, '0')}`;

export function makeUserFixture(index = 1, overrides: Record<string, unknown> = {}) {
  return {
    id: stableUuid(1, index),
    organizationId: FIXTURE_ORGANIZATION_ID,
    email: `student-${index}@example.test`,
    username: `student-${index}`,
    firstName: 'Test',
    lastName: `Student ${index}`,
    role: 'STUDENT',
    isActive: true,
    deletedAt: null,
    createdAt: new Date(FIXTURE_CLOCK),
    updatedAt: new Date(FIXTURE_CLOCK),
    ...overrides,
  };
}

export function makeCourseFixture(index = 1, overrides: Record<string, unknown> = {}) {
  return {
    id: stableUuid(2, index),
    organizationId: FIXTURE_ORGANIZATION_ID,
    code: `TEST-${String(index).padStart(3, '0')}`,
    title: `Deterministic course ${index}`,
    instructorId: stableUuid(1, 900),
    status: 'DRAFT',
    credits: 3,
    deletedAt: null,
    createdAt: new Date(FIXTURE_CLOCK),
    updatedAt: new Date(FIXTURE_CLOCK),
    ...overrides,
  };
}
