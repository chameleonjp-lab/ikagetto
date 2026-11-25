import { getLanguage, setLanguage, onLanguageChange } from '../i18n/runtime.js';
import { SUPPORTED_LANGUAGES } from '../i18n/languages.js';
import { rankText, rankNumber } from './messages.js';
import { getRankingBoard, getRankingStats } from './client.js';

const $ = id => document.getElementById(id);
const tabs = Array.from(document.querySelectorAll('[data-mode]'));
const language = $('language');
let stats = null;
let mode = new URLSearchParams(location.search).get('mode');
if (!tabs.some(tab => tab.dataset.mode === mode)) mode = 'fishing';

let request = 0;
let board = null;
let status = 'rankingPending';

for (const option of SUPPORTED_LANGUAGES) {
  const element = new Option(option.name, option.id);
  element.lang = option.id;
  language.add(element);
}

function render() {
  language.value = getLanguage();
  language.setAttribute('aria-label', rankText('language'));
  const labels = {
    'board-title': 'ranking', 'go-home': 'returnGame',
    'fishing-label': 'fishingCount', 'registered-label': 'fisherCount',
    'rank-label': 'rank', 'name-label': 'player', 'score-label': 'score', retry: 'retry',
  };
  for (const [id, key] of Object.entries(labels)) $(id).textContent = rankText(key);
  document.title = `イカゲット – ${rankText('ranking')}`;
  $('go-home').href = `./?lang=${encodeURIComponent(getLanguage())}`;
  $('mode-tabs').setAttribute('aria-label', rankText('ranking'));

  for (const tab of tabs) {
    const selected = tab.dataset.mode === mode;
    tab.textContent = rankText(tab.dataset.mode);
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected) $('ranking-panel').setAttribute('aria-labelledby', tab.id);
  }

  $('fishing-count').textContent = stats ? rankNumber(stats.total_play_count) : '—';
  $('registered-count').textContent = stats ? rankNumber(stats.player_count) : '—';
  $('board-status').textContent = status ? rankText(status) : '';
  $('ranking-panel').setAttribute('aria-busy', String(status === 'rankingPending'));
  $('retry').hidden = status !== 'loadError';
  $('board-table').hidden = !board?.length;

  const rows = (board || []).map(record => {
    const row = document.createElement('tr');
    for (const value of [rankNumber(record.rank), record.display_name, rankNumber(record.score)]) {
      const cell = row.insertCell();
      cell.textContent = value;
      cell.dir = 'auto';
    }
    if (record.metrics) {
      const { length_meters, weight_kg, elapsed_ms } = record.metrics;
      const details = document.createElement('span');
      details.className = 'catch-metrics';
      details.textContent = rankText('fishingMetrics', {
        length: length_meters, weight: weight_kg, time: Math.round(elapsed_ms / 100) / 10,
      });
      row.cells[1].append(details);
    }
    return row;
  });
  $('board-rows').replaceChildren(...rows);
}

function updateUrl() {
  const url = new URL(location.href);
  url.searchParams.set('lang', getLanguage());
  url.searchParams.set('mode', mode);
  history.replaceState(null, '', url);
}

async function refresh() {
  const current = ++request;
  board = null;
  status = 'rankingPending';
  render();

  const [newStats, newBoard] = await Promise.allSettled([getRankingStats(), getRankingBoard(mode)]);
  if (current !== request) return;

  if (newStats.status === 'fulfilled') stats = newStats.value;
  if (newBoard.status === 'fulfilled') board = newBoard.value;
  if (newStats.status === 'rejected' || newBoard.status === 'rejected') status = 'loadError';
  else status = board.length ? '' : 'empty';
  render();
}

function activate(tab) {
  if (mode === tab.dataset.mode) return;
  mode = tab.dataset.mode;
  updateUrl();
  void refresh();
}

for (const [index, tab] of tabs.entries()) {
  tab.addEventListener('click', () => activate(tab));
  tab.addEventListener('keydown', event => {
    const targets = {
      ArrowLeft: (index + tabs.length - 1) % tabs.length,
      ArrowRight: (index + 1) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    };
    if (!Object.hasOwn(targets, event.key)) return;
    event.preventDefault();
    const next = tabs[targets[event.key]];
    activate(next);
    next.focus();
  });
}

$('retry').addEventListener('click', refresh);
language.addEventListener('change', () => setLanguage(language.value));
onLanguageChange(() => {
  updateUrl();
  render();
});
void refresh();
