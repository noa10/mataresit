import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useHomepageTranslation } from "@/contexts/LanguageContext";
import { MarketingBrand } from "@/components/marketing/MarketingBrand";

const linkClassName =
  "flex min-h-11 items-center text-sm leading-[1.6] text-ledger-ink-2 underline-offset-[3px] hover:text-ledger-accent hover:underline";

export function MarketingFooter() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { t } = useHomepageTranslation();

  const copy = (key: string) => String(t(key));
  const isHome = pathname === "/";
  const howHref = isHome ? "#how" : "/#how";
  const workspaceTarget = user ? "/dashboard" : "/auth";
  const receiptsTarget = user ? "/receipts" : "/auth";
  const reviewTarget = user ? "/review" : "/auth";
  const uploadTarget = user ? "/receipts?upload=1" : "/auth";

  return (
    <footer className="bg-ledger-paper">
      <div className="mx-auto grid w-full max-w-[1240px] grid-cols-1 gap-8 px-5 pb-7 pt-11 min-[641px]:grid-cols-2 min-[641px]:gap-12 min-[881px]:grid-cols-[1.4fr_1fr_1fr] min-[881px]:px-6 min-[881px]:pb-8 min-[881px]:pt-14">
        <div className="min-[641px]:col-span-2 min-[881px]:col-span-1">
          <div className="mb-3.5">
            <MarketingBrand />
          </div>
          <p className="max-w-[34ch] text-[0.875rem] leading-[1.6] text-ledger-muted">
            {copy("footer.blurb")}
          </p>
        </div>

        <div>
          <p className="mb-3.5 font-data text-[0.6875rem] uppercase tracking-[0.14em] text-ledger-muted">
            {copy("footer.product.title")}
          </p>
          <ul className="grid gap-0.5">
            <li>
              <Link to="/features" className={linkClassName}>
                {copy("footer.product.features")}
              </Link>
            </li>
            <li>
              <Link to="/pricing" className={linkClassName}>
                {copy("footer.product.pricing")}
              </Link>
            </li>
            <li>
              <a href={howHref} className={linkClassName}>
                {copy("footer.product.howItWorks")}
              </a>
            </li>
            <li>
              <Link to={workspaceTarget} className={linkClassName}>
                {copy("footer.product.workspaceOverview")}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="mb-3.5 font-data text-[0.6875rem] uppercase tracking-[0.14em] text-ledger-muted">
            {copy("footer.workspace.title")}
          </p>
          <ul className="grid gap-0.5">
            <li>
              <Link to={receiptsTarget} className={linkClassName}>
                {copy("footer.workspace.inbox")}
              </Link>
            </li>
            <li>
              <Link to={reviewTarget} className={linkClassName}>
                {copy("footer.workspace.review")}
              </Link>
            </li>
            <li>
              <Link to={uploadTarget} className={linkClassName}>
                {copy("footer.workspace.upload")}
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1240px] flex-wrap justify-between gap-x-6 gap-y-2 border-t border-ledger-line px-6 pb-7 pt-4 font-data text-[0.6875rem] tracking-[0.02em] text-ledger-muted">
        <span>{String(t("footer.copyright", { year: new Date().getFullYear() }))}</span>
        <span>{copy("footer.tagline")}</span>
      </div>
    </footer>
  );
}
