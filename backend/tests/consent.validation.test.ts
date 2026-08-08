import { describe, expect, it } from 'vitest';
import {
  acknowledgeConsentBody,
  consentFormBody,
  consentFormIdParams,
  consentFormUpdateBody,
} from '../academic-service/src/validators/consent.validator';

const validForm = {
  title: 'Field trip permission slip',
  body: 'Please acknowledge that your child may attend the museum field trip on 2026-09-01.',
  requiresSignature: true,
  dueAt: '2026-08-25T00:00:00.000Z',
};

describe('consent form validation', () => {
  it('accepts a valid consent form payload', () => {
    expect(consentFormBody.safeParse(validForm).success).toBe(true);
  });

  it('accepts a payload without the optional fields', () => {
    expect(consentFormBody.safeParse({ title: 'Policy update', body: 'Please review the updated privacy policy.' }).success).toBe(true);
  });

  it('rejects an organizationId or status field smuggled into the body', () => {
    expect(consentFormBody.safeParse({
      ...validForm,
      organizationId: 'attacker-org',
      status: 'PUBLISHED',
    }).success).toBe(false);
  });

  it('rejects an empty title or body', () => {
    expect(consentFormBody.safeParse({ ...validForm, title: '' }).success).toBe(false);
    expect(consentFormBody.safeParse({ ...validForm, body: '' }).success).toBe(false);
  });

  it('rejects a malformed dueAt', () => {
    expect(consentFormBody.safeParse({ ...validForm, dueAt: '2026-08-25' }).success).toBe(false);
  });

  it('requires at least one field on update', () => {
    expect(consentFormUpdateBody.safeParse({}).success).toBe(false);
    expect(consentFormUpdateBody.safeParse({ title: 'Updated title' }).success).toBe(true);
  });

  it('accepts opaque service ids while rejecting blank ids', () => {
    expect(consentFormIdParams.safeParse({ id: '11111111-1111-4111-8111-111111111111' }).success).toBe(true);
    expect(consentFormIdParams.safeParse({ id: 'legacy_form_1' }).success).toBe(true);
    expect(consentFormIdParams.safeParse({ id: '   ' }).success).toBe(false);
  });
});

describe('consent acknowledgement validation', () => {
  it('accepts a decline without a signature', () => {
    expect(acknowledgeConsentBody.safeParse({
      studentUserId: '22222222-2222-4222-8222-222222222222',
      status: 'DECLINED',
    }).success).toBe(true);
  });

  it('accepts an acknowledge response with a signature', () => {
    expect(acknowledgeConsentBody.safeParse({
      studentUserId: '22222222-2222-4222-8222-222222222222',
      status: 'ACKNOWLEDGED',
      signatureName: 'Jane Doe',
    }).success).toBe(true);
  });

  it('rejects an unknown status value', () => {
    expect(acknowledgeConsentBody.safeParse({
      studentUserId: '22222222-2222-4222-8222-222222222222',
      status: 'MAYBE',
    }).success).toBe(false);
  });

  it('rejects a missing studentUserId', () => {
    expect(acknowledgeConsentBody.safeParse({ status: 'DECLINED' }).success).toBe(false);
  });
});
