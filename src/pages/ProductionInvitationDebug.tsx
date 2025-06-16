import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { teamService } from '@/services/teamService';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function ProductionInvitationDebug() {
  const { user } = useAuth();
  const [token, setToken] = useState('17d03bbd788ed9103780f590b35bc401c495d1f0365fbd29643f3a1f33f5765a');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  useEffect(() => {
    // Auto-run debug on load
    handleDebugInvitation();
  }, []);

  const handleDebugInvitation = async () => {
    if (!token.trim()) return;

    setLoading(true);
    setResult(null);
    setError(null);
    setDebugInfo(null);

    try {
      console.log('=== PRODUCTION INVITATION DEBUG ===');
      console.log('Token:', token);
      console.log('Current user:', user?.email);
      console.log('Environment:', window.location.origin);

      const debug: any = {
        token,
        user: user?.email,
        environment: window.location.origin,
        timestamp: new Date().toISOString(),
      };

      // Test 1: Direct Supabase query
      console.log('Testing direct Supabase query...');
      const { data: directData, error: directError } = await supabase
        .from('team_invitations')
        .select('*')
        .eq('token', token.trim())
        .single();

      debug.directQuery = {
        data: directData,
        error: directError?.message,
        success: !directError && !!directData,
      };

      console.log('Direct query result:', debug.directQuery);

      // Test 2: Query with team join
      console.log('Testing query with team join...');
      const { data: joinData, error: joinError } = await supabase
        .from('team_invitations')
        .select(`
          *,
          teams!team_invitations_team_id_fkey(name)
        `)
        .eq('token', token.trim())
        .single();

      debug.joinQuery = {
        data: joinData,
        error: joinError?.message,
        success: !joinError && !!joinData,
      };

      console.log('Join query result:', debug.joinQuery);

      // Test 3: TeamService method
      console.log('Testing teamService.getInvitationByToken...');
      try {
        const serviceResult = await teamService.getInvitationByToken(token.trim());
        debug.serviceMethod = {
          data: serviceResult,
          error: null,
          success: !!serviceResult,
        };
        console.log('Service method result:', debug.serviceMethod);
      } catch (serviceError: any) {
        debug.serviceMethod = {
          data: null,
          error: serviceError.message,
          success: false,
        };
        console.log('Service method error:', debug.serviceMethod);
      }

      // Test 4: Check pending invitations
      console.log('Testing pending invitation query...');
      const { data: pendingData, error: pendingError } = await supabase
        .from('team_invitations')
        .select(`
          *,
          teams!team_invitations_team_id_fkey(name)
        `)
        .eq('token', token.trim())
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .single();

      debug.pendingQuery = {
        data: pendingData,
        error: pendingError?.message,
        success: !pendingError && !!pendingData,
      };

      console.log('Pending query result:', debug.pendingQuery);

      setDebugInfo(debug);
      setResult('Debug completed successfully. Check console and debug info below.');

    } catch (err: any) {
      console.error('Debug failed:', err);
      setError(err.message || 'Debug failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTestSimpleQuery = async () => {
    if (!token.trim()) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      // Test the simplest possible query
      const { data, error } = await supabase
        .from('team_invitations')
        .select('id, email, status, expires_at')
        .eq('token', token.trim());

      if (error) {
        setError(`Query error: ${error.message}`);
      } else {
        setResult(`Simple query result: ${JSON.stringify(data, null, 2)}`);
      }
    } catch (err: any) {
      setError(err.message || 'Simple query failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Production Invitation Debug</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Environment: {window.location.origin}
            </p>
            <p className="text-sm text-muted-foreground">
              Current user: {user?.email || 'Not authenticated'}
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

          <div className="flex gap-2 flex-wrap">
            <Button 
              onClick={handleDebugInvitation}
              disabled={loading || !token.trim()}
            >
              {loading ? 'Running Debug...' : 'Run Full Debug'}
            </Button>
            <Button 
              onClick={handleTestSimpleQuery}
              disabled={loading || !token.trim()}
              variant="outline"
            >
              Test Simple Query
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

          {debugInfo && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Debug Information</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-xs bg-muted p-4 rounded overflow-auto max-h-96">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
