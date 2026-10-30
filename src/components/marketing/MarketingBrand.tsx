import { useLocation } from "react-router-dom";
import { LogoLockup } from "@/components/brand/LogoLockup";

const brandClassName =
  "min-h-11 text-[1.0625rem] [font-weight:650] tracking-[-0.01em] text-ledger-ink";

const wordmarkClassName = "text-[1.0625rem] [font-weight:650] tracking-[-0.01em]";

/**
 * Marketing-site brand link. On the landing page it scrolls back to the top
 * instead of pushing a new history entry; elsewhere it navigates home.
 */
export function MarketingBrand({ label = "Mataresit home" }: { label?: string }) {
  const { pathname } = useLocation();

  return (
    <LogoLockup
      href={pathname === "/" ? "#top" : undefined}
      to="/"
      label={label}
      className={brandClassName}
      wordmarkClassName={wordmarkClassName}
    />
  );
}
