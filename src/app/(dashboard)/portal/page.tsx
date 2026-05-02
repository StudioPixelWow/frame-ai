"use client";

export const dynamic = "force-dynamic";

import { useClients } from "@/lib/api/use-entity";
import { useRouter } from "next/navigation";

export default function PortalPage() {
  const { data: clients, loading } = useClients();
  const router = useRouter();

  const portalClients = clients.filter(c => c.portalEnabled && c.status === "active");
  const allActiveClients = clients.filter(c => c.status === "active");

  return (
    <div dir="rtl" style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "2rem", borderBottom: "1px solid var(--border)", paddingBottom: "1rem" }}>
        <div>
          <h1 className="mod-page-title">פורטל לקוח</h1>
          <p style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", marginTop: "0.25rem" }}>
            לקוחות עם גישת פורטל מופעלת — {portalClients.length} מתוך {allActiveClients.length} לקוחות פעילים
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--foreground-muted)" }}>טוען...</div>
      ) : portalClients.length === 0 ? (
        <div className="mod-empty ux-empty-state" style={{ minHeight: "300px" }}>
          <div className="mod-empty-icon ux-empty-state-icon">🌐</div>
          <div className="ux-empty-state-title" style={{ fontSize: "1rem", fontWeight: 500, marginBottom: "0.5rem" }}>
            אין לקוחות עם פורטל מופעל
          </div>
          <div className="ux-empty-state-text" style={{ fontSize: "0.875rem", color: "var(--foreground-muted)" }}>
            הפעל פורטל ללקוח דרך עמוד הלקוח הספציפי
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.25rem" }}>
          {portalClients.map(client => {
            const initials = client.name.split(" ").map(w => w[0]).join("").slice(0, 2);
            const color = client.color || "#00B5FE";
            return (
              <div
                key={client.id}
                className="agd-card premium-card"
                onClick={() => router.push(`/clients/${client.id}?tab=portal`)}
                style={{ padding: "1.5rem", cursor: "pointer", textAlign: "center" }}
              >
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: `${color}20`, border: `2px solid ${color}40`,
                  color, display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, fontSize: "1rem", margin: "0 auto 0.75rem",
                }}>
                  {initials}
                </div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.25rem" }}>{client.name}</div>
                {client.company && <div style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", marginBottom: "0.5rem" }}>{client.company}</div>}
                <span style={{
                  display: "inline-block", padding: "0.2rem 0.6rem", fontSize: "0.7rem",
                  fontWeight: 600, borderRadius: "999px", background: "#22c55e15", color: "#22c55e",
                  border: "1px solid #22c55e30",
                }}>
                  פורטל פעיל
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
