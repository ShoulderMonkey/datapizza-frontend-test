import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { ESLint } from 'eslint';

const root = path.resolve(__dirname, '../..');
const eslint = new ESLint({ cwd: root });
const RULES = ['no-restricted-globals', 'no-restricted-properties'];

async function restricted(code: string, file: string): Promise<string[]> {
  const [res] = await eslint.lintText(code, { filePath: path.join(root, file) });
  return res.messages.map((m) => m.ruleId ?? '').filter((r) => RULES.includes(r));
}

const forms: Array<[string, string]> = [
  ['fetch(...)', "export const f = () => fetch('/x');\n"],
  ['window.fetch(...)', "export const f = () => window.fetch('/x');\n"],
  ['globalThis.fetch(...)', "export const f = () => globalThis.fetch('/x');\n"],
];

describe('ESLint forbids fetch outside src/api', () => {
  describe.each(['src/features/chat/x.tsx', 'app/x.tsx'])('in %s', (file) => {
    it.each(forms)('reports %s', async (_name, code) => {
      expect((await restricted(code, file)).length).toBeGreaterThan(0);
    }, 30_000);
  });

  it.each(forms)('allows %s in src/api/x.ts', async (_name, code) => {
    expect(await restricted(code, 'src/api/x.ts')).toEqual([]);
  }, 30_000);
});
