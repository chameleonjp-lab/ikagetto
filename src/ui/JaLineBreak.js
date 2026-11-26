import { getLanguage } from '../i18n/runtime.js';
// Japanese line breaking by phrase for the whole game.
//
// Browsers may break Japanese between any two characters, which splits words
// ("ソ/ナー", "掛かっ/た!!"). BudouX finds the natural phrase boundaries; we put
// an invisible break point (zero-width space) only there, and turn on
// `word-break: keep-all` so the browser breaks only at those points.
//
// Every text node in the page is handled, including text the game changes
// every frame, through a MutationObserver with a small cache.
// If BudouX cannot be loaded, nothing changes and the game works as before.

import { adaptText } from './DeviceProfile.js';

const BUDOUX_URL = 'https://cdn.jsdelivr.net/npm/budoux@0.10.3/+esm';
const ZWSP = '​';
// U+3000-303F (「」『』【】、。 etc.) counts too, so a bracketed word in its own element
// (<b>「HOOK UP!!」</b>) is still handled.
const JA_RE = /[　-〿぀-ヿ㐀-鿿！-｠]/;
// WORD JOINER: forbids a line break right after an opening bracket. iOS Safari can break
// between 「 and the next letter inside `word-break: keep-all` text, leaving 「 at line end.
const WJ = '\u2060';
const AFTER_OPEN_BRACKET = /([「『（(［[【〈《〔｛{“‘])(?!\u2060)/gu;
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CANVAS', 'NOSCRIPT']);
const MAX_CACHE = 3000;

let parser = null;
const cache = new Map();   // original text -> text with break points
const done = new Set();    // texts that are already processed

// Opening brackets must stay with the words after them, never at the end of a line
// ("逃げます。「 / HOOK UP!!」" is wrong). Closing brackets and 。、 stay with the words before.
const OPEN_BRACKETS = /[「『（(［[【〈《〔｛{“‘]+$/u;

export function joinPhrases(phrases) {
  const parts = [];
  let carry = '';
  for (const raw of phrases) {
    let ph = carry + raw;
    carry = '';
    const open = ph.match(OPEN_BRACKETS);
    if (open) {
      if (open[0].length === ph.length) { carry = ph; continue; } // only brackets: move all to the next phrase
      carry = open[0];
      ph = ph.slice(0, -open[0].length);
    }
    // Never leave a single character alone on a line ("さが|す"): join it to the phrase before.
    if (parts.length && ph.length < 2) parts[parts.length - 1] += ph;
    else parts.push(ph);
  }
  if (carry) {
    if (parts.length) parts[parts.length - 1] += carry;
    else parts.push(carry);
  }
  return parts;
}

function convert(text) {
  let out = cache.get(text);
  if (out === undefined) {
    // Finger words -> mouse words on PC, then phrase break points.
    const plain = adaptText(text.split(ZWSP).join('').split(WJ).join(''));
    if (parser) {
      out = joinPhrases(parser.parse(plain)).join(ZWSP);
    } else {
      out = plain;
    }
    out = out.replace(AFTER_OPEN_BRACKET, `$1${WJ}`);
    if (cache.size > MAX_CACHE) { cache.clear(); done.clear(); }
    cache.set(text, out);
    done.add(out);
  }
  return out;
}

function processText(node) {
  const text = node.data;
  if (!text || text.length < 2 || done.has(text) || !JA_RE.test(text)) return;
  const p = node.parentNode;
  if (!p || SKIP_TAGS.has(p.nodeName) || p.closest?.('[data-user-text]')) return;
  let out = convert(text);
  // A particle right after a bracketed word in its own element (<b>「フッキング」</b>をすぐ…)
  // must not start a new line: glue it to the closing bracket with a WORD JOINER.
  const prev = node.previousSibling?.textContent ?? '';
  if (/^[ぁ-ゖ]/u.test(out) && /[」』）)】〉》〕｝}”’]$/u.test(prev)) out = WJ + out;
  if (out !== text) node.data = out;
  done.add(out);
}

function processTree(root) {
  if (root.nodeType === Node.TEXT_NODE) { processText(root); return; }
  if (root.nodeType !== Node.ELEMENT_NODE || SKIP_TAGS.has(root.nodeName)) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) processText(n);
}

function injectStyles() {
  if (document.getElementById('ja-linebreak-styles')) return;
  const st = document.createElement('style');
  st.id = 'ja-linebreak-styles';
  st.textContent = `
    html.ja-phrase body, html.ja-phrase body * {
      word-break: keep-all;
      overflow-wrap: break-word;
      line-break: strict;
    }
  `;
  document.head.appendChild(st);
}

export async function installJapaneseLineBreak() {
  if (getLanguage() !== 'ja') return;
  // The word swap for mouse users works even without BudouX.
  const observe = () => {
    processTree(document.body);
  };
  const obs = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData') processText(r.target);
      else r.addedNodes.forEach(processTree);
    }
  });
  obs.observe(document.body, { subtree: true, childList: true, characterData: true });
  observe();

  try {
    const mod = await import(BUDOUX_URL);
    parser = mod.loadDefaultJapaneseParser();
  } catch (_) {
    return; // keep the browser's default line breaking
  }
  injectStyles();
  document.documentElement.classList.add('ja-phrase');
  // Redo texts handled before BudouX arrived.
  cache.clear(); done.clear();
  observe();
}
