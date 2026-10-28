import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[10px] border border-dashed border-ledger-line-strong bg-ledger-surface-2/60 px-6 py-12 text-center",
        className
      )}
    >
      {icon && <div className="text-ledger-muted">{icon}</div>}
      <h3 className="font-display text-xl text-ledger-ink">{title}</h3>
      {description && <p className="max-w-sm text-sm text-ledger-muted">{description}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
