"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useToast } from "@/components/ui/toast";
import type { ScannedReceipt, ExpenseCategory, ReceiptStatus } from "@/lib/db/schema";

/* ══════════════════════════════════════════════════════════════════════════
   Constants
   ══════════════════════════════════════════════════════════════════════════ */

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  office: "משרד",
  software: "תוכנה",
  advertising: "פרסום",
  travel: "נסיעות",
  meals: "ארוחות / כיבוד",
  professional_services: "שירותים מקצועיים",
  equipment: "ציוד",
  insurance: "ביטוח",
  taxes: "מיסים / אגרות",
  supplies: "חומרים מתכלים",
  utilities: "חשבונות שוטפים",
  rent: "שכירות",
  salary: "שכר",
  other: "אחר",
};

const STATUS_LABELS: Record<ReceiptStatus, string> = {
  pending_review: "ממתין לבדיקה",
  approved: "אושר",
  rejected: "נדחה",
  sent_to_accountant: "נשלח לרואה חשבון",
};

const STATUS_COLORS: Record<ReceiptStatus, string> = {
  pending_review: "rgba(234,179,8,0.2)",
  approved: "rgba(34,197,94,0.2)",
  rejected: "rgba(239,68,68,0.2)",
  sent_to_accountant: "rgba(59,130,246,0.2)",
};

const STATUS_TEXT_COLORS: Record<ReceiptStatus, string> = {
  pending_review: "#eab308",
  approved: "#22c55e",
  rejected: "#ef4444",
  sent_to_accountant: "#3b82f6",
};

const MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

const CURRENCY_SYMBOLS: Record<string, string> = { ILS: "₪", USD: "$", EUR: "€" };

/* ══════════════════════════════════════════════════════════════════════════
   Page component
   ══════════════════════════════════════════════════════════════════════════ */

export default function ReceiptsPage() {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Data
  const [receipts, setReceipts] = useState<ScannedReceipt[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterMonth, setFilterMonth] = useState<string>("");
  const [filterYear, setFilterYear] = useState<string>(String(new Date().getFullYear()));

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [scanResult, setScanResult] = useState<ScannedReceipt | null>(null);

  /* ── Fetch receipts ── */
  const fetchReceipts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterCategory) params.set("category", filterCategory);
      if (filterMonth) params.set("month", filterMonth);
      if (filterYear) params.set("year", filterYear);
      const res = await fetch(`/api/receipts?${params.toString()}`);
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      setReceipts(Array.isArray(data) ? data : []);
    } catch {
      toast("שגיאה בטעינת קבלות", "error");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterCategory, filterMonth, filterYear, toast]);

  useEffect(() => { fetchReceipts(); }, [fetchReceipts]);

  /* ── Upload + scan ── */
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setScanResult(null);

    try {
      // 1) Get signed upload URL
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: `receipts/${Date.now()}_${file.name}`,
          contentType: file.type,
          fileSize: file.size,
        }),
      });
      if (!uploadRes.ok) throw new Error("Failed to get upload URL");
      const { uploadUrl, publicUrl } = await uploadRes.json();

      // 2) Upload file directly to Supabase Storage
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error("Failed to upload file");

      // 3) Scan the receipt via our API
      const scanRes = await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: publicUrl }),
      });

      if (!scanRes.ok) {
        const err = await scanRes.json();
        throw new Error(err.error || "Scan failed");
      }

      const scanned: ScannedReceipt = await scanRes.json();
      setScanResult(scanned);
      toast("הקבלה נסרקה בהצלחה", "success");
      fetchReceipts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "שגיאה בסריקה";
      toast(msg, "error");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [toast, fetchReceipts]);

  /* ── Approve / Reject ── */
  const updateStatus = useCallback(async (id: string, newStatus: ReceiptStatus) => {
    try {
      const res = await fetch("/api/receipts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          status: newStatus,
          approvedBy: newStatus === "approved" ? "admin" : null,
        }),
      });
      if (!res.ok) throw new Error("update failed");
      toast(newStatus === "approved" ? "הקבלה אושרה" : "הקבלה נדחתה", "success");
      fetchReceipts();
    } catch {
      toast("שגיאה בעדכון סטטוס", "error");
    }
  }, [toast, fetchReceipts]);

  /* ── Aggregations ── */
  const categoryBreakdown = useMemo(() => {
    const map = new Map<ExpenseCategory, number>();
    receipts.forEach((r) => {
      map.set(r.category, (map.get(r.category) || 0) + r.total);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1]);
  }, [receipts]);

  const maxCategoryAmount = useMemo(
    () => Math.max(...categoryBreakdown.map(([, v]) => v), 1),
    [categoryBreakdown]
  );

  const summary = useMemo(() => {
    let totalExpenses = 0;
    let totalVat = 0;
    let deductibleVat = 0;
    let approvedCount = 0;
    let pendingCount = 0;

    receipts.forEach((r) => {
      totalExpenses += r.total;
      totalVat += r.vatAmount;
      if (r.isDeductible) {
        deductibleVat += r.vatAmount * (r.deductionPercentage / 100);
      }
      if (r.status === "approved") approvedCount++;
      if (r.status === "pending_review") pendingCount++;
    });

    return { totalExpenses, totalVat, deductibleVat, approvedCount, pendingCount };
  }, [receipts]);

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => current - 2 + i);
  }, []);

  /* ── Render ── */
  return (
    <div dir="rtl" style={{ padding: "1.5rem", maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "white", marginBottom: "0.25rem" }}>
          סריקת קבלות והוצאות
        </h1>
        <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.5)" }}>
          סרוק קבלות, סווג הוצאות, ועקוב אחרי ניכוי מע״מ
        </p>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        <SummaryCard label="סה״כ הוצאות" value={`₪${summary.totalExpenses.toLocaleString("he-IL", { minimumFractionDigits: 2 })}`} color="#a78bfa" />
        <SummaryCard label="סה״כ מע״מ" value={`₪${summary.totalVat.toLocaleString("he-IL", { minimumFractionDigits: 2 })}`} color="#38bdf8" />
        <SummaryCard label="מע״מ לניכוי" value={`₪${summary.deductibleVat.toLocaleString("he-IL", { minimumFractionDigits: 2 })}`} color="#22c55e" />
        <SummaryCard label="ממתינים / מאושרים" value={`${summary.pendingCount} / ${summary.approvedCount}`} color="#eab308" />
      </div>

      {/* Upload area */}
      <div style={{
        background: "rgba(255,255,255,0.05)",
        border: "2px dashed rgba(255,255,255,0.15)",
        borderRadius: 12,
        padding: "2rem",
        textAlign: "center",
        marginBottom: "1.5rem",
        cursor: isUploading ? "wait" : "pointer",
        transition: "border-color 0.2s",
      }}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file && fileInputRef.current) {
            const dt = new DataTransfer();
            dt.items.add(file);
            fileInputRef.current.files = dt.files;
            fileInputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          style={{ display: "none" }}
          onChange={handleFileSelect}
        />
        {isUploading ? (
          <div>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem", animation: "spin 1s linear infinite" }}>
              ⏳
            </div>
            <p style={{ color: "rgba(255,255,255,0.7)" }}>סורק קבלה...</p>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📄</div>
            <p style={{ color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>
              לחץ או גרור קבלה לכאן לסריקה
            </p>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem", marginTop: "0.25rem" }}>
              תמונה או PDF
            </p>
          </div>
        )}
      </div>

      {/* Scan result preview */}
      {scanResult && (
        <div style={{
          background: "rgba(34,197,94,0.08)",
          border: "1px solid rgba(34,197,94,0.25)",
          borderRadius: 12,
          padding: "1rem 1.25rem",
          marginBottom: "1.5rem",
        }}>
          <h3 style={{ color: "#22c55e", fontWeight: 700, marginBottom: "0.75rem", fontSize: "0.95rem" }}>
            תוצאת סריקה אחרונה
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.5rem", fontSize: "0.85rem" }}>
            <Detail label="ספק" value={scanResult.vendorName} />
            <Detail label="ח.פ. / ע.מ." value={scanResult.vendorTaxId || "—"} />
            <Detail label="תאריך" value={scanResult.receiptDate} />
            <Detail label="מספר קבלה" value={scanResult.receiptNumber || "—"} />
            <Detail label="סכום לפני מע״מ" value={`${CURRENCY_SYMBOLS[scanResult.currency]}${scanResult.subtotal}`} />
            <Detail label="מע״מ" value={`${CURRENCY_SYMBOLS[scanResult.currency]}${scanResult.vatAmount}`} />
            <Detail label="סה״כ" value={`${CURRENCY_SYMBOLS[scanResult.currency]}${scanResult.total}`} />
            <Detail label="קטגוריה" value={`${CATEGORY_LABELS[scanResult.category]} (${Math.round(scanResult.categoryConfidence * 100)}%)`} />
            <Detail label="ניכוי" value={`${scanResult.deductionPercentage}%`} />
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.75rem",
        marginBottom: "1.25rem",
        alignItems: "center",
      }}>
        <SelectFilter
          value={filterStatus}
          onChange={setFilterStatus}
          placeholder="כל הסטטוסים"
          options={Object.entries(STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))}
        />
        <SelectFilter
          value={filterCategory}
          onChange={setFilterCategory}
          placeholder="כל הקטגוריות"
          options={Object.entries(CATEGORY_LABELS).map(([v, l]) => ({ value: v, label: l }))}
        />
        <SelectFilter
          value={filterMonth}
          onChange={setFilterMonth}
          placeholder="כל החודשים"
          options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
        />
        <SelectFilter
          value={filterYear}
          onChange={setFilterYear}
          placeholder="שנה"
          options={years.map((y) => ({ value: String(y), label: String(y) }))}
        />
        <button
          onClick={() => toast("ייצוא לרואה חשבון — בקרוב!", "info")}
          style={{
            background: "rgba(139,92,246,0.15)",
            color: "#a78bfa",
            border: "1px solid rgba(139,92,246,0.3)",
            borderRadius: 8,
            padding: "0.5rem 1rem",
            fontSize: "0.85rem",
            fontWeight: 600,
            cursor: "pointer",
            marginRight: "auto",
          }}
        >
          ייצוא לרואה חשבון
        </button>
      </div>

      {/* Layout: table + chart side by side on large screens */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "1.25rem", alignItems: "start" }}>
        {/* Receipts table */}
        <div style={{
          background: "rgba(255,255,255,0.05)",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.1)",
          overflow: "hidden",
        }}>
          <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "white" }}>
              קבלות ({receipts.length})
            </h2>
          </div>

          {loading ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "rgba(255,255,255,0.4)" }}>
              טוען...
            </div>
          ) : receipts.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "rgba(255,255,255,0.4)" }}>
              אין קבלות להצגה
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                    {["ספק", "תאריך", "סכום", "מע״מ", "קטגוריה", "סטטוס", "ניכוי", "פעולות"].map((h) => (
                      <th key={h} style={{ padding: "0.6rem 0.75rem", textAlign: "right", color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((r) => (
                    <tr key={r.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ padding: "0.6rem 0.75rem", color: "white", fontWeight: 600 }}>
                        {r.vendorName}
                        {r.vendorTaxId && (
                          <span style={{ display: "block", fontSize: "0.7rem", color: "rgba(255,255,255,0.4)" }}>
                            {r.vendorTaxId}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem", color: "rgba(255,255,255,0.7)" }}>
                        {r.receiptDate}
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem", color: "white", fontWeight: 600 }}>
                        {CURRENCY_SYMBOLS[r.currency]}{r.total.toLocaleString("he-IL", { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem", color: "rgba(255,255,255,0.6)" }}>
                        {CURRENCY_SYMBOLS[r.currency]}{r.vatAmount.toLocaleString("he-IL", { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem" }}>
                        <span style={{
                          background: "rgba(139,92,246,0.15)",
                          color: "#c4b5fd",
                          padding: "2px 8px",
                          borderRadius: 6,
                          fontSize: "0.75rem",
                        }}>
                          {CATEGORY_LABELS[r.category]}
                        </span>
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem" }}>
                        <span style={{
                          background: STATUS_COLORS[r.status],
                          color: STATUS_TEXT_COLORS[r.status],
                          padding: "2px 8px",
                          borderRadius: 6,
                          fontSize: "0.75rem",
                          fontWeight: 600,
                        }}>
                          {STATUS_LABELS[r.status]}
                        </span>
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem", color: "rgba(255,255,255,0.6)" }}>
                        {r.deductionPercentage}%
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem" }}>
                        {r.status === "pending_review" && (
                          <div style={{ display: "flex", gap: "0.35rem" }}>
                            <button
                              onClick={() => updateStatus(r.id, "approved")}
                              style={{
                                background: "rgba(34,197,94,0.15)",
                                color: "#22c55e",
                                border: "none",
                                borderRadius: 6,
                                padding: "4px 10px",
                                fontSize: "0.75rem",
                                cursor: "pointer",
                                fontWeight: 600,
                              }}
                            >
                              אשר
                            </button>
                            <button
                              onClick={() => updateStatus(r.id, "rejected")}
                              style={{
                                background: "rgba(239,68,68,0.15)",
                                color: "#ef4444",
                                border: "none",
                                borderRadius: 6,
                                padding: "4px 10px",
                                fontSize: "0.75rem",
                                cursor: "pointer",
                                fontWeight: 600,
                              }}
                            >
                              דחה
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Category breakdown chart */}
        <div style={{
          background: "rgba(255,255,255,0.05)",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.1)",
          padding: "1rem",
        }}>
          <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "white", marginBottom: "1rem" }}>
            פילוח לפי קטגוריה
          </h2>
          {categoryBreakdown.length === 0 ? (
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem" }}>אין נתונים</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {categoryBreakdown.map(([cat, amount]) => (
                <div key={cat}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "0.2rem" }}>
                    <span style={{ color: "rgba(255,255,255,0.7)" }}>{CATEGORY_LABELS[cat]}</span>
                    <span style={{ color: "white", fontWeight: 600 }}>
                      ₪{amount.toLocaleString("he-IL", { minimumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div style={{
                    width: "100%",
                    height: 8,
                    background: "rgba(255,255,255,0.08)",
                    borderRadius: 4,
                    overflow: "hidden",
                  }}>
                    <div style={{
                      width: `${(amount / maxCategoryAmount) * 100}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, #8b5cf6, #a78bfa)",
                      borderRadius: 4,
                      transition: "width 0.3s ease",
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Monthly summary */}
          <div style={{
            marginTop: "1.5rem",
            paddingTop: "1rem",
            borderTop: "1px solid rgba(255,255,255,0.1)",
          }}>
            <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "white", marginBottom: "0.75rem" }}>
              סיכום חודשי
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.8rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(255,255,255,0.5)" }}>סה״כ הוצאות</span>
                <span style={{ color: "white", fontWeight: 600 }}>
                  ₪{summary.totalExpenses.toLocaleString("he-IL", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(255,255,255,0.5)" }}>מע״מ תשומות</span>
                <span style={{ color: "#38bdf8", fontWeight: 600 }}>
                  ₪{summary.totalVat.toLocaleString("he-IL", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(255,255,255,0.5)" }}>מע״מ לניכוי</span>
                <span style={{ color: "#22c55e", fontWeight: 600 }}>
                  ₪{summary.deductibleVat.toLocaleString("he-IL", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(255,255,255,0.5)" }}>קבלות</span>
                <span style={{ color: "white" }}>{receipts.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Sub-components
   ══════════════════════════════════════════════════════════════════════════ */

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 12,
      padding: "1rem 1.25rem",
    }}>
      <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", marginBottom: "0.25rem" }}>{label}</p>
      <p style={{ fontSize: "1.25rem", fontWeight: 700, color }}>{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem" }}>{label}: </span>
      <span style={{ color: "white" }}>{value}</span>
    </div>
  );
}

function SelectFilter({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: "rgba(255,255,255,0.08)",
        color: "white",
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 8,
        padding: "0.5rem 0.75rem",
        fontSize: "0.8rem",
        cursor: "pointer",
        outline: "none",
        minWidth: 140,
      }}
    >
      <option value="" style={{ background: "#1a1a2e" }}>{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} style={{ background: "#1a1a2e" }}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
