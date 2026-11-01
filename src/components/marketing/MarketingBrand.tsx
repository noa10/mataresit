import { useLocation } from "react-router-dom";
import { LogoLockup } from "@/components/brand/LogoLockup";
import { useNavigationTranslation } from "@/contexts/LanguageContext";

const brandClassName =
  "min-h-11 text-[1.0625rem] [font-weight:650] tracking-[-0.01em] text-ledger-ink";

/**
 * Marketing-site brand link. On the landing page it scrolls back to the top
 * instead of pushing a new history entry; elsewhere it navigates home.
 *
 * The lockup root carries the typography and the wordmark inherits it, so the
 * wordmark only has to say what is different about it.
 */
export function MarketingBrand({ label }: { label?: string }) {
  const { pathname } = useLocation();
  const { t } = useNavigationTranslation();

  return (
    <LogoLockup
      href={pathname === "/" ? "#top" : undefined}
      to="/"
      label={label ?? t("brand.home")}
      className={brandClassName}
    />
  );
}
