import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminService } from "@/services/adminService";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { useAdminTranslation } from "@/contexts/LanguageContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { ShoppingBag, Users, AlertCircle, BookOpen } from "lucide-react";
import { BlogAnalytics } from "@/components/admin/BlogAnalytics";

interface SystemStats {
  userCount: number;
  receiptCount: number;
  recentActivity: any[];
}

export default function AdminDashboard() {
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { t } = useAdminTranslation();

  useEffect(() => {
    fetchSystemStats();
  }, []);

  const fetchSystemStats = async () => {
    try {
      setLoading(true);
      const stats = await adminService.getSystemStats();
      setSystemStats(stats);
    } catch (error: any) {
      toast({
        title: t("errors.title"),
        description: error.message || t("errors.loadStatsFailed"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          A overview of the platform&apos;s key metrics and recent activity.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {/* System Overview */}
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t("dashboard.systemOverview")}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-4 w-4" />
                  <span>{t("dashboard.stats.totalUsers")}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{systemStats?.userCount}</div>
                <p className="text-sm text-muted-foreground">
                  {t("dashboard.descriptions.totalUsers")}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <ShoppingBag className="h-4 w-4" />
                  <span>{t("dashboard.stats.totalReceipts")}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{systemStats?.receiptCount}</div>
                <p className="text-sm text-muted-foreground">
                  {t("dashboard.descriptions.totalReceipts")}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>{t("dashboard.stats.recentActivity")}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{systemStats?.recentActivity.length}</div>
                <p className="text-sm text-muted-foreground">
                  {t("dashboard.descriptions.recentActivity")}
                </p>
              </CardContent>
            </Card>
            </div>
          </div>

          <Separator className="my-8" />

          {/* Blog Analytics */}
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Blog Analytics
            </h2>
            <BlogAnalytics />
          </div>

          <Separator className="my-8" />

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Receipt Activity</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receipt ID</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {systemStats?.recentActivity.map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell>{activity.id}</TableCell>
                      <TableCell>{activity.profile?.first_name} {activity.profile?.last_name}</TableCell>
                      <TableCell>{activity.merchant}</TableCell>
                      <TableCell>{activity.total}</TableCell>
                      <TableCell>{new Date(activity.date).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
