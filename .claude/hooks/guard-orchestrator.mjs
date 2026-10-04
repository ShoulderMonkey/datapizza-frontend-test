#!/usr/bin/env node
// PreToolUse guard.
//
// --scope=orchestrator (default): applies only to the main thread (no `agent_id`
//   in the hook input). Denies Edit/Write/MultiEdit/NotebookEdit outside
//   `.claude/` and `CLAUDE.md`, and denies common write patterns in Bash.
// --scope=reports: used from the frontend-tester frontmatter. Applies to every
//   call and allows writes only under `.claude/reports/` and temp dirs.
//
// The Bash analysis is best-effort (documented as a known limit): it catches the
// usual write commands, not every possible way a shell can write a file.

import { readFileSync, realpathSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ORCHESTRATOR_REASON =
  "L'orchestratore non modifica file: delega a frontend-developer / frontend-test-writer / documentation-writer";
const REPORTS_REASON =
  'frontend-tester può scrivere solo in .claude/reports/ e /tmp: non modifica codice, test o documentazione';

const scopeArg = process.argv.slice(2).find((a) => a.startsWith('--scope='));
const scope = scopeArg ? scopeArg.slice('--scope='.length) : 'orchestrator';

function readInput() {
  try {
    const raw = readFileSync(0, 'utf8');
    return raw.trim() ? JSON.parse(raw) : {};
  } catch (err) {
    process.stderr.write(`guard-orchestrator: input non leggibile (${err.message}), nessuna decisione\n`);
    return null;
  }
}

function safeRealpath(p) {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}

const input = readInput();
if (!input) process.exit(0);

// Orchestrator scope: subagent calls carry `agent_id` and are not restricted here.
if (scope === 'orchestrator' && input.agent_id) process.exit(0);

const projectDir = path.resolve(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
const cwd = path.resolve(input.cwd || projectDir);

const tmpRoots = [...new Set(['/tmp', '/private/tmp', os.tmpdir(), safeRealpath(os.tmpdir())])];
const allowedRoots =
  scope === 'reports'
    ? [path.join(projectDir, '.claude', 'reports'), ...tmpRoots]
    : [path.join(projectDir, '.claude'), path.join(os.homedir(), '.claude'), ...tmpRoots];
const allowedFiles = scope === 'reports' ? ['/dev/null'] : [path.join(projectDir, 'CLAUDE.md'), '/dev/null'];
const reason = scope === 'reports' ? REPORTS_REASON : ORCHESTRATOR_REASON;

function isAllowedPath(p) {
  if (!p) return false;
  const expanded = p.replace(/^~(?=$|\/)/, os.homedir()).replace(/\$\{?CLAUDE_PROJECT_DIR\}?/g, projectDir);
  const abs = path.resolve(cwd, expanded);
  if (allowedFiles.includes(abs)) return true;
  return allowedRoots.some((root) => abs === root || abs.startsWith(root + path.sep));
}

function deny(detail) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: detail ? `${reason} (${detail})` : reason,
      },
    }),
  );
  process.exit(0);
}

// --- Bash analysis -------------------------------------------------------------

// Drops heredoc bodies so that their content (HTML, JSON...) is not analysed.
function stripHeredocs(cmd) {
  const lines = cmd.split('\n');
  const out = [];
  let delimiter = null;
  for (const line of lines) {
    if (delimiter !== null) {
      if (line.trim() === delimiter) delimiter = null;
      continue;
    }
    out.push(line);
    const m = line.match(/<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/);
    if (m) delimiter = m[2];
  }
  return out.join('\n');
}

// Replaces quoted strings with placeholders so that quoted text is not mistaken
// for commands or redirections. Returns the masked command and the originals.
function maskQuotes(cmd) {
  const quoted = [];
  const masked = cmd.replace(/'[^']*'|"(?:\\.|[^"\\])*"/g, (q) => {
    quoted.push(q.slice(1, -1));
    return `__Q${quoted.length - 1}__`;
  });
  return { masked, quoted };
}

function unmask(token, quoted) {
  return token.replace(/__Q(\d+)__/g, (_, i) => quoted[Number(i)] ?? '');
}

// Splits into simple commands on ; && || | and newlines.
function splitCommands(masked) {
  return masked
    .split(/\|\||&&|[;|\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function words(segment) {
  return segment.split(/\s+/).filter(Boolean);
}

// Removes leading wrappers (sudo, env assignments, xargs, command) from a word list.
function commandWords(segment) {
  const w = words(segment.replace(/^[({]\s*/, ''));
  while (w.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w[0]) || ['sudo', 'command', 'xargs', 'then', 'do', 'else', 'exec'].includes(w[0]))) {
    w.shift();
  }
  return w;
}

function analyzeBash(command) {
  const violations = [];
  const { masked, quoted } = maskQuotes(stripHeredocs(command));

  // Redirections to files: >, >>, 1>, 2>, &>. Ignores >&N, =>, ->, >(...).
  const redirect = /(?<![=\-<>])(?:\d+|&)?>{1,2}(?![&(>])\s*([^\s;&|()<>]+)/g;
  for (const m of masked.matchAll(redirect)) {
    const target = unmask(m[1], quoted);
    if (!isAllowedPath(target)) violations.push(`redirezione verso ${target}`);
  }

  if (/(^|[\s;&|(])sed\b[^;&|\n]*\s(-i\S*|--in-place\S*)/.test(masked)) violations.push('sed -i');
  if (/(^|[\s;&|(])perl\b[^;&|\n]*\s-[A-Za-z]*i/.test(masked)) violations.push('perl -i');
  if (/(^|[\s;&|(])git\s+apply\b/.test(masked)) violations.push('git apply');
  if (/(^|[\s;&|(])git\s+checkout\b[^;&|\n]*\s--(\s|$)/.test(masked)) violations.push('git checkout --');
  if (/(^|[\s;&|(])git\s+(restore|clean)\b/.test(masked)) violations.push('git restore/clean');
  if (/(^|[\s;&|(])git\s+reset\b[^;&|\n]*--hard/.test(masked)) violations.push('git reset --hard');
  if (/(^|\s)--(write|fix)(\s|=|$)/.test(masked)) violations.push('--write/--fix');
  if (/(^|[\s;&|(])npm\s+(i|install|ci|uninstall|un|update|up|remove|rm)\b/.test(masked)) violations.push('npm install/uninstall/update');

  for (const segment of splitCommands(masked)) {
    const w = commandWords(segment);
    if (!w.length) continue;
    const cmd = w[0] === 'git' && w[1] && ['rm', 'mv'].includes(w[1]) ? `git ${w[1]}` : w[0];
    const rest = w[0] === 'git' ? w.slice(2) : w.slice(1);
    const targets = rest.filter((t) => !t.startsWith('-')).map((t) => unmask(t, quoted));

    if (cmd === 'tee') {
      const bad = targets.filter((t) => !isAllowedPath(t));
      if (bad.length) violations.push(`tee verso ${bad.join(', ')}`);
    } else if (cmd === 'rm' || cmd === 'git rm') {
      const bad = targets.filter((t) => !isAllowedPath(t));
      if (bad.length || targets.length === 0) violations.push(`${cmd} ${bad.join(' ')}`.trim());
    } else if (cmd === 'cp' || cmd === 'mv' || cmd === 'git mv') {
      const dest = targets[targets.length - 1];
      if (!dest || !isAllowedPath(dest)) violations.push(`${cmd} verso ${dest ?? '?'}`);
    }
  }
  return [...new Set(violations)];
}

// --- Dispatch ------------------------------------------------------------------

const tool = input.tool_name;
const toolInput = input.tool_input || {};

if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool)) {
  const target = toolInput.file_path || toolInput.notebook_path;
  if (target && !isAllowedPath(target)) {
    deny(`file: ${path.relative(projectDir, path.resolve(cwd, target)) || target}`);
  }
  process.exit(0);
}

if (tool === 'Bash') {
  const violations = analyzeBash(String(toolInput.command || ''));
  if (violations.length) deny(`comando Bash di scrittura: ${violations.join('; ')}`);
  process.exit(0);
}

process.exit(0);
