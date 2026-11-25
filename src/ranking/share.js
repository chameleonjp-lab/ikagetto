import { getLanguage, t } from '../i18n/runtime.js';
import { rankText } from './messages.js';

const gameUrl = 'https://chameleonjp-lab.github.io/ikagetto/';
const tag = '#イカゲット';
const xTextLimit = 280 - 23 - 1; // Standard post limit, minus the t.co link and separator.

function shareTextWeight(text) {
  // twitter-text v3 single-weight ranges. Counting each emoji code point is a
  // conservative upper bound for sequences that X counts as one emoji.
  let weight = 0;
  for (const character of text.normalize('NFC')) {
    const code = character.codePointAt(0);
    const singleWeight = code <= 0x10ff || (code >= 0x2000 && code <= 0x200d) ||
      (code >= 0x2010 && code <= 0x201f) || (code >= 0x2032 && code <= 0x2037);
    weight += singleWeight ? 1 : 2;
  }
  return weight;
}

function shortenComment(comment, budget) {
  if (typeof comment !== 'string' || !comment.trim()) return '';
  const full = rankText('comment', { comment });
  if (shareTextWeight(full) <= budget) return full;

  const ellipsis = '…';
  let remaining = budget - shareTextWeight(rankText('comment', { comment: ellipsis }));
  if (remaining <= 0) return '';
  const segments = typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(getLanguage(), { granularity: 'grapheme' }).segment(comment)
    : Array.from(comment, segment => ({ segment }));
  let shortened = '';
  for (const { segment } of segments) {
    remaining -= shareTextWeight(segment);
    if (remaining < 0) break;
    shortened += segment;
  }
  return shortened.trim() ? rankText('comment', { comment: shortened.trimEnd() + ellipsis }) : '';
}

export function getRankingHref() {
  return `./ranking.html?lang=${encodeURIComponent(getLanguage())}`;
}

export function formatPosition(rank, count) {
  if (!Number.isSafeInteger(count) || count < 1) return rankText('rankingUnavailable');
  if (!Number.isSafeInteger(rank) || rank < 1) {
    return rankText('guestPosition', { count });
  }
  return rankText('position', { rank, count });
}

export function makeShareText(mode, result = {}, includeUrl = true) {
  const lines = [];
  if (mode === 'home') {
    lines.push(rankText('homeShare'));
  } else {
    lines.push(rankText('modeScore', {
      mode: rankText(mode),
      score: rankText('scoreValue', { score: result.score }),
    }));
    const position = formatPosition(result.rankPosition, result.playCount);
    lines.push(result.rankPosition > 0 ? rankText('resultPosition', { position }) : position);

    if (mode === 'fishing') {
      lines.push(rankText(result.colossalClass ? 'colossalCatch' : 'fishingMetrics', {
        class: t(result.colossalClass),
        length: result.lengthMeters,
        weight: result.weightKg,
        time: Math.round(result.elapsedTime),
      }));
    }
    const commentBudget = xTextLimit - shareTextWeight([...lines, tag].join('\n')) - 1;
    const comment = shortenComment(result.comment, commentBudget);
    if (comment) lines.push(comment);
  }
  lines.push(tag);
  if (includeUrl) lines.push(gameUrl);
  return lines.join('\n');
}

export function shareOnX(mode, result = {}) {
  const params = new URLSearchParams({
    text: makeShareText(mode, result, false),
    url: gameUrl,
  });
  window.open(`https://twitter.com/intent/tweet?${params}`, '_blank', 'noopener,noreferrer');
}
