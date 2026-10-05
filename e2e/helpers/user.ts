import { randomBytes } from 'node:crypto';

let counter = 0;

/**
 * user_id valid for the backend (`[a-zA-Z0-9_-]`, max 100 chars), unique per run and per call:
 * timestamp + process id (one per Playwright worker) + in-process counter + random bytes.
 */
export function uniqueUser(prefix = 'e2e'): string {
  const safe = prefix.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  counter += 1;
  return `${safe}_${Date.now()}_${process.pid}_${counter}_${randomBytes(3).toString('hex')}`;
}
