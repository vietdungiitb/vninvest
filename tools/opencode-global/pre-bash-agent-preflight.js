#!/usr/bin/env node
/**
 * PreToolUse Hook: agent-preflight — MẶC ĐỊNH CHẶN
 * (đọc tài liệu ở tools/opencode-global/MANDATORY-WORKFLOW.md)
 *
 * Gọi `scripts/agent-preflight.mjs --staged` khi sắp chạy `git commit`.
 *
 * BẬT CHẶN từ 2026-09-27, SAU KHI sửa xong lỗ bypass trailer: trước đó
 * `includes("Claim-Deny-List:")` cho qua một commit chỉ nhắc chuỗi đó.
 * Bật chặn trước khi sửa sẽ tạo cảm giác an toàn giả rồi bị lách.
 *   - Tắt hoàn toàn:    AGENT_PREFLIGHT=0
 *   - Hạ xuống cảnh báo: AGENT_PREFLIGHT_MODE=warn
 *   - Bật lại (mặc định): bỏ biến, hoặc AGENT_PREFLIGHT_MODE=block
 *
 * Exit codes (qua dispatcher):
 *   0 - cho qua (kể cả khi có cảnh báo)
 *   2 - chặn (mặc định, khi preflight trả 1)
 */
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const MAX_STDIN = 1024 * 1024;

/** Lấy câu lệnh từ payload hook (opencode/Claude đều gửi JSON). */
function extractCommand(raw) {
  try {
    const parsed = JSON.parse(raw);
    const t = parsed.tool_input || parsed.toolInput || {};
    return String(t.command || '').trim();
  } catch {
    return String(raw || '').trim();
  }
}

/** Chỉ `git commit` — không phải `git commit-tree`, `git config`... */
function isGitCommit(cmd) {
  if (/\bgit\s+commit\b/.test(cmd)) return true;
  if (/\b(?:pnpm|npm|yarn)\s+(?:run\s+)?commit\b/.test(cmd)) return true;
  return false;
}

/** Đi ngược từ cwd tới gốc git. */
function findRepo(cwd) {
  let dir = cwd;
  for (let i = 0; i < 12; i += 1) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
  return null;
}

/**
 * Bóc message từ `git commit -m ...`.
 * Phải cover CẢ `-m "..."` VÀ `-m probe` (không nháy) — trường hợp phổ biến nhất
 * là dạng không nháy. Thiếu dạng này thì preflight rơi về COMMIT_EDITMSG và bỏ qua
 * check, tức là im lặng thay vì báo.
 */
function extractCommitMessage(cmd) {
  const parts = [];
  const re = /\s-m(?:-m)?\s+("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\s]+)/g;
  let m;
  while ((m = re.exec(cmd)) !== null) {
    const v = m[1];
    parts.push((v.startsWith('"') || v.startsWith("'")) ? v.slice(1, -1) : v);
  }
  return parts.join('\n').trim();
}

/** Tìm preflight: ưu tiên bản trong repo (repo có thể tùy chỉnh), fallback bản user-level. */
function findScript(repo) {
  const local = path.join(repo, 'scripts', 'agent-preflight.mjs');
  if (fs.existsSync(local)) return local;
  // bản user-level: ~/.opencode/scripts/agent-preflight.mjs (nằm cạnh thư mục hooks/)
  const shared = path.resolve(__dirname, '..', 'agent-preflight.mjs');
  if (fs.existsSync(shared)) return shared;
  return null;
}

const PASS = { output: '', stderr: '', exitCode: 0 };

function run(rawInput) {
  if (process.env.AGENT_PREFLIGHT === '0') return PASS;

  const cmd = extractCommand(rawInput);
  if (!isGitCommit(cmd)) return PASS;

  const repo = findRepo(process.cwd());
  if (!repo) return PASS;

  const script = findScript(repo);
  if (!script) return PASS;

  const args = [script, '--staged'];
  const msg = extractCommitMessage(cmd);
  if (msg) args.push('--commit-msg', msg);

  let res;
  try {
    res = spawnSync(process.execPath, args, {
      cwd: repo,
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch {
    return PASS; // hook lỗi KHÔNG được chặn agent
  }

  if (res.status === 0) return PASS;

  const outMsg = String(res.stderr || res.stdout || '').trim();
  if (!outMsg) return PASS;

  // MẶC ĐỊNH = chặn. Bật từ 2026-09-27 sau khi sửa xong lỗ bypass trailer:
  // trước đó `includes("Claim-Deny-List:")` cho qua một commit chỉ NHẮC chuỗi
  // đó — bật chặn trước khi sửa sẽ tạo cảm giác an toàn giả rồi bị bypass.
  // Xem tools/opencode-global/verify-trailer-bypass.mjs (3/3).
  const mode = process.env.AGENT_PREFLIGHT_MODE || 'block';
  if (mode === 'block') {
    return { output: '', stderr: `[agent-preflight] CHẶN commit\n${outMsg}\n`, exitCode: 2 };
  }
  return {
    output: '',
    stderr: `[agent-preflight] CẢNH BÁO (đang ở mode=warn — đặt AGENT_PREFLIGHT_MODE=block hoặc bỏ biến để chặn)\n${outMsg}\n`,
    exitCode: 0,
  };
}

module.exports = { run };

// Chạy trực tiếp (không qua dispatcher) — stdin fallback
if (require.main === module) {
  let raw = '';
  try {
    raw = fs.readFileSync(0, 'utf8').slice(0, MAX_STDIN);
  } catch {
    raw = '';
  }
  const r = run(raw);
  if (r.stderr) process.stderr.write(r.stderr);
  process.exitCode = r.exitCode;
}
