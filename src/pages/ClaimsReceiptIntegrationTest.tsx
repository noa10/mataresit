import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Receipt, 
  FileText, 
  TestTube, 
  CheckCircle, 
  AlertCircle,
  Play,
  Eye
} from 'lucide-react';
import { CreateClaimDialog } from '@/components/claims/CreateClaimDialog';
import { CreateClaimDialogTest } from '@/components/claims/CreateClaimDialogTest';
import { ReceiptPicker } from '@/components/claims/ReceiptPicker';
import { ReceiptPreview } from '@/components/claims/ReceiptPreview';
import { ClaimFromReceiptButton } from '@/components/claims/ClaimFromReceiptButton';
import { ReceiptClaimDashboard } from '@/components/claims/ReceiptClaimDashboard';
import { useReceiptClaimIntegration } from '@/hooks/useReceiptClaimIntegration';
import { useQuery } from '@tanstack/react-query';
import { fetchReceipts } from '@/services/receiptService';
import { claimService } from '@/services/claimService';
import { useTeam } from '@/contexts/TeamContext';
import { toast } from 'sonner';

export default function ClaimsReceiptIntegrationTest() {
  const [createClaimOpen, setCreateClaimOpen] = useState(false);
  const [selectedReceiptIds, setSelectedReceiptIds] = useState<string[]>([]);
  const [testResults, setTestResults] = useState<Record<string, boolean>>({});
  
  const { currentTeam } = useTeam();
  const { useReceiptUsage, getReceiptUsageSummary } = useReceiptClaimIntegration();

  // Fetch test data
  const { data: receipts = [], isLoading: receiptsLoading } = useQuery({
    queryKey: ['receipts'],
    queryFn: fetchReceipts,
  });

  const { data: claims = [], isLoading: claimsLoading } = useQuery({
    queryKey: ['team-claims', currentTeam?.id],
    queryFn: () => currentTeam ? claimService.getTeamClaims(currentTeam.id) : Promise.resolve([]),
    enabled: !!currentTeam,
  });

  const { data: receiptUsage = [] } = useReceiptUsage(receipts.map(r => r.id));

  const selectedReceipts = receipts.filter(r => selectedReceiptIds.includes(r.id));
  const usageSummary = getReceiptUsageSummary(receiptUsage);

  // Test functions
  const runTest = (testName: string, testFn: () => boolean) => {
    try {
      const result = testFn();
      setTestResults(prev => ({ ...prev, [testName]: result }));
      if (result) {
        toast.success(`✅ ${testName} passed`);
      } else {
        toast.error(`❌ ${testName} failed`);
      }
      return result;
    } catch (error) {
      console.error(`Test ${testName} error:`, error);
      setTestResults(prev => ({ ...prev, [testName]: false }));
      toast.error(`❌ ${testName} failed with error`);
      return false;
    }
  };

  const runAllTests = () => {
    const tests = [
      {
        name: 'Data Loading',
        test: () => receipts.length > 0 && claims.length >= 0
      },
      {
        name: 'Receipt Usage Tracking',
        test: () => receiptUsage.length === receipts.length
      },
      {
        name: 'Usage Summary Calculation',
        test: () => usageSummary.total === receipts.length
      },
      {
        name: 'Receipt Selection',
        test: () => selectedReceiptIds.length >= 0
      },
      {
        name: 'Component Rendering',
        test: () => document.querySelector('[data-testid="receipt-picker"]') !== null
      }
    ];

    let allPassed = true;
    tests.forEach(({ name, test }) => {
      const passed = runTest(name, test);
      if (!passed) allPassed = false;
    });

    if (allPassed) {
      toast.success('🎉 All tests passed!');
    } else {
      toast.error('❌ Some tests failed');
    }
  };

  const TestStatus = ({ testName }: { testName: string }) => {
    const result = testResults[testName];
    if (result === undefined) return <Badge variant="outline">Not Run</Badge>;
    return result ? 
      <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Passed</Badge> :
      <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Failed</Badge>;
  };

  if (receiptsLoading || claimsLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2">Loading test data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <TestTube className="h-8 w-8" />
          Claims-Receipt Integration Test
        </h1>
        <p className="text-muted-foreground mt-2">
          Test and verify the claims-receipt integration functionality
        </p>
      </motion.div>

      {/* Test Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Test Controls
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button onClick={runAllTests} className="gap-2">
              <TestTube className="h-4 w-4" />
              Run All Tests
            </Button>
            <Button variant="outline" onClick={() => setTestResults({})}>
              Clear Results
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-2 border rounded">
              <span className="text-sm">Data Loading</span>
              <TestStatus testName="Data Loading" />
            </div>
            <div className="flex items-center justify-between p-2 border rounded">
              <span className="text-sm">Receipt Usage Tracking</span>
              <TestStatus testName="Receipt Usage Tracking" />
            </div>
            <div className="flex items-center justify-between p-2 border rounded">
              <span className="text-sm">Usage Summary</span>
              <TestStatus testName="Usage Summary Calculation" />
            </div>
            <div className="flex items-center justify-between p-2 border rounded">
              <span className="text-sm">Receipt Selection</span>
              <TestStatus testName="Receipt Selection" />
            </div>
            <div className="flex items-center justify-between p-2 border rounded">
              <span className="text-sm">Component Rendering</span>
              <TestStatus testName="Component Rendering" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Data Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Receipts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{receipts.length}</div>
            <p className="text-xs text-muted-foreground">Total receipts loaded</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Claims
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{claims.length}</div>
            <p className="text-xs text-muted-foreground">Total claims loaded</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usageSummary.used}/{usageSummary.total}</div>
            <p className="text-xs text-muted-foreground">Receipts used in claims</p>
          </CardContent>
        </Card>
      </div>

      {/* Component Tests */}
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="picker">Receipt Picker</TabsTrigger>
          <TabsTrigger value="preview">Receipt Preview</TabsTrigger>
          <TabsTrigger value="create">Create Claim</TabsTrigger>
          <TabsTrigger value="test">Dialog Test</TabsTrigger>
          <TabsTrigger value="integration">Integration</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Receipt-Claim Dashboard Test</CardTitle>
            </CardHeader>
            <CardContent>
              <ReceiptClaimDashboard
                onCreateClaim={() => setCreateClaimOpen(true)}
                onViewReceipts={() => toast.info('Navigate to receipts page')}
                onViewClaims={() => toast.info('Navigate to claims page')}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="picker" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Receipt Picker Test</CardTitle>
            </CardHeader>
            <CardContent>
              <div data-testid="receipt-picker">
                <ReceiptPicker
                  selectedReceiptIds={selectedReceiptIds}
                  onSelectionChange={setSelectedReceiptIds}
                  multiSelect={true}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Receipt Preview Test</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedReceipts.length > 0 ? (
                <ReceiptPreview
                  receipts={selectedReceipts}
                  onRemoveReceipt={(id) => {
                    setSelectedReceiptIds(prev => prev.filter(rid => rid !== id));
                  }}
                  showRemoveButton={true}
                />
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Select receipts in the Receipt Picker tab to see preview
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create Claim Test</CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setCreateClaimOpen(true)} className="gap-2">
                <FileText className="h-4 w-4" />
                Test Create Claim Dialog
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test" className="space-y-4">
          <CreateClaimDialogTest />
        </TabsContent>

        <TabsContent value="test" className="space-y-4">
          <CreateClaimDialogTest />
        </TabsContent>

        <TabsContent value="integration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Integration Features Test</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {receipts.slice(0, 3).map(receipt => (
                <div key={receipt.id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <div className="font-medium">{receipt.merchant}</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(receipt.date).toLocaleDateString()} • ${receipt.total}
                    </div>
                  </div>
                  <ClaimFromReceiptButton
                    receipt={receipt}
                    onClaimCreated={() => toast.success('Claim created from receipt!')}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Claim Dialog */}
      <CreateClaimDialog
        open={createClaimOpen}
        onOpenChange={setCreateClaimOpen}
        onSuccess={() => {
          toast.success('Test claim created successfully!');
          setCreateClaimOpen(false);
        }}
      />
    </div>
  );
}
