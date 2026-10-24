import { cn } from "@/lib/utils";

export type StatusChipTone = "reviewed" | "unreviewed" | "processing" | "danger" | "neutral";

interface StatusChipProps {
  tone?: StatusChipTone;
  label: string;
  className?: string;
}

const TONE_CLASSES: Record<StatusChipTone, string> = {
  reviewed: "bg-ledger-accent-soft text-ledger-accent",
  unreviewed: "bg-ledger-amber-soft text-ledger-amber",
  processing: "bg-ledger-surface-2 text-ledger-ink-2",
  danger: "bg-ledger-danger-soft text-ledger-danger",
  neutral: "bg-ledger-surface-2 text-ledger-muted",
};

export function StatusChip({ tone = "neutral", label, className }: StatusChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-[9px] py-[3px] text-[0.6875rem] font-semibold leading-none tracking-[0.01em] whitespace-nowrap",
        TONE_CLASSES[tone],
        className
      )}
    >
      <span aria-hidden="true" className="h-[5px] w-[5px] rounded-full bg-current" />
      {label}
    </span>
  );
}
