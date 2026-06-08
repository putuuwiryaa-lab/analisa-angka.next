"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const INSTALL_BANNER_DISMISSED_KEY = "install_app_banner_dismissed";

function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
}

export function InstallAppBanner() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandaloneDisplay()) return;
    if (localStorage.getItem(INSTALL_BANNER_DISMISSED_KEY) === "true") return;

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setVisible(true);
    }

    function handleAppInstalled() {
      setVisible(false);
      setInstallPrompt(null);
      localStorage.setItem(INSTALL_BANNER_DISMISSED_KEY, "true");
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  if (!visible || !installPrompt) return null;

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      localStorage.setItem(INSTALL_BANNER_DISMISSED_KEY, "true");
    }
    setVisible(false);
    setInstallPrompt(null);
  }

  function dismiss() {
    localStorage.setItem(INSTALL_BANNER_DISMISSED_KEY, "true");
    setVisible(false);
  }

  return (
    <div className="fixed inset-x-0 bottom-[5.25rem] z-50 mx-auto w-full max-w-3xl px-4 pb-[env(safe-area-inset-bottom)]">
      <div className="animate-soft-pop depth-1 flex items-center gap-3 rounded-3xl border border-primary/30 bg-surface/95 p-3 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="depth-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-primary-soft">
          <Download size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="display text-sm text-text">Instal Analisa Angka</p>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-text-muted">
            Akses lebih cepat dari layar utama tanpa perlu membuka browser.
          </p>
        </div>
        <button
          type="button"
          onClick={installApp}
          className="pressable shrink-0 rounded-2xl bg-primary px-4 py-2 text-xs font-black uppercase tracking-wide text-white"
        >
          Instal
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="pressable shrink-0 rounded-full border border-border-soft bg-white/[0.04] p-2 text-text-muted"
          aria-label="Tutup banner instal aplikasi"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
