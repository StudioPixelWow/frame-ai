import { ThemeProvider } from "@/lib/theme";
import { SideNav } from "@/components/side-nav";
import { ToastProvider } from "@/components/ui/toast";
import { AuthProvider } from "@/lib/auth/auth-context";
import { AICopilotContainer } from "@/components/ui/ai-copilot-drawer";
import { PageTransition } from "@/components/ui/page-transition";

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
            <SideNav />
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                minHeight: "100vh",
                marginInlineStart: "64px",
              }}
            >
              <PageTransition>
                {children}
              </PageTransition>
            </div>
            <AICopilotContainer />
          </div>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
