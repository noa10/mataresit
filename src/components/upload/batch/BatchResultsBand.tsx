import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

import type { BatchFilter } from "./utils";
import { useReceiptsTranslation } from "@/contexts/LanguageContext";

interface BatchResultsBandProps {
  ready: number;
  total: number;
  failed: number;
  filter: BatchFilter;
  onFilter: (filter: BatchFilter) => void;
  batchName: string;
  batchDate: string;
}

function useCountUp(target: number, duration = 400) {
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;

    let frame = 0;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, reduceMotion]);

  return reduceMotion ? target : value;
}

export function BatchResultsBand({
  ready,
  total,
  failed,
  filter,
  onFilter,
  batchName,
  batchDate,
}: BatchResultsBandProps) {
  const { t } = useReceiptsTranslation();
  const countedReady = useCountUp(ready);
  const failureCopy =
    failed === 0
      ? t("batch.results.allPosted")
      : failed === 1
        ? t("batch.results.needRetryOne", { count: failed })
        : t("batch.results.needRetryMany", { count: failed });

  return (
    <section className="batch-band batch-band-results" aria-label={t("batch.results.label")}>
      <div className="batch-results-main">
        <p className="batch-micro">
          {batchName} · {batchDate}
        </p>
        <div className="batch-rb-count" aria-live="polite">
          <span className="batch-rb-num mono">{countedReady}</span>
          <span className="batch-rb-slash">/</span>
          <span className="batch-rb-total mono">{total}</span>
          <span className="batch-rb-ready">{t("batch.results.ready")}</span>
        </div>
        <p className="batch-rb-sub">
          {t("batch.results.posted", {
            ready,
            total,
            failureCopy,
          })}
        </p>
      </div>

      <div className="batch-filters" role="group" aria-label={t("batch.results.filter")}>
        <button
          type="button"
          className={`batch-filter${filter === "all" ? " is-on" : ""}`}
          aria-pressed={filter === "all"}
          onClick={() => onFilter("all")}
        >
          {t("batch.results.filterAll")} <span className="batch-filter-count">{ready + failed}</span>
        </button>
        <button
          type="button"
          className={`batch-filter${filter === "ready" ? " is-on" : ""}`}
          aria-pressed={filter === "ready"}
          onClick={() => onFilter("ready")}
        >
          {t("batch.results.filterReady")} <span className="batch-filter-count">{ready}</span>
        </button>
        <button
          type="button"
          className={`batch-filter${filter === "failed" ? " is-on" : ""}`}
          aria-pressed={filter === "failed"}
          onClick={() => onFilter("failed")}
        >
          {t("batch.results.filterFailed")} <span className="batch-filter-count">{failed}</span>
        </button>
      </div>
    </section>
  );
}
