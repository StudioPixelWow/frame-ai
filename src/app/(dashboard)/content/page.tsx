export const dynamic = "force-dynamic";

export default function ContentPage() {
  return (
    <main className="max-w-[1100px] mx-auto px-6 py-8"><div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[1.35rem] font-bold tracking-tight">תוכן</h1>
          <p className="text-foreground-muted text-[0.92rem] mt-1">
            רנדרים של וידאו, עריכות AI וספריית תוכן.
          </p>
        </div>
        <button className="btn-primary">רנדר חדש</button>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-surface aspect-video flex items-center justify-center text-foreground-subtle text-sm hover:border-border-muted hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
          אין תוכן עדיין
        </div>
      </div>
    </div></main>
  );
}
