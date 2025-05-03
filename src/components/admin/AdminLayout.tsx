
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarFooter, SidebarSeparator, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useLocation } from "react-router-dom";
import { BarChart3, FileText, Home, Settings, Shield, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { signOut, user } = useAuth();
  const location = useLocation();

  // Check if the current route matches the given path
  const isActivePath = (path: string) => {
    return location.pathname === path || 
           (path !== '/admin' && location.pathname.startsWith(path));
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar>
          <SidebarHeader className="p-4">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Admin Panel</h1>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  as={Link}
                  to="/admin"
                  isActive={isActivePath('/admin') && location.pathname === '/admin'}
                  tooltip="Dashboard"
                >
                  <Home className="h-4 w-4" />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  as={Link}
                  to="/admin/users"
                  isActive={isActivePath('/admin/users')}
                  tooltip="Users"
                >
                  <Users className="h-4 w-4" />
                  <span>Users</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  as={Link}
                  to="/admin/receipts"
                  isActive={isActivePath('/admin/receipts')}
                  tooltip="Receipts"
                >
                  <FileText className="h-4 w-4" />
                  <span>Receipts</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  as={Link}
                  to="/admin/analytics"
                  isActive={isActivePath('/admin/analytics')}
                  tooltip="Analytics"
                >
                  <BarChart3 className="h-4 w-4" />
                  <span>Analytics</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  as={Link}
                  to="/admin/settings"
                  isActive={isActivePath('/admin/settings')}
                  tooltip="Settings"
                >
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="p-4">
            <div className="flex flex-col gap-2">
              {user && (
                <div className="text-sm text-muted-foreground">
                  Signed in as {user.email}
                </div>
              )}
              <Button variant="outline" size="sm" onClick={() => signOut()}>
                Sign Out
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/dashboard">Exit Admin</Link>
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>
        <main className="flex-1 overflow-auto p-6 bg-background">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
