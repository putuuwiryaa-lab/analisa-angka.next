"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Coins, Grid3X3, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";

const MENU = [
  {
    href: "/rekomendasi",
    title: "Rekomendasi 2D",
    subtitle: "Kombinasi teruji dari riwayat evaluasi. Lanjutkan ke Angka Jadi untuk hasil siap salin.",
    Icon: Coins,
  },
  {
    href: "/invest/bbfs7",
    title: "BBFS 7D",
    subtitle: "Pilih pasaran, targetkan 2D depan, tengah, atau belakang, lalu hitung BBFS 7 digit.",
    Icon: Grid3X3,
  },
];

export default function InvestPage() {
  const router = useRouter();

  return (
    <div data-mode="invest" className="animate-rise space-y-4 pb-4">
      <Button variant="ghost" size="sm" onClick={() => router.push("/")}> 
        <ArrowLeft size={16} /> Beranda
      </Button>

      <section className="animate-soft-pop depth-accent relative overflow-hidden rounded-3xl border p-5">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full blur-3xl"
          style={{ backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)" }}
        />
        <div className="relative">
          <div className="accent-text flex items-center gap-2 text-[11px] font-black uppercase tracking-wide">
            <Coins size={14} />
            <span>Menu Invest</span>
          </div>
          <h2 className="display mt-2 text-3xl text-text">Invest Terarah</h2>
          <p className="mt-2 max-w-[42ch] text-xs font-medium leading-snug text-text-muted">
            Pusat rekomendasi dan BBFS 7D. Pilih menu sesuai kebutuhan analisa.
          </p>
        </div>
      </section>

      <section className="grid gap-3">
        {MENU.map(({ href, title, subtitle, Icon }) => (
          <Link
            key={href}
            href={href}
            className="pressable animate-soft-pop depth-1 flex items-center justify-between gap-3 rounded-3xl border p-4 hover:border-border hover:bg-surface-2"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="depth-3 accent-text flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border">
                <Icon size={21} />
              </div>
              <div className="min-w-0">
                <h3 className="display text-lg text-text">{title}</h3>
                <p className="mt-1 line-clamp-2 text-xs font-semibold leading-snug text-text-muted">{subtitle}</p>
              </div>
            </div>
            <ChevronRight className="shrink-0 text-text-soft" size={19} />
          </Link>
        ))}
      </section>
    </div>
  );
}
