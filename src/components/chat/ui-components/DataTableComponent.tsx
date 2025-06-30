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
  ExternalLink
} from 'lucide-react';
import { DataTableData, UIComponentProps } from '@/types/ui-components';
import { formatCurrencySafe } from '@/utils/currency';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = compact ? 5 : 10;

  // Filter rows based on search term
  const filteredRows = useMemo(() => {
    if (!searchTerm || !data.searchable) return data.rows;
    
    return data.rows.filter(row =>
      Object.values(row).some(value =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [data.rows, searchTerm, data.searchable]);

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

  // Format cell value based on column type
  const formatCellValue = (value: any, column: any) => {
    switch (column.type) {
      case 'currency':
        return formatCurrencySafe(value, data.currency || 'MYR', 'en-US', 'MYR');
      case 'date':
        try {
          return new Date(value).toLocaleDateString();
        } catch {
          return String(value);
        }
      case 'badge':
        return (
          <Badge variant="outline" className="text-xs">
            {String(value)}
          </Badge>
        );
      case 'action':
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAction?.(value.action, value.data)}
            className="h-6 px-2"
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        );
      case 'number':
        return typeof value === 'number' ? value.toLocaleString() : String(value);
      default:
        return String(value);
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
        {/* Search Input */}
        {data.searchable && (
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search table..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        )}

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {data.columns.map((column) => (
                  <TableHead
                    key={column.key}
                    className={`${column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : 'text-left'} ${
                      column.sortable && data.sortable ? 'cursor-pointer hover:bg-muted/50' : ''
                    }`}
                    style={{ width: column.width }}
                    onClick={() => handleSort(column.key)}
                  >
                    <div className="flex items-center gap-1">
                      {column.label}
                      {column.sortable && data.sortable && getSortIcon(column.key)}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={data.columns.length} className="text-center py-8 text-muted-foreground">
                    No data available
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRows.map((row) => (
                  <TableRow key={row.id}>
                    {data.columns.map((column) => (
                      <TableCell
                        key={column.key}
                        className={column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : 'text-left'}
                      >
                        {formatCellValue(row[column.key], column)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {data.pagination && totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {((currentPage - 1) * rowsPerPage) + 1} to {Math.min(currentPage * rowsPerPage, sortedRows.length)} of {sortedRows.length} results
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
