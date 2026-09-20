import { INANDU_GRID_TRANSLATIONS, en } from '../core';

export type InanduGridMessageKey = keyof typeof en;

/** Replaces `{{name}}` tokens in `template` with `params[name]`, same mini-syntax the built-in dictionaries use (ngx-translate's, on the Angular side). Leaves an unmatched token as-is. */
export function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/**
 * Resolves `lang` (a full BCP-47 tag like `'en-US'` or just `'en'`) to one of the built-in
 * dictionaries by primary subtag, falling back to English for an unrecognized one — same fallback
 * behavior `INANDU_GRID_TRANSLATIONS` documents for the Angular side.
 */
export function createTranslator(lang: string) {
  const primary = lang.split('-')[0];
  const dict = INANDU_GRID_TRANSLATIONS[primary] ?? en;
  return (key: InanduGridMessageKey, params?: Record<string, string | number>): string =>
    interpolate(dict[key] ?? en[key], params);
}
