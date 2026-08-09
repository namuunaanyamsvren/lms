#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const { openApiDocument } = require('../gateway/dist/openapi');

const outputPath = path.resolve(__dirname, '..', 'openapi.generated.json');
fs.writeFileSync(outputPath, JSON.stringify(openApiDocument, null, 2));
console.log(`[OpenAPI] Exported gateway contract to ${outputPath}`);
