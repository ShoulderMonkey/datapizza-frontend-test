import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// P2-10: a `dark:hover:<utility>` equal to the base `dark:<utility>` on the same element gives no visible hover feedback.
// Limit: only static class strings are analysed (literals "..." / '...' / `...` without ${}) inside a className
// attribute, including conditional branches. Classes built at runtime (variables, string concatenation, helper
// functions such as clsx(...) with computed parts) are not visible to this check.

const ROOT = path.resolve(__dirname, '../..');
const DIRS = ['src', 'app'];

function listTsx(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (name === 'node_modules' || name === '.next') continue;
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listTsx(full));
    else if (name.endsWith('.tsx') && !/\.(test|spec)\.tsx$/.test(name)) out.push(full);
  }
  return out;
}

interface ClassAttr {
  line: number;
  literals: string[];
}

/** Extracts the static string literals of every `className=...` attribute. */
export function extractClassAttrs(src: string): ClassAttr[] {
  const attrs: ClassAttr[] = [];
  const re = /className\s*=\s*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const i = m.index + m[0].length;
    let body: string;
    if (src[i] === '"' || src[i] === "'") {
      const end = src.indexOf(src[i], i + 1);
      body = src.slice(i, end + 1);
    } else if (src[i] === '{') {
      let depth = 0;
      let j = i;
      for (; j < src.length; j++) {
        const c = src[j];
        if (c === '"' || c === "'" || c === '`') {
          const q = c;
          j++;
          while (j < src.length && src[j] !== q) j += src[j] === '\\' ? 2 : 1;
        } else if (c === '{') depth++;
        else if (c === '}' && --depth === 0) break;
      }
      body = src.slice(i, j + 1);
    } else continue;
    const literals: string[] = [];
    const litRe = /"([^"]*)"|'([^']*)'|`([^`$]*)`/g;
    let l: RegExpExecArray | null;
    while ((l = litRe.exec(body))) literals.push(l[1] ?? l[2] ?? l[3]);
    attrs.push({ line: src.slice(0, m.index).split('\n').length, literals });
  }
  return attrs;
}

export function findRedundantDarkHover(src: string): { line: number; cls: string }[] {
  const found: { line: number; cls: string }[] = [];
  for (const { line, literals } of extractClassAttrs(src)) {
    const tokens = literals.flatMap((s) => s.split(/\s+/).filter(Boolean));
    const set = new Set(tokens);
    for (const t of tokens) {
      const mm = /^dark:hover:(.+)$/.exec(t);
      if (mm && set.has(`dark:${mm[1]}`)) found.push({ line, cls: `dark:${mm[1]} = ${t}` });
    }
  }
  return found;
}

describe('dark hover variants', () => {
  it('detector flags an identical dark hover and ignores a different one', () => {
    expect(findRedundantDarkHover('<a className="dark:text-indigo-300 dark:hover:text-indigo-300" />')).toHaveLength(1);
    expect(findRedundantDarkHover('<a className={`dark:bg-x-1 dark:hover:bg-x-2`} />')).toHaveLength(0);
    expect(findRedundantDarkHover("<a className={a ? 'dark:text-a-1' : 'dark:hover:text-a-1 dark:text-a-1'} />")).toHaveLength(1);
  });

  it('no dark:hover:<utility> equals the base dark:<utility> on the same element', () => {
    const offenders: string[] = [];
    for (const d of DIRS) {
      for (const file of listTsx(path.join(ROOT, d))) {
        for (const f of findRedundantDarkHover(readFileSync(file, 'utf8'))) {
          offenders.push(`${path.relative(ROOT, file)}:${f.line} ${f.cls}`);
        }
      }
    }
    expect(offenders, `hover dark senza variazione visibile:\n${offenders.join('\n')}`).toEqual([]);
  });
});
