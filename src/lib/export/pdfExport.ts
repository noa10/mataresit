import { Receipt } from '@/types/receipt';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ExportFilters } from './csvExport';

/**
 * Converts receipt data to PDF format and triggers download
 */
export const exportToPDF = (receipts: Receipt[], filters?: ExportFilters): void => {
  if (receipts.length === 0) {
    throw new Error('No receipts to export');
  }

  // Create PDF document
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Add title and metadata
  const title = 'Receipt Export Report';
  const exportDate = format(new Date(), 'MMMM d, yyyy HH:mm:ss');
  
  // Header
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text(title, 20, 25);
  
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Export Date: ${exportDate}`, 20, 35);
  pdf.text(`Total Receipts: ${receipts.length}`, 20, 42);

  // Add filter information if available
  let yPosition = 50;
  if (filters) {
    const filterText = formatFiltersForPDF(filters);
    if (filterText) {
      pdf.text(`Applied Filters: ${filterText}`, 20, yPosition);
      yPosition += 7;
    }
  }

  // Calculate totals by currency
  const currencyTotals = receipts.reduce((acc, receipt) => {
    acc[receipt.currency] = (acc[receipt.currency] || 0) + receipt.total;
    return acc;
  }, {} as Record<string, number>);

  // Display currency totals
  yPosition += 5;
  pdf.setFont('helvetica', 'bold');
  pdf.text('Total by Currency:', 20, yPosition);
  yPosition += 7;
  
  pdf.setFont('helvetica', 'normal');
  Object.entries(currencyTotals).forEach(([currency, total]) => {
    pdf.text(`${currency}: ${total.toFixed(2)}`, 25, yPosition);
    yPosition += 6;
  });

  yPosition += 10;

  // Prepare table data
  const tableData = receipts.map(receipt => [
    format(new Date(receipt.date), 'yyyy-MM-dd'),
    receipt.merchant.length > 25 ? receipt.merchant.substring(0, 22) + '...' : receipt.merchant,
    `${receipt.total.toFixed(2)} ${receipt.currency}`,
    receipt.payment_method,
    receipt.status,
    receipt.predicted_category || 'N/A'
  ]);

  // Add receipts table
  autoTable(pdf, {
    startY: yPosition,
    head: [['Date', 'Merchant', 'Amount', 'Payment', 'Status', 'Category']],
    body: tableData,
    styles: {
      fontSize: 9,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [41, 98, 255],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    alternateRowStyles: {
      fillColor: [245, 245, 250]
    },
    columnStyles: {
      0: { cellWidth: 25 }, // Date
      1: { cellWidth: 45 }, // Merchant
      2: { cellWidth: 25 }, // Amount
      3: { cellWidth: 25 }, // Payment
      4: { cellWidth: 20 }, // Status
      5: { cellWidth: 25 }  // Category
    },
    margin: { left: 20, right: 20 },
    tableWidth: 'auto'
  });

  // Add summary section at the end
  const finalY = (pdf as any).lastAutoTable.finalY + 15;
  
  // Check if we need a new page
  if (finalY > 250) {
    pdf.addPage();
    yPosition = 25;
  } else {
    yPosition = finalY;
  }

  // Summary section
  pdf.setFont('helvetica', 'bold');
  pdf.text('Summary', 20, yPosition);
  yPosition += 10;

  pdf.setFont('helvetica', 'normal');
  
  // Status breakdown
  const statusCounts = receipts.reduce((acc, receipt) => {
    acc[receipt.status] = (acc[receipt.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  pdf.text('Status Breakdown:', 20, yPosition);
  yPosition += 7;
  Object.entries(statusCounts).forEach(([status, count]) => {
    pdf.text(`  ${status}: ${count}`, 25, yPosition);
    yPosition += 6;
  });

  yPosition += 5;

  // Category breakdown
  const categoryCounts = receipts.reduce((acc, receipt) => {
    const category = receipt.predicted_category || 'Uncategorized';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  pdf.text('Category Breakdown:', 20, yPosition);
  yPosition += 7;
  Object.entries(categoryCounts).forEach(([category, count]) => {
    pdf.text(`  ${category}: ${count}`, 25, yPosition);
    yPosition += 6;
  });

  // Add page numbers
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(10);
    pdf.text(`Page ${i} of ${pageCount}`, 170, 285);
  }

  // Generate filename with timestamp and filter info
  const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
  const filterInfo = generateFilterInfoForPDF(filters);
  const filename = `receipts_export_${timestamp}${filterInfo}.pdf`;

  // Save the PDF
  pdf.save(filename);
};

/**
 * Formats filters for display in PDF
 */
const formatFiltersForPDF = (filters: ExportFilters): string => {
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
  
  return parts.join('; ');
};

/**
 * Generates filter information for filename
 */
const generateFilterInfoForPDF = (filters?: ExportFilters): string => {
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
  
  if (filters.dateRange?.from) {
    const fromDate = format(filters.dateRange.from, 'yyyy-MM-dd');
    const toDate = filters.dateRange.to ? format(filters.dateRange.to, 'yyyy-MM-dd') : 'now';
    parts.push(`date-${fromDate}-to-${toDate}`);
  }
  
  return parts.length > 0 ? `_${parts.join('_')}` : '';
};
