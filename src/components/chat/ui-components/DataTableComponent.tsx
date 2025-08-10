/**
 * Data Table UI Component for Chat Interface
 * 
 * Renders an interactive data table with sorting, searching, and pagination capabilities.
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Filter,
  Download,
  MoreHorizontal,
  Eye,
  EyeOff
} from 'lucide-react';
import { DataTableData, UIComponentProps } from '@/types/ui-components';
import { formatCurrencySafe } from '@/utils/currency';
import { cn } from '@/lib/utils';

interface DataTableComponentProps extends Omit<UIComponentProps, 'component'> {
  data: DataTableData;
  onAction?: (action: string, data?: any) => void;
  className?: string;
  compact?: boolean;
}

export function DataTableComponent({
  data,
  onAction,
  className = '',
  compact = false
}: DataTableComponentProps) {
  // 🔍 DEBUG: Log data table component data
  console.log('🔍 DEBUG: DataTableComponent received data:', {
    hasData: !!data,
    columnsCount: data?.columns?.length || 0,
    rowsCount: data?.rows?.length || 0,
    columns: data?.columns?.map(col => ({ key: col.key, label: col.label })),
    firstRowData: data?.rows?.[0],
    searchable: data?.searchable,
    sortable: data?.sortable,
    pagination: data?.pagination
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(data.columns.map(col => col.key))
  );
  const [showFilters, setShowFilters] = useState(false);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const rowsPerPage = compact ? 5 : 10;

  // Filter rows based on search term and column filters
  const filteredRows = useMemo(() => {
    let filtered = data.rows;

    // Apply global search filter
    if (searchTerm && data.searchable) {
      filtered = filtered.filter(row =>
        Object.values(row).some(value =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Apply column-specific filters
    Object.entries(columnFilters).forEach(([columnKey, filterValue]) => {
      if (filterValue.trim()) {
        filtered = filtered.filter(row => {
          const cellValue = String(row[columnKey] || '').toLowerCase();
          return cellValue.includes(filterValue.toLowerCase());
        });
      }
    });

    return filtered;
  }, [data.rows, searchTerm, data.searchable, columnFilters]);

  // Sort rows
  const sortedRows = useMemo(() => {
    if (!sortColumn || !data.sortable) return filteredRows;

    return [...filteredRows].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];

      // Handle different data types
      let comparison = 0;
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else if (aValue instanceof Date && bValue instanceof Date) {
        comparison = aValue.getTime() - bValue.getTime();
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredRows, sortColumn, sortDirection, data.sortable]);

  // Paginate rows
  const paginatedRows = useMemo(() => {
    if (!data.pagination) return sortedRows;
    
    const startIndex = (currentPage - 1) * rowsPerPage;
    return sortedRows.slice(startIndex, startIndex + rowsPerPage);
  }, [sortedRows, currentPage, rowsPerPage, data.pagination]);

  const totalPages = Math.ceil(sortedRows.length / rowsPerPage);

  // Handle column sorting
  const handleSort = (columnKey: string) => {
    const column = data.columns.find(col => col.key === columnKey);
    if (!column?.sortable || !data.sortable) return;

    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  // Enhanced cell value formatting with better styling
  const formatCellValue = (value: any, column: any) => {
    if (value === null || value === undefined || value === '') {
      return <span className="text-muted-foreground text-xs">—</span>;
    }

    switch (column.type) {
      case 'currency':
        const formattedCurrency = formatCurrencySafe(value, data.currency || 'MYR', 'en-US', 'MYR');
        return (
          <span className="font-mono text-sm font-medium">
            {formattedCurrency}
          </span>
        );

      case 'date':
        try {
          const date = new Date(value);
          const formatted = date.toLocaleDateString('en-MY', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });
          return (
            <span className="text-sm" title={date.toLocaleString()}>
              {formatted}
            </span>
          );
        } catch {
          return <span className="text-sm">{String(value)}</span>;
        }

      case 'badge':
        return (
          <Badge
            variant="secondary"
            className="text-xs font-medium px-2 py-1"
          >
            {String(value)}
          </Badge>
        );

      case 'action':
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAction?.(value.action, value.data)}
            className="h-7 w-7 p-0 hover:bg-muted"
            title="View details"
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        );

      case 'number':
        const numValue = typeof value === 'number' ? value : parseFloat(value);
        if (!isNaN(numValue)) {
          return (
            <span className="font-mono text-sm">
              {numValue.toLocaleString()}
            </span>
          );
        }
        return <span className="text-sm">{String(value)}</span>;

      default:
        const stringValue = String(value);
        return (
          <span
            className="text-sm"
            title={stringValue.length > 30 ? stringValue : undefined}
          >
            {stringValue}
          </span>
        );
    }
  };

  // Get sort icon for column
  const getSortIcon = (columnKey: string) => {
    if (sortColumn !== columnKey) {
      return <ArrowUpDown className="h-3 w-3 text-muted-foreground" />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="h-3 w-3" />
      : <ArrowDown className="h-3 w-3" />;
  };

  // Toggle column visibility
  const toggleColumnVisibility = (columnKey: string) => {
    setVisibleColumns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(columnKey)) {
        newSet.delete(columnKey);
      } else {
        newSet.add(columnKey);
      }
      return newSet;
    });
  };

  // Update column filter
  const updateColumnFilter = (columnKey: string, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [columnKey]: value
    }));
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSearchTerm('');
    setColumnFilters({});
  };

  // Get visible columns
  const visibleColumnsData = data.columns.filter(col => visibleColumns.has(col.key));

  return (
    <Card className={`${className}`}>
      {(data.title || data.subtitle) && (
        <CardHeader className={compact ? "pb-3" : "pb-4"}>
          {data.title && (
            <CardTitle className={compact ? "text-base" : "text-lg"}>
              {data.title}
            </CardTitle>
          )}
          {data.subtitle && (
            <p className="text-sm text-muted-foreground">{data.subtitle}</p>
          )}
        </CardHeader>
      )}

      <CardContent className={compact ? "p-3" : "p-4"}>
        {/* Enhanced Controls */}
        <div className="space-y-4 mb-4">
          {/* Search and Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-2">
            {data.searchable && (
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search table..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Filters
              </Button>

              {/* Column Visibility Toggle */}
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Eye className="h-4 w-4" />
                  Columns
                </Button>
              </div>

              {(searchTerm || Object.keys(columnFilters).length > 0) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="text-muted-foreground"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Column Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-3 bg-muted/50 rounded-lg">
              {visibleColumnsData.map((column) => (
                <div key={column.key} className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {column.label}
                  </label>
                  <Input
                    placeholder={`Filter ${column.label.toLowerCase()}...`}
                    value={columnFilters[column.key] || ''}
                    onChange={(e) => updateColumnFilter(column.key, e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Enhanced Table with Mobile Responsiveness */}
        <div className="rounded-md border overflow-hidden">
          <ScrollArea className="w-full">
            <div className="min-w-full">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {visibleColumnsData.map((column) => (
                      <TableHead
                        key={column.key}
                        className={cn(
                          "font-semibold text-xs uppercase tracking-wide",
                          column.align === 'center' ? 'text-center' :
                          column.align === 'right' ? 'text-right' : 'text-left',
                          column.sortable && data.sortable ?
                            'cursor-pointer hover:bg-muted/50 transition-colors select-none' : ''
                        )}
                        style={{ width: column.width }}
                        onClick={() => handleSort(column.key)}
                      >
                        <div className={cn(
                          "flex items-center gap-1",
                          column.align === 'center' ? 'justify-center' :
                          column.align === 'right' ? 'justify-end' : 'justify-start'
                        )}>
                          <span className="truncate">{column.label}</span>
                          {column.sortable && data.sortable && (
                            <div className="flex-shrink-0">
                              {getSortIcon(column.key)}
                            </div>
                          )}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={visibleColumnsData.length}
                        className="text-center py-12 text-muted-foreground"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <Search className="h-8 w-8 text-muted-foreground/50" />
                          <p className="text-sm">No data found</p>
                          {(searchTerm || Object.keys(columnFilters).length > 0) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={clearAllFilters}
                              className="text-xs"
                            >
                              Clear filters
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedRows.map((row, index) => (
                      <TableRow
                        key={row.id}
                        className={cn(
                          "hover:bg-muted/50 transition-colors",
                          index % 2 === 0 ? "bg-background" : "bg-muted/20"
                        )}
                      >
                        {visibleColumnsData.map((column) => (
                          <TableCell
                            key={`${row.id}-${column.key}`}
                            className={cn(
                              "py-3 text-sm",
                              column.align === 'center' ? 'text-center' :
                              column.align === 'right' ? 'text-right' : 'text-left'
                            )}
                          >
                            <div className="truncate max-w-[200px]" title={String(row[column.key])}>
                              {formatCellValue(row[column.key], column)}
                            </div>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        </div>

        {/* Enhanced Pagination and Summary */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-6 pt-4 border-t border-border/50">
          {/* Results Summary */}
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              Showing {paginatedRows.length === 0 ? 0 : ((currentPage - 1) * rowsPerPage) + 1} to{' '}
              {Math.min(currentPage * rowsPerPage, sortedRows.length)} of {sortedRows.length} results
            </p>
            {(searchTerm || Object.keys(columnFilters).length > 0) && (
              <p className="text-xs">
                Filtered from {data.rows.length} total records
              </p>
            )}
          </div>

          {/* Pagination Controls */}
          {data.pagination && totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="hidden sm:flex"
              >
                First
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only sm:not-sr-only sm:ml-1">Previous</span>
              </Button>

              {/* Page Numbers */}
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className="w-8 h-8 p-0 hidden sm:flex"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>

              <span className="text-sm text-muted-foreground sm:hidden">
                {currentPage} / {totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                <span className="sr-only sm:not-sr-only sm:mr-1">Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="hidden sm:flex"
              >
                Last
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
