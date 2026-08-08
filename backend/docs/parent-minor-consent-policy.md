# Parent and minor consent policy template

This is an operational template, not jurisdiction-specific legal advice. The
organization's privacy/legal owner must approve the applicable age threshold,
lawful basis, notices and retention before enrolling minors.

## Principles

- Collect the minimum data needed for education; do not collect date of birth only
  for convenience.
- Do not sell minor data, use targeted advertising, or enable optional profiling.
- Explain data use in age-appropriate language and provide the parent/minor notice
  before collection when required.
- Separate required educational processing from optional consent. Refusing
  optional processing must not block required education.

## Guardian workflow

1. An authorized staff member verifies guardian identity and authority outside the
   public registration flow.
2. Create the tenant-scoped `Guardian` relation; never trust a parent-supplied
   student ID alone.
3. Record notice/policy version, lawful basis or consent, verifier, timestamp and
   scope in the organization's approved consent register.
4. Until verified, the parent receives no student course, grade, attendance,
   submission or exam data.
5. Re-verify on organization transfer, disputed custody, expiry or material policy
   change.

## Rights and revocation

Provide authenticated correction/export requests and a documented method to revoke
optional consent. Revocation stops future optional processing; it does not erase
records that education law requires. Disputes, safety issues and suspected
unauthorized parent access are escalated immediately to the privacy/safeguarding
owner and audited.

Access-control tests must cover cross-tenant guardian IDs, unrelated parents,
multiple children, disabled users and both directions of every guardian query.
