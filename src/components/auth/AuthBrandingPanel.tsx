import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Zap, BarChart3, Users, LucideIcon } from "lucide-react";
import { useAuthTranslation } from "@/contexts/LanguageContext";

interface FeatureItemProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

function FeatureItem({ icon: Icon, title, description }: FeatureItemProps) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h3 className="font-semibold text-sm">{title}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}

const FEATURE_ICONS: LucideIcon[] = [Shield, Zap, BarChart3, Users];

export function AuthBrandingPanel() {
  const { t } = useAuthTranslation();
  const [activeFeature, setActiveFeature] = useState(0);

  const features = FEATURE_ICONS.map((icon, i) => ({
    icon,
    title: String(t(`branding.feature${i + 1}Title`)),
    description: String(t(`branding.feature${i + 1}Desc`)),
  }));

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [features.length]);

  return (
    <div className="flex flex-col h-full w-full bg-gradient-to-br from-primary/5 via-primary/3 to-background p-12">
      {/* Centered content block: tagline + 2x2 feature grid */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <p className="text-muted-foreground text-lg leading-relaxed text-center max-w-sm mb-12">
          {String(t("branding.tagline"))}
        </p>

        <div className="grid grid-cols-2 gap-6">
          {features.map((feature, i) => (
            <FeatureItem
              key={i}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
            />
          ))}
        </div>
      </div>

      {/* Rotating feature spotlight - pinned to bottom */}
      <div className="mt-auto">
        <div className="relative h-24 overflow-hidden rounded-xl bg-background/50 border border-border/50 p-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeFeature}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-3"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                {(() => {
                  const Icon = features[activeFeature].icon;
                  return <Icon className="h-6 w-6" />;
                })()}
              </div>
              <div>
                <p className="font-semibold text-sm">
                  {features[activeFeature].title}
                </p>
                <p className="text-sm text-muted-foreground">
                  {features[activeFeature].description}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
