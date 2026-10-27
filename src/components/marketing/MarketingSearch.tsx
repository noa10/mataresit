import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarketingSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  className?: string;
  inputClassName?: string;
  id?: string;
}

export function MarketingSearch({
  value,
  onChange,
  placeholder,
  label,
  className,
  inputClassName,
  id,
}: MarketingSearchProps) {
  return (
    <div className={cn("relative", className)}>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className={cn(
          "min-h-[54px] w-full rounded-[10px] border border-ledger-line-strong bg-ledger-surface px-[18px] pr-[52px] text-base text-ledger-ink transition-colors placeholder:text-ledger-muted focus:border-ledger-accent focus:outline-none focus:ring-[3px] focus:ring-ledger-accent-soft",
          inputClassName,
        )}
      />
      <span className="pointer-events-none absolute right-4 top-1/2 inline-flex -translate-y-1/2 text-ledger-muted">
        <Search aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.7} />
      </span>
    </div>
  );
}
