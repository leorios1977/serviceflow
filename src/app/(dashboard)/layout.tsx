import { OrgProvider } from "@/lib/org-context";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OrgProvider>
      <div className="flex h-screen overflow-hidden">
        {/* Desktop Sidebar */}
        <AppSidebar />

        {/* Main content area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top bar */}
          <AppTopbar />

          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6">
            {children}
          </main>

          {/* Mobile bottom nav */}
          <MobileBottomNav />
        </div>
      </div>
    </OrgProvider>
  );
}
