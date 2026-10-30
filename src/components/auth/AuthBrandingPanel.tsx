import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  Lock,
  ReceiptText,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useAuthTranslation } from "@/contexts/LanguageContext";
import { LogoLockup } from "@/components/brand/LogoLockup";

interface FeatureItemProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

const FEATURE_ICONS: LucideIcon[] = [ReceiptText, Users, BarChart3, Lock];

function FeatureItem({ icon: Icon, title, description }: FeatureItemProps) {
  return (
    <li className="grid grid-cols-[40px_minmax(0,1fr)] items-start gap-3.5">
      <span
        aria-hidden="true"
        className="grid h-10 w-10 place-items-center rounded-[10px] border border-white/[0.18] bg-white/[0.045] text-ledger-on-panel"
      >
        <Icon className="h-5 w-5" strokeWidth={1.5} />
      </span>
      <span className="grid min-w-0 gap-[3px]">
        <span className="block text-[0.9375rem] font-semibold tracking-[-0.005em] text-ledger-on-panel">
          {title}
        </span>
        <span className="block text-sm leading-[1.5] text-ledger-on-panel-muted">
          {description}
        </span>
      </span>
    </li>
  );
}

export function AuthBrandingPanel() {
  const { t } = useAuthTranslation();
  const [activeFeature, setActiveFeature] = useState(2);

  const features = FEATURE_ICONS.map((icon, i) => ({
    icon,
    title: String(t(`branding.feature${i + 1}Title`)),
    description: String(t(`branding.feature${i + 1}Desc`)),
  }));

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
    }, 4800);

    return () => window.clearInterval(timer);
  }, [features.length]);

  const ActiveIcon = features[activeFeature].icon;

  return (
    <aside
      aria-label="About Mataresit"
      className="flex flex-col gap-2 border-b border-white/10 bg-ledger-panel px-5 pb-5 pt-4 text-ledger-on-panel min-[980px]:min-h-svh min-[980px]:gap-7 min-[980px]:border-b-0 min-[980px]:border-r min-[980px]:border-white/10 min-[980px]:px-8 min-[980px]:pb-8 min-[980px]:pt-7 min-[1180px]:px-12 min-[1180px]:pb-9 min-[1180px]:pt-[30px]"
    >
      <LogoLockup
        label="Mataresit home"
        tone="on-panel"
        className="w-fit rounded-[7px] text-[1.0625rem] font-semibold tracking-[-0.01em]"
        wordmarkClassName="text-[1.0625rem] font-semibold tracking-[-0.01em] text-ledger-on-panel"
      />

      <div className="grid gap-1 min-[980px]:my-0 min-[980px]:flex-1 min-[980px]:place-content-center min-[980px]:justify-items-center min-[980px]:gap-[clamp(28px,5vh,52px)] min-[980px]:py-4">
        <p className="mt-2 max-w-[34ch] font-display text-[1.15rem] font-normal leading-[1.16] tracking-[-0.015em] text-ledger-on-panel min-[980px]:mt-0 min-[980px]:max-w-[24ch] min-[980px]:text-center min-[980px]:text-[clamp(1.6rem,2.1vw,2.05rem)]">
          {String(t("branding.tagline"))}
        </p>

        <ul className="hidden w-full max-w-[560px] grid-cols-2 gap-x-6 gap-y-5 min-[980px]:grid min-[1180px]:gap-x-9 min-[1180px]:gap-y-[26px]">
          {features.map((feature, i) => (
            <FeatureItem
              key={i}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
            />
          ))}
        </ul>
      </div>

      <div aria-hidden="true" className="hidden min-[980px]:block">
        <div className="grid min-h-[78px] place-content-center rounded-xl border border-white/[0.16] bg-white/[0.035] px-4 py-3.5">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeFeature}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-[40px_minmax(0,1fr)] items-center gap-3.5"
            >
              <span className="grid h-10 w-10 place-items-center rounded-[10px] border border-white/[0.18] bg-white/[0.045] text-ledger-on-panel">
                <ActiveIcon className="h-5 w-5" strokeWidth={1.5} />
              </span>
              <span className="grid min-w-0 gap-[3px]">
                <span className="block text-[0.9375rem] font-semibold text-ledger-on-panel">
                  {features[activeFeature].title}
                </span>
                <span className="block text-sm leading-[1.5] text-ledger-on-panel-muted">
                  {features[activeFeature].description}
                </span>
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </aside>
  );
}
