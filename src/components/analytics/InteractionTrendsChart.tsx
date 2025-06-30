import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { analyticsService } from '@/services/analyticsService';
import { RefreshCw } from 'lucide-react';

interface InteractionTrendsChartProps {
  timeframe: 'week' | 'month' | 'quarter';
}

export function InteractionTrendsChart({ timeframe }: InteractionTrendsChartProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrendsData();
  }, [timeframe]);

  const loadTrendsData = async () => {
    try {
      setLoading(true);
      const days = timeframe === 'week' ? 7 : timeframe === 'month' ? 30 : 90;
      const trendsData = await analyticsService.getInteractionTrends(days);
      
      // Format data for chart
      const formattedData = trendsData.map(item => ({
        ...item,
        date: new Date(item.date).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        })
      }));
      
      setData(formattedData.reverse()); // Show oldest to newest
    } catch (error) {
      console.error('Error loading trends data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Interaction Trends</CardTitle>
          <CardDescription>Your activity patterns over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center space-x-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Loading trends...</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Interaction Trends</CardTitle>
        <CardDescription>
          Your activity patterns over the last {timeframe}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-background border rounded-lg p-3 shadow-lg">
                        <p className="font-medium">{label}</p>
                        {payload.map((entry, index) => (
                          <p key={index} style={{ color: entry.color }}>
                            {entry.name}: {entry.value}
                          </p>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="interactions"
                stackId="1"
                stroke="#8884d8"
                fill="#8884d8"
                fillOpacity={0.6}
                name="Total Interactions"
              />
              <Area
                type="monotone"
                dataKey="chatMessages"
                stackId="2"
                stroke="#82ca9d"
                fill="#82ca9d"
                fillOpacity={0.6}
                name="Chat Messages"
              />
              <Area
                type="monotone"
                dataKey="searchQueries"
                stackId="3"
                stroke="#ffc658"
                fill="#ffc658"
                fillOpacity={0.6}
                name="Search Queries"
              />
              <Area
                type="monotone"
                dataKey="uiActions"
                stackId="4"
                stroke="#ff7300"
                fill="#ff7300"
                fillOpacity={0.6}
                name="UI Actions"
              />
              <Area
                type="monotone"
                dataKey="featureUsage"
                stackId="5"
                stroke="#8dd1e1"
                fill="#8dd1e1"
                fillOpacity={0.6}
                name="Feature Usage"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {data.reduce((sum, item) => sum + item.interactions, 0)}
            </div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {data.reduce((sum, item) => sum + item.chatMessages, 0)}
            </div>
            <div className="text-xs text-muted-foreground">Chat</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {data.reduce((sum, item) => sum + item.searchQueries, 0)}
            </div>
            <div className="text-xs text-muted-foreground">Search</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {data.reduce((sum, item) => sum + item.uiActions, 0)}
            </div>
            <div className="text-xs text-muted-foreground">UI Actions</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-cyan-600">
              {data.reduce((sum, item) => sum + item.featureUsage, 0)}
            </div>
            <div className="text-xs text-muted-foreground">Features</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
