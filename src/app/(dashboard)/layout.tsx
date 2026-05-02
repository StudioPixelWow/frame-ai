import { ThemeProvider } from "@/lib/theme";
import { SideNav } from "@/components/side-nav";
import { ToastProvider } from "@/components/ui/toast";
import { AuthProvider } from "@/lib/auth/auth-context";
import { AICopilotContainer } from "@/components/ui/ai-copilot-drawer";
import { PageTransition } from "@/components/ui/page-transition";
import { DataErrorBoundary } from "@/components/ui/data-states";
import DashboardShell from "@/components/dashboard-shell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <div
            style={{
              display: "flex",
              minHeight: "100vh",
              backgroundColor: "var(--background)",
              color: "var(--foreground)",
              transition: "background-color 200ms, color 200ms",
            }}
            className="text-foreground transition-colors duration-200"
          >
            {/* SideNav — hidden on mobile */}
            <div className="dash-sidebar-wrap">
              <SideNav />
            </div>

            {/* Main content area */}
            <div className="dash-content-wrap" style={{ flex: 1, overflowY: "auto", minHeight: "100vh" }}>
              <DashboardShell>
                <DataErrorBoundary>
                  <PageTransition>
                    {children}
                  </PageTransition>
                </DataErrorBoundary>
              </DashboardShell>
            </div>
            <AICopilotContainer />
          </div>

          {/* Responsive layout rules */}
          <style>{`
            /* Desktop: show sidebar, offset content */
            .dash-sidebar-wrap { display: block; }
            .dash-content-wrap { margin-inline-start: 64px; }

            /* Mobile: hide sidebar, remove offset, add top padding for fixed mobile header */
            @media (max-width: 768px) {
              .dash-sidebar-wrap { display: none !important; }
              .dash-content-wrap {
                margin-inline-start: 0 !important;
                padding-top: 52px;
              }
            }
          `}</style>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
