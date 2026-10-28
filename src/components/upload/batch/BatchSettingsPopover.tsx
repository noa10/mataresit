import { useRef, useState } from "react";
import { ArrowUpRight, SlidersHorizontal } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useReceiptsTranslation } from "@/contexts/LanguageContext";

interface BatchSettingsPopoverProps {
  maxConcurrent: number;
  autoStart: boolean;
  timeoutSeconds: number;
  onOpenSettings?: () => void;
}

export function BatchSettingsPopover({
  maxConcurrent,
  autoStart,
  timeoutSeconds,
  onOpenSettings,
}: BatchSettingsPopoverProps) {
  const { t } = useReceiptsTranslation();
  const [open, setOpen] = useState(false);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) return;
    const dialog = triggerRef.current?.closest('[role="dialog"]');
    setContainer(dialog instanceof HTMLElement ? dialog : null);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          className="batch-set-trigger"
          aria-label={t("batch.settings.label")}
        >
          <span className="batch-set-short">{t("batch.settings.short")}</span>
          <span className="batch-set-value">
            {t("batch.settings.summary", {
              count: maxConcurrent,
              state: autoStart ? t("batch.settings.on") : t("batch.settings.off"),
            })}
          </span>
          <SlidersHorizontal className="batch-set-icon" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        container={container}
        className="batch-pop batch-settings-pop"
      >
        <div className="batch-pop-head">
          <div>
            <p className="batch-micro">{t("batch.settings.label")}</p>
            <p className="batch-pop-title">{t("batch.settings.title")}</p>
          </div>
        </div>

        <div className="batch-set-rows">
          <div className="batch-set-row">
            <span className="batch-set-label">{t("batch.settings.concurrent")}</span>
            <span className="batch-set-read">{maxConcurrent}</span>
          </div>
          <div className="batch-set-row">
            <span className="batch-set-label">{t("batch.settings.autoStart")}</span>
            <span className="batch-set-read">
              {autoStart ? t("batch.settings.on") : t("batch.settings.off")}
            </span>
          </div>
          <div className="batch-set-row">
            <span className="batch-set-label">{t("batch.settings.timeout")}</span>
            <span className="batch-set-read">
              {t("batch.settings.seconds", { count: timeoutSeconds })}
            </span>
          </div>
        </div>

        <p className="batch-set-note">{t("batch.settings.note")}</p>

        {onOpenSettings && (
          <button
            type="button"
            className="batch-pop-link"
            onClick={() => {
              setOpen(false);
              onOpenSettings();
            }}
          >
            {t("batch.settings.openAdmin")}
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
