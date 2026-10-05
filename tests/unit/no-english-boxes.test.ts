import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

describe('P1-15 Italian microcopy', () => {
  it('src/ contains no "boxes" (English plural leaked into the citations panel)', () => {
    const root = path.resolve(__dirname, '../../src');
    const offenders = walk(root).filter((f) => /boxes/.test(readFileSync(f, 'utf8')));
    expect(offenders.map((f) => path.relative(root, f))).toEqual([]);
  });
});
