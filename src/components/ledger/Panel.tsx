import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PanelProps {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Skip the default body padding (for lists that run edge to edge). */
  flush?: boolean;
}

/**
 * Bordered surface used across the workspace. Matches the ledger design:
 * 1px hairline, 10px radius, no shadow.
 */
export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  flush = false,
}: PanelProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[10px] border border-ledger-line bg-ledger-surface",
        className
      )}
    >
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ledger-line px-[18px] py-4">
          <div className="min-w-0">
            {title && (
              <h2 className="text-[1rem] font-semibold leading-tight text-ledger-ink">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 text-xs text-ledger-muted">{description}</p>
            )}
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </header>
      )}
      <div
        className={cn(
          !flush && (title || action ? "px-[18px] pb-[18px] pt-4" : "p-[18px]"),
          bodyClassName
        )}
      >
        {children}
      </div>
    </section>
  );
}
