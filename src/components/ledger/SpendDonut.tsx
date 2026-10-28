import { useDashboardTranslation } from "@/contexts/LanguageContext";
import { formatCurrencySafe } from "@/utils/currency";
import { cn } from "@/lib/utils";

export interface SpendDonutDatum {
  name: string;
  total: number;
}

interface SpendDonutProps {
  data: SpendDonutDatum[];
  currency: string;
  total?: number;
  className?: string;
}

const CHART_COLORS = [
  "var(--ledger-chart-1)",
  "var(--ledger-chart-2)",
  "var(--ledger-chart-3)",
  "var(--ledger-chart-4)",
  "var(--ledger-chart-5)",
];

const SIZE = 210;
const STROKE = 22;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Hand-rolled SVG donut so the chart matches the design exactly without
 * pulling a charting dependency into the overview bundle.
 */
export function SpendDonut({ data, currency, total, className }: SpendDonutProps) {
  const { t } = useDashboardTranslation();
  const safeData = data.filter((entry) => entry.total > 0).slice(0, CHART_COLORS.length);
  const sum = total ?? safeData.reduce((acc, entry) => acc + entry.total, 0);
  const remainder = data
    .filter((entry) => entry.total > 0)
    .slice(CHART_COLORS.length)
    .reduce((acc, entry) => acc + entry.total, 0);

  const segments = safeData.reduce<
    Array<{ name: string; dash: number; offset: number; color: string }>
  >((acc, entry, index) => {
    const dash = (entry.total / (sum || 1)) * CIRCUMFERENCE;
    const previous = acc[acc.length - 1];
    const offset = previous ? previous.offset + previous.dash : 0;
    return acc.concat({
      name: entry.name,
      dash,
      offset,
      color: CHART_COLORS[index],
    });
  }, []);

  return (
    <div className={cn("flex flex-col items-center gap-6 sm:flex-row sm:items-center", className)}>
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={t("workspace.donut.ariaLabel", {
            total: formatCurrencySafe(sum, currency),
          })}
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--ledger-line)"
            strokeWidth={STROKE}
          />
          {sum > 0 && (
            <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
              {segments.map((segment) => (
                <circle
                  key={segment.name}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={STROKE}
                  strokeDasharray={`${Math.max(segment.dash - 2, 0)} ${CIRCUMFERENCE}`}
                  strokeDashoffset={-segment.offset}
                />
              ))}
            </g>
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
          <span className="font-data text-[17px] font-medium leading-none text-ledger-ink tabular-nums">
            {formatCurrencySafe(sum, currency)}
          </span>
          <span className="font-data text-[0.56rem] uppercase tracking-[0.16em] text-ledger-muted">
            {t("workspace.donut.total")}
          </span>
        </div>
      </div>

      <div className="w-full min-w-0 space-y-2.5">
        {safeData.length === 0 ? (
          <p className="text-sm text-ledger-muted">{t("workspace.donut.empty")}</p>
        ) : (
          safeData.map((entry, index) => (
            <div
              key={entry.name}
              className="grid grid-cols-[10px_minmax(0,1fr)_auto_42px] items-center gap-2.5 text-[0.8125rem]"
            >
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: CHART_COLORS[index] }}
              />
              <span className="min-w-0 truncate text-ledger-ink-2">{entry.name || t("workspace.detail.uncategorized")}</span>
              <span className="font-data text-xs tabular-nums text-ledger-ink">
                {formatCurrencySafe(entry.total, currency)}
              </span>
              <span className="text-right font-data text-[0.68rem] tabular-nums text-ledger-muted">
                {Math.round((entry.total / (sum || 1)) * 100)}%
              </span>
            </div>
          ))
        )}
        {remainder > 0 && (
          <p className="pt-1 font-data text-[0.62rem] uppercase tracking-[0.12em] text-ledger-muted">
            {t("workspace.donut.other", { amount: formatCurrencySafe(remainder, currency) })}
          </p>
        )}
      </div>
    </div>
  );
}
