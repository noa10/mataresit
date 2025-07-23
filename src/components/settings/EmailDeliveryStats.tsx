import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Mail, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface EmailStats {
  total_emails: number;
  sent_emails: number;
  delivered_emails: number;
  failed_emails: number;
  scheduled_emails: number;
  delivery_rate: number;
  failure_rate: number;
  by_status: Record<string, number>;
  by_type: Record<string, number>;
  avg_processing_time_minutes: number;
}

interface EmailDeliveryStatsProps {
  className?: string;
}

export function EmailDeliveryStats({ className }: EmailDeliveryStatsProps) {
  const { user } = useAuth();
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7d');

  useEffect(() => {
    loadEmailStats();
  }, [user, dateRange]);

  const loadEmailStats = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('email-scheduler', {
        body: {
          action: 'get_email_delivery_stats',
          userId: user.id,
          dateRange
        }
      });

      if (error) {
        throw error;
      }

      setStats(data.stats);
    } catch (error) {
      console.error('Error loading email stats:', error);
      toast.error('Failed to load email delivery statistics');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'sent':
        return <Mail className="h-4 w-4 text-blue-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'scheduled':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'sent':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'failed':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'scheduled':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getTrendIcon = (rate: number) => {
    if (rate >= 95) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (rate >= 80) return <Minus className="h-4 w-4 text-yellow-600" />;
    return <TrendingDown className="h-4 w-4 text-red-600" />;
  };

  const formatReminderType = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Delivery Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-8 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Delivery Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Email Data</h3>
            <p className="text-muted-foreground">
              Email statistics will appear here once you have billing notifications.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Delivery Statistics
            </CardTitle>
            <CardDescription>
              Performance metrics for your billing email notifications
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24h</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={loadEmailStats}
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{stats.total_emails}</div>
            <div className="text-sm text-muted-foreground">Total Emails</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <span className="text-2xl font-bold">{stats.delivery_rate}%</span>
              {getTrendIcon(stats.delivery_rate)}
            </div>
            <div className="text-sm text-muted-foreground">Delivery Rate</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{stats.failed_emails}</div>
            <div className="text-sm text-muted-foreground">Failed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{Math.round(stats.avg_processing_time_minutes)}m</div>
            <div className="text-sm text-muted-foreground">Avg Processing</div>
          </div>
        </div>

        {/* Delivery Rate Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Delivery Success Rate</span>
            <span className="text-sm text-muted-foreground">{stats.delivery_rate}%</span>
          </div>
          <Progress 
            value={stats.delivery_rate} 
            className={cn(
              "h-2",
              stats.delivery_rate >= 95 ? "bg-green-100" : 
              stats.delivery_rate >= 80 ? "bg-yellow-100" : "bg-red-100"
            )}
          />
        </div>

        {/* Status Breakdown */}
        {Object.keys(stats.by_status).length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Email Status Breakdown</h4>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(stats.by_status).map(([status, count]) => (
                <div key={status} className={cn("flex items-center justify-between p-2 rounded border", getStatusColor(status))}>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(status)}
                    <span className="text-sm font-medium capitalize">{status}</span>
                  </div>
                  <Badge variant="outline">{count}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Email Type Breakdown */}
        {Object.keys(stats.by_type).length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Email Type Breakdown</h4>
            <div className="space-y-2">
              {Object.entries(stats.by_type).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between p-2 bg-muted rounded">
                  <span className="text-sm">{formatReminderType(type)}</span>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Health Indicator */}
        <div className="pt-4 border-t">
          <div className="flex items-center gap-2">
            {stats.delivery_rate >= 95 ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium text-green-600">Excellent delivery performance</span>
              </>
            ) : stats.delivery_rate >= 80 ? (
              <>
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-600">Good delivery performance</span>
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-red-600" />
                <span className="text-sm font-medium text-red-600">Delivery performance needs attention</span>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
