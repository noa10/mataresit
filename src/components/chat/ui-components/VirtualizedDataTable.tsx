/**
 * Virtualized Data Table Component
 * 
 * High-performance data table with virtual scrolling for large datasets.
 * Optimized for rendering thousands of rows efficiently.
 */

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRenderPerformance } from '@/hooks/useFormattingPerformance';
import type { DataTableData, DataTableColumn } from '@/types/ui-components';

interface VirtualizedDataTableProps {
  data: DataTableData;
  height?: number;
  rowHeight?: number;
  onAction?: (action: string, data?: any) => void;
  className?: string;
  enableVirtualization?: boolean;
  virtualizationThreshold?: number;
}

interface TableRowProps {
  index: number;
  style: React.CSSProperties;
  data: {
    rows: any[];
    columns: DataTableColumn[];
    onCellClick: (rowIndex: number, columnKey: string, value: any) => void;
  };
}

// Memoized table row component for virtualization
const TableRowComponent = React.memo<TableRowProps>(({ index, style, data }) => {
  const { rows, columns, onCellClick } = data;
  const row = rows[index];

  return (
    <div style={style} className="flex border-b border-border">
      {columns.map((column) => {
        const value = row[column.key];
        const displayValue = formatCellValue(value, column.type);

        return (
          <div
            key={column.key}
            className={cn(
              "flex-1 px-3 py-2 text-sm border-r border-border last:border-r-0",
              column.align === 'center' ? 'text-center' :
              column.align === 'right' ? 'text-right' : 'text-left',
              "cursor-pointer hover:bg-muted/50 transition-colors"
            )}
            onClick={() => onCellClick(index, column.key, value)}
          >
            {displayValue}
          </div>
        );
      })}
    </div>
  );
});

TableRowComponent.displayName = 'TableRowComponent';

// Format cell value based on column type
function formatCellValue(value: any, type: string): React.ReactNode {
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground">—</span>;
  }

  switch (type) {
    case 'currency':
      const numValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^\d.-]/g, ''));
      if (isNaN(numValue)) return String(value);
      return `MYR ${numValue.toFixed(2)}`;
    
    case 'number':
      const num = typeof value === 'number' ? value : parseFloat(String(value));
      if (isNaN(num)) return String(value);
      return num.toLocaleString();
    
    case 'date':
      try {
        const date = new Date(value);
        if (isNaN(date.getTime())) return String(value);
        return date.toLocaleDateString('en-GB'); // DD/MM/YYYY format
      } catch {
        return String(value);
      }
    
    case 'badge':
      return (
        <Badge variant="secondary" className="text-xs">
          {String(value)}
        </Badge>
      );
    
    default:
      return String(value);
  }
}

export function VirtualizedDataTable({
  data,
  height = 400,
  rowHeight = 48,
  onAction,
  className = '',
  enableVirtualization = true,
  virtualizationThreshold = 50
}: VirtualizedDataTableProps) {
  const { startRender, endRender, metrics } = useRenderPerformance('VirtualizedDataTable');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const listRef = useRef<List>(null);

  useEffect(() => {
    startRender();
    return () => endRender();
  }, [startRender, endRender]);

  // Memoized filtered and sorted data
  const processedData = useMemo(() => {
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

    // Apply sorting
    if (sortColumn && data.sortable) {
      const column = data.columns.find(col => col.key === sortColumn);
      if (column?.sortable) {
        filtered.sort((a, b) => {
          const aVal = a[sortColumn];
          const bVal = b[sortColumn];
          
          // Handle different data types
          let comparison = 0;
          if (column.type === 'number' || column.type === 'currency') {
            const aNum = typeof aVal === 'number' ? aVal : parseFloat(String(aVal).replace(/[^\d.-]/g, ''));
            const bNum = typeof bVal === 'number' ? bVal : parseFloat(String(bVal).replace(/[^\d.-]/g, ''));
            comparison = aNum - bNum;
          } else if (column.type === 'date') {
            const aDate = new Date(aVal);
            const bDate = new Date(bVal);
            comparison = aDate.getTime() - bDate.getTime();
          } else {
            comparison = String(aVal).localeCompare(String(bVal));
          }
          
          return sortDirection === 'asc' ? comparison : -comparison;
        });
      }
    }

    return filtered;
  }, [data.rows, data.columns, data.searchable, data.sortable, searchTerm, columnFilters, sortColumn, sortDirection]);

  // Handle sorting
  const handleSort = useCallback((columnKey: string) => {
    const column = data.columns.find(col => col.key === columnKey);
    if (!column?.sortable || !data.sortable) return;

    if (sortColumn === columnKey) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  }, [data.columns, data.sortable, sortColumn]);

  // Handle cell click
  const handleCellClick = useCallback((rowIndex: number, columnKey: string, value: any) => {
    onAction?.('cell_click', {
      rowIndex,
      columnKey,
      value,
      row: processedData[rowIndex]
    });
  }, [onAction, processedData]);

  // Handle column filter
  const handleColumnFilter = useCallback((columnKey: string, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [columnKey]: value
    }));
  }, []);

  // Determine if virtualization should be used
  const shouldVirtualize = enableVirtualization && processedData.length > virtualizationThreshold;

  // Memoized row data for virtualization
  const rowData = useMemo(() => ({
    rows: processedData,
    columns: data.columns,
    onCellClick: handleCellClick
  }), [processedData, data.columns, handleCellClick]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search and Filters */}
      {(data.searchable || data.filterable) && (
        <div className="space-y-3">
          {data.searchable && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search table..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          )}

          {data.filterable && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {data.columns.map((column) => (
                <div key={column.key} className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    placeholder={`Filter ${column.label}...`}
                    value={columnFilters[column.key] || ''}
                    onChange={(e) => handleColumnFilter(column.key, e.target.value)}
                    className="pl-9 text-xs"
                    size="sm"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Performance Metrics (Development) */}
      {process.env.NODE_ENV === 'development' && metrics.renderCount > 0 && (
        <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
          Renders: {metrics.renderCount} | Avg: {metrics.averageRenderTime.toFixed(2)}ms | 
          Rows: {processedData.length} | Virtualized: {shouldVirtualize ? 'Yes' : 'No'}
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border overflow-hidden">
        {/* Header */}
        <div className="bg-muted/50 border-b border-border">
          <div className="flex">
            {data.columns.map((column) => (
              <div
                key={column.key}
                className={cn(
                  "flex-1 px-3 py-3 text-xs font-semibold uppercase tracking-wide border-r border-border last:border-r-0",
                  column.align === 'center' ? 'text-center' :
                  column.align === 'right' ? 'text-right' : 'text-left',
                  column.sortable && data.sortable ?
                    'cursor-pointer hover:bg-muted transition-colors select-none' : ''
                )}
                onClick={() => handleSort(column.key)}
              >
                <div className="flex items-center gap-1">
                  <span>{column.label}</span>
                  {column.sortable && data.sortable && (
                    <div className="flex flex-col">
                      {sortColumn === column.key ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-50" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        {shouldVirtualize ? (
          <List
            ref={listRef}
            height={height}
            itemCount={processedData.length}
            itemSize={rowHeight}
            itemData={rowData}
            overscanCount={5}
          >
            {TableRowComponent}
          </List>
        ) : (
          <ScrollArea className="max-h-96">
            <div>
              {processedData.map((row, index) => (
                <div key={index} className="flex border-b border-border last:border-b-0">
                  {data.columns.map((column) => {
                    const value = row[column.key];
                    const displayValue = formatCellValue(value, column.type);

                    return (
                      <div
                        key={column.key}
                        className={cn(
                          "flex-1 px-3 py-2 text-sm border-r border-border last:border-r-0",
                          column.align === 'center' ? 'text-center' :
                          column.align === 'right' ? 'text-right' : 'text-left',
                          "cursor-pointer hover:bg-muted/50 transition-colors"
                        )}
                        onClick={() => handleCellClick(index, column.key, value)}
                      >
                        {displayValue}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Footer with row count */}
      <div className="flex justify-between items-center text-xs text-muted-foreground">
        <span>
          Showing {processedData.length} of {data.rows.length} rows
        </span>
        {shouldVirtualize && (
          <span>Virtual scrolling enabled</span>
        )}
      </div>
    </div>
  );
}
