"use client";

import { FormEvent, useEffect, useState } from "react";

type PinRow = {
  id: string;
  status: string;
  note: string | null;
  created_at: string;
  used_at: string | null;
  revoked_at: string | null;
  device_name: string | null;
  last_seen_at: string | null;
  session_revoked_at: string | null;
};

type SessionRow = {
  id: string;
  device_name: string | null;
  device_id: string | null;
  created_at: string;
  last_seen_at: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  status: string;
  pin_note: string | null;
};

function dateText(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("id-ID");
}

export default function AdminPage() {
  const [note, setNote] = useState("");
  const [newPin, setNewPin] = useState("");
  const [pins, setPins] = useState<PinRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadAll() {
    setError("");

    try {
      const [pinRes, sessionRes] = await Promise.all([
        fetch("/api/admin/pins"),
        fetch("/api/admin/sessions"),
      ]);

      if (pinRes.status === 401 || sessionRes.status === 401) {
        window.location.replace("/admin/login");
        return;
      }

      const pinData = await pinRes.json().catch(() => ({}));
      const sessionData = await sessionRes.json().catch(() => ({}));

      if (!pinRes.ok) throw new Error(pinData.error || "Gagal memuat PIN.");
      if (!sessionRes.ok) throw new Error(sessionData.error || "Gagal memuat session.");

      setPins(pinData.pins || []);
      setSessions(sessionData.sessions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat admin.");
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setNewPin("");
    setError("");

    try {
      const response = await fetch("/api/admin/pins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(data.error || "Gagal membuat PIN.");

      setNewPin(data.pin);
      setNote("");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat PIN.");
    } finally {
      setLoading(false);
    }
  }

  async function revokeSession(id: string) {
    if (!confirm("Hapus akses device ini?")) return;

    try {
      const response = await fetch(`/api/admin/sessions/${id}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Dihapus admin" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Gagal hapus akses.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal hapus akses.");
    }
  }

  async function revokePin(id: string) {
    if (!confirm("Batalkan PIN ini?")) return;

    try {
      const response = await fetch(`/api/admin/pins/${id}/revoke`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Gagal membatalkan PIN.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membatalkan PIN.");
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.replace("/admin/login");
  }

  return (
    <main className="mx-auto flex min-h-[100svh] w-full max-w-5xl flex-col gap-5 px-4 py-6">
      <header className="rounded-[2rem] border border-border bg-surface p-5">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-accent">Admin Akses</p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-black text-text">Kelola Akses</h1>
            <p className="mt-1 text-sm font-semibold text-text-muted">Buat PIN baru dan revoke device aktif.</p>
          </div>
          <button className="rounded-2xl border border-border px-4 py-3 text-xs font-black uppercase tracking-wide text-text" type="button" onClick={logout}>
            Keluar Admin
          </button>
        </div>
      </header>

      {error ? <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-bold text-danger">{error}</div> : null}

      <section className="rounded-[2rem] border border-border bg-surface p-5">
        <h2 className="text-lg font-black text-text">Buat Kode Akses Baru</h2>
        <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={generate}>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Catatan, contoh: user A / VIP / trial"
            className="min-w-0 flex-1 rounded-2xl border border-border bg-bg px-4 py-3 text-sm font-semibold text-text outline-none focus:border-accent"
          />
          <button className="rounded-2xl bg-accent px-5 py-3 text-xs font-black uppercase tracking-wide text-bg disabled:opacity-60" type="submit" disabled={loading}>
            {loading ? "Membuat..." : "Buat PIN"}
          </button>
        </form>
        {newPin ? (
          <div className="mt-4 rounded-2xl border border-accent/30 bg-accent/10 p-4 text-center">
            <p className="text-xs font-black uppercase tracking-wide text-text-muted">Kode baru</p>
            <strong className="mt-1 block text-3xl tracking-[0.18em] text-accent">{newPin}</strong>
          </div>
        ) : null}
      </section>

      <section className="rounded-[2rem] border border-border bg-surface p-5">
        <h2 className="text-lg font-black text-text">Akses Device Aktif</h2>
        <div className="mt-4 grid gap-3">
          {sessions.map((session) => (
            <div className="rounded-2xl border border-border bg-bg p-4" key={session.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1 text-sm font-semibold text-text-muted">
                  <strong className="block truncate text-base text-text">{session.device_name || "Unknown Device"}</strong>
                  <div>Status: {session.status}</div>
                  <div>Catatan: {session.pin_note || "-"}</div>
                  <div>Dibuat: {dateText(session.created_at)}</div>
                  <div>Last seen: {dateText(session.last_seen_at)}</div>
                </div>
                {session.revoked_at ? (
                  <em className="text-sm font-bold text-text-muted">Akses sudah dihapus</em>
                ) : (
                  <button className="rounded-2xl border border-danger/40 px-4 py-3 text-xs font-black uppercase tracking-wide text-danger" type="button" onClick={() => revokeSession(session.id)}>
                    Hapus Akses
                  </button>
                )}
              </div>
            </div>
          ))}
          {!sessions.length ? <p className="text-sm font-semibold text-text-muted">Belum ada session.</p> : null}
        </div>
      </section>

      <section className="rounded-[2rem] border border-border bg-surface p-5">
        <h2 className="text-lg font-black text-text">Riwayat Kode Akses</h2>
        <div className="mt-4 grid gap-3">
          {pins.map((pin) => (
            <div className="rounded-2xl border border-border bg-bg p-4" key={pin.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1 text-sm font-semibold text-text-muted">
                  <strong className="block text-base text-text">{pin.status}</strong>
                  <div>Catatan: {pin.note || "-"}</div>
                  <div>Dibuat: {dateText(pin.created_at)}</div>
                  <div>Dipakai: {dateText(pin.used_at)}</div>
                  <div>Device: {pin.device_name || "-"}</div>
                </div>
                {pin.status === "unused" ? (
                  <button className="rounded-2xl border border-warning/40 px-4 py-3 text-xs font-black uppercase tracking-wide text-warning" type="button" onClick={() => revokePin(pin.id)}>
                    Batalkan PIN
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          {!pins.length ? <p className="text-sm font-semibold text-text-muted">Belum ada kode akses.</p> : null}
        </div>
      </section>
    </main>
  );
}
