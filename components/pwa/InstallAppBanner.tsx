"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "install-banner-dismissed-until";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

function standalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
}

function dismissed() {
  if (typeof window === "undefined") return true;
  return Number(localStorage.getItem(DISMISS_KEY) || 0) > Date.now();
}

function rememberDismiss() {
  if (typeof window === "undefined") return;
  localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS));
}

export function InstallAppBanner() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    if (standalone() || dismissed()) return;

    const timer = window.setTimeout(() => setVisible(true), 1400);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => setVisible(false);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!visible || standalone()) return null;

  async function install() {
    if (!promptEvent) {
      setHelp((value) => !value);
      return;
    }
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice.catch(() => null);
    if (choice?.outcome === "accepted") setVisible(false);
    setPromptEvent(null);
  }

  function close() {
    rememberDismiss();
    setVisible(false);
  }

  return (
    <div className="animate-soft-pop depth-1 mb-4 rounded-3xl border p-3">
      <div className="flex items-start gap-3">
        <div className="depth-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-accent">
          <Smartphone size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="display text-sm text-text">Install aplikasi</p>
              <p className="mt-1 text-xs font-medium leading-relaxed text-text-muted">
                Buka lebih cepat dari layar utama HP tanpa mengetik alamat web.
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              className="pressable -mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-soft hover:bg-white/[0.06] hover:text-text"
              aria-label="Tutup banner install"
            >
              <X size={16} />
            </button>
          </div>

          {help && (
            <div className="mt-3 rounded-2xl border border-border-soft bg-white/[0.035] px-3 py-2 text-[11px] font-semibold leading-relaxed text-text-muted">
              Buka menu browser, pilih <span className="text-text">Tambahkan ke Layar Utama</span>, lalu tekan <span className="text-text">Instal</span>.
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <Button size="sm" className="h-9 px-4" onClick={install}>
              <Download size={15} /> {promptEvent ? "Install" : "Cara Install"}
            </Button>
            <Button variant="ghost" size="sm" className="h-9 px-4" onClick={close}>
              Nanti
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
