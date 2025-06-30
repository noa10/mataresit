/**
 * Feedback Analytics Component
 * 
 * Admin component for viewing message feedback analytics
 * and user satisfaction metrics.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ThumbsUp, 
  ThumbsDown, 
  TrendingUp, 
  TrendingDown,
  BarChart3,
  Calendar,
  RefreshCw,
  Download
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';

interface FeedbackAnalytics {
  total_feedback: number;
  positive_feedback: number;
  negative_feedback: number;
  positive_percentage: number;
  feedback_by_day: Array<{
    date: string;
    total: number;
    positive: number;
  }>;
}

export function FeedbackAnalytics() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<FeedbackAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState(30); // Days
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Load analytics on mount and when date range changes
  useEffect(() => {
    if (user) {
      loadAnalytics();
    }
  }, [user, dateRange]);

  /**
   * Load feedback analytics from database
   */
  const loadAnalytics = async () => {
    setIsLoading(true);
    
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - dateRange);
      
      const { data, error } = await supabase.rpc('get_feedback_analytics', {
        p_start_date: startDate.toISOString(),
        p_end_date: new Date().toISOString()
      });

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        setAnalytics(data[0]);
        setLastUpdated(new Date());
      } else {
        setAnalytics({
          total_feedback: 0,
          positive_feedback: 0,
          negative_feedback: 0,
          positive_percentage: 0,
          feedback_by_day: []
        });
      }
    } catch (error) {
      console.error('Error loading feedback analytics:', error);
      toast.error('Failed to load feedback analytics');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Export analytics data as CSV
   */
  const exportAnalytics = () => {
    if (!analytics) return;

    const csvData = [
      ['Date', 'Total Feedback', 'Positive Feedback', 'Negative Feedback', 'Positive %'],
      ...analytics.feedback_by_day.map(day => [
        day.date,
        day.total.toString(),
        day.positive.toString(),
        (day.total - day.positive).toString(),
        day.total > 0 ? ((day.positive / day.total) * 100).toFixed(1) + '%' : '0%'
      ])
    ];

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `feedback-analytics-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast.success('Analytics exported successfully');
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Feedback Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            Loading analytics...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Feedback Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No feedback data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const negativePercentage = 100 - analytics.positive_percentage;

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Feedback Analytics</h2>
          <p className="text-muted-foreground">
            User satisfaction metrics for the last {dateRange} days
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Date Range Selector */}
          <div className="flex gap-1">
            {[7, 30, 90].map((days) => (
              <Button
                key={days}
                variant={dateRange === days ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateRange(days)}
              >
                {days}d
              </Button>
            ))}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={loadAnalytics}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={exportAnalytics}
            disabled={analytics.total_feedback === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Feedback */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Feedback</p>
                <p className="text-2xl font-bold">{analytics.total_feedback}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        {/* Positive Feedback */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Positive</p>
                <p className="text-2xl font-bold text-green-600">{analytics.positive_feedback}</p>
                <p className="text-xs text-muted-foreground">
                  {analytics.positive_percentage.toFixed(1)}%
                </p>
              </div>
              <ThumbsUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        {/* Negative Feedback */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Negative</p>
                <p className="text-2xl font-bold text-red-600">{analytics.negative_feedback}</p>
                <p className="text-xs text-muted-foreground">
                  {negativePercentage.toFixed(1)}%
                </p>
              </div>
              <ThumbsDown className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        {/* Satisfaction Score */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Satisfaction</p>
                <p className="text-2xl font-bold">
                  {analytics.positive_percentage.toFixed(1)}%
                </p>
                <Badge 
                  variant={analytics.positive_percentage >= 80 ? 'default' : 
                          analytics.positive_percentage >= 60 ? 'secondary' : 'destructive'}
                  className="text-xs"
                >
                  {analytics.positive_percentage >= 80 ? 'Excellent' :
                   analytics.positive_percentage >= 60 ? 'Good' : 'Needs Improvement'}
                </Badge>
              </div>
              {analytics.positive_percentage >= 80 ? (
                <TrendingUp className="h-8 w-8 text-green-600" />
              ) : (
                <TrendingDown className="h-8 w-8 text-red-600" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Feedback Chart */}
      {analytics.feedback_by_day.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Daily Feedback Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.feedback_by_day.slice(-14).map((day, index) => {
                const positiveRate = day.total > 0 ? (day.positive / day.total) * 100 : 0;
                const negativeCount = day.total - day.positive;
                
                return (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">
                        {format(new Date(day.date), 'MMM dd')}
                      </span>
                      <div className="flex items-center gap-4">
                        <span className="text-green-600">
                          {day.positive} positive
                        </span>
                        <span className="text-red-600">
                          {negativeCount} negative
                        </span>
                        <span className="font-medium">
                          {positiveRate.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${positiveRate}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Last Updated */}
      {lastUpdated && (
        <div className="text-center text-sm text-muted-foreground">
          Last updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
        </div>
      )}
    </div>
  );
}
