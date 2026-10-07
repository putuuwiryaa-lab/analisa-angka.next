import { Loader2, PanelRight } from "lucide-react";

export function WorkspacePlaceholder({
  title,
  description,
  busy = false,
}: {
  title: string;
  description: string;
  busy?: boolean;
}) {
  return (
    <div
      className="hidden min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-white/[0.025] p-8 text-center lg:flex"
      role={busy ? "status" : undefined}
    >
      {busy ? (
        <Loader2 size={28} className="mb-4 animate-spin text-primary-soft" />
      ) : (
        <PanelRight size={28} className="mb-4 text-text-soft" />
      )}
      <p className="display text-base text-text">{title}</p>
      <p className="mt-2 max-w-sm text-sm leading-6 text-text-muted">{description}</p>
    </div>
  );
}
