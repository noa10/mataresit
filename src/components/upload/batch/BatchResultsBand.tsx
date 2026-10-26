import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

import type { BatchFilter } from "./utils";

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
  const countedReady = useCountUp(ready);
  const failureCopy =
    failed === 0
      ? "Every receipt in this batch is posted."
      : `${failed} receipt${failed === 1 ? "" : "s"} need${failed === 1 ? "s" : ""} another try.`;

  return (
    <section className="batch-band batch-band-results" aria-label="Batch results">
      <div className="batch-results-main">
        <p className="batch-micro">
          {batchName} · {batchDate}
        </p>
        <div className="batch-rb-count" aria-live="polite">
          <span className="batch-rb-num mono">{countedReady}</span>
          <span className="batch-rb-slash">/</span>
          <span className="batch-rb-total mono">{total}</span>
          <span className="batch-rb-ready">ready</span>
        </div>
        <p className="batch-rb-sub">
          {ready} of {total} receipts posted to the ledger. {failureCopy}
        </p>
      </div>

      <div className="batch-filters" role="group" aria-label="Filter results">
        <button
          type="button"
          className={`batch-filter${filter === "all" ? " is-on" : ""}`}
          aria-pressed={filter === "all"}
          onClick={() => onFilter("all")}
        >
          All <span className="batch-filter-count">{ready + failed}</span>
        </button>
        <button
          type="button"
          className={`batch-filter${filter === "ready" ? " is-on" : ""}`}
          aria-pressed={filter === "ready"}
          onClick={() => onFilter("ready")}
        >
          Ready <span className="batch-filter-count">{ready}</span>
        </button>
        <button
          type="button"
          className={`batch-filter${filter === "failed" ? " is-on" : ""}`}
          aria-pressed={filter === "failed"}
          onClick={() => onFilter("failed")}
        >
          Failed <span className="batch-filter-count">{failed}</span>
        </button>
      </div>
    </section>
  );
}
