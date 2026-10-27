import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: ReactNode;
  meta?: ReactNode;
  tone?: "default" | "accent" | "amber";
  className?: string;
  valueClassName?: string;
}

const TONE_CLASSES = {
  default: "text-ledger-ink",
  accent: "text-ledger-accent",
  amber: "text-ledger-amber",
} as const;

export function KpiCard({
  label,
  value,
  meta,
  tone = "default",
  className,
  valueClassName,
}: KpiCardProps) {
  return (
    <div
      className={cn(
        "rounded-[10px] border border-ledger-line bg-ledger-surface px-[18px] pb-[15px] pt-4",
        className
      )}
    >
      <p className="font-data text-[0.625rem] uppercase tracking-[0.13em] text-ledger-muted">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 font-data text-[1.625rem] font-medium leading-none tabular-nums tracking-[-0.02em]",
          TONE_CLASSES[tone],
          valueClassName
        )}
      >
        {value}
      </p>
      {meta && <p className="mt-1 text-xs text-ledger-muted">{meta}</p>}
    </div>
  );
}
