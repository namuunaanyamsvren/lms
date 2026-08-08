import { describe, expect, it } from 'vitest';
import { openApiDocument } from '../gateway/src/openapi';

describe('OpenAPI contract', () => {
  it('documents gateway paths and bearer authentication', () => {
    expect(openApiDocument.openapi).toBe('3.0.3');
    expect(openApiDocument.components.securitySchemes.bearerAuth.scheme).toBe('bearer');
    expect(openApiDocument.paths['/api/v1/courses'].get.security).toEqual([{ bearerAuth: [] }]);
    expect(openApiDocument.paths['/api/v1/organizations/onboard'].post).toBeDefined();
  });

  it('includes generated route inventory metadata for every service route', () => {
    const inventory = openApiDocument['x-routeInventory'];

    expect(inventory.routeCount).toBeGreaterThan(100);
    expect(inventory.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'POST', path: '/api/v1/auth/login', service: 'auth' }),
        expect.objectContaining({ method: 'GET', path: '/api/v1/courses', service: 'academic' }),
        expect.objectContaining({ method: 'GET', path: '/api/v1/notifications', service: 'notifications' }),
      ]),
    );
  });

  it('documents the role-scoped schedule filters and overlap response', () => {
    const scheduleList = openApiDocument.paths['/api/v1/schedules'].get;
    const parameterNames = scheduleList.parameters.map((parameter) => parameter.name);

    expect(parameterNames).toEqual(
      expect.arrayContaining(['courseId', 'semester', 'termId', 'teacherId', 'studentId']),
    );
    expect(openApiDocument.paths['/api/v1/schedules/options'].get).toBeDefined();
    expect(openApiDocument.paths['/api/v1/schedules'].post.responses['409']).toBeDefined();
    expect(openApiDocument.paths['/api/v1/schedules/{id}'].put.responses['409']).toBeDefined();
    expect(openApiDocument.paths['/api/v1/schedules/{id}'].parameters[0].schema).toEqual({
      type: 'string',
    });
  });

  it('does not advertise post-MVP billing surfaces', () => {
    expect(openApiDocument.tags.some((tag) => tag.name === 'Billing')).toBe(false);
    expect(openApiDocument.paths['/api/v1/payments']).toBeUndefined();
    expect(openApiDocument.paths['/api/v1/invoices']).toBeUndefined();
  });
});
