export type ShareOption = {
  key: string;
  mode: string;
  param: number;
  targetPair: string;
  analysisScope: string;
  updatedAt: string | null;
};

export type RekapSection = { label: string; lines: string[] };

export type ShareRow = {
  marketId: string | null;
  marketName: string | null;
  baseResult?: string | null;
  result?: unknown;
  updatedAt: string | null;
  order: number | null;
  sections?: RekapSection[];
};

export type ShareResponse = { rows: ShareRow[]; nextCursor?: number | null };
export type MarketOption = { id?: string | null; name?: string | null; order?: number | null; updated_at?: string | null };
export type PickItem = { key: string; label: string };
export type PickerKey = "jenis" | "target" | "output" | "";
