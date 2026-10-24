import type { ReactNode } from "react";

interface MarketingPageHeroProps {
  eyebrow: string;
  titleLead: string;
  titleAccent?: string;
  lede?: string;
  note?: string;
  children?: ReactNode;
}

export function MarketingPageHero({
  eyebrow,
  titleLead,
  titleAccent,
  lede,
  note,
  children,
}: MarketingPageHeroProps) {
  return (
    <section className="border-b border-ledger-line">
      <div className="mx-auto w-full max-w-[1240px] px-5 pb-12 pt-16 min-[881px]:px-6">
        <p className="font-data text-[0.6875rem] uppercase tracking-[0.16em] text-ledger-muted">
          {eyebrow}
        </p>
        <h1 className="mt-4 font-display text-[clamp(2.6rem,5vw,4.25rem)] font-normal leading-[1.02] tracking-[-0.026em] text-ledger-ink">
          {titleLead}
          {titleAccent ? (
            <>
              {" "}
              <em className="italic text-ledger-accent">{titleAccent}</em>
            </>
          ) : null}
        </h1>
        {lede ? (
          <p className="mt-[18px] max-w-[52ch] text-[1.125rem] leading-[1.6] text-ledger-muted">
            {lede}
          </p>
        ) : null}
        {note ? (
          <p className="mt-5 font-data text-[0.6875rem] tracking-[0.06em] text-ledger-muted">
            {note}
          </p>
        ) : null}
        {children}
      </div>
    </section>
  );
}
