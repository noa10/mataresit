import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { claimService } from '@/services/claimService';
import { Claim } from '@/types/claims';

export default function TestClaimDetails() {
  const [claim, setClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testClaimId = '2f8ad1eb-a71a-45e1-9aff-1a5997d03b59'; // Known claim ID

  const loadClaim = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Loading claim:', testClaimId);
      
      const claimData = await claimService.getClaim(testClaimId);
      console.log('Claim data received:', claimData);
      
      setClaim(claimData);
    } catch (error: any) {
      console.error('Error loading claim:', error);
      setError(error.message || 'Failed to load claim');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClaim();
  }, []);

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Test Claim Details Service</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button onClick={loadClaim} disabled={loading}>
              {loading ? 'Loading...' : 'Test Load Claim'}
            </Button>

            {error && (
              <div className="p-4 bg-red-100 border border-red-400 rounded">
                <h3 className="font-semibold text-red-800">Error:</h3>
                <p className="text-red-700">{error}</p>
              </div>
            )}

            {claim && (
              <div className="p-4 bg-green-100 border border-green-400 rounded">
                <h3 className="font-semibold text-green-800">Success!</h3>
                <pre className="text-sm text-green-700 mt-2 overflow-auto">
                  {JSON.stringify(claim, null, 2)}
                </pre>
              </div>
            )}

            {!loading && !error && !claim && (
              <div className="p-4 bg-yellow-100 border border-yellow-400 rounded">
                <p className="text-yellow-700">No claim data loaded yet.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
