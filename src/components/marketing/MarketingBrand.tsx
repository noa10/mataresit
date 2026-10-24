import { Link, useLocation } from "react-router-dom";

const brandClassName =
  "inline-flex min-h-11 items-center gap-2.5 text-[1.0625rem] [font-weight:650] tracking-[-0.01em] text-ledger-ink";

const markClassName =
  "grid h-8 w-8 place-items-center rounded-[7px] bg-ledger-ink pt-0.5 font-display text-[1.35rem] leading-none text-ledger-paper";

export function MarketingBrand({ label = "Mataresit home" }: { label?: string }) {
  const { pathname } = useLocation();

  if (pathname === "/") {
    return (
      <a href="#top" aria-label={label} className={brandClassName}>
        <span aria-hidden="true" className={markClassName}>
          M
        </span>
        <span>Mataresit</span>
      </a>
    );
  }

  return (
    <Link to="/" aria-label={label} className={brandClassName}>
      <span aria-hidden="true" className={markClassName}>
        M
      </span>
      <span>Mataresit</span>
    </Link>
  );
}
