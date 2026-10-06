/**
 * The FastAPI backend serializes naive datetimes (UTC, no offset), e.g. `2026-10-06T13:03:46.422580`.
 * `new Date` would read those as local time, so every `created_at` goes through this function.
 */
const HAS_OFFSET = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;
const NAIVE_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;

export function parseApiDate(value: string): Date {
  const text = value.trim();
  if (HAS_OFFSET.test(text) || !NAIVE_DATE_TIME.test(text)) return new Date(text);
  return new Date(`${text}Z`);
}
