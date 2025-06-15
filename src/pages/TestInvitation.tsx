import React, { useState } from 'react';
import { useTeam } from '@/contexts/TeamContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase';

export default function TestInvitation() {
  const { currentTeam, inviteTeamMember } = useTeam();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTestInvitation = async () => {
    if (!currentTeam || !email.trim()) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      console.log('Testing invitation for:', email, 'to team:', currentTeam.id);
      const invitationId = await inviteTeamMember(currentTeam.id, email.trim(), 'member');
      setResult(`Successfully sent invitation to ${email}. Invitation ID: ${invitationId}`);
      console.log('Invitation sent successfully, ID:', invitationId);
    } catch (err: any) {
      console.error('Invitation failed:', err);
      setError(err.message || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleTestEdgeFunction = async () => {
    if (!email.trim()) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      // First create a test invitation manually
      console.log('Creating test invitation...');
      const { data: invitationId, error: rpcError } = await supabase.rpc('invite_team_member', {
        _team_id: currentTeam?.id,
        _email: email.trim(),
        _role: 'member',
      });

      if (rpcError) {
        throw new Error(`RPC Error: ${rpcError.message}`);
      }

      console.log('Test invitation created with ID:', invitationId);

      // Now test the Edge Function directly
      console.log('Testing Edge Function...');
      const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-team-invitation-email', {
        body: { invitation_id: invitationId }
      });

      if (emailError) {
        throw new Error(`Edge Function Error: ${emailError.message}`);
      }

      setResult(`Edge Function test successful! Invitation ID: ${invitationId}, Email result: ${JSON.stringify(emailResult)}`);
      console.log('Edge Function test successful:', emailResult);
    } catch (err: any) {
      console.error('Edge Function test failed:', err);
      setError(err.message || 'Edge Function test failed');
    } finally {
      setLoading(false);
    }
  };

  if (!currentTeam) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Test Team Invitation</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertDescription>
                No team selected. Please select a team first.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Test Team Invitation</CardTitle>
          <p className="text-sm text-muted-foreground">
            Current Team: {currentTeam.name} ({currentTeam.id})
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email Address
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="test@example.com"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Button
              onClick={handleTestInvitation}
              disabled={!email.trim() || loading}
              className="w-full"
            >
              {loading ? 'Sending Invitation...' : 'Send Test Invitation (Full Flow)'}
            </Button>

            <Button
              onClick={handleTestEdgeFunction}
              disabled={!email.trim() || loading}
              variant="outline"
              className="w-full"
            >
              {loading ? 'Testing Edge Function...' : 'Test Edge Function Directly'}
            </Button>
          </div>

          {result && (
            <Alert>
              <AlertDescription className="text-green-600">
                {result}
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>
                {error}
              </AlertDescription>
            </Alert>
          )}

          <div className="text-xs text-muted-foreground">
            <p>This page is for testing the team invitation functionality.</p>
            <p>Check the browser console and Supabase logs for detailed information.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
