import type { AnchorHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { MataresitMark } from "@/components/brand/MataresitMark";

type MarkSize = "sm" | "md" | "lg";
type LockupTone = "accent" | "on-panel" | "inherit";

const MARK_SIZE_CLASSES: Record<MarkSize, string> = {
  // 32 / 36 / 40 px. The brand sheet's floor is 16 px; the lockup never goes lower.
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-10 w-10",
};

const TONE_CLASSES: Record<LockupTone, string> = {
  // Light surfaces: ember green, the product's light-mode primary.
  accent: "text-ledger-accent",
  // Always-dark panels (sidebar, auth panel) are dark whatever the app theme
  // is, so they take the sheet's dark-mode mint directly rather than the
  // theme's accent, which would be ember green on a near-black plate.
  "on-panel": "text-ledger-accent-on-panel [--mark-scan-color:var(--ledger-panel)]",
  inherit: "",
};

/**
 * Focus ring per tone. The ring is drawn at full strength: the panel tone sits
 * on a near-black plate, where a half-strength accent ring drops to about
 * 1.4:1 and disappears.
 */
const TONE_FOCUS_CLASSES: Record<LockupTone, string> = {
  accent: "focus-visible:ring-ledger-accent",
  "on-panel": "focus-visible:ring-ledger-on-panel",
  inherit: "focus-visible:ring-ledger-accent",
};

interface LogoLockupProps {
  /** Route to open. Ignored when `href` is set. */
  to?: string;
  /** Plain anchor target, for in-page links such as `#top`. */
  href?: string;
  /**
   * Accessible name for the link. Left unset, the name is the wordmark
   * ("Mataresit"). Pass a localized name when the link goes somewhere other
   * than the home page.
   */
  label?: string;
  markSize?: MarkSize;
  tone?: LockupTone;
  /**
   * Wordmark styling that differs from the lockup root. Typography set on
   * the root is inherited by the wordmark, so pass only what has to differ.
   */
  wordmarkClassName?: string;
  className?: string;
  /** Extra props forwarded to the rendered link (aria-current, data-testid, …). */
  linkProps?: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "children">;
  children?: ReactNode;
}

/**
 * The one definition of the Mataresit lockup: brand mark + wordmark.
 *
 * Every surface that shows the company logo renders this, so the mark geometry
 * and colour rules stay identical. The wordmark is live text in the app's UI
 * font (Instrument Sans), which is what the brand sheet asks for; it is not
 * outlined, so the font has to stay available.
 */
export function LogoLockup({
  to = "/",
  href,
  label,
  markSize = "md",
  tone = "accent",
  wordmarkClassName,
  className,
  linkProps,
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
    "group inline-flex items-center gap-2.5 rounded-[6px] focus-visible:outline-none focus-visible:ring-2",
    TONE_FOCUS_CLASSES[tone],
    className,
  );

  if (href) {
    return (
      <a href={href} aria-label={label} className={sharedClassName} {...linkProps}>
        {content}
      </a>
    );
  }

  return (
    <Link to={to} aria-label={label} className={sharedClassName} {...linkProps}>
      {content}
    </Link>
  );
}
