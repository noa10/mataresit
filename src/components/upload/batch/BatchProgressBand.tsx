import { formatEta } from "./utils";
import { useReceiptsTranslation } from "@/contexts/LanguageContext";

interface BatchProgressBandProps {
  percent: number;
  etaMs?: number | null;
  ready: number;
  working: number;
  queued: number;
  failed: number;
}

const pad = (value: number) => String(value).padStart(2, "0");

export function BatchProgressBand({
  percent,
  etaMs,
  ready,
  working,
  queued,
  failed,
}: BatchProgressBandProps) {
  const { t } = useReceiptsTranslation();
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  const eta = formatEta(etaMs, t);

  return (
    <section className="batch-band batch-band-progress" aria-label={t("batch.progress.label")}>
      <div className="batch-pb-top">
        <div className="batch-pb-count">
          <span className="batch-pb-num mono">{value}%</span>
          <span className="batch-pb-meta">
            <span className="batch-micro">{t("batch.progress.progress")}</span>
            {eta && <span className="batch-pb-eta-text">{eta}</span>}
          </span>
        </div>

        <div className="batch-legend" aria-label={t("batch.progress.status")}>
          <span className="batch-lg" data-k="ready">
            <i aria-hidden="true" />
            <span className="batch-lg-n mono">{pad(ready)}</span> {t("batch.progress.ready")}
          </span>
          <span className="batch-lg" data-k="working">
            <i aria-hidden="true" />
            <span className="batch-lg-n mono">{pad(working)}</span> {t("batch.progress.working")}
          </span>
          <span className="batch-lg" data-k="queued">
            <i aria-hidden="true" />
            <span className="batch-lg-n mono">{pad(queued)}</span> {t("batch.progress.queued")}
          </span>
          <span className="batch-lg" data-k="failed">
            <i aria-hidden="true" />
            <span className="batch-lg-n mono">{pad(failed)}</span> {t("batch.progress.failed")}
          </span>
        </div>
      </div>

      <div
        className="batch-track"
        role="progressbar"
        aria-label={t("batch.progress.progressAria")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <i style={{ transform: `scaleX(${value / 100})` }} />
      </div>
    </section>
  );
}
