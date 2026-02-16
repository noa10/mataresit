import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Calendar as CalendarIcon, Check, DollarSign, Search, X } from "lucide-react";
import { format, startOfMonth, startOfQuarter, startOfToday, startOfYear, subDays } from "date-fns";
import { DateRange } from "react-day-picker";

import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CustomCategory } from "@/types/receipt";
import { cn } from "@/lib/utils";

type SortOrder = "newest" | "oldest" | "highest" | "lowest";

interface ReceiptFiltersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sortOrder: SortOrder;
  onSortChange: (value: SortOrder) => void;
  filterByCurrency: string | null;
  onCurrencyChange: (value: string | null) => void;
  filterByCategory: string | null;
  onCategoryChange: (value: string | null) => void;
  currencies: string[];
  categories: CustomCategory[];
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  onResetFilters: () => void;
  activeFilterCount: number;
  tDash: (key: string, options?: unknown) => string;
}

const sectionMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.22 },
};

const optionButtonBase =
  "flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const getDatePreset = (preset: "today" | "last7" | "month" | "quarter" | "year"): DateRange => {
  const today = startOfToday();

  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "last7":
      return { from: subDays(today, 6), to: today };
    case "month":
      return { from: startOfMonth(today), to: today };
    case "quarter":
      return { from: startOfQuarter(today), to: today };
    case "year":
      return { from: startOfYear(today), to: today };
    default:
      return { from: today, to: today };
  }
};

export function ReceiptFiltersSheet({
  open,
  onOpenChange,
  sortOrder,
  onSortChange,
  filterByCurrency,
  onCurrencyChange,
  filterByCategory,
  onCategoryChange,
  currencies,
  categories,
  dateRange,
  onDateRangeChange,
  onResetFilters,
  activeFilterCount,
  tDash,
}: ReceiptFiltersSheetProps) {
  const [categorySearch, setCategorySearch] = useState("");

  const sortOptions = useMemo(
    () => [
      {
        value: "newest" as const,
        label: tDash("sort.newest"),
        icon: CalendarIcon,
        aria: tDash("filtersSheet.aria.sortNewest"),
      },
      {
        value: "oldest" as const,
        label: tDash("sort.oldest"),
        icon: CalendarIcon,
        aria: tDash("filtersSheet.aria.sortOldest"),
      },
      {
        value: "highest" as const,
        label: tDash("sort.highest"),
        icon: DollarSign,
        aria: tDash("filtersSheet.aria.sortHighest"),
      },
      {
        value: "lowest" as const,
        label: tDash("sort.lowest"),
        icon: DollarSign,
        aria: tDash("filtersSheet.aria.sortLowest"),
      },
    ],
    [tDash],
  );

  const datePresets = useMemo(
    () => [
      { key: "today" as const, label: tDash("filtersSheet.datePresets.today") },
      { key: "last7" as const, label: tDash("filtersSheet.datePresets.last7") },
      { key: "month" as const, label: tDash("filtersSheet.datePresets.month") },
      { key: "quarter" as const, label: tDash("filtersSheet.datePresets.quarter") },
      { key: "year" as const, label: tDash("filtersSheet.datePresets.year") },
    ],
    [tDash],
  );

  const normalizedCategorySearch = categorySearch.trim().toLowerCase();

  const filteredCategories = useMemo(() => {
    if (!normalizedCategorySearch) {
      return categories;
    }

    return categories.filter((category) =>
      category.name.toLowerCase().includes(normalizedCategorySearch),
    );
  }, [categories, normalizedCategorySearch]);

  const groupedCategories = useMemo(() => {
    return {
      team: filteredCategories.filter((category) => category.is_team_category),
      personal: filteredCategories.filter((category) => !category.is_team_category),
    };
  }, [filteredCategories]);

  const hasGroupedCategories = groupedCategories.team.length > 0 || groupedCategories.personal.length > 0;

  const dateLabel = useMemo(() => {
    if (!dateRange?.from) {
      return tDash("filtersSheet.allDates");
    }

    if (!dateRange.to) {
      return `${tDash("filtersSheet.fromPrefix")} ${format(dateRange.from, "MMM d, yyyy")}`;
    }

    return `${format(dateRange.from, "MMM d, yyyy")} - ${format(dateRange.to, "MMM d, yyyy")}`;
  }, [dateRange, tDash]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-none overflow-y-auto border-l border-border/70 px-0 py-0 sm:max-w-[520px]"
      >
        <div
          className="min-h-full border-l border-white/5 bg-background"
          style={{
            backgroundImage:
              "radial-gradient(circle at top right, hsl(var(--primary) / 0.14), transparent 42%), radial-gradient(circle at bottom left, hsl(var(--accent) / 0.08), transparent 45%)",
          }}
        >
          <div className="sticky top-0 z-10 border-b border-border/60 bg-background/85 px-6 py-5 backdrop-blur-xl">
            <SheetHeader className="space-y-3 text-left">
              <div className="flex items-center justify-between gap-3">
                <SheetTitle className="text-lg font-semibold tracking-tight">
                  {tDash("filters.title")}
                </SheetTitle>
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
                    {activeFilterCount} {tDash("filtersSheet.activeCount")}
                  </Badge>
                )}
              </div>
              <SheetDescription className="text-sm text-muted-foreground">
                {tDash("filtersSheet.subtitle")}
              </SheetDescription>
            </SheetHeader>
          </div>

          <div className="space-y-5 px-6 py-5">
            <motion.section {...sectionMotion} className="rounded-2xl border border-border/60 bg-card/50 p-4 backdrop-blur-sm">
              <h3 className="mb-3 text-sm font-semibold text-foreground">{tDash("sort.title")}</h3>
              <div className="grid grid-cols-2 gap-2">
                {sortOptions.map((option) => {
                  const Icon = option.icon;
                  const selected = sortOrder === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-label={option.aria}
                      className={cn(
                        optionButtonBase,
                        selected
                          ? "border-primary/55 bg-primary/15 text-foreground shadow-sm"
                          : "border-border/70 bg-background/45 text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                      )}
                      onClick={() => onSortChange(option.value)}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </motion.section>

            <motion.section {...sectionMotion} transition={{ duration: 0.22, delay: 0.04 }} className="rounded-2xl border border-border/60 bg-card/50 p-4 backdrop-blur-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">{tDash("filters.dateRange")}</h3>
                <span className="text-xs text-muted-foreground">{dateLabel}</span>
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                {datePresets.map((preset) => (
                  <Button
                    key={preset.key}
                    variant="outline"
                    size="sm"
                    className="rounded-full border-border/70 bg-background/50"
                    onClick={() => onDateRangeChange(getDatePreset(preset.key))}
                    aria-label={`${tDash("filters.dateRange")}: ${preset.label}`}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              <div className="rounded-xl border border-border/70 bg-background/45 p-2">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={onDateRangeChange}
                  numberOfMonths={1}
                />
              </div>
            </motion.section>

            <motion.section {...sectionMotion} transition={{ duration: 0.22, delay: 0.08 }} className="rounded-2xl border border-border/60 bg-card/50 p-4 backdrop-blur-sm">
              <h3 className="mb-3 text-sm font-semibold text-foreground">{tDash("filters.currency")}</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-label={tDash("filtersSheet.aria.currencyAll")}
                  className={cn(
                    optionButtonBase,
                    !filterByCurrency
                      ? "border-primary/55 bg-primary/15 text-foreground"
                      : "border-border/70 bg-background/45 text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                  )}
                  onClick={() => onCurrencyChange(null)}
                >
                  {tDash("filtersSheet.all")}
                </button>
                {currencies.map((currency) => {
                  const selected = filterByCurrency === currency;

                  return (
                    <button
                      key={currency}
                      type="button"
                      aria-label={`${tDash("filters.currency")}: ${currency}`}
                      className={cn(
                        optionButtonBase,
                        selected
                          ? "border-primary/55 bg-primary/15 text-foreground"
                          : "border-border/70 bg-background/45 text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                      )}
                      onClick={() => onCurrencyChange(currency)}
                    >
                      {currency}
                    </button>
                  );
                })}
              </div>
            </motion.section>

            <motion.section {...sectionMotion} transition={{ duration: 0.22, delay: 0.12 }} className="rounded-2xl border border-border/60 bg-card/50 p-4 backdrop-blur-sm">
              <h3 className="mb-3 text-sm font-semibold text-foreground">{tDash("filters.category")}</h3>

              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={categorySearch}
                  onChange={(event) => setCategorySearch(event.target.value)}
                  placeholder={tDash("filtersSheet.categorySearchPlaceholder")}
                  className="pl-9"
                  aria-label={tDash("filtersSheet.aria.categorySearch")}
                />
              </div>

              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-label={tDash("filtersSheet.aria.categoryAll")}
                  className={cn(
                    optionButtonBase,
                    !filterByCategory
                      ? "border-primary/55 bg-primary/15 text-foreground"
                      : "border-border/70 bg-background/45 text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                  )}
                  onClick={() => onCategoryChange(null)}
                >
                  {tDash("filtersSheet.all")}
                </button>
                <button
                  type="button"
                  aria-label={tDash("filtersSheet.aria.categoryUncategorized")}
                  className={cn(
                    optionButtonBase,
                    filterByCategory === "uncategorized"
                      ? "border-primary/55 bg-primary/15 text-foreground"
                      : "border-border/70 bg-background/45 text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                  )}
                  onClick={() => onCategoryChange("uncategorized")}
                >
                  {tDash("filtersSheet.uncategorized")}
                </button>
              </div>

              <div className="max-h-[300px] space-y-3 overflow-y-auto pr-1">
                {groupedCategories.team.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {tDash("filtersSheet.groups.team")}
                    </p>
                    <div className="space-y-1.5">
                      {groupedCategories.team.map((category) => {
                        const selected = filterByCategory === category.id;

                        return (
                          <button
                            key={category.id}
                            type="button"
                            aria-label={`${tDash("filters.category")}: ${category.name}`}
                            className={cn(
                              "flex w-full min-h-10 items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                              selected
                                ? "border-primary/55 bg-primary/15 text-foreground"
                                : "border-border/70 bg-background/45 text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                            )}
                            onClick={() => onCategoryChange(category.id)}
                          >
                            <span className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: category.color }}
                              />
                              <span>{category.name}</span>
                            </span>
                            <span className="flex items-center gap-2 text-xs">
                              {category.receipt_count ?? 0}
                              {selected && <Check className="h-4 w-4" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {groupedCategories.personal.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {tDash("filtersSheet.groups.personal")}
                    </p>
                    <div className="space-y-1.5">
                      {groupedCategories.personal.map((category) => {
                        const selected = filterByCategory === category.id;

                        return (
                          <button
                            key={category.id}
                            type="button"
                            aria-label={`${tDash("filters.category")}: ${category.name}`}
                            className={cn(
                              "flex w-full min-h-10 items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                              selected
                                ? "border-primary/55 bg-primary/15 text-foreground"
                                : "border-border/70 bg-background/45 text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                            )}
                            onClick={() => onCategoryChange(category.id)}
                          >
                            <span className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: category.color }}
                              />
                              <span>{category.name}</span>
                            </span>
                            <span className="flex items-center gap-2 text-xs">
                              {category.receipt_count ?? 0}
                              {selected && <Check className="h-4 w-4" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {!hasGroupedCategories && (
                  <p className="rounded-xl border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground">
                    {tDash("filtersSheet.noCategories")}
                  </p>
                )}
              </div>
            </motion.section>
          </div>

          <div className="sticky bottom-0 border-t border-border/60 bg-background/85 px-6 py-4 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <Button variant="outline" className="flex-1" onClick={onResetFilters}>
                {tDash("filters.clear")}
              </Button>
              <Button className="flex-1 gap-2" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
                {tDash("filtersSheet.done")}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
