#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const backendRoot = path.resolve(__dirname, '..', '..');
const inventoryPath = path.join(backendRoot, 'docs', 'api-route-inventory.generated.json');
const openApiSource = fs.readFileSync(path.join(backendRoot, 'gateway/src/openapi.ts'), 'utf8');
const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
const generatedInventorySource = fs.readFileSync(path.join(backendRoot, 'gateway/src/openapi-route-inventory.generated.ts'), 'utf8');

const documentedPaths = new Set([...openApiSource.matchAll(/['"`](\/api\/v1\/[^'"`]+)['"`]\s*:/g)].map((m) => m[1]));
const documentedOperations = new Set();
for (const pathValue of documentedPaths) {
  const blockStart = openApiSource.indexOf(`'${pathValue}'`);
  const block = openApiSource.slice(blockStart, openApiSource.indexOf("\n    '/api/v1/", blockStart + 1) === -1 ? undefined : openApiSource.indexOf("\n    '/api/v1/", blockStart + 1));
  for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    if (new RegExp(`\\b${method}\\s*:`).test(block)) documentedOperations.add(`${method.toUpperCase()} ${pathValue}`);
  }
}

const gatewayRelevant = inventory.routes.filter((route) => !route.path.includes('/health'));
const generatedOperations = new Set(
  [...generatedInventorySource.matchAll(/"method": "([^"]+)",\n\s+"path": "([^"]+)"/g)]
    .map((match) => `${match[1]} ${match[2]}`),
);
const missing = gatewayRelevant.filter((route) => (
  !documentedOperations.has(`${route.method} ${route.path}`) &&
  !generatedOperations.has(`${route.method} ${route.path}`)
));

if (missing.length) {
  console.error('OpenAPI coverage gaps:');
  for (const route of missing) console.error(`- ${route.method} ${route.path} (${route.service})`);
  process.exit(1);
}

console.log(`OpenAPI covers ${gatewayRelevant.length}/${gatewayRelevant.length} gateway routes.`);
