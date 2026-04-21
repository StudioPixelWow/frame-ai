"use client";

import { useAccountantDocuments } from "@/lib/api/use-entity";
import { useState, useMemo, useRef } from "react";
import { useToast } from "@/components/ui/toast";

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
  const { data: allDocuments, create, refetch } = useAccountantDocuments();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [uploadingPeriod, setUploadingPeriod] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadForm, setUploadForm] = useState({ fileUrl: "", fileType: "invoice", notes: "", selectedFile: null as File | null });

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
      // Fallback for legacy documents without period field: match by createdAt date
      const docDate = new Date(doc?.createdAt || doc?.uploadDate);
      if (isNaN(docDate.getTime())) return false;
      const docYear = docDate.getFullYear();
      const docMonth = docDate.getMonth();

      return docYear === selectedYear && docMonth >= period.startMonth && docMonth <= period.endMonth;
    });
  };

  const getFileTypeLabel = (type: string): string => {
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
    if (file) {
      setUploadForm({ ...uploadForm, selectedFile: file, fileUrl: file.name });
    }
  };

  /**
   * Upload flow:
   * 1. POST /api/upload → get signed URL + publicUrl
   * 2. PUT file directly to Supabase Storage via signed URL
   * 3. POST /api/data/accountant-documents → create DB record with real publicUrl
   * 4. Refetch to update UI
   */
  const handleUpload = async (periodId: string) => {
    if (!uploadForm.selectedFile) {
      toast("אנא בחר קובץ", "error");
      return;
    }

    const file = uploadForm.selectedFile;
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // ── Step 1: Get signed upload URL from server ──
      console.log('[AccountantUpload] Step 1: Getting signed URL for', file.name);
      const signedRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: `accountant/${selectedYear}/${periodId}/${file.name}`,
          contentType: file.type || 'application/octet-stream',
          fileSize: file.size,
        }),
      });

      if (!signedRes.ok) {
        const err = await signedRes.json().catch(() => ({}));
        throw new Error(err.error || `Failed to get upload URL (${signedRes.status})`);
      }

      const { uploadUrl, publicUrl } = await signedRes.json();
      console.log('[AccountantUpload] Step 1 done — publicUrl:', publicUrl?.slice(0, 80));
      setUploadProgress(30);

      // ── Step 2: PUT file directly to Supabase Storage ──
      console.log('[AccountantUpload] Step 2: Uploading file to storage...', file.size, 'bytes');
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });

      if (!putRes.ok) {
        throw new Error(`File upload failed (${putRes.status})`);
      }
      console.log('[AccountantUpload] Step 2 done — file uploaded to storage');
      setUploadProgress(70);

      // ── Step 3: Create DB record with real file URL ──
      const period = PERIODS.find(p => p.id === periodId);
      const documentData = {
        period: periodId,
        periodLabel: `${period?.nameHebrew || ''} ${selectedYear}`,
        year: selectedYear,
        fileName: file.name,
        fileUrl: publicUrl,
        fileType: uploadForm.fileType as 'invoice' | 'receipt' | 'report' | 'tax' | 'other',
        notes: uploadForm.notes,
        sentToAccountant: false,
        sentAt: null,
        uploadDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      console.log('[AccountantUpload] Step 3: Creating DB record:', JSON.stringify(documentData).slice(0, 300));

      if (create) {
        const created = await create(documentData);
        console.log('[AccountantUpload] Step 3 done — DB record id:', created?.id, 'period:', created?.period, 'year:', created?.year);
      }
      setUploadProgress(90);

      // ── Step 4: Refetch to update the UI ──
      if (refetch) {
        await refetch();
      }
      setUploadProgress(100);

      toast("מסמך הועלה בהצלחה", "success");
      setUploadForm({ fileUrl: "", fileType: "invoice", notes: "", selectedFile: null });
      setUploadingPeriod(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      toast(`שגיאה בהעלאת המסמך: ${msg}`, "error");
      console.error("[AccountantUpload] ERROR:", msg);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleExportPeriod = (periodId: string) => {
    console.log("[Accountant Export] Generating PDF for period:", periodId, "year:", selectedYear);
    window.open(`/api/accounting/export-pdf?period=${periodId}&year=${selectedYear}`, "_blank");
    toast("PDF נפתח בלשונית חדשה — לחץ שמור כ-PDF להורדה", "success");
  };

  return (
    <div style={{ direction: "rtl", padding: "2rem" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: "0.5rem", color: "var(--foreground)" }}>
          מסמכי רואה חשבון
        </h1>
        <p style={{ color: "var(--foreground-muted)", fontSize: "0.95rem" }}>ניהול מסמכים דו-חודשי</p>
      </div>

      {/* Year Selector */}
      <div
        style={{
          marginBottom: "2rem",
          padding: "1.5rem",
          background: "var(--surface-raised)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        <label style={{ fontSize: "0.95rem", fontWeight: "600", color: "var(--foreground)" }}>
          בחר שנה:
        </label>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="form-select"
          style={{
            padding: "0.5rem 0.75rem",
            borderRadius: "0.5rem",
            border: "1px solid var(--border)",
            background: "var(--surface-raised)",
            color: "var(--foreground)",
            fontWeight: "600",
          }}
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>

      {/* Periods Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
          gap: "2rem",
        }}
      >
        {PERIODS.map((period) => {
          const docs = getDocumentsForPeriod(period.id);
          const isPeriodUploading = uploadingPeriod === period.id;

          return (
            <div
              key={period.id}
              style={{
                background: "var(--surface-raised)",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                padding: "1.5rem",
              }}
            >
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
                    <div
                      key={doc.id || idx}
                      style={{
                        padding: "0.75rem",
                        borderBottom: idx < docs.length - 1 ? "1px solid var(--border)" : "none",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: "0.9rem", fontWeight: "600", color: "var(--foreground)", marginBottom: "0.25rem" }}>
                          {doc.fileName || "מסמך ללא שם"}
                        </p>
                        <p style={{ fontSize: "0.8rem", color: "var(--foreground-muted)" }}>
                          {new Date(doc.createdAt || doc.uploadDate).toLocaleDateString("he-IL")}
                        </p>
                      </div>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.25rem 0.75rem",
                          borderRadius: "0.375rem",
                          fontSize: "0.8rem",
                          fontWeight: "600",
                          color: "#fff",
                          background: "#6b7280",
                          flexShrink: 0,
                        }}
                      >
                        {getFileTypeLabel(doc.fileType || "other")}
                      </span>
                      {doc.fileUrl && doc.fileUrl.startsWith("http") ? (
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "0.4rem 0.6rem",
                            borderRadius: "0.375rem",
                            border: "1px solid var(--border)",
                            background: "var(--surface)",
                            color: "var(--foreground)",
                            cursor: "pointer",
                            fontSize: "0.8rem",
                            flexShrink: 0,
                            textDecoration: "none",
                          }}
                          title="הורד"
                        >
                          ⬇️
                        </a>
                      ) : (
                        <button
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "0.4rem 0.6rem",
                            borderRadius: "0.375rem",
                            border: "1px solid var(--border)",
                            background: "var(--surface)",
                            color: "var(--foreground-muted)",
                            cursor: "not-allowed",
                            fontSize: "0.8rem",
                            flexShrink: 0,
                            opacity: 0.5,
                          }}
                          title="לא זמין"
                          disabled
                        >
                          ⬇️
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    padding: "1rem",
                    textAlign: "center",
                    background: "var(--surface-raised)",
                    borderRadius: "0.5rem",
                    marginBottom: "1.5rem",
                    color: "var(--foreground-muted)",
                  }}
                >
                  <p>לא הועלו מסמכים לתקופה זו</p>
                </div>
              )}

              {/* Upload Section */}
              {isPeriodUploading ? (
                <div
                  style={{
                    padding: "1.5rem",
                    border: "1px solid var(--border)",
                    borderRadius: "0.5rem",
                    marginBottom: "1rem",
                    background: "var(--surface-raised)",
                  }}
                >
                  <h4 style={{ fontSize: "0.95rem", fontWeight: "600", marginBottom: "1rem", color: "var(--foreground)" }}>
                    העלאת מסמך חדש
                  </h4>

                  <div style={{ marginBottom: "1rem" }}>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", marginBottom: "0.5rem", color: "var(--foreground)" }}>
                      בחר קובץ
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileSelect}
                      disabled={isUploading}
                      className="form-input"
                      style={{
                        width: "100%",
                        padding: "0.5rem 0.75rem",
                        borderRadius: "0.5rem",
                        border: "1px solid var(--border)",
                        background: "var(--surface-raised)",
                        color: "var(--foreground)",
                        fontSize: "0.9rem",
                      }}
                    />
                    {uploadForm.selectedFile && (
                      <p style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", marginTop: "0.5rem" }}>
                        {uploadForm.selectedFile.name} ({(uploadForm.selectedFile.size / 1024).toFixed(0)} KB)
                      </p>
                    )}
                  </div>

                  <div style={{ marginBottom: "1rem" }}>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", marginBottom: "0.5rem", color: "var(--foreground)" }}>
                      סוג קובץ
                    </label>
                    <select
                      value={uploadForm.fileType}
                      onChange={(e) => setUploadForm({ ...uploadForm, fileType: e.target.value })}
                      disabled={isUploading}
                      className="form-select"
                      style={{
                        width: "100%",
                        padding: "0.5rem 0.75rem",
                        borderRadius: "0.5rem",
                        border: "1px solid var(--border)",
                        background: "var(--surface-raised)",
                        color: "var(--foreground)",
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
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", marginBottom: "0.5rem", color: "var(--foreground)" }}>
                      הערות
                    </label>
                    <textarea
                      placeholder="הערות אופציונליות..."
                      value={uploadForm.notes}
                      onChange={(e) => setUploadForm({ ...uploadForm, notes: e.target.value })}
                      disabled={isUploading}
                      className="form-input"
                      style={{
                        width: "100%",
                        padding: "0.5rem 0.75rem",
                        borderRadius: "0.5rem",
                        border: "1px solid var(--border)",
                        background: "var(--surface-raised)",
                        color: "var(--foreground)",
                        fontSize: "0.9rem",
                        minHeight: "80px",
                      }}
                    />
                  </div>

                  {/* Upload progress bar */}
                  {isUploading && (
                    <div style={{ marginBottom: "1rem" }}>
                      <div style={{
                        height: "0.5rem",
                        background: "var(--border)",
                        borderRadius: "0.25rem",
                        overflow: "hidden",
                      }}>
                        <div style={{
                          height: "100%",
                          width: `${uploadProgress}%`,
                          background: "#10b981",
                          transition: "width 0.3s ease",
                          borderRadius: "0.25rem",
                        }} />
                      </div>
                      <p style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", marginTop: "0.25rem", textAlign: "center" }}>
                        {uploadProgress < 30 ? "מקבל קישור להעלאה..." :
                         uploadProgress < 70 ? "מעלה קובץ..." :
                         uploadProgress < 90 ? "שומר מסמך..." : "סיום..."}
                      </p>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    <button
                      onClick={() => handleUpload(period.id)}
                      disabled={isUploading || !uploadForm.selectedFile}
                      className="mod-btn-primary"
                      style={{
                        padding: "0.5rem 1rem",
                        background: isUploading ? "#6b7280" : "var(--accent)",
                        color: "#000",
                        border: "none",
                        borderRadius: "0.5rem",
                        fontWeight: "600",
                        cursor: isUploading ? "not-allowed" : "pointer",
                        opacity: isUploading || !uploadForm.selectedFile ? 0.6 : 1,
                      }}
                    >
                      {isUploading ? "מעלה..." : "העלאה"}
                    </button>
                    <button
                      onClick={() => setUploadingPeriod(null)}
                      disabled={isUploading}
                      className="mod-btn-ghost"
                      style={{
                        padding: "0.5rem 1rem",
                        background: "transparent",
                        color: "var(--foreground)",
                        border: "1px solid var(--border)",
                        borderRadius: "0.5rem",
                        fontWeight: "600",
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
                  className="mod-btn-ghost"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    background: "transparent",
                    color: "var(--accent)",
                    border: "1px dashed var(--border)",
                    borderRadius: "0.5rem",
                    fontWeight: "600",
                    cursor: "pointer",
                    marginBottom: "1rem",
                  }}
                >
                  + הוסף מסמך
                </button>
              )}

              {/* Export Section */}
              <button
                onClick={() => handleExportPeriod(period.id)}
                className="mod-btn-primary"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  background: "#10b981",
                  color: "#fff",
                  border: "none",
                  borderRadius: "0.5rem",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                📧 ייצא למייל
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
