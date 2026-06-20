import "server-only";
import { _0xJ2d } from './tables';
import { _0x3ca571, RM_NAMES } from './offFormula';
import { _0xEngineJumlahMati } from './jumlahEngine';
import { _0x2d4get, _0xRumusShio, SHIO_RUMUS_NAMES, _0xEngineShioMati } from './shioEngine';
import { runAiValidation, selectAiDigits } from './aiEngine';
import { runMatiPos, type MatiPosResult } from './matiEngine';
import { runRekap } from './rekapEngine';

type AiVote = Record<number, number>;
type TargetPair = 'depan' | 'tengah' | 'belakang';
type AnalysisScope = 'default' | '4d' | '3d' | '2d_depan' | '2d_tengah' | '2d_belakang';
type RunAnalysisOptions = { analysisScope?: AnalysisScope; targetPair?: TargetPair; forceDigitResult?: boolean };

const BBFS_GGBK_PARAM = 10;
const ALL_DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const BBFS_GGBK_DIGITS: Record<string, number[]> = {
  'GENAP|BESAR': [0, 2, 4, 5, 6, 7, 8, 9],
  'GENAP|KECIL': [0, 1, 2, 3, 4, 6, 8],
  'GANJIL|BESAR': [1, 3, 5, 6, 7, 8, 9],
  'GANJIL|KECIL': [0, 1, 2, 3, 4, 5, 7, 9],
};

function pairTargetIndexes(targetPair: TargetPair = 'belakang') {
  if (targetPair === 'depan') return [0, 1];
  if (targetPair === 'tengah') return [1, 2];
  return [2, 3];
}

function aiTargetIndexes(scope: AnalysisScope = 'default', targetPair: TargetPair = 'belakang') {
  if (scope === '4d') return [0, 1, 2, 3];
  if (scope === '3d') return [1, 2, 3];
  if (scope === '2d_depan') return [0, 1];
  if (scope === '2d_tengah') return [1, 2];
  if (scope === '2d_belakang') return [2, 3];
  return pairTargetIndexes(targetPair);
}

function jumlahTarget(result: string, targetPair: TargetPair = 'belakang') {
  const [a, b] = pairTargetIndexes(targetPair);
  return _0xJ2d(result[a], result[b]);
}

function aiThresholds(scope: AnalysisScope = 'default'): Record<number, number> {
  if (scope === '4d') return { 3: 12, 4: 13, 5: 14, 6: 14 };
  if (scope === '3d') return { 3: 11, 4: 12, 5: 13, 6: 14 };
  return { 3: 10, 4: 11, 5: 12, 6: 13 };
}

function topVoteDigit(vote: AiVote) {
  return Object.keys(vote)
    .map((k) => ({ d: parseInt(k), v: vote[parseInt(k)] }))
    .sort((a, b) => (b.v !== a.v ? b.v - a.v : a.d - b.d))[0]?.d ?? 0;
}

function buildAiParity(vote: AiVote) {
  const evenVote = vote[0] + vote[2] + vote[4] + vote[6] + vote[8];
  const oddVote = vote[1] + vote[3] + vote[5] + vote[7] + vote[9];
  const tieDigit = topVoteDigit(vote);
  const dominant = evenVote > oddVote ? 'GENAP' : oddVote > evenVote ? 'GANJIL' : tieDigit % 2 === 0 ? 'GENAP' : 'GANJIL';
  return { dominant, evenVote, oddVote };
}

function buildAiSize(vote: AiVote) {
  const smallVote = vote[0] + vote[1] + vote[2] + vote[3] + vote[4];
  const bigVote = vote[5] + vote[6] + vote[7] + vote[8] + vote[9];
  const tieDigit = topVoteDigit(vote);
  const dominant = bigVote > smallVote ? 'BESAR' : smallVote > bigVote ? 'KECIL' : tieDigit >= 5 ? 'BESAR' : 'KECIL';
  return { dominant, bigVote, smallVote };
}

function buildBbfsGgbk(vote: AiVote, parity: string, size: string) {
  const key = `${parity}|${size}`;
  const baseDigits = [...(BBFS_GGBK_DIGITS[key] || [])].sort((a, b) => a - b);
  const missingDigits = ALL_DIGITS.filter((digit) => !baseDigits.includes(digit));
  const rescueDigit =
    baseDigits.length < 8
      ? [...missingDigits].sort((a, b) => (vote[b] !== vote[a] ? vote[b] - vote[a] : a - b))[0] ?? null
      : null;
  const finalDigits = [...new Set(rescueDigit === null ? baseDigits : [...baseDigits, rescueDigit])].sort((a, b) => a - b);

  return {
    label: `${parity} × ${size}`,
    baseDigits,
    missingDigits,
    rescueDigit,
    finalDigits,
    rescueSource: rescueDigit === null ? null : 'ai_vote',
  };
}

export function runAnalysis(type: string, payload: string[], param: number, options: RunAnalysisOptions = {}) {
  const D = payload;
  const U = D.slice(-17);
  const analysisScope = options.analysisScope || 'default';
  const targetPair = options.targetPair || 'belakang';
  const forceDigitResult = options.forceDigitResult === true;

  if (type === 'rekap') {
    return runRekap(D, param);
  }

  if (type === 'ai' || type === 'ai_parity' || type === 'ai_size') {
    const targetIndexes = aiTargetIndexes(analysisScope, targetPair);
    const thresholds = aiThresholds(analysisScope);

    // Validasi BERAT dijalankan SEKALI; vote dipakai bersama untuk
    // seleksi digit, ganjil/genap, dan besar/kecil.
    const { sr, elitCount, vote, fallback } = runAiValidation(D, targetIndexes, thresholds);

    const isBbfsGgbk = forceDigitResult && param === BBFS_GGBK_PARAM;
    const aiResultParam = isBbfsGgbk ? 8 : forceDigitResult ? param : type === 'ai' && param !== 7 && param !== 8 ? param : 6;
    const aiResult = selectAiDigits(D, vote, aiResultParam, targetIndexes);
    const parity = buildAiParity(vote);
    const size = buildAiSize(vote);
    const stats = sr.filter(s => s.lolos);

    if (isBbfsGgbk) {
      const bbfsGgbk = buildBbfsGgbk(vote, parity.dominant, size.dominant);
      return {
        success: true,
        data: {
          stats,
          elitCount,
          fallback,
          result: bbfsGgbk.finalDigits,
          parity,
          size,
          sourceResult: aiResult,
          bbfsGgbk,
          displayLabel: 'BBFS GGBK 8D',
          evaluationMode: 'bbfs',
          evaluationParam: BBFS_GGBK_PARAM,
        },
      };
    }

    if (!forceDigitResult && (type === 'ai_parity' || (type === 'ai' && param === 7))) {
      return { success: true, data: { stats, elitCount, fallback, result: [parity.dominant], parity, sourceResult: aiResult, displayLabel: 'GANJIL GENAP', evaluationMode: 'ai_parity', evaluationParam: 1 } };
    }

    if (!forceDigitResult && (type === 'ai_size' || (type === 'ai' && param === 8))) {
      return { success: true, data: { stats, elitCount, fallback, result: [size.dominant], size, sourceResult: aiResult, displayLabel: 'BESAR KECIL', evaluationMode: 'ai_size', evaluationParam: 1 } };
    }

    return {
      success: true,
      data: { stats, elitCount, fallback, result: aiResult, parity, size }
    };
  }

  if (type === 'mati') {
    // Satu engine bersama dengan Rekap — sudah termasuk fallback.
    const POS = [
      { n: 'AS', x: 0 }, { n: 'KOP', x: 1 }, { n: 'KEPALA', x: 2 }, { n: 'EKOR', x: 3 },
    ];
    const posResults: Record<string, MatiPosResult> = {};
    POS.forEach((p) => {
      posResults[p.n] = runMatiPos(D, p.x, param);
    });
    return { success: true, data: posResults };
  }

  if (type === 'jumlah') {
    const SA: Record<string, number> = {};
    const MK = Object.keys(_0x3ca571('0000', '0000'));
    MK.forEach(k => { SA[k] = 0; });
    for (let i = 0; i < 14; i++) {
      const pr: any = _0x3ca571(U[i], U[i + 1]), tg = U[i + 2];
      const j2d = jumlahTarget(tg, targetPair);
      MK.forEach(k => { if (pr[k] !== j2d) SA[k] += 1; });
    }

    const ljList = _0xEngineJumlahMati(D, param, targetPair);
    const FP: any = _0x3ca571(D[D.length - 2], D[D.length - 1]);
    const stats: any[] = [];

    MK.forEach((k, idx) => {
      if (SA[k] >= 14 && ljList.includes(String(FP[k]))) {
        stats.push({ name: RM_NAMES[idx], score: SA[k], lolos: true });
      }
    });

    let el = MK.filter(k => SA[k] >= 14);
    if (el.length === 0) {
      const mx = Math.max(...MK.map(k => SA[k]));
      el = MK.filter(k => SA[k] === mx);
    }
    const eliteCount = el.filter(k => ljList.includes(String(FP[k]))).length;

    return { success: true, data: { result: ljList, stats, eliteTotal: el.length, supportCount: eliteCount } };
  }

  if (type === 'shio') {
    const SA: Record<string, number> = {};
    const MK = Object.keys(_0xRumusShio('0000', '0000'));
    MK.forEach(k => { SA[k] = 0; });
    for (let i = 0; i < 14; i++) {
      const pr: any = _0xRumusShio(U[i], U[i + 1]), sh = _0x2d4get(U[i + 2], targetPair);
      MK.forEach(k => { if (pr[k] !== sh) SA[k] += 1; });
    }

    const ls = _0xEngineShioMati(D, param, targetPair);
    const FP: any = _0xRumusShio(D[D.length - 2], D[D.length - 1]);
    const stats: any[] = [];
    const offResults = Array.isArray(ls) ? ls : [ls];

    MK.forEach((k, idx) => {
      if (SA[k] >= 14 && offResults.includes(FP[k])) {
        stats.push({ name: SHIO_RUMUS_NAMES[idx], score: SA[k], lolos: true });
      }
    });

    let el = MK.filter(k => SA[k] >= 14);
    if (el.length === 0) {
      const mx = Math.max(...MK.map(k => SA[k]));
      el = MK.filter(k => SA[k] === mx);
    }

    let support = 0;
    const ct: Record<number, number> = {};
    el.forEach(k => { const v = FP[k]; ct[v] = (ct[v] || 0) + 1; });
    offResults.forEach((h: number) => { support += (ct[h] || 0); });

    return { success: true, data: { result: ls, stats, eliteTotal: el.length, supportCount: support } };
  }

  return { success: false, message: "Type not supported yet" };
}