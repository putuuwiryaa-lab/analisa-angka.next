import { Activity, BarChart3, Coins, Database, ShieldAlert, Trophy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";

const modes = [
  { mode: "ai", label: "ANGKA IKUT", icon: Activity },
  { mode: "mati", label: "ANGKA MATI", icon: ShieldAlert },
  { mode: "rekap", label: "CUSTOM REKAP", icon: Trophy },
  { mode: "invest", label: "INVEST", icon: Coins },
  { mode: "statistics", label: "STATISTIK", icon: BarChart3 },
];

const samples = ["SGP", "JPN", "HK", "SYD"];

export default function ThemePreviewPage() {
  return (
    <div className="animate-rise space-y-5 pb-10">
      <section className="depth-accent relative overflow-hidden rounded-3xl border p-5">
        <div className="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative">
          <p className="accent-text text-[11px] font-black uppercase tracking-[0.22em]">Theme Preview</p>
          <h2 className="display mt-2 text-3xl text-text">Light Theme Test</h2>
          <p className="mt-2 max-w-[44ch] text-xs font-semibold leading-snug text-text-muted">
            Halaman ini terbuka tanpa login untuk mengecek warna, card, tombol, input, skeleton, dan aksen mode.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm">Primary</Button>
            <Button variant="ghost" size="sm">Ghost</Button>
            <Button variant="accent" size="sm">Accent</Button>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-3 px-1">
          <p className="text-[11px] font-black uppercase tracking-wider text-text-soft">Surface & Pasaran</p>
          <span className="h-px flex-1 bg-border-soft" />
        </div>
        <Input placeholder="Contoh input pencarian pasaran…" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {samples.map((name, index) => (
            <div key={name} className="pressable animate-soft-pop depth-1 rounded-3xl border p-3 text-center" style={{ animationDelay: `${index * 24}ms` }}>
              <div className="depth-2 rounded-2xl border px-3 py-3">
                <p className="display text-xs text-text">{name}</p>
              </div>
              <p className="num accent-text mt-4 text-2xl font-black">{index + 1}{index + 3}{index + 5}{index + 7}</p>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-text-soft">Sample Card</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-3 px-1">
          <p className="text-[11px] font-black uppercase tracking-wider text-text-soft">Mode Accent</p>
          <span className="h-px flex-1 bg-border-soft" />
        </div>
        <div className="grid gap-3">
          {modes.map(({ mode, label, icon: Icon }) => (
            <div key={mode} data-mode={mode} className="pressable depth-1 flex items-center gap-3 rounded-3xl border p-3">
              <div className="depth-3 accent-text flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border">
                <Icon size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="display accent-text text-sm">{label}</p>
                <p className="mt-1 text-[11px] font-semibold text-text-soft">Aksen mengikuti token data-mode.</p>
              </div>
              <span className="accent-bg-soft accent-text rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide">14/15</span>
            </div>
          ))}
        </div>
      </section>

      <section className="depth-1 rounded-3xl border p-4">
        <div className="flex items-center gap-3">
          <div className="depth-3 flex h-12 w-12 items-center justify-center rounded-2xl border text-text-muted">
            <Database size={20} />
          </div>
          <div>
            <p className="display text-sm text-text">Loading State</p>
            <p className="mt-1 text-[11px] font-semibold text-text-soft">Skeleton memakai gradient token theme.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-2">
          <Skeleton className="h-5 rounded-full" />
          <Skeleton className="h-5 w-3/4 rounded-full" />
          <Skeleton className="h-16 rounded-2xl" />
        </div>
      </section>
    </div>
  );
}
