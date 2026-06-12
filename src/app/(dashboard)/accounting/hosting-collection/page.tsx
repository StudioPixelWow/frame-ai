"use client";

export const dynamic = "force-dynamic";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useClients, useHostingRecords } from "@/lib/api/use-entity";
import { AdminOnly } from "@/components/role-gate";
import { useToast } from "@/components/ui/toast";
import { openWhatsApp, hostingCollectionMessage } from "@/lib/utils/whatsapp";
import { PageHeader } from "@/components/ui/saas-kit";

function AccessDenied() {
  return (
    <div dir="rtl" style={{ maxWidth: 600, margin: "4rem auto", textAlign: "center", padding: "2rem" }}>
      <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔒</div>
      <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>אין גישה</h2>
      <p style={{ fontSize: "0.875rem", color: "var(--foreground-muted)" }}>עמוד זה זמין למנהלים בלבד</p>
    </div>
  );
}

interface HostingRow {
  clientId: string;
  name: string;
  phone: string;
  domain: string;
  amount: number;
  paid: boolean;
  nextPaymentDate: string | null;
}

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

// Paid (green) when the next annual payment date is in the future.
const isPaid = (annualPaymentDate: string | null | undefined): boolean => {
  if (!annualPaymentDate) return false;
  const t = new Date(annualPaymentDate).getTime();
  if (Number.isNaN(t)) return false;
  return t > Date.now();
};

export default function HostingCollectionPage() {
  return (
    <AdminOnly fallback={<AccessDenied />}>
      <HostingCollectionInner />
    </AdminOnly>
  );
}

function HostingCollectionInner() {
  const router = useRouter();
  const toast = useToast();
  const { data: rawClients, update: updateClient } = useClients();
  const { data: rawHosting } = useHostingRecords();
  const clients = rawClients ?? [];
  const hosting = rawHosting ?? [];
  const [busy, setBusy] = useState<string>("");

  const rows: HostingRow[] = useMemo(() => {
    // Enrich amount/domain from any hosting record (read-only).
    const recByClient = new Map<string, any>();
    hosting.forEach((r: any) => { if (r.clientId) recByClient.set(r.clientId, r); });

    return clients
      .filter((c: any) => c.clientType === "hosting" && c.status !== "inactive")
      .map((c: any) => {
        const rec = recByClient.get(c.id);
        return {
          clientId: c.id,
          name: c.name || "לא ידוע",
          phone: c.phone || "",
          domain: (rec?.domainName as string) || c.websiteUrl || "",
          amount: (rec?.yearlyPaymentAmount as number) || c.retainerAmount || 0,
          paid: isPaid(c.annualPaymentDate),
          nextPaymentDate: c.annualPaymentDate || null,
        };
      })
      .sort((a, b) => Number(a.paid) - Number(b.paid) || a.name.localeCompare(b.name, "he"));
  }, [clients, hosting]);

  const paidCount = rows.filter((r) => r.paid).length;
  const unpaidCount = rows.length - paidCount;
  const unpaidAmount = rows.filter((r) => !r.paid).reduce((s, r) => s + r.amount, 0);

  const handleSettled = async (row: HostingRow) => {
    setBusy(row.clientId);
    const now = new Date();
    // Next annual payment = one year ahead (YYYY-MM-DD).
    const next = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    const nextStr = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
    try {
      const res = await updateClient(row.clientId, { annualPaymentDate: nextStr } as any);
      if (!res) throw new Error("update failed");
      toast(`התשלום של ${row.name} סומן כשולם — חיוב הבא ${fmtDate(nextStr)}`, "success");
    } catch {
      toast("שמירת התשלום נכשלה", "error");
    } finally {
      setBusy("");
    }
  };

  const handleWhatsApp = (row: HostingRow) => {
    const ok = openWhatsApp(row.phone, hostingCollectionMessage(row.name));
    if (!ok) toast(`אין מספר טלפון תקין ל${row.name}`, "error");
  };

  const card: React.CSSProperties = {
    background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: "0.75rem", padding: "1.5rem",
  };

  return (
    <div style={{ direction: "rtl", padding: "2rem" }}>
      <button onClick={() => router.push("/accounting")} style={{ background: "none", border: "none", color: "var(--foreground-muted)", fontSize: "0.85rem", cursor: "pointer", marginBottom: "0.75rem" }}>
        ← חזרה לחשבונות
      </button>
      <PageHeader title="גביית אחסון אתרים" subtitle="סטטוס תשלום שנתי לכל לקוח אחסון — גבייה בוואטסאפ בלחיצה" />

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        <div style={card}>
          <p style={{ color: "var(--foreground-muted)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>לקוחות אחסון</p>
          <p style={{ fontSize: "1.75rem", fontWeight: "bold", color: "var(--accent)" }}>{rows.length}</p>
        </div>
        <div style={card}>
          <p style={{ color: "var(--foreground-muted)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>שולם</p>
          <p style={{ fontSize: "1.75rem", fontWeight: "bold", color: "#22c55e" }}>{paidCount}</p>
        </div>
        <div style={card}>
          <p style={{ color: "var(--foreground-muted)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>לא שולם</p>
          <p style={{ fontSize: "1.75rem", fontWeight: "bold", color: "#ef4444" }}>{unpaidCount}</p>
          <p style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", marginTop: "0.35rem" }}>₪{unpaidAmount.toLocaleString("he-IL")} לגבייה</p>
        </div>
      </div>

      {/* Rows */}
      <div style={{ ...card, padding: "1rem 1.25rem" }}>
        {rows.length === 0 ? (
          <p style={{ color: "var(--foreground-muted)", fontSize: "0.9rem", padding: "2rem", textAlign: "center" }}>
            אין כרגע לקוחות אחסון אתרים להצגה. ודאו שסוג הלקוח מוגדר כ"אחסון".
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {rows.map((row) => (
              <div key={row.clientId} style={{
                display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap",
                padding: "0.9rem 1rem", border: "1px solid var(--border)", borderRadius: "0.6rem", background: "var(--surface)",
              }}>
                {/* Status dot + name */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flex: 1, minWidth: 200 }}>
                  <span style={{ width: 12, height: 12, borderRadius: "50%", background: row.paid ? "#22c55e" : "#ef4444", flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: "var(--foreground)" }}>{row.name}</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--foreground-muted)" }}>
                      {row.domain ? `${row.domain} · ` : ""}תשלום הבא: {fmtDate(row.nextPaymentDate)}
                    </div>
                  </div>
                </div>

                {/* Amount */}
                <div style={{ textAlign: "center", minWidth: 90 }}>
                  <div style={{ fontWeight: 700, color: "var(--foreground)" }}>₪{row.amount.toLocaleString("he-IL")}</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--foreground-muted)" }}>תשלום שנתי</div>
                </div>

                {/* Paid badge */}
                <span style={{
                  padding: "0.3rem 0.8rem", borderRadius: "0.4rem", fontSize: "0.8rem", fontWeight: 700, color: "#fff",
                  background: row.paid ? "#22c55e" : "#ef4444", whiteSpace: "nowrap",
                }}>
                  {row.paid ? "שולם" : "לא שולם"}
                </span>

                {/* Actions */}
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button
                    onClick={() => handleWhatsApp(row)}
                    title="צור קשר לגבייה בוואטסאפ"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6, padding: "0.5rem 0.85rem", fontSize: "0.82rem", fontWeight: 700,
                      border: "none", borderRadius: "0.4rem", background: "#25D366", color: "#fff", cursor: "pointer", whiteSpace: "nowrap",
                    }}>
                    💬 גבייה בוואטסאפ
                  </button>
                  {!row.paid ? (
                    <button
                      onClick={() => handleSettled(row)}
                      disabled={busy === row.clientId}
                      style={{
                        padding: "0.5rem 0.85rem", fontSize: "0.82rem", fontWeight: 700, border: "1px solid var(--border)", borderRadius: "0.4rem",
                        background: "var(--surface-raised)", color: "var(--foreground)", cursor: busy === row.clientId ? "wait" : "pointer", whiteSpace: "nowrap",
                      }}>
                      {busy === row.clientId ? "שומר…" : "✓ תשלום הוסדר"}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSettled(row)}
                      disabled={busy === row.clientId}
                      title="חדש לשנה נוספת"
                      style={{
                        padding: "0.5rem 0.85rem", fontSize: "0.82rem", fontWeight: 700, border: "1px solid var(--border)", borderRadius: "0.4rem",
                        background: "var(--surface-raised)", color: "var(--foreground-muted)", cursor: busy === row.clientId ? "wait" : "pointer", whiteSpace: "nowrap",
                      }}>
                      {busy === row.clientId ? "שומר…" : "↻ חדש לשנה"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p style={{ fontSize: "0.78rem", color: "var(--foreground-muted)", marginTop: "1rem" }}>
        * «תשלום הוסדר» מסמן את הלקוח כשולם (ירוק) ומגדיר את תאריך החיוב הבא לשנה קדימה — נשמר במסד הנתונים. «גבייה בוואטסאפ» פותחת צ׳אט עם הודעת גבייה מוכנה מראש.
      </p>
    </div>
  );
}
