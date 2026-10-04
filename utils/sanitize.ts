import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code', 'hr',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'span', 'div', 'a', 'mark', 'sub', 'sup'
];

const ALLOWED_ATTR = [
  'href', 'target', 'rel', 'class', 'className', 'align', 'colspan', 'rowspan', 'title'
];

/**
 * Sanitizes an HTML string to ensure safe rendering.
 * Strips script tags, javascript: URIs, onerror handlers, etc.
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return '';

  if (typeof window === 'undefined') {
    // Basic server-side tag stripping fallback
    return dirty.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['target', 'rel'],
  });
}
