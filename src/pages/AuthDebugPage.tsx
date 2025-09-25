import React from 'react';
import { AuthDebugger } from '@/components/debug/AuthDebugger';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AuthDebugPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-6">
          <Button 
            onClick={() => navigate('/auth')} 
            variant="outline" 
            size="sm"
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Auth
          </Button>
          
          <Card>
            <CardHeader>
              <CardTitle>Authentication Debug Tool</CardTitle>
              <CardDescription>
                This page helps diagnose Google OAuth authentication issues on localhost.
                Use this tool to verify your configuration and test the authentication flow.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">Common Issues & Solutions:</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• <strong>Redirect URL not allowed:</strong> Add your localhost URL to Supabase Auth settings</li>
                    <li>• <strong>CORS errors:</strong> Check that your Supabase project allows your domain</li>
                    <li>• <strong>Google OAuth not configured:</strong> Verify Google OAuth is set up in Supabase</li>
                    <li>• <strong>Environment variables:</strong> Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set</li>
                  </ul>
                </div>
                
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-semibold text-green-900 mb-2">Quick Fix Steps:</h4>
                  <ol className="text-sm text-green-800 space-y-1">
                    <li>1. Verify your development server is running on port 5173</li>
                    <li>2. Check that http://localhost:5173/auth is in your Supabase allowed redirect URLs</li>
                    <li>3. Test the Google OAuth flow using the button below</li>
                    <li>4. Check browser console for any error messages</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <AuthDebugger />
      </div>
    </div>
  );
}
