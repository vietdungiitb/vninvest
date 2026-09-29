#!/usr/bin/env node
// scan-secrets.mjs — offline secret gate for the vninvest repo.
//
// Scans git-tracked files for high-confidence credential patterns.
//
// Design rules (learned from the first SEC-03 attempt):
//  1. Only *high-confidence* patterns. A bare /[A-Za-z0-9/+=]{40}/ "AWS secret
//     key" regex matches every base64 blob (URLs, integrity hashes, CSS
//     vendored code) and produced 15,469 false positives. AWS Secret Access
//     Keys are only reported when they appear next to an explicit key name.
//  2. Never skip a whole file because it contains a placeholder. That silently
//     hides a real secret dropped into a file that also has `<YOUR_PAT_HERE>`.
//     Placeholder filtering is per-match instead.
//  3. Do NOT exclude source directories by category (scratch/, *.css, ...).
//     `scratch/` is tracked and did contain a real PAT. Only generated output,
//     vendored deps and binary files are skipped.
//  4. Resolve every path against the repo root. `git ls-files` returns
//     repo-relative paths; reading them with a bare readFileSync() silently
//     fails (and returned zero findings) when run from a package subdir.
//  5. Fail closed: if git cannot be invoked, exit non-zero. Never report "clean"
//     because file enumeration broke.
//  6. Never print secret material. Findings carry a redacted prefix, a length
//     and a short digest so logs stay safe to paste.
//
// Usage:
//   node packages/web/scripts/scan-secrets.mjs            # scan tracked files
//   node packages/web/scripts/scan-secrets.mjs --self-test
//   node packages/web/scripts/scan-secrets.mjs <path>...  # scan given files
//
// Exit codes: 0 clean · 1 secrets found · 2 scanner error (fail closed)

import { execSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { createHash } from 'node:crypto';

const MAX_FILE_BYTES = 3 * 1024 * 1024;

const SKIP_DIR_SEGMENTS = new Set([
  '.git', 'node_modules', 'dist', 'build', 'coverage', '.next', '.cache',
  'playwright-report', 'test-results', 'htmlcov', '.venv', 'venv',
  '__pycache__', '.mypy_cache', '.pytest_cache', 'site-packages', '.tox',
]);

const BINARY_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.bmp', '.tiff', '.avif',
  '.pdf', '.zip', '.gz', '.tgz', '.bz2', '.xz', '.7z', '.rar', '.tar',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.o', '.a', '.obj', '.class',
  '.jar', '.wasm', '.pyc', '.pyo', '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.mp3', '.mp4', '.mov', '.avi', '.wav', '.flac', '.ogg', '.webm',
  '.sqlite', '.sqlite3', '.db', '.mdb', '.dat', '.pack', '.idx',
]);

// Contextual secret names. The value must sit right after one of these.
// Contextual rules capture the KEY NAME and the VALUE as separate groups.
// A variable-length lookbehind was tried first and rejected: it cannot match
// prefixed env names such as DNSE_CREDENTIAL_FERNET_KEY (the `_` before
// FERNET defeats \b) and it forced a mandatory quote character.
const SECRET_WORD_IN_NAME =
  '(?:password|passwd|passphrase|secret|secrets|token|apikey|credential|credentials|creds|privatekey|accesskey|fernetkey|encryptionkey|authtoken|clientsecret|auth|pat)';
const COMPOUND_KEY_NAME =
  '(?:api|access|secret|private|encryption|fernet|auth|client|app|service|signing)[._-]?key$';
// Matches: KEY_NAME = VALUE, where KEY_NAME contains a secret-ish word.
// Group 2 captures the opening quote of the value so we can tell a literal
// from a bare token; group 3 is the value.
const KEY_VALUE_RE = new RegExp(
  String.raw`["']?([A-Za-z0-9_.\-]*${SECRET_WORD_IN_NAME}[A-Za-z0-9_.\-]*)["']?\s*[:=]\s*(["']?)([^"'\s,}\]]{8,})`,
  'gi',
);
const AWS_KEY_VALUE_RE = new RegExp(
  String.raw`["']?([A-Za-z0-9_.\-]*aws_secret_access_key[A-Za-z0-9_.\-]*)["']?\s*[:=]\s*(["']?)([A-Za-z0-9/+=]{40})`,
  'gi',
);

// An UNQUOTED value is only a credential if it is a bare token. Without this,
// `secret = settings.SECRET_KEY` and `password = get_token(request.user)` match,
// i.e. every ordinary line of Django/JS code. Quoted values are literals and
// need no such test.
const UNQUOTED_LITERAL_RE = /^[A-Za-z0-9+/_=-]{16,}$/;

const PATTERNS = [
  { name: 'GitHub PAT (classic)', re: /\bghp_[A-Za-z0-9]{36}\b/ },
  { name: 'GitHub PAT (fine-grained)', re: /\bgithub_pat_[A-Za-z0-9]{22,}_[A-Za-z0-9]{59}\b/ },
  { name: 'GitHub PAT (OAuth)', re: /\bgho_[A-Za-z0-9]{36}\b/ },
  { name: 'GitHub App token', re: /\bghs_[A-Za-z0-9]{36}\b/ },
  { name: 'GitHub user token', re: /\bghu_[A-Za-z0-9]{36}\b/ },
  { name: 'GitHub refresh token', re: /\bghr_[A-Za-z0-9]{36,}\b/ },
  { name: 'GitLab PAT', re: /\bglpat-[A-Za-z0-9_-]{20,}\b/ },
  { name: 'npm token', re: /\bnpm_[A-Za-z0-9]{36}\b/ },
  { name: 'Slack token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/ },
  { name: 'Slack webhook', re: /hooks\.slack\.com\/services\/[A-Za-z0-9+/=]{20,}/ },
  { name: 'AWS access key id', re: /\b(?:AKIA|ASIA|AIDA|AROA|ANPA|ABIA|ACCA)[0-9A-Z]{16}\b/ },
  { name: 'AWS secret access key', re: AWS_KEY_VALUE_RE, keyGroup: 1, quoteGroup: 2, valueGroup: 3 },
  { name: 'Fernet key', re: /\bgAAAAA[A-Za-z0-9_-]{39}\b/ },
  // A private-key *header* alone leaks nothing; the value is in the body. So
  // match the whole block and treat truncated fixture bodies as placeholders.
  {
    name: 'PEM private key',
    re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----(?:\r?\n|.)*?-----END (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g,
    block: true,
  },
  { name: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'Anthropic key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/ },
  { name: 'OpenAI key', re: /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}\b/ },
  { name: 'Stripe live key', re: /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}\b/ },
  { name: 'SendGrid key', re: /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/ },
  // A stored password hash is a credential and must be reported even when it is
  // not high-entropy: real hashes legitimately contain runs (`pbkdf2_sha256$600000$`)
  // that the placeholder heuristics read as filler. Recognised by format, so
  // this is a high-confidence rule like the vendor ones above; `verbatim` skips
  // the placeholder heuristics that otherwise drop it. Requires the full shape,
  // not just the prefix, so a truncated match still cannot hide a hash.
  //
  // The guard is a negative lookbehind, not `\b`: bcrypt and argon2 hashes
  // START with `$`, a non-word character, so `\b` never holds at that position
  // and a hash dumped on its own line was missed.
  {
    name: 'Password hash (Django/bcrypt/argon2)',
    re: /(?<![A-Za-z0-9])(?:pbkdf2_sha256\$\d{6,7}\$[A-Za-z0-9/+=]{16,}\$[A-Za-z0-9/+=]{20,}|\$2[abxy]\$\d{2}\$[./A-Za-z0-9]{53}|\$argon2(?:id|i|d)\$v=\d{1,2}\$[^$\s]{1,64}\$[A-Za-z0-9/+=]{10,})/g,
    verbatim: true,
  },
  { name: 'Secret assignment', re: KEY_VALUE_RE, keyGroup: 1, quoteGroup: 2, valueGroup: 3, generic: true },
];

// Exact values that are known documentation/test fixtures. Explicit and
// auditable on purpose — never a broad "skip the file" rule.
const PLACEHOLDER_EXACT = new Set([
  'ghp_1234567890abcdef1234567890abcdef1234',
]);

// Whole-word placeholder tokens, matched against `-`/`_` separated tokens only.
// Deliberately NOT a bare /test/ substring test: roughly 10% of random 40-char
// base64 strings contain the letters "test", which would gut the scanner.
const PLACEHOLDER_TOKENS = new Set([
  'test', 'tests', 'fake', 'dummy', 'mock', 'sample', 'example', 'placeholder',
  'redacted', 'changeme', 'todo', 'fixme', 'here', 'your', 'plaintext',
  'notused', 'unused', 'stub', 'fixture', 'samplekey', 'dummykey',
]);

const PLACEHOLDER_WORD = /your|example|changeme|change_me|placeholder|dummy|fake|sample|redacted|insert|replace|todo|fixme|here|xxxx/i;

// The final `_`/`-`/`.` segment of a key name must look like a credential.
// `key` is deliberately absent: cache_key / sort_key / dict_key are not secrets,
// so those are only caught via COMPOUND_KEY_NAME (api_key, access_key, ...).
const SECRET_KEY_LAST_SEGMENTS = new Set([
  'password', 'passwd', 'pass', 'passphrase', 'secret', 'secrets', 'token',
  'apikey', 'credential', 'credentials', 'creds', 'auth', 'bearer', 'pat',
]);

// Sequential / padded filler seen in fixtures: 1234567890abcdef, AAAABBBBCCCC.
const SEQUENTIAL_RUNS = [
  '0123456789', '1234567890', '9876543210', 'abcdefghij', 'abcdefgh',
  'qwertyuiop',
];

// A dotted identifier is an i18n key or a module path, never a credential.
const DOTTED_IDENTIFIER = /^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$/;

// Hand-redaction markers. `...`, `…` and `•` never occur in base64/hex
// credentials, so treating them as redaction carries no false-negative risk.
const REDACTION_MARKER_RE = /\.\.\.|…|•|\*\*|\?\?/;
// An interior `?`/`*` is how docs mask letters (`nh?p_token_mua_t?_vninvest`,
// `ghp_****abcd`). A trailing one is legitimate in a real password, so the
// trailing position is excluded deliberately.
const INLINE_MASK_RE = /.*[?*](?!$)/;

// Placeholder words tested against a separator-stripped copy of the value, so
// `CHANGE_ME_50_CHAR_RANDOM_STRING` and `change-me-very-long-random-string` are
// both caught. Only distinctive words are used: short ones like "here" or "your"
// appear by chance in ~1% of random 40-char strings and would gut the scanner.
const COMPACT_PLACEHOLDER_WORD =
  /example|changeme|placeholder|dummy|fake|sample|redacted|insert|replace|todo|fixme|notreal|yourkey|yourtoken|yourpassword|yoursecret/i;

// A value containing non-ASCII characters is prose, not a credential: every
// token format above is base64/base32/hex, i.e. printable ASCII. This repo
// trips it with Vietnamese placeholder text such as
// `VNINVEST_CORE_TOKEN="nhập_token_mua_từ_vninvest"` ("enter the ... token").
const NON_ASCII_RE = /[^\x20-\x7E]/;

// Escape hatch for a *deliberate* literal (usually a test fixture). Suppresses
// only the line it appears on — never a whole file, which is how the first
// attempt managed to hide a real secret. Both `#` and `//` forms work because
// the marker text itself is what is matched.
const INLINE_IGNORE_RE = /secret-scan:\s*ignore/;

// `broker_egress_url_credentials_not_allowed` and
// `different_fallback_key_for_testing_purposes` are error-code constants and
// test fixtures, not credentials: lowercase words joined by `-`/`_`. Real
// credentials are mixed-case high-entropy material, and every vendor-specific
// token format is already covered by its own high-confidence rule.
const LOWERCASE_IDENTIFIER_RE = /^[a-z][a-z0-9_-]{16,}$/;

function hasSequentialRun(value) {
  return SEQUENTIAL_RUNS.some((run) => value.includes(run));
}

// Two shapes: an adjacent repeated block (`abcabcabc`) and a run of one
// character repeated 4+ times (`AAAABBBBCCCC`, `xxxx`). The latter is what
// `sk-proj-AAAABBBBCCCCDDDDEEEEFFFF` needs — its blocks are not adjacent.
function hasRepeatedBlock(value) {
  return /(.{4,8})\1+/.test(value) || /(.)\1{3,}/.test(value);
}

function hasPlaceholderToken(value) {
  return value
    .split(/[-_.]/)
    .some((token) => PLACEHOLDER_TOKENS.has(token.toLowerCase()));
}

function isTruncatedKeyBlock(block) {
  if (/(\.\.\.|xxx+|REDACTED|EXAMPLE|<[^>]+>)/i.test(block)) return true;
  const bodyLines = block
    .split(/\r?\n/)
    .slice(1, -1)
    .map((line) => line.trim())
    .filter(Boolean);
  // A real key body is many full-width base64 lines. Fixtures use `...` or a
  // single stub line.
  if (bodyLines.length < 8) return true;
  return bodyLines.filter((line) => /^[A-Za-z0-9+/=]{32,}$/.test(line)).length < 8;
}

function looksLikePlaceholder(value) {
  const v = value.trim();
  if (!v) return true;
  if (PLACEHOLDER_EXACT.has(v)) return true;
  if (/^<.*>$/.test(v)) return true;
  if (/^\$\{[^}]*\}$/.test(v) || /^\{\{.*\}\}$/.test(v)) return true;
  if (/^(.)\1{7,}$/.test(v)) return true;
  if (DOTTED_IDENTIFIER.test(v)) return true;
  if (NON_ASCII_RE.test(v)) return true;
  if (REDACTION_MARKER_RE.test(v)) return true;
  if (INLINE_MASK_RE.test(v)) return true;
  if (COMPACT_PLACEHOLDER_WORD.test(v.replace(/[^A-Za-z0-9]/g, ''))) return true;
  if (LOWERCASE_IDENTIFIER_RE.test(v)) return true;
  if (hasSequentialRun(v)) return true;
  if (hasRepeatedBlock(v)) return true;
  if (hasPlaceholderToken(v)) return true;
  // pure word-ish descriptors: your_github_pat_here, changeme, replace_me
  if (/^[A-Za-z_.\-]+$/.test(v) && PLACEHOLDER_WORD.test(v)) return true;
  // Env-var interpolations: ${GITHUB_PAT}, $GITHUB_PAT.
  //
  // The bare `$NAME` form is anchored to the start of the value. It used to be
  // unanchored, which meant ANY `$` followed by a letter anywhere in the value
  // silently dropped the finding. Real credential formats use `$` as an
  // internal separator -- Django `pbkdf2_sha256$600000$<salt>$<hash>`, bcrypt
  // `$2b$12$...`, argon2 `$argon2id$...` -- so every one of them was invisible.
  // That is how a tracked `update_admin_password.sql` holding a live admin
  // password hash survived a 0-finding scan. `${...}` stays unanchored because
  // that spelling is unambiguous wherever it appears.
  if (/^\$\{?[A-Za-z_]/.test(v) || /\$\{/.test(v)) return true;
  // path-ish values, e.g. ./certs/xxx or a file reference
  if (/^[./~]/.test(v) && !/[0-9]/.test(v)) return true;
  return false;
}

// The generic "value assigned to a secret-looking key" rule is the noisiest
// one: `password: "auth.fieldInvalidPassword"` in an i18n map is normal code.
// It therefore only fires on long, high-entropy material.
//
// The 24-char floor is a deliberate, MEASURED precision/recall trade-off on this
// repo (2026-09-27, 4203 tracked files):
//   floor 24 -> 1 finding  (genuine)
//   floor 12 -> 145 findings, ~140 of them password fixtures
//   bare-key rule at floor 8 (`PASS = "..."`) -> 338 findings
// A narrower "bare secret key" rule was tried and rejected: `key`, `pat` and
// `auth` as whole key names match React keys, role-permission maps and i18n
// tables, so it was not usable as a gate.
//
// KNOWN GAP, deliberately not hidden: a *prefixed short* secret such as
// `CORE_DB_PASS = "core_db_464393"` (14 chars) is below the floor and is NOT
// reported by this scanner. It was found by reading the file, not by scanning.
// Closing this properly means adopting a real scanner (gitleaks/trufflehog) with
// an entropy model and a reviewed baseline, not more regex tuning.
const GENERIC_MIN_LENGTH = 24;
const GENERIC_MIN_UNIQUE = 12;

function isSkippablePath(relPath) {
  const ext = extname(relPath).toLowerCase();
  if (BINARY_EXTS.has(ext)) return true;
  if (ext === '.min.js' || ext === '.map') return true;
  const segments = relPath.split(/[\\/]/);
  return segments.some((s) => SKIP_DIR_SEGMENTS.has(s));
}

function digestOf(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 8);
}

function redact(value) {
  const head = value.slice(0, 4);
  return `${head}***(len=${value.length},sha256=${digestOf(value)})`;
}

function lineOf(content, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (content.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function lineHasInlineIgnore(content, lineNo) {
  const line = content.split('\n')[lineNo - 1];
  return line !== undefined && INLINE_IGNORE_RE.test(line);
}

function isSecretKeyName(keyName) {
  const key = keyName.replace(/^["']|["']$/g, '');
  const lastSegment = key.split(/[^A-Za-z0-9]+/).filter(Boolean).pop();
  if (!lastSegment) return false;
  return SECRET_KEY_LAST_SEGMENTS.has(lastSegment.toLowerCase())
    || new RegExp(COMPOUND_KEY_NAME, 'i').test(key);
}

function scanContent(relPath, content) {
  const findings = [];
  for (const pattern of PATTERNS) {
    // Fresh RegExp per file: a shared /g/ regex carries lastIndex between calls.
    // The `g` flag is mandatory — a non-global exec() always restarts at 0 and
    // this loop would never terminate.
    const flags = pattern.re.flags.includes('g') ? pattern.re.flags : `${pattern.re.flags}g`;
    const re = new RegExp(pattern.re.source, flags);
    let m;
    while ((m = re.exec(content)) !== null) {
      if (m[0] === '') {
        re.lastIndex += 1;
        continue;
      }
      // Contextual rules report the value, not the whole `key = value` text.
      const value = pattern.valueGroup ? m[pattern.valueGroup] : m[0];
      if (!value) continue;
      if (pattern.keyGroup && !isSecretKeyName(m[pattern.keyGroup])) continue;
      // Unquoted assignment => the value must be a bare token, not an expression.
      if (pattern.quoteGroup && !m[pattern.quoteGroup] && !UNQUOTED_LITERAL_RE.test(value)) continue;
      if (pattern.block) {
        if (isTruncatedKeyBlock(value)) continue;
      } else if (!pattern.verbatim) {
        // `verbatim` marks a format-identified credential (a password hash), which
        // must not be discarded by the entropy/placeholder heuristics.
        if (looksLikePlaceholder(value)) continue;
      }
      if (pattern.generic) {
        if (value.length < GENERIC_MIN_LENGTH) continue;
        if (new Set(value).size < GENERIC_MIN_UNIQUE) continue;
      }
      // Point at the value, not at the start of the `key = ` prefix.
      const valueOffset = m.index + m[0].length - value.length;
      const lineNo = lineOf(content, valueOffset);
      if (lineHasInlineIgnore(content, lineNo)) continue;
      findings.push({
        file: relPath,
        line: lineNo,
        type: pattern.name,
        value,
      });
    }
  }
  return findings;
}

function readTextFile(repoRoot, relPath) {
  const abs = join(repoRoot, relPath);
  const stat = statSync(abs);
  if (stat.size > MAX_FILE_BYTES) return null;
  const content = readFileSync(abs, 'utf8');
  // NUL byte in an extension we did not recognise => treat as binary.
  if (!BINARY_EXTS.has(extname(relPath).toLowerCase()) && content.indexOf('\u0000') !== -1) {
    return null;
  }
  return content;
}

function getRepoRoot() {
  const root = execSync('git rev-parse --show-toplevel', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  if (!root) throw new Error('empty repo root');
  return root;
}

function getTrackedFiles(repoRoot) {
  // -z + quotepath=false keeps non-ASCII paths intact and avoids newline issues.
  const out = execSync('git -c core.quotepath=false ls-files -z', {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const files = out.split('\u0000').filter(Boolean);
  if (files.length === 0) throw new Error('git ls-files returned 0 files');
  return files;
}

function runSelfTest() {
  const checks = [];
  const check = (label, actual, expected) => {
    const ok = actual === expected;
    checks.push({ label, ok, actual, expected });
  };

  // Fake PAT assembled at runtime so no literal credential lives in this file.
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const fake = 'ghp_' + Array.from({ length: 36 }, (_, i) => alphabet[(i * 7 + 11) % alphabet.length]).join('');
  // Stride 13 over a 62-char alphabet: no repeated run, no sequential run, so
  // this survives the placeholder heuristics exactly like real entropy would.
  const b64 = Array.from({ length: 64 }, (_, i) => alphabet[(i * 13) % alphabet.length]).join('');
  // 44-char mixed-case material, the shape of a Fernet key / admin password.
  const fern44 = Array.from({ length: 44 }, (_, i) => alphabet[(i * 11 + 7) % alphabet.length]).join('');

  const inUrl = 'const integrity = "sha512-3Y2k7m9pQwRtYuIoP1aSdF4gH6jKlZ8xCvBnM0qWeRtYuIoP1aSdF4gH6jKlZ8xCvBnM0=";';
  const genericEnv = `password = "${b64.slice(0, 12)}horse${b64.slice(12, 24)}"`;

  check('runtime fake GitHub PAT is detected',
    scanContent('t.js', `const t = "${fake}";`).length, 1);
  check('runtime fake GitHub PAT not treated as placeholder',
    looksLikePlaceholder(fake), false);
  check('bare 40-char base64 in a URL is NOT flagged (15,469-false-positive regression)',
    scanContent('t.js', inUrl).length, 0);
  check('40-char base64 without a key name is NOT flagged',
    scanContent('t.js', 'const h = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";').length, 0);
  check('AWS secret access key IS flagged when a key name is present',
    scanContent('t.py', `aws_secret_access_key = "${b64.slice(0, 40)}"`)
      .some((f) => f.type === 'AWS secret access key'), true);
  check('known test fixture is ignored',
    scanContent('t.py', 'TOKEN = "ghp_1234567890abcdef1234567890abcdef1234"').length, 0);
  check('placeholder assignment is ignored',
    scanContent('.env.example', 'GITHUB_PAT=<YOUR_GITHUB_PAT_HERE>').length, 0);
  check('generic secret assignment IS flagged',
    scanContent('t.py', genericEnv).some((f) => f.type === 'Secret assignment'), true);
  check('scratch/ is NOT excluded by category',
    isSkippablePath('scratch/check_github.py'), false);
  check('tracked .md IS scanned',
    isSkippablePath('docs/PLAN.md'), false);
  check('sqlite3 is skipped as binary',
    isSkippablePath('packages/core/backend/src/core_dev.sqlite3'), true);
  check('playwright-report is skipped as generated output',
    isSkippablePath('packages/web/playwright-report/index.html'), true);
  check('redaction does not leak the value',
    redact(fake).includes(fake), false);

  // --- Regressions found while triaging the real repo (2026-09-27) ---
  // Real findings that were false positives, one per pattern source.
  check('docstring example sk-proj-1234567890abcdef1234 is ignored',
    scanContent('serializers.py', '"""sk-proj-1234567890abcdef1234 -> masked"""').length, 0);
  check('sequential fake sk-ant-1234567890abcdef1234567890 is ignored',
    scanContent('t.py', "dirty = {'api_key': 'sk-ant-1234567890abcdef1234567890'}").length, 0);
  check('repeated-block fake sk-proj-AAAABBBBCCCCDDDDEEEEFFFF is ignored',
    scanContent('t.py', "FAKE_KEY = 'sk-proj-AAAABBBBCCCCDDDDEEEEFFFF'").length, 0);
  check('fake sk-proj-plaintext-in-snapshot is ignored',
    scanContent('t.py', "'ai_api_key': 'sk-proj-plaintext-in-snapshot'").length, 0);
  check('fake sk-proj-test-key-for-sanitize-check is ignored',
    scanContent('t.py', "x = 'sk-proj-test-key-for-sanitize-check'").length, 0);
  check('i18n key mapped to `password:` is not a secret',
    scanContent('authErrors.js', 'password: "auth.fieldInvalidPassword",').length, 0);
  check('truncated PEM fixture (MIIEvgIBADANBg...) is ignored',
    scanContent('t.py', '"private_key": "-----BEGIN PRIVATE KEY-----\\nMIIEvgIBADANBg...\\n-----END PRIVATE KEY-----"').length, 0);
  check('short fake in a test file is not reported by the generic rule',
    scanContent('t.py', "new_password = 'SecurityPass123'").length, 0);
  check('code expression assigned to a secret key is NOT a secret',
    scanContent('t.py', 'secret = get_decrypted_value(user)').length, 0);
  check('attribute access assigned to a secret key is NOT a secret',
    scanContent('t.py', 'self.client_secret = settings.CORE_SECRET_KEY').length, 0);
  check('unquoted .env-style token IS a secret',
    scanContent('.env', `CORE_SERVICE_ACCOUNT_TOKEN=${b64}`).length, 1);

  // Every false positive found in the real 2026-09-27 scan, one per rule.
  check('CHANGE_ME_50_CHAR_RANDOM_STRING in .env.example is ignored',
    scanContent('.env.ghcr.example', 'CORE_DJANGO_SECRET_KEY=CHANGE_ME_50_CHAR_RANDOM_STRING').length, 0);
  check('REPLACE_WITH_STRONG_PASSWORD_MIN32CHARS is ignored',
    scanContent('.env.saas-prod.example', 'CORE_DB_PASSWORD=REPLACE_WITH_STRONG_PASSWORD_MIN32CHARS').length, 0);
  check('change-me-very-long-random-string is ignored',
    scanContent('DEPLOY.md', 'DJANGO_SECRET_KEY=change-me-very-long-random-string').length, 0);
  check('dev-mail-fernet-key-replace-in-prod-12345= is ignored',
    scanContent('plan.md', "MAIL_CREDENTIAL_FERNET_KEY='dev-mail-fernet-key-replace-in-prod-12345='").length, 0);
  check('hand-redacted token vni_pro_a1b2...k... is ignored',
    scanContent('docs/PAT_AUTH_GUIDE.md', '"token": "vni_pro_a1b2c3d4e5f6g7h8i9j0k..."').length, 0);
  check('Vietnamese prose placeholder is ignored',
    scanContent('ROADMAP.md', 'VNINVEST_CORE_TOKEN="nhập_token_mua_từ_vninvest"').length, 0);
  check('vowel-masked token nh?p_token_mua_t?_vninvest is ignored',
    scanContent('ROADMAP.md', 'VNINVEST_CORE_TOKEN="nh?p_token_mua_t?_vninvest"').length, 0);
  check('error-code constant ..._credentials_not_allowed is ignored',
    scanContent('egress.py', "CODE_URL_CREDENTIALS = 'broker_egress_url_credentials_not_allowed'").length, 0);
  check('test fixture different_fallback_key_for_testing_purposes is ignored',
    scanContent('t.py', 'override_settings(SECRET_KEY="different_fallback_key_for_testing_purposes")').length, 0);
  check('lowercase documented key local-audit-secret-key-2026 is ignored',
    scanContent('AUDIT.md', 'DJANGO_SECRET_KEY=local-audit-secret-key-2026').length, 0);

  // The one genuine finding from that scan must stay visible: a 44-char
  // mixed-case secret hardcoded in tracked scratch/ code. The value is built at
  // runtime: a literal here would be a real secret-shaped string committed into
  // git, which is the exact defect this scanner exists to prevent — and the
  // scanner would (correctly) flag its own source.
  check('hardcoded 44-char Fernet-shaped secret IS still flagged',
    scanContent('scratch/portainer_setup.py', `CORE_SECRET = "${fern44}"`)
      .some((f) => f.type === 'Secret assignment'), true);

  // A GitHub PAT is caught by its own high-confidence rule regardless of the
  // key it is assigned to, and a placeholder value is still ignored.
  check('ghp_ token assigned to GH_PAT is flagged by the vendor rule',
    scanContent('t.py', `GH_PAT = "${fake}"`).some((f) => f.type === 'GitHub PAT (classic)'), true);
  check('GH_PAT placeholder is still ignored',
    scanContent('t.py', 'GH_PAT = "<YOUR_GH_PAT_HERE>"').length, 0);
  check('compound fixture new_password is NOT flagged',
    scanContent('t.py', 'new_password = "SecurePass123!"').length, 0);

  // Inline suppression is per-line and must not blank out the rest of the file.
  check('inline "secret-scan: ignore" suppresses its own line',
    scanContent('t.py', 'TOKEN = "aaaaaaaaaaaaaaaaaaaaaa"  # secret-scan: ignore').length, 0);
  check('inline ignore does NOT suppress a real secret on another line',
    scanContent('t.py', 'TOKEN = "aaaaaaaaaaaaaaaaaaaaaa"  # secret-scan: ignore\nSECRET = "xK8mP3nQ7wR2vT5yJ6dF9hL4bN0cE1aZ8sU6pW3iY7oX"')
      .some((f) => f.type === 'Secret assignment'), true);

  // ...and the same patterns must still fire on realistic material.
  const pemBody = Array.from({ length: 12 }, () => b64).join('\n');
  check('full realistic PEM private key IS flagged',
    scanContent('id_rsa', `-----BEGIN RSA PRIVATE KEY-----\n${pemBody}\n-----END RSA PRIVATE KEY-----`)
      .some((f) => f.type === 'PEM private key'), true);
  check('long high-entropy password assignment IS flagged',
    scanContent('t.py', `password = "${b64}${b64}"`)
      .some((f) => f.type === 'Secret assignment'), true);
  check('real Fernet-shaped key on a secret key name IS flagged',
    scanContent('.env', `DNSE_CREDENTIAL_FERNET_KEY=${b64}`)
      .some((f) => f.type === 'Secret assignment' || f.type === 'Fernet key'), true);

  // --- Password hashes, and the `$` blindness they exposed (2026-09-28) ---
  //
  // Built at runtime: the salt/hash below are the shape of a Django
  // pbkdf2_sha256 field, and no real hash may live in this file. The salt
  // deliberately ends in `=` (base64 padding) because the first attempt used a
  // too-narrow character class and silently failed to match every real hash.
  const hashSalt = `${b64.slice(0, 21)}=`;
  const hashDigest = `${b64.slice(0, 40)}==`;
  const djangoHash = `pbkdf2_sha256$600000$${hashSalt}$${hashDigest}`;
  const hashInSql = `UPDATE auth_user\n  SET password='${djangoHash}'\n  WHERE username='admin';`;

  check('Django pbkdf2 hash in SQL IS flagged',
    scanContent('t.sql', hashInSql)
      .some((f) => f.type === 'Password hash (Django/bcrypt/argon2)'), true);
  check('bcrypt hash IS flagged',
    scanContent('t.txt', `$2b$12$${b64.slice(0, 22)}${b64.slice(0, 31)}`)
      .some((f) => f.type === 'Password hash (Django/bcrypt/argon2)'), true);
  check('argon2 hash IS flagged',
    scanContent('t.txt', `$argon2id$v=19$m=65536,t=3,p=4$${b64.slice(0, 22)}$${b64.slice(0, 32)}`)
      .some((f) => f.type === 'Password hash (Django/bcrypt/argon2)'), true);

  // A hash is a credential even though it trips the repeated-run heuristic
  // (`$600000$`), which is exactly why the pattern is marked `verbatim`.
  check('hash with a repeated run is still flagged',
    scanContent('t.sql', `SET password='pbkdf2_sha256$600000$${hashSalt}$${hashDigest}'`)
      .some((f) => f.type === 'Password hash (Django/bcrypt/argon2)'), true);
  // Only the prefix: not a leak, must not fire.
  check('bare "pbkdf2_sha256$" prefix alone is NOT flagged',
    scanContent('t.py', 'ALGO = "pbkdf2_sha256"').length, 0);
  check('truncated hash (no digest) is NOT flagged',
    scanContent('t.txt', 'pbkdf2_sha256$600000$').length, 0);

  // The `$` anchoring fix. These two are env-var references, not literals, and
  // must stay silent; their non-`$` twin is the same length and must fire.
  check('a "$" inside a literal no longer hides it',
    scanContent('t.txt', `password = "${b64}$${b64.slice(0, 12)}"`)
      .some((f) => f.type === 'Secret assignment'), true);
  check('bare $VAR reference is still treated as a placeholder',
    scanContent('t.py', 'password = $GITHUB_PAT_VALUE_NOISE_XYZZY').length, 0);
  check('${VAR} reference is still treated as a placeholder',
    scanContent('t.py', 'password = "${GITHUB_PAT_VALUE_NOISE_XYZZY}"').length, 0);

  let failed = 0;
  for (const c of checks) {
    if (!c.ok) failed += 1;
    process.stdout.write(`${c.ok ? 'PASS' : 'FAIL'}  ${c.label}\n`);
    if (!c.ok) process.stdout.write(`      expected=${c.expected} actual=${c.actual}\n`);
  }
  process.stdout.write(`\n${checks.length - failed}/${checks.length} self-test checks passed\n`);
  return failed === 0;
}

function main() {
  const argv = process.argv.slice(2);

  if (argv.includes('--self-test')) {
    process.exit(runSelfTest() ? 0 : 1);
  }

  let repoRoot;
  let relPaths;
  try {
    repoRoot = getRepoRoot();
    relPaths = argv.length > 0 ? argv : getTrackedFiles(repoRoot);
  } catch (err) {
    process.stderr.write(`scan-secrets: FAILED to enumerate files: ${err.message}\n`);
    process.exit(2);
  }

  const scannable = relPaths.filter((p) => !isSkippablePath(p));
  const skipped = relPaths.length - scannable.length;

  const findings = [];
  for (const rel of scannable) {
    let content;
    try {
      content = readTextFile(repoRoot, rel);
    } catch (err) {
      process.stderr.write(`scan-secrets: cannot read ${rel}: ${err.message}\n`);
      process.exit(2);
    }
    if (content === null) continue;
    findings.push(...scanContent(rel, content));
  }

  process.stdout.write(
    `scan-secrets: ${relPaths.length} tracked file(s), ${scannable.length} scanned, ${skipped} skipped (binary/generated)\n`,
  );

  if (findings.length === 0) {
    process.stdout.write('scan-secrets: OK, no secrets found\n');
    process.exit(0);
  }

  process.stderr.write(`\nscan-secrets: ${findings.length} potential secret(s):\n`);
  for (const f of findings) {
    process.stderr.write(`  ${f.file}:${f.line}  [${f.type}]  ${redact(f.value)}\n`);
  }
  process.stderr.write('\nRedacted on purpose. Open the file, rotate the credential, then purge history.\n');
  process.exit(1);
}

main();
