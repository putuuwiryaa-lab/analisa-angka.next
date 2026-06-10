"use client";

import { Lock, X } from "lucide-react";

type UpgradeFeature = "default" | "statistics" | "evaluation" | "rekap" | "mode";

const FEATURE_COPY: Record<UpgradeFeature, { title: string; paragraphs: string[] }> = {
  default: {
    title: "Fitur VIP",
    paragraphs: [
      "Fitur ini tersedia untuk pengguna VIP. Akses VIP membuka mode dan parameter analisa yang lebih lengkap, termasuk statistik, riwayat evaluasi, serta rekap angka untuk membantu proses analisa menjadi lebih terarah.",
      "Pembatasan akses Free diterapkan agar performa server tetap stabil untuk semua pengguna.",
    ],
  },
  statistics: {
    title: "Statistik VIP",
    paragraphs: [
      "Fitur ini menampilkan ranking statistik dari berbagai metode, parameter, dan pasaran. Anda bisa membandingkan performa antar metode untuk melihat mana yang sedang lebih stabil dan layak dijadikan fokus analisa.",
      "Statistik membantu Anda menyusun rencana betting dengan lebih terarah, karena keputusan tidak hanya diambil dari satu hasil analisa, tetapi juga dari gambaran performa historis. Ini berguna untuk memilih pasaran, metode, dan parameter yang lebih sesuai sebelum masuk ke tahap analisa utama.",
      "Akses Statistik tersedia untuk pengguna VIP. Pembatasan akses Free diterapkan agar performa server tetap stabil untuk semua pengguna.",
    ],
  },
  evaluation: {
    title: "Riwayat Evaluasi VIP",
    paragraphs: [
      "Fitur ini menampilkan riwayat evaluasi analisa hingga 2 minggu terakhir. Dari riwayat ini, Anda bisa melihat apakah metode dan parameter yang sedang digunakan masih stabil, mulai menurun, atau kurang cocok untuk pasaran tertentu.",
      "Data evaluasi membantu Anda membandingkan hasil sebelumnya sebelum mengambil keputusan analisa berikutnya. Dengan begitu, pemilihan metode tidak hanya berdasarkan hasil terakhir, tetapi juga melihat konsistensi performa dalam beberapa hari terakhir.",
      "Akses Riwayat Evaluasi tersedia untuk pengguna VIP. Pembatasan akses Free diterapkan agar performa server tetap stabil untuk semua pengguna.",
    ],
  },
  rekap: {
    title: "Rekap Angka VIP",
    paragraphs: [
      "Fitur ini membantu merekap hasil dari beberapa metode analisa menjadi kombinasi angka yang lebih siap digunakan. Sistem menggabungkan beberapa sumber analisa agar proses penyaringan angka menjadi lebih cepat dan terarah.",
      "Pada bagian rekap, tersedia juga badge khusus yang membantu mengenali kombinasi yang relevan untuk pasaran tertentu. Badge ini memudahkan Anda membaca pola gabungan, melihat angka yang lebih sering muncul, dan menentukan kombinasi mana yang lebih layak diprioritaskan.",
      "Akses Rekap Angka tersedia untuk pengguna VIP. Pembatasan akses Free diterapkan agar performa server tetap stabil untuk semua pengguna.",
    ],
  },
  mode: {
    title: "Mode dan Parameter VIP",
    paragraphs: [
      "Mode atau parameter ini tersedia untuk pengguna VIP. Akses VIP membuka pilihan analisa yang lebih lengkap, termasuk variasi posisi, parameter lanjutan, statistik, riwayat evaluasi, dan rekap angka.",
      "Dengan pilihan yang lebih lengkap, Anda bisa membandingkan beberapa pendekatan analisa sebelum menentukan hasil yang ingin dipakai. Ini membantu proses analisa menjadi lebih fleksibel, terutama saat satu metode sedang kurang stabil pada pasaran tertentu.",
      "Pembatasan akses Free diterapkan agar performa server tetap stabil untuk semua pengguna.",
    ],
  },
};

export function UpgradeLockPanel({
  open,
  onClose,
  onOpenVipLogin,
  onOpenPin,
  title,
  feature = "default",
}: {
  open: boolean;
  onClose: () => void;
  onOpenVipLogin?: () => void;
  onOpenPin?: () => void;
  title?: string;
  feature?: UpgradeFeature;
}) {
  if (!open) return null;

  const copy = FEATURE_COPY[feature] || FEATURE_COPY.default;
  const openVipLogin = onOpenVipLogin || onOpenPin || onClose;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 px-4 pb-4 backdrop-blur-sm sm:items-center sm:pb-0">
      <div className="animate-rise depth-1 max-h-[88vh] w-full max-w-sm overflow-y-auto rounded-3xl border bg-surface p-5 shadow-2xl shadow-black/30">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="depth-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-primary-soft">
              <Lock size={18} />
            </div>
            <div>
              <p className="display text-sm text-text">{title || copy.title}</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-primary-soft">VIP</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="pressable rounded-full border border-border-soft bg-white/[0.04] p-2 text-text-muted hover:border-border hover:text-text"
            aria-label="Tutup panel upgrade"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 text-sm font-medium leading-relaxed text-text-muted">
          {copy.paragraphs.map((paragraph) => (
            <p key={paragraph} className="rounded-2xl border border-border-soft bg-black/15 p-3">
              {paragraph}
            </p>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="pressable h-12 rounded-2xl border border-border-soft bg-white/[0.04] px-4 text-xs font-black uppercase tracking-wide text-text-muted hover:border-border hover:text-text"
          >
            Nanti
          </button>
          <button
            type="button"
            onClick={openVipLogin}
            className="pressable h-12 rounded-2xl border border-primary/35 bg-primary/15 px-4 text-xs font-black uppercase tracking-wide text-primary-soft hover:border-primary/55 hover:bg-primary/20"
          >
            Login VIP
          </button>
        </div>
      </div>
    </div>
  );
}
