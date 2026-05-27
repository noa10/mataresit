import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DuplicateGroup } from "@/types/duplicateDetection";
import { cn } from "@/lib/utils";

interface DuplicateGroupCardProps {
  group: DuplicateGroup;
  onToggleReceipt: (receiptId: string, checked: boolean) => void;
  checkedIds: Set<string>;
  groupIndex: number;
}

export function DuplicateGroupCard({
  group,
  onToggleReceipt,
  checkedIds,
  groupIndex,
}: DuplicateGroupCardProps) {
  const { t } = useTranslation("duplicateDetection");
  const [isExpanded, setIsExpanded] = useState(true);

  const toggleExpand = () => setIsExpanded((prev) => !prev);

  return (
    <Card className="overflow-hidden border-border/60 shadow-sm">
      {/* Header - clickable to expand/collapse */}
      <CardHeader
        className="flex flex-row items-center gap-3 cursor-pointer hover:bg-muted/30 transition-colors p-4"
        onClick={toggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleExpand();
          }
        }}
        aria-expanded={isExpanded}
      >
        <span className="text-muted-foreground transition-transform duration-200">
          {isExpanded ? (
            <ChevronDown size={18} />
          ) : (
            <ChevronRight size={18} />
          )}
        </span>
        <h3 className="font-semibold text-sm sm:text-base truncate">
          {t("groupLabel", { n: groupIndex + 1 })} — {group.matchCriteria}
        </h3>
        <span className="ml-auto text-xs text-muted-foreground shrink-0">
          {group.receipts.length} receipts
        </span>
      </CardHeader>

      {/* Body - receipt rows */}
      {isExpanded && (
        <CardContent className="p-0">
          <div className="divide-y divide-border/50">
            {group.receipts.map((receipt) => {
              const isKept = receipt.id === group.keptReceiptId;
              const isChecked = checkedIds.has(receipt.id);

              return (
                <div
                  key={receipt.id}
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3 transition-colors",
                    isKept ? "bg-muted/20" : "hover:bg-muted/10"
                  )}
                >
                  {/* Checkbox */}
                  <div className="shrink-0 flex items-center">
                    <Checkbox
                      checked={isChecked}
                      disabled={isKept}
                      onCheckedChange={(checked) => {
                        onToggleReceipt(receipt.id, checked === true);
                      }}
                      aria-label={
                        isKept
                          ? t("keptLabel")
                          : `${receipt.merchant} - ${receipt.total}`
                      }
                    />
                  </div>

                  {/* Receipt info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {receipt.merchant}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(receipt.date).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Total */}
                  <div className="shrink-0 text-sm font-medium tabular-nums">
                    {receipt.currency} {receipt.total.toFixed(2)}
                  </div>

                  {/* Badge */}
                  <div className="shrink-0">
                    {isKept ? (
                      <Badge
                        variant="default"
                        className="bg-green-600 hover:bg-green-700 text-xs"
                      >
                        {t("keptLabel")}
                      </Badge>
                    ) : (
                      <Badge
                        variant="default"
                        className="bg-amber-500 hover:bg-amber-600 text-xs"
                      >
                        {t("duplicateLabel")}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
