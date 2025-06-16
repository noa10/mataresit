import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { teamService } from '@/services/teamService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function TestInvitationAcceptance() {
  const { user } = useAuth();
  const [token, setToken] = useState('e1c86fe6bd5bbda976df3c4db342ca51eadc93dac06032bf1942a021d0da18fe');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTestAcceptance = async () => {
    if (!token.trim()) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      console.log('Testing invitation acceptance for token:', token);
      console.log('Current user:', user?.email);
      
      const success = await teamService.acceptInvitation(token.trim());
      setResult(`Successfully accepted invitation! Result: ${success}`);
      console.log('Invitation accepted successfully:', success);
    } catch (err: any) {
      console.error('Invitation acceptance failed:', err);
      setError(err.message || 'Failed to accept invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleTestGetInvitation = async () => {
    if (!token.trim()) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      console.log('Testing get invitation for token:', token);
      
      const invitation = await teamService.getInvitationByToken(token.trim());
      setResult(`Invitation details: ${JSON.stringify(invitation, null, 2)}`);
      console.log('Invitation details:', invitation);
    } catch (err: any) {
      console.error('Get invitation failed:', err);
      setError(err.message || 'Failed to get invitation');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p>Please sign in to test invitation acceptance.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Test Invitation Acceptance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Current user: {user.email}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">Invitation Token:</label>
            <Input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Enter invitation token"
              className="mt-1"
            />
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handleTestGetInvitation}
              disabled={loading || !token.trim()}
              variant="outline"
            >
              {loading ? 'Loading...' : 'Get Invitation Details'}
            </Button>
            <Button 
              onClick={handleTestAcceptance}
              disabled={loading || !token.trim()}
            >
              {loading ? 'Loading...' : 'Accept Invitation'}
            </Button>
          </div>

          {result && (
            <Alert>
              <AlertDescription>
                <pre className="whitespace-pre-wrap text-xs">{result}</pre>
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
