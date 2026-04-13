import { ThemeProvider } from "@/lib/theme";
import { TopNav } from "@/components/top-nav";
import { ToastProvider } from "@/components/ui/toast";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
          <TopNav />
          {children}
        </div>
      </ToastProvider>
    </ThemeProvider>
  );
}
