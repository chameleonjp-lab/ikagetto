import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { chromium } from 'playwright-core';

const gameUrl = 'https://chameleonjp-lab.github.io/ikagetto/';
const threeCdn = 'https://cdn.jsdelivr.net/npm/three@0.169.0/';
const root = new URL('../../', import.meta.url);
const three = new URL('./node_modules/three/', import.meta.url);

async function tapCenter(page, selector) {
  const button = page.locator(selector);
  await button.waitFor();
  const { x, y, width, height } = await button.boundingBox();
  const viewport = page.viewportSize();
  assert.ok(x >= 0 && y >= 0 && x + width <= viewport.width + 1 && y + height <= viewport.height + 1, selector);
  await page.touchscreen.tap(x + width / 2, y + height / 2);
}

function rankingRows(offset) {
  if (offset === 100) return [{ rank: 101, display_name: 'Fisher 101', score: 48000, has_more: false }];
  return Array.from({ length: 100 }, (_, index) => ({
    rank: index < 2 ? 1 : index + 1,
    display_name: index === 0 ? 'New record' : index === 1 ? 'Legacy record' : `Fisher ${index + 1}`,
    score: index < 2 ? 80000 : 50000 - index,
    has_more: true,
    ...(index === 0 ? { length_meters: 50, weight_kg: 45000, elapsed_ms: 166000 } : {}),
  }));
}

test('short mobile play, result and paginated ranking load offline', { timeout: 55000 }, async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_BIN || chromium.executablePath(),
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage({
      isMobile: true, hasTouch: true, reducedMotion: 'reduce', viewport: { width: 402, height: 700 },
    });
    page.setDefaultTimeout(12000);
    const errors = [];
    const requestedPages = [];
    const unexpectedApi = [];
    let serveRankings = false;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.href.startsWith(gameUrl)) {
        const path = url.pathname.slice(new URL(gameUrl).pathname.length) || 'index.html';
        if (path === 'favicon.ico') return route.fulfill({ status: 404 });
        return route.fulfill({ path: fileURLToPath(new URL(path, root)) });
      }
      if (url.href.startsWith(threeCdn)) {
        const path = url.href.slice(threeCdn.length);
        return route.fulfill({ path: fileURLToPath(new URL(path, three)), headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      if (url.hostname.endsWith('.supabase.co')) {
        if (serveRankings && url.pathname.endsWith('/ikagetto_stats_v1')) {
          return route.fulfill({ json: [{ total_play_count: 101, player_count: 101, fishing: 101, butcher: 0, cooking: 0 }] });
        }
        if (serveRankings && url.pathname.endsWith('/ikagetto_board_page_v3')) {
          const args = route.request().postDataJSON();
          requestedPages.push(args);
          return route.fulfill({ json: rankingRows(args.p_offset) });
        }
        unexpectedApi.push(url.pathname);
      }
      return route.abort();
    });

    await page.goto(gameUrl + '?mockRanking=1&colossal=50&lang=en', { waitUntil: 'commit' });
    await page.locator('canvas.webgl-canvas').waitFor();
    const guide = page.locator('#btn-home-guide');
    assert.equal(await guide.getAttribute('aria-checked'), 'true');
    await guide.tap();
    assert.equal(await guide.getAttribute('aria-checked'), 'false');
    await page.locator('#home-player-name').fill('CI Angler');
    await page.locator('#btn-home-play').tap();
    await page.waitForFunction(() => window.ikagettoDebug?.engine.phase === 'SEARCH');
    await page.evaluate(() => { window.ikagettoDebug.engine.depth = 600; });
    await page.locator('#colossal-alert.lv5').waitFor();
    await page.touchscreen.tap(201, 120);
    await page.locator('#colossal-alert').waitFor({ state: 'hidden' });

    await page.evaluate(() => {
      const engine = window.ikagettoDebug.engine;
      for (let frame = 0; frame < 200 && engine.getSnapshot().squid.lureStage !== 'WRAP'; frame++) engine.update(0.05);
    });
    await page.locator('#btn-hook').tap();
    await page.waitForFunction(() => window.ikagettoDebug.engine.phase === 'FIGHT');
    const expected = await page.evaluate(async () => {
      const { finishFight, seededRandom } = await import('./.github/ci/fishing-fixture.js');
      const savedRandom = Math.random;
      try {
        Math.random = seededRandom(103298);
        return finishFight(window.ikagettoDebug.engine);
      } finally {
        Math.random = savedRandom;
      }
    });
    assert.equal(expected.phase, 'INSPECT', expected.failureCode);
    await tapCenter(page, '#btn-show-result');
    await page.locator('#fr-rank').getByText('EX', { exact: true }).waitFor();
    assert.equal(await page.locator('#fr-len').textContent(), '50 m');
    await page.waitForFunction((score) => document.querySelector('#fr-score').textContent.includes(score),
      expected.result.score.toLocaleString('en-US'));
    await page.setViewportSize({ width: 874, height: 402 });
    await tapCenter(page, '#fr-btn-next');
    await page.locator('#flow-menu-stack button').first().tap();
    await page.locator('#butcher-top').waitFor();

    serveRankings = true;
    await page.goto(gameUrl + 'ranking.html?lang=en', { waitUntil: 'commit' });
    const rows = page.locator('#board-rows tr');
    await rows.nth(99).waitFor();
    assert.equal(await rows.count(), 100);
    assert.deepEqual(await rows.locator('td:last-child').allTextContents().then(values => values.slice(0, 2)), ['80,000', '80,000']);
    assert.match(await rows.first().locator('.catch-metrics').textContent(), /50 m.+45,000 kg.+166 s/);
    assert.equal(await rows.nth(1).locator('.catch-metrics').count(), 0);
    await page.locator('[data-page-step="1"]').first().tap();
    await rows.getByText('Fisher 101', { exact: true }).waitFor();
    assert.equal(await rows.count(), 1);
    assert.deepEqual(requestedPages, [
      { p_mode: 'fishing', p_limit: 100, p_offset: 0 },
      { p_mode: 'fishing', p_limit: 100, p_offset: 100 },
    ]);
    assert.equal(new URL(await page.locator('#ranking-details').getAttribute('href')).searchParams.get('game'), 'ikagetto');
    assert.deepEqual(unexpectedApi, [], 'mock play must not reach Supabase');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
