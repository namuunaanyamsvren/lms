import { describe, expect, it } from 'vitest';
import { validatePasswordForForm } from './passwordPolicy';

describe('frontend password policy guidance', () => {
  it('explains the minimum length', () => {
    expect(validatePasswordForForm('too-short')).toContain('12');
  });

  it('rejects common and user-derived passwords', () => {
    expect(validatePasswordForForm('Password123!')).toContain('Түгээмэл');
    expect(validatePasswordForForm('Alice-school-account-47', {
      firstName: 'Alice',
    })).toContain('хувийн мэдээлэл');
  });

  it('accepts a valid long passphrase for backend verification', () => {
    expect(validatePasswordForForm('orbit meadow copper lantern 47')).toBeNull();
  });
});
