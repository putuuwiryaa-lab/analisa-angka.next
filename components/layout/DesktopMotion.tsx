"use client";

import { useEffect, type RefObject } from "react";

const MOTION_QUERY = "(min-width: 1024px) and (prefers-reduced-motion: no-preference)";
const REVEAL_SELECTOR = "[data-desktop-reveal]";
const EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

/** Animate visible content without hiding it in CSS or remounting page state. */
export function DesktopMotion({
  targetRef,
  pathname,
  enabled,
}: {
  targetRef: RefObject<HTMLElement | null>;
  pathname: string;
  enabled: boolean;
}) {
  useEffect(() => {
    const main = targetRef.current;
    if (!enabled || !main) return;
    const preference = window.matchMedia(MOTION_QUERY);
    const revealed = new WeakSet<Element>();
    let entered = false;
    let stop = () => {};

    const sync = () => {
      stop();
      if (!preference.matches || document.hidden) return;
      const animations = new Map<Element, Animation>();
      const track = (element: Element, frames: Keyframe[], options: KeyframeAnimationOptions) => {
        animations.get(element)?.cancel();
        const animation = element.animate(frames, options);
        animations.set(element, animation);
        const release = () => {
          if (animations.get(element) === animation) animations.delete(element);
        };
        void animation.finished.then(release, release);
      };

      // Opacity keeps sticky controls and fixed descendants in their own coordinates.
      if (!entered) {
        track(main, [{ opacity: 0.6 }, { opacity: 1 }], { duration: 180, easing: EASING });
        entered = true;
      }
      const observer = new IntersectionObserver(
        (entries) => {
          let order = 0;
          for (const entry of entries) {
            const element = entry.target;
            if (!entry.isIntersecting || revealed.has(element)) continue;
            revealed.add(element);
            observer.unobserve(element);
            const fadeOnly = element.getAttribute("data-desktop-reveal") === "fade";
            track(
              element,
              fadeOnly
                ? [{ opacity: 0 }, { opacity: 1 }]
                : [
                    { opacity: 0, transform: "translateY(8px)" },
                    { opacity: 1, transform: "translateY(0)" },
                  ],
              {
                duration: 280,
                delay: Math.min(order++, 6) * 24,
                easing: EASING,
                fill: "backwards",
              },
            );
          }
        },
        { threshold: 0.05 },
      );

      const visit = (node: Node, action: (element: Element) => void) => {
        if (!(node instanceof Element)) return;
        if (node.matches(REVEAL_SELECTOR)) action(node);
        node.querySelectorAll(REVEAL_SELECTOR).forEach(action);
      };
      const observe = (element: Element) => {
        if (!revealed.has(element)) observer.observe(element);
      };
      visit(main, observe);
      const mutations = new MutationObserver((records) => {
        for (const record of records) {
          if (record.type === "attributes") {
            const element = record.target as Element;
            if (element.matches(REVEAL_SELECTOR)) {
              revealed.delete(element);
              observer.observe(element);
            }
          } else {
            record.removedNodes.forEach((node) =>
              visit(node, (element) => {
                observer.unobserve(element);
                animations.get(element)?.cancel();
                animations.delete(element);
              }),
            );
            record.addedNodes.forEach((node) => visit(node, observe));
          }
        }
      });
      mutations.observe(main, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-motion-key"],
      });
      stop = () => {
        observer.disconnect();
        mutations.disconnect();
        animations.forEach((animation) => animation.cancel());
        animations.clear();
      };
    };

    sync();
    preference.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      stop();
      preference.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [enabled, pathname, targetRef]);

  return null;
}
