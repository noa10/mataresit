
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarFooter, SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useLocation } from "react-router-dom";
import { BarChart3, FileText, Home, Settings, Shield, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
                <Link 
                  to="/admin"
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-secondary/50 transition-colors",
                    isActivePath('/admin') && location.pathname === '/admin' ? "bg-secondary/70" : ""
                  )}
                  title="Dashboard"
                >
                  <Home className="h-4 w-4" />
                  <span>Dashboard</span>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Link 
                  to="/admin/users"
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-secondary/50 transition-colors",
                    isActivePath('/admin/users') ? "bg-secondary/70" : ""
                  )}
                  title="Users"
                >
                  <Users className="h-4 w-4" />
                  <span>Users</span>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Link 
                  to="/admin/receipts"
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-secondary/50 transition-colors",
                    isActivePath('/admin/receipts') ? "bg-secondary/70" : ""
                  )}
                  title="Receipts"
                >
                  <FileText className="h-4 w-4" />
                  <span>Receipts</span>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Link 
                  to="/admin/analytics"
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-secondary/50 transition-colors",
                    isActivePath('/admin/analytics') ? "bg-secondary/70" : ""
                  )}
                  title="Analytics"
                >
                  <BarChart3 className="h-4 w-4" />
                  <span>Analytics</span>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Link 
                  to="/admin/settings"
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-secondary/50 transition-colors",
                    isActivePath('/admin/settings') ? "bg-secondary/70" : ""
                  )}
                  title="Settings"
                >
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </Link>
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
