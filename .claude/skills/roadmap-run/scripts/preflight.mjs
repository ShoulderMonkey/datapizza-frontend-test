#!/usr/bin/env node
// Read-only preflight for a roadmap session (skill roadmap-run).
// Prints: git state, backend/node_modules availability, next task_id and the
// roadmap items with status, dependencies and readiness. Writes nothing.
//
// Usage: node .claude/skills/roadmap-run/scripts/preflight.mjs [--json]

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const sh = (cmd) => {
  try {
    return execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};

// ---------- roadmap ----------
const roadmapPath = path.join(root, 'docs/ROADMAP.md');
const roadmap = readFileSync(roadmapPath, 'utf8');
const items = [];
for (const raw of roadmap.split(/\n(?=### P\d-\d\d)/).slice(1)) {
  const block = raw.split(/\n(?=## )/)[0]; // the last item must not swallow the trailing sections
  const head = /^### (P\d-\d\d) — (.+)$/m.exec(block);
  if (!head) continue;
  const field = (name) => (new RegExp(`^- ${name}: (.+)$`, 'm').exec(block) || [])[1] || '';
  const stato = field('Stato');
  const deps = field('Dipendenze').match(/P\d-\d\d/g) || [];
  const open = (block.match(/^\s+- \[ \]/gm) || []).length;
  const closed = (block.match(/^\s+- \[x\]/gim) || []).length;
  items.push({
    id: head[1],
    title: head[2].trim(),
    owner: field('Owner'),
    stima: field('Stima'),
    deps,
    stato,
    done: /^done\b/i.test(stato),
    criteria: { open, closed },
    needsBackend: /backend reale|e2e/i.test(block),
    needsDocker: /docker/i.test(block),
  });
}
const doneIds = new Set(items.filter((i) => i.done).map((i) => i.id));
for (const i of items) {
  i.blockedBy = i.deps.filter((d) => !doneIds.has(d));
  i.ready = !i.done && i.blockedBy.length === 0;
}

// ---------- environment ----------
const stateDir = path.join(root, '.claude/state');
const planIds = existsSync(stateDir)
  ? readdirSync(stateDir).map((f) => /^plan-T(\d{3})\.md$/.exec(f)?.[1]).filter(Boolean).map(Number)
  : [];
const nextTask = `T${String((planIds.length ? Math.max(...planIds) : 0) + 1).padStart(3, '0')}`;

const backendCode = sh(`curl -s -o /dev/null -m 3 -w '%{http_code}' http://localhost:8000/docs`) || '000';
const env = {
  branch: sh('git rev-parse --abbrev-ref HEAD'),
  dirty: sh('git status --porcelain --untracked-files=no').split('\n').filter(Boolean),
  lastCommit: sh('git log --oneline -1'),
  backend: backendCode === '200' ? 'up' : `down (http ${backendCode})`,
  nodeModules: existsSync(path.join(root, 'node_modules')),
  port3000Busy: sh(`lsof -iTCP:3000 -sTCP:LISTEN -t`) !== '',
  docker: sh('docker info --format "{{.ServerVersion}}"') ? 'available' : 'unavailable',
  nextTask,
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ env, items }, null, 2));
  process.exit(0);
}

const total = items.length;
const done = items.filter((i) => i.done).length;
console.log('## Ambiente');
console.log(`- branch: ${env.branch} · ultimo commit: ${env.lastCommit}`);
console.log(`- modifiche tracciate non committate: ${env.dirty.length ? env.dirty.join(', ') : 'nessuna'}`);
console.log(`- backend localhost:8000: ${env.backend}`);
console.log(`- node_modules: ${env.nodeModules ? 'presente' : 'ASSENTE (serve npm ci, delegato a un agente)'}`);
console.log(`- porta 3000: ${env.port3000Busy ? 'OCCUPATA' : 'libera'} · docker: ${env.docker}`);
console.log(`- prossimo task_id: ${env.nextTask}`);
console.log('');
console.log(`## Roadmap: ${done}/${total} item done (${Math.round((done / total) * 100)}%)`);
console.log('| Item | Stato | Pronto | Bloccato da | Owner | Stima | Criteri aperti | Note |');
console.log('|---|---|---|---|---|---|---|---|');
for (const i of items) {
  const notes = [i.needsBackend && !i.done ? 'e2e/backend' : '', i.needsDocker && !i.done ? 'docker' : ''].filter(Boolean).join(', ');
  console.log(
    `| ${i.id} ${i.title.replace(/\|/g, '/')} | ${i.stato} | ${i.ready ? 'sì' : i.done ? '—' : 'no'} | ${i.blockedBy.join(', ') || '—'} | ${i.owner.replace(/\|/g, '/')} | ${i.stima} | ${i.criteria.open} | ${notes} |`
  );
}
const ready = items.filter((i) => i.ready).map((i) => i.id);
console.log('');
console.log(`Pronti ora (dipendenze soddisfatte), in ordine di priorità: ${ready.join(', ') || 'nessuno'}`);
