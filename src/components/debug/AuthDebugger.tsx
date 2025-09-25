import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Info, RefreshCw } from 'lucide-react';

interface AuthDebugInfo {
  currentUrl: string;
  origin: string;
  hash: string;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  hasError: boolean;
  redirectUrl: string;
  supabaseUrl: string;
  environment: string;
  isAllowedRedirect: boolean;
  sessionStatus: string;
  userStatus: string;
}

export function AuthDebugger() {
  const { user, session, loading, signInWithGoogle } = useAuth();
  const [debugInfo, setDebugInfo] = useState<AuthDebugInfo | null>(null);
  const [isTestingAuth, setIsTestingAuth] = useState(false);

  const allowedRedirectUrls = [
    'http://localhost:8080/auth',
    'http://localhost:5173/auth',
    'http://localhost:3000/auth',
    'https://mataresit.co/auth',
    'https://paperless-maverick.vercel.app/auth'
  ];

  const getRedirectUrl = (path: string = '/auth'): string => {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const isProduction = window.location.hostname.includes('mataresit.co') || 
                        window.location.hostname.includes('vercel.app');
    
    if (isProduction) {
      const productionUrl = 'https://mataresit.co';
      return `${productionUrl}${normalizedPath}`;
    }
    
    const baseUrl = window.location.origin;
    return `${baseUrl}${normalizedPath}`;
  };

  const collectDebugInfo = (): AuthDebugInfo => {
    const hash = window.location.hash;
    const redirectUrl = getRedirectUrl();
    
    return {
      currentUrl: window.location.href,
      origin: window.location.origin,
      hash: hash || 'None',
      hasAccessToken: hash.includes('access_token'),
      hasRefreshToken: hash.includes('refresh_token'),
      hasError: hash.includes('error'),
      redirectUrl,
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL || 'Not set',
      environment: window.location.hostname.includes('localhost') ? 'Development' : 'Production',
      isAllowedRedirect: allowedRedirectUrls.includes(redirectUrl),
      sessionStatus: session ? 'Active' : 'None',
      userStatus: user ? `Authenticated (${user.email})` : 'Not authenticated'
    };
  };

  useEffect(() => {
    setDebugInfo(collectDebugInfo());
  }, [session, user]);

  const handleTestGoogleAuth = async () => {
    setIsTestingAuth(true);
    try {
      console.log('AuthDebugger: Testing Google OAuth with redirect URL:', getRedirectUrl());
      await signInWithGoogle();
    } catch (error) {
      console.error('AuthDebugger: Google OAuth test failed:', error);
    } finally {
      setIsTestingAuth(false);
    }
  };

  const handleRefreshDebugInfo = () => {
    setDebugInfo(collectDebugInfo());
  };

  const handleCheckSession = async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      console.log('Current session:', data.session);
      console.log('Session error:', error);
      setDebugInfo(collectDebugInfo());
    } catch (error) {
      console.error('Error checking session:', error);
    }
  };

  if (!debugInfo) return null;

  return (
    <div className="space-y-4 p-4 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Google OAuth Debug Information
          </CardTitle>
          <CardDescription>
            Debug information for Google OAuth authentication issues
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Environment Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold">Environment</h4>
              <div className="space-y-1 text-sm">
                <div><strong>Current URL:</strong> {debugInfo.currentUrl}</div>
                <div><strong>Origin:</strong> {debugInfo.origin}</div>
                <div><strong>Environment:</strong> 
                  <Badge variant={debugInfo.environment === 'Development' ? 'secondary' : 'default'}>
                    {debugInfo.environment}
                  </Badge>
                </div>
                <div><strong>Supabase URL:</strong> {debugInfo.supabaseUrl}</div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold">Authentication Status</h4>
              <div className="space-y-1 text-sm">
                <div><strong>Session:</strong> 
                  <Badge variant={debugInfo.sessionStatus === 'Active' ? 'default' : 'secondary'}>
                    {debugInfo.sessionStatus}
                  </Badge>
                </div>
                <div><strong>User:</strong> {debugInfo.userStatus}</div>
                <div><strong>Loading:</strong> {loading ? 'Yes' : 'No'}</div>
              </div>
            </div>
          </div>

          {/* Redirect URL Analysis */}
          <div className="space-y-2">
            <h4 className="font-semibold">Redirect URL Analysis</h4>
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                {debugInfo.isAllowedRedirect ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <strong>Generated Redirect URL:</strong> {debugInfo.redirectUrl}
              </div>
              <div className="text-sm">
                <strong>Status:</strong> {debugInfo.isAllowedRedirect ? (
                  <span className="text-green-600">✓ Allowed in Supabase configuration</span>
                ) : (
                  <span className="text-red-600">✗ NOT allowed in Supabase configuration</span>
                )}
              </div>
              {!debugInfo.isAllowedRedirect && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm">
                  <strong>Issue:</strong> This redirect URL is not in the Supabase allowed list. 
                  Add it to your Supabase project's Auth settings.
                </div>
              )}
            </div>
          </div>

          {/* URL Hash Analysis */}
          <div className="space-y-2">
            <h4 className="font-semibold">URL Hash Analysis</h4>
            <div className="p-3 bg-muted rounded-lg">
              <div className="space-y-1 text-sm">
                <div><strong>Current Hash:</strong> {debugInfo.hash}</div>
                <div><strong>Has Access Token:</strong> 
                  <Badge variant={debugInfo.hasAccessToken ? 'default' : 'secondary'}>
                    {debugInfo.hasAccessToken ? 'Yes' : 'No'}
                  </Badge>
                </div>
                <div><strong>Has Refresh Token:</strong> 
                  <Badge variant={debugInfo.hasRefreshToken ? 'default' : 'secondary'}>
                    {debugInfo.hasRefreshToken ? 'Yes' : 'No'}
                  </Badge>
                </div>
                <div><strong>Has Error:</strong> 
                  <Badge variant={debugInfo.hasError ? 'destructive' : 'secondary'}>
                    {debugInfo.hasError ? 'Yes' : 'No'}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Allowed Redirect URLs */}
          <div className="space-y-2">
            <h4 className="font-semibold">Allowed Redirect URLs</h4>
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-sm space-y-1">
                {allowedRedirectUrls.map((url, index) => (
                  <div key={index} className="flex items-center gap-2">
                    {url === debugInfo.redirectUrl ? (
                      <CheckCircle className="h-3 w-3 text-green-600" />
                    ) : (
                      <div className="h-3 w-3 rounded-full bg-gray-300" />
                    )}
                    {url}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-4">
            <Button onClick={handleRefreshDebugInfo} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Info
            </Button>
            <Button onClick={handleCheckSession} variant="outline" size="sm">
              Check Session
            </Button>
            <Button 
              onClick={handleTestGoogleAuth} 
              disabled={isTestingAuth}
              size="sm"
            >
              {isTestingAuth ? 'Testing...' : 'Test Google OAuth'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
