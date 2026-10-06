import { describe, it, expect } from 'vitest';
import { parseApiDate } from '@/src/api';

const UTC_MS = Date.UTC(2026, 9, 6, 13, 3, 46, 422);

describe('parseApiDate (P1-21)', () => {
  it('runs in Europe/Rome', () => {
    expect(process.env.TZ).toBe('Europe/Rome');
  });

  it('reads a naive timestamp with microseconds as UTC', () => {
    const d = parseApiDate('2026-10-06T13:03:46.422580');
    expect(d.getTime()).toBe(UTC_MS);
    expect(d.getHours()).toBe(15);
    expect(d.getMinutes()).toBe(3);
  });

  it('reads a naive timestamp without fraction as UTC', () => {
    expect(parseApiDate('2026-10-06T13:03:46').getTime()).toBe(Date.UTC(2026, 9, 6, 13, 3, 46));
  });

  it('leaves Z and explicit offsets untouched', () => {
    const base = Date.UTC(2026, 9, 6, 13, 3, 46);
    expect(parseApiDate('2026-10-06T13:03:46Z').getTime()).toBe(base);
    expect(parseApiDate('2026-10-06T15:03:46+02:00').getTime()).toBe(base);
    expect(parseApiDate('2026-10-06T08:03:46-05:00').getTime()).toBe(base);
  });

  it('returns an invalid Date for garbage', () => {
    expect(Number.isNaN(parseApiDate('not a date').getTime())).toBe(true);
    expect(Number.isNaN(parseApiDate('').getTime())).toBe(true);
  });
});
