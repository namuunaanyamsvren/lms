#!/usr/bin/env node
const assert = require('node:assert/strict');

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`Usage: BASE_URL=http://127.0.0.1:8080/api/v1 node scripts/nonfunctional/resilience-check.js

Run this while Redis, RabbitMQ, or a downstream service is intentionally
stopped. The check verifies selected gateway routes fail fast with bounded
responses instead of hanging or crashing.`);
  process.exit(0);
}

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:8080/api/v1';
const checks = [
  { name: 'gateway health', path: process.env.HEALTH_PATH || '/health', statuses: [200, 204, 404] },
  { name: 'tenant resolve remains bounded', path: '/organizations/resolve?host=e2e-school', statuses: [200, 404, 503] },
  { name: 'notification list remains bounded', path: '/notifications', statuses: [200, 401, 403, 503] },
];

async function main() {
  const failures = [];
  for (const check of checks) {
    const started = Date.now();
    try {
      const response = await fetch(`${baseUrl}${check.path}`, { signal: AbortSignal.timeout(5000) });
      const elapsed = Date.now() - started;
      if (!check.statuses.includes(response.status)) {
        failures.push(`${check.name}: unexpected ${response.status}`);
      }
      if (elapsed > 5000) failures.push(`${check.name}: slow ${elapsed}ms`);
      console.log(`[resilience] ${check.name}: ${response.status} in ${elapsed}ms`);
    } catch (error) {
      failures.push(`${check.name}: ${error.message}`);
    }
  }
  assert.equal(failures.length, 0, failures.join('\n'));
  console.log('[resilience] bounded outage behavior checks passed');
}

main().catch(error => {
  console.error(error.message || error);
  process.exit(1);
});
