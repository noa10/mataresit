
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useSettings } from "@/hooks/useSettings";
import { Skeleton } from "@/components/ui/skeleton";

// Sample data - in a real application this would come from an API
const usageData = [
  { method: 'OCR + AI', count: 42 },
  { method: 'AI Vision', count: 28 },
];

export function UsageStatistics() {
  const { settings } = useSettings();
  const [isLoading, setIsLoading] = React.useState(true);

  // Simulate loading state
  React.useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  // Custom colors for the chart
  const colors = ['#9b87f5', '#7E69AB'];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage Statistics</CardTitle>
        <CardDescription>
          View your processing method usage over time
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-[200px] w-full" />
            <div className="flex justify-between">
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-4 w-[65px]" />
            </div>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={usageData}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="method" />
                <YAxis />
                <Tooltip 
                  formatter={(value) => [`${value} receipts`, 'Usage']}
                  labelFormatter={(label) => `Method: ${label}`}
                />
                <Bar dataKey="count" fill="#8884d8">
                  {usageData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            
            <div className="mt-4 text-sm text-muted-foreground">
              <p>Current method: <span className="font-medium text-foreground">{settings.processingMethod === 'ocr-ai' ? 'OCR + AI' : 'AI Vision'}</span></p>
              <p className="mt-1">Total receipts processed: <span className="font-medium text-foreground">{usageData.reduce((sum, item) => sum + item.count, 0)}</span></p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
