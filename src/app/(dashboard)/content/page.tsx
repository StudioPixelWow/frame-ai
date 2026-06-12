export const dynamic = "force-dynamic";

import { PageHeader } from '@/components/ui/saas-kit';

export default function ContentPage() {
  return (
    <main className="max-w-[1100px] mx-auto px-6 py-8"><div className="space-y-6">
      <PageHeader
        title="תוכן"
        subtitle="רנדרים של וידאו, עריכות AI וספריית תוכן."
        primaryAction={{ label: "רנדר חדש", onClick: () => {} }}
      />

      {/* Content grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-surface aspect-video flex items-center justify-center text-foreground-subtle text-sm hover:border-border-muted hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
          אין תוכן עדיין
        </div>
      </div>
    </div></main>
  );
}
