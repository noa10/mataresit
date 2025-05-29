import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileText, FileSpreadsheet, FileImage, Loader2 } from 'lucide-react';
import { Receipt } from '@/types/receipt';
import { exportToCSV, exportToExcel, exportToPDF, ExportFilters } from '@/lib/export';
import { toast } from 'sonner';

interface ExportDropdownProps {
  receipts: Receipt[];
  filters?: ExportFilters;
  disabled?: boolean;
}

export const ExportDropdown: React.FC<ExportDropdownProps> = ({
  receipts,
  filters,
  disabled = false
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    if (receipts.length === 0) {
      toast.error('No receipts to export');
      return;
    }

    setIsExporting(true);
    setExportingFormat(format);

    try {
      switch (format) {
        case 'csv':
          exportToCSV(receipts, filters);
          toast.success(`CSV file exported successfully (${receipts.length} receipts)`);
          break;
        case 'excel':
          exportToExcel(receipts, filters);
          toast.success(`Excel file exported successfully (${receipts.length} receipts)`);
          break;
        case 'pdf':
          exportToPDF(receipts, filters);
          toast.success(`PDF file exported successfully (${receipts.length} receipts)`);
          break;
        default:
          throw new Error('Unsupported export format');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error(`Failed to export ${format.toUpperCase()}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
      setExportingFormat(null);
    }
  };

  const getButtonText = () => {
    if (isExporting && exportingFormat) {
      return `Exporting ${exportingFormat.toUpperCase()}...`;
    }
    return 'Export';
  };

  const getButtonIcon = () => {
    if (isExporting) {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }
    return <Download className="h-4 w-4" />;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || isExporting || receipts.length === 0}
          className="gap-2"
        >
          {getButtonIcon()}
          {getButtonText()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Export Format</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem
          onClick={() => handleExport('csv')}
          disabled={isExporting}
          className="gap-2 cursor-pointer"
        >
          <FileText className="h-4 w-4" />
          <div className="flex flex-col">
            <span>CSV</span>
            <span className="text-xs text-muted-foreground">
              Comma-separated values
            </span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleExport('excel')}
          disabled={isExporting}
          className="gap-2 cursor-pointer"
        >
          <FileSpreadsheet className="h-4 w-4" />
          <div className="flex flex-col">
            <span>Excel</span>
            <span className="text-xs text-muted-foreground">
              Formatted spreadsheet
            </span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleExport('pdf')}
          disabled={isExporting}
          className="gap-2 cursor-pointer"
        >
          <FileImage className="h-4 w-4" />
          <div className="flex flex-col">
            <span>PDF</span>
            <span className="text-xs text-muted-foreground">
              Formatted report
            </span>
          </div>
        </DropdownMenuItem>

        {receipts.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              {receipts.length} receipt{receipts.length !== 1 ? 's' : ''} to export
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
