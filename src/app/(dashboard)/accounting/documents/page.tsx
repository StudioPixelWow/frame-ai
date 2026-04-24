"use client";

export const dynamic = "force-dynamic";

import { useAccountantDocuments } from "@/lib/api/use-entity";
import { useState, useMemo, useRef, useCallback } from "react";
import { useToast } from "@/components/ui/toast";

/* ── Email Preview Modal types ── */
interface EmailAttachment {
  id: string;
  fileName: string;
  fileUrl: string | null;
  fileSize: number;
  documentType: string;
  notes: string;
  uploadedAt: string | null;
  accessible: boolean;
}

interface EmailPreview {
  to: string;
  subject: string;
  body: string;
  attachments: EmailAttachment[];
  inaccessibleCount: number;
  totalFiles: number;
  totalSize: number;
  sentAt: string;
  periodName: string;
  year: number;
}

interface BimonthlyPeriod {
  id: string;
  nameHebrew: string;
  months: [number, number];
  startMonth: number;
  endMonth: number;
}

const PERIODS: BimonthlyPeriod[] = [
  { id: "jan-feb", nameHebrew: "ינואר-פברואר", months: [1, 2], startMonth: 0, endMonth: 1 },
  { id: "mar-apr", nameHebrew: "מרץ-אפריל", months: [3, 4], startMonth: 2, endMonth: 3 },
  { id: "may-jun", nameHebrew: "מאי-יוני", months: [5, 6], startMonth: 4, endMonth: 5 },
  { id: "jul-aug", nameHebrew: "יולי-אוגוסט", months: [7, 8], startMonth: 6, endMonth: 7 },
  { id: "sep-oct", nameHebrew: "ספטמבר-אוקטובר", months: [9, 10], startMonth: 8, endMonth: 9 },
  { id: "nov-dec", nameHebrew: "נובמבר-דצמבר", months: [11, 12], startMonth: 10, endMonth: 11 },
];

export default function DocumentsPage() {
  const { data: allDocuments, loading, create, refetch } = useAccountantDocuments();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedFileRef = useRef<File | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [uploadingPeriod, setUploadingPeriod] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadForm, setUploadForm] = useState({
    documentType: "invoice",
    notes: "",
    selectedFile: null as File | null,
  });

  // ── Send to accountant state ──
  const [sendingPeriod, setSendingPeriod] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [emailPreview, setEmailPreview] = useState<EmailPreview | null>(null);
  const [sendMessage, setSendMessage] = useState("");

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  }, []);

  const getDocumentsForPeriod = (periodId: string) => {
    if (!allDocuments || !Array.isArray(allDocuments)) return [];
    const period = PERIODS.find((p) => p.id === periodId);
    if (!period) return [];

    return allDocuments.filter((doc: any) => {
      if (!doc) return false;
      // Primary: match by explicit period + year fields
      if (doc.period && doc.year) {
        return doc.period === periodId && Number(doc.year) === selectedYear;
      }
      // Fallback for legacy documents: match by createdAt date
      const docDate = new Date(doc?.createdAt || doc?.uploadDate);
      if (isNaN(docDate.getTime())) return false;
      const docYear = docDate.getFullYear();
      const docMonth = docDate.getMonth();
      return docYear === selectedYear && docMonth >= period.startMonth && docMonth <= period.endMonth;
    });
  };

  const getDocTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      invoice: "חשבונית",
      receipt: "קבלה",
      report: "דוח",
      tax: "מס",
      other: "אחר",
    };
    return labels[type] || type;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log('[AccountantUpload] handleFileSelect fired — file:', file?.name, 'size:', file?.size);
    if (file) {
      selectedFileRef.current = file;
      setUploadForm(prev => ({ ...prev, selectedFile: file }));
      console.log('[AccountantUpload] ✅ File stored in state + ref:', file.name);
    } else {
      console.error('[AccountantUpload] handleFileSelect — no file in event');
    }
  };

  /**
   * Upload flow:
   * 1. POST /api/upload → get signed URL + publicUrl for Supabase Storage
   * 2. PUT file directly to Supabase Storage via signed URL
   * 3. POST /api/data/accountant-documents → create record in app_client_files (category='accountant')
   * 4. Refetch to update UI immediately
   */
  const handleUpload = async (periodId: string) => {
    console.log('[AccountantUpload] ▶ UPLOAD CLICKED for period:', periodId);
    console.log('[AccountantUpload]   selectedFile state:', uploadForm.selectedFile?.name ?? 'NULL');
    console.log('[AccountantUpload]   selectedFile ref:', selectedFileRef.current?.name ?? 'NULL');
    console.log('[AccountantUpload]   documentType:', uploadForm.documentType);
    console.log('[AccountantUpload]   year:', selectedYear);

    // Use ref as source of truth for the file (immune to stale closures)
    const file = selectedFileRef.current || uploadForm.selectedFile;

    if (!file) {
      console.error('[AccountantUpload] ❌ BLOCKED — no file selected. uploadForm.selectedFile is null AND ref is null.');
      toast("אנא בחר קובץ", "error");
      return;
    }

    console.log('[AccountantUpload] ✅ File found:', file.name, file.size, 'bytes. Proceeding...');
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // ── Step 1: Get signed upload URL ──
      console.log('[AccountantUpload] Step 1: POST /api/upload for', file.name);
      const signedRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: `accountant/${selectedYear}/${periodId}/${Date.now()}_${file.name}`,
          contentType: file.type || 'application/octet-stream',
          fileSize: file.size,
        }),
      });

      console.log('[AccountantUpload] Step 1: Response status:', signedRes.status);
      if (!signedRes.ok) {
        const err = await signedRes.json().catch(() => ({}));
        throw new Error(err.error || `Failed to get upload URL (${signedRes.status})`);
      }

      const { uploadUrl, publicUrl } = await signedRes.json();
      console.log('[AccountantUpload] Step 1 ✅ publicUrl:', publicUrl?.slice(0, 80));
      setUploadProgress(30);

      // ── Step 2: PUT file directly to Supabase Storage ──
      console.log('[AccountantUpload] Step 2: PUT', (file.size / 1024).toFixed(0), 'KB to storage...');
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });

      console.log('[AccountantUpload] Step 2: Response status:', putRes.status);
      if (!putRes.ok) {
        throw new Error(`File upload to storage failed (${putRes.status})`);
      }
      console.log('[AccountantUpload] Step 2 ✅ file in Supabase Storage');
      setUploadProgress(70);

      // ── Step 3: Create DB record in app_client_files (category='accountant') ──
      const period = PERIODS.find(p => p.id === periodId);
      const record = {
        clientId: 'system',
        fileName: file.name,
        fileUrl: publicUrl,
        fileSize: file.size,
        category: 'accountant',
        uploadedBy: null,
        linkedTaskId: null,
        linkedGanttItemId: null,
        notes: uploadForm.notes,
        period: periodId,
        periodLabel: `${period?.nameHebrew || ''} ${selectedYear}`,
        year: selectedYear,
        documentType: uploadForm.documentType,
        sentToAccountant: false,
        sentAt: null,
      };

      console.log('[AccountantUpload] Step 3: POST /api/data/accountant-documents', JSON.stringify(record).slice(0, 400));
      const created = await create(record);
      console.log('[AccountantUpload] Step 3 ✅ DB record id:', created?.id);
      setUploadProgress(90);

      // ── Step 4: Refetch to confirm persistence ──
      console.log('[AccountantUpload] Step 4: Refetching list...');
      await refetch();
      console.log('[AccountantUpload] Step 4 ✅ List refreshed');
      setUploadProgress(100);

      toast("מסמך הועלה בהצלחה ונשמר", "success");
      selectedFileRef.current = null;
      setUploadForm({ documentType: "invoice", notes: "", selectedFile: null });
      setUploadingPeriod(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      toast(`שגיאה בהעלאת המסמך: ${msg}`, "error");
      console.error("[AccountantUpload] ❌ ERROR:", msg, error);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleExportPeriod = (periodId: string) => {
    window.open(`/api/accounting/export-pdf?period=${periodId}&year=${selectedYear}`, "_blank");
    toast("PDF נפתח בלשונית חדשה — לחץ שמור כ-PDF להורדה", "success");
  };

  /** Send files to accountant — calls API, shows preview modal with real attachments */
  const handleSendToAccountant = useCallback(async (periodId: string) => {
    const docs = getDocumentsForPeriod(periodId);
    if (docs.length === 0) {
      toast("אין מסמכים לתקופה זו — העלה מסמכים לפני שליחה", "error");
      return;
    }

    setIsSending(true);
    setSendingPeriod(periodId);

    try {
      const res = await fetch("/api/accounting/send-to-accountant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period: periodId,
          year: selectedYear,
          message: sendMessage || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast(data.error || "שגיאה בשליחה", "error");
        setSendingPeriod(null);
        return;
      }

      setEmailPreview(data.emailPreview);
      await refetch();
      toast(`${data.emailPreview.totalFiles} קבצים נשלחו לרואה חשבון בהצלחה`, "success");
    } catch (error) {
      toast("שגיאה בשליחה לרואה חשבון", "error");
      console.error("[SendToAccountant] Error:", error);
    } finally {
      setIsSending(false);
    }
  }, [selectedYear, sendMessage, refetch, toast]);

  /** Close preview modal */
  const closePreview = () => {
    setEmailPreview(null);
    setSendingPeriod(null);
    setSendMessage("");
  };

  // Only show full-page loading on initial mount (no data yet).
  // Do NOT unmount the form on background refetches (e.g. window focus)
  // because that destroys the file input and causes "page refresh" behavior.
  const isInitialLoad = loading && (!allDocuments || allDocuments.length === 0) && !uploadingPeriod;
  if (isInitialLoad) {
    return (
      <div style={{ direction: "rtl", padding: "2rem", textAlign: "center", color: "var(--foreground-muted)" }}>
        טוען מסמכים...
      </div>
    );
  }

  return (
    <div style={{ direction: "rtl", padding: "2rem" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: "0.5rem", color: "var(--foreground)" }}>
          מסמכי רואה חשבון
        </h1>
        <p style={{ color: "var(--foreground-muted)", fontSize: "0.95rem" }}>
          ניהול מסמכים דו-חודשי — נשמרים בענן (Supabase)
        </p>
      </div>

      {/* Year Selector */}
      <div style={{
        marginBottom: "2rem", padding: "1.5rem",
        background: "var(--surface-raised)", border: "1px solid var(--border)",
        borderRadius: "0.75rem", display: "flex", alignItems: "center", gap: "1rem",
      }}>
        <label style={{ fontSize: "0.95rem", fontWeight: "600", color: "var(--foreground)" }}>בחר שנה:</label>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          style={{
            padding: "0.5rem 0.75rem", borderRadius: "0.5rem",
            border: "1px solid var(--border)", background: "var(--surface-raised)",
            color: "var(--foreground)", fontWeight: "600",
          }}
        >
          {years.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      {/* Periods Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "2rem" }}>
        {PERIODS.map((period) => {
          const docs = getDocumentsForPeriod(period.id);
          const isPeriodUploading = uploadingPeriod === period.id;

          return (
            <div key={period.id} style={{
              background: "var(--surface-raised)", border: "1px solid var(--border)",
              borderRadius: "0.75rem", padding: "1.5rem",
            }}>
              {/* Period Header */}
              <div style={{ marginBottom: "1.5rem" }}>
                <h3 style={{ fontSize: "1.25rem", fontWeight: "bold", color: "var(--foreground)", marginBottom: "0.5rem" }}>
                  {period.nameHebrew}
                </h3>
                <p style={{ color: "var(--foreground-muted)", fontSize: "0.9rem" }}>
                  {docs.length} מסמכים
                </p>
              </div>

              {/* Documents List */}
              {docs.length > 0 ? (
                <div style={{ marginBottom: "1.5rem", maxHeight: "300px", overflowY: "auto" }}>
                  {docs.map((doc: any, idx: number) => (
                    <div key={doc.id || idx} style={{
                      padding: "0.75rem",
                      borderBottom: idx < docs.length - 1 ? "1px solid var(--border)" : "none",
                      display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem",
                    }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: "0.9rem", fontWeight: "600", color: "var(--foreground)", marginBottom: "0.25rem" }}>
                          {doc.fileName || "מסמך ללא שם"}
                        </p>
                        <p style={{ fontSize: "0.8rem", color: "var(--foreground-muted)" }}>
                          {new Date(doc.createdAt).toLocaleDateString("he-IL")}
                        </p>
                      </div>
                      <span style={{
                        display: "inline-block", padding: "0.25rem 0.75rem", borderRadius: "0.375rem",
                        fontSize: "0.8rem", fontWeight: "600", color: "#fff", background: "#6b7280", flexShrink: 0,
                      }}>
                        {getDocTypeLabel(doc.documentType || doc.fileType || "other")}
                      </span>
                      {doc.fileUrl && doc.fileUrl.startsWith("http") ? (
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            padding: "0.4rem 0.6rem", borderRadius: "0.375rem",
                            border: "1px solid var(--border)", background: "var(--surface)",
                            color: "var(--foreground)", cursor: "pointer", fontSize: "0.8rem",
                            flexShrink: 0, textDecoration: "none",
                          }}
                          title="הורד"
                        >
                          ⬇️
                        </a>
                      ) : (
                        <span style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          padding: "0.4rem 0.6rem", borderRadius: "0.375rem",
                          border: "1px solid var(--border)", background: "var(--surface)",
                          color: "var(--foreground-muted)", fontSize: "0.8rem", flexShrink: 0, opacity: 0.4,
                        }}>⬇️</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  padding: "1rem", textAlign: "center", background: "var(--surface-raised)",
                  borderRadius: "0.5rem", marginBottom: "1.5rem", color: "var(--foreground-muted)",
                }}>
                  <p>לא הועלו מסמכים לתקופה זו</p>
                </div>
              )}

              {/* Upload Section */}
              {isPeriodUploading ? (
                <div style={{
                  padding: "1.5rem", border: "1px solid var(--border)", borderRadius: "0.5rem",
                  marginBottom: "1rem", background: "var(--surface-raised)",
                }}>
                  <h4 style={{ fontSize: "0.95rem", fontWeight: "600", marginBottom: "1rem", color: "var(--foreground)" }}>
                    העלאת מסמך חדש
                  </h4>

                  <div style={{ marginBottom: "1rem" }}>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", marginBottom: "0.5rem" }}>בחר קובץ</label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileSelect}
                      disabled={isUploading}
                      style={{
                        width: "100%", padding: "0.5rem 0.75rem", borderRadius: "0.5rem",
                        border: "1px solid var(--border)", background: "var(--surface-raised)",
                        color: "var(--foreground)", fontSize: "0.9rem",
                      }}
                    />
                    {uploadForm.selectedFile && (
                      <p style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", marginTop: "0.5rem" }}>
                        {uploadForm.selectedFile.name} ({(uploadForm.selectedFile.size / 1024).toFixed(0)} KB)
                      </p>
                    )}
                  </div>

                  <div style={{ marginBottom: "1rem" }}>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", marginBottom: "0.5rem" }}>סוג מסמך</label>
                    <select
                      value={uploadForm.documentType}
                      onChange={(e) => { const v = e.target.value; setUploadForm(prev => ({ ...prev, documentType: v })); }}
                      disabled={isUploading}
                      style={{
                        width: "100%", padding: "0.5rem 0.75rem", borderRadius: "0.5rem",
                        border: "1px solid var(--border)", background: "var(--surface-raised)", color: "var(--foreground)",
                      }}
                    >
                      <option value="invoice">חשבונית</option>
                      <option value="receipt">קבלה</option>
                      <option value="report">דוח</option>
                      <option value="tax">מס</option>
                      <option value="other">אחר</option>
                    </select>
                  </div>

                  <div style={{ marginBottom: "1.5rem" }}>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", marginBottom: "0.5rem" }}>הערות</label>
                    <textarea
                      placeholder="הערות אופציונליות..."
                      value={uploadForm.notes}
                      onChange={(e) => { const v = e.target.value; setUploadForm(prev => ({ ...prev, notes: v })); }}
                      disabled={isUploading}
                      style={{
                        width: "100%", padding: "0.5rem 0.75rem", borderRadius: "0.5rem",
                        border: "1px solid var(--border)", background: "var(--surface-raised)",
                        color: "var(--foreground)", fontSize: "0.9rem", minHeight: "80px",
                      }}
                    />
                  </div>

                  {/* Progress bar */}
                  {isUploading && (
                    <div style={{ marginBottom: "1rem" }}>
                      <div style={{ height: "0.5rem", background: "var(--border)", borderRadius: "0.25rem", overflow: "hidden" }}>
                        <div style={{
                          height: "100%", width: `${uploadProgress}%`,
                          background: "#10b981", transition: "width 0.3s ease", borderRadius: "0.25rem",
                        }} />
                      </div>
                      <p style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", marginTop: "0.25rem", textAlign: "center" }}>
                        {uploadProgress < 30 ? "מתכונן להעלאה..." :
                         uploadProgress < 70 ? "מעלה קובץ לאחסון..." :
                         uploadProgress < 90 ? "שומר רשומה בבסיס נתונים..." : "סיום..."}
                      </p>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    <button
                      type="button"
                      onClick={() => { console.log('[AccountantUpload] 🖱️ Button clicked'); handleUpload(period.id); }}
                      disabled={isUploading}
                      style={{
                        padding: "0.5rem 1rem",
                        background: isUploading ? "#6b7280" : "var(--accent)",
                        color: "#000", border: "none", borderRadius: "0.5rem", fontWeight: "600",
                        cursor: isUploading ? "not-allowed" : "pointer",
                        opacity: isUploading ? 0.6 : 1,
                      }}
                    >
                      {isUploading ? "מעלה..." : "העלאה"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadingPeriod(null)}
                      disabled={isUploading}
                      style={{
                        padding: "0.5rem 1rem", background: "transparent",
                        color: "var(--foreground)", border: "1px solid var(--border)",
                        borderRadius: "0.5rem", fontWeight: "600",
                        cursor: isUploading ? "not-allowed" : "pointer",
                      }}
                    >
                      ביטול
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setUploadingPeriod(period.id)}
                  style={{
                    width: "100%", padding: "0.75rem", background: "transparent",
                    color: "var(--accent)", border: "1px dashed var(--border)",
                    borderRadius: "0.5rem", fontWeight: "600", cursor: "pointer", marginBottom: "1rem",
                  }}
                >
                  + הוסף מסמך
                </button>
              )}

              {/* Actions: Send + Export */}
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  onClick={() => handleSendToAccountant(period.id)}
                  disabled={isSending && sendingPeriod === period.id}
                  style={{
                    flex: 1, padding: "0.75rem",
                    background: isSending && sendingPeriod === period.id ? "#6b7280" : "#10b981",
                    color: "#fff", border: "none", borderRadius: "0.5rem",
                    fontWeight: "600",
                    cursor: isSending && sendingPeriod === period.id ? "not-allowed" : "pointer",
                    opacity: isSending && sendingPeriod === period.id ? 0.7 : 1,
                  }}
                >
                  {isSending && sendingPeriod === period.id ? "שולח..." : "📧 שלח לרואה חשבון"}
                </button>
                <button
                  onClick={() => handleExportPeriod(period.id)}
                  style={{
                    padding: "0.75rem 1rem", background: "transparent",
                    color: "var(--foreground)", border: "1px solid var(--border)",
                    borderRadius: "0.5rem", fontWeight: "600", cursor: "pointer",
                  }}
                  title="ייצא כ-PDF"
                >
                  📄
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══ EMAIL PREVIEW MODAL ═══ */}
      {emailPreview && (
        <div
          onClick={closePreview}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.5)", display: "flex",
            alignItems: "center", justifyContent: "center", padding: "2rem",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--surface-raised, #fff)", borderRadius: "1rem",
              maxWidth: "640px", width: "100%", maxHeight: "85vh", overflowY: "auto",
              padding: "2rem", direction: "rtl", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
                  נשלח לרואה חשבון
                </h2>
                <p style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", marginTop: "0.25rem" }}>
                  {emailPreview.periodName} {emailPreview.year}
                </p>
              </div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: "0.35rem",
                padding: "0.25rem 0.75rem", borderRadius: "999px",
                background: "rgba(16,185,129,0.12)", color: "#10b981",
                fontSize: "0.72rem", fontWeight: 600,
              }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981" }} />
                נשלח בהצלחה
              </div>
            </div>

            {/* Email details */}
            <div style={{
              background: "var(--surface, rgba(0,0,0,0.02))", borderRadius: "0.75rem",
              padding: "1rem 1.25rem", marginBottom: "1.25rem", border: "1px solid var(--border)",
            }}>
              <div style={{ fontSize: "0.8rem", marginBottom: "0.5rem" }}>
                <span style={{ fontWeight: 600 }}>אל: </span>
                <span style={{ color: "var(--foreground-muted)" }}>{emailPreview.to}</span>
              </div>
              <div style={{ fontSize: "0.8rem", marginBottom: "0.5rem" }}>
                <span style={{ fontWeight: 600 }}>נושא: </span>
                <span style={{ color: "var(--foreground-muted)" }}>{emailPreview.subject}</span>
              </div>
              <div style={{ fontSize: "0.8rem" }}>
                <span style={{ fontWeight: 600 }}>נשלח ב: </span>
                <span style={{ color: "var(--foreground-muted)" }}>
                  {new Date(emailPreview.sentAt).toLocaleString("he-IL")}
                </span>
              </div>
            </div>

            {/* Attachments list — the actual files */}
            <div style={{ marginBottom: "1.25rem" }}>
              <h3 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: "0.75rem" }}>
                📎 קבצים מצורפים ({emailPreview.totalFiles})
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {emailPreview.attachments.map((att, idx) => (
                  <div
                    key={att.id}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.75rem",
                      padding: "0.75rem 1rem", borderRadius: "0.5rem",
                      border: "1px solid var(--border)", background: "var(--surface-raised, #fff)",
                    }}
                  >
                    <span style={{ fontSize: "1.25rem" }}>
                      {att.documentType === "invoice" ? "🧾" :
                       att.documentType === "receipt" ? "🧾" :
                       att.documentType === "report" ? "📊" :
                       att.documentType === "tax" ? "📋" : "📄"}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.85rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {att.fileName}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--foreground-muted)" }}>
                        {(att.fileSize / 1024).toFixed(0)} KB
                        {att.notes ? ` · ${att.notes}` : ""}
                      </div>
                    </div>
                    {att.accessible && att.fileUrl ? (
                      <a
                        href={att.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          padding: "0.4rem 0.75rem", borderRadius: "0.375rem",
                          background: "#10b981", color: "#fff", fontSize: "0.72rem",
                          fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap",
                        }}
                      >
                        ⬇️ הורד
                      </a>
                    ) : (
                      <span style={{
                        display: "inline-flex", alignItems: "center", padding: "0.4rem 0.75rem",
                        borderRadius: "0.375rem", background: "rgba(239,68,68,0.1)",
                        color: "#ef4444", fontSize: "0.72rem", fontWeight: 600,
                      }}>
                        לא זמין
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {emailPreview.inaccessibleCount > 0 && (
                <div style={{
                  marginTop: "0.75rem", padding: "0.75rem", borderRadius: "0.5rem",
                  background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)",
                  fontSize: "0.8rem", color: "#f59e0b",
                }}>
                  ⚠️ {emailPreview.inaccessibleCount} קבצים ללא קישור נגיש — ודא שהועלו כראוי
                </div>
              )}
            </div>

            {/* Total */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "0.75rem 1rem", borderRadius: "0.5rem",
              background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)",
              marginBottom: "1.5rem",
            }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>סה״כ</span>
              <span style={{ fontSize: "0.82rem", color: "var(--foreground-muted)" }}>
                {emailPreview.totalFiles} קבצים · {(emailPreview.totalSize / 1024).toFixed(0)} KB
              </span>
            </div>

            {/* Mock notice */}
            <div style={{
              padding: "0.75rem 1rem", borderRadius: "0.5rem", marginBottom: "1.25rem",
              background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.15)",
              fontSize: "0.78rem", color: "var(--foreground-muted)", lineHeight: 1.6,
            }}>
              💡 <strong>שים לב:</strong> כרגע השליחה מדומה — הקבצים סומנו כ&quot;נשלח&quot; ואתה יכול להוריד אותם ידנית.
              כשתגדיר שירות מייל (SendGrid/Resend), הקבצים יישלחו אוטומטית כקבצים מצורפים.
            </div>

            {/* Close button */}
            <button
              onClick={closePreview}
              style={{
                width: "100%", padding: "0.75rem", background: "var(--accent, #10b981)",
                color: "#000", border: "none", borderRadius: "0.5rem",
                fontWeight: "600", cursor: "pointer", fontSize: "0.9rem",
              }}
            >
              סגור
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
