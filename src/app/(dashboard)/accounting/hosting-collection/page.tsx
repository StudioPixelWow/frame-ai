"use client";

export const dynamic = "force-dynamic";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useClients, useHostingRecords } from "@/lib/api/use-entity";
import { AdminOnly } from "@/components/role-gate";
import { useToast } from "@/components/ui/toast";
import { openWhatsApp, hostingCollectionMessage } from "@/lib/utils/whatsapp";

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
  recordId: string | null;
  clientId: string;
  name: string;
  phone: string;
  domain: string;
  amount: number;
  paid: boolean;
  nextPaymentDate: string | null;
  lastPaidDate: string | null;
}

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const isPaidThisYear = (lastPaidDate: string | null | undefined): boolean => {
  if (!lastPaidDate) return false;
  const t = new Date(lastPaidDate).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < YEAR_MS;
};
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

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
  const { data: rawClients } = useClients();
  const { data: rawHosting, update: updateHosting, create: createHosting } = useHostingRecords();
  const clients = rawClients ?? [];
  const hosting = rawHosting ?? [];
  const [busy, setBusy] = useState<string>("");

  const rows: HostingRow[] = useMemo(() => {
    const clientById = new Map<string, any>(clients.map((c: any) => [c.id, c]));
    const out: HostingRow[] = [];
    const seen = new Set<string>();

    hosting.forEach((r: any) => {
      const c = clientById.get(r.clientId);
      seen.add(r.clientId);
      out.push({
        recordId: r.id,
        clientId: r.clientId,
        name: c?.name || r.clientName || "לא ידוע",
        phone: c?.phone || "",
        domain: r.domainName || "",
        amount: r.yearlyPaymentAmount || c?.retainerAmount || 0,
        paid: isPaidThisYear(r.lastPaidDate),
        nextPaymentDate: r.nextPaymentDate || null,
        lastPaidDate: r.lastPaidDate || null,
      });
    });

    // Hosting-type clients that don't yet have a hosting record.
    clients
      .filter((c: any) => c.clientType === "hosting" && !seen.has(c.id))
      .forEach((c: any) => {
        out.push({
          recordId: null,
          clientId: c.id,
          name: c.name || "לא ידוע",
          phone: c.phone || "",
          domain: c.websiteUrl || "",
          amount: c.retainerAmount || 0,
          paid: false,
          nextPaymentDate: c.annualPaymentDate || null,
          lastPaidDate: null,
        });
      });

    return out.sort((a, b) => Number(a.paid) - Number(b.paid) || a.name.localeCompare(b.name, "he"));
  }, [clients, hosting]);

  const paidCount = rows.filter((r) => r.paid).length;
  const unpaidCount = rows.length - paidCount;
  const unpaidAmount = rows.filter((r) => !r.paid).reduce((s, r) => s + r.amount, 0);

  const handleSettled = async (row: HostingRow) => {
    setBusy(row.clientId);
    const today = new Date().toISOString();
    try {
      if (row.recordId) {
        await updateHosting(row.recordId, { status: "active", lastPaidDate: today, nextPaymentDate: today } as any);
      } else {
        await createHosting({
          clientId: row.clientId,
          clientName: row.name,
          domainName: row.domain || "",
          hostingProvider: "",
          yearlyPaymentAmount: row.amount || 0,
          nextPaymentDate: today,
          lastPaidDate: today,
          status: "active",
          notes: "",
        } as any);
      }
      toast(`התשלום של ${row.name} סומן כשולם`, "success");
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
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: "0.5rem", color: "var(--foreground)" }}>גביית אחסון אתרים</h1>
        <p style={{ color: "var(--foreground-muted)", fontSize: "0.95rem" }}>סטטוס תשלום שנתי לכל לקוח אחסון — גבייה בוואטסאפ בלחיצה</p>
      </div>

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
            אין כרגע לקוחות אחסון אתרים להצגה.
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
                  {!row.paid && (
                    <button
                      onClick={() => handleSettled(row)}
                      disabled={busy === row.clientId}
                      style={{
                        padding: "0.5rem 0.85rem", fontSize: "0.82rem", fontWeight: 700, border: "1px solid var(--border)", borderRadius: "0.4rem",
                        background: "var(--surface-raised)", color: "var(--foreground)", cursor: busy === row.clientId ? "wait" : "pointer", whiteSpace: "nowrap",
                      }}>
                      {busy === row.clientId ? "שומר…" : "✓ תשלום הוסדר"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p style={{ fontSize: "0.78rem", color: "var(--foreground-muted)", marginTop: "1rem" }}>
        * לחיצה על «תשלום הוסדר» מסמנת את הלקוח כשולם (ירוק) ומעדכנת את תאריך התשלום. «גבייה בוואטסאפ» פותחת צ׳אט עם הודעת גבייה מוכנה מראש.
      </p>
    </div>
  );
}
