
import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { 
  User, LogOut, ChevronRight, 
  Mail, Edit, Camera
} from "lucide-react";
import { NavbarWrapper } from "@/components/NavbarWrapper";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";

export default function Profile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user) return "U";
    return user.email?.charAt(0).toUpperCase() || "U";
  };
  
  // Format email to show only first part
  const formatEmail = (email: string | null | undefined) => {
    if (!email) return "";
    const [username, domain] = email.split('@');
    return `${username}@${domain}`;
  };
  
  // Handle sign out
  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
    toast({
      title: "Signed out successfully",
      description: "You have been signed out of your account.",
      duration: 3000,
    });
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <NavbarWrapper />
      
      <main className="container px-4 py-8">
        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold">Profile</h1>
            <p className="text-muted-foreground mt-1">
              Manage your account settings
            </p>
          </div>
          
          <Button
            variant="destructive"
            onClick={handleSignOut}
            className="gap-2"
          >
            <LogOut size={16} />
            Sign Out
          </Button>
        </motion.div>
        
        {/* Profile Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* User Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="lg:col-span-1"
          >
            <Card>
              <CardHeader className="flex flex-col items-center text-center pb-2">
                <div className="relative mb-4 group">
                  <Avatar className="h-24 w-24">
                    <AvatarFallback className="text-4xl bg-primary text-primary-foreground">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <Camera className="text-white" size={20} />
                  </div>
                </div>
                <CardTitle className="text-xl">{user?.email ? user.email.split('@')[0] : 'User'}</CardTitle>
                <div className="flex items-center text-muted-foreground mt-1 text-sm">
                  <Mail size={14} className="mr-1" />
                  {formatEmail(user?.email)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="mt-2">
                  <Separator className="my-4" />
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <User size={16} className="mr-2 text-muted-foreground" />
                        <span className="text-sm">Account</span>
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground" />
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <Edit size={16} className="mr-2 text-muted-foreground" />
                        <span className="text-sm">Edit Profile</span>
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          
          {/* Settings Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="lg:col-span-2"
          >
            <Tabs defaultValue="security">
              <TabsList className="mb-4 w-full bg-background/50">
                <TabsTrigger value="security" className="flex-1">Security</TabsTrigger>
                <TabsTrigger value="notifications" className="flex-1">Notifications</TabsTrigger>
              </TabsList>
              
              <TabsContent value="security">
                <Card>
                  <CardHeader>
                    <CardTitle>Security Settings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">Manage your security settings here.</p>
                    <div className="mt-6 space-y-4">
                      <Button variant="outline" className="w-full justify-start">
                        Change Password
                      </Button>
                      <Button variant="outline" className="w-full justify-start">
                        Two-Factor Authentication
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="notifications">
                <Card>
                  <CardHeader>
                    <CardTitle>Notification Settings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">Manage how you receive notifications.</p>
                    <div className="mt-6 space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="email-notifs">Email Notifications</Label>
                          <p className="text-sm text-muted-foreground">Receive updates via email</p>
                        </div>
                        <Switch id="email-notifs" defaultChecked />
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="receipt-notifs">Receipt Processing</Label>
                          <p className="text-sm text-muted-foreground">Get notified when receipts are processed</p>
                        </div>
                        <Switch id="receipt-notifs" defaultChecked />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
