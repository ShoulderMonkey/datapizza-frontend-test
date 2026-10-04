import { describe, it, expect } from 'vitest';
import { validateUserId, USER_ID_MAX_LENGTH } from '@/src/api';

describe('validateUserId', () => {
  it.each(['', '   '])('rejects empty input %j', (v) => {
    const r = validateUserId(v);
    expect(r.isValid).toBe(false);
    expect(r.error).toMatch(/obbligatorio/i);
  });

  it('accepts exactly 100 characters', () => {
    expect(USER_ID_MAX_LENGTH).toBe(100);
    expect(validateUserId('a'.repeat(100)).isValid).toBe(true);
  });

  it('rejects 101 characters with a length error', () => {
    const r = validateUserId('a'.repeat(101));
    expect(r.isValid).toBe(false);
    expect(r.error).toMatch(/100 caratteri/);
  });

  it.each(['a b', 'a@b', 'àè'])('rejects disallowed characters in %j', (v) => {
    const r = validateUserId(v);
    expect(r.isValid).toBe(false);
    expect(r.error).toMatch(/solo lettere/i);
  });

  it('accepts user-01_x', () => {
    expect(validateUserId('user-01_x').isValid).toBe(true);
  });
});
