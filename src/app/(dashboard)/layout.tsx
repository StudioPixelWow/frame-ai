import { ThemeProvider } from "@/lib/theme";
import { TopNav } from "@/components/top-nav";
import { ToastProvider } from "@/components/ui/toast";
import { AuthProvider } from "@/lib/auth/auth-context";
import { FloatingAI } from "@/components/ui/floating-ai";
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
          <div className="min-h-screen bg-background text-foreground transition-colors duration-200 ux-neon-glow">
            <TopNav />
            <PageTransition>
              {children}
            </PageTransition>
            <FloatingAI />
          </div>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
