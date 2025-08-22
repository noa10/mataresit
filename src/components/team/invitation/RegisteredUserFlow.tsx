/**
 * Registered User Flow Component
 * Handles invitation acceptance for users who have accounts but are logged out
 * Provides streamlined login with invitation context preservation
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import {
  LogIn,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Send,
} from 'lucide-react';
import {
  TeamInvitation,
  UserType,
} from '@/types/team';
import { UserStateDetectionResult } from '@/services/invitationFlowService';
import { InvitationPreview, getInvitationCTA } from './InvitationPreview';

interface RegisteredUserFlowProps {
  invitation: TeamInvitation;
  userState: UserStateDetectionResult;
  token: string;
  sessionId?: string;
  onSuccess: (teamId: string, teamName: string, redirectUrl?: string) => void;
  onError: (error: string, errorCode?: string) => void;
}

interface LoginFormData {
  email: string;
  password: string;
}

type LoginMethod = 'password' | 'magic_link';

export function RegisteredUserFlow({
  invitation,
  userState,
  token,
  sessionId,
  onSuccess,
  onError,
}: RegisteredUserFlowProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState<'preview' | 'login' | 'processing'>('preview');
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('password');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState<LoginFormData>({
    email: invitation.email,
    password: '',
  });

  const [formErrors, setFormErrors] = useState<Partial<LoginFormData>>({});

  // Validate form data
  const validateForm = (): boolean => {
    const errors: Partial<LoginFormData> = {};

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (loginMethod === 'password' && !formData.password) {
      errors.password = 'Password is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form input changes
  const handleInputChange = (field: keyof LoginFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error for this field when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // Handle password login
  const handlePasswordLogin = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setCurrentStep('processing');

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (authError) {
        throw authError;
      }

      if (!authData.user || !authData.session) {
        throw new Error('Failed to sign in');
      }

      // Store invitation context for post-login processing
      localStorage.setItem('pending_invitation', JSON.stringify({
        token,
        teamId: invitation.team_id,
        teamName: invitation.team_name,
        sessionId,
      }));

      // Process the invitation acceptance
      await processInvitationAcceptance(authData.user.id);

    } catch (error: any) {
      console.error('Login error:', error);
      setCurrentStep('login');
      
      let errorMessage = 'Failed to sign in';
      if (error.message?.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password. Please check your credentials and try again.';
      } else if (error.message?.includes('Email not confirmed')) {
        errorMessage = 'Please check your email and click the confirmation link before signing in.';
      } else if (error.message?.includes('Too many requests')) {
        errorMessage = 'Too many login attempts. Please wait a moment and try again.';
      }
      
      onError(errorMessage, 'LOGIN_FAILED');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle magic link login
  const handleMagicLinkLogin = async () => {
    if (!formData.email.trim()) {
      setFormErrors({ email: 'Email is required' });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: formData.email,
        options: {
          data: {
            invitation_token: token,
          },
        },
      });

      if (error) {
        throw error;
      }

      toast({
        title: 'Check Your Email',
        description: 'We\'ve sent you a magic link. Click the link in your email to sign in and accept the invitation.',
        duration: 10000,
      });

      // Store invitation context for post-login processing
      localStorage.setItem('pending_invitation', JSON.stringify({
        token,
        teamId: invitation.team_id,
        teamName: invitation.team_name,
        sessionId,
      }));

      // Navigate to a confirmation waiting page
      navigate('/auth/magic-link-sent', { 
        state: { 
          email: formData.email,
          invitationToken: token,
          teamName: invitation.team_name,
        }
      });

    } catch (error: any) {
      console.error('Magic link error:', error);
      
      let errorMessage = 'Failed to send magic link';
      if (error.message?.includes('rate limit')) {
        errorMessage = 'Too many requests. Please wait a moment before requesting another magic link.';
      }
      
      onError(errorMessage, 'MAGIC_LINK_FAILED');
    } finally {
      setIsLoading(false);
    }
  };

  // Process invitation acceptance after successful login
  const processInvitationAcceptance = async (userId: string) => {
    try {
      // The invitation will be automatically processed by the auth callback
      // or we can process it here directly
      onSuccess(invitation.team_id, invitation.team_name, `/teams/${invitation.team_id}`);
    } catch (error: any) {
      console.error('Error processing invitation:', error);
      onError('Signed in successfully, but failed to join team. Please try accepting the invitation again.', 'INVITATION_PROCESSING_FAILED');
    }
  };

  // Render preview step
  if (currentStep === 'preview') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-6">
          <InvitationPreview
            invitation={invitation}
            userType="logged_out"
          />
          
          <Card>
            <CardHeader className="text-center">
              <LogIn className="h-8 w-8 mx-auto text-primary mb-2" />
              <CardTitle>Sign In to Continue</CardTitle>
              <CardDescription>
                Sign in to your account to join {invitation.team_name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={() => setCurrentStep('login')}
                className="w-full"
                size="lg"
              >
                {getInvitationCTA('logged_out')}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              
              <div className="text-center">
                <Button 
                  variant="link" 
                  onClick={() => navigate('/auth/signup', { state: { invitationToken: token } })}
                  className="text-sm"
                >
                  Don't have an account? Create one
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Render processing step
  if (currentStep === 'processing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center space-y-4">
              <Spinner size="lg" className="mx-auto" />
              <h3 className="text-lg font-semibold">Signing You In</h3>
              <p className="text-muted-foreground">
                Please wait while we sign you in and add you to the team...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render login form step
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <Card>
          <CardHeader>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentStep('preview')}
              className="w-fit p-0 h-auto"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to invitation
            </Button>
            <CardTitle className="text-center">Sign In</CardTitle>
            <CardDescription className="text-center">
              Welcome back! Sign in to join {invitation.team_name}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Login Method Toggle */}
            <div className="flex rounded-lg bg-muted p-1">
              <Button
                variant={loginMethod === 'password' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setLoginMethod('password')}
                className="flex-1"
              >
                <Lock className="h-4 w-4 mr-2" />
                Password
              </Button>
              <Button
                variant={loginMethod === 'magic_link' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setLoginMethod('magic_link')}
                className="flex-1"
              >
                <Send className="h-4 w-4 mr-2" />
                Magic Link
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="Enter your email"
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
              {formErrors.email && (
                <p className="text-sm text-destructive">{formErrors.email}</p>
              )}
            </div>

            {loginMethod === 'password' && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    placeholder="Enter your password"
                    className="pl-10 pr-10"
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {formErrors.password && (
                  <p className="text-sm text-destructive">{formErrors.password}</p>
                )}
              </div>
            )}

            <Button 
              onClick={loginMethod === 'password' ? handlePasswordLogin : handleMagicLinkLogin}
              disabled={isLoading}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  {loginMethod === 'password' ? 'Signing In...' : 'Sending Magic Link...'}
                </>
              ) : (
                <>
                  {loginMethod === 'password' ? 'Sign In & Join Team' : 'Send Magic Link'}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>

            {loginMethod === 'password' && (
              <div className="text-center">
                <Button 
                  variant="link" 
                  onClick={() => navigate('/auth/reset-password')}
                  className="text-sm"
                  disabled={isLoading}
                >
                  Forgot your password?
                </Button>
              </div>
            )}

            <div className="text-center">
              <Button 
                variant="link" 
                onClick={() => navigate('/auth/signup', { state: { invitationToken: token } })}
                className="text-sm"
                disabled={isLoading}
              >
                Don't have an account? Create one
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
