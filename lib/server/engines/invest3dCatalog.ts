import "server-only";

export const INVEST_3D_TARGET_MIN = 500;
export const INVEST_3D_TARGET_MAX = 600;
export const INVEST_3D_TARGET_IDEAL = 550;

export type Invest3DPair = "tengah" | "belakang";
export type Invest3DPosition = "kop" | "kepala" | "ekor";

export type Invest3DFilter =
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

type PositionMeta = { key: Invest3DPosition; label: string };

const POSITIONS: PositionMeta[] = [
  { key: "kop", label: "KOP" },
  { key: "kepala", label: "KPL" },
  { key: "ekor", label: "EKR" },
];

function buildInvest3DCatalog(): Invest3DCombo[] {
  const catalog: Invest3DCombo[] = [];

  const push = (
    id: string,
    label: string,
    expectedLines: number,
    filters: Invest3DFilter[],
    family: string,
  ) => {
    if (expectedLines < INVEST_3D_TARGET_MIN || expectedLines > INVEST_3D_TARGET_MAX) {
      throw new Error(`Katalog Invest 3D di luar target: ${id} = ${expectedLines}`);
    }
    catalog.push({ id, label, family, expectedLines, stability: 0, hitRate: 100, filters });
  };

  // Semua pola OFF posisi 1-3 yang secara matematis menghasilkan 500-600 line.
  for (let kop = 0; kop <= 3; kop += 1) {
    for (let kepala = 0; kepala <= 3; kepala += 1) {
      for (let ekor = 0; ekor <= 3; ekor += 1) {
        if (kop === 0 && kepala === 0 && ekor === 0) continue;
        const counts = [kop, kepala, ekor];
        const expectedLines = (10 - kop) * (10 - kepala) * (10 - ekor);
        if (expectedLines < INVEST_3D_TARGET_MIN || expectedLines > INVEST_3D_TARGET_MAX) continue;

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

        push(`3d-${ids.join("-")}`, labels.join(" + "), expectedLines, filters, "off_position");
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
  );

  const uniqueIds = new Set(catalog.map((combo) => combo.id));
  if (catalog.length !== 55 || uniqueIds.size !== catalog.length) {
    throw new Error(`Katalog Invest 3D tidak valid: ${catalog.length} resep, ${uniqueIds.size} ID unik`);
  }

  return catalog;
}

export const INVEST_3D_CATALOG = buildInvest3DCatalog();
