"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Coins, House, ScanSearch, Share2 } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

const ITEMS = [
  { href: "/", label: "Pasaran & Analisa", Icon: House },
  { href: "/pantauan-rekap", label: "Statistik", Icon: BarChart3 },
  { href: "/scan", label: "Scan Angka", Icon: ScanSearch },
  { href: "/rekomendasi", label: "Invest", Icon: Coins },
  { href: "/share-prediksi", label: "Share Prediksi", Icon: Share2 },
];

export function DesktopSidebar() {
  const pathname = usePathname();

  return (
    <aside className="desktop-sidebar sticky top-6 z-20 hidden h-[calc(100dvh-3rem)] w-52 shrink-0 flex-col rounded-3xl border border-border-soft bg-bg-deep/75 p-4 lg:flex xl:w-56">
      <Link
        href="/"
        className="mb-8 flex items-center gap-3 rounded-2xl px-1 py-2"
        aria-label="Analisa Angka — beranda"
      >
        <Logo className="h-10 w-10 shrink-0" />
        <span className="display text-sm leading-5 text-text">
          ANALISA
          <br />
          ANGKA
        </span>
      </Link>
      <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-widest text-text-soft">
        Menu utama
      </p>
      <nav className="space-y-2" aria-label="Navigasi utama">
        {ITEMS.map(({ href, label, Icon }) => {
          const active =
            href === "/"
              ? pathname === "/" || pathname.startsWith("/analyze/")
              : pathname === href ||
                pathname.startsWith(`${href}/`) ||
                (href === "/rekomendasi" && pathname === "/invest");
          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-12 items-center gap-3 rounded-2xl border px-3 text-[13px] font-bold transition-colors ${active ? "border-primary/35 bg-primary/15 text-primary-soft" : "border-transparent text-text-muted hover:border-border-soft hover:bg-white/[0.05] hover:text-text"}`}
            >
              <Icon size={19} className="shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
      <p className="mt-auto border-t border-border-soft px-2 pt-4 text-xs leading-5 text-text-soft">
        Prediksi berbasis matematis
      </p>
    </aside>
  );
}
