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
import { buildPayerNameMap } from '@/lib/export/payerNameResolver';
import { useTeam } from '@/contexts/TeamContext';
import { useCommonTranslation } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

interface ExportDropdownProps {
  receipts: Receipt[];
  filters?: ExportFilters;
  disabled?: boolean;
  totalCount?: number;
  getReceiptsForExport?: () => Promise<Receipt[]>;
}

export const ExportDropdown: React.FC<ExportDropdownProps> = ({
  receipts,
  filters,
  disabled = false,
  totalCount,
  getReceiptsForExport,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);
  const { currentTeam } = useTeam();
  const { t } = useCommonTranslation();
  const availableReceipts = totalCount ?? receipts.length;

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    if (availableReceipts === 0) {
      toast.error(t('exportMenu.noReceipts'));
      return;
    }

    setIsExporting(true);
    setExportingFormat(format);

    try {
      const receiptsToExport = getReceiptsForExport
        ? await getReceiptsForExport()
        : receipts;

      if (receiptsToExport.length === 0) {
        toast.error(t('exportMenu.noReceipts'));
        return;
      }

      const payerNameMap = await buildPayerNameMap(receiptsToExport, { currentTeam });

      switch (format) {
        case 'csv':
          exportToCSV(receiptsToExport, filters, payerNameMap);
          toast.success(
            t('exportMenu.success', {
              format: format.toUpperCase(),
              count: receiptsToExport.length,
            })
          );
          break;
        case 'excel':
          exportToExcel(receiptsToExport, filters, payerNameMap);
          toast.success(
            t('exportMenu.success', {
              format: format.toUpperCase(),
              count: receiptsToExport.length,
            })
          );
          break;
        case 'pdf':
          exportToPDF(receiptsToExport, filters, payerNameMap);
          toast.success(
            t('exportMenu.success', {
              format: format.toUpperCase(),
              count: receiptsToExport.length,
            })
          );
          break;
        default:
          throw new Error(t('exportMenu.unsupportedFormat'));
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error(
        t('exportMenu.failed', {
          format: format.toUpperCase(),
          error:
            error instanceof Error
              ? error.message
              : t('exportMenu.unknownError'),
        })
      );
    } finally {
      setIsExporting(false);
      setExportingFormat(null);
    }
  };

  const getButtonText = () => {
    if (isExporting && exportingFormat) {
      return t('exportMenu.exporting', {
        format: exportingFormat.toUpperCase(),
      });
    }
    return t('buttons.export');
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
          disabled={disabled || isExporting || availableReceipts === 0}
          className="gap-2"
        >
          {getButtonIcon()}
          {getButtonText()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>{t('exportMenu.label')}</DropdownMenuLabel>
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
              {t('exportMenu.csv')}
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
              {t('exportMenu.excel')}
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
              {t('exportMenu.pdf')}
            </span>
          </div>
        </DropdownMenuItem>

        {availableReceipts > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              {t('exportMenu.itemsToExport', { count: availableReceipts })}
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
