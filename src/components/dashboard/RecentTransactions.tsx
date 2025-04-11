
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Receipt, ArrowRight } from "lucide-react";
import { Link } from 'react-router-dom';

interface RecentTransactionsProps {
  limit?: number;
}

export function RecentTransactions({ limit = 5 }: RecentTransactionsProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-md font-medium">Recent Receipts</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/dashboard" className="text-xs text-muted-foreground hover:text-foreground flex items-center">
            View all
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="flex items-center justify-center h-32">
          <div className="flex flex-col items-center text-center text-muted-foreground">
            <Receipt className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-sm">No recent receipts found</p>
            <p className="text-xs mt-1">Receipts you upload will appear here</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
