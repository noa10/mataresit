import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useHomepageTranslation } from "@/contexts/LanguageContext";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { ArrowRight, CheckMark } from "@/components/marketing/MarketingIcons";

export default function Index() {
  const { user } = useAuth();
  const { t } = useHomepageTranslation();

  useEffect(() => {
    document.title = String(t("meta.title"));
  }, [t]);

  const copy = (key: string) => String(t(key));
  const workspaceTarget = user ? "/dashboard" : "/auth";

  const receiptItems = [
    { name: copy("scan.items.nasiLemak"), amount: "RM 14.50" },
    { name: copy("scan.items.tehTarik"), amount: "RM 7.00" },
    { name: copy("scan.items.rotiCanai"), amount: "RM 4.50" },
  ];

  const heroBenefits = [
    copy("hero.benefits.accuracy"),
    copy("hero.benefits.bulk"),
    copy("hero.benefits.trail"),
  ];

  const howSteps = [
    {
      num: "01",
      title: copy("how.steps.capture.title"),
      body: copy("how.steps.capture.description"),
    },
    {
      num: "02",
      title: copy("how.steps.extract.title"),
      body: copy("how.steps.extract.description"),
    },
    {
      num: "03",
      title: copy("how.steps.review.title"),
      body: copy("how.steps.review.description"),
    },
  ];

  const features = [
    {
      num: "01",
      title: copy("features.items.accuracy.title"),
      body: copy("features.items.accuracy.description"),
    },
    {
      num: "02",
      title: copy("features.items.typing.title"),
      body: copy("features.items.typing.description"),
    },
    {
      num: "03",
      title: copy("features.items.search.title"),
      body: copy("features.items.search.description"),
    },
    {
      num: "04",
      title: copy("features.items.tax.title"),
      body: copy("features.items.tax.description"),
    },
    {
      num: "05",
      title: copy("features.items.team.title"),
      body: copy("features.items.team.description"),
    },
    {
      num: "06",
      title: copy("features.items.security.title"),
      body: copy("features.items.security.description"),
    },
  ];

  const insideItems = [
    {
      num: "01",
      title: copy("inside.items.overview.title"),
      body: copy("inside.items.overview.description"),
    },
    {
      num: "02",
      title: copy("inside.items.inbox.title"),
      body: copy("inside.items.inbox.description"),
    },
    {
      num: "03",
      title: copy("inside.items.review.title"),
      body: copy("inside.items.review.description"),
    },
    {
      num: "04",
      title: copy("inside.items.approval.title"),
      body: copy("inside.items.approval.description"),
    },
  ];

  const extractedFields = [
    { key: copy("scan.fields.merchant"), value: copy("scan.merchantValue") },
    { key: copy("scan.fields.total"), value: copy("scan.totalValue") },
    { key: copy("scan.fields.category"), value: copy("scan.categoryValue") },
  ];

  return (
    <div className="min-h-screen bg-ledger-paper leading-[1.6] text-ledger-ink">
      <a
        href="#main"
        className="absolute left-4 top-[-64px] z-[100] rounded-md bg-ledger-ink px-4 py-2.5 text-sm text-ledger-paper focus:top-3"
      >
        {copy("skipToContent")}
      </a>

      <MarketingHeader />

      <main id="main">
        {/* Hero */}
        <section
          id="top"
          className="scroll-mt-[164px] overflow-hidden border-b border-ledger-line min-[881px]:scroll-mt-[84px]"
        >
          <div className="mx-auto grid w-full max-w-[1240px] grid-cols-1 items-center gap-10 px-5 pb-14 pt-11 min-[981px]:grid-cols-[1.02fr_0.98fr] min-[981px]:gap-10 min-[1081px]:gap-16 min-[1081px]:pb-[84px] min-[1081px]:pt-[72px] sm:px-6 sm:pb-16 sm:pt-14">
            <div className="max-w-[640px] min-[981px]:max-w-[620px]">
              <p className="font-data text-[0.6875rem] uppercase tracking-[0.16em] text-ledger-muted">
                {copy("hero.eyebrow")}
              </p>
              <h1 className="mb-[22px] mt-[18px] font-display text-[clamp(2.75rem,5.6vw,4.75rem)] font-normal leading-[1.02] tracking-[-0.028em] text-ledger-ink max-[640px]:text-[clamp(2.5rem,11vw,3.4rem)]">
                {copy("hero.titleLead")}{" "}
                <em className="italic text-ledger-accent">{copy("hero.titleAccent")}</em>{" "}
                {copy("hero.titleTail")}
              </h1>
              <p className="max-w-[46ch] text-[1.125rem] leading-[1.6] text-ledger-muted">
                {copy("hero.lede")}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  asChild
                  variant="accent"
                  className="h-[46px] gap-[9px] rounded-lg px-5 text-[0.9375rem] font-semibold max-[640px]:w-full"
                >
                  <Link to={workspaceTarget}>
                    {copy("hero.ctaWorkspace")}
                    <ArrowRight className="h-[18px] w-[18px]" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="accent-outline"
                  className="h-[46px] rounded-lg border-ledger-line-strong bg-transparent px-5 text-[0.9375rem] font-semibold text-ledger-ink hover:border-ledger-ink hover:bg-ledger-surface max-[640px]:w-full"
                >
                  <a href="#how">{copy("hero.ctaHow")}</a>
                </Button>
              </div>

              <ul className="mt-[30px] flex flex-wrap gap-x-[22px] gap-y-2.5 border-t border-ledger-line pt-[22px]">
                {heroBenefits.map((benefit) => (
                  <li
                    key={benefit}
                    className="inline-flex items-center gap-[7px] font-data text-xs leading-[1.6] text-ledger-ink-2"
                  >
                    <CheckMark className="h-3.5 w-3.5 text-ledger-accent" />
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mx-auto w-full max-w-[520px] min-[981px]:max-w-none">
              <div className="relative overflow-hidden rounded-[18px] bg-ledger-panel p-[18px] pb-5 text-ledger-on-panel shadow-[0_1px_2px_rgba(18,23,21,0.05),0_18px_40px_-24px_rgba(18,23,21,0.28)]">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 opacity-50"
                  style={{
                    backgroundImage:
                      "radial-gradient(rgba(241, 242, 238, .13) 1px, transparent 1px)",
                    backgroundSize: "18px 18px",
                  }}
                />

                <div className="relative flex items-center justify-between px-0.5 pb-3.5 pt-0.5 font-data text-[0.6875rem] uppercase tracking-[0.14em] text-ledger-on-panel-muted">
                  <span>{copy("scan.label")}</span>
                  <span className="inline-flex items-center gap-[7px]">
                    <span
                      aria-hidden="true"
                      className="ledger-pulse-dot h-1.5 w-1.5 rounded-full bg-[#79D3A4]"
                    />
                    {copy("scan.extracting")}
                  </span>
                </div>

                <div className="relative overflow-hidden rounded-[5px] bg-[#FBFBF7] p-5 pb-[18px] font-data text-xs leading-[1.55] text-[#1A211E]">
                  <p className="text-center text-[0.8125rem] font-medium uppercase tracking-[0.16em]">
                    {copy("scan.merchant")}
                  </p>
                  <p className="mt-1 text-center text-[0.6875rem] text-[#5F675F]">
                    {copy("scan.address")}
                    <br />
                    {copy("scan.date")}
                  </p>

                  <div className="my-3 border-t border-dashed border-[#C9CEC4]" />

                  <ul className="grid gap-0.5">
                    {receiptItems.map((item) => (
                      <li
                        key={item.name}
                        className="flex items-baseline justify-between gap-3 py-[3px]"
                      >
                        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                          {item.name}
                        </span>
                        <span className="shrink-0">{item.amount}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-2.5 grid gap-[3px]">
                    <div className="flex justify-between gap-3">
                      <span>{copy("scan.subtotal")}</span>
                      <span>RM 26.00</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span>{copy("scan.tax")}</span>
                      <span>RM 1.56</span>
                    </div>
                    <div className="mt-[5px] flex justify-between gap-3 border-t border-[#1A211E] pt-1.5 text-[0.8125rem] font-medium">
                      <span>{copy("scan.total")}</span>
                      <span>RM 27.56</span>
                    </div>
                  </div>

                  <p className="mt-3 text-[0.6875rem] tracking-[0.04em] text-[#5F675F]">
                    {copy("scan.payment")}
                  </p>

                  <div aria-hidden="true" className="ledger-scanline" />
                </div>

                <div
                  aria-label={copy("scan.fieldsLabel")}
                  className="relative mt-3.5 grid gap-0.5 border-t border-[rgba(241,242,238,0.16)] pt-3"
                >
                  {extractedFields.map((field) => (
                    <div
                      key={field.key}
                      className="grid grid-cols-[84px_minmax(0,1fr)_auto] items-center gap-3 py-1.5 text-xs leading-[1.6]"
                    >
                      <span className="font-data text-[0.625rem] uppercase tracking-[0.12em] text-ledger-on-panel-muted">
                        {field.key}
                      </span>
                      <span className="truncate font-medium text-ledger-on-panel">
                        {field.value}
                      </span>
                      <CheckMark
                        strokeWidth={2.2}
                        className="h-3.5 w-3.5 text-[#79D3A4]"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how"
          className="scroll-mt-[164px] border-b border-ledger-line min-[881px]:scroll-mt-[84px]"
        >
          <div className="mx-auto w-full max-w-[1240px] px-5 py-16 min-[881px]:px-6 min-[881px]:py-[88px]">
            <div className="mb-10 grid grid-cols-1 items-start gap-4 min-[981px]:mb-14 min-[981px]:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] min-[981px]:items-end min-[981px]:gap-12">
              <div>
                <p className="font-data text-[0.6875rem] uppercase tracking-[0.16em] text-ledger-muted">
                  {copy("how.eyebrow")}
                </p>
                <h2 className="mt-3.5 font-display text-[clamp(2rem,3.6vw,3rem)] font-normal leading-[1.06] tracking-[-0.02em] text-ledger-ink">
                  {copy("how.title")}
                </h2>
              </div>
              <p className="max-w-[54ch] pb-1 text-[1.0625rem] leading-[1.65] text-ledger-muted">
                {copy("how.lede")}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 min-[881px]:grid-cols-3 min-[881px]:gap-8">
              {howSteps.map((step) => (
                <div
                  key={step.num}
                  className="border-t border-ledger-ink pt-[18px]"
                >
                  <p className="font-data text-base leading-[1.65] tracking-[0.1em] text-ledger-accent">
                    {step.num}
                  </p>
                  <h3 className="mb-2 mt-3.5 text-[1.25rem] font-semibold tracking-[-0.01em] text-ledger-ink">
                    {step.title}
                  </h3>
                  <p className="max-w-[34ch] text-base leading-[1.65] text-ledger-muted">
                    {step.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Capabilities */}
        <section
          id="features"
          className="scroll-mt-[164px] border-b border-ledger-line bg-ledger-surface min-[881px]:scroll-mt-[84px]"
        >
          <div className="mx-auto w-full max-w-[1240px] px-5 py-16 min-[881px]:px-6 min-[881px]:py-[88px]">
            <div className="mb-10 grid grid-cols-1 items-start gap-4 min-[981px]:mb-14 min-[981px]:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] min-[981px]:items-end min-[981px]:gap-12">
              <div>
                <p className="font-data text-[0.6875rem] uppercase tracking-[0.16em] text-ledger-muted">
                  {copy("features.eyebrow")}
                </p>
                <h2 className="mt-3.5 font-display text-[clamp(2rem,3.6vw,3rem)] font-normal leading-[1.06] tracking-[-0.02em] text-ledger-ink">
                  {copy("features.title")}
                </h2>
              </div>
              <p className="max-w-[54ch] pb-1 text-[1.0625rem] leading-[1.65] text-ledger-muted">
                {copy("features.lede")}
              </p>
            </div>

            <div className="grid grid-cols-1 min-[881px]:grid-cols-2 min-[881px]:gap-x-10 min-[1081px]:gap-x-16">
              {features.map((feature) => (
                <article
                  key={feature.num}
                  className="grid grid-cols-[40px_minmax(0,1fr)] gap-[18px] border-t border-ledger-line pb-[30px] pt-[26px]"
                >
                  <span className="pt-[5px] font-data text-[0.6875rem] text-ledger-muted">
                    {feature.num}
                  </span>
                  <div>
                    <h3 className="mb-1.5 text-[1.0625rem] font-semibold tracking-[-0.005em] text-ledger-ink">
                      {feature.title}
                    </h3>
                    <p className="max-w-[46ch] text-base leading-[1.62] text-ledger-muted">
                      {feature.body}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Inside the workspace */}
        <section
          id="workspace"
          className="scroll-mt-[164px] bg-ledger-panel text-ledger-on-panel min-[881px]:scroll-mt-[84px]"
        >
          <div className="mx-auto grid w-full max-w-[1240px] grid-cols-1 items-start gap-10 px-5 py-16 min-[881px]:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] min-[881px]:px-6 min-[881px]:py-[84px] min-[1081px]:gap-16">
            <div>
              <p className="font-data text-[0.6875rem] uppercase tracking-[0.16em] text-ledger-on-panel-muted">
                {copy("inside.eyebrow")}
              </p>
              <h2 className="mb-[18px] mt-4 font-display text-[clamp(2rem,3.6vw,3rem)] font-normal leading-[1.06] tracking-[-0.02em] text-ledger-on-panel">
                {copy("inside.title")}
              </h2>
              <p className="max-w-[54ch] text-[1.0625rem] leading-[1.65] text-ledger-on-panel-muted">
                {copy("inside.lede")}
              </p>
              <Button
                asChild
                className="mt-7 h-[46px] gap-[9px] rounded-lg bg-ledger-on-panel px-5 text-[0.9375rem] font-semibold text-ledger-panel hover:bg-white max-[640px]:w-full"
              >
                <Link to={workspaceTarget}>
                  {copy("inside.cta")}
                  <ArrowRight className="h-[18px] w-[18px]" />
                </Link>
              </Button>
            </div>

            <ul className="border-t border-[rgba(241,242,238,0.18)]">
              {insideItems.map((item) => (
                <li
                  key={item.num}
                  className="grid grid-cols-[36px_minmax(0,1fr)] gap-[14px] border-b border-[rgba(241,242,238,0.14)] py-[18px]"
                >
                  <span className="pt-[3px] font-data text-[0.6875rem] text-ledger-on-panel-muted">
                    {item.num}
                  </span>
                  <div>
                    <h3 className="text-base font-semibold leading-[1.6] text-ledger-on-panel">
                      {item.title}
                    </h3>
                    <p className="mt-[3px] text-[0.875rem] leading-[1.6] text-ledger-on-panel-muted">
                      {item.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
