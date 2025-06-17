
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminTranslation } from "@/contexts/LanguageContext";

export default function AnalyticsPage() {
  const { t } = useAdminTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("analytics.title")}</h1>
        <p className="text-muted-foreground">
          {t("analytics.description")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("analytics.title")}</CardTitle>
          <CardDescription>{t("analytics.comingSoon")}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">{t("analytics.futureFeatures")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
