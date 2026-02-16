import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDashboardTranslation } from "@/contexts/LanguageContext";

interface ReceiptsPaginationProps {
  page: number;
  limit: 10 | 25 | 50;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: 10 | 25 | 50) => void;
  isLoading?: boolean;
}

export function ReceiptsPagination({
  page,
  limit,
  total,
  totalPages,
  hasNextPage,
  hasPrevPage,
  onPageChange,
  onLimitChange,
  isLoading = false,
}: ReceiptsPaginationProps) {
  const { t: tDash } = useDashboardTranslation();
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" data-testid="dashboard-pagination">
      <p className="text-sm text-muted-foreground" data-testid="dashboard-pagination-summary">
        {tDash("pagination.showing", { start, end, total })}
      </p>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{tDash("pagination.perPage")}</span>
          <Select
            value={String(limit)}
            onValueChange={(value) => onLimitChange(Number(value) as 10 | 25 | 50)}
            disabled={isLoading}
          >
            <SelectTrigger className="w-[110px]" data-testid="dashboard-page-size-select">
              <SelectValue placeholder={tDash("pagination.perPage")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Pagination className="w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  if (!hasPrevPage || isLoading) return;
                  onPageChange(page - 1);
                }}
                aria-disabled={!hasPrevPage || isLoading}
                className={!hasPrevPage || isLoading ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>

            <PaginationItem className="px-2 text-sm text-muted-foreground" data-testid="dashboard-pagination-page">
              {tDash("pagination.pageOf", { page, totalPages: Math.max(totalPages, 1) })}
            </PaginationItem>

            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  if (!hasNextPage || isLoading) return;
                  onPageChange(page + 1);
                }}
                aria-disabled={!hasNextPage || isLoading}
                className={!hasNextPage || isLoading ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}

export type { ReceiptsPaginationProps };
