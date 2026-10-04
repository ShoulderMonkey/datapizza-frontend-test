#!/usr/bin/env node
// SubagentStop validator for the project subagents.
//
// Extracts the last ```json block from `last_assistant_message` (falls back to
// the subagent transcript when the field is absent) and validates it against the
// common output schema plus the agent-specific fields.
//   valid   -> exit 0
//   invalid -> exit 2 with the list of problems on stderr (the subagent retries)
//   invalid and `stop_hook_active === true`, or already blocked 2 times for the
//   same agent_id -> exit 0: the orchestrator rejects it (CLAUDE.md E.5).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const AGENTS = ['frontend-developer', 'frontend-test-writer', 'frontend-tester', 'documentation-writer'];
const STATUS = ['done', 'blocked', 'failed'];
const SEVERITY = ['high', 'medium', 'low'];
const TEST_TYPES = ['unit', 'integration', 'e2e'];
const RESULTS = ['pass', 'fail', 'blocked'];
const MAX_BLOCKS = 2;

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

function lastAssistantText() {
  if (typeof input.last_assistant_message === 'string') return input.last_assistant_message;
  const transcript = input.agent_transcript_path || input.transcript_path;
  if (!transcript || !existsSync(transcript)) return '';
  const lines = readFileSync(transcript, 'utf8').trim().split('\n').reverse();
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      const msg = entry.message ?? entry;
      if ((entry.type ?? msg.role) !== 'assistant') continue;
      const content = msg.content;
      if (typeof content === 'string') return content;
      if (Array.isArray(content)) {
        const text = content.filter((c) => c?.type === 'text').map((c) => c.text).join('\n');
        if (text) return text;
      }
    } catch {
      // skip malformed transcript lines
    }
  }
  return '';
}

function extractLastJsonBlock(text) {
  const blocks = [...text.matchAll(/```json[^\n]*\n([\s\S]*?)```/g)];
  return blocks.length ? blocks[blocks.length - 1][1] : null;
}

const isStr = (v) => typeof v === 'string';
const isNonEmptyStr = (v) => isStr(v) && v.trim().length > 0;
const isStrArray = (v) => Array.isArray(v) && v.every(isStr);

function validate(out, agentType) {
  const errors = [];
  if (!out || typeof out !== 'object' || Array.isArray(out)) return ['il blocco json non è un oggetto'];

  if (!AGENTS.includes(out.agent)) errors.push(`agent: atteso uno tra ${AGENTS.join(' | ')}`);
  else if (agentType && AGENTS.includes(agentType) && out.agent !== agentType) {
    errors.push(`agent: "${out.agent}" non coincide con il subagente "${agentType}"`);
  }
  if (!isNonEmptyStr(out.task_id)) errors.push('task_id: stringa non vuota obbligatoria');
  if (!STATUS.includes(out.status)) errors.push(`status: atteso ${STATUS.join(' | ')}`);
  if (!isNonEmptyStr(out.summary)) errors.push('summary: stringa non vuota obbligatoria');
  if (!isStrArray(out.files_changed)) errors.push('files_changed: array di stringhe obbligatorio');
  if (!Array.isArray(out.commands_run)) errors.push('commands_run: array obbligatorio');
  else {
    out.commands_run.forEach((c, i) => {
      if (!c || !isNonEmptyStr(c.cmd)) errors.push(`commands_run[${i}].cmd: stringa obbligatoria`);
      if (!c || !Number.isInteger(c.exit_code)) errors.push(`commands_run[${i}].exit_code: intero obbligatorio`);
    });
  }
  if (!isStrArray(out.evidence)) errors.push('evidence: array di stringhe obbligatorio');
  if (!Array.isArray(out.issues)) errors.push('issues: array obbligatorio');
  else {
    out.issues.forEach((it, i) => {
      if (!it || !SEVERITY.includes(it.severity)) errors.push(`issues[${i}].severity: atteso ${SEVERITY.join(' | ')}`);
      for (const k of ['description', 'file', 'suggested_owner']) {
        if (!it || !isStr(it[k])) errors.push(`issues[${i}].${k}: stringa obbligatoria`);
      }
    });
  }
  if (!isStrArray(out.assumptions)) errors.push('assumptions: array di stringhe obbligatorio');
  if (!isStrArray(out.next_actions)) errors.push('next_actions: array di stringhe obbligatorio');

  const agent = out.agent;
  if (agent === 'frontend-test-writer') {
    if (!Array.isArray(out.tests_added)) errors.push('tests_added: array obbligatorio per frontend-test-writer');
    else {
      out.tests_added.forEach((t, i) => {
        if (!t || !isNonEmptyStr(t.file)) errors.push(`tests_added[${i}].file: stringa obbligatoria`);
        if (!t || !TEST_TYPES.includes(t.type)) errors.push(`tests_added[${i}].type: atteso ${TEST_TYPES.join(' | ')}`);
        if (!t || !isNonEmptyStr(t.catches)) errors.push(`tests_added[${i}].catches: descrivi il bug concreto rilevato`);
      });
    }
  }
  if (agent === 'frontend-tester') {
    if (!Array.isArray(out.scenarios)) errors.push('scenarios: array obbligatorio per frontend-tester');
    else {
      out.scenarios.forEach((s, i) => {
        if (!s || !isNonEmptyStr(s.id)) errors.push(`scenarios[${i}].id: stringa obbligatoria`);
        if (!s || !isNonEmptyStr(s.spec_requirement)) errors.push(`scenarios[${i}].spec_requirement: stringa obbligatoria`);
        if (!s || !RESULTS.includes(s.result)) errors.push(`scenarios[${i}].result: atteso ${RESULTS.join(' | ')}`);
        if (!s || !isStr(s.evidence_path)) errors.push(`scenarios[${i}].evidence_path: stringa obbligatoria`);
        else if (s.result === 'pass') {
          if (!s.evidence_path.trim()) errors.push(`scenarios[${i}]: "pass" senza evidence_path`);
          else if (!existsSync(path.resolve(projectDir, s.evidence_path))) {
            errors.push(`scenarios[${i}]: evidence_path "${s.evidence_path}" non esiste`);
          }
        }
      });
    }
  }
  if (agent === 'documentation-writer') {
    if (!Array.isArray(out.docs_updated)) errors.push('docs_updated: array obbligatorio per documentation-writer');
    else {
      out.docs_updated.forEach((d, i) => {
        if (!d || !isNonEmptyStr(d.file)) errors.push(`docs_updated[${i}].file: stringa obbligatoria`);
        if (!d || !isNonEmptyStr(d.section)) errors.push(`docs_updated[${i}].section: stringa obbligatoria`);
      });
    }
  }
  if (out.status === 'done' && ['frontend-developer', 'frontend-test-writer', 'frontend-tester'].includes(agent)) {
    if (Array.isArray(out.commands_run) && out.commands_run.length === 0) {
      errors.push('status "done" con commands_run vuoto: esegui e registra i comandi di verifica con il loro exit_code');
    }
  }
  return errors;
}

// --- anti-loop counter (stop_hook_active is not documented for SubagentStop) ---
const counterFile = path.join(projectDir, '.claude', 'state', 'validator-attempts.json');
const counterKey = String(input.agent_id || input.agent_type || 'unknown');

function readCounters() {
  try {
    return JSON.parse(readFileSync(counterFile, 'utf8'));
  } catch {
    return {};
  }
}

function writeCounters(c) {
  try {
    mkdirSync(path.dirname(counterFile), { recursive: true });
    writeFileSync(counterFile, JSON.stringify(c));
  } catch {
    // state is best-effort
  }
}

// --- main ----------------------------------------------------------------------

const text = lastAssistantText();
const block = extractLastJsonBlock(text);
let errors;
if (block === null) {
  errors = ['manca il blocco ```json finale con lo schema di output (vedi il file dell\'agente)'];
} else {
  try {
    errors = validate(JSON.parse(block), input.agent_type);
  } catch (err) {
    errors = [`il blocco json non è JSON valido: ${err.message}`];
  }
}

const counters = readCounters();
if (errors.length === 0) {
  delete counters[counterKey];
  writeCounters(counters);
  process.exit(0);
}

const attempts = counters[counterKey] ?? 0;
const message = `Output del subagente non valido secondo lo schema di FORMAT § OUTPUT AGENTI:\n- ${errors.join('\n- ')}\nCorreggi e termina la risposta con un blocco \`\`\`json valido.`;

if (input.stop_hook_active === true || attempts >= MAX_BLOCKS) {
  delete counters[counterKey];
  writeCounters(counters);
  process.stdout.write(JSON.stringify({ systemMessage: `Output di ${input.agent_type ?? 'subagente'} ancora non valido: l'orchestratore deve rifiutarlo (E.5)` }));
  process.stderr.write(message + '\n');
  process.exit(0);
}

counters[counterKey] = attempts + 1;
writeCounters(counters);
process.stderr.write(message + '\n');
process.exit(2);
