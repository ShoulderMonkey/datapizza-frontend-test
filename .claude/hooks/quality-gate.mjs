#!/usr/bin/env node
// Quality gate.
//
// Default mode (event `Stop` of the main thread):
//   1. fingerprint of source/test changes (git diff HEAD + untracked files,
//      excluding .claude/, docs/, *.md, .mcp.json);
//   2. empty or equal to .claude/state/last-green -> exit 0;
//   3. otherwise run `npm run typecheck`, `npm run lint`, `npm run test`;
//   4. missing script -> exit 2 ("Harness di test assente ...");
//   5. failing command -> exit 2 with the command name and the last 60 lines;
//   6. all green -> save the fingerprint in last-green, exit 0;
//   7. anti-loop: after 2 consecutive blocks on the same fingerprint, exit 0 with
//      a `systemMessage` and reset the counter.
//
// `--typecheck-only` mode (frontend-developer frontmatter `Stop` hook, run as
// `SubagentStop`): runs only `npm run typecheck` when the script exists.
//
// e2e tests never run here: they are slow and need the backend (frontend-tester).

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const HOOK_BUDGET_MS = 290_000; // settings.json timeout is 300 s
const TAIL_LINES = 60;
const MAX_BLOCKS = 2;
const EXCLUDES = [':(exclude).claude', ':(exclude)docs', ':(exclude)*.md', ':(exclude).mcp.json'];

const startedAt = Date.now();
const typecheckOnly = process.argv.includes('--typecheck-only');

function readInput() {
  try {
    const raw = readFileSync(0, 'utf8');
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const input = readInput();
const projectDir = path.resolve(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
const stateDir = path.join(projectDir, '.claude', 'state');
const lastGreenFile = path.join(stateDir, 'last-green');
const attemptsFile = path.join(stateDir, typecheckOnly ? 'typecheck-attempts' : 'gate-attempts');

function git(args) {
  return spawnSync('git', args, { cwd: projectDir, encoding: 'buffer', maxBuffer: 256 * 1024 * 1024 });
}

function fingerprint() {
  const hasHead = git(['rev-parse', '--verify', '--quiet', 'HEAD']).status === 0;
  const diffArgs = hasHead
    ? [['diff', 'HEAD', '--binary', '--', '.', ...EXCLUDES]]
    : [
        ['diff', '--binary', '--', '.', ...EXCLUDES],
        ['diff', '--cached', '--binary', '--', '.', ...EXCLUDES],
      ];
  const hash = createHash('sha256');
  let empty = true;
  for (const args of diffArgs) {
    const out = git(args).stdout ?? Buffer.alloc(0);
    if (out.length) {
      empty = false;
      hash.update(out);
    }
  }
  const untracked = (git(['ls-files', '--others', '--exclude-standard', '-z', '--', '.', ...EXCLUDES]).stdout ?? Buffer.alloc(0))
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .sort();
  for (const file of untracked) {
    empty = false;
    hash.update(`\0untracked:${file}\0`);
    try {
      hash.update(readFileSync(path.join(projectDir, file)));
    } catch {
      // unreadable file (e.g. removed meanwhile): the path alone is enough
    }
  }
  return empty ? '' : hash.digest('hex');
}

function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function saveJson(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(value));
}

function tail(text, n = TAIL_LINES) {
  const lines = text.replace(/\s+$/, '').split('\n');
  return lines.slice(-n).join('\n');
}

function pass(fp) {
  saveJson(attemptsFile, { fingerprint: '', count: 0 });
  if (!typecheckOnly && fp) {
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(lastGreenFile, fp);
  }
  process.exit(0);
}

// Blocks with exit 2, unless the same fingerprint was already blocked MAX_BLOCKS
// times in a row (or Claude Code reports stop_hook_active): then let it stop with
// a visible red message and reset the counter.
function block(fp, message) {
  const prev = readJson(attemptsFile, { fingerprint: '', count: 0 });
  const count = prev.fingerprint === fp ? prev.count : 0;
  if (count >= MAX_BLOCKS || (typecheckOnly && input.stop_hook_active === true)) {
    saveJson(attemptsFile, { fingerprint: '', count: 0 });
    const label = typecheckOnly ? 'TYPECHECK ROSSO — output del developer da rifiutare' : 'QUALITY GATE ROSSO — task NON conclusa';
    process.stdout.write(JSON.stringify({ systemMessage: label }));
    process.stderr.write(`${label}\n${message}\n`);
    process.exit(0);
  }
  saveJson(attemptsFile, { fingerprint: fp, count: count + 1 });
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

function runScript(name) {
  const remaining = HOOK_BUDGET_MS - (Date.now() - startedAt);
  if (remaining <= 5_000) return { status: 124, output: `Budget di tempo dello hook esaurito prima di npm run ${name}` };
  const res = spawnSync('npm', ['run', '--silent', name], {
    cwd: projectDir,
    encoding: 'utf8',
    env: { ...process.env, CI: '1', FORCE_COLOR: '0' },
    timeout: remaining,
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${res.stdout ?? ''}${res.stderr ?? ''}${res.error ? `\n${res.error.message}` : ''}`;
  return { status: res.status ?? 1, output };
}

// --- main ----------------------------------------------------------------------

if (git(['rev-parse', '--is-inside-work-tree']).status !== 0) {
  process.stderr.write('quality-gate: la cartella non è un repository git, gate saltato\n');
  process.exit(0);
}

const fp = fingerprint();
if (!fp) pass('');

if (!typecheckOnly) {
  const lastGreen = existsSync(lastGreenFile) ? readFileSync(lastGreenFile, 'utf8').trim() : '';
  if (lastGreen === fp) process.exit(0);
}

const scripts = readJson(path.join(projectDir, 'package.json'), {}).scripts ?? {};
const required = typecheckOnly ? ['typecheck'] : ['typecheck', 'lint', 'test'];
const missing = required.filter((s) => typeof scripts[s] !== 'string');

if (missing.length) {
  if (typecheckOnly) process.exit(0); // developer gate: nothing to check yet
  block(fp, `Harness di test assente: delega l'item P0 di setup a frontend-test-writer (script mancanti in package.json: ${missing.join(', ')})`);
}

for (const name of required) {
  const { status, output } = runScript(name);
  if (status !== 0) {
    block(fp, `Quality gate: \`npm run ${name}\` fallito (exit ${status}). Ultime ${TAIL_LINES} righe:\n${tail(output)}`);
  }
}

pass(fp);
