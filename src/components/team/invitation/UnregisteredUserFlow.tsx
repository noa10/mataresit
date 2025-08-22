/**
 * Unregistered User Flow Component
 * Handles invitation acceptance for users who don't have an account yet
 * Provides guided signup with invitation context preservation
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
  UserPlus,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import {
  TeamInvitation,
  UserType,
} from '@/types/team';
import { UserStateDetectionResult } from '@/services/invitationFlowService';
import { InvitationPreview, getInvitationCTA } from './InvitationPreview';

interface UnregisteredUserFlowProps {
  invitation: TeamInvitation;
  userState: UserStateDetectionResult;
  token: string;
  sessionId?: string;
  onSuccess: (teamId: string, teamName: string, redirectUrl?: string) => void;
  onError: (error: string, errorCode?: string) => void;
}

interface SignupFormData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
}

export function UnregisteredUserFlow({
  invitation,
  userState,
  token,
  sessionId,
  onSuccess,
  onError,
}: UnregisteredUserFlowProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState<'preview' | 'signup' | 'processing'>('preview');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState<SignupFormData>({
    email: invitation.email,
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
  });

  const [formErrors, setFormErrors] = useState<Partial<SignupFormData>>({});

  // Validate form data
  const validateForm = (): boolean => {
    const errors: Partial<SignupFormData> = {};

    if (!formData.firstName.trim()) {
      errors.firstName = 'First name is required';
    }

    if (!formData.lastName.trim()) {
      errors.lastName = 'Last name is required';
    }

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    } else if (formData.email !== invitation.email) {
      errors.email = 'Email must match the invitation email';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form input changes
  const handleInputChange = (field: keyof SignupFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error for this field when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // Handle signup process
  const handleSignup = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setCurrentStep('processing');

    try {
      // Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            invitation_token: token,
          },
        },
      });

      if (authError) {
        throw authError;
      }

      if (!authData.user) {
        throw new Error('Failed to create user account');
      }

      // Check if email confirmation is required
      if (!authData.session) {
        toast({
          title: 'Check Your Email',
          description: 'We\'ve sent you a confirmation link. Please check your email and click the link to complete your account setup.',
          duration: 10000,
        });

        // Store invitation context for post-confirmation processing
        localStorage.setItem('pending_invitation', JSON.stringify({
          token,
          teamId: invitation.team_id,
          teamName: invitation.team_name,
          sessionId,
        }));

        // Redirect to a confirmation waiting page
        navigate('/auth/confirm-email', { 
          state: { 
            email: formData.email,
            invitationToken: token,
            teamName: invitation.team_name,
          }
        });
        return;
      }

      // If we have a session, the user is automatically confirmed
      // Process the invitation acceptance
      await processInvitationAcceptance(authData.user.id);

    } catch (error: any) {
      console.error('Signup error:', error);
      setCurrentStep('signup');
      
      let errorMessage = 'Failed to create account';
      if (error.message?.includes('already registered')) {
        errorMessage = 'An account with this email already exists. Please sign in instead.';
      } else if (error.message?.includes('invalid email')) {
        errorMessage = 'Please enter a valid email address';
      } else if (error.message?.includes('weak password')) {
        errorMessage = 'Password is too weak. Please choose a stronger password.';
      }
      
      onError(errorMessage, 'SIGNUP_FAILED');
    } finally {
      setIsLoading(false);
    }
  };

  // Process invitation acceptance after successful signup
  const processInvitationAcceptance = async (userId: string) => {
    try {
      // The invitation will be automatically processed by the auth callback
      // or we can process it here directly
      onSuccess(invitation.team_id, invitation.team_name, `/teams/${invitation.team_id}`);
    } catch (error: any) {
      console.error('Error processing invitation:', error);
      onError('Account created successfully, but failed to join team. Please try accepting the invitation again.', 'INVITATION_PROCESSING_FAILED');
    }
  };

  // Render preview step
  if (currentStep === 'preview') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-6">
          <InvitationPreview
            invitation={invitation}
            userType="unregistered"
          />
          
          <Card>
            <CardHeader className="text-center">
              <UserPlus className="h-8 w-8 mx-auto text-primary mb-2" />
              <CardTitle>Create Your Account</CardTitle>
              <CardDescription>
                You'll need to create an account to join {invitation.team_name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={() => setCurrentStep('signup')}
                className="w-full"
                size="lg"
              >
                {getInvitationCTA('unregistered')}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              
              <div className="text-center">
                <Button 
                  variant="link" 
                  onClick={() => navigate('/auth')}
                  className="text-sm"
                >
                  Already have an account? Sign in
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
              <h3 className="text-lg font-semibold">Creating Your Account</h3>
              <p className="text-muted-foreground">
                Please wait while we set up your account and add you to the team...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render signup form step
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
            <CardTitle className="text-center">Create Your Account</CardTitle>
            <CardDescription className="text-center">
              Join {invitation.team_name} as a {invitation.role}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  placeholder="Enter your first name"
                  disabled={isLoading}
                />
                {formErrors.firstName && (
                  <p className="text-sm text-destructive">{formErrors.firstName}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  placeholder="Enter your last name"
                  disabled={isLoading}
                />
                {formErrors.lastName && (
                  <p className="text-sm text-destructive">{formErrors.lastName}</p>
                )}
              </div>
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
                  disabled={true} // Email should match invitation
                />
              </div>
              {formErrors.email && (
                <p className="text-sm text-destructive">{formErrors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  placeholder="Create a password"
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

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  placeholder="Confirm your password"
                  className="pl-10 pr-10"
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isLoading}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {formErrors.confirmPassword && (
                <p className="text-sm text-destructive">{formErrors.confirmPassword}</p>
              )}
            </div>

            <Button 
              onClick={handleSignup}
              disabled={isLoading}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Creating Account...
                </>
              ) : (
                <>
                  Create Account & Join Team
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>

            <div className="text-center">
              <Button 
                variant="link" 
                onClick={() => navigate('/auth')}
                className="text-sm"
                disabled={isLoading}
              >
                Already have an account? Sign in
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
