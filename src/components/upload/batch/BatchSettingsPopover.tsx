import { useRef, useState } from "react";
import { ArrowUpRight, SlidersHorizontal } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface BatchSettingsPopoverProps {
  maxConcurrent: number;
  autoStart: boolean;
  timeoutSeconds: number;
  onOpenSettings: () => void;
}

export function BatchSettingsPopover({
  maxConcurrent,
  autoStart,
  timeoutSeconds,
  onOpenSettings,
}: BatchSettingsPopoverProps) {
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
          aria-label="Batch settings"
        >
          <span className="batch-set-short">Settings</span>
          <span className="batch-set-value">
            {maxConcurrent} at a time · auto-start {autoStart ? "on" : "off"}
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
            <p className="batch-micro">Batch settings</p>
            <p className="batch-pop-title">Batch defaults</p>
          </div>
        </div>

        <div className="batch-set-rows">
          <div className="batch-set-row">
            <span className="batch-set-label">Concurrent uploads</span>
            <span className="batch-set-read">{maxConcurrent}</span>
          </div>
          <div className="batch-set-row">
            <span className="batch-set-label">Auto-start</span>
            <span className="batch-set-read">{autoStart ? "On" : "Off"}</span>
          </div>
          <div className="batch-set-row">
            <span className="batch-set-label">Timeout</span>
            <span className="batch-set-read">{timeoutSeconds}s</span>
          </div>
        </div>

        <p className="batch-set-note">
          Workspace defaults. Manage them in Settings.
        </p>

        <button
          type="button"
          className="batch-pop-link"
          onClick={() => {
            setOpen(false);
            onOpenSettings();
          }}
        >
          Open batch settings
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </PopoverContent>
    </Popover>
  );
}
