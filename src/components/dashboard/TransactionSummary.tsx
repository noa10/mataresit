
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart } from "lucide-react";

export function TransactionSummary() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-md font-medium">Expense Summary</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="flex items-center justify-center h-32">
          <div className="flex flex-col items-center text-center text-muted-foreground">
            <BarChart className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-sm">No expense data available</p>
            <p className="text-xs mt-1">Process receipts to see your spending patterns</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
