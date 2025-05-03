
import { Button } from "./ui/button";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronRight, LayoutDashboard, FileText, BarChart2, Settings, LogOut, Shield } from "lucide-react";

export default function Navbar() {
  const { user, signOut, isAdmin } = useAuth();

  return (
    <nav className="flex flex-col h-full border-r bg-background">
      <div className="p-4 border-b">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          PaperlessMaverick
        </h2>
      </div>

      <div className="flex-1 overflow-auto py-2">
        <div className="px-3 py-2">
          <h3 className="mb-2 px-4 text-xs font-semibold text-foreground">Menu</h3>
          <div className="space-y-1">
            <NavLink 
              to="/dashboard"
              className={({isActive}) => `
                flex items-center gap-3 rounded-md px-4 py-2 text-sm font-medium transition-colors 
                ${isActive 
                  ? 'bg-primary text-primary-foreground' 
                  : 'hover:bg-accent text-muted-foreground hover:text-accent-foreground'}
              `}
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </NavLink>
            <NavLink 
              to="/analysis"
              className={({isActive}) => `
                flex items-center gap-3 rounded-md px-4 py-2 text-sm font-medium transition-colors 
                ${isActive 
                  ? 'bg-primary text-primary-foreground' 
                  : 'hover:bg-accent text-muted-foreground hover:text-accent-foreground'}
              `}
            >
              <BarChart2 className="h-4 w-4" />
              Analysis
            </NavLink>
            <NavLink 
              to="/settings"
              className={({isActive}) => `
                flex items-center gap-3 rounded-md px-4 py-2 text-sm font-medium transition-colors 
                ${isActive 
                  ? 'bg-primary text-primary-foreground' 
                  : 'hover:bg-accent text-muted-foreground hover:text-accent-foreground'}
              `}
            >
              <Settings className="h-4 w-4" />
              Settings
            </NavLink>
            
            {/* Admin Link - Only shown to admin users */}
            {isAdmin && (
              <NavLink 
                to="/admin"
                className={({isActive}) => `
                  flex items-center gap-3 rounded-md px-4 py-2 text-sm font-medium transition-colors 
                  ${isActive 
                    ? 'bg-primary text-primary-foreground' 
                    : 'hover:bg-accent text-muted-foreground hover:text-accent-foreground'}
                `}
              >
                <Shield className="h-4 w-4" />
                Admin Panel
              </NavLink>
            )}
          </div>
        </div>
      </div>

      <div className="mt-auto p-4 border-t">
        <div className="flex items-center gap-3 py-2">
          <div>
            <div className="font-medium">{user?.email}</div>
            <div className="text-xs text-muted-foreground">User ID: {user?.id?.substring(0, 8)}...</div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="ml-auto"
            onClick={() => signOut()}
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </nav>
  );
}
