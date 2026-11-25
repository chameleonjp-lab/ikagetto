const projectUrl = 'https://mlpnjgezrnhdxsxolyzj.supabase.co';
const publicKey = 'sb_publishable_drzcy0v97knU6FgjqSgBHw_0A9XPdFM';
const nameKey = 'ikagetto:ranking:name-v1';
const queuePrefix = 'ikagetto:ranking:pending-v1:';
const modes = new Set(['fishing', 'butcher', 'cooking']);
const queue = new Map();
const sending = new Map();
const runResults = new WeakMap();

function readStorage(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeStorage(key, value) {
  try { localStorage.setItem(key, value); } catch { /* The in-memory queue remains available. */ }
}

function validName(name) {
  if (typeof name !== 'string' || [...name].length > 20) return false;
  if (/[\p{Cc}\p{Cs}\p{Bidi_Control}\u200b\u2060]/u.test(name)) return false;
  if ([...name.normalize('NFKC').trim().replace(/\s+/gu, ' ')].length > 20) return false;
  return name === '' || /[^\p{White_Space}\p{Default_Ignorable_Code_Point}]/u.test(name);
}

const savedName = readStorage(nameKey);
let playerName = validName(savedName) ? savedName : '';

export function getPlayerName() {
  return playerName;
}

export function setPlayerName(value) {
  if (typeof value !== 'string') return false;
  const next = value.trim();
  if (!validName(next)) return false;
  playerName = next;
  writeStorage(nameKey, next);
  return true;
}

async function rpc(route, params = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${projectUrl}/rest/v1/rpc/${route}`, {
      method: 'POST',
      headers: { apikey: publicKey, 'Content-Type': 'application/json' },
      credentials: 'omit',
      redirect: 'error',
      body: JSON.stringify(params),
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok) {
      throw Object.assign(new Error(data.message || 'Ranking request failed'), {
        permanent: data.code === '22023',
      });
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function firstRow(data) {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') throw new Error('Missing ranking data');
  return row;
}

function count(value) {
  const result = Number(value);
  if (value == null || !Number.isSafeInteger(result) || result < 0) {
    throw new Error('Invalid ranking count');
  }
  return result;
}

export async function getRankingStats() {
  const row = firstRow(await rpc('ikagetto_stats_v1'));
  return {
    total_play_count: count(row.total_play_count),
    player_count: count(row.player_count),
    fishing: count(row.fishing),
    butcher: count(row.butcher),
    cooking: count(row.cooking),
  };
}

export async function getRankingBoard(mode, limit = 30) {
  if (!modes.has(mode)) throw new TypeError('Invalid game mode');
  const rows = mode === 'fishing'
    ? await rpc('ikagetto_fishing_board_v2', { p_limit: limit })
    : await rpc('ikagetto_board_v1', { p_mode: mode, p_limit: limit });
  if (!Array.isArray(rows)) throw new Error('Invalid ranking board');
  return rows.map(row => ({
    rank: count(row.rank),
    display_name: String(row.display_name),
    score: count(row.score),
    metrics: mode === 'fishing' && validMetrics(row) ? {
      length_meters: row.length_meters, weight_kg: row.weight_kg, elapsed_ms: row.elapsed_ms,
    } : null,
  }));
}

function remember(job) {
  const key = queuePrefix + job.operation + ':' + job.run.id;
  queue.set(key, job);
  writeStorage(key, JSON.stringify(job));
  return key;
}

function remove(key) {
  queue.delete(key);
  try { localStorage.removeItem(key); } catch { /* The server accepts retries safely. */ }
}

function restoreQueue() {
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key?.startsWith(queuePrefix) || queue.has(key)) continue;
      try {
        const job = JSON.parse(readStorage(key));
        if (job && ['start', 'finish'].includes(job.operation) &&
          modes.has(job.run?.mode) && validName(job.run.name) &&
          /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/u.test(job.run.id) &&
          key === queuePrefix + job.operation + ':' + job.run.id &&
          (job.operation === 'start' || (validScore(job.score) &&
            (job.metrics == null || (job.run.mode === 'fishing' && validMetrics(job.metrics)))))) {
          queue.set(key, job);
        }
      } catch { /* Ignore only this damaged item. */ }
    }
  } catch { /* Storage may be disabled by the browser. */ }
}

function validScore(score) {
  return Number.isInteger(score) && score >= 0 && score <= 50000;
}

function validMetrics({ length_meters, weight_kg, elapsed_ms }) {
  return Number.isInteger(length_meters) && length_meters >= 1 && length_meters <= 30 &&
    Number.isInteger(weight_kg) && weight_kg >= 1 && weight_kg <= 10000 &&
    Number.isInteger(elapsed_ms) && elapsed_ms >= 0 && elapsed_ms <= 2147483647;
}

function sendStart(run) {
  return rpc('ikagetto_start_v1', {
    p_run_id: run.id,
    p_mode: run.mode,
    p_display_name: run.name || null,
  });
}

function sync(key) {
  if (sending.has(key)) return sending.get(key);
  const job = queue.get(key);
  if (!job) return Promise.resolve(null);

  const operation = async () => {
    try {
      const { run } = job;
      if (job.operation === 'start') {
        await sendStart(run);
        remove(key);
        return null;
      }

      const startKey = queuePrefix + 'start:' + run.id;
      if (queue.has(startKey)) {
        await sync(startKey);
        if (queue.has(startKey)) return null;
      }
      const payload = { p_run_id: run.id, p_score: job.score };
      const row = firstRow(job.metrics
        ? await rpc('ikagetto_fishing_finish_v2', {
          ...payload,
          p_length_meters: job.metrics.length_meters,
          p_weight_kg: job.metrics.weight_kg,
          p_elapsed_ms: job.metrics.elapsed_ms,
        })
        : await rpc('ikagetto_finish_v1', payload));
      return { rank: row.rank == null ? null : count(row.rank), play_count: count(row.play_count) };
    } catch (error) {
      if (error.permanent) remove(key);
      else scheduleRetry();
      return null;
    }
  };

  const promise = operation().then(result => {
    if (job.operation === 'finish' && result) remove(key);
    return result;
  }).finally(() => sending.delete(key));
  sending.set(key, promise);
  return promise;
}

let retryTimer = null;

function flushQueue() {
  restoreQueue();
  for (const key of queue.keys()) void sync(key);
}

function scheduleRetry() {
  if (retryTimer != null) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (queue.size && navigator.onLine !== false) flushQueue();
  }, 20000);
}

export function startRankingRun(mode, name = getPlayerName()) {
  if (!modes.has(mode) || !validName(name)) throw new TypeError('Invalid ranking run');
  const run = Object.freeze({ id: crypto.randomUUID(), mode, name });
  void sync(remember({ operation: 'start', run }));
  return run;
}

export function finishRankingRun(run, score, catchResult) {
  if (!run || !validScore(score)) return Promise.resolve(null);
  const metrics = run.mode === 'fishing' ? {
    length_meters: catchResult?.lengthMeters,
    weight_kg: catchResult?.weightKg,
    elapsed_ms: Math.round(catchResult?.elapsedTime * 1000),
  } : null;
  if (metrics && !validMetrics(metrics)) return Promise.resolve(null);
  const existing = runResults.get(run);
  if (existing && existing.score !== score) return Promise.resolve(null);
  if (existing?.finished) return Promise.resolve(existing.finished);

  const state = existing || { score, metrics, finished: null };
  runResults.set(run, state);
  const key = remember({ operation: 'finish', run, score, metrics: state.metrics });
  return sync(key).then(result => {
    if (result) state.finished = result;
    return result;
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', flushQueue);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') flushQueue();
  });
  queueMicrotask(flushQueue);
}
