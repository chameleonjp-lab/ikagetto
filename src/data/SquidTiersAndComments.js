import { translateColossalComment, translateComment } from '../i18n/runtime.js';

// =============================================================================
// 6-Tier Giant Squid Specimen Generator, Score Formula & 300 Comments (100 x 3)
// =============================================================================

export const SQUID_TIERS = {
  1: {
    tier: 1,
    name: '幼体・小型個体',
    minLen: 1,
    maxLen: 4,
    scale: 0.56,
    tensionMult: 0.58,
    staminaMax: 70,
    tearMult: 1.18,
    jetFreqMult: 1.35,
    tint: 0xffebe8,
    iridescence: 0.55,
    hasScars: false,
    biolumRim: 0.0,
    escapeBurstCount: 1
  },
  2: {
    tier: 2,
    name: '標準成体（現行基準）',
    minLen: 5,
    maxLen: 10,
    scale: 1.0,
    tensionMult: 1.0,
    staminaMax: 100,
    tearMult: 1.0,
    jetFreqMult: 1.0,
    tint: 0xf7e6e4,
    iridescence: 0.42,
    hasScars: false,
    biolumRim: 0.0,
    escapeBurstCount: 1
  },
  3: {
    tier: 3,
    name: '大型成体',
    minLen: 11,
    maxLen: 15,
    scale: 1.28,
    tensionMult: 1.32,
    staminaMax: 135,
    tearMult: 1.08,
    jetFreqMult: 0.88,
    tint: 0xe6b8b4,
    iridescence: 0.36,
    hasScars: true,
    biolumRim: 0.0,
    escapeBurstCount: 2
  },
  4: {
    tier: 4,
    name: '巨大個体（深海の主）',
    minLen: 16,
    maxLen: 20,
    scale: 1.56,
    tensionMult: 1.65,
    staminaMax: 170,
    tearMult: 1.15,
    jetFreqMult: 0.78,
    tint: 0xd99e9a,
    iridescence: 0.48,
    hasScars: true,
    biolumRim: 0.12,
    escapeBurstCount: 2
  },
  5: {
    tier: 5,
    name: '超巨大個体（クラーケン級）',
    minLen: 21,
    maxLen: 25,
    scale: 1.88,
    tensionMult: 2.02,
    staminaMax: 210,
    tearMult: 1.22,
    jetFreqMult: 0.68,
    tint: 0xc98280,
    iridescence: 0.62,
    hasScars: true,
    biolumRim: 0.28,
    escapeBurstCount: 3
  },
  6: {
    tier: 6,
    name: '伝説級（アビスエンペラー）',
    minLen: 26,
    maxLen: 30,
    scale: 2.22,
    tensionMult: 2.45,
    staminaMax: 260,
    tearMult: 1.28,
    jetFreqMult: 0.60,
    tint: 0xbd6e76,
    iridescence: 0.85,
    hasScars: true,
    biolumRim: 0.58,
    escapeBurstCount: 3
  }
};

// 31m-50m colossal classes. They reuse the same fields as Tier 1-6 so the engine
// can read tensionMult / staminaMax the same way. `colossal: true` marks them.
export const COLOSSAL_TIERS = {
  7: {
    tier: 7,
    key: 'TIER7',
    name: 'ヌシ級・序盤',
    minLen: 31,
    maxLen: 34,
    scale: 2.30,
    tensionMult: 2.60,
    staminaMax: 290,
    tearMult: 1.30,
    jetFreqMult: 0.56,
    escapeBurstCount: 3,
    jetPeriodRange: [7.6, 8.5],
    alertLevel: 1,
    reelSpeedMult: 0.78,
    colossal: true
  },
  8: {
    tier: 8,
    key: 'TIER8',
    name: 'ヌシ級',
    minLen: 35,
    maxLen: 39,
    scale: 2.42,
    tensionMult: 2.75,
    staminaMax: 320,
    tearMult: 1.32,
    jetFreqMult: 0.52,
    escapeBurstCount: 3,
    jetPeriodRange: [8.7, 9.8],
    alertLevel: 2,
    reelSpeedMult: 0.70,
    colossal: true
  },
  9: {
    tier: 9,
    key: 'TIER9',
    name: '超巨大級',
    minLen: 40,
    maxLen: 44,
    scale: 2.56,
    tensionMult: 2.90,
    staminaMax: 355,
    tearMult: 1.34,
    jetFreqMult: 0.48,
    escapeBurstCount: 4,
    jetPeriodRange: [10.0, 11.0],
    alertLevel: 3,
    reelSpeedMult: 0.64,
    colossal: true
  },
  10: {
    tier: 10,
    key: 'TIER10',
    name: '超巨大級・極大',
    minLen: 45,
    maxLen: 49,
    scale: 2.70,
    tensionMult: 3.05,
    staminaMax: 390,
    tearMult: 1.36,
    jetFreqMult: 0.44,
    escapeBurstCount: 4,
    jetPeriodRange: [11.2, 12.1],
    alertLevel: 4,
    reelSpeedMult: 0.63,
    colossal: true
  },
  11: {
    tier: 11,
    key: 'TIER10_MAX',
    name: '伝説の深海神',
    minLen: 50,
    maxLen: 50,
    scale: 2.80,
    tensionMult: 3.18,
    staminaMax: 420,
    tearMult: 1.38,
    jetFreqMult: 0.42,
    escapeBurstCount: 4,
    jetPeriodRange: [12.2, 12.5],
    alertLevel: 5,
    reelSpeedMult: 0.60,
    colossal: true
  }
};

export const COLOSSAL_MIN_LENGTH = 31;
export const MAX_LENGTH_METERS = 50;

export function isColossalLength(lengthMeters) {
  return Number(lengthMeters) >= COLOSSAL_MIN_LENGTH;
}

export function getTierForLength(lengthMeters) {
  if (lengthMeters <= 4) return SQUID_TIERS[1];
  if (lengthMeters <= 10) return SQUID_TIERS[2];
  if (lengthMeters <= 15) return SQUID_TIERS[3];
  if (lengthMeters <= 20) return SQUID_TIERS[4];
  if (lengthMeters <= 25) return SQUID_TIERS[5];
  if (lengthMeters <= 30) return SQUID_TIERS[6];
  if (lengthMeters <= 34) return COLOSSAL_TIERS[7];
  if (lengthMeters <= 39) return COLOSSAL_TIERS[8];
  if (lengthMeters <= 44) return COLOSSAL_TIERS[9];
  if (lengthMeters <= 49) return COLOSSAL_TIERS[10];
  return COLOSSAL_TIERS[11];
}

// =============================================================================
// 31m-50m encounter chance with a pity counter (saved in localStorage)
// =============================================================================
export const COLOSSAL_PITY_KEY = 'ikagetto_colossal_pity_v1';
let pityMemory = { attemptCount: 1 };

function sanitizeAttemptCount(value) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? Math.min(9, Math.max(1, n)) : 1;
}

export function readColossalPity() {
  try {
    const raw = globalThis.localStorage?.getItem(COLOSSAL_PITY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      pityMemory = { attemptCount: sanitizeAttemptCount(parsed?.attemptCount) };
    }
  } catch { /* Private mode etc.: keep the in-memory value. */ }
  return { ...pityMemory };
}

export function writeColossalPity(attemptCount) {
  pityMemory = { attemptCount: sanitizeAttemptCount(attemptCount) };
  try {
    globalThis.localStorage?.setItem(COLOSSAL_PITY_KEY, JSON.stringify(pityMemory));
  } catch { /* Private mode etc.: keep the in-memory value. */ }
  return { ...pityMemory };
}

// 1st try 0%, then +5% per try, capped at 40% from the 9th try.
export function calculateColossalProbability(attemptCount) {
  if (attemptCount <= 1) return 0.0;
  return Math.min(0.40, Math.max(0.0, (attemptCount - 1) * 0.05));
}

// Decide the encounter at departure and save the next count right away, so a
// reload cannot be used to re-roll the same try.
export function rollColossalEncounter(random = Math.random) {
  const { attemptCount } = readColossalPity();
  const probability = calculateColossalProbability(attemptCount);
  const hit = random() < probability;
  writeColossalPity(hit ? 2 : Math.min(9, attemptCount + 1));
  return { hit, attemptCount, probability };
}

const COLOSSAL_LENGTH_BANDS = [
  { min: 31, max: 34, weight: 0.32 },
  { min: 35, max: 39, weight: 0.28 },
  { min: 40, max: 44, weight: 0.20 },
  { min: 45, max: 49, weight: 0.14 },
  { min: 50, max: 50, weight: 0.06 }
];

export function pickColossalLength(random = Math.random) {
  let r = random();
  for (const band of COLOSSAL_LENGTH_BANDS) {
    if (r < band.weight) {
      const span = band.max - band.min + 1;
      return band.min + Math.min(span - 1, Math.floor((r / band.weight) * span));
    }
    r -= band.weight;
  }
  return 50;
}

// Smoothly blends the 1-30m curve into a cubic curve so 30m -> 31m stays continuous.
export function colossalStandardWeight(lengthMeters) {
  const L = Math.min(50, Math.max(30, lengthMeters));
  const base30 = Math.pow(30, 2.55) * 0.92;
  const cubic = 250 * Math.pow(L / 10, 3);
  const t = (L - 30) / 20;
  return (1 - t) * base30 * Math.pow(L / 30, 2.55) + t * cubic;
}

function buildLabelFor(buildFactor) {
  return buildFactor < 0.88
    ? 'スリム型'
    : buildFactor < 1.08
      ? '標準体型'
      : buildFactor < 1.24
        ? '肉厚ヘビー級'
        : '極太モンスター級';
}

export function createSquidSpecimen(lengthMeters, buildFactor = 0.72 + Math.random() * 0.66) {
  const L = Math.max(1, Math.min(MAX_LENGTH_METERS, Math.round(lengthMeters)));
  const tierDef = getTierForLength(L);
  let weightKg;
  let effectiveBuild = buildFactor;
  if (L >= COLOSSAL_MIN_LENGTH) {
    effectiveBuild = Math.min(1.25, Math.max(0.82, buildFactor));
    weightKg = Math.round(Math.min(42000, Math.max(100, colossalStandardWeight(L) * effectiveBuild)));
  } else {
    const baseKg = Math.pow(L, 2.55) * 0.92;
    weightKg = Math.max(2, Math.round(baseKg * buildFactor));
  }
  return {
    lengthMeters: L,
    weightKg,
    buildFactor: effectiveBuild,
    buildLabel: buildLabelFor(effectiveBuild),
    tier: tierDef.tier,
    tierDef,
    colossal: Boolean(tierDef.colossal)
  };
}

// Generates a 1m–30m (integer 1m step) specimen, or a 31m–50m colossal one when
// `rollColossal` is set (only at departure, never for the home-screen preview).
export function generateSquidSpecimen({ rollColossal = false, forceLength = null, random = Math.random } = {}) {
  if (Number.isFinite(forceLength)) return createSquidSpecimen(forceLength);
  if (rollColossal && rollColossalEncounter(random).hit) {
    return createSquidSpecimen(pickColossalLength(random));
  }
  return createSquidSpecimen(1 + Math.floor(random() * 30)); // 1..30m
}

// Fishing score: 0..50,000 for 1-30m (unchanged), 50,000..80,000 for 31-50m.
export function calculateFishingScore({ lengthMeters, weightKg, elapsedTime, tear = 0, maxWinchTemp = 50 }) {
  if (lengthMeters >= COLOSSAL_MIN_LENGTH) {
    return calculateColossalScore({ lengthMeters, weightKg, elapsedTime, tear, maxWinchTemp });
  }
  const lenScore = Math.pow(lengthMeters / 30, 1.12) * 24000;
  const refWeight = Math.pow(lengthMeters, 2.55) * 0.92;
  const relWeightRatio = Math.min(1.4, Math.max(0.65, weightKg / Math.max(1, refWeight)));
  const absWeightRatio = Math.min(1.0, Math.pow(weightKg / 5400, 0.42));
  const weightScore = (absWeightRatio * 9500) + ((relWeightRatio - 0.65) / 0.75) * 4500;

  const targetSec = 42 + lengthMeters * 4.2;
  const speedRatio = Math.max(0.1, Math.min(1.35, targetSec / Math.max(15, elapsedTime)));
  const speedScore = Math.min(12000, speedRatio * 9200 * (0.65 + 0.35 * (lengthMeters / 30)));

  const penalty = Math.min(2800, tear * 18 + Math.max(0, maxWinchTemp - 92) * 35);
  const score = Math.round(Math.max(0, Math.min(50000, lenScore + weightScore + speedScore - penalty)));
  return { score, rank: rankForScore(score) };
}

export function rankForScore(score) {
  if (score >= 74000) return 'EX';
  if (score >= 65000) return 'SSS';
  if (score >= 55000) return 'SS';
  return score >= 45000 ? 'S+' : score >= 37500 ? 'S' : score >= 27500 ? 'A' : score >= 17500 ? 'B' : 'C';
}

// Score = 50000 + (L - 30) * 1200 + floor(weight / 150) + FightTimeBonus, capped at 80,000.
// Whole voyage time (search + descent ~35s + fight) is compared with a size-based target:
// a well-played fight takes about 80s at 31m up to about 130s at 50m.
export function calculateColossalScore({ lengthMeters, weightKg, elapsedTime, tear = 0, maxWinchTemp = 50 }) {
  const L = Math.min(50, Math.max(31, lengthMeters));
  const targetSec = 115 + (L - 31) * 2.75;
  const speedRatio = Math.max(0.1, Math.min(1.35, targetSec / Math.max(30, elapsedTime)));
  const penalty = Math.min(2800, tear * 18 + Math.max(0, maxWinchTemp - 92) * 35);
  const fightTimeBonus = Math.max(0, Math.min(5740, speedRatio * 4250) - penalty);
  const raw = 50000 + (L - 30) * 1200 + Math.floor(weightKg / 150) + fightTimeBonus;
  const score = Math.round(Math.max(0, Math.min(80000, raw)));

  let evaluation = speedRatio >= 1.15 ? 'EXCELLENT' : speedRatio >= 0.9 ? 'GOOD' : speedRatio >= 0.6 ? 'AVERAGE' : 'POOR';
  if (maxWinchTemp > 100 && evaluation !== 'POOR') {
    evaluation = evaluation === 'EXCELLENT' ? 'GOOD' : evaluation === 'GOOD' ? 'AVERAGE' : 'POOR';
  }
  return { score, rank: rankForScore(score), evaluation, speedRatio, fightTimeBonus };
}

// =============================================================================
// 100-Pattern Comments (500-point step: 0..50,000 -> index 0..99) for ALL 3 modes
// =============================================================================
export const FISHING_COMMENTS_100 = [
  'まずは深海への第一歩！次はもっと大物を狙おう。',
  '可愛いサイズだけど、れっきとしたダイオウイカだ！',
  '調査船のデッキが広く見える…まだまだこれから！',
  '小ぶりでも深海の神秘。腕試しにはちょうどいい。',
  'ライトの当て方は悪くない。次はサイズアップだ！',
  '網ですくえそうな愛嬌ある1杯。練習完了！',
  '深海ソナーの反応に慣れてきた感じがあるぞ。',
  '幼体クラスの素早い動きを落ち着いて制した！',
  'まずは一匹目。海はまだまだ深いぞ！',
  '手慣らし完了！ここからが本番の深海漁だ。',
  'なかなかの手応え。漁師の顔つきになってきた！',
  'ウインチの扱いが安定してきたぞ。ナイスキャッチ！',
  'しっかりフッキングを決めた堅実な一本！',
  '潮流を読みながらの操船が光っていた！',
  'このサイズなら港でもちょっとした話題になるぞ。',
  '深海800mからの生還！見事な巻き上げだ。',
  'ライン張力のコントロールが実に丁寧だった。',
  '標準クラスを危なげなく仕留める安定感！',
  '漁師仲間も「おっ、いいイカだな」と頷くサイズ。',
  'ウインチの張力コントロールが冴えていた！見事な良釣果。',
  '立派な成体ダイオウイカ！デッキが一気に華やぐ！',
  'スピード感ある巻き上げで主導権を握り続けた！',
  'カメラ越しの駆け引きを制した見事な一撃！',
  '重量感のある引きを船の追従操舵で見事にいなした！',
  '港の市場に並べたら人だかりができるレベルだ！',
  '深海調査船のクルーも拍手喝采のナイスファイト！',
  '波のタイミングを完璧に読んだクレーン揚収！',
  '大型の兆しあり！この調子でさらに深淵へ挑もう。',
  '体長も重さも申し分なし！ベテランの風格だ。',
  'ジェット噴射の猛攻を耐え抜いた執念の勝利！',
  'かなりの大物！写真映え抜群の堂々たる個体だ。',
  'ウインチの温度管理まで完璧なプロフェッショナル操業！',
  'ソナー反応のど真ん中を射抜いた的確なアプローチ！',
  '10m超えの迫力！深海の王者と渡り合った証だ。',
  '重厚な引きに一切動じない冷静なハンドルさばき！',
  '新聞の地方版に載ってもおかしくない大漁だ！',
  'マッコウクジラも一目置く立派なダイオウイカ！',
  'スピードと精度が噛み合った会心のファイト！',
  '大型クレーンが軋むほどのずっしりとした手応え！',
  '海の男（女）の底力を見た！文句なしの好成績！',
  '圧巻のボリューム！漁師と並べると迫力が段違いだ！',
  '高張力のギリギリを攻め切るスリリングな名勝負！',
  '深海魚図鑑の表紙を飾れるほどの極上個体！',
  'この重さをこのタイムで上げるとは…只者じゃない！',
  '船体のロールを抑え切った見事なシーマンシップ！',
  'テレビ局の取材が殺到するレベルの特大サイズ！',
  '巨体のジェット推進を真っ向から受け止めた剛腕！',
  '深海の主クラスを堂々撃破！歴史に残る一戦だ。',
  '精密な巻上と繰出の駆け引きが光る、教科書にしたいファイト！',
  '折り返し点突破！一流の深海ハンターと名乗っていいぞ。',
  '凄まじい貫禄！デッキ全体がイカの巨体で埋まりそうだ！',
  '重量級モンスターを高速で仕留める圧巻のテクニック！',
  '海洋研究所から標本提供の依頼が来るクラスの大物！',
  '傷跡すら勲章に見える歴戦のダイオウイカを制圧！',
  '波浪も潮流も味方につけた達人級の操船技術！',
  '見上げるほどの巨体！170cmの漁師が小さく見える！',
  'ウインチ限界スレスレを完璧に制御した神業！',
  '深海の怪物を相手に一歩も引かない圧倒的度胸！',
  '全国ニュース速報レベルの超特大ダイオウイカだ！',
  'スピード・サイズ・重量、三拍子揃った極上の釣果！',
  'まさにクラーケン級！伝説の領域に片足を踏み入れた！',
  '鋼鉄のワイヤーが悲鳴を上げる死闘を制した英雄！',
  'このタイムでこの巨体は驚異的…船長も言葉を失う！',
  '深海の暗闇から引きずり出した怪物級のインパクト！',
  '海洋史に名を刻むレベルのモンスターキャッチ！',
  '完璧なフッキングと無駄のない巻き上げの結晶！',
  '圧倒的な体積と重量！Aフレームクレーンもフル稼働だ！',
  '海の神に愛されたとしか思えない奇跡の一本！',
  'プロ漁師たちが一斉に敬礼するレジェンド級釣果！',
  '20mクラスの威容！画面に収まりきらない大迫力！',
  '超重量級をねじ伏せた、まさに深海釣りのマスター！',
  '世界記録更新の噂が港じゅうを駆け巡るレベル！',
  '一秒の無駄もない電光石火のモンスター討伐！',
  '深海の覇者を完全に手玉に取った圧巻の立ち回り！',
  '水族館の巨大水槽ですら入りきらない規格外の怪物！',
  '嵐の夜に舞い降りた深海伝説…鳥肌モノの快挙だ！',
  '重さも長さも規格外！もはや小舟より大きいぞ！',
  '完璧すぎる操舵追従！張力メーターを自在に操った！',
  '世界中の海洋学者が驚愕する世紀の大発見クラス！',
  '80点台相当の超高スコア！神域まであと一歩！',
  'アビスエンペラー級の巨体を正面から撃破！凄まじい！',
  '伝説の怪物クラーケンを現代に蘇らせた男気（女気）！',
  'もはや怪獣サイズ！漁師が豆粒のように見える圧巻の対比！',
  '限界突破のスピード＆重量！歴史的レコード誕生だ！',
  '深海の支配者を完全に屈服させた無双のキャプテン！',
  '全世界のSNSでトレンド1位間違いなしの衝撃スクショ！',
  '一分の隙もない完璧なシーマンシップと反射神経！',
  '30m級に迫る神話サイズ！博物館が丸ごと欲しがる逸品！',
  '人類の深海漁業史を塗り替える奇跡のスーパーキャッチ！',
  'これぞ深海の頂点！畏敬の念すら湧くモンスター！',
  '神業の極み！長さ・重さ・速さすべてが異次元レベル！',
  '深淵の皇帝を最速クラスで仕留めた伝説の釣り師！',
  '地球上で最も巨大な頭足類を完全に制した王者！',
  'もはや言葉はいらない…圧倒的すぎる深海の奇跡！',
  '宇宙からでも見えそうなスケール感！伝説の1杯だ！',
  '全漁師が一生に一度は夢見る究極のパーフェクトキャッチ！',
  '歴史書に永劫語り継がれる深海覇者の大記録！',
  '限界のさらに向こう側へ！神話級の超絶フィッシング！',
  '理論値に肉薄する驚異のスコア！深海の絶対王者！',
  '【完全神話達成】30m級最重量を最速で制した、人類史上最強のダイオウイカマスター！'
];

export const BUTCHER_COMMENTS_100 = [
  'おっと…かなり豪快に崩れてしまった！次は落ち着いて。',
  '墨まみれ＆ボロボロだけど、これも経験のうち！',
  'まな板の上が戦場だ…まずはガイド線を意識しよう。',
  '包丁の角度がまだ迷っている感じ。次はスッといこう！',
  '墨袋の怖さを身をもって知った解体デビュー戦！',
  'ちょっと力みすぎたかな？柔らかい手つきがコツだぞ。',
  '形はワイルドだけど、なんとか部位は分かれた！',
  '皮がかなり残っちゃった…次こそ綺麗に剥こう！',
  '軟甲が折れちゃったけど、食べるところはまだあるぞ。',
  '初心者卒業まであと少し！矢印のリズムを掴もう。',
  '少しずつ包丁さばきが安定してきたぞ！',
  '墨袋は危なかったけど、なんとか致命傷は免れた！',
  '断面はやや荒いが、家庭料理なら全然アリな仕上がり！',
  'ゲソの切り分けがだいぶ様になってきた！',
  '手順を覚えてきたな！次は精度をもう一段上げよう。',
  'まあまあの仕上がり！少しのミスは調理でカバーだ。',
  'ヒレの切り離しが悪くない。感覚を掴み始めたぞ！',
  'クチバシ処理もだいぶスムーズになってきた！',
  'おっ、見栄えが整い始めた！見習い板前クラスだ。',
  '丁寧に進めればもっと伸びる！伸びしろ十分だ！',
  'なかなか綺麗な解体！トレイの上も見やすくなった。',
  '包丁の走りが滑らかになってきたぞ。ナイスカット！',
  '皮剥ぎのコツを掴んだな！白い身が綺麗に見えてる！',
  '墨袋をかわす手つきに落ち着きが出てきた！',
  '鮮魚コーナーに並べても恥ずかしくないレベル！',
  '軟甲を折らずに抜く快感、わかってきたんじゃないか？',
  'ゲソと触腕のバランスが美しい！いい仕事だ。',
  '断面がシャープ！素材の旨みを逃さない切り方だ。',
  '無駄な傷が少ない、誠実で丁寧な解体作業！',
  '居酒屋の板長も「お、やるな」と認める腕前だ！',
  '見事な手さばき！各部位が艶やかに並んでいる！',
  '皮残りがほとんどない、美しい真珠色の胴体肉！',
  '墨一滴こぼさない繊細な内臓処理！素晴らしい！',
  '目玉とカラストンビを傷つけず綺麗に摘出した！',
  'プロの下処理に迫る高い完成度！調理が楽しみだ！',
  'リズムよく迷いなく切り分けた爽快な解体劇！',
  '巨大なダイオウイカをここまで整然と捌くとはお見事！',
  '包丁の刃が喜んでいるような、滑らかな切断面！',
  'トレイの盛り付けまで芸術的な美しさが出てきた！',
  '中堅から熟練職人へ！確かな技術を感じる仕上がり。',
  '圧巻の解体美！このままお造りにしても映えるぞ！',
  '全工程を通して高い精度を維持した職人技！',
  '軟甲も墨袋も完全無傷！見本にしたいお手本解体！',
  'これぞ鮮魚のプロフェッショナル！隙が見当たらない。',
  '力強さと繊細さが両立した、惚れ惚れする包丁さばき！',
  '築地・豊洲の仲買人も唸る極上の解体クオリティ！',
  '皮剥ぎ一閃！つるりと輝く極上の白身が美しい！',
  'クチバシの艶まで際立つ、博物館級の精密解体！',
  '高難度の墨袋処理を涼しい顔でクリアする凄腕！',
  '折り返し超えの上級職人！見事な仕事ぶりだ！',
  '一刀ごとに魂が宿るような美しい解体ショー！',
  '断面が鏡のように滑らか！旨みを100%閉じ込めた！',
  '巨大イカをまるで小イカのように軽々と捌き切った！',
  '料理番組でそのまま放送できる完璧な手際だ！',
  '寸分の狂いもないガイドトレース！精密機械レベル！',
  'トレイ全体が宝石箱のように輝く極上プレゼンテーション！',
  '高級割烹の料理長からスカウトが来る腕前だ！',
  '墨汚れゼロ・皮残りゼロ・断面完璧の三冠王！',
  '軟甲が透き通るガラス細工のように綺麗に抜けた！',
  '見る者すべてを魅了する、美しすぎる解体芸術！',
  'もはや達人の領域！包丁が吸い付くように走った！',
  'これほどの巨体を一滴の無駄もなく捌く神技！',
  '全工程で高評価を叩き出した圧倒的安定感！',
  '鮮魚解体ショーの全国大会で優勝を狙えるレベル！',
  '一寸の迷いもない、研ぎ澄まされた職人の所作！',
  '素材への敬意が伝わる、息を呑むほど綺麗な仕上がり！',
  'どの部位をアップで見ても完璧すぎるディテール！',
  '名刀を自在に操る解体マイスターの称号を贈ろう！',
  '難関工程をすべて一発クリアする驚異の集中力！',
  '高級寿司店のカウンターにそのまま出せる逸品！',
  '神の手を持つ解体師！トレイが美術館の展示品のようだ！',
  'タイミングもなぞりも引き抜きも、すべてが超高水準！',
  '深海の怪物を極上の食材へと昇華させた魔術師！',
  '包丁さばきに一切のノイズがない、純度100%の職人芸！',
  '漁港のベテラン勢が総立ちで拍手する圧巻の解体！',
  'もはや人間国宝クラス！ダイオウイカ解体の第一人者！',
  '完璧を超える美学！光の反射すら計算された断面！',
  'これ以上ないほど整然と並ぶ、究極の部位コレクション！',
  '一本の傷も妥協も許さない、孤高の解体マスター！',
  '神域目前！伝説の板前たちがひれ伏すスーパープレイ！',
  '奇跡の繊細さ！巨大墨袋を羽のように軽く外した！',
  'すべての工程が芸術作品！世界一の鮮魚パフォーマンス！',
  '包丁と一体化したかのような異次元の解体テクニック！',
  'これぞ完全無欠！一分の曇りもない白銀の仕上がり！',
  '歴史に残る解体ショー！見ているだけで感動するレベル！',
  '解体学の教科書に永遠に載るべき究極のお手本！',
  '超難関を完璧に制した、まさにダイオウイカ解体の神！',
  '細部まで一切の手抜きなし！魂震えるパーフェクト解体！',
  '料理界の頂点に君臨する、伝説の包丁使い！',
  '90%超えの極致！もはや誰にも真似できない芸術だ！',
  '一撃必殺の美技！全工程が黄金比のように美しい！',
  '墨一滴の乱れもない、絶対零度の集中力が生んだ奇跡！',
  '世界最高峰の解体マスター！満場一致のブラボー！',
  '包丁が奏でるシンフォニー！五感で味わう究極の解体！',
  '極上の食材が最高の姿で輝く…これぞ職人の到達点！',
  '理論上の完璧に限りなく近い、驚愕のパーフェクトワーク！',
  '神々の食卓へ捧げるにふさわしい、聖域レベルの解体！',
  '人類史上最も美しいダイオウイカ解体記録を更新！',
  'あと一歩で満点！もはや伝説を超えた究極の包丁神！',
  '【完全解体・神の領域】全工程パーフェクト！歴史に永遠に刻まれる究極の解体マスター！'
];

export const COOKING_COMMENTS_100 = [
  'うわっ…煙がすごい！まずは弱火を意識して再挑戦だ！',
  '真っ黒焦げ＆激塩…でも料理は失敗から学ぶもの！',
  'スキレットの中がカオスだ！次は油と火加減に注意！',
  'イカがゴムみたいになっちゃった…加熱しすぎ注意だぞ。',
  'ニンニクが炭になってしまった！弱火キープが命だ！',
  'ちょっと半生っぽいかも…もう少しグツグツさせよう。',
  '切り方がワイルドすぎる！一口サイズを意識してみよう。',
  '塩を振りすぎたかも…バゲット10本必要だぞ！',
  'オイルが足りずカピカピ…次はメモリまでしっかり注ごう。',
  'まずは味見レベル！コツを掴めば一気に美味しくなるぞ。',
  '香りは少しずつアヒージョっぽくなってきた！',
  '所々焦げてるけど、食べられるところは意外と旨い！',
  '火加減の感覚がわかってきたぞ。あと一歩で安定だ！',
  '具材のカットがだいぶ揃ってきた！食感も良さそう！',
  'オリーブオイルの量がいい感じ！グツグツ感が楽しいな。',
  'ちょっと塩気が強めだけど、お酒のアテにはアリかも！',
  '家庭の夜食なら大満足のダイオウイカ・アヒージョ！',
  'ニンニクの香りが立ってきた！食欲をそそるぞ！',
  'トングの混ぜ方がいい感じ。具材に味が絡んできた！',
  '見習いシェフ卒業間近！なかなかの仕上がりだ！',
  'おおっ、美味しそう！黄金色のオイルが輝いている！',
  'イカの足がプリッと丸まって、いい火通りだ！',
  'ニンニクがきつね色！バゲットを浸したくなる香り！',
  'マッシュルームとミニトマトの彩りが食欲を刺激する！',
  '街のバルで出てきてもおかしくない立派なアヒージョ！',
  '弱火での香り出しが成功！オイル自体がごちそうだ！',
  '塩とパセリのバランスが良好！見た目も華やか！',
  'カットの均一さが食感の良さを引き立てている！',
  'スキレットの熱々感が伝わる、心躍る一皿！',
  '友達に振る舞ったら「おかわり！」が飛び出す美味しさ！',
  '見事な仕上がり！ダイオウイカの旨みがオイルに溶け出してる！',
  '火加減コントロールが絶妙！焦げゼロで香り最高！',
  '吸盤のコリコリ感と身のプリプリ感が完璧に引き出された！',
  '人気スペインバルの看板メニューになれるクオリティ！',
  'パセリの緑と唐辛子の赤、黄金オイルのコントラストが美しい！',
  'フライパンの煽りがプロ顔負け！均一に火が通っている！',
  'オリーブオイルの量が寸分の狂いもなくジャストフィット！',
  'ニンニクの甘みと香ばしさが最大限に引き出された名作！',
  '湯気だけでワインが一本空いてしまいそうな極上の香り！',
  '中級から上級シェフへ！確かな料理センスを感じる一皿！',
  '圧巻のビジュアル！写真に撮って自慢したくなる極上アヒージョ！',
  '全工程が高水準！ダイオウイカがこんなに美味しくなるなんて！',
  '弾けたミニトマトの酸味がイカとオイルを完璧に調和させている！',
  'ミシュラン掲載バルのシェフも唸る完璧な火入れ！',
  'カット・香り出し・煽り・仕上げ、すべてが流れるように美しい！',
  '一滴のオイルも残したくない、罪深いほど旨いアヒージョ！',
  '吸盤ひとつひとつにガーリックオイルが絡む至福の食感！',
  '熱々の泡立ちが音楽のように心地よい、五感で楽しむ逸品！',
  '塩加減が神レベル！素材の甘みを極限まで引き立てている！',
  '折り返し突破の凄腕シェフ！予約の取れない名店クラスだ！',
  'スキレットから立ち昇る香りが画面越しに届きそうな絶品！',
  'プロの料理雑誌の表紙を飾れるほどの完璧なシズル感！',
  'ダイオウイカのポテンシャルを120%解放した革命的一皿！',
  'ニンニク・唐辛子・イカ足の黄金比が生み出す奇跡のハーモニー！',
  '弱火の美学を体現した、濁りのない黄金色の極上オイル！',
  '一口食べれば深海の記憶が蘇る、感動レベルの美食体験！',
  '三つ星レストランのスペシャリテとして提供できる完成度！',
  '一切の焦げも生焼けもない、温度管理の芸術作品！',
  'バゲットが何本あっても足りない、魔性のアヒージョ完成！',
  '見るだけでお腹が空く！完璧すぎる艶と彩りの一皿！',
  'もはや料理界の巨匠！スキレットを自在に操るマエストロ！',
  'どの具材も一番美味しい瞬間でピタリと止めた神業の火入れ！',
  '香り・食感・彩り・温度、すべてが非の打ち所がない極上品！',
  '世界中の美食家が飛行機に乗って食べに来るレベルの逸品！',
  '塩ミルの一回しすら芸術的な、研ぎ澄まされた味の設計！',
  '深海800mの恵みを地上で最も美味しい形へ昇華させた傑作！',
  'オイルの泡ひとつひとつが宝石のように輝く、究極のスキレット！',
  '全工程で驚異のスコア！料理の鉄人も脱帽する圧巻の腕前！',
  '口に入れた瞬間とろけるような、奇跡の柔らかさと弾力！',
  'スペイン本場の巨匠が涙を流して称賛するパーフェクト・アヒージョ！',
  '神の舌と手を持つ料理人！これぞ究極の深海グルメ！',
  'カットの美しさから最後のパセリまで、一点の曇りもない傑作！',
  '歴史上もっとも美味しく調理されたダイオウイカに認定！',
  '熱気と旨みが爆発する、まさに美食のオーケストラ！',
  '一口で幸福度がカンストする、禁断の黄金アヒージョ！',
  '料理番組の最終回を飾るにふさわしい、伝説の神レシピ！',
  '火と油と海の幸を完全に支配した、孤高のガストロノミー！',
  'すべての食通が一生忘れられない、魂を揺さぶる一皿！',
  '完璧を超えて奇跡の領域へ！五つ星を超える極上の美食！',
  '神域目前！世界の料理史に刻まれるダイオウイカ・アヒージョ！',
  '匂いだけで星が3つつくレベルの、異次元クオリティ！',
  '一秒の狂いもない火入れが生んだ、奇跡のプリプリ食感！',
  'もはや食べる芸術品！美術館とレストランが奪い合う逸品！',
  '深海から食卓まで、すべてを極めた真のグルメマスター！',
  '全人類に食べてほしい、感動の涙が出る極上アヒージョ！',
  'SNSで10万いいね間違いなしの、神々しいスキレット！',
  '火加減・塩加減・カットすべてが黄金律に従った完璧な一皿！',
  '伝説の料理人が転生したとしか思えない超絶クッキング！',
  '深海の怪物を天上の美食へ変えた、奇跡の錬金術師！',
  '90%超えの極致！もはや言葉では言い表せない至高の味わい！',
  '一粒の塩、一枚のパセリまで完璧に調和した宇宙一のアヒージョ！',
  'これぞ料理の到達点！食べる者すべてを笑顔にする奇跡の皿！',
  '世界最高峰のシェフに贈る、満場一致のパーフェクト賞賛！',
  '熱々の黄金オイルに宿る、深海と大地の完璧なマリアージュ！',
  '味覚の新時代を切り開く、伝説のダイオウイカ・ガストロノミー！',
  '理論上の最高美味に肉薄する、驚異のパーフェクトクッキング！',
  '神々の晩餐会のメインディッシュに選ばれる究極のスキレット！',
  '人類史上もっとも美しいアヒージョの記録を塗り替えた！',
  '満点まであと一歩！料理神の領域に到達した伝説のシェフ！',
  '【完全美食・料理神降臨】全工程パーフェクト！歴史に永遠に語り継がれる究極のダイオウイカ・アヒージョ！'
];

// =============================================================================
// 31m-50m colossal comments (5 size classes x 4 evaluations = 20)
// =============================================================================
export const COLOSSAL_FISHING_COMMENTS = {
  // Tier 7: 31m〜34m (ヌシ級・序盤)
  TIER7: {
    POOR: '30mオーバーの巨体！だが暴れに対処しきれず、ラインはズタズタだ…',
    AVERAGE: '30m超えのヌシ級を制覇！船体に響く怪力が凄まじい。',
    GOOD: '見事な手さばき！30m超の巨イカを完璧な張力コントロールで揚収！',
    EXCELLENT: '伝説の始まりだ！30m級の巨体を一切の無駄なく仕留めた完全勝利！'
  },
  // Tier 8: 35m〜39m (ヌシ級 Abyssal)
  TIER8: {
    POOR: '35m超の怪物！船体が引きずり込まれかけるギリギリの死闘だった…',
    AVERAGE: '深海の主を捕獲！35mオーバーの圧倒的な重量感が腕に残る。',
    GOOD: '素晴らしい操舵技術！35m超の猛烈なジェット噴射を完封して捕獲！',
    EXCELLENT: '神業的なリール捌き！35mオーバーの超巨大個体を完璧に制圧！'
  },
  // Tier 9: 40m〜44m (超巨大級 Colossal)
  TIER9: {
    POOR: '40m級の超巨体コロッサル！糸切れ寸前の大混乱の末、なんとか揚収…',
    AVERAGE: '40m超えの超巨大イカ降臨！怪物の巨体が甲板を覆い尽くす！',
    GOOD: '見事なテクニック！40m級の強烈な高圧墨と暴れを冷静に捌き切った！',
    EXCELLENT: '深海歴史に刻まれる快挙！40m超の超巨大級をノーミスで完璧捕獲！'
  },
  // Tier 10: 45m〜49m (超巨大級・極大)
  TIER10: {
    POOR: '45m超のタイタン級！船体の限界を超えた絶望的な死闘を生き延びた…',
    AVERAGE: '45mオーバーの極大個体を水揚げ！海面が泡立つほどの圧倒的存在感！',
    GOOD: '極限状態での見事な勝利！45m級の絶望的な引張力を完全に制御した！',
    EXCELLENT: '圧倒的プロフェッショナル！45m超の深海タイタンを完璧に攻略！'
  },
  // Tier 10+ MAX: 50m (伝説の深海神 Leviathan)
  TIER10_MAX: {
    POOR: '50m神話級リヴァイアサン！九死に一生を得て奇跡的に水揚げ成功…！',
    AVERAGE: '50m MAX到達！！深海の頂点に君臨する伝説の神をついに捕獲！！',
    GOOD: '完璧なる深海制覇！50mの神級個体を完璧な操船とリールワークで完封！',
    EXCELLENT: '全人類初の偉業！50m深海神リヴァイアサンを完全無欠のパーフェクト捕獲！！'
  }
};

export const COLOSSAL_EVALUATIONS = ['POOR', 'AVERAGE', 'GOOD', 'EXCELLENT'];

export function getColossalComment(lengthMeters, evaluation = 'AVERAGE') {
  const tierDef = getTierForLength(lengthMeters);
  const key = tierDef.key || 'TIER7';
  const evalKey = COLOSSAL_EVALUATIONS.includes(evaluation) ? evaluation : 'AVERAGE';
  return translateColossalComment(key, COLOSSAL_EVALUATIONS.indexOf(evalKey), COLOSSAL_FISHING_COMMENTS[key][evalKey]);
}

export function getCommentForScore(score, type = 'fishing') {
  const idx = Math.max(0, Math.min(99, Math.floor(score / 500)));
  if (type === 'butcher') return translateComment('butcher', idx, BUTCHER_COMMENTS_100[idx]);
  if (type === 'cooking') return translateComment('cooking', idx, COOKING_COMMENTS_100[idx]);
  return translateComment('fishing', idx, FISHING_COMMENTS_100[idx]);
}
