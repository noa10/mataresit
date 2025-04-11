
import React from 'react';
import { Button } from "@/components/ui/button";
import { History } from "lucide-react";
import { ReceiptHistory } from "./ReceiptHistory";

interface ViewHistoryButtonProps {
  receiptId: string;
}

export function ViewHistoryButton({ receiptId }: ViewHistoryButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  
  return (
    <>
      <Button variant="outline" className="gap-2" onClick={() => setIsDialogOpen(true)}>
        <History size={16} />
        View History
      </Button>
      
      <ReceiptHistory 
        receiptId={receiptId}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </>
  );
}
