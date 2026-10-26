import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import {
  useHomepageTranslation,
  useResourcesTranslation,
} from "@/contexts/LanguageContext";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import {
  checkAllServices,
  type ServiceCheckResult,
  type ServiceStatus,
} from "@/services/statusService";
import { cn } from "@/lib/utils";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

const fallbackServices: ServiceCheckResult[] = [
  { name: "Supabase Database", status: "loading", message: "" },
  { name: "Supabase Auth", status: "loading", message: "" },
  { name: "Supabase Storage", status: "loading", message: "" },
  { name: "Edge Functions", status: "loading", message: "" },
  { name: "Google Gemini API", status: "loading", message: "" },
];

const serviceMessageKeys: Record<string, string> = {
  "Supabase Database": "database",
  "Supabase Auth": "auth",
  "Supabase Storage": "storage",
  "Edge Functions": "edge",
  "Google Gemini API": "ai",
};

function statusDot(status: ServiceStatus) {
  switch (status) {
    case "operational":
      return "bg-[#55C38A]";
    case "degraded":
      return "bg-[#E1A85C]";
    case "outage":
      return "bg-[#E06C62]";
    default:
      return "animate-pulse bg-ledger-on-panel-muted";
  }
}

function statusPill(status: ServiceStatus) {
  switch (status) {
    case "operational":
      return "border-[rgba(85,195,138,0.25)] bg-[rgba(85,195,138,0.13)] text-[#9FE0BC]";
    case "degraded":
      return "border-[rgba(225,168,92,0.3)] bg-[rgba(225,168,92,0.14)] text-[#E8C690]";
    case "outage":
      return "border-[rgba(224,108,98,0.3)] bg-[rgba(224,108,98,0.14)] text-[#F0B4AF]";
    default:
      return "border-[rgba(241,242,238,0.14)] bg-[rgba(241,242,238,0.05)] text-ledger-on-panel-muted";
  }
}

function overallDot(status: ServiceStatus) {
  if (status === "operational") {
    return "bg-[#55C38A] shadow-[0_0_0_4px_rgba(85,195,138,0.22)]";
  }
  if (status === "degraded") {
    return "bg-[#E1A85C] shadow-[0_0_0_4px_rgba(225,168,92,0.2)]";
  }
  if (status === "outage") {
    return "bg-[#E06C62] shadow-[0_0_0_4px_rgba(224,108,98,0.2)]";
  }
  return "animate-pulse bg-ledger-on-panel-muted";
}

export default function StatusPage() {
  const { t } = useResourcesTranslation();
  const { t: tHome } = useHomepageTranslation();
  const [services, setServices] = useState<ServiceCheckResult[]>([]);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [isLoading, setIsLoading] = useState(true);

  const copy = (key: string) => String(t(key));
  const tRef = useRef(t);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const runChecks = useCallback(async () => {
    setIsLoading(true);
    setServices((previous) =>
      previous.length > 0
        ? previous.map((service) => ({ ...service, status: "loading" }))
        : fallbackServices,
    );

    try {
      const results = await checkAllServices();
      setServices(results);
      setLastChecked(new Date());
    } catch (error) {
      console.error("Status checks failed:", error);
      setServices((previous) =>
        previous.map((service) => ({
          ...service,
          status: service.status === "loading" ? "outage" : service.status,
          message:
            service.status === "loading"
              ? String(tRef.current("status.banner.outage"))
              : service.message,
        })),
      );
    } finally {
      setIsLoading(false);
      setNow(Date.now());
    }
  }, []);

  useEffect(() => {
    const kickoff = window.setTimeout(() => void runChecks(), 0);
    const timer = window.setInterval(() => void runChecks(), CHECK_INTERVAL_MS);
    return () => {
      window.clearTimeout(kickoff);
      window.clearInterval(timer);
    };
  }, [runChecks]);

  useEffect(() => {
    const ticker = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(ticker);
  }, []);

  const overallStatus: ServiceStatus = useMemo(() => {
    if (isLoading) return "loading";
    if (services.some((service) => service.status === "outage")) return "outage";
    if (services.some((service) => service.status === "degraded")) return "degraded";
    if (
      services.length > 0 &&
      services.every((service) => service.status === "operational")
    ) {
      return "operational";
    }
    return "loading";
  }, [isLoading, services]);

  const overallTitle = {
    operational: copy("status.banner.operational"),
    degraded: copy("status.banner.degraded"),
    outage: copy("status.banner.outage"),
    loading: copy("status.banner.checking"),
  }[overallStatus];

  const checkedLabel = useMemo(() => {
    if (!lastChecked) return String(t("status.banner.justNow"));
    const minutes = Math.floor((now - lastChecked.getTime()) / 60_000);
    if (minutes < 1) return String(t("status.banner.justNow"));
    return String(t("status.banner.minutesAgo")).replace(
      "{{count}}",
      String(minutes),
    );
  }, [lastChecked, now, t]);

  const shownServices = services.length > 0 ? services : fallbackServices;

  return (
    <div className="min-h-screen bg-ledger-paper leading-[1.6] text-ledger-ink">
      <Helmet>
        <title>{copy("meta.status.title")}</title>
        <meta name="description" content={copy("meta.status.description")} />
      </Helmet>

      <a
        href="#main"
        className="absolute left-4 top-[-64px] z-[100] rounded-md bg-ledger-ink px-4 py-2.5 text-sm text-ledger-paper focus:top-3"
      >
        {String(tHome("skipToContent"))}
      </a>

      <MarketingHeader />

      <main id="main">
        <section className="border-b border-ledger-line">
          <div className="mx-auto w-full max-w-[1240px] px-5 pt-16 min-[881px]:px-6">
            <p className="font-data text-[0.6875rem] uppercase tracking-[0.16em] text-ledger-muted">
              {copy("status.hero.eyebrow")}
            </p>
            <h1 className="mt-4 font-display text-[clamp(2.6rem,5vw,4.25rem)] font-normal leading-[1.02] tracking-[-0.026em] text-ledger-ink">
              {copy("status.hero.titleLead")}{" "}
              <em className="italic text-ledger-accent">
                {copy("status.hero.titleAccent")}
              </em>
            </h1>
            <p className="mt-[18px] max-w-[52ch] text-[1.125rem] leading-[1.6] text-ledger-muted">
              {copy("status.hero.lede")}
            </p>

            <div className="mt-[30px] flex flex-wrap items-center gap-[18px] rounded-t-2xl bg-ledger-panel px-5 py-[26px] text-ledger-on-panel min-[641px]:px-7">
              <span
                aria-hidden="true"
                className={cn("h-[15px] w-[15px] shrink-0 rounded-full", overallDot(overallStatus))}
              />
              <h2 className="font-display text-[1.55rem] font-normal leading-[1.1] tracking-[-0.014em] text-white">
                {overallTitle}
              </h2>
              <div className="grid w-full gap-1.5 max-[880px]:justify-items-start min-[881px]:ml-auto min-[881px]:w-auto min-[881px]:justify-items-end">
                <span className="font-data text-[0.6875rem] tracking-[0.03em] text-ledger-on-panel-muted">
                  {copy("status.banner.lastChecked").replace("{{time}}", checkedLabel)}
                </span>
                <button
                  type="button"
                  onClick={() => void runChecks()}
                  disabled={isLoading}
                  className="inline-flex min-h-9 items-center gap-2 justify-self-start rounded-lg border border-[rgba(241,242,238,0.34)] px-3 text-[0.8125rem] font-semibold text-ledger-on-panel transition-colors hover:border-ledger-on-panel hover:bg-[rgba(241,242,238,0.09)] disabled:cursor-not-allowed disabled:opacity-60 min-[881px]:justify-self-end"
                >
                  <RefreshCw
                    aria-hidden="true"
                    className={cn("h-3.5 w-3.5", isLoading && "animate-spin")}
                  />
                  {isLoading
                    ? copy("status.banner.refreshing")
                    : copy("status.banner.refresh")}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-ledger-panel pb-14 text-ledger-on-panel">
          <div className="mx-auto w-full max-w-[1240px] px-5 min-[881px]:px-6">
            <div className="grid gap-2">
              {shownServices.map((service) => {
                const messageKey = serviceMessageKeys[service.name];
                const message =
                  service.status === "operational" && messageKey
                    ? copy(`status.serviceMessages.${messageKey}`)
                    : service.message || copy("status.banner.checking");

                return (
                <div
                  key={service.name}
                  className="grid grid-cols-[22px_1fr_96px] items-center gap-x-4 gap-y-1 rounded-[10px] border border-[rgba(241,242,238,0.09)] bg-ledger-panel-2 px-4 py-3.5 min-[881px]:grid-cols-[30px_1.2fr_1.6fr_110px] min-[881px]:px-[18px] min-[881px]:py-[15px]"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "row-start-1 h-[9px] w-[9px] rounded-full",
                      statusDot(service.status),
                    )}
                  />
                  <span className="row-start-1 text-[0.9375rem] font-semibold leading-[1.4] text-ledger-on-panel">
                    {service.name}
                  </span>
                  <span className="col-span-2 col-start-2 row-start-2 text-sm leading-[1.5] text-ledger-on-panel-muted min-[881px]:col-span-1 min-[881px]:col-start-3 min-[881px]:row-start-1">
                    {message}
                  </span>
                  <span
                    className={cn(
                      "col-start-3 row-start-1 justify-self-end rounded-full border px-2 py-[5px] text-center font-data text-[0.625rem] uppercase tracking-[0.08em] min-[881px]:col-start-4 min-[881px]:w-full min-[881px]:justify-self-stretch min-[881px]:px-0",
                      statusPill(service.status),
                    )}
                  >
                    {copy(`status.serviceStatus.${service.status}`)}
                  </span>
                </div>
                );
              })}
            </div>

            <div className="mt-10 border-t border-[rgba(241,242,238,0.12)] pt-[30px]">
              <p className="font-data text-[0.6875rem] uppercase tracking-[0.14em] text-ledger-on-panel-muted">
                {copy("status.history.title")}
              </p>
              <p className="mt-2 max-w-[70ch] text-sm leading-[1.6] text-ledger-on-panel-muted">
                {copy("status.history.unavailable")}
              </p>
            </div>

            <p className="pt-[22px] text-sm leading-[1.6] text-ledger-on-panel-muted">
              {copy("status.footnote.lead")}{" "}
              <Link
                to="/help"
                className="font-semibold text-ledger-on-panel underline underline-offset-[3px]"
              >
                {copy("status.footnote.link")}
              </Link>{" "}
              {copy("status.footnote.tail")}
            </p>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
