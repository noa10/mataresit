import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import { MainNavigationSidebar } from "./MainNavigationSidebar";
import { MainNavigationToggle } from "./MainNavigationToggle";
import { useChatControls } from "@/contexts/ChatControlsContext";
import { AppSidebarProvider, useAppSidebar } from "@/contexts/AppSidebarContext";
import { RouteAwareSidebarManager } from "./sidebar/RouteAwareSidebarManager";
import { GlobalBackgroundSearchStatus } from "./search/BackgroundSearchIndicator";

// AppLayout content component that uses the sidebar context
function AppLayoutContent() {
  const { isSidebarOpen, toggleSidebar, sidebarContent, sidebarContentType, isDesktop } = useAppSidebar();
  const { chatControls } = useChatControls();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Route-aware sidebar manager for automatic content switching */}
      <RouteAwareSidebarManager />

      {/* Dynamic Sidebar - only render on desktop screens (>= lg breakpoint) */}
      {isDesktop && (
        <div className="flex-shrink-0">
          {sidebarContent ? (
            // Render custom sidebar content from context (e.g., ConversationSidebar)
            sidebarContent
          ) : (
            // Render default main navigation sidebar
            <MainNavigationSidebar
              isOpen={isSidebarOpen}
              onToggle={toggleSidebar}
            />
          )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar
          navControls={{
            navSidebarToggle: (
              <MainNavigationToggle
                isOpen={isSidebarOpen}
                onToggle={toggleSidebar}
              />
            )
          }}
          chatControls={chatControls}
        />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>

      {/* Global background search status indicator */}
      <GlobalBackgroundSearchStatus />
    </div>
  );
}

// Main AppLayout component with provider wrapper
export function AppLayout() {
  return (
    <AppSidebarProvider>
      <AppLayoutContent />
    </AppSidebarProvider>
  );
}
