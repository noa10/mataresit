import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useStripe } from "@/contexts/StripeContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface SubscriptionStatusRefreshProps {
  className?: string;
  showStatusBadge?: boolean;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "secondary";
}

export default function SubscriptionStatusRefresh({
  className = "",
  showStatusBadge = true,
  size = "default",
  variant = "outline"
}: SubscriptionStatusRefreshProps) {
  const { refreshSubscription, subscriptionData } = useStripe();
  const { refreshUser } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshStatus, setLastRefreshStatus] = useState<'success' | 'error' | null>(null);

  const handleRefresh = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    setLastRefreshStatus(null);

    try {
      console.log('SubscriptionStatusRefresh: Manual refresh triggered');
      
      // Refresh both user and subscription data
      await Promise.all([
        refreshUser(),
        refreshSubscription()
      ]);

      // Get fresh subscription data
      const freshData = await refreshSubscription();
      
      if (freshData) {
        setLastRefreshStatus('success');
        toast.success("Subscription status refreshed successfully!");
      } else {
        setLastRefreshStatus('error');
        toast.warning("Unable to refresh subscription status. Please try again.");
      }
    } catch (error) {
      console.error('SubscriptionStatusRefresh: Refresh failed:', error);
      setLastRefreshStatus('error');
      toast.error("Failed to refresh subscription status. Please try again.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusBadge = () => {
    if (!subscriptionData) {
      return (
        <Badge variant="secondary">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Unknown
        </Badge>
      );
    }

    const statusColors = {
      'active': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'trialing': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'past_due': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'canceled': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      'incomplete': 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    };

    const statusIcons = {
      'active': CheckCircle,
      'trialing': CheckCircle,
      'past_due': AlertTriangle,
      'canceled': AlertTriangle,
      'incomplete': AlertTriangle,
    };

    const status = subscriptionData.status || 'active';
    const Icon = statusIcons[status as keyof typeof statusIcons] || CheckCircle;
    const colorClass = statusColors[status as keyof typeof statusColors] || statusColors.active;

    return (
      <Badge variant="default" className={colorClass}>
        <Icon className="h-3 w-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {showStatusBadge && (
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-muted-foreground">
            Status:
          </span>
          {getStatusBadge()}
        </div>
      )}
      
      <Button
        variant={variant}
        size={size}
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="flex items-center"
      >
        {isRefreshing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Refreshing...
          </>
        ) : (
          <>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Status
          </>
        )}
      </Button>

      {lastRefreshStatus === 'success' && (
        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
      )}
      {lastRefreshStatus === 'error' && (
        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
      )}
    </div>
  );
}

/**
 * Compact version for use in smaller spaces
 */
export function CompactSubscriptionRefresh({ className = "" }: { className?: string }) {
  return (
    <SubscriptionStatusRefresh
      className={className}
      showStatusBadge={false}
      size="sm"
      variant="outline"
    />
  );
}

/**
 * Full status display with refresh capability
 */
export function FullSubscriptionStatus({ className = "" }: { className?: string }) {
  const { subscriptionData } = useStripe();

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Subscription Status</h3>
        <CompactSubscriptionRefresh />
      </div>
      
      {subscriptionData && (
        <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Plan</p>
            <p className="text-lg font-semibold capitalize">{subscriptionData.tier}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Status</p>
            <div className="mt-1">
              <SubscriptionStatusRefresh showStatusBadge={true} size="sm" />
            </div>
          </div>
          {subscriptionData.subscriptionEndDate && (
            <div className="col-span-2">
              <p className="text-sm font-medium text-muted-foreground">Next Billing</p>
              <p className="text-sm">
                {new Date(subscriptionData.subscriptionEndDate).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
