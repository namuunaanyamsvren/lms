#!/usr/bin/env node
require('dotenv').config();

const { validateProductionReadiness } = require('../shared/dist/config');

const result = validateProductionReadiness(process.env);

for (const issue of result.issues) {
  const prefix = issue.level === 'error' ? 'ERROR' : 'WARN';
  console.log(`[${prefix}] ${issue.key}: ${issue.message}`);
}

if (!result.ready) {
  console.error('Production readiness validation failed.');
  process.exit(1);
}

console.log('Production readiness validation passed.');
