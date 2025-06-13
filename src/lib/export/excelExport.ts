import { Receipt } from '@/types/receipt';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { ExportFilters } from './csvExport';

/**
 * Converts receipt data to Excel format and triggers download
 */
export const exportToExcel = (receipts: Receipt[], filters?: ExportFilters): void => {
  if (receipts.length === 0) {
    throw new Error('No receipts to export');
  }

  // Prepare data for Excel
  const worksheetData = receipts.map(receipt => ({
    'ID': receipt.id,
    'Date': receipt.date,
    'Merchant': receipt.merchant,
    'Total': receipt.total,
    'Currency': receipt.currency,
    'Tax': receipt.tax || '',
    'Payment Method': receipt.payment_method,
    'Status': receipt.status,
    'Category': receipt.predicted_category || '',
    'Processing Status': receipt.processing_status || '',
    'Model Used': receipt.model_used || '',
    'Processing Method': receipt.primary_method || '',
    'Processing Time (s)': receipt.processing_time || '',
    'Created At': receipt.created_at,
    'Updated At': receipt.updated_at
  }));

  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(worksheetData);

  // Set column widths for better readability
  const columnWidths = [
    { wch: 36 }, // ID
    { wch: 12 }, // Date
    { wch: 25 }, // Merchant
    { wch: 10 }, // Total
    { wch: 8 },  // Currency
    { wch: 8 },  // Tax
    { wch: 15 }, // Payment Method
    { wch: 12 }, // Status
    { wch: 15 }, // Category
    { wch: 15 }, // Processing Status
    { wch: 15 }, // Model Used
    { wch: 15 }, // Processing Method
    { wch: 12 }, // Processing Time
    { wch: 20 }, // Created At
    { wch: 20 }  // Updated At
  ];
  worksheet['!cols'] = columnWidths;

  // Style the header row
  const headerRange = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!worksheet[cellAddress]) continue;
    
    worksheet[cellAddress].s = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "2962FF" } },
      alignment: { horizontal: "center" }
    };
  }

  // Format number columns
  const numberColumns = ['D', 'F', 'M']; // Total, Tax, Processing Time columns
  for (let row = 1; row <= receipts.length; row++) {
    numberColumns.forEach(col => {
      const cellAddress = `${col}${row + 1}`;
      if (worksheet[cellAddress] && worksheet[cellAddress].v !== '') {
        worksheet[cellAddress].t = 'n';
        if (col === 'D' || col === 'F') { // Total and Tax columns
          worksheet[cellAddress].z = '#,##0.00';
        }
      }
    });
  }

  // Add summary information in a separate sheet
  const summaryData = generateSummaryData(receipts, filters);
  const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);
  
  // Add worksheets to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Receipts');
  XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary');

  // Generate filename with timestamp and filter info
  const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
  const filterInfo = generateFilterInfoForExcel(filters);
  const filename = `receipts_export_${timestamp}${filterInfo}.xlsx`;

  // Write and download the file
  XLSX.writeFile(workbook, filename);
};

/**
 * Generates summary data for the summary worksheet
 */
const generateSummaryData = (receipts: Receipt[], filters?: ExportFilters) => {
  const totalReceipts = receipts.length;
  const totalAmount = receipts.reduce((sum, receipt) => sum + receipt.total, 0);
  const currencies = [...new Set(receipts.map(r => r.currency))];
  const statusCounts = receipts.reduce((acc, receipt) => {
    acc[receipt.status] = (acc[receipt.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const categoryCounts = receipts.reduce((acc, receipt) => {
    const category = receipt.predicted_category || 'Uncategorized';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const summary = [
    { Metric: 'Total Receipts', Value: totalReceipts },
    { Metric: 'Total Amount', Value: totalAmount.toFixed(2) },
    { Metric: 'Currencies', Value: currencies.join(', ') },
    { Metric: 'Export Date', Value: format(new Date(), 'yyyy-MM-dd HH:mm:ss') },
    { Metric: '', Value: '' }, // Empty row
    { Metric: 'Status Breakdown', Value: '' },
    ...Object.entries(statusCounts).map(([status, count]) => ({
      Metric: `  ${status}`, Value: count
    })),
    { Metric: '', Value: '' }, // Empty row
    { Metric: 'Category Breakdown', Value: '' },
    ...Object.entries(categoryCounts).map(([category, count]) => ({
      Metric: `  ${category}`, Value: count
    }))
  ];

  if (filters) {
    summary.splice(4, 0, { Metric: 'Applied Filters', Value: formatFiltersForSummary(filters) });
  }

  return summary;
};

/**
 * Generates filter information for filename
 */
const generateFilterInfoForExcel = (filters?: ExportFilters): string => {
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
 * Formats filters for display in summary
 */
const formatFiltersForSummary = (filters: ExportFilters): string => {
  const parts: string[] = [];

  if (filters.searchQuery) {
    parts.push(`Search: "${filters.searchQuery}"`);
  }

  if (filters.activeTab && filters.activeTab !== 'all') {
    parts.push(`Status: ${filters.activeTab}`);
  }

  if (filters.filterByCurrency) {
    parts.push(`Currency: ${filters.filterByCurrency}`);
  }

  if (filters.filterByCategory) {
    parts.push(`Category: ${filters.filterByCategory}`);
  }

  if (filters.dateRange?.from) {
    const fromDate = format(filters.dateRange.from, 'yyyy-MM-dd');
    const toDate = filters.dateRange.to ? format(filters.dateRange.to, 'yyyy-MM-dd') : 'now';
    parts.push(`Date: ${fromDate} to ${toDate}`);
  }

  return parts.length > 0 ? parts.join('; ') : 'None';
};
