import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check, Clipboard, X } from "lucide-react";
import type { DetailData } from "../_lib";
import styles from "../ScanTheme.module.css";

export default function TrekDetailModal({ data, copied, onCopy, onClose }: { data: DetailData; copied: boolean; onCopy: () => void; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);

  function requestClose() {
    if (window.matchMedia("(min-width: 1024px) and (prefers-reduced-motion: no-preference)").matches) {
      setClosing(true);
    } else {
      onClose();
    }
  }

  useEffect(() => {
    if (!closing) return;
    // Finish even if the animation is interrupted or the preference changes.
    const timeout = window.setTimeout(onClose, 180);
    const preference = window.matchMedia("(min-width: 1024px) and (prefers-reduced-motion: no-preference)");
    const finish = () => { if (!preference.matches) onClose(); };
    finish();
    preference.addEventListener("change", finish);
    return () => {
      clearTimeout(timeout);
      preference.removeEventListener("change", finish);
    };
  }, [closing, onClose]);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  function keepFocusInside(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (typeof document === "undefined") return null;
  return createPortal(
    <dialog
      ref={dialogRef}
      aria-label={`Detail trek ${data.title}`}
      data-closing={closing}
      onKeyDown={keepFocusInside}
      onCancel={(event) => { event.preventDefault(); requestClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) requestClose(); }}
      className={`${styles.theme} desktop-detail-dialog fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none items-end justify-center border-0 bg-transparent p-0 text-text backdrop:bg-black/80 backdrop:backdrop-blur-[2px] open:flex sm:items-center sm:p-5`}
    >
      <section onAnimationEnd={(event) => { if (event.target === event.currentTarget && event.animationName === "desktop-dialog-exit") onClose(); }} className="relative flex max-h-[92svh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[1.75rem] border border-border-soft bg-bg-deep shadow-2xl sm:rounded-[1.75rem]">
        <header className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-border-soft bg-surface/95 p-4 sm:p-5">
          <div className="min-w-0">
            <h2 className="display truncate text-2xl text-text">{data.title}</h2>
            <p className="mt-2 break-words font-mono text-sm font-black tracking-[0.06em] text-[#51d2ca] sm:text-base">{data.description}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={onCopy} className="pressable flex h-11 items-center gap-2 rounded-xl border border-border-soft bg-white/[0.05] px-3 text-xs font-black text-text-muted sm:h-12">
              {copied ? <Check size={16} /> : <Clipboard size={16} />}{copied ? "Tersalin" : "Salin"}
            </button>
            <button type="button" onClick={requestClose} className="pressable flex h-11 w-11 items-center justify-center rounded-xl border border-border-soft bg-white/[0.05] text-text sm:h-12 sm:w-12" aria-label="Tutup"><X size={22} /></button>
          </div>
        </header>
        <div className="overscroll-contain overflow-y-auto px-3 py-4 sm:px-5 sm:py-5">
          {data.rows.length ? <div>{data.rows.map((row, index) => (
            <div key={`${row.draw}-${index}`} className="grid min-h-14 grid-cols-[4rem_1.25rem_minmax(0,1fr)_1.75rem] items-center gap-1.5 border-b border-border-soft/70 px-1 py-2 sm:grid-cols-[4.5rem_1.75rem_minmax(0,1fr)_2rem] sm:gap-2">
              <span className="num text-base font-black text-text sm:text-lg">{row.draw}</span>
              <span className="text-lg font-black text-[#51d2ca] sm:text-xl">➜</span>
              <div className="num flex min-w-0 flex-wrap items-center gap-1.5 text-base font-black text-text sm:gap-2 sm:text-lg">
                {row.values.length ? row.values.map((value, valueIndex) => <span key={`${value.label}-${valueIndex}`} className={value.hit ? "rounded-lg border border-accent/60 bg-accent px-2 py-1 text-bg-deep shadow-[0_0_0_1px_rgba(224,179,65,0.22)]" : "px-0.5 py-1"}>{value.label}</span>) : <span className="text-text-soft">—</span>}
              </div>
              <span className="text-right text-sm sm:text-base">{row.status}</span>
            </div>
          ))}</div> : <p className="mb-3 rounded-2xl border border-dashed border-border-soft p-4 text-center text-xs font-bold text-text-soft">Detail histori belum tersedia untuk trek ini.</p>}
          <div className="mt-4 grid min-h-16 grid-cols-[4rem_1.25rem_minmax(0,1fr)_1.75rem] items-center gap-1.5 rounded-2xl border border-accent/35 bg-accent/[0.045] px-2.5 py-2 sm:grid-cols-[4.5rem_1.75rem_minmax(0,1fr)_2rem] sm:gap-2 sm:px-3">
            <span className="num text-base font-black text-accent sm:text-lg">{data.pendingDraw}</span>
            <span className="text-lg font-black text-[#51d2ca] sm:text-xl">➜</span>
            <div className="num flex min-w-0 flex-wrap items-center gap-2 text-base font-black text-accent sm:gap-3 sm:text-lg">{data.pendingValues.length ? data.pendingValues.map((value, index) => <span key={`${value}-${index}`}>{value}</span>) : <span>—</span>}</div>
            <span className="text-right font-black text-accent">??</span>
          </div>
        </div>
      </section>
    </dialog>,
    document.body,
  );
}
