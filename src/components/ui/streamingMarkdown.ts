/**
 * Removes an incomplete HTML tag from the tail of the content (a `<` followed
 * by a tag-start character and no closing `>`), so that a partial stream like
 * "...\n\n<t" never shows a literal tag fragment. Idempotent on complete
 * content. A `<` followed by a space or digit (e.g. "a < b") is not a tag
 * start and is left untouched.
 */
const INCOMPLETE_TAG_AT_END = /<(?:[a-zA-Z/!][^<>]*)?$/;

export function stripIncompleteTrailingTag(content: string): string {
  return content.replace(INCOMPLETE_TAG_AT_END, '');
}
