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
import { useSettingsTranslation } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

interface NotificationSetupGuideProps {
  onComplete?: () => void;
  onDismiss?: () => void;
}

export function NotificationSetupGuide({ onComplete, onDismiss }: NotificationSetupGuideProps) {
  const { t } = useSettingsTranslation();
  const pushContext = usePushNotificationContext();
  const pushStatus = usePushNotificationStatus();
  const { preferences } = useNotifications();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const steps = [
    {
      id: 1,
      title: t('notificationSetup.steps.enableTitle'),
      description: t('notificationSetup.steps.enableDescription'),
      icon: <Smartphone className="h-5 w-5" />,
      completed: pushStatus.isEnabled,
      action: async () => {
        setIsLoading(true);
        try {
          const permission = await pushContext.requestPermission();
          if (permission === 'granted') {
            await pushContext.subscribe();
            toast.success(t('notificationSetup.toasts.enabled'));
            setCurrentStep(2);
          } else {
            toast.error(t('notificationSetup.toasts.permissionDenied'));
          }
        } catch (error) {
          toast.error(t('notificationSetup.toasts.enableFailed'));
        } finally {
          setIsLoading(false);
        }
      }
    },
    {
      id: 2,
      title: t('notificationSetup.steps.testTitle'),
      description: t('notificationSetup.steps.testDescription'),
      icon: <Bell className="h-5 w-5" />,
      completed: false,
      action: async () => {
        setIsLoading(true);
        try {
          await pushContext.showTestNotification();
          toast.success(t('notificationSetup.toasts.testSent'));
          setCurrentStep(3);
        } catch (error) {
          toast.error(t('notificationSetup.toasts.testFailed'));
        } finally {
          setIsLoading(false);
        }
      }
    },
    {
      id: 3,
      title: t('notificationSetup.steps.preferencesTitle'),
      description: t('notificationSetup.steps.preferencesDescription'),
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
    toast.success(t('notificationSetup.toasts.complete'));
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
                <CardTitle className="text-ledger-ink">{t('notificationSetup.unavailableTitle')}</CardTitle>
                <CardDescription className="text-ledger-ink-2">
                  {t('notificationSetup.unavailableDescription')}
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
              {t('notificationSetup.emailFallback')}
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
                <CardTitle className="text-ledger-ink">{t('notificationSetup.completeTitle')}</CardTitle>
                <CardDescription className="text-ledger-ink-2">
                  {t('notificationSetup.completeDescription')}
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
                {t('notificationSetup.stepsCompleted', { completed: completedSteps, total: steps.length })}
              </Badge>
              <span className="text-sm text-ledger-ink-2">
                {t('notificationSetup.completeFooter')}
              </span>
            </div>
            <Button onClick={handleComplete} size="sm">
              {t('notificationSetup.done')}
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
              <CardTitle className="text-ledger-ink">{t('notificationSetup.title')}</CardTitle>
              <CardDescription className="text-ledger-ink-2">
                {t('notificationSetup.description')}
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
            {t('notificationSetup.stepProgress', { current: currentStep, total: steps.length })}
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
                  {t('notificationSetup.info.enable')}
                </AlertDescription>
              </Alert>
            )}

            {currentStep === 2 && (
              <Alert>
                <Smartphone className="h-4 w-4" />
                <AlertDescription>
                  {t('notificationSetup.info.test')}
                </AlertDescription>
              </Alert>
            )}

            {currentStep === 3 && (
              <Alert>
                <Mail className="h-4 w-4" />
                <AlertDescription>
                  {t('notificationSetup.info.preferences')}
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
                  t('notificationSetup.processing')
                ) : currentStepData.completed ? (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    {t('notificationSetup.completed')}
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
                  {t('notificationSetup.back')}
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
