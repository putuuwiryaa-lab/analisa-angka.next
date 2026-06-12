import { useId } from "react";
import { cn } from "@/lib/cn";

/** Logo mark Analisa Angka — hexagon + "A", gradien purple. */
export function Logo({ className = "h-9 w-9" }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  const gradId = `aaLogo-${id}`;

  return (
    <svg className={cn(className)} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="12" y1="52" x2="52" y2="10" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a98cff" />
          <stop offset="0.55" stopColor="#7c4dff" />
          <stop offset="1" stopColor="#28d7ff" />
        </linearGradient>
      </defs>
      <path
        d="M32 5.5 54.5 18.5v27L32 58.5 9.5 45.5v-27L32 5.5Z"
        stroke={`url(#${gradId})`}
        strokeWidth="3.2"
        strokeLinejoin="round"
      />
      <path
        d="M19 44 31.6 17.5 45 44"
        stroke={`url(#${gradId})`}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M26.5 34h11" stroke={`url(#${gradId})`} strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}
