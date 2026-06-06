"use client";

import { useState } from "react";
import { Copy, KeyRound, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type VipRole = "PRO" | "MASTER";

type CreatedAccount = {
  phone: string;
  email: string;
  password: string;
  role: VipRole;
  expires_at: string | null;
};

const ADMIN_SECRET_KEY = "vip_admin_secret";

function formatDate(value: string | null) {
  if (!value) return "Tidak kadaluarsa";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function waMessage(account: CreatedAccount) {
  return `Akun VIP Analisa Angka sudah aktif.\n\nNomor WA: ${account.phone}\nPassword: ${account.password}\nRole: ${account.role}\nAktif sampai: ${formatDate(account.expires_at)}\n\nSilakan login menggunakan nomor WA dan password di atas.`;
}

export default function VipAdminPage() {
  const [adminSecret, setAdminSecret] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(ADMIN_SECRET_KEY) || "";
  });
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<VipRole>("PRO");
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreatedAccount | null>(null);
  const [copied, setCopied] = useState(false);

  async function createAccount() {
    if (loading) return;
    setLoading(true);
    setError("");
    setCreated(null);
    setCopied(false);

    try {
      if (typeof window !== "undefined") localStorage.setItem(ADMIN_SECRET_KEY, adminSecret);
      const response = await fetch("/api/admin/vip-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({ phone, role, days }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Gagal membuat akun VIP");
      setCreated({
        phone: json.phone,
        email: json.email,
        password: json.password,
        role: json.role,
        expires_at: json.expires_at,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat akun VIP");
    }

    setLoading(false);
  }

  async function copyMessage() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(waMessage(created));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="animate-rise space-y-5 pb-8">
      <div className="depth-accent rounded-3xl border p-5">
        <p className="text-[11px] font-black uppercase tracking-wide text-primary-soft">Admin</p>
        <h1 className="display mt-2 text-2xl text-text">Buat Akun VIP</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">
          Input nomor WhatsApp, sistem akan membuat akun Supabase Auth, generate password, dan menulis profile VIP.
        </p>
      </div>

      <section className="depth-1 space-y-4 rounded-3xl border p-5">
        <div>
          <label className="mb-2 ml-1 block text-xs font-bold uppercase tracking-wide text-text-muted">
            Admin Secret
          </label>
          <Input
            type="password"
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value)}
            placeholder="ADMIN_API_SECRET"
          />
          <p className="mt-2 text-[11px] font-medium leading-relaxed text-text-soft">
            Secret disimpan lokal di browser admin ini. Jangan bagikan ke user.
          </p>
        </div>

        <div>
          <label className="mb-2 ml-1 block text-xs font-bold uppercase tracking-wide text-text-muted">
            Nomor WhatsApp
          </label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="081234567890"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-2 ml-1 block text-xs font-bold uppercase tracking-wide text-text-muted">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as VipRole)}
              className="h-12 w-full rounded-2xl border border-border-soft bg-surface-2 px-4 text-[15px] font-bold text-text focus:border-primary/70 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/25"
            >
              <option value="PRO">PRO</option>
              <option value="MASTER">MASTER</option>
            </select>
          </div>
          <div>
            <label className="mb-2 ml-1 block text-xs font-bold uppercase tracking-wide text-text-muted">
              Durasi Hari
            </label>
            <Input
              type="number"
              min={1}
              value={days}
              disabled={role === "MASTER"}
              onChange={(e) => setDays(Number(e.target.value || 0))}
            />
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-danger/25 bg-danger/10 p-3 text-center text-xs font-bold text-danger">
            {error}
          </div>
        )}

        <Button size="lg" className="w-full" onClick={createAccount} disabled={loading || !adminSecret || !phone}>
          <UserPlus size={16} /> {loading ? "Membuat akun…" : "Buat / Reset Akun VIP"}
        </Button>
      </section>

      {created && (
        <section className="animate-soft-pop depth-1 rounded-3xl border p-5">
          <div className="mb-4 flex items-start gap-3">
            <div className="depth-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-primary-soft">
              <KeyRound size={18} />
            </div>
            <div>
              <p className="display text-sm text-text">Akun VIP Siap</p>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-text-muted">
                Password hanya tampil di sini setelah dibuat/reset. Salin dan kirim ke user.
              </p>
            </div>
          </div>

          <div className="space-y-2 rounded-2xl border border-border-soft bg-black/20 p-4 text-sm">
            <p><span className="text-text-soft">WA:</span> <span className="num font-bold text-text">{created.phone}</span></p>
            <p><span className="text-text-soft">Email internal:</span> <span className="font-bold text-text">{created.email}</span></p>
            <p><span className="text-text-soft">Password:</span> <span className="num font-black tracking-[0.18em] text-primary-soft">{created.password}</span></p>
            <p><span className="text-text-soft">Role:</span> <span className="font-bold text-text">{created.role}</span></p>
            <p><span className="text-text-soft">Expired:</span> <span className="font-bold text-text">{formatDate(created.expires_at)}</span></p>
          </div>

          <Button variant="ghost" size="lg" className="mt-4 w-full" onClick={copyMessage}>
            <Copy size={16} /> {copied ? "Pesan Disalin" : "Salin Pesan WhatsApp"}
          </Button>
        </section>
      )}
    </div>
  );
}
