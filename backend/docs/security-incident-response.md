# Security incident response runbook

## Scope and severity

Use this runbook for suspected credential/secret exposure, cross-tenant access,
malware upload, account takeover, data loss/exfiltration, supply-chain compromise,
service abuse or integrity failure.

- **SEV-1:** confirmed/likely cross-tenant or sensitive-data exposure, active
  compromise, destructive malware, signing-key compromise, or broad outage.
- **SEV-2:** contained account/tenant compromise, exploitable high-risk control
  failure, or material integrity issue.
- **SEV-3:** suspicious event, blocked attack, low-impact vulnerability.

Incident commander owns decisions; security lead owns investigation/containment;
service owner owns remediation; privacy/legal owner decides regulatory/data-subject
notification; communications owner handles approved messages. Maintain an
out-of-band contact list and at least two backups for every role.

## First 30 minutes

1. Open a restricted incident record with UTC timestamp, reporter, systems,
   tenants/data possibly affected and initial severity. Do not copy secrets or raw
   student data into chat/tickets.
2. Preserve immutable audit, gateway/provider logs, event envelopes/DLQ, deployment
   hashes and relevant database/object-store access logs. Record acquisition hash,
   owner and chain of custody.
3. Contain with the narrowest safe action: revoke sessions/provider credentials,
   disable account/tenant/endpoint, quarantine object keys, stop a consumer or
   block indicators. Do not destroy evidence.
4. For a secret, follow `secret-rotation-runbook.md`; assume committed/logged
   values are compromised.
5. Notify incident commander, security and privacy/legal owners. SEV-1 pages them
   immediately.

## Investigate and eradicate

- Build an evidence-based timeline: initial access, affected identities/tenants,
  data accessed/changed/exported, persistence and outbound destinations.
- Query audit by tenant/time/event and correlate `traceId`, `eventId`, session,
  provider message and object key. Export audit CSV into the restricted case.
- Validate whether tenant boundaries, OAuth state, refresh reuse, file scanner,
  signed URL, event inbox/outbox or provider webhook were bypassed.
- Patch the root cause, add a regression test reproducing the attack, scan all
  sibling resources and rotate/rebuild from trusted locked sources.
- Reconcile events and database projections; replay only reviewed non-poison
  messages using the event operations tool.

## Recover

1. Restore service in stages with enhanced alerts, least privilege and known-good
   artifacts.
2. Verify login/session, tenant/role/IDOR boundaries, exports/deletion, upload scan,
   notifications, billing and event reconciliation.
3. Monitor attacker indicators, unusual exports, 403/429 changes, DLQ growth,
   malware findings and new sessions.
4. Obtain incident commander and service/security owner sign-off.

## Notification and closure

Privacy/legal determines whether, when and how to notify regulators, organizations,
guardians or data subjects according to verified facts and applicable deadlines.
Communications must state known impact, timeframe, containment and protective
action without speculation or exposing another tenant.

Within five business days, complete a blameless review with timeline, root cause,
control/test changes, affected retention/legal actions, owners and due dates.
Track every action to closure and test the runbook in a tabletop exercise at least
twice yearly.
