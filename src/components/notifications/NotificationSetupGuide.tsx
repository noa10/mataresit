import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  Bell, 
  CheckCircle, 
  AlertTriangle, 
  Smartphone, 
  Mail,
  ArrowRight,
  X
} from 'lucide-react';
import { usePushNotificationContext, usePushNotificationStatus } from '@/contexts/PushNotificationContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { toast } from 'sonner';

interface NotificationSetupGuideProps {
  onComplete?: () => void;
  onDismiss?: () => void;
}

export function NotificationSetupGuide({ onComplete, onDismiss }: NotificationSetupGuideProps) {
  const pushContext = usePushNotificationContext();
  const pushStatus = usePushNotificationStatus();
  const { preferences } = useNotifications();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const steps = [
    {
      id: 1,
      title: 'Enable Browser Notifications',
      description: 'Allow Mataresit to send you push notifications',
      icon: <Smartphone className="h-5 w-5" />,
      completed: pushStatus.isEnabled,
      action: async () => {
        setIsLoading(true);
        try {
          const permission = await pushContext.requestPermission();
          if (permission === 'granted') {
            await pushContext.subscribe();
            toast.success('Push notifications enabled!');
            setCurrentStep(2);
          } else {
            toast.error('Permission denied. You can enable notifications in your browser settings.');
          }
        } catch (error) {
          toast.error('Failed to enable notifications');
        } finally {
          setIsLoading(false);
        }
      }
    },
    {
      id: 2,
      title: 'Test Notifications',
      description: 'Send a test notification to make sure everything works',
      icon: <Bell className="h-5 w-5" />,
      completed: false,
      action: async () => {
        setIsLoading(true);
        try {
          await pushContext.showTestNotification();
          toast.success('Test notification sent! Check if you received it.');
          setCurrentStep(3);
        } catch (error) {
          toast.error('Failed to send test notification');
        } finally {
          setIsLoading(false);
        }
      }
    },
    {
      id: 3,
      title: 'Configure Preferences',
      description: 'Choose which notifications you want to receive',
      icon: <Mail className="h-5 w-5" />,
      completed: preferences?.email_enabled || preferences?.push_enabled,
      action: () => {
        // This step is informational - preferences are configured in the main component
        setCurrentStep(4);
      }
    }
  ];

  const currentStepData = steps.find(step => step.id === currentStep);
  const completedSteps = steps.filter(step => step.completed).length;
  const isSetupComplete = completedSteps === steps.length || currentStep > steps.length;

  const handleComplete = () => {
    toast.success('Notification setup complete!');
    onComplete?.();
  };

  const handleDismiss = () => {
    onDismiss?.();
  };

  if (!pushStatus.isAvailable) {
    return (
      <Card className="border-ledger-amber/30 bg-ledger-amber-soft/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-ledger-amber-soft rounded-lg">
                <AlertTriangle className="h-5 w-5 text-ledger-amber" />
              </div>
              <div>
                <CardTitle className="text-ledger-ink">Notifications Not Available</CardTitle>
                <CardDescription className="text-ledger-ink-2">
                  Your browser doesn't support push notifications
                </CardDescription>
              </div>
            </div>
            {onDismiss && (
              <Button variant="ghost" size="sm" onClick={handleDismiss}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You can still receive email notifications. Configure your email preferences below.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (isSetupComplete) {
    return (
      <Card className="border-ledger-accent/30 bg-ledger-accent-soft/40">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-ledger-accent-soft rounded-lg">
                <CheckCircle className="h-5 w-5 text-ledger-accent" />
              </div>
              <div>
                <CardTitle className="text-ledger-ink">Setup Complete!</CardTitle>
                <CardDescription className="text-ledger-ink-2">
                  Your notifications are configured and ready to go
                </CardDescription>
              </div>
            </div>
            {onDismiss && (
              <Button variant="ghost" size="sm" onClick={handleDismiss}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-ledger-accent-soft text-ledger-accent">
                {completedSteps}/{steps.length} steps completed
              </Badge>
              <span className="text-sm text-ledger-ink-2">
                You'll now receive notifications for receipt processing and team activities
              </span>
            </div>
            <Button onClick={handleComplete} size="sm">
              Done
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-ledger-accent/30 bg-ledger-accent-soft/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-ledger-accent-soft rounded-lg">
              <Bell className="h-5 w-5 text-ledger-accent" />
            </div>
            <div>
              <CardTitle className="text-ledger-ink">Set Up Notifications</CardTitle>
              <CardDescription className="text-ledger-ink-2">
                Get notified about receipt processing and team activities
              </CardDescription>
            </div>
          </div>
          {onDismiss && (
            <Button variant="ghost" size="sm" onClick={handleDismiss}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress indicator */}
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            Step {currentStep} of {steps.length}
          </Badge>
          <div className="flex-1 bg-ledger-surface-2 rounded-full h-2">
            <div 
              className="bg-ledger-accent h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Current step */}
        {currentStepData && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-ledger-accent-soft rounded-lg">
                {currentStepData.icon}
              </div>
              <div>
                <h4 className="font-medium text-ledger-ink">{currentStepData.title}</h4>
                <p className="text-sm text-ledger-ink-2">{currentStepData.description}</p>
              </div>
            </div>

            {/* Step-specific content */}
            {currentStep === 1 && (
              <Alert>
                <Bell className="h-4 w-4" />
                <AlertDescription>
                  Click "Enable Notifications" and allow permissions when prompted by your browser.
                </AlertDescription>
              </Alert>
            )}

            {currentStep === 2 && (
              <Alert>
                <Smartphone className="h-4 w-4" />
                <AlertDescription>
                  We'll send a test notification to make sure everything is working correctly.
                </AlertDescription>
              </Alert>
            )}

            {currentStep === 3 && (
              <Alert>
                <Mail className="h-4 w-4" />
                <AlertDescription>
                  You can customize which notifications you receive in the preferences below.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button 
                onClick={currentStepData.action}
                disabled={isLoading || currentStepData.completed}
                className="flex items-center gap-2"
              >
                {isLoading ? (
                  'Processing...'
                ) : currentStepData.completed ? (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Completed
                  </>
                ) : (
                  <>
                    {currentStepData.title}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
              
              {currentStep > 1 && (
                <Button 
                  variant="outline" 
                  onClick={() => setCurrentStep(currentStep - 1)}
                  disabled={isLoading}
                >
                  Back
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
