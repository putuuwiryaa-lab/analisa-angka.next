import type { Draw } from "../engine/types";

export const EXPERIMENT_X7_VERSION = "0.2";
export const EXPERIMENT_X7_HISTORY = 7;
export const EXPERIMENT_X7_DIGIT_COUNT = 7;

const POSITION_INDEXES = [2, 3] as const;
const RECENCY_WEIGHTS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const DELTA_WEIGHTS = [1, 2, 3, 4, 5, 7] as const;
const HISTORY_SCORE_CAP = 4;
const UNCONFIRMED_REPEAT_PENALTY = 2;

export type ExperimentX7Digit = {
  digit: number;
  score: number;
  momentumHits: number;
  latestIndex: number;
  positionSupport: number;
};

export type ExperimentX7Result = {
  history: Draw[];
  ranking: ExperimentX7Digit[];
  candidates: number[][];
};

type MutableDigitScore = ExperimentX7Digit & {
  supportMask: number;
};

function circularDelta(from: number, to: number): number {
  return ((to - from + 15) % 10) - 5;
}

function addScore(states: MutableDigitScore[], digit: number, score: number): void {
  states[digit].score += score;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function roundedAverage(value: number): number {
  return value < 0 ? -Math.round(Math.abs(value)) : Math.round(value);
}

function dominantDelta(deltas: number[]): number {
  const aggregate = new Map<number, { score: number; latest: number }>();
  deltas.forEach((delta, index) => {
    const current = aggregate.get(delta) ?? { score: 0, latest: -1 };
    current.score += DELTA_WEIGHTS[index] ?? 1;
    current.latest = index;
    aggregate.set(delta, current);
  });

  return [...aggregate.entries()]
    .sort(([deltaA, a], [deltaB, b]) => (
      b.score - a.score ||
      b.latest - a.latest ||
      Math.abs(deltaA) - Math.abs(deltaB) ||
      deltaB - deltaA
    ))[0]?.[0] ?? 0;
}

export function runExperimentX7(draws: Draw[]): ExperimentX7Result {
  if (draws.length < EXPERIMENT_X7_HISTORY) {
    throw new Error(`Data tidak cukup: Experiment X7 membutuhkan minimal ${EXPERIMENT_X7_HISTORY} result.`);
  }

  const history = draws.slice(-EXPERIMENT_X7_HISTORY);
  if (history.some((draw) => !/^\d{4}$/.test(draw))) {
    throw new Error("Experiment X7 hanya menerima result 4 digit.");
  }

  const states: MutableDigitScore[] = Array.from({ length: 10 }, (_, digit) => ({
    digit,
    score: 0,
    momentumHits: 0,
    latestIndex: -1,
    positionSupport: 0,
    supportMask: 0,
  }));
  const historyScores = new Array<number>(10).fill(0);
  const projectedDigits = new Set<number>();

  POSITION_INDEXES.forEach((positionIndex, positionOffset) => {
    const values = history.map((draw) => Number(draw[positionIndex]));

    values.forEach((digit, index) => {
      historyScores[digit] += RECENCY_WEIGHTS[index] ?? 0;
      states[digit].latestIndex = Math.max(states[digit].latestIndex, index);
      states[digit].supportMask |= 1 << positionOffset;
    });

    const deltas = values.slice(1).map((value, index) => circularDelta(values[index], value));
    const latest = values[values.length - 1];
    const latestDelta = deltas[deltas.length - 1];

    const momentum = (latest + latestDelta + 10) % 10;
    addScore(states, momentum, 9);
    states[momentum].momentumHits += 1;
    projectedDigits.add(momentum);

    const dominant = (latest + dominantDelta(deltas) + 10) % 10;
    addScore(states, dominant, 7);
    projectedDigits.add(dominant);

    const recent = deltas.slice(-3);
    const averageDelta = roundedAverage((2 * recent[0] + 3 * recent[1] + 5 * recent[2]) / 10);
    const average = (latest + averageDelta + 10) % 10;
    addScore(states, average, 5);
    projectedDigits.add(average);

    const previousDelta = deltas[deltas.length - 2];
    const acceleration = clamp(latestDelta - previousDelta, -2, 2);
    const accelerationCandidate = (latest + latestDelta + acceleration + 20) % 10;
    addScore(states, accelerationCandidate, 3);
    projectedDigits.add(accelerationCandidate);
  });

  historyScores.forEach((score, digit) => {
    addScore(states, digit, Math.min(score, HISTORY_SCORE_CAP));
  });

  const previous = history[history.length - 2];
  const latest = history[history.length - 1];
  const previousKpl = Number(previous[2]);
  const previousEkr = Number(previous[3]);
  const latestKpl = Number(latest[2]);
  const latestEkr = Number(latest[3]);

  if (previousKpl === latestEkr) addScore(states, latestEkr, 2);
  if (previousEkr === latestKpl) addScore(states, latestKpl, 2);
  if (latestKpl === latestEkr) addScore(states, latestKpl, 2);

  const latestAs = Number(latest[0]);
  const latestCop = Number(latest[1]);
  addScore(states, latestAs, 0.5);
  addScore(states, latestCop, 0.75);
  if (projectedDigits.has(latestAs)) addScore(states, latestAs, 0.5);
  if (projectedDigits.has(latestCop)) addScore(states, latestCop, 0.5);

  new Set([latestKpl, latestEkr]).forEach((digit) => {
    if (!projectedDigits.has(digit)) {
      addScore(states, digit, -UNCONFIRMED_REPEAT_PENALTY);
    }
  });

  states.forEach((state) => {
    state.positionSupport = (state.supportMask & 1 ? 1 : 0) + (state.supportMask & 2 ? 1 : 0);
  });

  const ranking = states
    .map(({ supportMask: _supportMask, ...state }) => state)
    .sort((a, b) => (
      b.score - a.score ||
      b.momentumHits - a.momentumHits ||
      b.latestIndex - a.latestIndex ||
      b.positionSupport - a.positionSupport ||
      a.digit - b.digit
    ));

  const bbfs = ranking.slice(0, EXPERIMENT_X7_DIGIT_COUNT).map((item) => item.digit);

  return {
    history,
    ranking,
    candidates: [bbfs],
  };
}
