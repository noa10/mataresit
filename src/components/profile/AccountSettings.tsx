import { useState } from "react";
import { 
  Key, 
  LogOut, 
  Trash2, 
  Shield, 
  AlertTriangle,
  ExternalLink,
  Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useProfileTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { ChangePasswordDialog } from "@/components/modals/ChangePasswordDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { requestAccountDeletion } from "@/services/profileService";

interface AccountSettingsProps {
  userId: string;
}

export function AccountSettings({ userId }: AccountSettingsProps) {
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useProfileTranslation();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/auth');
      toast({
        title: t("settings.notifications.signOutSuccess"),
        description: t("settings.notifications.signOutSuccessDescription"),
      });
    } catch (error) {
      console.error("Sign out error:", error);
      toast({
        title: t("settings.notifications.signOutFailed"),
        description: t("settings.notifications.signOutFailedDescription"),
        variant: "destructive",
      });
    }
  };

  const handleAccountDeletion = async () => {
    setIsDeletingAccount(true);
    
    try {
      const result = await requestAccountDeletion(userId);
      
      if (result.success) {
        toast({
          title: t("account.deletionRequested"),
          description: t("account.deletionRequestedDescription"),
        });
        // For now, we'll sign out the user
        await signOut();
        navigate('/auth');
      } else {
        toast({
          title: t("account.deletionFailed"),
          description: result.error || t("account.deletionFailedDescription"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Account deletion error:", error);
      toast({
        title: t("account.deletionFailed"),
        description: t("account.deletionUnexpected"),
        variant: "destructive",
      });
    } finally {
      setIsDeletingAccount(false);
    }
  };

  // Check if user signed up with Google OAuth (no password)
  const isGoogleUser = user?.app_metadata?.provider === 'google';

  return (
    <div className="space-y-6">
      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t("settings.security.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isGoogleUser && (
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">{t("settings.security.password.title")}</h4>
                <p className="text-sm text-muted-foreground">
                  {t("settings.security.password.description")}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setIsChangePasswordOpen(true)}
                className="gap-2"
              >
                <Key className="h-4 w-4" />
                {t("settings.security.password.changeButton")}
              </Button>
            </div>
          )}

          {isGoogleUser && (
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">{t("account.googleAccount")}</h4>
                <p className="text-sm text-muted-foreground">
                  {t("account.googleAccountDescription")}
                </p>
              </div>
              <Button
                variant="outline"
                asChild
                className="gap-2"
              >
                <a 
                  href="https://myaccount.google.com/security" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                  {t("account.googleSecurity")}
                </a>
              </Button>
            </div>
          )}

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">{t("account.activeSessions")}</h4>
              <p className="text-sm text-muted-foreground">
                {t("account.activeSessionsDescription")}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleSignOut}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              {t("account.signOutEverywhere")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {t("account.dangerZone")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-destructive">{t("account.deleteAccount")}</h4>
              <p className="text-sm text-muted-foreground">
                {t("account.deleteAccountDescription")}
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  className="gap-2"
                  disabled={isDeletingAccount}
                >
                  {isDeletingAccount ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  {isDeletingAccount ? t("account.processing") : t("account.deleteAccount")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("account.confirmTitle")}</AlertDialogTitle>
                  <AlertDialogDescription className="space-y-2">
                    <p>{t("account.confirmDescription")}</p>
                    <p className="font-medium">{t("account.confirmIncludes")}</p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      <li>{t("account.includeReceipts")}</li>
                      <li>{t("account.includeHistory")}</li>
                      <li>{t("account.includeTeams")}</li>
                      <li>{t("account.includeSettings")}</li>
                      <li>{t("account.includeBilling")}</li>
                    </ul>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("account.cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleAccountDeletion}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={isDeletingAccount}
                  >
                    {isDeletingAccount ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        {t("account.deleting")}
                      </>
                    ) : (
                      t("account.confirmDeleteAction")
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* Change Password Dialog */}
      <ChangePasswordDialog
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </div>
  );
}
