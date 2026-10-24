import { format, parseISO } from "date-fns";
import { formatCurrencySafe } from "@/utils/currency";
import { cn } from "@/lib/utils";

export interface ReceiptPaperItem {
  name: string;
  qty?: number;
  price: number;
}

interface ReceiptPaperProps {
  merchant: string;
  date: string;
  location?: string | null;
  items?: ReceiptPaperItem[];
  subtotal?: number | null;
  tax?: number | null;
  total: number;
  currency: string;
  payment?: string | null;
  className?: string;
}

const formatPaperDate = (value: string): string => {
  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, "dd MMM yyyy");
};

/**
 * Receipt rendered as paper. Intentionally light in both themes: this is the
 * physical artifact, not a themed surface.
 */
export function ReceiptPaper({
  merchant,
  date,
  location,
  items = [],
  subtotal,
  tax,
  total,
  currency,
  payment,
  className,
}: ReceiptPaperProps) {
  return (
    <article
      className={cn(
        "rounded-[10px] border border-[#E3E4DC] bg-[#FCFCF8] px-6 py-7 text-[#121715] shadow-[0_24px_50px_-34px_rgba(0,0,0,0.55)]",
        className
      )}
    >
      <header className="text-center">
        <p className="font-data text-[0.58rem] uppercase tracking-[0.2em] text-[#7A7F75]">
          Receipt
        </p>
        <h3 className="mt-2 font-display text-[1.7rem] leading-tight">{merchant}</h3>
        {location && <p className="mt-1 text-xs text-[#6B7168]">{location}</p>}
      </header>

      <div className="my-4 border-t border-dashed border-[#D7D9D0]" />

      <div className="flex items-center justify-between gap-3 font-data text-[0.62rem] uppercase tracking-[0.12em] text-[#6B7168]">
        <span>{formatPaperDate(date)}</span>
        {payment && <span className="truncate text-right">{payment}</span>}
      </div>

      {items.length > 0 && (
        <ul className="mt-4 space-y-2.5">
          {items.map((item, index) => (
            <li
              key={`${item.name}-${index}`}
              className="flex items-baseline justify-between gap-4 text-sm"
            >
              <span className="min-w-0">
                {item.name}
                {item.qty && item.qty > 1 ? (
                  <span className="ml-1.5 font-data text-[0.65rem] text-[#8A9086]">
                    ×{item.qty}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 font-data tabular-nums">
                {formatCurrencySafe(item.price, currency)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="my-4 border-t border-dashed border-[#D7D9D0]" />

      <dl className="space-y-1.5 font-data text-xs">
        {subtotal !== null && subtotal !== undefined && (
          <div className="flex items-center justify-between text-[#4C534B]">
            <dt>Subtotal</dt>
            <dd className="tabular-nums">{formatCurrencySafe(subtotal, currency)}</dd>
          </div>
        )}
        {tax !== null && tax !== undefined && (
          <div className="flex items-center justify-between text-[#4C534B]">
            <dt>Tax</dt>
            <dd className="tabular-nums">{formatCurrencySafe(tax, currency)}</dd>
          </div>
        )}
        <div className="flex items-baseline justify-between pt-2 text-[0.95rem] font-medium text-[#121715]">
          <dt className="font-sans text-sm">Total</dt>
          <dd className="tabular-nums">{formatCurrencySafe(total, currency)}</dd>
        </div>
      </dl>

      <p className="mt-6 text-center font-data text-[0.56rem] uppercase tracking-[0.2em] text-[#9AA096]">
        Thank you
      </p>
    </article>
  );
}
