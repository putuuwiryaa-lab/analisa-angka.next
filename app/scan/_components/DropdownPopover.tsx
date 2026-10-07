"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import styles from "../ScanTheme.module.css";

/** Keep menus outside scroll panels while retaining the Scan palette. */
export default function DropdownPopover({
  triggerRef,
  onClose,
  children,
  className,
  id,
  labelId,
  role,
  align = "start",
  wide = false,
  maxHeight = 224,
}: {
  triggerRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  children: ReactNode;
  className: string;
  id?: string;
  labelId?: string;
  role?: "listbox";
  align?: "start" | "end";
  wide?: boolean;
  maxHeight?: number;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    const trigger = triggerRef.current;
    if (!menu || !trigger) return;

    const placeMenu = () => {
      const anchor = trigger.getBoundingClientRect();
      const viewport = window.visualViewport;
      const leftEdge = (viewport?.offsetLeft ?? 0) + 8;
      const topEdge = (viewport?.offsetTop ?? 0) + 8;
      const rightEdge = leftEdge + (viewport?.width ?? window.innerWidth) - 16;
      const bottomEdge = topEdge + (viewport?.height ?? window.innerHeight) - 16;
      const width = Math.min(wide ? 320 : anchor.width, rightEdge - leftEdge);
      const below = Math.max(0, bottomEdge - anchor.bottom - 8);
      const above = Math.max(0, anchor.top - topEdge - 8);
      const preferAbove = below < Math.min(maxHeight, 160) && above > below;
      const height = Math.min(maxHeight, preferAbove ? above : below);
      const left = align === "end" ? anchor.right - width : anchor.left;

      Object.assign(menu.style, {
        left: `${Math.min(Math.max(left, leftEdge), rightEdge - width)}px`,
        width: `${width}px`,
        maxHeight: `${height}px`,
        top: preferAbove ? "auto" : `${Math.max(topEdge, anchor.bottom + 8)}px`,
        bottom: preferAbove ? `${window.innerHeight - anchor.top + 8}px` : "auto",
      });
    };

    placeMenu();
    const initialFocus =
      menu.querySelector<HTMLElement>('input, [role="option"][aria-selected="true"]') ??
      menu.querySelector<HTMLElement>('[role="option"]');
    initialFocus?.focus({ preventScroll: true });
    if (initialFocus?.getAttribute("role") === "option") {
      initialFocus.scrollIntoView({ block: "nearest" });
    }

    let frame = 0;
    const schedulePlacement = (event?: Event) => {
      if (event?.target instanceof Node && menu.contains(event.target)) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(placeMenu);
    };
    const outsidePointer = (event: PointerEvent) => {
      if (!menu.contains(event.target as Node) && !trigger.contains(event.target as Node)) {
        closeRef.current();
      }
    };
    const outsideFocus = (event: FocusEvent) => {
      if (!menu.contains(event.target as Node) && !trigger.contains(event.target as Node)) {
        closeRef.current();
      }
    };
    const observer = new ResizeObserver(() => schedulePlacement());
    observer.observe(trigger);
    window.addEventListener("resize", schedulePlacement);
    window.addEventListener("scroll", schedulePlacement, true);
    window.visualViewport?.addEventListener("resize", schedulePlacement);
    window.visualViewport?.addEventListener("scroll", schedulePlacement);
    document.addEventListener("pointerdown", outsidePointer);
    document.addEventListener("focusin", outsideFocus);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedulePlacement);
      window.removeEventListener("scroll", schedulePlacement, true);
      window.visualViewport?.removeEventListener("resize", schedulePlacement);
      window.visualViewport?.removeEventListener("scroll", schedulePlacement);
      document.removeEventListener("pointerdown", outsidePointer);
      document.removeEventListener("focusin", outsideFocus);
    };
  }, [triggerRef, align, wide, maxHeight]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" || event.key === "Tab") {
      if (event.key === "Escape") event.preventDefault();
      event.stopPropagation();
      triggerRef.current?.focus({ preventScroll: true });
      onClose();
      return;
    }
    const searching = event.target instanceof HTMLInputElement;
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    if (searching && (event.key === "Home" || event.key === "End")) return;
    const options = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [],
    );
    if (!options.length) return;
    event.preventDefault();
    event.stopPropagation();
    const current = options.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? options.length - 1
          : event.key === "ArrowDown"
            ? (current + 1) % options.length
            : (current <= 0 ? options.length : current) - 1;
    options[next].focus({ preventScroll: true });
    options[next].scrollIntoView({ block: "nearest" });
  };

  return createPortal(
    <div className={styles.theme}>
      <div
        ref={menuRef}
        id={id}
        role={role}
        tabIndex={role === "listbox" ? 0 : undefined}
        aria-labelledby={labelId}
        className={`fixed z-[60] overflow-y-auto overscroll-contain ${className}`}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
