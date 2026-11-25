import { getLanguageLocale, isSupportedLanguage, resolveLanguage } from './languages.js';
import { GAME_MESSAGES } from './game-messages.js';
import { COLOSSAL_COMMENTS, COMMENTS } from './comments.js';

const STORAGE_KEY = 'ikagetto_language_v1';
const listeners = new Set();
const attributes = ['aria-label', 'alt', 'placeholder', 'title'];
const COMMENT_BAND_ENDS = [19, 39, 59, 79, 89, 98, 99];

function initialLanguage() {
  const query = new URLSearchParams(globalThis.location?.search).get('lang');
  if (isSupportedLanguage(query)) return query;
  let saved;
  try { saved = globalThis.localStorage?.getItem(STORAGE_KEY); } catch { /* Storage may be disabled. */ }
  const device = globalThis.navigator;
  return resolveLanguage(saved, [...(device?.languages ?? []), device?.language]);
}

let currentLanguage = initialLanguage();

function updateDocumentLanguage() {
  if (globalThis.document?.documentElement) document.documentElement.lang = currentLanguage;
}

updateDocumentLanguage();

export function getLanguage() {
  return currentLanguage;
}

export function setLanguage(language) {
  if (!isSupportedLanguage(language)) return false;
  try { globalThis.localStorage?.setItem(STORAGE_KEY, language); } catch { /* Keep the active choice in memory. */ }
  if (language === currentLanguage) return true;
  currentLanguage = language;
  updateDocumentLanguage();
  for (const listener of listeners) listener(language);
  return true;
}

export function onLanguageChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function t(source, ...values) {
  if (typeof source !== 'string') return source;
  const message = GAME_MESSAGES[currentLanguage]?.[source] ?? source;
  if (values.length === 0) return message;
  return message.replace(/\{(\d+)\}/g, (token, index) => values[Number(index)] ?? token);
}

export function formatNumber(value, options) {
  return value.toLocaleString(getLanguageLocale(currentLanguage), options);
}

// Only animation and tutorial markup defined in the game source can use these helpers.
export function tHtml(source) {
  return t(source);
}

export function localizeHtml(source) {
  if (currentLanguage === 'ja') return source;
  const template = document.createElement('template');
  template.innerHTML = source;
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest('script, style, textarea, select')) continue;
    const key = node.data.trim();
    const translation = t(key);
    if (key && key !== translation) node.data = node.data.replace(key, () => translation);
  }
  for (const element of template.content.querySelectorAll('[aria-label], [alt], [placeholder], [title]')) {
    for (const attribute of attributes) {
      if (element.hasAttribute(attribute)) element.setAttribute(attribute, t(element.getAttribute(attribute)));
    }
  }
  return template.innerHTML;
}

export function translateComment(mode, index, japaneseOriginal) {
  const band = COMMENT_BAND_ENDS.findIndex((end) => index <= end);
  return COMMENTS[currentLanguage]?.[mode]?.[band] ?? japaneseOriginal;
}

// 31m-50m comments: Japanese keeps the source text, other languages use the same
// 5 size classes x 4 evaluations (POOR, AVERAGE, GOOD, EXCELLENT).
export function translateColossalComment(classKey, evaluationIndex, japaneseOriginal) {
  return COLOSSAL_COMMENTS[currentLanguage]?.[classKey]?.[evaluationIndex] ?? japaneseOriginal;
}
