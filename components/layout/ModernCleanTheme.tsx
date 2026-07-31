const MODERN_CLEAN_CSS = String.raw`
:root {
  color-scheme: light;

  --color-bg: #f6f8fc;
  --color-bg-deep: #ffffff;
  --color-surface: #ffffff;
  --color-surface-2: #f8fafc;
  --color-surface-pressed: #e2e8f0;

  --color-text: #172033;
  --color-text-muted: #475569;
  --color-text-soft: #64748b;
  --color-text-faint: #94a3b8;

  --color-primary: #5657d9;
  --color-primary-soft: #6d6ee8;
  --color-accent: #0891b2;
  --color-success: #059669;
  --color-danger: #dc2626;

  --color-border: rgba(15, 23, 42, 0.1);
  --color-border-soft: rgba(15, 23, 42, 0.06);
  --color-border-strong: rgba(15, 23, 42, 0.16);

  --color-mode-ai: #b7791f;
  --color-mode-bbfs: #c2410c;
  --color-mode-mati: #e11d48;
  --color-mode-jumlah: #0f766e;
  --color-mode-shio: #0891b2;
  --color-mode-rekap: #2563eb;
  --color-mode-invest: #7c3aed;
  --color-mode-statistics: #059669;
  --color-mode-scan: #0e7490;
}

body {
  background:
    radial-gradient(circle at 88% 2%, rgba(86, 87, 217, 0.08), transparent 28%),
    radial-gradient(circle at 5% 22%, rgba(8, 145, 178, 0.055), transparent 25%),
    linear-gradient(180deg, #f9fbff 0%, #f6f8fc 52%, #f2f5fa 100%);
  color: var(--color-text);
}

::selection {
  background-color: var(--color-primary);
  color: #ffffff;
}

input,
textarea,
select {
  color-scheme: light;
}

.depth-1 {
  background: rgba(255, 255, 255, 0.96);
  border-color: var(--color-border-soft);
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.055);
}

.depth-2 {
  background: #f8fafc;
  border-color: var(--color-border-soft);
}

.depth-3 {
  background: #f1f5f9;
  border-color: rgba(15, 23, 42, 0.075);
}

.depth-accent {
  background: #ffffff;
  border-color: var(--color-border);
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.05);
}

.depth-glow-soft {
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.055);
}

.pressable:active,
.pressable:hover:active {
  filter: brightness(0.985);
}

.tap-glow::after {
  background: radial-gradient(circle at 50% 50%, rgba(15, 23, 42, 0.055), transparent 64%);
}

[data-mode="scan"] {
  --accent: var(--color-mode-scan);
}

nav[class*="fixed"][class*="bottom-0"] {
  box-shadow: 0 -10px 30px rgba(15, 23, 42, 0.06);
}
`;

export function ModernCleanTheme() {
  return <style data-theme="modern-clean">{MODERN_CLEAN_CSS}</style>;
}
