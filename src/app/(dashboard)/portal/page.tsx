"use client";

export default function PortalPage() {
  const clients = [
    {
      id: 1,
      name: "Studio Pixel",
      projects: 12,
      status: "פעיל",
    },
    {
      id: 2,
      name: "Brandify",
      projects: 8,
      status: "פעיל",
    },
    {
      id: 3,
      name: "TechBolt",
      projects: 5,
      status: "פעיל",
    },
    {
      id: 4,
      name: "GreenLeaf",
      projects: 3,
      status: "פעיל",
    },
  ];

  const getAvatarColor = (index: number): string => {
    const colors = [
      "#00B5FE", // cyan/blue (Studio Pixel)
      "#a78bfa", // purple (Brandify)
      "#34d399", // green (TechBolt)
      "#fbbf24", // amber (GreenLeaf)
    ];
    return colors[index % colors.length];
  };

  const getInitial = (name: string): string => {
    return name.charAt(0).toUpperCase();
  };

  return (
    <main className="max-w-[1200px] mx-auto px-6 py-8">
      <div className="space-y-6 cpt-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[1.35rem] font-bold tracking-tight">
              פורטל לקוח
            </h1>
            <p className="text-foreground-muted text-[0.92rem] mt-1">
              צפה בכל הלקוחות שלך והנהל את הפרויקטים שלהם
            </p>
          </div>
        </div>

        {/* Client Grid */}
        <div className="cpt-client-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {clients.map((client, index) => (
            <div
              key={client.id}
              className="cpt-client-card rounded-xl border border-border bg-surface p-5 cursor-pointer transition-all hover:border-accent hover:shadow-lg hover:shadow-accent/20"
            >
              {/* Avatar */}
              <div className="flex items-center justify-center mb-4">
                <div
                  className="cpt-client-avatar w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl"
                  style={{ backgroundColor: getAvatarColor(index) }}
                >
                  {getInitial(client.name)}
                </div>
              </div>

              {/* Client Name */}
              <h2 className="cpt-client-name text-center text-[1.05rem] font-bold text-foreground mb-3">
                {client.name}
              </h2>

              {/* Client Meta */}
              <div className="cpt-client-meta space-y-2 text-center mb-4">
                <p className="text-foreground-muted text-[0.9rem]">
                  {client.projects} פרויקטים
                </p>
              </div>

              {/* Status Badge */}
              <div className="flex justify-center">
                <span className="cpt-client-status badge-accent text-[0.75rem]">
                  {client.status}
                </span>
              </div>

              {/* Action Button */}
              <button className="w-full mt-4 btn-ghost text-[0.85rem]">
                פתח פורטל
              </button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
