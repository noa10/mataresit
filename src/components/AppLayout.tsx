import { Outlet } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AppHeader } from "./workspace/AppHeader";
import { WorkspaceSidebar } from "./workspace/WorkspaceSidebar";
import { WorkspaceTabs } from "./workspace/WorkspaceTabs";
import { GlobalBackgroundSearchStatus } from "./search/BackgroundSearchIndicator";
import { BatchUploadModal } from "./modals/BatchUploadModal";
import { BackgroundUploadIndicator } from "./upload/BackgroundUploadIndicator";
import { BulkReprocessProgressPanel } from "./dashboard/BulkReprocessProgressPanel";

/**
 * Authenticated workspace shell: fixed ledger sidebar, slim header and a
 * single scrolling content column. Pages own their width and padding so the
 * receipt viewer and other full-bleed routes can opt out of the 1180px shell.
 */
export function AppLayout() {
  return (
    <div className="min-h-screen bg-ledger-paper min-[980px]:grid min-[980px]:grid-cols-[252px_minmax(0,1fr)]">
      <WorkspaceSidebar />

      <div className="flex min-h-screen min-w-0 flex-col">
        <div className="sticky top-0 z-30">
          <AppHeader />
          <WorkspaceTabs />
        </div>
        <main className="flex-1 overflow-x-hidden bg-ledger-paper">
          <Outlet />
        </main>
      </div>

      <GlobalBackgroundSearchStatus />
      <WorkspaceUploadModal />
      <BackgroundUploadIndicator />
      <BulkReprocessProgressPanel />
    </div>
  );
}

/**
 * The upload modal lives here (not per page) because BackgroundUploadContext
 * owns its open state — every page's "Upload" button just calls openModal().
 * The old Dashboard mounted this itself; the workspace shell mounts it once
 * for all pages.
 */
function WorkspaceUploadModal() {
  const queryClient = useQueryClient();

  return (
    <BatchUploadModal
      onUploadComplete={() => {
        void queryClient.invalidateQueries({ queryKey: ["receipts"] });
        void queryClient.invalidateQueries({ queryKey: ["receipt-counts"] });
        void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      }}
    />
  );
}
