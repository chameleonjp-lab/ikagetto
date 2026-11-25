import { getLanguage, t } from '../i18n/runtime.js';
import { rankText } from './messages.js';

const gameUrl = 'https://chameleonjp-lab.github.io/ikagetto/';
const tag = '#イカゲット';

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

    if (mode === 'fishing' && result.colossalClass) {
      // 31m-50m: lead with the size class and the exact length.
      lines.push(rankText('colossalCatch', { class: t(result.colossalClass), length: result.lengthMeters }));
    }
    if (mode === 'fishing') {
      lines.push(rankText('fishingMetrics', {
        length: result.lengthMeters,
        weight: result.weightKg,
        time: Math.round(result.elapsedTime),
      }));
    }
    lines.push(rankText('comment', { comment: result.comment }));
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
