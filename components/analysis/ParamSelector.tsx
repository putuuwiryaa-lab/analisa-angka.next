import { cn } from "@/lib/cn";

type ParamConfig = {
  title: string;
  values: number[];
  labels?: Record<number, string>;
  hints?: Record<number, string>;
};

export function ParamSelector({
  type,
  param,
  analysisScope = "default",
  onAnalyze,
}: {
  type: string;
  param: number | null;
  analysisScope?: string;
  onAnalyze: (param: number) => void;
}) {
  if (type === "rekap" || param !== 0) return null;

  const aiValues =
    analysisScope === "3d" ? [1, 3, 5, 7, 8] : analysisScope === "4d" ? [1, 2, 4] : [2, 4, 6, 7, 8];
  const aiTitle =
    analysisScope === "3d"
      ? "PILIH JENIS ANGKA IKUT 3D"
      : analysisScope === "4d"
        ? "PILIH JENIS ANGKA IKUT 4D"
        : "PILIH JENIS ANGKA IKUT 2D";

  const options: Record<string, ParamConfig> = {
    ai: { title: aiTitle, values: aiValues, labels: { 7: "GENAP GANJIL", 8: "BESAR KECIL" } },
    bbfs: { title: "PILIH JUMLAH DIGIT BBFS", values: [7, 8, 9] },
    mati: { title: "PILIH JUMLAH DIGIT OFF", values: [1, 2, 3], hints: { 1: "RINGAN", 2: "SEIMBANG", 3: "KETAT" } },
    jumlah: { title: "PILIH JUMLAH OFF", values: [1, 2, 3], hints: { 1: "RINGAN", 2: "SEIMBANG", 3: "KETAT" } },
    shio: { title: "PILIH JUMLAH SHIO MATI", values: [1, 2, 3], hints: { 1: "RINGAN", 2: "SEIMBANG", 3: "KETAT" } },
  };

  const cfg = options[type] || options.ai;
  const isAiMode = type === "ai";
  const isGridThree = isAiMode || type === "bbfs" || type === "mati" || type === "jumlah" || type === "shio";

  return (
    <div className="animate-rise mt-4 rounded-2xl border border-border-soft bg-surface p-4">
      <div className="accent-text mb-3 text-center text-xs font-black uppercase tracking-wider">
        {cfg.title}
      </div>

      <div className={cn("grid gap-2", isGridThree ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4")}>
        {cfg.values.map((value) => {
          const isSpecial = isAiMode && (value === 7 || value === 8);
          const hint = cfg.hints?.[value];
          const label = isSpecial ? cfg.labels![value] : String(value);

          return (
            <button
              key={value}
              onClick={() => onAnalyze(value)}
              className={cn(
                "accent-bg-soft accent-border accent-text rounded-2xl border text-center transition active:scale-[0.97]",
                isSpecial ? "col-span-3 min-h-[88px] p-4" : isGridThree ? "min-h-[88px] p-3" : "p-5",
              )}
            >
              <span className={cn("display block", isSpecial ? "text-[15px] leading-5" : "text-xl")}>
                {label}
              </span>
              {((isAiMode && !isSpecial) || type === "bbfs") && (
                <span className="mt-2 block text-[10px] font-bold uppercase tracking-wide opacity-80">
                  DIGIT
                </span>
              )}
              {hint && (
                <span className="mt-2 block text-[10px] font-bold uppercase tracking-wide opacity-80">
                  {hint}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
