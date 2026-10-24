import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface MarketingCtaBandProps {
  eyebrow: string;
  title: string;
  lede: string;
  primary: { label: string; to: string };
  secondary: { label: string; to: string };
}

export function MarketingCtaBand({
  eyebrow,
  title,
  lede,
  primary,
  secondary,
}: MarketingCtaBandProps) {
  return (
    <section className="bg-ledger-panel text-ledger-on-panel">
      <div className="mx-auto flex w-full max-w-[1240px] flex-wrap items-end justify-between gap-12 px-5 py-14 min-[881px]:items-end min-[881px]:px-6 min-[881px]:py-[72px]">
        <div className="max-w-[640px]">
          <p className="mt-3.5 font-data text-[0.6875rem] uppercase tracking-[0.16em] text-ledger-on-panel-muted">
            {eyebrow}
          </p>
          <h2 className="mt-3.5 font-display text-[clamp(2rem,4vw,3.25rem)] font-normal leading-[1.04] tracking-[-0.02em] text-ledger-on-panel">
            {title}
          </h2>
          <p className="mt-3.5 max-w-[48ch] text-[1.0625rem] leading-[1.6] text-ledger-on-panel-muted">
            {lede}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 max-[640px]:w-full">
          <Button
            asChild
            variant="ghost"
            className="h-[46px] rounded-lg bg-ledger-on-panel px-5 text-[0.9375rem] font-semibold text-ledger-panel hover:bg-white hover:text-ledger-panel max-[640px]:w-full"
          >
            <Link to={primary.to}>{primary.label}</Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="h-[46px] rounded-lg border border-[rgba(241,242,238,0.34)] px-5 text-[0.9375rem] font-semibold text-ledger-on-panel hover:border-ledger-on-panel hover:bg-[rgba(241,242,238,0.09)] hover:text-ledger-on-panel max-[640px]:w-full"
          >
            <Link to={secondary.to}>{secondary.label}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
