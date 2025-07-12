
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  User, Moon, Sun, LogOut, Settings, CreditCard, Users, Shield
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfileTranslation } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { AvatarUpload } from "@/components/profile/AvatarUpload";
import { ProfileInfoEditor } from "@/components/profile/ProfileInfoEditor";
import { SubscriptionInfo } from "@/components/profile/SubscriptionInfo";
import { TeamMemberships } from "@/components/profile/TeamMemberships";
import { AccountSettings } from "@/components/profile/AccountSettings";
import { getProfile, ProfileData } from "@/services/profileService";

export default function Profile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useProfileTranslation();
  const { isDarkMode, toggleMode } = useTheme();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch profile data on component mount
  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user?.id) return;

      try {
        const profileData = await getProfile(user.id);
        setProfile(profileData);
      } catch (error) {
        console.error("Error fetching profile:", error);
        toast({
          title: t('error.loadingProfile'),
          description: t('error.loadingDescription'),
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfileData();
  }, [user?.id, toast]);

  // Handle dark mode toggle
  const toggleDarkMode = async () => {
    const success = await toggleMode();

    if (success) {
      toast({
        title: !isDarkMode ? t('appearance.darkModeActivated') : t('appearance.lightModeActivated'),
        description: t('appearance.themeChanged', { mode: !isDarkMode ? 'dark' : 'light' }),
        duration: 2000,
      });
    } else {
      toast({
        title: t('appearance.themeChangeError'),
        description: t('appearance.themeChangeErrorDescription'),
        duration: 3000,
        variant: 'destructive',
      });
    }
  };

  // Handle sign out
  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
    toast({
      title: t('signOutSuccess.title'),
      description: t('signOutSuccess.description'),
      duration: 3000,
    });
  };

  // Handle profile updates
  const handleProfileUpdate = (updatedProfile: ProfileData) => {
    setProfile(updatedProfile);
  };

  // Handle avatar updates
  const handleAvatarUpdate = (avatarUrl: string | null) => {
    if (profile) {
      setProfile({
        ...profile,
        avatar_url: avatarUrl,
        avatar_updated_at: new Date().toISOString()
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
        <main className="container px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        </main>
      </div>
    );
  }

  if (!profile || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
        <main className="container px-4 py-8">
          <div className="text-center py-8">
            <p className="text-muted-foreground">{t('error.unableToLoad')}</p>
            <Button onClick={() => window.location.reload()} className="mt-4">
              {t('error.refreshPage')}
            </Button>
          </div>
        </main>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <main className="container px-4 py-8">
        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold">{t('title')}</h1>
            <p className="text-muted-foreground mt-1">
              {t('description')}
            </p>
          </div>

          <Button
            variant="destructive"
            onClick={handleSignOut}
            className="gap-2"
          >
            <LogOut size={16} />
            {t('signOut')}
          </Button>
        </motion.div>

        {/* Profile Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Avatar and Quick Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="lg:col-span-1"
          >
            <Card>
              <CardHeader className="flex flex-col items-center text-center pb-2">
                <AvatarUpload
                  profile={profile}
                  onAvatarUpdate={handleAvatarUpdate}
                  size="xl"
                />
                <div className="mt-4">
                  <CardTitle className="text-xl">
                    {profile.first_name && profile.last_name
                      ? `${profile.first_name} ${profile.last_name}`
                      : profile.email?.split('@')[0] || 'User'
                    }
                  </CardTitle>
                  <p className="text-muted-foreground text-sm mt-1">
                    {profile.email}
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('info.plan')}</span>
                    <span className="font-medium capitalize">
                      {profile.subscription_tier || t('info.free')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('info.memberSince')}</span>
                    <span className="font-medium">
                      {new Date(profile.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Main Content Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="lg:col-span-2"
          >
            <Tabs defaultValue="profile" className="space-y-6">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="profile" className="gap-1">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('tabs.profile')}</span>
                </TabsTrigger>
                <TabsTrigger value="subscription" className="gap-1">
                  <CreditCard className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('tabs.billing')}</span>
                </TabsTrigger>
                <TabsTrigger value="teams" className="gap-1">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('tabs.teams')}</span>
                </TabsTrigger>
                <TabsTrigger value="preferences" className="gap-1">
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('tabs.settings')}</span>
                </TabsTrigger>
                <TabsTrigger value="security" className="gap-1">
                  <Shield className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('tabs.security')}</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="space-y-6">
                <ProfileInfoEditor
                  profile={profile}
                  onProfileUpdate={handleProfileUpdate}
                />
              </TabsContent>

              <TabsContent value="subscription" className="space-y-6">
                <SubscriptionInfo userId={profile.id} />
              </TabsContent>

              <TabsContent value="teams" className="space-y-6">
                <TeamMemberships userId={profile.id} />
              </TabsContent>

              <TabsContent value="preferences" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('appearance.title')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center">
                          {isDarkMode ? (
                            <Moon className="mr-2" size={18} />
                          ) : (
                            <Sun className="mr-2" size={18} />
                          )}
                          <Label htmlFor="dark-mode">{t('appearance.darkMode')}</Label>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {t('appearance.darkModeDescription')}
                        </p>
                      </div>
                      <Switch
                        id="dark-mode"
                        checked={isDarkMode}
                        onCheckedChange={toggleDarkMode}
                      />
                    </div>
                    <Separator />
                    {/* Additional preferences can be added here */}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="security" className="space-y-6">
                <AccountSettings userId={profile.id} />
              </TabsContent>
            </Tabs>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
