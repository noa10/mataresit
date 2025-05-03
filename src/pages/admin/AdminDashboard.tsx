
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { adminService } from "@/services/adminService";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { BarChart3, FileText, Users } from "lucide-react";

export default function AdminDashboard() {
  const [stats, setStats] = useState<{
    userCount: number;
    receiptCount: number;
    recentActivity: any[];
  } | null>(null);
  
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const stats = await adminService.getSystemStats();
        setStats(stats);
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to load dashboard statistics",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your application's performance and statistics
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.userCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              Registered accounts
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Receipts</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.receiptCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              Processed receipts
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Analytics</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Coming Soon</div>
            <p className="text-xs text-muted-foreground">
              Advanced analytics
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest 10 receipts processed in the system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {stats?.recentActivity && stats.recentActivity.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Date</th>
                      <th className="text-left p-2">Merchant</th>
                      <th className="text-left p-2">Amount</th>
                      <th className="text-left p-2">User</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentActivity.map((activity) => (
                      <tr key={activity.id} className="hover:bg-muted/50">
                        <td className="p-2">
                          {new Date(activity.date).toLocaleDateString()}
                        </td>
                        <td className="p-2">{activity.merchant}</td>
                        <td className="p-2">
                          {typeof activity.total === 'number'
                            ? `$${activity.total.toFixed(2)}`
                            : '$0.00'}
                        </td>
                        <td className="p-2">
                          {activity.profiles?.first_name
                            ? `${activity.profiles.first_name} ${activity.profiles.last_name || ''}`
                            : 'Unknown User'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                No recent activity found
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
