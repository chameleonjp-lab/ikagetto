import { getLanguage, setLanguage, onLanguageChange } from '../i18n/runtime.js';
import { SUPPORTED_LANGUAGES } from '../i18n/languages.js';
import { rankText, rankNumber } from './messages.js?v=3';
import { getRankingBoardPage, getRankingStats } from './client.js?v=3';

const $ = id => document.getElementById(id);
const tabs = Array.from(document.querySelectorAll('[data-mode]'));
const pagination = Array.from(document.querySelectorAll('[data-pagination]'));
const pageButtons = Array.from(document.querySelectorAll('[data-page-step]'));
const language = $('language');
const panel = $('ranking-panel');
const pageSize = 100;
const lastPage = 5;
let stats = null;
let statsFailed = false;
let mode = new URLSearchParams(location.search).get('mode');
if (!tabs.some(tab => tab.dataset.mode === mode)) mode = 'fishing';

let page = 1;
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
    'rank-label': 'rank', 'name-label': 'player', 'score-label': 'score',
    'ranking-details': 'rankingDetails', retry: 'retry',
  };
  for (const [id, key] of Object.entries(labels)) $(id).textContent = rankText(key);
  document.title = `イカゲット – ${rankText('ranking')}`;
  $('go-home').href = `./?lang=${encodeURIComponent(getLanguage())}`;
  const detailUrl = new URL('https://chameleonjp-lab.github.io/chameleonjp_lab/ranking.html');
  detailUrl.search = new URLSearchParams({ game: 'ikagetto', lang: getLanguage(), mode });
  $('ranking-details').href = detailUrl;
  $('mode-tabs').setAttribute('aria-label', rankText('ranking'));

  for (const tab of tabs) {
    const selected = tab.dataset.mode === mode;
    tab.textContent = rankText(tab.dataset.mode);
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected) panel.setAttribute('aria-labelledby', tab.id);
  }

  $('fishing-count').textContent = stats ? rankNumber(stats.total_play_count) : '—';
  $('registered-count').textContent = stats ? rankNumber(stats.player_count) : '—';
  const statusMessages = [status && rankText(status), statsFailed && rankText('statsLoadError')];
  $('board-status').textContent = statusMessages.filter(Boolean).join(' ');
  panel.setAttribute('aria-busy', String(status === 'rankingPending'));
  $('retry').hidden = status === 'rankingPending' || !(status === 'loadError' || statsFailed);
  $('board-table').hidden = !board?.records.length;

  const hasNext = page < lastPage && board?.hasMore === true;
  for (const nav of pagination) {
    nav.hidden = page === 1 && !hasNext;
    nav.setAttribute('aria-label', rankText('pagination'));
    nav.querySelector('[data-page-label]').textContent = rankText('pageNumber', { page });
  }
  for (const button of pageButtons) {
    const previous = button.dataset.pageStep === '-1';
    button.textContent = rankText(previous ? 'previousPage' : 'nextPage');
    button.disabled = previous ? page === 1 || status === 'rankingPending' : !hasNext;
  }

  const rows = (board?.records ?? []).map(record => {
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

async function refreshBoard({ scrollToPanel = false } = {}) {
  const current = ++request;
  board = null;
  status = 'rankingPending';
  render();

  try {
    const result = await getRankingBoardPage(mode, (page - 1) * pageSize, pageSize);
    if (current !== request) return;
    board = result;
    const emptyStatus = page === 1 ? 'empty' : 'emptyPage';
    status = board.records.length ? '' : emptyStatus;
  } catch {
    if (current !== request) return;
    status = 'loadError';
  }
  render();
  if (scrollToPanel) panel.scrollIntoView({ block: 'start' });
}

async function refreshStats() {
  if (statsFailed) {
    statsFailed = false;
    render();
  }
  try {
    stats = await getRankingStats();
  } catch {
    statsFailed = true;
  }
  render();
}

function activate(tab) {
  if (mode === tab.dataset.mode) return;
  mode = tab.dataset.mode;
  page = 1;
  updateUrl();
  void refreshBoard();
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

for (const button of pageButtons) {
  button.addEventListener('click', () => {
    if (button.disabled) return;
    page += Number(button.dataset.pageStep);
    panel.focus({ preventScroll: true });
    void refreshBoard({ scrollToPanel: true });
  });
}

$('retry').addEventListener('click', () => {
  if (statsFailed) void refreshStats();
  if (status === 'loadError') void refreshBoard();
});
language.addEventListener('change', () => setLanguage(language.value));
onLanguageChange(() => {
  updateUrl();
  render();
});
void refreshStats();
void refreshBoard();
