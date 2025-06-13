import { Receipt } from '@/types/receipt';
import { format } from 'date-fns';

export interface ExportFilters {
  searchQuery?: string;
  activeTab?: string;
  filterByCurrency?: string;
  filterByCategory?: string;
  sortOrder?: string;
  dateRange?: {
    from?: Date;
    to?: Date;
  };
}

/**
 * Converts receipt data to CSV format and triggers download
 */
export const exportToCSV = (receipts: Receipt[], filters?: ExportFilters): void => {
  if (receipts.length === 0) {
    throw new Error('No receipts to export');
  }

  // Define CSV headers
  const headers = [
    'ID',
    'Date',
    'Merchant',
    'Total',
    'Currency',
    'Tax',
    'Payment Method',
    'Status',
    'Category',
    'Processing Status',
    'Model Used',
    'Processing Method',
    'Processing Time (s)',
    'Created At',
    'Updated At'
  ];

  // Convert receipts to CSV rows
  const rows = receipts.map(receipt => [
    receipt.id,
    receipt.date,
    receipt.merchant,
    receipt.total.toString(),
    receipt.currency,
    receipt.tax?.toString() || '',
    receipt.payment_method,
    receipt.status,
    receipt.predicted_category || receipt.custom_category_id || '',
    receipt.processing_status || '',
    receipt.model_used || '',
    receipt.primary_method || '',
    receipt.processing_time?.toString() || '',
    receipt.created_at,
    receipt.updated_at
  ]);

  // Combine headers and rows
  const csvContent = [headers, ...rows]
    .map(row => row.map(field => `"${field.toString().replace(/"/g, '""')}"`).join(','))
    .join('\n');

  // Generate filename with timestamp and filter info
  const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
  const filterInfo = generateFilterInfo(filters);
  const filename = `receipts_export_${timestamp}${filterInfo}.csv`;

  // Create and trigger download
  downloadFile(csvContent, filename, 'text/csv');
};

/**
 * Generates filter information for filename
 */
export const generateFilterInfo = (filters?: ExportFilters): string => {
  if (!filters) return '';
  
  const parts: string[] = [];
  
  if (filters.searchQuery) {
    parts.push(`search-${filters.searchQuery.replace(/[^a-zA-Z0-9]/g, '_')}`);
  }
  
  if (filters.activeTab && filters.activeTab !== 'all') {
    parts.push(`status-${filters.activeTab}`);
  }
  
  if (filters.filterByCurrency) {
    parts.push(`currency-${filters.filterByCurrency}`);
  }

  if (filters.filterByCategory) {
    parts.push(`category-${filters.filterByCategory}`);
  }

  if (filters.dateRange?.from) {
    const fromDate = format(filters.dateRange.from, 'yyyy-MM-dd');
    const toDate = filters.dateRange.to ? format(filters.dateRange.to, 'yyyy-MM-dd') : 'now';
    parts.push(`date-${fromDate}-to-${toDate}`);
  }
  
  return parts.length > 0 ? `_${parts.join('_')}` : '';
};

/**
 * Creates a download link and triggers file download
 */
const downloadFile = (content: string, filename: string, mimeType: string): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
