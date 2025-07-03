import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle,
  XCircle,
  FileText,
  RotateCcw,
  ExternalLink,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EnhancedScrollArea } from "@/components/ui/enhanced-scroll-area";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReceiptUpload } from "@/types/receipt";
import DailyReceiptBrowserModal from "@/components/DailyReceiptBrowserModal";

interface BatchUploadReviewProps {
  completedUploads: ReceiptUpload[];
  failedUploads: ReceiptUpload[];
  receiptIds: Record<string, string>;
  onRetry: (uploadId: string) => void;
  onRetryAll: () => void;
  onClose: () => void;
  onReset: () => void;
  onViewAllReceipts?: () => void;
}

export function BatchUploadReview({
  completedUploads,
  failedUploads,
  receiptIds,
  onRetry,
  onRetryAll,
  onClose,
  onReset,
  onViewAllReceipts
}: BatchUploadReviewProps) {
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState<'completed' | 'failed'>(
    completedUploads.length > 0 ? 'completed' : 'failed'
  );
  const [isReceiptBrowserOpen, setIsReceiptBrowserOpen] = useState(false);

  const totalUploads = completedUploads.length + failedUploads.length;
  const successRate = totalUploads > 0
    ? Math.round((completedUploads.length / totalUploads) * 100)
    : 0;

  // Extract receipt IDs from completed uploads
  const successfulReceiptIds = completedUploads
    .map(upload => {
      const receiptId = receiptIds[upload.id];
      if (!receiptId) {
        console.log(`No receipt ID found for upload ID: ${upload.id}`);
      }
      return receiptId;
    })
    .filter(Boolean) as string[];

  console.log('Successful receipt IDs:', successfulReceiptIds);

  const viewReceipt = (receiptId: string) => {
    navigate(`/receipt/${receiptId}`);
  };

  const viewAllReceipts = () => {
    console.log('View Uploaded Receipts clicked');

    if (onViewAllReceipts) {
      console.log('Using provided onViewAllReceipts callback');
      onViewAllReceipts();
    } else if (successfulReceiptIds.length > 0) {
      console.log('Opening DailyReceiptBrowserModal with IDs:', successfulReceiptIds);
      // Open the DailyReceiptBrowserModal with the uploaded receipts
      setIsReceiptBrowserOpen(true);
    } else {
      console.log('No successful receipt IDs, navigating to dashboard');
      navigate('/dashboard');
      onClose();
    }
  };

  return (
    <>
      <Card className="w-full max-w-4xl mx-auto flex flex-col h-full">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Batch Upload Results</span>
            <div className="text-sm font-normal flex items-center gap-2">
              <span className={`px-2 py-1 rounded-full ${successRate >= 80 ? 'bg-green-100 text-green-800' : successRate >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                Success Rate: {successRate}%
              </span>
            </div>
          </CardTitle>
          <CardDescription>
            {completedUploads.length} of {totalUploads} receipts were successfully processed
          </CardDescription>
        </CardHeader>

      <CardContent className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex border-b mb-4 flex-shrink-0">
          <button
            className={`pb-2 px-4 font-medium text-sm ${
              selectedTab === 'completed'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground'
            }`}
            onClick={() => setSelectedTab('completed')}
          >
            Completed ({completedUploads.length})
          </button>
          <button
            className={`pb-2 px-4 font-medium text-sm ${
              selectedTab === 'failed'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground'
            }`}
            onClick={() => setSelectedTab('failed')}
          >
            Failed ({failedUploads.length})
          </button>
        </div>

        <EnhancedScrollArea
          className="flex-1 w-full min-h-0"
          showScrollIndicator={true}
          fadeEdges={true}
          maxHeight="400px"
        >
          {selectedTab === 'completed' && completedUploads.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">Status</TableHead>
                  <TableHead>File Name</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completedUploads.map((upload) => (
                  <TableRow key={upload.id}>
                    <TableCell>
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    </TableCell>
                    <TableCell className="font-medium">{upload.file.name}</TableCell>
                    <TableCell className="text-right">
                      {receiptIds[upload.id] && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => viewReceipt(receiptIds[upload.id])}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Receipt
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {selectedTab === 'failed' && failedUploads.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">Status</TableHead>
                  <TableHead>File Name</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failedUploads.map((upload) => (
                  <TableRow key={upload.id}>
                    <TableCell>
                      <XCircle className="h-5 w-5 text-destructive" />
                    </TableCell>
                    <TableCell className="font-medium">{upload.file.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {upload.error?.message || "Unknown error"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRetry(upload.id)}
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Retry
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {selectedTab === 'completed' && completedUploads.length === 0 && (
            <div className="flex flex-col items-center justify-center h-[200px] text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <p className="text-muted-foreground">No receipts were successfully processed</p>
              {failedUploads.length > 0 && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setSelectedTab('failed')}
                >
                  View Failed Uploads
                </Button>
              )}
            </div>
          )}

          {selectedTab === 'failed' && failedUploads.length === 0 && (
            <div className="flex flex-col items-center justify-center h-[200px] text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
              <p className="text-muted-foreground">All receipts were processed successfully!</p>
              {completedUploads.length > 0 && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setSelectedTab('completed')}
                >
                  View Completed Uploads
                </Button>
              )}
            </div>
          )}
        </EnhancedScrollArea>
      </CardContent>

      <CardFooter className="flex justify-between border-t pt-4 relative z-20 bg-card flex-shrink-0">
        <div>
          {failedUploads.length > 0 && (
            <Button variant="outline" onClick={onRetryAll}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Retry All Failed
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onReset}>
            Upload More
          </Button>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={viewAllReceipts}>
            View Uploaded Receipts
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardFooter>
    </Card>

    {/* Receipt Browser Modal */}
    <DailyReceiptBrowserModal
      date={new Date().toISOString().split('T')[0]}
      receiptIds={successfulReceiptIds}
      isOpen={isReceiptBrowserOpen}
      onClose={() => setIsReceiptBrowserOpen(false)}
    />
    </>
  );
}
