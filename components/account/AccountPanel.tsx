"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, LogOut, MessageCircle, ShieldCheck, UserRound, X } from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";

const WA_NUMBER = "6285119341538";

type AccountInfo = {
  role: string;
  expiresAt: string;
  telegramId: string;
};

function formatDate(value: string) {
  if (!value) return "-";

  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Makassar",
  }).format(new Date(value));
}

function readAccountInfo(): AccountInfo {
  if (typeof window === "undefined") {
    return { role: "-", expiresAt: "", telegramId: "" };
  }

  return {
    role: localStorage.getItem("aa_role") || "-",
    expiresAt: localStorage.getItem("aa_expires_at") || "",
    telegramId: localStorage.getItem("aa_telegram_user_id") || "",
  };
}

export function AccountPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { logout } = useAuth();
  const [info, setInfo] = useState<AccountInfo>(() => ({ role: "-", expiresAt: "", telegramId: "" }));

  useEffect(() => {
    if (open) setInfo(readAccountInfo());
  }, [open]);

  if (!open) return null;

  const adminUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
    `Halo admin, saya butuh bantuan akun Analisa Angka. ID Telegram: ${info.telegramId || "-"}`,
  )}`;

  function handleLogout() {
    logout();
    onClose();
    router.replace("/kode-login");
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-sm">
      <button
        type="button"
        aria-label="Tutup panel akun"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />

      <section className="animate-soft-pop depth-1 relative w-full max-w-md overflow-hidden rounded-[2rem] border bg-bg-deep p-5 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
        <div className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />

        <div className="relative flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="accent-bg-soft accent-text flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10">
              <UserRound size={25} strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-accent">Panel Akun</p>
              <h2 className="display mt-1 truncate text-xl text-text">Analisa Angka</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="pressable depth-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-text-muted hover:border-border hover:bg-white/[0.06]"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>

        <div className="relative mt-5 grid grid-cols-1 gap-2.5">
          <InfoRow label="Status akses" value={info.role || "-"} icon={<ShieldCheck size={17} />} />
          <InfoRow label="ID Telegram" value={info.telegramId || "-"} icon={<UserRound size={17} />} />
          <InfoRow label="Aktif sampai" value={formatDate(info.expiresAt)} icon={<ShieldCheck size={17} />} />
        </div>

        <div className="relative mt-5 grid grid-cols-1 gap-3">
          <a
            href={adminUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="pressable depth-3 flex h-13 items-center justify-center gap-2 rounded-2xl border bg-white/[0.055] px-4 text-sm font-black text-text hover:border-border hover:bg-white/[0.08]"
          >
            <MessageCircle size={18} />
            Hubungi Admin
            <ExternalLink size={15} />
          </a>

          <button
            type="button"
            onClick={handleLogout}
            className="pressable flex h-13 items-center justify-center gap-2 rounded-2xl border border-danger/30 bg-danger/10 px-4 text-sm font-black text-danger hover:bg-danger/15"
          >
            <LogOut size={18} />
            Keluar Akun
          </button>
        </div>
      </section>
    </div>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="depth-2 flex items-center gap-3 rounded-2xl border px-3.5 py-3">
      <div className="accent-text flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border-soft bg-white/[0.035]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-wide text-text-soft">{label}</p>
        <p className="mt-0.5 truncate text-sm font-black text-text">{value}</p>
      </div>
    </div>
  );
}
