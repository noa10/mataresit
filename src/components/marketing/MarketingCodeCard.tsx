import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarketingCodeCardProps {
  title: string;
  meta?: string;
  code: string;
  copyLabel: string;
  copiedLabel: string;
  className?: string;
  preClassName?: string;
}

export function MarketingCodeCard({
  title,
  meta,
  code,
  copyLabel,
  copiedLabel,
  className,
  preClassName,
}: MarketingCodeCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can be denied; leave the code selectable.
    }
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[10px] border border-ledger-line",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4 border-b border-ledger-line bg-ledger-surface-2 px-3.5 py-[9px] font-data text-[0.6875rem] uppercase tracking-[0.08em] text-ledger-muted">
        <span>{title}</span>
        <div className="flex items-center gap-2">
          {meta ? <span className="normal-case tracking-normal">{meta}</span> : null}
          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? copiedLabel : copyLabel}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ledger-muted transition-colors hover:bg-ledger-surface hover:text-ledger-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ledger-accent/40"
          >
            {copied ? (
              <Check aria-hidden="true" className="h-3.5 w-3.5" />
            ) : (
              <Copy aria-hidden="true" className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
      <pre
        className={cn(
          "overflow-x-auto bg-ledger-panel px-4 py-4 font-data text-[0.8125rem] leading-[1.65] text-ledger-on-panel-muted",
          preClassName,
        )}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}
