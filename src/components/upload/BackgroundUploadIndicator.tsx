import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

import { useBackgroundUpload } from '@/contexts/BackgroundUploadContext';
import { useReceiptsTranslation } from '@/contexts/LanguageContext';
import { formatBatchDate } from '@/components/upload/batch/utils';

/**
 * Workspace-level indicator for a batch that continues after the sheet closes.
 * It mirrors the ledger language instead of using a generic status pill.
 */
export function BackgroundUploadIndicator() {
  const reduceMotion = useReducedMotion();
  const { t } = useReceiptsTranslation();
  const {
    isModalOpen,
    openModal,
    hasActiveUpload,
    isProcessing,
    totalProgress,
    batchUploads,
    completedUploads,
    failedUploads,
    activeUploads,
    queuedUploads,
    batchSession,
  } = useBackgroundUpload();

  const hasUploads = batchUploads.length > 0;
  const isComplete =
    !isProcessing &&
    activeUploads.length === 0 &&
    queuedUploads.length === 0 &&
    (completedUploads.length > 0 || failedUploads.length > 0);

  const shouldShow = !isModalOpen && hasUploads && (hasActiveUpload || isComplete);
  if (!shouldShow) return null;

  const total = batchUploads.length;
  const ready = completedUploads.length;
  const failed = failedUploads.length;
  const completedWithFailures = isComplete && failed > 0;
  const percent = Math.max(0, Math.min(100, Math.round(totalProgress)));

  const statusLabel = isComplete
    ? failed > 0
      ? t('batch.indicator.failed', { count: failed })
      : t('batch.indicator.postedStatus', { count: ready })
    : `${percent}%`;

  const StatusIcon = isComplete
    ? failed > 0
      ? AlertTriangle
      : CheckCircle2
    : Loader2;

  const statusColor = completedWithFailures
    ? 'text-ledger-danger'
    : isComplete
      ? 'text-ledger-accent'
      : 'text-ledger-accent';

  const title = batchSession?.sessionName || t('batch.indicator.defaultName');
  const date = formatBatchDate(batchSession?.createdAt);

  return (
    <AnimatePresence>
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.2, 0.7, 0.3, 1] }}
        className="fixed bottom-5 right-5 z-50 w-[286px]"
      >
        <button
          type="button"
          onClick={openModal}
          aria-label={t('batch.indicator.reopenAria')}
          className="group block w-full rounded-[10px] border border-ledger-line-strong bg-ledger-surface p-3.5 text-left shadow-[0_1px_2px_rgba(18,23,21,.06),0_18px_40px_-24px_rgba(18,23,21,.32)] transition-colors hover:bg-ledger-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ledger-accent focus-visible:ring-offset-2"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="font-data text-[8px] uppercase tracking-[0.16em] text-ledger-muted">
              {t('batch.indicator.background')}
            </span>
            <span className={`flex items-center gap-1 font-data text-[8.5px] uppercase tracking-[0.1em] ${statusColor}`}>
              <StatusIcon
                className={`h-3 w-3 ${!isComplete ? 'animate-spin' : ''} motion-reduce:animate-none`}
                aria-hidden="true"
              />
              {statusLabel}
            </span>
          </div>

          <div className="mt-2 font-display text-[21px] leading-[1.1] text-ledger-ink">
            {title} <span className="text-ledger-muted">· {date}</span>
          </div>
          <p className="mt-1 font-data text-[9.5px] text-ledger-muted">
            {t('batch.indicator.postedProgress', { ready, total })}
            {failed > 0
              ? ` · ${t('batch.indicator.failed', { count: failed })}`
              : ''}
          </p>

          <div className="mt-3 h-[2px] w-full overflow-hidden bg-ledger-line" aria-hidden="true">
            <div
              className={`h-full origin-left transition-transform duration-300 ${
                completedWithFailures ? 'bg-ledger-danger' : 'bg-ledger-accent'
              }`}
              style={{ transform: `scaleX(${isComplete ? 1 : percent / 100})` }}
            />
          </div>

          <span className="mt-3 flex items-center justify-between font-data text-[8.5px] uppercase tracking-[0.12em] text-ledger-accent">
            {t('batch.indicator.reopen')}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
