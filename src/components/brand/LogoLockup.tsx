import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { MataresitMark } from "@/components/brand/MataresitMark";

type MarkSize = "sm" | "md" | "lg";
type LockupTone = "accent" | "on-panel" | "inherit";

const MARK_SIZE_CLASSES: Record<MarkSize, string> = {
  // 28 / 32 / 36 px. The brand sheet's floor is 16 px; the lockup never goes lower.
  sm: "h-7 w-7",
  md: "h-8 w-8",
  lg: "h-9 w-9",
};

const TONE_CLASSES: Record<LockupTone, string> = {
  // Light surfaces: ember green, the product's light-mode primary.
  accent: "text-ledger-accent",
  // Always-dark panels (sidebar, auth panel) never receive the `.dark` class,
  // so the sheet's dark-mode mint is applied directly.
  "on-panel": "text-[#3FBF8E] [--mark-scan-color:var(--ledger-panel)]",
  inherit: "",
};

interface LogoLockupProps {
  /** Route to open. Ignored when `href` is set. */
  to?: string;
  /** Plain anchor target, for in-page links such as `#top`. */
  href?: string;
  /** Accessible name for the link. */
  label?: string;
  markSize?: MarkSize;
  tone?: LockupTone;
  /** Wordmark styling differs per surface; pass the existing classes here. */
  wordmarkClassName?: string;
  className?: string;
  children?: ReactNode;
}

/**
 * The one definition of the Mataresit lockup: brand mark + wordmark.
 *
 * Every surface that shows the company logo renders this, so the mark geometry
 * and colour rules stay identical. The wordmark stays in the product's display
 * serif (see BRAND-NOTES.md — a deliberate difference from the brand sheet,
 * which sets it in Instrument Sans SemiBold).
 */
export function LogoLockup({
  to = "/",
  href,
  label = "Mataresit home",
  markSize = "md",
  tone = "accent",
  wordmarkClassName,
  className,
  children,
}: LogoLockupProps) {
  const content = (
    <>
      <span
        aria-hidden="true"
        className={cn("grid shrink-0 place-items-center", MARK_SIZE_CLASSES[markSize], TONE_CLASSES[tone])}
      >
        <MataresitMark scan className="h-full w-full" />
      </span>
      <span className={cn("leading-none", wordmarkClassName)}>Mataresit</span>
      {children}
    </>
  );

  const sharedClassName = cn(
    "group inline-flex items-center gap-2.5 rounded-[6px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ledger-accent/50",
    className,
  );

  if (href) {
    return (
      <a href={href} aria-label={label} className={sharedClassName}>
        {content}
      </a>
    );
  }

  return (
    <Link to={to} aria-label={label} className={sharedClassName}>
      {content}
    </Link>
  );
}
