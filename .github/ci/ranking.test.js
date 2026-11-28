import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import twitter from 'twitter-text';
import { createSquidSpecimen, getColossalComment, getCommentForScore } from '../../src/data/SquidTiersAndComments.js';
import { LANGUAGE_IDS } from '../../src/i18n/languages.js';
import { setLanguage } from '../../src/i18n/runtime.js';
import { makeShareText } from '../../src/ranking/share.js';

test('ranking migrations preserve previous records and accept both 80,000-point formats', { timeout: 25000 }, async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;');
    const files = [
      'ikagetto-ranking-v1.sql',
      'verify-ikagetto-ranking-v1.sql',
      'ikagetto-fishing-metrics-v2.sql',
      'verify-ikagetto-fishing-metrics-v2.sql',
      'ikagetto-board-pagination-v3.sql',
      'ikagetto-colossal-metrics-v4.sql',
      'verify-ikagetto-colossal-metrics-v4.sql',
      'verify-ikagetto-board-pagination-v3.sql',
      'ikagetto-hall-of-fame-v1.sql',
      'verify-ikagetto-hall-of-fame-v1.sql',
    ];
    for (const file of files) {
      const sql = await readFile(new URL(`../../supabase/${file}`, import.meta.url), 'utf8');
      try {
        await db.exec(sql);
      } catch (error) {
        throw new Error(`${file}: ${error.message}`, { cause: error });
      }
    }
  } finally {
    await db.close();
  }
});

test('share posts including the official game link fit X in all 15 languages', () => {
  const gameUrl = 'https://chameleonjp-lab.github.io/ikagetto/';
  function check(mode, result, message) {
    const share = makeShareText(mode, result);
    assert.ok(share.endsWith(gameUrl), message);
    assert.doesNotMatch(share, /\{(?:class|length|weight|time|comment)\}/u, message);
    assert.ok(twitter.parseTweet(share).valid, message);
  }

  for (const language of LANGUAGE_IDS) {
    setLanguage(language);
    check('home', {}, language);
    for (const mode of ['fishing', 'butcher', 'cooking']) {
      for (let score = 0; score <= 50000; score += 500) {
        check(mode, {
          lengthMeters: 30, weightKg: 8900, elapsedTime: 120, score,
          rankPosition: 1, playCount: 500, comment: getCommentForScore(score, mode),
        }, `${language} ${mode} ${score}`);
      }
    }
    for (const lengthMeters of [31, 35, 40, 45, 50]) {
      const specimen = createSquidSpecimen(lengthMeters, 1.25);
      for (const evaluation of ['POOR', 'AVERAGE', 'GOOD', 'EXCELLENT']) {
        check('fishing', {
          ...specimen, colossalClass: specimen.tierDef.name, elapsedTime: 166, score: 79000,
          rankPosition: 100, playCount: 1000000, comment: getColossalComment(lengthMeters, evaluation),
        }, `${language} ${lengthMeters}m ${evaluation}`);
      }
    }
    check('fishing', {
      lengthMeters: 50, weightKg: 40000, elapsedTime: 166, score: 79000, playCount: 500,
      rankPosition: null, comment: 'คน🥝e\u0301👩‍🚀あ'.repeat(100),
    }, `${language} long guest comment`);
  }
});
