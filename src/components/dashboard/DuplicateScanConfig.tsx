import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Lock } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { ScanConfig } from '@/types/duplicateDetection';

export const DEFAULT_SCAN_CONFIG: ScanConfig = {
  merchantEnabled: true,
  dateEnabled: true,
  dateToleranceDays: 0,
  totalEnabled: true,
  totalTolerance: 0.01,
  taxEnabled: false,
  currencyEnabled: false,
};

interface DuplicateScanConfigProps {
  config: ScanConfig;
  onChange: (config: ScanConfig) => void;
}

export function DuplicateScanConfig({ config, onChange }: DuplicateScanConfigProps) {
  const { t } = useTranslation('duplicateDetection');
  const [isOpen, setIsOpen] = useState(true);

  const updateField = <K extends keyof ScanConfig>(field: K, value: ScanConfig[K]) => {
    onChange({ ...config, [field]: value });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium hover:bg-accent/50 transition-colors"
        >
          <span>{t('configTitle')}</span>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2">
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:gap-4">
          {/* Merchant - locked on */}
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 px-4 py-3 opacity-75">
            <div className="flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-sm">{t('merchantLabel')}</Label>
            </div>
            <Switch checked={config.merchantEnabled} disabled aria-label={t('merchantLabel')} />
          </div>

          {/* Date */}
          <div className="flex flex-col gap-2 rounded-lg border border-border px-4 py-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="date-toggle" className="text-sm cursor-pointer">
                {t('dateLabel')}
              </Label>
              <Switch
                id="date-toggle"
                checked={config.dateEnabled}
                onCheckedChange={(checked) => updateField('dateEnabled', checked)}
                aria-label={t('dateLabel')}
              />
            </div>
            {config.dateEnabled && (
              <div className="flex items-center gap-2">
                <Label htmlFor="date-tolerance" className="text-xs text-muted-foreground">
                  {t('dateToleranceLabel')}
                </Label>
                <Input
                  id="date-tolerance"
                  type="number"
                  min={0}
                  max={30}
                  step={1}
                  value={config.dateToleranceDays}
                  onChange={(e) =>
                    updateField('dateToleranceDays', Number(e.target.value) || 0)
                  }
                  className="h-8 w-20 text-sm"
                  aria-label={t('dateToleranceLabel')}
                />
              </div>
            )}
          </div>

          {/* Total */}
          <div className="flex flex-col gap-2 rounded-lg border border-border px-4 py-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="total-toggle" className="text-sm cursor-pointer">
                {t('totalLabel')}
              </Label>
              <Switch
                id="total-toggle"
                checked={config.totalEnabled}
                onCheckedChange={(checked) => updateField('totalEnabled', checked)}
                aria-label={t('totalLabel')}
              />
            </div>
            {config.totalEnabled && (
              <div className="flex items-center gap-2">
                <Label htmlFor="total-tolerance" className="text-xs text-muted-foreground">
                  {t('totalToleranceLabel')}
                </Label>
                <Input
                  id="total-tolerance"
                  type="number"
                  min={0}
                  max={1000}
                  step={0.01}
                  value={config.totalTolerance}
                  onChange={(e) =>
                    updateField('totalTolerance', Number(e.target.value) || 0)
                  }
                  className="h-8 w-24 text-sm"
                  aria-label={t('totalToleranceLabel')}
                />
              </div>
            )}
          </div>

          {/* Tax */}
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
            <Label htmlFor="tax-toggle" className="text-sm cursor-pointer">
              {t('taxLabel')}
            </Label>
            <Switch
              id="tax-toggle"
              checked={config.taxEnabled}
              onCheckedChange={(checked) => updateField('taxEnabled', checked)}
              aria-label={t('taxLabel')}
            />
          </div>

          {/* Currency */}
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
            <Label htmlFor="currency-toggle" className="text-sm cursor-pointer">
              {t('currencyLabel')}
            </Label>
            <Switch
              id="currency-toggle"
              checked={config.currencyEnabled}
              onCheckedChange={(checked) => updateField('currencyEnabled', checked)}
              aria-label={t('currencyLabel')}
            />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
