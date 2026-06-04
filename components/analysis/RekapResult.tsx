import { Copy, Grid3X3 } from "lucide-react";
import { safeArray } from "@/lib/analysis/utils";
import {
  customFocusPairs,
  customFocusPositionLabels,
  customFocusPositions,
  customFocusToBBFSScope,
  type TargetPair,
} from "@/lib/analysis/customDigit";

type ResultData = Record<string, any>;

const pairLabel: Record<TargetPair, string> = {
  depan: "DEPAN",
  tengah: "TENGAH",
  belakang: "BELAKANG",
};

function formatValue(value: any, pad = false) {
  return safeArray(value)
    .map((item) => (pad ? String(item).padStart(2, "0") : String(item)))
    .join(" . ");
}

function formatCompact(value: any) {
  return safeArray(value)
    .map((item) => String(item))
    .join("");
}

function bbfsLabelFromFocus(focus: any) {
  const scope = customFocusToBBFSScope(focus);
  if (scope === "4d") return "BBFS 4D";
  if (scope === "3d") return "BBFS 3D";
  if (scope === "2d_depan") return "BBFS DEPAN";
  if (scope === "2d_tengah") return "BBFS TENGAH";
  return "BBFS BELAKANG";
}

// Warna per-baris adalah encoding jenis data (bukan accent mode) — dipertahankan.
type Row = [string, string, string, string, string];

function customRows(result: ResultData): Row[] {
  const focus = result?.customFocus || result?.focus || "belakang";
  const pairs = customFocusPairs(focus);
  const positions = customFocusPositions(focus);
  const rows: Row[] = [];

  if (safeArray(result.ai3d).length) rows.push(["AI 3D", formatCompact(result.ai3d), "🔥", "#f3c14b", "emoji"]);
  if (result.ai3dParity) rows.push(["GENAP/GANJIL 3D", String(result.ai3dParity), "⚖️", "#34d399", "emoji"]);
  if (result.ai3dSize) rows.push(["BESAR/KECIL 3D", String(result.ai3dSize), "📐", "#38bdf8", "emoji"]);
  if (safeArray(result.ai4d).length) rows.push(["AI 4D", formatCompact(result.ai4d), "🔥", "#f3c14b", "emoji"]);

  pairs.forEach((pair) => {
    if (safeArray(result.aiByPair?.[pair]).length)
      rows.push([`AI ${pairLabel[pair]}`, formatCompact(result.aiByPair[pair]), "🔥", "#f3c14b", "emoji"]);
    if (result.aiParityByPair?.[pair])
      rows.push([`GENAP/GANJIL ${pairLabel[pair]}`, String(result.aiParityByPair[pair]), "⚖️", "#34d399", "emoji"]);
    if (result.aiSizeByPair?.[pair])
      rows.push([`BESAR/KECIL ${pairLabel[pair]}`, String(result.aiSizeByPair[pair]), "📐", "#38bdf8", "emoji"]);
  });

  if (safeArray(result.bbfsGlobal).length) {
    rows.push([bbfsLabelFromFocus(focus), formatCompact(result.bbfsGlobal), "bbfs", "#ff9f43", "bbfs"]);
  }

  pairs.forEach((pair) => {
    if (safeArray(result.bbfsByPair?.[pair]).length)
      rows.push([`BBFS ${pairLabel[pair]}`, formatCompact(result.bbfsByPair[pair]), "bbfs", "#ff9f43", "bbfs"]);
  });

  positions.forEach((position) => {
    const key =
      position === "as" ? "offAs" : position === "kop" ? "offKop" : position === "kepala" ? "offKepala" : "offEkor";
    if (safeArray(result[key]).length)
      rows.push([`OFF ${customFocusPositionLabels[position]}`, formatValue(result[key]), "🎯", "#ff647c", "emoji"]);
  });

  pairs.forEach((pair) => {
    if (safeArray(result.jumlahByPair?.[pair]).length)
      rows.push([`OFF JML ${pairLabel[pair]}`, formatValue(result.jumlahByPair[pair]), "🔢", "#b58cff", "emoji"]);
    if (safeArray(result.shioByPair?.[pair]).length)
      rows.push([`OFF SHIO ${pairLabel[pair]}`, formatValue(result.shioByPair[pair], true), "🐲", "#28d7ff", "emoji"]);
  });

  return rows;
}

function RowIcon({ icon, color, type }: { icon: string; color: string; type?: string }) {
  if (type === "bbfs") {
    return (
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border"
        style={{ borderColor: `${color}66`, backgroundColor: `${color}18`, color }}
      >
        <Grid3X3 size={16} strokeWidth={2.4} />
      </span>
    );
  }
  return <span className="flex h-7 w-7 shrink-0 items-center justify-center text-xl leading-none">{icon}</span>;
}

export function RekapResult({ result }: { result: ResultData }) {
  const lines = safeArray(result.lines);
  const displayLines = lines.join(" * ");
  const copyLines = lines.join("*");
  const rows = customRows(result);

  return (
    <div className="animate-rise space-y-4">
      <div className="animate-rise rounded-2xl border border-border-soft bg-surface p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-text-soft">Hasil Rekap</p>
            <h3 className="display text-lg text-text">Mode Custom Digit</h3>
          </div>
          <span className="accent-bg-soft accent-text rounded-full px-3 py-1 text-[11px] font-black">READY</span>
        </div>
        <div className="space-y-3">
          {rows.length ? (
            rows.map(([label, value, icon, color, iconType], index) => (
              <div
                key={`${label}-${index}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border-soft bg-surface-2 p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <RowIcon icon={icon} color={color} type={iconType} />
                  <span className="min-w-0 text-xs font-bold uppercase tracking-wide text-text-soft">{label}</span>
                </div>
                <span
                  className="display max-w-[54%] truncate text-right text-xs"
                  style={{ color }}
                >
                  {value}
                </span>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-border-soft bg-surface-2 p-4 text-center text-[11px] font-bold uppercase tracking-wide text-text-muted">
              Filter yang dipilih belum terbaca pada hasil ini.
            </div>
          )}
        </div>
      </div>

      <div className="animate-rise space-y-3 rounded-2xl border border-border-soft bg-surface p-4">
        <div className="flex items-center justify-between">
          <span className="display text-xs text-text">Generate Lines</span>
          <span className="accent-bg-soft accent-text rounded-full px-3 py-1 text-[11px] font-black">
            {lines.length} LINE
          </span>
        </div>
        <div className="num accent-text max-h-[260px] overflow-y-auto rounded-2xl border border-border-soft bg-black/30 p-4 text-sm font-bold leading-8">
          {displayLines}
        </div>
        <button
          onClick={() => navigator.clipboard?.writeText(copyLines)}
          className="accent-bg-soft accent-text flex w-full items-center justify-center gap-2 rounded-2xl p-3.5 text-xs font-black uppercase tracking-wider"
        >
          <Copy size={16} /> Copy Semua
        </button>
      </div>
    </div>
  );
}
