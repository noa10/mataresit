import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { useHomepageTranslation } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

type ResourceIconProps = { className?: string };

function ResourceIcon({ className, children }: ResourceIconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

function DocumentationIcon({ className }: ResourceIconProps) {
  return (
    <ResourceIcon className={className}>
      <path d="M9.5 1.5h-5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V4.5z" />
      <path d="M9.5 1.5v3h3" />
      <path d="M5.75 8h4.5M5.75 10.75h4.5" />
    </ResourceIcon>
  );
}

function ApiReferenceIcon({ className }: ResourceIconProps) {
  return (
    <ResourceIcon className={className}>
      <path d="M5.5 4.75 2.25 8 5.5 11.25M10.5 4.75 13.75 8 10.5 11.25" />
    </ResourceIcon>
  );
}

function HelpIcon({ className }: ResourceIconProps) {
  return (
    <ResourceIcon className={className}>
      <path d="M8 2.5a5.5 5.5 0 0 1 0 11c-.9 0-1.75-.2-2.5-.6l-3 .6.6-2.9A5.5 5.5 0 0 1 8 2.5z" />
    </ResourceIcon>
  );
}

function StatusIcon({ className }: ResourceIconProps) {
  return (
    <ResourceIcon className={className}>
      <path d="M1.5 8h2.6l1.9-4 3.9 8 1.9-4h2.7" />
    </ResourceIcon>
  );
}

function BlogIcon({ className }: ResourceIconProps) {
  return (
    <ResourceIcon className={className}>
      <circle cx="4.2" cy="11.8" r="1.3" />
      <path d="M2.9 7.4a5.7 5.7 0 0 1 5.7 5.7M2.9 3.4a9.7 9.7 0 0 1 9.7 9.7" />
    </ResourceIcon>
  );
}

const resources = [
  { to: "/docs", key: "documentation", Icon: DocumentationIcon },
  { to: "/api-reference", key: "apiReference", Icon: ApiReferenceIcon },
  { to: "/help", key: "help", Icon: HelpIcon },
  { to: "/status", key: "status", Icon: StatusIcon },
  { to: "/blog", key: "blog", Icon: BlogIcon },
] as const;

function isResourceActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

function useResourcesDisclosure() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return { open, setOpen, containerRef, triggerRef };
}

export function MarketingResourcesDesktop({ triggerClassName }: { triggerClassName: string }) {
  const { t } = useHomepageTranslation();
  const { open, setOpen, containerRef, triggerRef } = useResourcesDisclosure();
  const { pathname } = useLocation();
  const label = String(t("nav.resources.label"));
  const close = () => setOpen(false);

  return (
    <div ref={containerRef} className="relative flex items-center">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls="marketing-resources-menu"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          triggerClassName,
          "inline-flex items-center gap-1.5",
          open && "border-ledger-accent text-ledger-ink",
        )}
      >
        {label}
        <ChevronDown
          aria-hidden="true"
          strokeWidth={1.5}
          className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="absolute left-1/2 top-full z-[60] -translate-x-1/2 pt-2.5">
          <div
            id="marketing-resources-menu"
            role="group"
            aria-label={label}
            className="marketing-resources-panel grid min-h-[403px] w-[min(560px,calc(100vw-48px))] grid-cols-[1.3fr_0.9fr] gap-2 rounded-2xl border border-ledger-line bg-ledger-surface p-2.5 shadow-[0_1px_2px_rgba(18,23,21,0.05),0_18px_40px_-24px_rgba(18,23,21,0.28)]"
          >
            <div className="grid content-start gap-0.5">
              {resources.map(({ to, key, Icon }) => {
                const active = isResourceActive(pathname, to);

                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={close}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "grid grid-cols-[34px_1fr] items-start gap-3 rounded-[10px] px-0 pb-[7px] pt-1.5 no-underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ledger-accent/50",
                      active ? "bg-ledger-accent-soft" : "hover:bg-ledger-surface-2",
                    )}
                  >
                    <span className="grid h-[34px] w-[34px] place-items-center rounded-[9px] bg-ledger-accent-soft text-ledger-accent">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block text-[0.9375rem] font-semibold leading-[1.6]",
                          active ? "text-ledger-accent" : "text-ledger-ink",
                        )}
                      >
                        {String(t(`nav.resources.items.${key}.title`))}
                      </span>
                      <span className="mt-px block text-sm leading-[1.45] text-ledger-muted">
                        {String(t(`nav.resources.items.${key}.description`))}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>

            <div className="grid content-start gap-2 rounded-[10px] bg-ledger-accent-soft p-4">
              <p className="font-data text-[0.625rem] uppercase leading-[1.5] tracking-[0.14em] text-ledger-accent">
                {String(t("nav.resources.card.eyebrow"))}
              </p>
              <h3 className="font-display text-[1.3rem] font-normal leading-[1.12] tracking-[-0.015em] text-ledger-ink">
                {String(t("nav.resources.card.titleLead"))}{" "}
                <em>{String(t("nav.resources.card.titleAccent"))}</em>
              </h3>
              <p className="text-sm leading-[1.5] text-ledger-ink-2">
                {String(t("nav.resources.card.description"))}
              </p>
              <Link
                to="/blog"
                onClick={close}
                className="py-1.5 text-sm font-semibold leading-[1.6] text-ledger-ink-2 underline-offset-[3px] transition-colors hover:text-ledger-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ledger-accent/50"
              >
                {String(t("nav.resources.card.link"))}{" "}
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function MarketingResourcesMobile() {
  const { t } = useHomepageTranslation();
  const { open, setOpen, containerRef, triggerRef } = useResourcesDisclosure();
  const { pathname } = useLocation();
  const label = String(t("nav.resources.label"));
  const close = () => setOpen(false);

  return (
    <div ref={containerRef} className="min-[881px]:hidden">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls="marketing-resources-mobile"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "mx-3 inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-[7px] px-3 text-sm font-medium leading-[1.6] transition-colors",
          open
            ? "bg-ledger-accent-soft text-ledger-accent"
            : "text-ledger-ink-2 hover:bg-ledger-surface-2",
        )}
      >
        {label}
        <ChevronDown
          aria-hidden="true"
          strokeWidth={1.5}
          className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          id="marketing-resources-mobile"
          role="group"
          aria-label={label}
          className="grid grid-cols-2 gap-1.5 px-3 pb-3"
        >
          {resources.map(({ to, key, Icon }) => {
            const active = isResourceActive(pathname, to);

            return (
              <Link
                key={to}
                to={to}
                onClick={close}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-lg border bg-ledger-surface px-3 text-sm font-medium leading-[1.6] no-underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ledger-accent/50",
                  active
                    ? "border-ledger-accent bg-ledger-accent-soft text-ledger-accent"
                    : "border-ledger-line text-ledger-ink-2 hover:border-ledger-line-strong hover:text-ledger-ink",
                )}
              >
                <Icon className="h-4 w-4 shrink-0 text-ledger-accent" />
                <span className="truncate">{String(t(`nav.resources.items.${key}.title`))}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
