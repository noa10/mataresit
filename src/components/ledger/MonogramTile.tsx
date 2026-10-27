import { cn } from "@/lib/utils";

interface MonogramTileProps {
  name: string;
  className?: string;
}

const getInitials = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "R";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
};

/** Square merchant initials tile used in receipt rows and queue cards. */
export function MonogramTile({ name, className }: MonogramTileProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[6px] border border-ledger-line bg-ledger-surface-2 font-data text-[0.625rem] tracking-[0.02em] text-ledger-ink-2",
        className
      )}
    >
      {getInitials(name)}
    </span>
  );
}
