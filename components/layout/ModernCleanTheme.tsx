const COLOR_THEME_CSS = String.raw`
:root {
  color-scheme: dark;

  --color-bg: #1a1d2e;
  --color-bg-deep: #141624;
  --color-surface: #25283b;
  --color-surface-2: #2d3148;
  --color-surface-pressed: #3b405c;

  --color-text: #f9faff;
  --color-text-muted: #d8def0;
  --color-text-soft: #aab5d0;
  --color-text-faint: #7c879f;

  --color-primary: #8b7cf6;
  --color-primary-soft: #b3a6ff;
  --color-accent: #48c6e8;
  --color-success: #57d6a6;
  --color-danger: #ff6f85;

  --color-border: rgba(226, 232, 255, 0.16);
  --color-border-soft: rgba(226, 232, 255, 0.1);
  --color-border-strong: rgba(226, 232, 255, 0.25);

  --color-mode-ai: #f5c761;
  --color-mode-bbfs: #f5a65b;
  --color-mode-mati: #ff7893;
  --color-mode-jumlah: #47d7c2;
  --color-mode-shio: #52c7e8;
  --color-mode-rekap: #7eaeff;
  --color-mode-invest: #c792ff;
  --color-mode-statistics: #5ee0a0;
  --color-mode-scan: #56cfe1;
}

body {
  background:
    radial-gradient(circle at 86% 6%, rgba(139, 124, 246, 0.18), transparent 30%),
    radial-gradient(circle at 8% 18%, rgba(72, 198, 232, 0.09), transparent 28%),
    radial-gradient(circle at 76% 78%, rgba(71, 215, 194, 0.065), transparent 34%),
    linear-gradient(180deg, var(--color-bg) 0%, var(--color-bg-deep) 100%);
  color: var(--color-text);
}

::selection {
  background-color: var(--color-primary);
  color: #ffffff;
}

input,
textarea,
select {
  color-scheme: dark;
}

.depth-1 {
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--color-surface) 97%, white 3%),
    color-mix(in srgb, var(--color-surface) 92%, black 8%)
  );
  border-color: var(--color-border-soft);
  box-shadow: 0 14px 36px rgba(5, 7, 18, 0.22);
}

.depth-2 {
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--color-surface-2) 98%, white 2%),
    color-mix(in srgb, var(--color-surface-2) 90%, black 10%)
  );
  border-color: rgba(190, 201, 238, 0.14);
}

.depth-3 {
  background: rgba(112, 128, 178, 0.16);
  border-color: rgba(174, 188, 230, 0.15);
}

.depth-accent {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--accent, var(--color-primary)) 18%, var(--color-surface)),
    color-mix(in srgb, var(--accent, var(--color-primary)) 10%, var(--color-bg-deep))
  );
  border-color: color-mix(in srgb, var(--accent, var(--color-primary)) 36%, transparent);
  box-shadow: 0 16px 38px color-mix(in srgb, var(--accent, var(--color-primary)) 14%, transparent);
}

.depth-glow-soft {
  box-shadow: 0 14px 34px rgba(5, 7, 18, 0.2), 0 0 34px rgba(139, 124, 246, 0.1);
}

.tap-glow::after {
  background: radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.11), transparent 64%);
}

[data-mode="scan"] {
  --accent: var(--color-mode-scan);
}
`;

export function ModernCleanTheme() {
  return <style data-theme="bright-soft-dark">{COLOR_THEME_CSS}</style>;
}
