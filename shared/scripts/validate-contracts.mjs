#!/usr/bin/env node
/**
 * validate-contracts.mjs
 * 
 * Validates all contract JSON files in shared/api-contracts/.
 * Checks: valid JSON, required top-level fields, schema field present,
 * version format, example field present.
 * 
 * Usage: node shared/scripts/validate-contracts.mjs
 * Exit code 0 = all pass, 1 = failures found.
 */

import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = resolve(__dirname, '../api-contracts');

// New-format contracts (SAAS-12+) have these top-level wrapper fields.
// Old-format contracts (SAAS-01 era) are raw JSON Schema — identified by having "$schema" at root.
const REQUIRED_TOP_LEVEL = ['contract_name', 'version', 'description', 'last_updated', 'schema', 'example', 'changelog'];
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const REQUIRED_SCHEMA_FIELDS = ['$schema', '$id', 'title', 'type'];
const LEGACY_REQUIRED = ['$id', 'title', 'description', 'type'];

let totalChecked = 0;
let totalFailed = 0;

function checkContract(filePath, fileName) {
  const errors = [];

  // 1. Parse JSON
  let contract;
  try {
    const raw = readFileSync(filePath, 'utf-8');
    contract = JSON.parse(raw);
  } catch (e) {
    errors.push(`PARSE ERROR: ${e.message}`);
    return errors;
  }

  // Detect format: if root has "$schema" → legacy raw JSON Schema format (SAAS-01 era)
  const isLegacyFormat = '$schema' in contract;

  if (isLegacyFormat) {
    // Legacy contracts: just check required JSON Schema fields
    for (const field of LEGACY_REQUIRED) {
      if (!(field in contract)) {
        errors.push(`LEGACY SCHEMA MISSING: "${field}" is required`);
      }
    }
    return errors;
  }

  // New-format validation (SAAS-12+)

  // 2. Required top-level fields
  for (const field of REQUIRED_TOP_LEVEL) {
    if (!(field in contract)) {
      errors.push(`MISSING FIELD: "${field}" is required`);
    }
  }

  // 3. contract_name must match filename (without .contract.json)
  if (contract.contract_name) {
    const expectedName = fileName.replace('.contract.json', '');
    if (contract.contract_name !== expectedName) {
      errors.push(`NAME MISMATCH: contract_name "${contract.contract_name}" does not match filename "${expectedName}"`);
    }
  }

  // 4. version format
  if (contract.version && !VERSION_PATTERN.test(contract.version)) {
    errors.push(`VERSION FORMAT: "${contract.version}" is not semver (expected X.Y.Z)`);
  }

  // 5. Schema field checks
  if (contract.schema && typeof contract.schema === 'object') {
    for (const field of REQUIRED_SCHEMA_FIELDS) {
      if (!(field in contract.schema)) {
        errors.push(`SCHEMA MISSING: schema.${field} is required`);
      }
    }
    // type must be "object"
    if (contract.schema.type && contract.schema.type !== 'object') {
      errors.push(`SCHEMA TYPE: schema.type must be "object", got "${contract.schema.type}"`);
    }
    // required array must exist
    if (!Array.isArray(contract.schema.required)) {
      errors.push(`SCHEMA MISSING: schema.required must be an array`);
    }
    // properties must exist
    if (!contract.schema.properties || typeof contract.schema.properties !== 'object') {
      errors.push(`SCHEMA MISSING: schema.properties must be an object`);
    }
  }

  // 6. example must be object (not array, not null)
  if ('example' in contract && (typeof contract.example !== 'object' || Array.isArray(contract.example) || contract.example === null)) {
    errors.push(`EXAMPLE FORMAT: example must be a non-null object`);
  }

  // 7. changelog must be non-empty array
  if ('changelog' in contract) {
    if (!Array.isArray(contract.changelog) || contract.changelog.length === 0) {
      errors.push(`CHANGELOG: must be a non-empty array`);
    } else {
      const first = contract.changelog[0];
      if (!first.version || !first.date || !first.changes) {
        errors.push(`CHANGELOG: first entry must have version, date, changes fields`);
      }
    }
  }

  return errors;
}

// ---- Main ----

console.log(`\n🔍 VNInvest Contract Validator`);
console.log(`   Scanning: ${CONTRACTS_DIR}\n`);

let contractFiles;
try {
  contractFiles = readdirSync(CONTRACTS_DIR)
    .filter(f => f.endsWith('.contract.json'))
    .sort();
} catch (e) {
  console.error(`ERROR: Cannot read contracts directory: ${e.message}`);
  process.exit(1);
}

if (contractFiles.length === 0) {
  console.error('ERROR: No .contract.json files found');
  process.exit(1);
}

for (const fileName of contractFiles) {
  totalChecked++;
  const filePath = join(CONTRACTS_DIR, fileName);
  const errors = checkContract(filePath, fileName);

  if (errors.length === 0) {
    // Read to get contract_name and version for display
    let name = fileName;
    let ver = '';
    let tag = '';
    try {
      const c = JSON.parse(readFileSync(filePath, 'utf-8'));
      const isLegacy = '$schema' in c;
      if (isLegacy) {
        name = c.$id || fileName;
        ver = '';
        tag = ' [legacy]';
      } else {
        name = c.contract_name || fileName;
        ver = c.version ? ` v${c.version}` : '';
        tag = '';
      }
    } catch {}
    console.log(`  ✅ PASS  ${name}${ver}${tag}`);
  } else {
    totalFailed++;
    console.log(`  ❌ FAIL  ${fileName}`);
    for (const err of errors) {
      console.log(`         → ${err}`);
    }
  }
}

console.log(`\n─────────────────────────────────────`);
console.log(`  Checked : ${totalChecked} contracts`);
console.log(`  Passed  : ${totalChecked - totalFailed}`);
console.log(`  Failed  : ${totalFailed}`);

if (totalFailed > 0) {
  console.log(`\n❌ Validation FAILED — fix errors above before proceeding.\n`);
  process.exit(1);
} else {
  console.log(`\n✅ All contracts VALID.\n`);
  process.exit(0);
}
