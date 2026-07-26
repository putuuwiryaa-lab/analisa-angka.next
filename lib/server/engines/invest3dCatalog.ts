import "server-only";

export const INVEST_3D_TARGET_MIN = 500;
export const INVEST_3D_TARGET_MAX = 600;
export const INVEST_3D_TARGET_IDEAL = 550;

export type Invest3DPair = "tengah" | "belakang";
export type Invest3DPosition = "kop" | "kepala" | "ekor";

export type Invest3DFilter =
  | { kind: "ai_3d"; param: 5 }
  | { kind: "ai_3d_parity"; param: 1 }
  | { kind: "ai_3d_size"; param: 1 }
  | { kind: "ai_pair"; pair: Invest3DPair; param: 4 | 6 }
  | { kind: "parity_pair"; pair: Invest3DPair; param: 1 }
  | { kind: "size_pair"; pair: Invest3DPair; param: 1 }
  | { kind: "bbfs_3d"; param: 8 | 10 }
  | { kind: "bbfs_pair"; pair: Invest3DPair; param: 8 | 9 | 10 }
  | { kind: "off_position"; position: Invest3DPosition; param: 1 | 2 | 3 };

export interface Invest3DCombo {
  id: string;
  label: string;
  family: string;
  expectedLines: number;
  stability: number;
  hitRate: number;
  filters: Invest3DFilter[];
}

type OffCounts = [number, number, number];
type PositionMeta = { key: Invest3DPosition; label: string };

const POSITIONS: PositionMeta[] = [
  { key: "kop", label: "KOP" },
  { key: "kepala", label: "KPL" },
  { key: "ekor", label: "EKR" },
];

function offParts(counts: OffCounts) {
  const filters: Invest3DFilter[] = [];
  const labels: string[] = [];
  const ids: string[] = [];

  POSITIONS.forEach((position, index) => {
    const param = counts[index];
    if (param < 1 || param > 3) return;
    filters.push({ kind: "off_position", position: position.key, param: param as 1 | 2 | 3 });
    labels.push(`OFF ${position.label} ${param}`);
    ids.push(`off-${position.key}${param}`);
  });

  return { filters, labels, ids };
}

function ai3dFiveRange(counts: OffCounts) {
  const total = counts.reduce((value, count) => value * (10 - count), 1);
  const values: number[] = [];

  for (let kopOverlap = 0; kopOverlap <= Math.min(counts[0], 5); kopOverlap += 1) {
    for (let kepalaOverlap = 0; kepalaOverlap <= Math.min(counts[1], 5); kepalaOverlap += 1) {
      for (let ekorOverlap = 0; ekorOverlap <= Math.min(counts[2], 5); ekorOverlap += 1) {
        const noAi =
          (5 - counts[0] + kopOverlap) *
          (5 - counts[1] + kepalaOverlap) *
          (5 - counts[2] + ekorOverlap);
        values.push(total - noAi);
      }
    }
  }

  return { min: Math.min(...values), max: Math.max(...values) };
}

function buildInvest3DCatalog(): Invest3DCombo[] {
  const catalog: Invest3DCombo[] = [];

  const push = (
    id: string,
    label: string,
    expectedLines: number,
    filters: Invest3DFilter[],
    family: string,
    stability = 0,
  ) => {
    if (expectedLines < INVEST_3D_TARGET_MIN || expectedLines > INVEST_3D_TARGET_MAX) {
      throw new Error(`Katalog Invest 3D di luar target: ${id} = ${expectedLines}`);
    }
    catalog.push({ id, label, family, expectedLines, stability, hitRate: 100, filters });
  };

  // 19 pola OFF posisi yang selalu menghasilkan 500-600 line.
  for (let kop = 0; kop <= 3; kop += 1) {
    for (let kepala = 0; kepala <= 3; kepala += 1) {
      for (let ekor = 0; ekor <= 3; ekor += 1) {
        if (kop === 0 && kepala === 0 && ekor === 0) continue;
        const counts: OffCounts = [kop, kepala, ekor];
        const expectedLines = (10 - kop) * (10 - kepala) * (10 - ekor);
        if (expectedLines < INVEST_3D_TARGET_MIN || expectedLines > INVEST_3D_TARGET_MAX) continue;
        const parts = offParts(counts);
        push(`3d-${parts.ids.join("-")}`, parts.labels.join(" + "), expectedLines, parts.filters, "off_position");
      }
    }
  }

  // AI 3D berbasis himpunan lima digit: 12 pola OFF aman × 3 metode global.
  const globalAiFilters: Array<{
    id: string;
    label: string;
    family: string;
    filter: Invest3DFilter;
  }> = [
    { id: "ai5", label: "AI 3D 5", family: "ai_3d", filter: { kind: "ai_3d", param: 5 } },
    {
      id: "parity",
      label: "Ganjil Genap 3D",
      family: "ai_3d_parity",
      filter: { kind: "ai_3d_parity", param: 1 },
    },
    {
      id: "size",
      label: "Besar Kecil 3D",
      family: "ai_3d_size",
      filter: { kind: "ai_3d_size", param: 1 },
    },
  ];

  for (let kop = 0; kop <= 3; kop += 1) {
    for (let kepala = 0; kepala <= 3; kepala += 1) {
      for (let ekor = 0; ekor <= 3; ekor += 1) {
        const counts: OffCounts = [kop, kepala, ekor];
        const range = ai3dFiveRange(counts);
        if (range.min < INVEST_3D_TARGET_MIN || range.max > INVEST_3D_TARGET_MAX) continue;
        const parts = offParts(counts);
        const expectedLines = (range.min + range.max) / 2;
        const stability = (range.max - range.min) / 2;

        for (const method of globalAiFilters) {
          push(
            `3d-${method.id}-${parts.ids.join("-")}`,
            `${method.label} + ${parts.labels.join(" + ")}`,
            expectedLines,
            [method.filter, ...parts.filters],
            method.family,
            stability,
          );
        }
      }
    }
  }

  // Global BBFS delapan digit selalu menghasilkan 8³ = 512 line.
  push("3d-bbfs8", "BBFS 3D 8", 512, [{ kind: "bbfs_3d", param: 8 }], "global_bbfs");
  push("3d-bbfs-ggbk", "BBFS 3D GGBK", 512, [{ kind: "bbfs_3d", param: 10 }], "global_bbfs");

  const pairDefinitions: Array<{
    pair: Invest3DPair;
    pairLabel: string;
    outer: Invest3DPosition;
    outerLabel: string;
  }> = [
    { pair: "tengah", pairLabel: "Tengah", outer: "ekor", outerLabel: "EKR" },
    { pair: "belakang", pairLabel: "Belakang", outer: "kop", outerLabel: "KOP" },
  ];

  for (const definition of pairDefinitions) {
    const { pair, pairLabel, outer, outerLabel } = definition;

    // AI 4 menerima 64 pasangan; dikali 9 atau 8 digit posisi luar.
    for (const off of [1, 2] as const) {
      push(
        `3d-ai-${pair}4-off-${outer}${off}`,
        `AI ${pairLabel} 4 + OFF ${outerLabel} ${off}`,
        64 * (10 - off),
        [
          { kind: "ai_pair", pair, param: 4 },
          { kind: "off_position", position: outer, param: off },
        ],
        "pair_ai",
      );
    }

    // AI 6 menerima 84 pasangan; dikali tujuh digit posisi luar.
    push(
      `3d-ai-${pair}6-off-${outer}3`,
      `AI ${pairLabel} 6 + OFF ${outerLabel} 3`,
      84 * 7,
      [
        { kind: "ai_pair", pair, param: 6 },
        { kind: "off_position", position: outer, param: 3 },
      ],
      "pair_ai",
    );

    // Ganjil/genap dan besar/kecil menerima 75 pasangan.
    for (const off of [2, 3] as const) {
      push(
        `3d-parity-${pair}-off-${outer}${off}`,
        `Ganjil Genap ${pairLabel} + OFF ${outerLabel} ${off}`,
        75 * (10 - off),
        [
          { kind: "parity_pair", pair, param: 1 },
          { kind: "off_position", position: outer, param: off },
        ],
        "pair_parity",
      );
      push(
        `3d-size-${pair}-off-${outer}${off}`,
        `Besar Kecil ${pairLabel} + OFF ${outerLabel} ${off}`,
        75 * (10 - off),
        [
          { kind: "size_pair", pair, param: 1 },
          { kind: "off_position", position: outer, param: off },
        ],
        "pair_size",
      );
    }

    // BBFS 8 dan GGBK membentuk 64 pasangan; BBFS 9 membentuk 81 pasangan.
    for (const param of [8, 10] as const) {
      const name = param === 10 ? "GGBK" : "8";
      for (const off of [1, 2] as const) {
        push(
          `3d-bbfs-${pair}${name.toLowerCase()}-off-${outer}${off}`,
          `BBFS ${pairLabel} ${name} + OFF ${outerLabel} ${off}`,
          64 * (10 - off),
          [
            { kind: "bbfs_pair", pair, param },
            { kind: "off_position", position: outer, param: off },
          ],
          "pair_bbfs",
        );
      }
    }

    push(
      `3d-bbfs-${pair}9-off-${outer}3`,
      `BBFS ${pairLabel} 9 + OFF ${outerLabel} 3`,
      81 * 7,
      [
        { kind: "bbfs_pair", pair, param: 9 },
        { kind: "off_position", position: outer, param: 3 },
      ],
      "pair_bbfs",
    );
  }

  // Silang BBFS 9 dengan himpunan delapan digit selalu 504 atau 576 line.
  for (const right of [8, 10] as const) {
    const rightName = right === 10 ? "GGBK" : "8";
    push(
      `3d-bbfs-tengah9-bbfs-belakang${rightName.toLowerCase()}`,
      `BBFS Tengah 9 + BBFS Belakang ${rightName}`,
      540,
      [
        { kind: "bbfs_pair", pair: "tengah", param: 9 },
        { kind: "bbfs_pair", pair: "belakang", param: right },
      ],
      "cross_pair",
      36,
    );
    push(
      `3d-bbfs-tengah${rightName.toLowerCase()}-bbfs-belakang9`,
      `BBFS Tengah ${rightName} + BBFS Belakang 9`,
      540,
      [
        { kind: "bbfs_pair", pair: "tengah", param: right },
        { kind: "bbfs_pair", pair: "belakang", param: 9 },
      ],
      "cross_pair",
      36,
    );
  }

  // AI 6 pada satu pasangan dan BBFS delapan digit pada pasangan lain menghasilkan 512-576 line.
  for (const bbfs of [8, 10] as const) {
    const bbfsName = bbfs === 10 ? "GGBK" : "8";
    push(
      `3d-ai-tengah6-bbfs-belakang${bbfsName.toLowerCase()}`,
      `AI Tengah 6 + BBFS Belakang ${bbfsName}`,
      544,
      [
        { kind: "ai_pair", pair: "tengah", param: 6 },
        { kind: "bbfs_pair", pair: "belakang", param: bbfs },
      ],
      "cross_pair",
      32,
    );
    push(
      `3d-bbfs-tengah${bbfsName.toLowerCase()}-ai-belakang6`,
      `BBFS Tengah ${bbfsName} + AI Belakang 6`,
      544,
      [
        { kind: "bbfs_pair", pair: "tengah", param: bbfs },
        { kind: "ai_pair", pair: "belakang", param: 6 },
      ],
      "cross_pair",
      32,
    );
  }

  // Silang parity dan size selalu menghasilkan 550 atau 575 line.
  push(
    "3d-parity-tengah-size-belakang",
    "Ganjil Genap Tengah + Besar Kecil Belakang",
    562.5,
    [
      { kind: "parity_pair", pair: "tengah", param: 1 },
      { kind: "size_pair", pair: "belakang", param: 1 },
    ],
    "cross_pair",
    12.5,
  );
  push(
    "3d-size-tengah-parity-belakang",
    "Besar Kecil Tengah + Ganjil Genap Belakang",
    562.5,
    [
      { kind: "size_pair", pair: "tengah", param: 1 },
      { kind: "parity_pair", pair: "belakang", param: 1 },
    ],
    "cross_pair",
    12.5,
  );

  const uniqueIds = new Set(catalog.map((combo) => combo.id));
  if (catalog.length !== 91 || uniqueIds.size !== catalog.length) {
    throw new Error(`Katalog Invest 3D tidak valid: ${catalog.length} resep, ${uniqueIds.size} ID unik`);
  }

  return catalog;
}

export const INVEST_3D_CATALOG = buildInvest3DCatalog();
