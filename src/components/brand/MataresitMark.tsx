import { useId } from "react";

const MARK_PATH =
  "M2.4 7.05L4 5.15L5.6 7.05L7.2 5.15L8.8 7.05L10.4 5.15L12 7.05L13.6 5.15L15.2 7.05L16.8 5.15L18.4 7.05L20 5.15L21.6 7.05V21H2.4Z " +
  "M5.2 9.4H16.8V10.9H5.2Z " +
  "M5.2 12.7H20.2V14.2H5.2Z " +
  "M5.2 16H13.6V17.5H5.2Z " +
  "M5.2 18.8H18.4V20.3H5.2Z";

interface MataresitMarkProps {
  /** Accessible name. Omitted leaves the mark decorative (`aria-hidden`). */
  title?: string;
  className?: string;
  /** Enables the single scanner pass on hover/focus of the parent lockup. */
  scan?: boolean;
}

/**
 * Mataresit brand mark — "a receipt read back as data".
 *
 * One path, even-odd fill: the torn top edge, the flat cut base, and four
 * extracted rows that are true holes rather than painted strokes. Fills with
 * `currentColor`, so colour comes from the surrounding text colour.
 *
 * Drawn on a 24 x 24 canvas; never render it below 16 px (see BRAND-NOTES.md).
 */
export function MataresitMark({ title, className, scan = false }: MataresitMarkProps) {
  const clipId = `mataresit-scan-${useId().replace(/:/g, "")}`;
  const labelled = Boolean(title);

  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      role={labelled ? "img" : undefined}
      aria-hidden={labelled ? undefined : true}
      aria-label={title}
      focusable="false"
      data-mark="mataresit"
    >
      {scan ? (
        <defs>
          <clipPath id={clipId}>
            <path fillRule="evenodd" d={MARK_PATH} />
          </clipPath>
        </defs>
      ) : null}
      <path fillRule="evenodd" d={MARK_PATH} />
      {scan ? (
        <g clipPath={`url(#${clipId})`} aria-hidden="true">
          <rect className="mataresit-mark__scan" x="2.4" y="0" width="19.2" height="2.6" />
        </g>
      ) : null}
    </svg>
  );
}
