"use client";

import { useState, useMemo, useCallback } from "react";
import type { Client } from "@/lib/db/schema";
import {
  useBrandAssets,
  useBrandStyleProfiles,
  useCreativeFeedback,
  useBrandAnalysisJobs,
} from "@/lib/api/use-entity";

// ─── Types (mirrored from schema) ────────────────────────────────────────────

type BrandAssetType =
  | "logo"
  | "brand_guideline"
  | "approved_ad"
  | "rejected_ad"
  | "social_post"
  | "story"
  | "banner"
  | "website_screenshot"
  | "inspiration"
  | "competitor"
  | "photo"
  | "campaign_visual"
  | "other";

type CreativeFeedbackType =
  | "liked"
  | "disliked"
  | "approved"
  | "rejected"
  | "more_luxury"
  | "less_luxury"
  | "more_modern"
  | "less_modern"
  | "more_minimal"
  | "less_minimal"
  | "more_sales"
  | "less_sales"
  | "less_ai"
  | "more_premium"
  | "too_busy"
  | "too_empty"
  | "wrong_colors"
  | "wrong_font"
  | "wrong_style"
  | "save_as_client_style";

// ─── Constants ────────────────────────────────────────────────────────────────

const ASSET_TYPE_LABELS: Record<BrandAssetType, string> = {
  logo: "לוגו",
  brand_guideline: "מדריך מותג",
  approved_ad: "מודעה מאושרת",
  rejected_ad: "מודעה נדחית",
  social_post: "פוסט סושיאל",
  story: "סטורי",
  banner: "באנר",
  website_screenshot: "צילום אתר",
  inspiration: "השראה",
  competitor: "מתחרה",
  photo: "תמונה",
  campaign_visual: "ויז'ואל קמפיין",
  other: "אחר",
};

const ASSET_TYPE_OPTIONS: BrandAssetType[] = [
  "logo",
  "brand_guideline",
  "approved_ad",
  "rejected_ad",
  "social_post",
  "story",
  "banner",
  "website_screenshot",
  "inspiration",
  "competitor",
  "photo",
  "campaign_visual",
  "other",
];

const FEEDBACK_TYPE_LABELS: Record<CreativeFeedbackType, string> = {
  liked: "👍 אהבתי",
  disliked: "👎 לא אהבתי",
  approved: "✅ מאושר",
  rejected: "❌ נדחה",
  more_luxury: "✨ יותר יוקרה",
  less_luxury: "📉 פחות יוקרה",
  more_modern: "🔮 יותר מודרני",
  less_modern: "🏛️ פחות מודרני",
  more_minimal: "🌿 יותר מינימלי",
  less_minimal: "🎨 פחות מינימלי",
  more_sales: "📣 יותר מכירתי",
  less_sales: "🤫 פחות מכירתי",
  less_ai: "👤 פחות AI",
  more_premium: "💎 יותר פרמיום",
  too_busy: "😵 עמוס מדי",
  too_empty: "🌑 ריק מדי",
  wrong_colors: "🎨 צבעים לא מתאימים",
  wrong_font: "🔤 פונט לא מתאים",
  wrong_style: "🖼️ סגנון לא מתאים",
  save_as_client_style: "💾 שמור כסגנון לקוח",
};

const SECTIONS = [
  { id: "overview", label: "סקירה" },
  { id: "assets", label: "ספריית נכסים" },
  { id: "upload", label: "העלאת נכס" },
  { id: "analysis", label: "ניתוח מותג AI" },
  { id: "dna", label: "פרופיל Brand DNA" },
  { id: "feedback", label: "משוב קריאייטיב" },
  { id: "generator", label: "מחולל עתידי" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

// ─── Utilities ────────────────────────────────────────────────────────────────

function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("he-IL");
}

function isImageMime(mime: string): boolean {
  return mime?.startsWith("image/");
}

function fileSizeLabel(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 4,
          fontSize: 13,
          color: "var(--foreground-muted)",
        }}
      >
        <span>{label}</span>
        <span style={{ color: "var(--accent)", fontWeight: 600 }}>{pct}</span>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 4,
          background: "var(--border)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            borderRadius: 4,
            background:
              pct > 70
                ? "var(--accent)"
                : pct > 40
                ? "var(--neon-yellow)"
                : "var(--foreground-muted)",
            transition: "width 0.5s ease",
          }}
        />
      </div>
    </div>
  );
}

function ColorChip({ color }: { color: string }) {
  return (
    <span
      title={color}
      style={{
        display: "inline-block",
        width: 24,
        height: 24,
        borderRadius: 6,
        background: color,
        border: "2px solid var(--border)",
        marginRight: 4,
        marginBottom: 4,
        cursor: "default",
        verticalAlign: "middle",
        boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
      }}
    />
  );
}

function TagChip({ label }: { label: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 20,
        background: "var(--accent-muted)",
        color: "var(--accent-text)",
        fontSize: 12,
        fontWeight: 500,
        marginRight: 6,
        marginBottom: 6,
        border: "1px solid var(--accent-border)",
      }}
    >
      {label}
    </span>
  );
}

function Badge({
  children,
  color,
}: {
  children: React.ReactNode;
  color: string;
}) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600,
        background: `${color}22`,
        color: color,
        border: `1px solid ${color}44`,
        marginRight: 4,
      }}
    >
      {children}
    </span>
  );
}

function SectionCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: "24px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontSize: 16,
        fontWeight: 700,
        color: "var(--foreground)",
        marginBottom: 16,
        marginTop: 0,
      }}
    >
      {children}
    </h3>
  );
}

function Btn({
  onClick,
  disabled,
  variant = "default",
  children,
  style,
}: {
  onClick?: () => void;
  disabled?: boolean;
  variant?: "default" | "accent" | "ghost" | "danger" | "yellow";
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const base: React.CSSProperties = {
    padding: "8px 18px",
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 13,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    border: "1px solid transparent",
    transition: "background 0.15s, opacity 0.15s",
    ...style,
  };
  const variants: Record<string, React.CSSProperties> = {
    default: {
      background: "var(--surface)",
      color: "var(--foreground)",
      border: "1px solid var(--border)",
    },
    accent: {
      background: "var(--accent)",
      color: "#000",
      border: "1px solid var(--accent)",
    },
    ghost: {
      background: "transparent",
      color: "var(--foreground-muted)",
      border: "1px solid var(--border)",
    },
    danger: {
      background: "#ef444420",
      color: "#ef4444",
      border: "1px solid #ef444440",
    },
    yellow: {
      background: "var(--neon-yellow)",
      color: "#000",
      border: "none",
    },
  };
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{ ...base, ...variants[variant] }}
    >
      {children}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface TabCreativeStudioProps {
  client: Client;
}

export default function TabCreativeStudio({ client }: TabCreativeStudioProps) {
  const [activeSection, setActiveSection] = useState<SectionId>("overview");

  // ── Data hooks ──────────────────────────────────────────────────────────────
  const { data: allAssets, loading: assetsLoading, refetch: refetchAssets, update: updateAsset, remove: removeAsset } = useBrandAssets();
  const { data: allProfiles, loading: profilesLoading, update: updateProfile } = useBrandStyleProfiles();
  const { data: allFeedback, loading: feedbackLoading, refetch: refetchFeedback } = useCreativeFeedback();
  const { data: allJobs, loading: jobsLoading, refetch: refetchJobs } = useBrandAnalysisJobs();

  // ── Filtered data ───────────────────────────────────────────────────────────
  const assets = useMemo(() => allAssets.filter((a) => a.clientId === client.id), [allAssets, client.id]);
  const profile = useMemo(() => allProfiles.find((p) => p.clientId === client.id) ?? null, [allProfiles, client.id]);
  const feedback = useMemo(() => allFeedback.filter((f) => f.clientId === client.id), [allFeedback, client.id]);
  const jobs = useMemo(() => allJobs.filter((j) => j.clientId === client.id), [allJobs, client.id]);

  const approvedAssets = useMemo(() => assets.filter((a) => a.isApprovedReference), [assets]);
  const rejectedAssets = useMemo(() => assets.filter((a) => a.isRejectedReference), [assets]);
  const lastJob = useMemo(() => jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null, [jobs]);

  // ─── Assets Library state ────────────────────────────────────────────────
  const [assetTypeFilter, setAssetTypeFilter] = useState<BrandAssetType | "all">("all");
  const [assetStatusFilter, setAssetStatusFilter] = useState<"all" | "approved" | "rejected" | "competitor">("all");

  const filteredAssets = useMemo(() => {
    return assets.filter((a) => {
      const typeOk = assetTypeFilter === "all" || a.assetType === assetTypeFilter;
      const statusOk =
        assetStatusFilter === "all" ||
        (assetStatusFilter === "approved" && a.isApprovedReference) ||
        (assetStatusFilter === "rejected" && a.isRejectedReference) ||
        (assetStatusFilter === "competitor" && a.isCompetitorReference);
      return typeOk && statusOk;
    });
  }, [assets, assetTypeFilter, assetStatusFilter]);

  // ─── Upload state ─────────────────────────────────────────────────────────
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadType, setUploadType] = useState<BrandAssetType>("other");
  const [uploadTags, setUploadTags] = useState("");
  const [uploadApproved, setUploadApproved] = useState(false);
  const [uploadRejected, setUploadRejected] = useState(false);
  const [uploadCompetitor, setUploadCompetitor] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const handleUpload = useCallback(async () => {
    if (!uploadFile) return;
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(false);
    try {
      // 1. Get signed URL
      const urlRes = await fetch("/api/creative-studio/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          fileName: uploadFile.name,
          contentType: uploadFile.type,
          fileSize: uploadFile.size,
          assetType: uploadType,
        }),
      });
      if (!urlRes.ok) throw new Error("שגיאה בקבלת URL להעלאה");
      const { uploadUrl, publicUrl } = await urlRes.json();

      // 2. Upload to storage
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": uploadFile.type },
        body: uploadFile,
      });
      if (!putRes.ok) throw new Error("שגיאה בהעלאת הקובץ לאחסון");

      // 3. Create DB record
      const createRes = await fetch("/api/creative-studio/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          fileUrl: publicUrl,
          fileName: uploadFile.name,
          fileMimeType: uploadFile.type,
          fileSize: uploadFile.size,
          assetType: uploadType,
          title: uploadTitle || uploadFile.name,
          description: uploadDesc,
          tags: uploadTags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          isApprovedReference: uploadApproved,
          isRejectedReference: uploadRejected,
          isCompetitorReference: uploadCompetitor,
        }),
      });
      if (!createRes.ok) throw new Error("שגיאה ביצירת רשומת הנכס");

      setUploadSuccess(true);
      setUploadFile(null);
      setUploadTitle("");
      setUploadDesc("");
      setUploadTags("");
      setUploadApproved(false);
      setUploadRejected(false);
      setUploadCompetitor(false);
      await refetchAssets();
    } catch (err: any) {
      setUploadError(err.message ?? "שגיאה לא ידועה");
    } finally {
      setUploading(false);
    }
  }, [uploadFile, uploadTitle, uploadDesc, uploadType, uploadTags, uploadApproved, uploadRejected, uploadCompetitor, client.id, refetchAssets]);

  // ─── Analysis state ───────────────────────────────────────────────────────
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const handleAnalyze = useCallback(async () => {
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const res = await fetch("/api/creative-studio/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "שגיאה בניתוח");
      }
      await refetchJobs();
    } catch (err: any) {
      setAnalyzeError(err.message ?? "שגיאה לא ידועה");
    } finally {
      setAnalyzing(false);
    }
  }, [client.id, refetchJobs]);

  // ─── DNA Profile edit state ───────────────────────────────────────────────
  const [dnaEdits, setDnaEdits] = useState<Record<string, any>>({});
  const [dnaSaving, setDnaSaving] = useState(false);
  const [dnaSaveError, setDnaSaveError] = useState<string | null>(null);
  const [dnaSaveOk, setDnaSaveOk] = useState(false);

  const handleDnaSave = useCallback(async () => {
    if (!profile) return;
    setDnaSaving(true);
    setDnaSaveError(null);
    setDnaSaveOk(false);
    try {
      await updateProfile(profile.id, dnaEdits);
      setDnaSaveOk(true);
      setDnaEdits({});
    } catch (err: any) {
      setDnaSaveError(err.message ?? "שגיאה בשמירה");
    } finally {
      setDnaSaving(false);
    }
  }, [profile, dnaEdits, updateProfile]);

  function dnaVal<T>(field: string, fallback: T): T {
    return field in dnaEdits ? (dnaEdits[field] as T) : (profile as any)?.[field] ?? fallback;
  }

  // ─── Feedback state ───────────────────────────────────────────────────────
  const [fbType, setFbType] = useState<CreativeFeedbackType>("liked");
  const [fbNote, setFbNote] = useState("");
  const [fbSubmitting, setFbSubmitting] = useState(false);
  const [fbError, setFbError] = useState<string | null>(null);
  const [fbOk, setFbOk] = useState(false);

  const handleFeedbackSubmit = useCallback(async () => {
    setFbSubmitting(true);
    setFbError(null);
    setFbOk(false);
    try {
      const res = await fetch("/api/creative-studio/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          feedbackType: fbType,
          feedbackNote: fbNote,
          feedbackSource: "manual",
        }),
      });
      if (!res.ok) throw new Error("שגיאה בשמירת משוב");
      setFbNote("");
      setFbOk(true);
      await refetchFeedback();
    } catch (err: any) {
      setFbError(err.message ?? "שגיאה לא ידועה");
    } finally {
      setFbSubmitting(false);
    }
  }, [client.id, fbType, fbNote, refetchFeedback]);

  // ── Styles ──────────────────────────────────────────────────────────────────
  const containerStyle: React.CSSProperties = {
    direction: "rtl",
    fontFamily: "inherit",
    minHeight: 600,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--foreground)",
    fontSize: 14,
    boxSizing: "border-box",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "var(--foreground-muted)",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER SECTIONS
  // ─────────────────────────────────────────────────────────────────────────────

  // ── 1. Overview ──────────────────────────────────────────────────────────────
  const renderOverview = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Quick stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
        {[
          { label: "סה״כ נכסים", value: assetsLoading ? "…" : assets.length, color: "var(--accent)" },
          { label: "דוגמאות מאושרות", value: assetsLoading ? "…" : approvedAssets.length, color: "#22c55e" },
          { label: "דוגמאות נדחות", value: assetsLoading ? "…" : rejectedAssets.length, color: "#ef4444" },
          {
            label: "סטטוס פרופיל",
            value: profilesLoading ? "…" : profile ? { draft: "טיוטה", active: "פעיל", locked: "נעול" }[profile.profileStatus ?? "draft"] ?? "קיים" : "לא נוצר",
            color: profile ? "var(--neon-yellow)" : "var(--foreground-muted)",
          },
        ].map((stat) => (
          <SectionCard
            key={stat.label}
            style={{ textAlign: "center", padding: "20px 16px" }}
          >
            <div
              style={{ fontSize: 28, fontWeight: 800, color: stat.color, marginBottom: 6 }}
            >
              {stat.value}
            </div>
            <div style={{ fontSize: 12, color: "var(--foreground-muted)", fontWeight: 600 }}>
              {stat.label}
            </div>
          </SectionCard>
        ))}
      </div>

      {/* Last analysis */}
      {lastJob && (
        <SectionCard>
          <SectionTitle>ניתוח אחרון</SectionTitle>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div>
              <span style={labelStyle}>סטטוס</span>
              <Badge
                color={
                  lastJob.status === "completed"
                    ? "#22c55e"
                    : lastJob.status === "failed"
                    ? "#ef4444"
                    : lastJob.status === "processing"
                    ? "var(--accent)"
                    : "var(--foreground-muted)"
                }
              >
                {{ pending: "ממתין", processing: "מעבד", completed: "הושלם", failed: "נכשל" }[lastJob.status] ?? lastJob.status}
              </Badge>
            </div>
            <div>
              <span style={labelStyle}>סוג</span>
              <span style={{ color: "var(--foreground)", fontSize: 13 }}>
                {{ brand_dna_analysis: "Brand DNA", single_asset_analysis: "נכס בודד", comparative_analysis: "השוואתי" }[lastJob.jobType] ?? lastJob.jobType}
              </span>
            </div>
            <div>
              <span style={labelStyle}>נוצר</span>
              <span style={{ color: "var(--foreground-muted)", fontSize: 13 }}>{fmtDate(lastJob.createdAt)}</span>
            </div>
            {lastJob.finishedAt && (
              <div>
                <span style={labelStyle}>הסתיים</span>
                <span style={{ color: "var(--foreground-muted)", fontSize: 13 }}>{fmtDate(lastJob.finishedAt)}</span>
              </div>
            )}
          </div>
          {lastJob.errorMessage && (
            <div style={{ marginTop: 12, color: "#ef4444", fontSize: 13 }}>
              שגיאה: {lastJob.errorMessage}
            </div>
          )}
        </SectionCard>
      )}

      {/* Recent assets */}
      <SectionCard>
        <SectionTitle>נכסים אחרונים</SectionTitle>
        {assetsLoading ? (
          <div style={{ color: "var(--foreground-muted)", textAlign: "center", padding: 32 }}>טוען…</div>
        ) : assets.length === 0 ? (
          <div style={{ color: "var(--foreground-muted)", textAlign: "center", padding: 32, fontSize: 14 }}>
            אין נכסים עדיין. העלה את הנכס הראשון של הלקוח.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[...assets]
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .slice(0, 5)
              .map((asset) => (
                <div
                  key={asset.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "10px 14px",
                    background: "var(--surface)",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                  }}
                >
                  {/* Thumbnail or icon */}
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 8,
                      background: "var(--border)",
                      overflow: "hidden",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 20,
                    }}
                  >
                    {asset.thumbnailUrl || isImageMime(asset.fileMimeType ?? "") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={asset.thumbnailUrl || asset.fileUrl}
                        alt={asset.title}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      "📄"
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 13,
                        color: "var(--foreground)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {asset.title || asset.fileName}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--foreground-muted)", marginTop: 2 }}>
                      {ASSET_TYPE_LABELS[asset.assetType as BrandAssetType] ?? asset.assetType} · {fmtDate(asset.createdAt)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {asset.isApprovedReference && <Badge color="#22c55e">מאושר</Badge>}
                    {asset.isRejectedReference && <Badge color="#ef4444">נדחה</Badge>}
                    {asset.isCompetitorReference && <Badge color="#f59e0b">מתחרה</Badge>}
                  </div>
                </div>
              ))}
          </div>
        )}
      </SectionCard>

      {/* Quick actions */}
      <div style={{ display: "flex", gap: 12 }}>
        <Btn variant="accent" onClick={() => setActiveSection("upload")}>
          + העלה נכס
        </Btn>
        <Btn variant="default" onClick={() => setActiveSection("analysis")}>
          🤖 נתח מותג
        </Btn>
        <Btn variant="ghost" onClick={() => setActiveSection("dna")}>
          🧬 פרופיל DNA
        </Btn>
      </div>
    </div>
  );

  // ── 2. Assets Library ────────────────────────────────────────────────────────
  const renderAssets = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Filter bar */}
      <SectionCard style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <label style={labelStyle}>סוג נכס</label>
            <select
              value={assetTypeFilter}
              onChange={(e) => setAssetTypeFilter(e.target.value as any)}
              style={{ ...inputStyle, width: "auto", paddingLeft: 8, paddingRight: 8 }}
            >
              <option value="all">כל הסוגים</option>
              {ASSET_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {ASSET_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>סטטוס</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["all", "approved", "rejected", "competitor"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setAssetStatusFilter(s)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    border: "1px solid",
                    borderColor: assetStatusFilter === s ? "var(--accent)" : "var(--border)",
                    background: assetStatusFilter === s ? "var(--accent-muted)" : "transparent",
                    color: assetStatusFilter === s ? "var(--accent)" : "var(--foreground-muted)",
                  }}
                >
                  {{ all: "הכל", approved: "מאושרים", rejected: "נדחים", competitor: "מתחרים" }[s]}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginRight: "auto", color: "var(--foreground-muted)", fontSize: 13 }}>
            {filteredAssets.length} נכסים
          </div>
        </div>
      </SectionCard>

      {/* Grid */}
      {assetsLoading ? (
        <div style={{ textAlign: "center", color: "var(--foreground-muted)", padding: 48 }}>טוען נכסים…</div>
      ) : filteredAssets.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            color: "var(--foreground-muted)",
            padding: 64,
            fontSize: 14,
          }}
        >
          לא נמצאו נכסים תואמים לסינון
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          {filteredAssets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onToggleApproved={async () => {
                await updateAsset(asset.id, { isApprovedReference: !asset.isApprovedReference });
                await refetchAssets();
              }}
              onToggleRejected={async () => {
                await updateAsset(asset.id, { isRejectedReference: !asset.isRejectedReference });
                await refetchAssets();
              }}
              onToggleCompetitor={async () => {
                await updateAsset(asset.id, { isCompetitorReference: !asset.isCompetitorReference });
                await refetchAssets();
              }}
              onDelete={async () => {
                if (!confirm(`למחוק את "${asset.title || asset.fileName}"?`)) return;
                await removeAsset(asset.id);
                await refetchAssets();
              }}
            />
          ))}
        </div>
      )}
    </div>
  );

  // ── 3. Upload ────────────────────────────────────────────────────────────────
  const renderUpload = () => (
    <div style={{ maxWidth: 600 }}>
      <SectionCard>
        <SectionTitle>העלאת נכס מותג</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* File input */}
          <div>
            <label style={labelStyle}>קובץ</label>
            <div
              style={{
                border: "2px dashed var(--border)",
                borderRadius: 10,
                padding: "28px 20px",
                textAlign: "center",
                cursor: "pointer",
                position: "relative",
                transition: "border-color 0.2s",
              }}
            >
              <input
                type="file"
                accept="image/*,.pdf,.doc,.docx,.psd,.ai,.eps,.svg"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: 0,
                  cursor: "pointer",
                  width: "100%",
                  height: "100%",
                }}
              />
              {uploadFile ? (
                <div>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>
                    {isImageMime(uploadFile.type) ? "🖼️" : "📄"}
                  </div>
                  <div style={{ fontWeight: 600, color: "var(--foreground)", fontSize: 14 }}>
                    {uploadFile.name}
                  </div>
                  <div style={{ color: "var(--foreground-muted)", fontSize: 12, marginTop: 4 }}>
                    {fileSizeLabel(uploadFile.size)}
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
                  <div style={{ color: "var(--foreground-muted)", fontSize: 14 }}>
                    גרור קובץ לכאן או לחץ לבחירה
                  </div>
                  <div style={{ color: "var(--foreground-subtle)", fontSize: 12, marginTop: 4 }}>
                    תמונות, PDF, מסמכים, קבצי עיצוב
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Title */}
          <div>
            <label style={labelStyle}>כותרת</label>
            <input
              type="text"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="שם הנכס (אופציונלי)"
              style={inputStyle}
            />
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>תיאור</label>
            <textarea
              value={uploadDesc}
              onChange={(e) => setUploadDesc(e.target.value)}
              placeholder="תיאור קצר של הנכס"
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          {/* Type */}
          <div>
            <label style={labelStyle}>סוג נכס</label>
            <select
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value as BrandAssetType)}
              style={inputStyle}
            >
              {ASSET_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {ASSET_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label style={labelStyle}>תגיות (מופרדות בפסיק)</label>
            <input
              type="text"
              value={uploadTags}
              onChange={(e) => setUploadTags(e.target.value)}
              placeholder="לדוגמה: ירוק, קיץ 2024, קמפיין"
              style={inputStyle}
            />
          </div>

          {/* Checkboxes */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "דוגמה מאושרת — נכס זה מאושר לשימוש כהשראה", state: uploadApproved, setState: setUploadApproved, color: "#22c55e" },
              { label: "דוגמה נדחית — נכס זה מסמל סגנון שיש להימנע ממנו", state: uploadRejected, setState: setUploadRejected, color: "#ef4444" },
              { label: "נכס מתחרה — זהו נכס של חברה מתחרה", state: uploadCompetitor, setState: setUploadCompetitor, color: "#f59e0b" },
            ].map((cb) => (
              <label
                key={cb.label}
                style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
              >
                <input
                  type="checkbox"
                  checked={cb.state}
                  onChange={(e) => cb.setState(e.target.checked)}
                  style={{ accentColor: cb.color, width: 16, height: 16 }}
                />
                <span style={{ fontSize: 13, color: "var(--foreground-muted)" }}>{cb.label}</span>
              </label>
            ))}
          </div>

          {/* Status messages */}
          {uploadError && (
            <div style={{ color: "#ef4444", fontSize: 13, padding: "10px 14px", background: "#ef444420", borderRadius: 8, border: "1px solid #ef444440" }}>
              ❌ {uploadError}
            </div>
          )}
          {uploadSuccess && (
            <div style={{ color: "#22c55e", fontSize: 13, padding: "10px 14px", background: "#22c55e20", borderRadius: 8, border: "1px solid #22c55e40" }}>
              ✅ הנכס הועלה בהצלחה!
            </div>
          )}

          {/* Upload button */}
          <Btn
            variant="accent"
            onClick={handleUpload}
            disabled={!uploadFile || uploading}
            style={{ alignSelf: "flex-start", padding: "10px 28px" }}
          >
            {uploading ? "מעלה…" : "העלה נכס"}
          </Btn>
        </div>
      </SectionCard>
    </div>
  );

  // ── 4. AI Analysis ───────────────────────────────────────────────────────────
  const renderAnalysis = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SectionCard>
        <SectionTitle>ניתוח סגנון מותג AI</SectionTitle>
        <p style={{ color: "var(--foreground-muted)", fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
          הניתוח סורק את כל נכסי המותג של הלקוח ובונה פרופיל Brand DNA אוטומטי. אנליזה זו
          לוקחת עד כ-60 שניות.
        </p>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Btn
            variant="accent"
            onClick={handleAnalyze}
            disabled={analyzing || assets.length === 0}
            style={{ padding: "10px 28px" }}
          >
            {analyzing ? "🤖 מנתח…" : "🤖 נתח סגנון מותג"}
          </Btn>
          {assets.length === 0 && (
            <span style={{ color: "var(--foreground-muted)", fontSize: 13 }}>
              יש להעלות נכסים לפני הניתוח
            </span>
          )}
        </div>
        {analyzeError && (
          <div style={{ marginTop: 16, color: "#ef4444", fontSize: 13, padding: "10px 14px", background: "#ef444420", borderRadius: 8, border: "1px solid #ef444440" }}>
            ❌ {analyzeError}
          </div>
        )}
      </SectionCard>

      {/* Jobs history */}
      <SectionCard>
        <SectionTitle>היסטוריית ניתוחים</SectionTitle>
        {jobsLoading ? (
          <div style={{ color: "var(--foreground-muted)", textAlign: "center", padding: 32 }}>טוען…</div>
        ) : jobs.length === 0 ? (
          <div style={{ color: "var(--foreground-muted)", textAlign: "center", padding: 32, fontSize: 14 }}>
            טרם בוצע ניתוח מותג
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[...jobs]
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((job) => (
                <div
                  key={job.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "12px 16px",
                    background: "var(--surface)",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                  }}
                >
                  <div style={{ fontSize: 20 }}>
                    {{ pending: "⏳", processing: "⚙️", completed: "✅", failed: "❌" }[job.status] ?? "❓"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--foreground)" }}>
                      {{ brand_dna_analysis: "Brand DNA Analysis", single_asset_analysis: "ניתוח נכס בודד", comparative_analysis: "ניתוח השוואתי" }[job.jobType] ?? job.jobType}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--foreground-muted)", marginTop: 2 }}>
                      {fmtDate(job.createdAt)}
                      {job.finishedAt && ` · הסתיים ${fmtDate(job.finishedAt)}`}
                    </div>
                    {job.errorMessage && (
                      <div style={{ color: "#ef4444", fontSize: 11, marginTop: 4 }}>{job.errorMessage}</div>
                    )}
                  </div>
                  <Badge
                    color={
                      job.status === "completed"
                        ? "#22c55e"
                        : job.status === "failed"
                        ? "#ef4444"
                        : job.status === "processing"
                        ? "var(--accent)"
                        : "var(--foreground-muted)"
                    }
                  >
                    {{ pending: "ממתין", processing: "מעבד", completed: "הושלם", failed: "נכשל" }[job.status] ?? job.status}
                  </Badge>
                </div>
              ))}
          </div>
        )}
      </SectionCard>

      {/* Latest results summary */}
      {profile && profile.lastAnalyzedAt && (
        <SectionCard>
          <SectionTitle>תוצאות הניתוח האחרון</SectionTitle>
          {profile.brandSummary && (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>סיכום מותג</label>
              <p style={{ color: "var(--foreground)", fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                {profile.brandSummary}
              </p>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {profile.primaryColors && (profile.primaryColors as string[]).length > 0 && (
              <div>
                <label style={labelStyle}>צבעים ראשיים שזוהו</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {(profile.primaryColors as string[]).map((c) => (
                    <ColorChip key={c} color={c} />
                  ))}
                </div>
              </div>
            )}
            {profile.visualPersonality && (
              <div>
                <label style={labelStyle}>אישיות ויזואלית</label>
                <p style={{ color: "var(--foreground)", fontSize: 13, margin: 0, lineHeight: 1.6 }}>
                  {profile.visualPersonality}
                </p>
              </div>
            )}
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: "var(--foreground-muted)" }}>
            נותח לאחרונה: {fmtDate(profile.lastAnalyzedAt)}
          </div>
        </SectionCard>
      )}
    </div>
  );

  // ── 5. Brand DNA Profile ─────────────────────────────────────────────────────
  const renderDNA = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {profilesLoading ? (
        <div style={{ textAlign: "center", color: "var(--foreground-muted)", padding: 48 }}>טוען…</div>
      ) : !profile ? (
        <SectionCard style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🧬</div>
          <div style={{ color: "var(--foreground-muted)", fontSize: 15 }}>
            פרופיל Brand DNA לא נוצר עדיין
          </div>
          <div style={{ color: "var(--foreground-subtle)", fontSize: 13, marginTop: 8 }}>
            הרץ ניתוח מותג AI כדי ליצור את הפרופיל אוטומטית
          </div>
          <div style={{ marginTop: 20 }}>
            <Btn variant="accent" onClick={() => setActiveSection("analysis")}>
              🤖 נתח מותג
            </Btn>
          </div>
        </SectionCard>
      ) : (
        <>
          {/* Scores */}
          <SectionCard>
            <SectionTitle>ציוני סגנון</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 32px" }}>
              <ScoreBar label="יוקרה" value={profile.luxuryScore ?? 0} />
              <ScoreBar label="מינימליזם" value={profile.minimalismScore ?? 0} />
              <ScoreBar label="מודרניות" value={profile.modernScore ?? 0} />
              <ScoreBar label="אגרסיביות מכירות" value={profile.salesAggressivenessScore ?? 0} />
              <ScoreBar label="צפיפות ויזואלית" value={profile.visualDensityScore ?? 0} />
              <ScoreBar label="תחושת AI" value={profile.aiGeneratedScore ?? 0} />
            </div>
            {profile.aiConfidenceScore > 0 && (
              <div style={{ marginTop: 12, fontSize: 12, color: "var(--foreground-muted)" }}>
                רמת ביטחון AI: <span style={{ color: "var(--accent)", fontWeight: 600 }}>{profile.aiConfidenceScore}%</span>
              </div>
            )}
          </SectionCard>

          {/* Text fields */}
          <SectionCard>
            <SectionTitle>תיאורי מותג</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { key: "brandSummary", label: "סיכום מותג", rows: 4 },
                { key: "visualPersonality", label: "אישיות ויזואלית", rows: 3 },
                { key: "copywritingTone", label: "טון קופירייטינג", rows: 3 },
                { key: "clientNotes", label: "הערות לקוח", rows: 3 },
                { key: "talNotes", label: "הערות פנימיות (Tal)", rows: 3 },
              ].map(({ key, label, rows }) => (
                <div key={key}>
                  <label style={labelStyle}>{label}</label>
                  <textarea
                    value={dnaVal<string>(key, "")}
                    onChange={(e) => setDnaEdits((prev) => ({ ...prev, [key]: e.target.value }))}
                    rows={rows}
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Colors */}
          <SectionCard>
            <SectionTitle>פלטות צבע</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
              {[
                { key: "primaryColors", label: "צבעים ראשיים" },
                { key: "secondaryColors", label: "צבעים משניים" },
                { key: "forbiddenColors", label: "צבעים אסורים" },
              ].map(({ key, label }) => {
                const colors = (profile as any)[key] as string[] ?? [];
                return (
                  <div key={key}>
                    <label style={labelStyle}>{label}</label>
                    {colors.length === 0 ? (
                      <span style={{ color: "var(--foreground-subtle)", fontSize: 12 }}>לא הוגדרו</span>
                    ) : (
                      <div style={{ display: "flex", flexWrap: "wrap" }}>
                        {colors.map((c) => (
                          <ColorChip key={c} color={c} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Rules */}
          <SectionCard>
            <SectionTitle>כללי מותג</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              {[
                { key: "brandRules", label: "✅ כללי DO — מה מותר", color: "#22c55e" },
                { key: "avoidRules", label: "❌ כללי DON'T — מה לא לעשות", color: "#ef4444" },
              ].map(({ key, label, color }) => {
                const rules = (profile as any)[key] as string[] ?? [];
                return (
                  <div key={key}>
                    <label style={{ ...labelStyle, color }}>{label}</label>
                    {rules.length === 0 ? (
                      <span style={{ color: "var(--foreground-subtle)", fontSize: 12 }}>לא הוגדרו כללים</span>
                    ) : (
                      <ul style={{ margin: 0, paddingRight: 18, color: "var(--foreground)", fontSize: 13, lineHeight: 2 }}>
                        {rules.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Save */}
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Btn
              variant="accent"
              onClick={handleDnaSave}
              disabled={dnaSaving || Object.keys(dnaEdits).length === 0}
              style={{ padding: "10px 28px" }}
            >
              {dnaSaving ? "שומר…" : "שמור שינויים"}
            </Btn>
            {Object.keys(dnaEdits).length > 0 && (
              <Btn variant="ghost" onClick={() => setDnaEdits({})}>
                בטל שינויים
              </Btn>
            )}
            {dnaSaveOk && <span style={{ color: "#22c55e", fontSize: 13 }}>✅ נשמר</span>}
            {dnaSaveError && <span style={{ color: "#ef4444", fontSize: 13 }}>❌ {dnaSaveError}</span>}
          </div>
        </>
      )}
    </div>
  );

  // ── 6. Creative Feedback ─────────────────────────────────────────────────────
  const renderFeedback = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Add feedback form */}
      <SectionCard>
        <SectionTitle>הוסף משוב</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Quick buttons */}
          <div>
            <label style={labelStyle}>בחר סוג משוב</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
              {(Object.entries(FEEDBACK_TYPE_LABELS) as [CreativeFeedbackType, string][]).map(([type, label]) => (
                <button
                  key={type}
                  onClick={() => setFbType(type)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    border: "1px solid",
                    borderColor: fbType === type ? "var(--accent)" : "var(--border)",
                    background: fbType === type ? "var(--accent-muted)" : "transparent",
                    color: fbType === type ? "var(--accent)" : "var(--foreground-muted)",
                    transition: "all 0.15s",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div>
            <label style={labelStyle}>הערה (אופציונלי)</label>
            <textarea
              value={fbNote}
              onChange={(e) => setFbNote(e.target.value)}
              placeholder="פרט את המשוב…"
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          {/* Submit */}
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Btn
              variant="accent"
              onClick={handleFeedbackSubmit}
              disabled={fbSubmitting}
              style={{ alignSelf: "flex-start" }}
            >
              {fbSubmitting ? "שולח…" : "שלח משוב"}
            </Btn>
            {fbOk && <span style={{ color: "#22c55e", fontSize: 13 }}>✅ המשוב נשמר</span>}
            {fbError && <span style={{ color: "#ef4444", fontSize: 13 }}>❌ {fbError}</span>}
          </div>
        </div>
      </SectionCard>

      {/* Feedback list */}
      <SectionCard>
        <SectionTitle>היסטוריית משוב</SectionTitle>
        {feedbackLoading ? (
          <div style={{ color: "var(--foreground-muted)", textAlign: "center", padding: 32 }}>טוען…</div>
        ) : feedback.length === 0 ? (
          <div style={{ color: "var(--foreground-muted)", textAlign: "center", padding: 32, fontSize: 14 }}>
            אין משוב קריאייטיב עדיין
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[...feedback]
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((fb) => (
                <div
                  key={fb.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 14,
                    padding: "12px 16px",
                    background: "var(--surface)",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                  }}
                >
                  <div style={{ fontSize: 20, flexShrink: 0, paddingTop: 2 }}>
                    {FEEDBACK_TYPE_LABELS[fb.feedbackType as CreativeFeedbackType]?.split(" ")[0] ?? "💬"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--foreground)" }}>
                      {FEEDBACK_TYPE_LABELS[fb.feedbackType as CreativeFeedbackType] ?? fb.feedbackType}
                    </div>
                    {fb.feedbackNote && (
                      <div style={{ color: "var(--foreground-muted)", fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>
                        {fb.feedbackNote}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "var(--foreground-subtle)", marginTop: 6 }}>
                      {fmtDate(fb.createdAt)} · {fb.feedbackSource === "manual" ? "ידני" : fb.feedbackSource === "client_portal" ? "פורטל לקוח" : "אוטומטי"}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </SectionCard>
    </div>
  );

  // ── 7. Future Generator ──────────────────────────────────────────────────────
  const renderGenerator = () => (
    <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
      <div
        style={{
          maxWidth: 520,
          width: "100%",
          borderRadius: 20,
          padding: "48px 40px",
          textAlign: "center",
          background:
            "linear-gradient(135deg, var(--surface-raised) 0%, rgba(0,181,254,0.06) 50%, rgba(240,255,2,0.04) 100%)",
          border: "1px solid var(--accent-border)",
          boxShadow: "0 8px 40px rgba(0,181,254,0.08)",
        }}
      >
        <div style={{ fontSize: 56, marginBottom: 20 }}>🚀</div>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: "var(--foreground)",
            margin: "0 0 12px",
          }}
        >
          מחולל קריאייטיב AI
        </h2>
        <p
          style={{
            color: "var(--foreground-muted)",
            fontSize: 15,
            lineHeight: 1.7,
            margin: "0 0 32px",
          }}
        >
          בקרוב: יצירת קריאייטיב אוטומטי מותאם ל-Brand DNA של הלקוח.
          <br />
          המחולל ישתמש בפרופיל הסגנון, בנכסי המותג ובמשוב הקיים כדי ליצור
          עיצובים מותאמים אישית.
        </p>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            alignItems: "center",
          }}
        >
          <Btn disabled variant="default" style={{ padding: "12px 36px", fontSize: 15, opacity: 0.5 }}>
            בקרוב…
          </Btn>
          <div
            style={{
              display: "flex",
              gap: 8,
              color: "var(--foreground-subtle)",
              fontSize: 12,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            {["פייסבוק", "אינסטגרם", "גוגל", "באנרים", "סטורי"].map((p) => (
              <span
                key={p}
                style={{
                  padding: "3px 10px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  color: "var(--foreground-muted)",
                }}
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: "var(--foreground)",
            margin: "0 0 6px",
          }}
        >
          🎨 סטודיו קריאייטיב — {client.name}
        </h2>
        <p style={{ color: "var(--foreground-muted)", fontSize: 14, margin: "0 0 20px" }}>
          ניהול נכסי מותג, ניתוח DNA קריאייטיבי, ופרופיל סגנון
        </p>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {[
            { label: "נכסים", value: assetsLoading ? "…" : String(assets.length), color: "var(--accent)" },
            { label: "מאושרים", value: assetsLoading ? "…" : String(approvedAssets.length), color: "#22c55e" },
            { label: "נדחים", value: assetsLoading ? "…" : String(rejectedAssets.length), color: "#ef4444" },
            { label: "פרופיל", value: profilesLoading ? "…" : profile ? { draft: "טיוטה", active: "פעיל", locked: "נעול" }[profile.profileStatus ?? "draft"] ?? "קיים" : "חסר", color: profile ? "var(--neon-yellow)" : "var(--foreground-muted)" },
          ].map((s) => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</span>
              <span style={{ fontSize: 12, color: "var(--foreground-muted)" }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Section navigation */}
      <div
        style={{
          display: "flex",
          gap: 4,
          overflowX: "auto",
          paddingBottom: 4,
          marginBottom: 24,
          borderBottom: "1px solid var(--border)",
        }}
      >
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            style={{
              padding: "9px 18px",
              borderRadius: "8px 8px 0 0",
              border: "none",
              background: activeSection === section.id ? "var(--accent)" : "transparent",
              color: activeSection === section.id ? "#000" : "var(--foreground-muted)",
              fontWeight: activeSection === section.id ? 700 : 500,
              fontSize: 13,
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 0.15s",
              flexShrink: 0,
            }}
          >
            {section.label}
          </button>
        ))}
      </div>

      {/* Section content */}
      {activeSection === "overview" && renderOverview()}
      {activeSection === "assets" && renderAssets()}
      {activeSection === "upload" && renderUpload()}
      {activeSection === "analysis" && renderAnalysis()}
      {activeSection === "dna" && renderDNA()}
      {activeSection === "feedback" && renderFeedback()}
      {activeSection === "generator" && renderGenerator()}
    </div>
  );
}

// ─── Asset Card ───────────────────────────────────────────────────────────────

interface AssetCardProps {
  asset: any;
  onToggleApproved: () => Promise<void>;
  onToggleRejected: () => Promise<void>;
  onToggleCompetitor: () => Promise<void>;
  onDelete: () => Promise<void>;
}

function AssetCard({ asset, onToggleApproved, onToggleRejected, onToggleCompetitor, onDelete }: AssetCardProps) {
  const [busy, setBusy] = useState(false);

  const wrap = (fn: () => Promise<void>) => async () => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  const isImage = isImageMime(asset.fileMimeType ?? "");

  return (
    <div
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transition: "box-shadow 0.2s",
      }}
    >
      {/* Thumbnail */}
      <div
        style={{
          height: 140,
          background: "var(--surface)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {isImage && (asset.thumbnailUrl || asset.fileUrl) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.thumbnailUrl || asset.fileUrl}
            alt={asset.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={(e) => {
              (e.target as HTMLImageElement).src = "";
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div style={{ fontSize: 40, textAlign: "center" }}>
            {{ pdf: "📕", doc: "📝", docx: "📝", psd: "🎨", ai: "🖌️", svg: "🔷", eps: "🖼️" }[
              (asset.fileName ?? "").split(".").pop()?.toLowerCase() ?? ""
            ] ?? "📄"}
          </div>
        )}
        {/* Type badge */}
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            padding: "3px 8px",
            borderRadius: 8,
            background: "rgba(0,0,0,0.65)",
            color: "#fff",
            fontSize: 10,
            fontWeight: 600,
            backdropFilter: "blur(4px)",
          }}
        >
          {ASSET_TYPE_LABELS[asset.assetType as BrandAssetType] ?? asset.assetType}
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: "12px 14px", flex: 1 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 13,
            color: "var(--foreground)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            marginBottom: 6,
          }}
        >
          {asset.title || asset.fileName}
        </div>

        {/* Badges */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
          {asset.isApprovedReference && <Badge color="#22c55e">מאושר</Badge>}
          {asset.isRejectedReference && <Badge color="#ef4444">נדחה</Badge>}
          {asset.isCompetitorReference && <Badge color="#f59e0b">מתחרה</Badge>}
        </div>

        {/* Tags */}
        {asset.tags && (asset.tags as string[]).length > 0 && (
          <div style={{ marginBottom: 8 }}>
            {(asset.tags as string[]).slice(0, 3).map((t: string) => (
              <TagChip key={t} label={t} />
            ))}
          </div>
        )}

        <div style={{ fontSize: 11, color: "var(--foreground-subtle)" }}>
          {fmtDate(asset.createdAt)}
          {asset.fileSize ? ` · ${fileSizeLabel(asset.fileSize)}` : ""}
        </div>
      </div>

      {/* Action buttons */}
      <div
        style={{
          padding: "10px 14px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={wrap(onToggleApproved)}
          disabled={busy}
          title="דוגמה מאושרת"
          style={{
            padding: "4px 10px",
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            cursor: busy ? "not-allowed" : "pointer",
            border: "1px solid",
            borderColor: asset.isApprovedReference ? "#22c55e" : "var(--border)",
            background: asset.isApprovedReference ? "#22c55e22" : "transparent",
            color: asset.isApprovedReference ? "#22c55e" : "var(--foreground-muted)",
          }}
        >
          ✓ מאושר
        </button>
        <button
          onClick={wrap(onToggleRejected)}
          disabled={busy}
          title="דוגמה נדחית"
          style={{
            padding: "4px 10px",
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            cursor: busy ? "not-allowed" : "pointer",
            border: "1px solid",
            borderColor: asset.isRejectedReference ? "#ef4444" : "var(--border)",
            background: asset.isRejectedReference ? "#ef444422" : "transparent",
            color: asset.isRejectedReference ? "#ef4444" : "var(--foreground-muted)",
          }}
        >
          ✗ נדחה
        </button>
        <button
          onClick={wrap(onToggleCompetitor)}
          disabled={busy}
          title="נכס מתחרה"
          style={{
            padding: "4px 10px",
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            cursor: busy ? "not-allowed" : "pointer",
            border: "1px solid",
            borderColor: asset.isCompetitorReference ? "#f59e0b" : "var(--border)",
            background: asset.isCompetitorReference ? "#f59e0b22" : "transparent",
            color: asset.isCompetitorReference ? "#f59e0b" : "var(--foreground-muted)",
          }}
        >
          🏢 מתחרה
        </button>
        <button
          onClick={wrap(onDelete)}
          disabled={busy}
          title="מחק נכס"
          style={{
            padding: "4px 8px",
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            cursor: busy ? "not-allowed" : "pointer",
            border: "1px solid #ef444440",
            background: "transparent",
            color: "#ef4444",
            marginRight: "auto",
          }}
        >
          🗑
        </button>
      </div>
    </div>
  );
}
