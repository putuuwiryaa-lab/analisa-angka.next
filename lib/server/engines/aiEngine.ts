import "server-only";
import { AI_I, AI_L, AI_B, AI_T, AI_P, _0xc3c54e, _0xJ2d } from './tables';
import { LEGACY_AI_FORMULAS } from './legacyAiFormulas';

export const _0xe57f0c: Record<number, number> = { 3: 11, 4: 12, 5: 13, 6: 14 };

const AI_EKOR_MAIN: Record<number, number[]> = {
  0: [4, 6, 8, 1, 3, 7],
  1: [3, 5, 9, 2, 4, 8],
  2: [0, 6, 3, 7, 5, 9],
  3: [1, 7, 0, 2, 4, 6],
  4: [0, 2, 8, 1, 5, 9],
  5: [1, 3, 7, 0, 2, 6],
  6: [0, 4, 8, 1, 7, 9],
  7: [1, 3, 5, 0, 4, 8],
  8: [0, 6, 4, 1, 5, 9],
  9: [1, 5, 7, 0, 2, 6],
};

const AI_RANKING_WINDOW = 17;
const RECENT_VALIDATION_WINDOW = 5;
const EXPANSION_TIER_WEIGHTS = [0.70, 0.40, 0.20] as const;

const OVERALL_QUALITY_WEIGHT = 0.65;
const RECENT_QUALITY_WEIGHT = 0.35;
const HISTORY_DECAY = 0.90;
const RANKING_BY_VOTE = new WeakMap<object, AiRankingContext>();

type AiEngineOptions = {
  targetIndexes?: number[];
  thresholds?: Record<number, number>;
};

type AiVote = Record<number, number>;
type AiRumusStat = { name: string; dg: number; hits: number; valid: number; thresh: number; lolos: boolean };

export type AiFormulaRanking = {
  index: number;
  name: string;
  dg: number;
  hits: number;
  valid: number;
  thresh: number;
  lolos: boolean;
  gap: number;
  recentHits: number;
  recentValid: number;
  digits: number[];
};

export type AiRankingContext = {
  formulas: AiFormulaRanking[];
  primaryIndexes: number[];
  primaryGap: number;
};

export type AiValidation = {
  sr: AiRumusStat[];
  vote: AiVote;
  elitCount: number;
  fallback: boolean;
  ranking: AiRankingContext;
};

type WeightedFormula = {
  formula: AiFormulaRanking;
  score: number;
  recentScore: number;
};

type DigitSupport = {
  digit: number;
  vote: number;
  score: number;
  recentScore: number;
};

function thresholdForDigitCount(dg: number, thresholds?: Record<number, number>) {
  return thresholds?.[dg] ?? _0xe57f0c[dg] ?? 11;
}

export const _0x9a025f = [
  { n: "R1 Delta Square", f: (c: string, p: string, p2: string) => { const X = Math.abs(+c[1] - +c[3]); return Array.from(new Set([X, AI_B[X], AI_T[X], AI_I[X]])); }, dg: 4 },
  { n: "R2 Mirror Cross", f: (c: string, p: string, p2: string) => { const X = (+c[0] + (+c[2])) % 10; return Array.from(new Set([X, AI_I[X], _0xc3c54e(X + 1), AI_I[_0xc3c54e(X + 1)], _0xc3c54e(X + 2)])); }, dg: 5 },
  { n: "R3 Biji Resonansi", f: (c: string, p: string, p2: string) => { const X = (+c[0] + (+c[1]) + (+c[2]) + (+c[3])) % 10; return Array.from(new Set([X, AI_L[X], AI_T[X], _0xc3c54e(X + 1), _0xc3c54e(X - 1)])); }, dg: 5 },
  { n: "R4 Diagonal Flow", f: (c: string, p: string, p2: string) => { if (!p) return null; const X = (+p[1] + (+c[3])) % 10; return Array.from(new Set([X, _0xc3c54e(X + 1), _0xc3c54e(X + 2), _0xc3c54e(X + 3), AI_I[X]])); }, dg: 5 },
  { n: "R5 Triple Morph", f: (c: string, p: string, p2: string) => { const X = +c[3]; return Array.from(new Set([X, AI_I[X], AI_L[X], AI_B[X], AI_T[X], AI_T[AI_I[X]]])); }, dg: 6 },
  { n: "R6 V-Shift", f: (c: string, p: string, p2: string) => { const X = Math.abs(+c[1] - +c[2]); return Array.from(new Set([X, _0xc3c54e(X + 2), _0xc3c54e(X - 2), AI_I[X]])); }, dg: 4 },
  { n: "R7 Prime Pulse", f: (c: string, p: string, p2: string) => { const X = (+c[0] + (+c[3])) % 10; return Array.from(new Set([X, AI_P[X], AI_L[X], AI_T[X]])); }, dg: 4 },
  { n: "R8 Shadow Digit", f: (c: string, p: string, p2: string) => { const X = (+c[1] + (+c[3])) % 10; const sh = _0xc3c54e(10 - X); return Array.from(new Set([X, sh, AI_I[X], AI_I[sh]])); }, dg: 4 },
  { n: "R9 Head Twin Flow", f: (c: string, p: string, p2: string) => { if (!p) return null; const X = (+p[2] + (+c[2])) % 10; return Array.from(new Set([X, _0xc3c54e(X + 1), AI_B[X], AI_I[X]])); }, dg: 4 },
  { n: "R10 Quantum Leap", f: (c: string, p2a: string, p2: string) => { if (!p2) return null; const X = Math.abs(+c[3] - +p2[3]); return Array.from(new Set([X, AI_B[X], AI_I[X], AI_T[X], _0xc3c54e(X + 1)])); }, dg: 5 },
  { n: "R11 Alpha Core", f: (c: string, p: string, p2: string) => { const X = (+c[0] + (+c[1])) % 10; return Array.from(new Set([X, AI_L[X], AI_B[X], AI_I[X]])); }, dg: 4 },
  { n: "R12 Delta Strike", f: (c: string, p: string, p2: string) => { const X = Math.abs(+c[0] - +c[2]); return Array.from(new Set([X, AI_T[X], AI_B[X], AI_I[X]])); }, dg: 4 },
  { n: "R13 Tail Run", f: (c: string, p: string, p2: string) => { const X = (+c[2] + (+c[3])) % 10; return Array.from(new Set([X, _0xc3c54e(X + 1), _0xc3c54e(X + 2), _0xc3c54e(X + 3), AI_I[X]])); }, dg: 5 },
  { n: "R14 As Kop Gap", f: (c: string, p: string, p2: string) => { const X = Math.abs(+c[0] - +c[1]); return Array.from(new Set([X, AI_L[X], AI_I[X], AI_T[X]])); }, dg: 4 },
  { n: "R15 Kop Twin Flow", f: (c: string, p: string, p2: string) => { if (!p) return null; const X = (+p[1] + (+c[1])) % 10; return Array.from(new Set([X, AI_I[X], AI_B[X], _0xc3c54e(X + 1)])); }, dg: 4 },
  { n: "R16 Head Shift", f: (c: string, p: string, p2: string) => { const X = +c[2]; return Array.from(new Set([X, _0xc3c54e(X + 1), AI_B[X], AI_I[X]])); }, dg: 4 },
  { n: "R17 Twin Alpha", f: (c: string, p: string, p2: string) => { if (!p) return null; const X = (+p[0] + (+c[0])) % 10; return Array.from(new Set([X, AI_L[X], AI_T[X], AI_I[X]])); }, dg: 4 },
  { n: "R18 Omega Gap", f: (c: string, p: string, p2: string) => { if (!p) return null; const X = Math.abs(+p[3] - +c[3]); return Array.from(new Set([X, _0xc3c54e(X + 2), AI_B[X], AI_I[X]])); }, dg: 4 },
  { n: "R19 Mid Flow", f: (c: string, p: string, p2: string) => { const X = (+c[1] + (+c[2])) % 10; return Array.from(new Set([X, AI_T[X], AI_L[X], AI_I[X]])); }, dg: 4 },
  { n: "R20 Front Trinity", f: (c: string, p: string, p2: string) => { const X = (+c[0] + (+c[1]) + (+c[2])) % 10; return Array.from(new Set([X, AI_B[X], AI_I[X], _0xc3c54e(X + 1)])); }, dg: 4 },
  { n: "R21 Alpha Lag Gap", f: (c: string, p: string, p2: string) => { if (!p2) return null; const X = Math.abs(+p2[0] - +c[0]); return Array.from(new Set([X, AI_L[X], AI_B[X], _0xc3c54e(X + 1)])); }, dg: 4 },
  { n: "R22 Lag Tail Multiply", f: (c: string, p: string, p2: string) => { if (!p2) return null; const X = (+p2[3] * (+c[3])) % 10; return Array.from(new Set([X, AI_L[X], AI_B[X], AI_I[X]])); }, dg: 4 },
  { n: "R23 Cross Multiply Flow", f: (c: string, p: string, p2: string) => { if (!p) return null; const X = ((+p[0]) * (+c[2])) % 10; return Array.from(new Set([X, AI_T[X], AI_L[X], _0xc3c54e(X + 3)])); }, dg: 4 },
  { n: "R24 Front Multiply", f: (c: string, p: string, p2: string) => { const X = ((+c[0]) * (+c[1]) * (+c[2])) % 10; return Array.from(new Set([X, AI_T[X], AI_I[X], _0xc3c54e(X + 1)])); }, dg: 4 },
  { n: "R25 Lag 2 Resonance", f: (c: string, p: string, p2: string) => { if (!p2) return null; const X = (+p2[0] + (+p2[1]) + (+p2[2]) + (+p2[3])) % 10; return Array.from(new Set([X, AI_T[X], AI_I[X], AI_L[X]])); }, dg: 4 },
  { n: "R26 Moegywara666", f: (c: string, p: string, p2: string) => { const X = +c[2]; const IDX = AI_I[X]; return Array.from(new Set([X, _0xc3c54e(X - 1), IDX, _0xc3c54e(IDX - 1)])); }, dg: 4 },
  { n: "R27 Moegywara666", f: (c: string, p: string, p2: string) => { const A = +c[0]; const K = +c[1]; return Array.from(new Set([_0xJ2d(A, K), _0xc3c54e(A + 1), _0xc3c54e(A + 2), AI_I[A]])); }, dg: 4 },
  { n: "R28 Moegywara666", f: (c: string, p: string, p2: string) => { const X = _0xJ2d(c[2], c[3]); const MB = AI_B[X]; return Array.from(new Set([X, MB, _0xc3c54e(MB + 2)])); }, dg: 3 },
  { n: "R29 Moegywara666", f: (c: string, p: string, p2: string) => { const X = +c[3]; return Array.from(new Set([X, _0xc3c54e(X - 1), _0xc3c54e(X - 2), _0xc3c54e(X + 3), _0xc3c54e(X + 4)])); }, dg: 5 },
  { n: "R30 Cosmic Chain", f: (c: string, p: string, p2: string) => { const X = (+c[0] + +c[2]) % 10; const MB = AI_B[X]; const IDX = AI_I[MB]; const ML = AI_L[IDX]; return Array.from(new Set([X, MB, IDX, ML])); }, dg: 4 },
  { n: "R31 Cipher Loop", f: (c: string, p: string, p2: string) => { const KOP = +c[1]; const EIDX = AI_I[+c[3]]; const sum = KOP + EIDX; const base = sum > 9 ? (Math.floor(sum / 10) + (sum % 10)) : sum; return Array.from(new Set([_0xc3c54e(base), _0xc3c54e(base + 2), _0xc3c54e(base + 4), _0xc3c54e(base + 6)])); }, dg: 4 },
  { n: "R32 Reverse Pulse", f: (c: string, p: string, p2: string) => { if (!p) return null; const X = +p[3]; return Array.from(new Set([_0xc3c54e(X), _0xc3c54e(X - 2), _0xc3c54e(X - 4), _0xc3c54e(X - 6), _0xc3c54e(X - 8)])); }, dg: 5 },
  { n: "R33 Mid Spiral", f: (c: string, p: string, p2: string) => { const biji = _0xJ2d(c[1], c[2]); const base = _0xc3c54e(biji - 1); return Array.from(new Set([base, _0xc3c54e(base + 1), _0xc3c54e(base + 3), _0xc3c54e(base + 4)])); }, dg: 4 },
  { n: "R34 Hex Surge", f: (c: string, p: string, p2: string) => { const biji = _0xJ2d(c[2], c[3]); const X = _0xc3c54e(biji + 6); return Array.from(new Set([X, _0xc3c54e(X + 2), _0xc3c54e(X + 3), _0xc3c54e(X + 7)])); }, dg: 4 },
  { n: "R35 Step Six", f: (c: string, p: string, p2: string) => { const X = _0xc3c54e(+c[3] - 1); return Array.from(new Set([X, _0xc3c54e(X + 1), _0xc3c54e(X + 2), _0xc3c54e(X + 3), _0xc3c54e(X + 4), _0xc3c54e(X + 5)])); }, dg: 6 },
  { n: "R36 Tail-State Transition Matrix", f: (c: string, p: string, p2: string) => [...AI_EKOR_MAIN[+c[3]]], dg: 6 },
  ...LEGACY_AI_FORMULAS,
];

function normalizeDigits(value: number[] | null): number[] {
  if (!value) return [];
  return [...new Set(value.filter((digit) => Number.isInteger(digit) && digit >= 0 && digit <= 9))];
}

function rate(hits: number, valid: number) {
  return valid > 0 ? hits / valid : 0;
}

function formulaQuality(formula: AiFormulaRanking) {
  return (
    OVERALL_QUALITY_WEIGHT * rate(formula.hits, formula.valid)
    + RECENT_QUALITY_WEIGHT * rate(formula.recentHits, formula.recentValid)
  );
}

function formulaSpecificity(formula: AiFormulaRanking) {
  if (formula.digits.length === 0) return 0;
  return Math.min(1, 3 / formula.digits.length);
}

function jaccardSimilarity(a: number[], b: number[]) {
  if (a.length === 0 || b.length === 0) return 0;
  const aSet = new Set(a);
  const bSet = new Set(b);
  let intersection = 0;
  aSet.forEach((digit) => {
    if (bSet.has(digit)) intersection++;
  });
  const union = new Set([...a, ...b]).size;
  return union > 0 ? intersection / union : 0;
}

function similarityFactor(similarity: number) {
  if (similarity >= 0.90) return 0.40;
  if (similarity >= 0.75) return 0.60;
  if (similarity >= 0.50) return 0.80;
  return 1.00;
}

function buildFormulaWeights(
  formulas: AiFormulaRanking[],
  tierWeight: number,
  referenceDigits: number[][] = [],
): WeightedFormula[] {
  const sorted = [...formulas].sort((a, b) => {
    const aBase = formulaQuality(a) * formulaSpecificity(a);
    const bBase = formulaQuality(b) * formulaSpecificity(b);
    if (bBase !== aBase) return bBase - aBase;
    if (b.hits !== a.hits) return b.hits - a.hits;
    if (b.recentHits !== a.recentHits) return b.recentHits - a.recentHits;
    return a.index - b.index;
  });

  const strongerPredictions = referenceDigits.filter((digits) => digits.length > 0).map((digits) => [...digits]);

  return sorted.map((formula) => {
    const maxSimilarity = strongerPredictions.reduce(
      (max, digits) => Math.max(max, jaccardSimilarity(formula.digits, digits)),
      0,
    );
    const duplicateFactor = similarityFactor(maxSimilarity);
    const specificity = formulaSpecificity(formula);
    const score = formulaQuality(formula) * specificity * tierWeight * duplicateFactor;
    const recentScore = rate(formula.recentHits, formula.recentValid) * specificity * tierWeight * duplicateFactor;

    strongerPredictions.push(formula.digits);
    return { formula, score, recentScore };
  });
}

function aggregateDigitSupport(weightedFormulas: WeightedFormula[], allowed?: Set<number>): DigitSupport[] {
  const support = new Map<number, DigitSupport>();

  weightedFormulas.forEach(({ formula, score, recentScore }) => {
    formula.digits.forEach((digit) => {
      if (allowed && !allowed.has(digit)) return;
      const current = support.get(digit) ?? { digit, vote: 0, score: 0, recentScore: 0 };
      current.vote += 1;
      current.score += score;
      current.recentScore += recentScore;
      support.set(digit, current);
    });
  });

  return [...support.values()];
}

function buildHistoryScores(D: string[], targetIndexes: number[]) {
  const scores: Record<number, number> = {};
  for (let digit = 0; digit <= 9; digit++) scores[digit] = 0;

  const recent = D.slice(-AI_RANKING_WINDOW);
  for (let offset = 0; offset < recent.length; offset++) {
    const result = recent[recent.length - 1 - offset];
    const weight = Math.pow(HISTORY_DECAY, offset);
    targetIndexes.forEach((index) => {
      const digit = parseInt(result[index]);
      if (Number.isInteger(digit)) scores[digit] += weight;
    });
  }

  return scores;
}

function sortPrimaryDigits(a: DigitSupport, b: DigitSupport, history: Record<number, number>) {
  if (b.vote !== a.vote) return b.vote - a.vote;
  if (b.score !== a.score) return b.score - a.score;
  if (b.recentScore !== a.recentScore) return b.recentScore - a.recentScore;
  if (history[b.digit] !== history[a.digit]) return history[b.digit] - history[a.digit];
  return a.digit - b.digit;
}

function sortExpansionDigits(a: DigitSupport, b: DigitSupport, history: Record<number, number>) {
  if (b.score !== a.score) return b.score - a.score;
  if (b.vote !== a.vote) return b.vote - a.vote;
  if (b.recentScore !== a.recentScore) return b.recentScore - a.recentScore;
  if (history[b.digit] !== history[a.digit]) return history[b.digit] - history[a.digit];
  return a.digit - b.digit;
}

/**
 * Walk-forward seluruh rumus dan simpan konteks ranking.
 * Vote publik tetap integer dan hanya berasal dari rumus utama:
 * elite, atau gap terbaik saat tidak ada elite.
 */
export function runAiValidation(
  D: string[],
  targetIndexes: number[] = [2, 3],
  thresholds?: Record<number, number>,
): AiValidation {
  const U = D.slice(-AI_RANKING_WINDOW);
  const vote: AiVote = {};
  for (let d = 0; d <= 9; d++) vote[d] = 0;

  const sr: AiRumusStat[] = [];
  const formulas: AiFormulaRanking[] = [];

  for (let r = 0; r < _0x9a025f.length; r++) {
    const rm = _0x9a025f[r];
    let hits = 0;
    let valid = 0;
    const outcomes: boolean[] = [];

    for (let i = 0; i < 14; i++) {
      const prev2 = U[i], prev = U[i + 1], curr = U[i + 2], tgt = U[i + 3];
      const ai = normalizeDigits(rm.f(curr, prev, prev2));
      if (ai.length === 0) continue;

      valid++;
      const hit = targetIndexes.some((index) => ai.includes(parseInt(tgt[index])));
      outcomes.push(hit);
      if (hit) hits++;
    }

    const thr = thresholdForDigitCount(rm.dg, thresholds);
    const lolos = hits >= thr;
    const recentOutcomes = outcomes.slice(-RECENT_VALIDATION_WINDOW);
    const recentHits = recentOutcomes.filter(Boolean).length;
    const digits = normalizeDigits(rm.f(D[D.length - 1], D[D.length - 2], D[D.length - 3]));

    sr.push({ name: rm.n, dg: rm.dg, hits, valid, thresh: thr, lolos });
    formulas.push({
      index: r,
      name: rm.n,
      dg: rm.dg,
      hits,
      valid,
      thresh: thr,
      lolos,
      gap: Math.max(0, thr - hits),
      recentHits,
      recentValid: recentOutcomes.length,
      digits,
    });
  }

  const elite = formulas.filter((formula) => formula.lolos && formula.digits.length > 0);
  const fallback = elite.length === 0;

  let primary = elite;
  let primaryGap = 0;

  if (fallback) {
    const available = formulas.filter((formula) => formula.digits.length > 0);
    primaryGap = available.length > 0 ? Math.min(...available.map((formula) => formula.gap)) : 0;
    primary = available.filter((formula) => formula.gap === primaryGap);
  }

  primary.forEach((formula) => {
    formula.digits.forEach((digit) => {
      vote[digit] += 1;
    });
  });

  const ranking: AiRankingContext = {
    formulas,
    primaryIndexes: primary.map((formula) => formula.index),
    primaryGap,
  };
  RANKING_BY_VOTE.set(vote, ranking);

  return {
    sr,
    vote,
    elitCount: primary.length,
    fallback,
    ranking,
  };
}

/**
 * Seleksi digit memakai dua mekanisme:
 *  - tie-breaker berbobot ketika kandidat utama berlebih;
 *  - expansion bertingkat ketika kandidat utama kurang.
 */
export function selectAiDigits(
  D: string[],
  vote: AiVote,
  param: number = 6,
  targetIndexes: number[] = [2, 3],
  ranking?: AiRankingContext,
): number[] {
  const targetCount = Math.max(0, Math.min(10, param));
  if (targetCount === 0) return [];

  const history = buildHistoryScores(D, targetIndexes);
  const activeRanking = ranking ?? RANKING_BY_VOTE.get(vote);

  if (!activeRanking || activeRanking.primaryIndexes.length === 0) {
    return Object.keys(vote)
      .map(Number)
      .sort((a, b) => {
        if (vote[b] !== vote[a]) return vote[b] - vote[a];
        if (history[b] !== history[a]) return history[b] - history[a];
        return a - b;
      })
      .slice(0, targetCount)
      .sort((a, b) => a - b);
  }

  const primaryIndexSet = new Set(activeRanking.primaryIndexes);
  const primaryFormulas = activeRanking.formulas.filter((formula) => primaryIndexSet.has(formula.index));
  const primaryWeights = buildFormulaWeights(primaryFormulas, 1);
  const primaryDigits = [...new Set(primaryFormulas.flatMap((formula) => formula.digits))];
  const primaryAllowed = new Set(primaryDigits);
  const primarySupport = aggregateDigitSupport(primaryWeights, primaryAllowed)
    .sort((a, b) => sortPrimaryDigits(a, b, history));

  if (primaryDigits.length >= targetCount) {
    return primarySupport
      .slice(0, targetCount)
      .map((item) => item.digit)
      .sort((a, b) => a - b);
  }

  const selected = new Set(primaryDigits);
  const strongerPredictions = primaryFormulas.map((formula) => formula.digits);

  for (let tier = 1; tier <= EXPANSION_TIER_WEIGHTS.length && selected.size < targetCount; tier++) {
    const gap = activeRanking.primaryGap + tier;
    const tierFormulas = activeRanking.formulas.filter(
      (formula) => !primaryIndexSet.has(formula.index) && formula.gap === gap && formula.digits.length > 0,
    );
    if (tierFormulas.length === 0) continue;

    const availableDigits = new Set(
      tierFormulas
        .flatMap((formula) => formula.digits)
        .filter((digit) => !selected.has(digit)),
    );

    const tierWeights = buildFormulaWeights(
      tierFormulas,
      EXPANSION_TIER_WEIGHTS[tier - 1],
      strongerPredictions,
    );
    strongerPredictions.push(...tierFormulas.map((formula) => formula.digits));

    const candidates = aggregateDigitSupport(tierWeights, availableDigits)
      .filter((item) => !selected.has(item.digit))
      .sort((a, b) => sortExpansionDigits(a, b, history));

    const slots = targetCount - selected.size;
    candidates.slice(0, slots).forEach((item) => selected.add(item.digit));
  }

  if (selected.size < targetCount) {
    const fallbackDigits = Array.from({ length: 10 }, (_, digit) => digit)
      .filter((digit) => !selected.has(digit))
      .sort((a, b) => {
        if (history[b] !== history[a]) return history[b] - history[a];
        return a - b;
      });

    const slots = targetCount - selected.size;
    fallbackDigits.slice(0, slots).forEach((digit) => selected.add(digit));
  }

  return [...selected].sort((a, b) => a - b);
}

/**
 * Wrapper backward-compat (dipakai rekapEngine). Validasi + seleksi sekali jalan.
 */
export function _0xEngineAI(D: string[], param: number = 6, options: AiEngineOptions = {}) {
  const targetIndexes = options.targetIndexes?.length ? options.targetIndexes : [2, 3];
  const validation = runAiValidation(D, targetIndexes, options.thresholds);
  return selectAiDigits(D, validation.vote, param, targetIndexes, validation.ranking);
}
