"use client";

import { useState, useMemo, useCallback } from "react";
import type { Client, CreativeConcept, DesignSet, DesignVariant, DesignJSON, DesignScore, DesignOutputType, ClientVisualAsset, ClientVisualGenerationJob, VisualAssetType, VisualScore, VisualProvider, CampaignFactoryCampaign, CampaignFactoryAsset, CampaignCopySet, CampaignFactoryType, CampaignAssetFormat, CampaignDNA } from "@/lib/db/schema";
import {
  useBrandAssets,
  useBrandStyleProfiles,
  useCreativeFeedback,
  useBrandAnalysisJobs,
  useCreativeConcepts,
  useDesignSets,
  useDesignVariants,
  useClientVisualAssets,
  useClientVisualGenerationJobs,
  useCampaignFactoryCampaigns,
  useCampaignFactoryAssets,
  useCampaignCopySets,
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
  | "property_photo"
  | "floor_plan"
  | "project_render"
  | "neighborhood_reference"
  | "brochure"
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
  property_photo: "תמונת נכס",
  floor_plan: "תוכנית קומה",
  project_render: "הדמיית פרויקט",
  neighborhood_reference: "רפרנס שכונה",
  brochure: "חוברת/ברושור",
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
  "property_photo",
  "floor_plan",
  "project_render",
  "neighborhood_reference",
  "brochure",
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
  { id: "learned", label: "מה ZONO למד?" },
  { id: "dna", label: "פרופיל Brand DNA" },
  { id: "feedback", label: "משוב קריאייטיב" },
  { id: "concepts", label: "קונספטים שיווקיים" },
  { id: "designs", label: "עיצובים" },
  { id: "visuals", label: "ויז'ואלים" },
  { id: "campaign-factory", label: "מפעל קמפיינים" },
  { id: "creative-director", label: "🧠 Creative Director" },
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
  const { data: allConcepts, loading: conceptsLoading, refetch: refetchConcepts, update: updateConcept, remove: removeConcept } = useCreativeConcepts();
  const designSetsHook = useDesignSets();
  const designVariantsHook = useDesignVariants();
  const visualAssetsHook = useClientVisualAssets();
  const visualJobsHook = useClientVisualGenerationJobs();
  const campaignFactoryHook = useCampaignFactoryCampaigns();
  const campaignAssetsHook = useCampaignFactoryAssets();
  const copySetsHook = useCampaignCopySets();

  // ── Filtered data ───────────────────────────────────────────────────────────
  const assets = useMemo(() => allAssets.filter((a) => a.clientId === client.id), [allAssets, client.id]);
  const profile = useMemo(() => allProfiles.find((p) => p.clientId === client.id) ?? null, [allProfiles, client.id]);
  const feedback = useMemo(() => allFeedback.filter((f) => f.clientId === client.id), [allFeedback, client.id]);
  const jobs = useMemo(() => allJobs.filter((j) => j.clientId === client.id), [allJobs, client.id]);
  const concepts = useMemo(() => allConcepts.filter((c) => c.entityId === client.id), [allConcepts, client.id]);

  const approvedAssets = useMemo(() => assets.filter((a) => a.isApprovedReference), [assets]);
  const rejectedAssets = useMemo(() => assets.filter((a) => a.isRejectedReference), [assets]);
  const lastJob = useMemo(() => jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null, [jobs]);

  // ─── Concepts state ────────────────────────────────────────────────────
  const [generatingConcepts, setGeneratingConcepts] = useState(false);
  const [selectedConcept, setSelectedConcept] = useState<CreativeConcept | null>(null);
  const [conceptDetailOpen, setConceptDetailOpen] = useState(false);

  // ─── Designs state ────────────────────────────────────────────────────
  const entityDesignSets = (designSetsHook.data || []).filter(
    (ds: DesignSet) => ds.entityId === client.id || ds.clientId === client.id
  );
  const [generatingDesigns, setGeneratingDesigns] = useState(false);
  const [selectedDesignSet, setSelectedDesignSet] = useState<DesignSet | null>(null);
  const [designViewerOpen, setDesignViewerOpen] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<DesignVariant | null>(null);
  const [editingVariant, setEditingVariant] = useState<DesignVariant | null>(null);
  const [designTypeFilter, setDesignTypeFilter] = useState<DesignOutputType | 'all'>('all');

  // ─── Visuals state ────────────────────────────────────────────────────
  const [entityVisualAssets, setEntityVisualAssets] = useState<ClientVisualAsset[]>([]);
  const [entityVisualJobs, setEntityVisualJobs] = useState<ClientVisualGenerationJob[]>([]);
  const [generatingVisuals, setGeneratingVisuals] = useState(false);
  const [visualTypeFilter, setVisualTypeFilter] = useState<VisualAssetType | 'all'>('all');
  const [selectedVisualAsset, setSelectedVisualAsset] = useState<ClientVisualAsset | null>(null);
  const [visualViewerOpen, setVisualViewerOpen] = useState(false);
  const [variationModalOpen, setVariationModalOpen] = useState(false);
  const [variationTarget, setVariationTarget] = useState<ClientVisualAsset | null>(null);

  // ─── Campaign Factory state ────────────────────────────────────────────
  const [entityCampaigns, setEntityCampaigns] = useState<CampaignFactoryCampaign[]>([]);
  const [entityCampaignAssets, setEntityCampaignAssets] = useState<CampaignFactoryAsset[]>([]);
  const [generatingCampaign, setGeneratingCampaign] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignFactoryCampaign | null>(null);
  const [campaignViewerOpen, setCampaignViewerOpen] = useState(false);
  const [showCampaignCreator, setShowCampaignCreator] = useState(false);
  // Campaign creation form
  const [cfTitle, setCfTitle] = useState('');
  const [cfObjective, setCfObjective] = useState('');
  const [cfType, setCfType] = useState<CampaignFactoryType>('lead_generation');
  const [cfIndustry, setCfIndustry] = useState('');
  const [cfAudience, setCfAudience] = useState('');
  const [cfOffer, setCfOffer] = useState('');
  const [cfMessage, setCfMessage] = useState('');

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

  // ─── Visual assets filtering ───────────────────────────────────────────
  useMemo(() => {
    if (!visualAssetsHook.data || !client) return;
    const filtered = visualAssetsHook.data.filter((a: ClientVisualAsset) => a.clientId === client.id);
    setEntityVisualAssets(filtered);
  }, [visualAssetsHook.data, client]);

  useMemo(() => {
    if (!visualJobsHook.data || !client) return;
    const filtered = visualJobsHook.data.filter((j: ClientVisualGenerationJob) => j.clientId === client.id);
    setEntityVisualJobs(filtered);
  }, [visualJobsHook.data, client]);

  // ─── Campaign Factory filtering ───────────────────────────────────────
  useMemo(() => {
    if (!campaignFactoryHook.data || !client) return;
    setEntityCampaigns(campaignFactoryHook.data.filter((c: CampaignFactoryCampaign) => c.clientId === client.id));
  }, [campaignFactoryHook.data, client]);

  useMemo(() => {
    if (!campaignAssetsHook.data || !client) return;
    setEntityCampaignAssets(campaignAssetsHook.data.filter((a: CampaignFactoryAsset) => a.clientId === client.id));
  }, [campaignAssetsHook.data, client]);

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
  const [analyzeSuccess, setAnalyzeSuccess] = useState(false);
  const [lastProvider, setLastProvider] = useState<string>('');

  const handleAnalyze = useCallback(async () => {
    setAnalyzing(true);
    setAnalyzeError(null);
    setAnalyzeSuccess(false);
    try {
      const res = await fetch("/api/creative-studio/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "שגיאה בניתוח");
      }
      if (data.provider) {
        setLastProvider(data.provider);
      }
      setAnalyzeSuccess(true);
      await refetchJobs();
      setActiveSection("learned");
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
        <SectionTitle>ניתוח DNA שיווקי</SectionTitle>
        <p style={{ color: "var(--foreground-muted)", fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
          הניתוח מבוסס על חומרים שהועלו, רפרנסים שאושרו, רפרנסים שנפסלו, תמונות נכס, הדמיות, תוכניות והערות הצוות.
        </p>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <Btn
            variant="accent"
            onClick={handleAnalyze}
            disabled={analyzing || assets.length === 0}
            style={{ padding: "10px 28px" }}
          >
            {analyzing ? (
              <span
                style={{
                  display: "inline-block",
                  animation: "zonoPulse 1.5s ease-in-out infinite",
                }}
              >
                ZONO מנתח את הסגנון השיווקי והנדל״ני...
              </span>
            ) : (
              "נתח DNA שיווקי"
            )}
          </Btn>
          {assets.length === 0 && (
            <span style={{ color: "var(--foreground-muted)", fontSize: 13 }}>
              יש להעלות נכסים לפני הניתוח
            </span>
          )}
        </div>

        {/* Pulsing animation style */}
        <style>{`@keyframes zonoPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>

        {/* Success toast */}
        {analyzeSuccess && (
          <div style={{
            marginTop: 16, color: "#22c55e", fontSize: 13, padding: "10px 14px",
            background: "#22c55e20", borderRadius: 8, border: "1px solid #22c55e40",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            Marketing DNA עודכן בהצלחה
            {lastProvider && (
              <Badge color="var(--accent)">{lastProvider}</Badge>
            )}
          </div>
        )}

        {/* Error */}
        {analyzeError && (
          <div style={{ marginTop: 16, color: "#ef4444", fontSize: 13, padding: "10px 14px", background: "#ef444420", borderRadius: 8, border: "1px solid #ef444440" }}>
            {analyzeError}
          </div>
        )}

        {/* Last analysis info */}
        {profile && profile.lastAnalyzedAt && (
          <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "var(--foreground-muted)" }}>
              ניתוח אחרון: {fmtDate(profile.lastAnalyzedAt)}
            </span>
            {profile.aiConfidenceScore > 0 && (
              <Badge color="var(--accent)">{profile.aiConfidenceScore}% ביטחון</Badge>
            )}
            {lastProvider && (
              <Badge color="var(--neon-yellow)">{lastProvider}</Badge>
            )}
          </div>
        )}
      </SectionCard>

      {/* Jobs history */}
      <SectionCard>
        <SectionTitle>היסטוריית ניתוחים</SectionTitle>
        {jobsLoading ? (
          <div style={{ color: "var(--foreground-muted)", textAlign: "center", padding: 32 }}>טוען...</div>
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
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: "var(--foreground)" }}>
                        {{ brand_dna_analysis: "Brand DNA Analysis", single_asset_analysis: "ניתוח נכס בודד", comparative_analysis: "ניתוח השוואתי" }[job.jobType] ?? job.jobType}
                      </span>
                      {(job as any).provider && (
                        <Badge color="var(--foreground-muted)">{(job as any).provider}</Badge>
                      )}
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

  // ── 4b. What ZONO Learned ────────────────────────────────────────────────────
  const renderLearned = () => {
    const p = profile as any;
    const hasProfile = !!p;

    const approvedPatterns: string[] = p?.approved_patterns ?? p?.approvedPatterns ?? [];
    const preferredCampaignAngles: string[] = p?.preferred_campaign_angles ?? p?.preferredCampaignAngles ?? [];
    const preferredVisualStyles: string[] = p?.preferred_visual_styles ?? p?.preferredVisualStyles ?? [];
    const preferredImageStyles: string[] = p?.preferred_image_styles ?? p?.preferredImageStyles ?? [];
    const preferredCtaStyles: string[] = p?.preferred_cta_styles ?? p?.preferredCtaStyles ?? [];

    const rejectedPatterns: string[] = p?.rejected_patterns ?? p?.rejectedPatterns ?? [];
    const rejectedCampaignAngles: string[] = p?.rejected_campaign_angles ?? p?.rejectedCampaignAngles ?? [];
    const rejectedVisualStyles: string[] = p?.rejected_visual_styles ?? p?.rejectedVisualStyles ?? [];
    const rejectedImageStyles: string[] = p?.rejected_image_styles ?? p?.rejectedImageStyles ?? [];
    const avoidRules: string[] = p?.avoidRules ?? p?.avoid_rules ?? [];

    // Real estate insights for "what works"
    const reInsights: string[] = [];
    if (p?.propertyMarketingStyle) {
      const pms = p.propertyMarketingStyle;
      if (typeof pms === "object") {
        Object.entries(pms).slice(0, 3).forEach(([k, v]) => {
          if (v && typeof v === "string") reInsights.push(`${k}: ${v}`);
        });
      }
    }
    if (p?.agentMarketingStyle) {
      const ams = p.agentMarketingStyle;
      if (typeof ams === "object") {
        Object.entries(ams).slice(0, 2).forEach(([k, v]) => {
          if (v && typeof v === "string") reInsights.push(`${k}: ${v}`);
        });
      }
    }

    const worksItems = [
      ...approvedPatterns,
      ...preferredCampaignAngles,
      ...preferredVisualStyles,
      ...preferredImageStyles,
      ...preferredCtaStyles,
      ...reInsights,
    ];
    const avoidItems = [
      ...rejectedPatterns,
      ...rejectedCampaignAngles,
      ...rejectedVisualStyles,
      ...rejectedImageStyles,
      ...avoidRules,
    ];

    const emptyMessage = "טרם נותח — הפעל ניתוח DNA שיווקי";

    const pillStyle = (color: string): React.CSSProperties => ({
      display: "inline-flex",
      padding: "4px 12px",
      borderRadius: 20,
      fontSize: 13,
      fontWeight: 500,
      background: `${color}18`,
      color: color,
      border: `1px solid ${color}30`,
      marginLeft: 6,
      marginBottom: 6,
    });

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <SectionCard>
          <SectionTitle>מה ZONO למד?</SectionTitle>
          {!hasProfile ? (
            <div style={{ textAlign: "center", padding: 48, color: "var(--foreground-muted)", fontSize: 14 }}>
              {emptyMessage}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              {/* Column 1: What works */}
              <div style={{
                background: "var(--surface)",
                borderRadius: 12,
                border: "1px solid #22c55e30",
                padding: 20,
              }}>
                <h4 style={{
                  fontSize: 15, fontWeight: 700, color: "#22c55e",
                  marginTop: 0, marginBottom: 16,
                }}>
                  מה עובד כאן ✅
                </h4>
                {worksItems.length === 0 ? (
                  <div style={{ color: "var(--foreground-muted)", fontSize: 13 }}>
                    {emptyMessage}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap" }}>
                    {worksItems.map((item, i) => (
                      <span key={i} style={pillStyle("#22c55e")}>
                        {item}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Column 2: What to avoid */}
              <div style={{
                background: "var(--surface)",
                borderRadius: 12,
                border: "1px solid #ef444430",
                padding: 20,
              }}>
                <h4 style={{
                  fontSize: 15, fontWeight: 700, color: "#ef4444",
                  marginTop: 0, marginBottom: 16,
                }}>
                  ממה להימנע ❌
                </h4>
                {avoidItems.length === 0 ? (
                  <div style={{ color: "var(--foreground-muted)", fontSize: 13 }}>
                    {emptyMessage}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap" }}>
                    {avoidItems.map((item, i) => (
                      <span key={i} style={pillStyle("#ef4444")}>
                        {item}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    );
  };

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
              <ScoreBar label="דחיפות" value={(profile as any).urgencyScore ?? 0} />
              <ScoreBar label="מיקוד השקעה" value={(profile as any).investmentFocusScore ?? 0} />
              <ScoreBar label="מיקוד לייפסטייל" value={(profile as any).lifestyleFocusScore ?? 0} />
              <ScoreBar label="מיקוד מוכרים" value={(profile as any).sellerFocusScore ?? 0} />
              <ScoreBar label="מיקוד קונים" value={(profile as any).buyerFocusScore ?? 0} />
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
                { key: "realEstatePositioning", label: "מיצוב נדל״ני", rows: 3 },
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

          {/* Target Audiences & Campaign Angles */}
          <SectionCard>
            <SectionTitle>קהלי יעד וזוויות קמפיין</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Target audiences as tags */}
              <div>
                <label style={labelStyle}>קהלי יעד</label>
                {(() => {
                  const audiences: string[] = (profile as any).targetAudiences ?? [];
                  return audiences.length === 0 ? (
                    <span style={{ color: "var(--foreground-subtle)", fontSize: 12 }}>לא הוגדרו</span>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap" }}>
                      {audiences.map((a, i) => (
                        <span key={i} style={{
                          display: "inline-flex", padding: "4px 12px", borderRadius: 20,
                          fontSize: 13, fontWeight: 500, background: "var(--accent-muted)",
                          color: "var(--accent-text)", border: "1px solid var(--accent-border)",
                          marginLeft: 6, marginBottom: 6,
                        }}>
                          {a}
                        </span>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* WhatsApp CTA style */}
              <div>
                <label style={labelStyle}>סגנון CTA WhatsApp</label>
                {(() => {
                  const wcs = (profile as any).whatsappCtaStyle;
                  if (!wcs || typeof wcs !== "object") return (
                    <span style={{ color: "var(--foreground-subtle)", fontSize: 12 }}>לא הוגדר</span>
                  );
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {Object.entries(wcs).map(([k, v]) => (
                        <div key={k} style={{ display: "flex", gap: 8, fontSize: 13 }}>
                          <span style={{ color: "var(--foreground-muted)", fontWeight: 600 }}>{k}:</span>
                          <span style={{ color: "var(--foreground)" }}>{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Preferred / Rejected campaign angles */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <div>
                  <label style={{ ...labelStyle, color: "#22c55e" }}>זוויות קמפיין מועדפות</label>
                  {(() => {
                    const angles: string[] = (profile as any).preferredCampaignAngles ?? [];
                    return angles.length === 0 ? (
                      <span style={{ color: "var(--foreground-subtle)", fontSize: 12 }}>לא הוגדרו</span>
                    ) : (
                      <div style={{ display: "flex", flexWrap: "wrap" }}>
                        {angles.map((a, i) => (
                          <span key={i} style={{
                            display: "inline-flex", padding: "4px 12px", borderRadius: 20,
                            fontSize: 13, fontWeight: 500, background: "#22c55e18",
                            color: "#22c55e", border: "1px solid #22c55e30",
                            marginLeft: 6, marginBottom: 6,
                          }}>
                            {a}
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <label style={{ ...labelStyle, color: "#ef4444" }}>זוויות קמפיין נדחות</label>
                  {(() => {
                    const angles: string[] = (profile as any).rejectedCampaignAngles ?? [];
                    return angles.length === 0 ? (
                      <span style={{ color: "var(--foreground-subtle)", fontSize: 12 }}>לא הוגדרו</span>
                    ) : (
                      <div style={{ display: "flex", flexWrap: "wrap" }}>
                        {angles.map((a, i) => (
                          <span key={i} style={{
                            display: "inline-flex", padding: "4px 12px", borderRadius: 20,
                            fontSize: 13, fontWeight: 500, background: "#ef444418",
                            color: "#ef4444", border: "1px solid #ef444430",
                            marginLeft: 6, marginBottom: 6,
                          }}>
                            {a}
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
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

          {/* Real Estate Marketing Styles */}
          <SectionCard>
            <SectionTitle>סגנונות שיווק נדל״ני</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { key: "propertyMarketingStyle", label: "סגנון שיווק נכס" },
                { key: "projectMarketingStyle", label: "סגנון שיווק פרויקט" },
                { key: "agentMarketingStyle", label: "סגנון שיווק סוכן" },
                { key: "sellerRecruitmentStyle", label: "סגנון גיוס מוכרים" },
                { key: "buyerRecruitmentStyle", label: "סגנון גיוס קונים" },
                { key: "neighborhoodStorytellingStyle", label: "סיפור שכונתי" },
              ].map(({ key, label }) => {
                const data = (profile as any)[key];
                const hasData = data && typeof data === "object" && Object.keys(data).length > 0;
                return (
                  <details
                    key={key}
                    style={{
                      background: "var(--surface)",
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      overflow: "hidden",
                    }}
                  >
                    <summary style={{
                      padding: "12px 16px",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                      color: hasData ? "var(--foreground)" : "var(--foreground-muted)",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}>
                      <span>{label}</span>
                      {!hasData && (
                        <span style={{ fontSize: 11, color: "var(--foreground-subtle)", fontWeight: 400 }}>
                          (לא הוגדר)
                        </span>
                      )}
                    </summary>
                    {hasData && (
                      <div style={{ padding: "0 16px 14px 16px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {Object.entries(data).map(([k, v]) => (
                            <div key={k} style={{ display: "flex", gap: 8, fontSize: 13 }}>
                              <span style={{ color: "var(--foreground-muted)", fontWeight: 600, minWidth: 100 }}>{k}:</span>
                              <span style={{ color: "var(--foreground)" }}>
                                {typeof v === "object" ? JSON.stringify(v) : String(v)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </details>
                );
              })}
            </div>
          </SectionCard>

          {/* Manual Notes */}
          <SectionCard>
            <SectionTitle>הערות ידניות</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[
                { key: "agentNotes", label: "הערות סוכן" },
                { key: "officeNotes", label: "הערות משרד" },
                { key: "sellerNotes", label: "הערות מוכרים" },
                { key: "zonoNotes", label: "הערות ZONO" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label style={labelStyle}>{label}</label>
                  <textarea
                    value={dnaVal<string>(key, "")}
                    onChange={(e) => setDnaEdits((prev) => ({ ...prev, [key]: e.target.value }))}
                    rows={3}
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
                </div>
              ))}
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

  // ── 7. Creative Concepts ─────────────────────────────────────────────────────

  const CONCEPT_TYPE_LABELS_CLIENT: Record<string, string> = {
    luxury_lifestyle: "לייף סטייל יוקרתי",
    investment_opportunity: "הזדמנות השקעה",
    neighborhood_story: "סיפור שכונה",
    dream_home: "בית חלומות",
    family_living: "מגורי משפחות",
    exclusive_listing: "נכס בלעדי",
    premium_penthouse: "פנטהאוז פרימיום",
    garden_apartment: "דירת גן",
    first_home: "דירה ראשונה",
    upgrade_your_life: "שדרוג איכות חיים",
    seller_recruitment: "גיוס מוכרים",
    buyer_recruitment: "גיוס קונים",
    project_launch: "השקת פרויקט",
    pre_sale: "מכירה מוקדמת",
    authority_agent: 'סוכן סמכותי',
    neighborhood_expert: "מומחה שכונה",
    developer_prestige: "יוקרת יזם",
    community_living: "חיי קהילה",
    location_advantage: "יתרון מיקום",
    urban_lifestyle: "לייף סטייל עירוני",
    beach_lifestyle: "לייף סטייל חוף",
    high_roi: "תשואה גבוהה",
    future_appreciation: "עליית ערך עתידית",
  };

  // ─── Design label maps ────────────────────────────────────────────────────
  const DESIGN_OUTPUT_LABELS: Record<string, string> = {
    feed_post: 'פוסט פיד', story: 'סטורי', carousel: 'קרוסלה',
    banner: 'באנר', website_hero: 'הירו אתר', google_display: 'גוגל דיספליי',
    reel_cover: 'כיסוי ריל',
  };

  const DESIGN_LAYOUT_LABELS: Record<string, string> = {
    editorial: 'עריכתי', luxury: 'יוקרתי', minimal: 'מינימליסטי',
    sales: 'מכירתי', corporate: 'קורפורטיבי', real_estate_premium: 'נדל"ן פרימיום',
    magazine: 'מגזין', modern_tech: 'טכנולוגי מודרני', split_layout: 'פיצול',
    hero_image: 'תמונה ראשית', offer_layout: 'הצעה',
  };

  const DESIGN_STATUS_LABELS: Record<string, string> = {
    draft: 'טיוטה', generating: 'בייצור...', ready: 'מוכן',
    approved: 'מאושר', rejected: 'נדחה', archived: 'בארכיון',
  };

  // ─── Visual label maps ─────────────────────────────────────────────────────
  const VISUAL_ASSET_TYPE_LABELS: Record<VisualAssetType, string> = {
    hero_image: 'תמונת Hero',
    advertising_visual: 'ויז\'ואל פרסומי',
    background: 'רקע',
    project_render: 'הדמיית פרויקט',
    lifestyle_imagery: 'תמונת לייפסטייל',
    scene_extension: 'הרחבת סצנה',
    image_variation: 'וריאציה',
    image_improvement: 'שיפור תמונה',
    image_upscale: 'הגדלת תמונה',
    image_cleanup: 'ניקוי תמונה',
    object_replacement: 'החלפת אובייקט',
    brand_visual: 'ויז\'ואל מותגי',
  };

  const VISUAL_STATUS_LABELS: Record<string, string> = {
    generated: 'נוצר',
    approved: 'מאושר',
    rejected: 'נדחה',
    favorite: 'מועדף',
    injected: 'הוזרק לעיצוב',
  };

  const VARIATION_DIRECTIONS = [
    { id: 'more_luxury', label: 'יותר לאקשרי' },
    { id: 'more_modern', label: 'יותר מודרני' },
    { id: 'more_premium', label: 'יותר פרימיום' },
    { id: 'more_sales', label: 'יותר מכירתי' },
    { id: 'less_busy', label: 'פחות עמוס' },
    { id: 'less_ai', label: 'פחות AI' },
    { id: 'more_realistic', label: 'יותר ריאליסטי' },
    { id: 'different_lighting', label: 'תאורה שונה' },
    { id: 'different_composition', label: 'קומפוזיציה שונה' },
    { id: 'different_background', label: 'רקע שונה' },
  ];

  // ─── Campaign Factory label maps ──────────────────────────────────────────
  const CAMPAIGN_TYPE_LABELS: Record<CampaignFactoryType, string> = {
    lead_generation: 'יצירת לידים',
    brand_awareness: 'מודעות למותג',
    launch_campaign: 'קמפיין השקה',
    sales_campaign: 'קמפיין מכירות',
    project_marketing: 'שיווק פרויקט',
    real_estate_project_launch: 'השקת פרויקט נדל"ן',
    property_marketing: 'שיווק נכס',
    holiday_campaign: 'קמפיין חג',
    recruitment_campaign: 'קמפיין גיוס',
    event_campaign: 'קמפיין אירוע',
    website_traffic: 'תנועה לאתר',
    remarketing: 'רימרקטינג',
    custom: 'מותאם אישית',
  };

  const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
    draft: 'טיוטה',
    generating: 'בהפקה...',
    ready: 'מוכן',
    in_review: 'בבדיקה',
    approved: 'מאושר',
    published: 'פורסם',
    archived: 'בארכיון',
  };

  const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
    draft: '#888',
    generating: '#F0FF02',
    ready: '#00B5FE',
    in_review: '#FF9800',
    approved: '#4CAF50',
    published: '#8BC34A',
    archived: '#666',
  };

  const ASSET_FORMAT_LABELS: Record<CampaignAssetFormat, string> = {
    feed_post: 'פוסט פיד',
    story: 'סטורי',
    carousel: 'קרוסלה',
    reel_cover: 'כיסוי ריל',
    banner: 'באנר',
    website_hero: 'Hero אתר',
    email_header: 'כותרת מייל',
    google_display: 'Google Display',
    property_story: 'סטורי נכס',
    property_carousel: 'קרוסלה נכס',
    seller_recruitment: 'גיוס מוכרים',
    buyer_recruitment: 'גיוס קונים',
    project_awareness: 'מודעות פרויקט',
    neighborhood_content: 'תוכן שכונה',
    developer_asset: 'נכס יזם',
  };

  const CAMPAIGN_TYPE_EMOJIS: Record<CampaignFactoryType, string> = {
    lead_generation: '🎯',
    brand_awareness: '📢',
    launch_campaign: '🚀',
    sales_campaign: '💰',
    project_marketing: '🏗️',
    real_estate_project_launch: '🏠',
    property_marketing: '🏢',
    holiday_campaign: '🎄',
    recruitment_campaign: '👥',
    event_campaign: '🎪',
    website_traffic: '🌐',
    remarketing: '🔄',
    custom: '⚙️',
  };

  // ─── Design handlers ──────────────────────────────────────────────────────
  const handleGenerateDesigns = async (designType: DesignOutputType = 'feed_post', conceptId?: string) => {
    setGeneratingDesigns(true);
    try {
      const resp = await fetch('/api/creative-studio/designs/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'client',
          entityId: client.id,
          entityName: client.name || client.company || client.id,
          conceptId: conceptId || null,
          designType,
        }),
      });
      const result = await resp.json();
      if (result.success) {
        designSetsHook.refetch();
        designVariantsHook.refetch();
      }
    } catch (err) {
      console.error('Design generation failed:', err);
    } finally {
      setGeneratingDesigns(false);
    }
  };

  const handleFavoriteDesignVariant = async (variant: DesignVariant) => {
    await designVariantsHook.update(variant.id, { isFavorite: !variant.isFavorite } as Partial<DesignVariant>);
  };

  const handleApproveDesignVariant = async (variant: DesignVariant) => {
    await designVariantsHook.update(variant.id, { isApproved: !variant.isApproved, isRejected: false } as Partial<DesignVariant>);
  };

  const handleRejectDesignVariant = async (variant: DesignVariant) => {
    await designVariantsHook.update(variant.id, { isRejected: !variant.isRejected, isApproved: false } as Partial<DesignVariant>);
  };

  const handleDeleteDesignSet = async (ds: DesignSet) => {
    if (!confirm('למחוק סט עיצובים?')) return;
    await designSetsHook.remove(ds.id);
  };

  const openDesignViewer = (ds: DesignSet) => {
    setSelectedDesignSet(ds);
    setDesignViewerOpen(true);
    const variants = (designVariantsHook.data || []).filter(
      (v: DesignVariant) => v.designSetId === ds.id
    );
    setSelectedVariant(variants[0] || null);
  };

  const handleGenerateConcepts = async () => {
    setGeneratingConcepts(true);
    try {
      const res = await fetch("/api/creative-studio/concepts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "client",
          entityId: client.id,
          entityName: client.name || client.company || client.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        refetchConcepts();
      } else {
        console.error("[Concepts] Generation failed:", data.error);
      }
    } catch (err) {
      console.error("[Concepts] Generation error:", err);
    } finally {
      setGeneratingConcepts(false);
    }
  };

  const handleFavoriteConcept = async (concept: CreativeConcept) => {
    await updateConcept(concept.id, { isFavorite: !concept.isFavorite } as Partial<CreativeConcept>);
  };

  const handleApproveConcept = async (concept: CreativeConcept) => {
    await updateConcept(concept.id, { isApproved: !concept.isApproved, isRejected: false } as Partial<CreativeConcept>);
  };

  const handleRejectConcept = async (concept: CreativeConcept) => {
    await updateConcept(concept.id, { isRejected: !concept.isRejected, isApproved: false } as Partial<CreativeConcept>);
  };

  const handleDeleteConcept = async (concept: CreativeConcept) => {
    if (!confirm("למחוק קונספט זה?")) return;
    await removeConcept(concept.id);
  };

  const openConceptDetail = (concept: CreativeConcept) => {
    setSelectedConcept(concept);
    setConceptDetailOpen(true);
  };

  // ─── Visual handlers ──────────────────────────────────────────────────────
  const handleGenerateVisuals = useCallback(async (assetType: VisualAssetType) => {
    if (!client) return;
    setGeneratingVisuals(true);
    try {
      const res = await fetch('/api/creative-studio/visuals/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client.id,
          entityType: 'client',
          entityId: client.id,
          entityName: client.company || client.name,
          assetType,
        }),
      });
      const data = await res.json();
      if (data.success) {
        visualAssetsHook.refetch();
        visualJobsHook.refetch();
      }
    } catch (err) {
      console.error('Visual generation failed:', err);
    } finally {
      setGeneratingVisuals(false);
    }
  }, [client, visualAssetsHook, visualJobsHook]);

  const handleApproveVisual = useCallback(async (asset: ClientVisualAsset) => {
    try {
      await fetch(`/api/data/client-visual-assets/${asset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...asset, status: 'approved', isApproved: true, isRejected: false }),
      });
      visualAssetsHook.refetch();
    } catch (err) { console.error(err); }
  }, [visualAssetsHook]);

  const handleRejectVisual = useCallback(async (asset: ClientVisualAsset) => {
    try {
      await fetch(`/api/data/client-visual-assets/${asset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...asset, status: 'rejected', isRejected: true, isApproved: false }),
      });
      visualAssetsHook.refetch();
    } catch (err) { console.error(err); }
  }, [visualAssetsHook]);

  const handleFavoriteVisual = useCallback(async (asset: ClientVisualAsset) => {
    try {
      await fetch(`/api/data/client-visual-assets/${asset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...asset, isFavorite: !asset.isFavorite, status: !asset.isFavorite ? 'favorite' : 'generated' }),
      });
      visualAssetsHook.refetch();
    } catch (err) { console.error(err); }
  }, [visualAssetsHook]);

  const handleGenerateVariation = useCallback(async (asset: ClientVisualAsset, direction: string) => {
    if (!client) return;
    setGeneratingVisuals(true);
    setVariationModalOpen(false);
    try {
      const res = await fetch('/api/creative-studio/visuals/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client.id,
          entityType: 'client',
          entityId: client.id,
          entityName: client.company || client.name,
          assetType: asset.assetType,
          variationOf: asset.id,
          variationDirection: direction,
          count: 2,
        }),
      });
      const data = await res.json();
      if (data.success) {
        visualAssetsHook.refetch();
      }
    } catch (err) {
      console.error('Variation generation failed:', err);
    } finally {
      setGeneratingVisuals(false);
    }
  }, [client, visualAssetsHook]);

  const handleInjectIntoDesign = useCallback(async (asset: ClientVisualAsset) => {
    try {
      await fetch(`/api/data/client-visual-assets/${asset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...asset, status: 'injected' }),
      });
      visualAssetsHook.refetch();
    } catch (err) { console.error(err); }
  }, [visualAssetsHook]);

  // ─── Campaign Factory handlers ──────────────────────────────────────────
  const handleCreateCampaign = useCallback(async () => {
    if (!client || !cfTitle.trim()) return;
    setGeneratingCampaign(true);
    setShowCampaignCreator(false);
    try {
      const res = await fetch('/api/creative-studio/campaign-factory/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client.id,
          title: cfTitle,
          objective: cfObjective,
          campaignType: cfType,
          industry: cfIndustry || client.company || '',
          targetAudience: cfAudience,
          offer: cfOffer,
          mainMessage: cfMessage,
        }),
      });
      const data = await res.json();
      if (data.success) {
        campaignFactoryHook.refetch();
        campaignAssetsHook.refetch();
        copySetsHook.refetch();
        // Reset form
        setCfTitle(''); setCfObjective(''); setCfType('lead_generation');
        setCfIndustry(''); setCfAudience(''); setCfOffer(''); setCfMessage('');
      }
    } catch (err) { console.error('Campaign creation failed:', err); }
    finally { setGeneratingCampaign(false); }
  }, [client, cfTitle, cfObjective, cfType, cfIndustry, cfAudience, cfOffer, cfMessage, campaignFactoryHook, campaignAssetsHook, copySetsHook]);

  const handleApproveCampaignAsset = useCallback(async (asset: CampaignFactoryAsset) => {
    try {
      await fetch(`/api/data/campaign-factory-assets/${asset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...asset, status: 'approved', isApproved: true, isRejected: false }),
      });
      campaignAssetsHook.refetch();
    } catch (err) { console.error(err); }
  }, [campaignAssetsHook]);

  const handleRejectCampaignAsset = useCallback(async (asset: CampaignFactoryAsset) => {
    try {
      await fetch(`/api/data/campaign-factory-assets/${asset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...asset, status: 'rejected', isRejected: true, isApproved: false }),
      });
      campaignAssetsHook.refetch();
    } catch (err) { console.error(err); }
  }, [campaignAssetsHook]);

  const handleApproveAllAssets = useCallback(async (campaignId: string) => {
    const assets = entityCampaignAssets.filter(a => a.campaignId === campaignId && a.status !== 'approved');
    for (const asset of assets) {
      await fetch(`/api/data/campaign-factory-assets/${asset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...asset, status: 'approved', isApproved: true, isRejected: false }),
      });
    }
    campaignAssetsHook.refetch();
  }, [entityCampaignAssets, campaignAssetsHook]);

  const handleArchiveCampaign = useCallback(async (campaign: CampaignFactoryCampaign) => {
    try {
      await fetch(`/api/data/campaign-factory-campaigns/${campaign.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...campaign, status: 'archived' }),
      });
      campaignFactoryHook.refetch();
    } catch (err) { console.error(err); }
  }, [campaignFactoryHook]);

  const handleDuplicateCampaign = useCallback(async (campaign: CampaignFactoryCampaign) => {
    setCfTitle(campaign.title + ' (עותק)');
    setCfObjective(campaign.objective);
    setCfType(campaign.campaignType);
    setCfIndustry(campaign.industry);
    setCfAudience(campaign.targetAudience);
    setCfOffer(campaign.offer);
    setCfMessage(campaign.mainMessage);
    setShowCampaignCreator(true);
  }, []);

  const renderConcepts = () => {
    const approved = concepts.filter((c) => c.isApproved);
    const favorites = concepts.filter((c) => c.isFavorite && !c.isApproved);
    const others = concepts.filter((c) => !c.isApproved && !c.isFavorite && !c.isRejected);
    const rejected = concepts.filter((c) => c.isRejected);

    const getConfidenceColor = (score: number) => {
      if (score >= 70) return "#22c55e";
      if (score >= 45) return "var(--neon-yellow)";
      return "var(--foreground-muted)";
    };

    const renderConceptCard = (concept: CreativeConcept) => (
      <div
        key={concept.id}
        style={{
          background: concept.isApproved
            ? "linear-gradient(135deg, rgba(34,197,94,0.08), var(--surface-raised))"
            : concept.isFavorite
            ? "linear-gradient(135deg, rgba(240,255,2,0.06), var(--surface-raised))"
            : "var(--surface-raised)",
          border: concept.isApproved
            ? "1px solid rgba(34,197,94,0.3)"
            : concept.isFavorite
            ? "1px solid rgba(240,255,2,0.2)"
            : "1px solid var(--border)",
          borderRadius: 14,
          padding: 20,
          cursor: "pointer",
          transition: "all 0.2s",
          position: "relative" as const,
        }}
        onClick={() => openConceptDetail(concept)}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", marginBottom: 4, direction: "rtl" }}>
              {concept.title}
            </div>
            <div style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>
              {CONCEPT_TYPE_LABELS_CLIENT[concept.conceptType] || concept.conceptType}
            </div>
          </div>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: `${getConfidenceColor(concept.confidenceScore)}15`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginRight: 12,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 800, color: getConfidenceColor(concept.confidenceScore) }}>
              {concept.confidenceScore}
            </span>
          </div>
        </div>

        {/* Marketing Angle */}
        <div style={{ fontSize: 13, color: "var(--foreground-muted)", lineHeight: 1.5, marginBottom: 12, direction: "rtl" }}>
          {concept.marketingAngle?.slice(0, 120)}{concept.marketingAngle?.length > 120 ? "…" : ""}
        </div>

        {/* Audience */}
        <div style={{ fontSize: 11, color: "var(--foreground-muted)", marginBottom: 16, direction: "rtl" }}>
          <span style={{ fontWeight: 600, color: "var(--foreground)" }}>קהל יעד: </span>
          {concept.recommendedAudience || "—"}
        </div>

        {/* Actions */}
        <div
          style={{ display: "flex", gap: 6, borderTop: "1px solid var(--border)", paddingTop: 12 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => handleFavoriteConcept(concept)}
            style={{
              flex: 1,
              padding: "6px 0",
              border: "none",
              borderRadius: 6,
              background: concept.isFavorite ? "rgba(240,255,2,0.15)" : "var(--surface)",
              color: concept.isFavorite ? "var(--neon-yellow)" : "var(--foreground-muted)",
              fontSize: 12,
              cursor: "pointer",
              fontWeight: concept.isFavorite ? 700 : 500,
            }}
          >
            {concept.isFavorite ? "★ מועדף" : "☆ מועדף"}
          </button>
          <button
            onClick={() => handleApproveConcept(concept)}
            style={{
              flex: 1,
              padding: "6px 0",
              border: "none",
              borderRadius: 6,
              background: concept.isApproved ? "rgba(34,197,94,0.15)" : "var(--surface)",
              color: concept.isApproved ? "#22c55e" : "var(--foreground-muted)",
              fontSize: 12,
              cursor: "pointer",
              fontWeight: concept.isApproved ? 700 : 500,
            }}
          >
            {concept.isApproved ? "✓ מאושר" : "אשר"}
          </button>
          <button
            onClick={() => handleDeleteConcept(concept)}
            style={{
              padding: "6px 10px",
              border: "none",
              borderRadius: 6,
              background: "var(--surface)",
              color: "#ef4444",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      </div>
    );

    return (
      <div style={{ direction: "rtl" }}>
        {/* Header + Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <SectionTitle>קונספטים שיווקיים</SectionTitle>
            <div style={{ fontSize: 13, color: "var(--foreground-muted)", marginTop: 4 }}>
              {concepts.length > 0
                ? `${concepts.length} קונספטים | ${approved.length} מאושרים | ${favorites.length} מועדפים`
                : "ZONO מייצר קונספטים שיווקיים מבוססי DNA"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {concepts.length > 0 && (
              <Btn variant="default" onClick={handleGenerateConcepts} disabled={generatingConcepts}>
                {generatingConcepts ? "מרענן…" : "רענן קונספטים"}
              </Btn>
            )}
            <Btn variant="accent" onClick={handleGenerateConcepts} disabled={generatingConcepts}>
              {generatingConcepts ? "ZONO חושב…" : concepts.length > 0 ? "צור עוד" : "צור קונספטים"}
            </Btn>
          </div>
        </div>

        {/* Loading */}
        {conceptsLoading && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--foreground-muted)" }}>
            טוען קונספטים…
          </div>
        )}

        {/* Empty State */}
        {!conceptsLoading && concepts.length === 0 && !generatingConcepts && (
          <SectionCard>
            <div style={{ textAlign: "center", padding: "48px 32px" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>💡</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--foreground)", marginBottom: 8 }}>
                עדיין אין קונספטים שיווקיים
              </div>
              <div style={{ fontSize: 14, color: "var(--foreground-muted)", maxWidth: 440, margin: "0 auto", lineHeight: 1.6 }}>
                ZONO ינתח את ה-Marketing DNA של הלקוח וייצר קונספטים שיווקיים מותאמים אישית.
                <br />
                כל קונספט כולל זווית שיווקית, טריגר רגשי, הוק ויזואלי, וקהל יעד מומלץ.
              </div>
              <div style={{ marginTop: 24 }}>
                <Btn variant="accent" onClick={handleGenerateConcepts}>
                  צור קונספטים
                </Btn>
              </div>
            </div>
          </SectionCard>
        )}

        {/* Generating State */}
        {generatingConcepts && (
          <SectionCard>
            <div style={{ textAlign: "center", padding: "48px 32px" }}>
              <div style={{ fontSize: 40, marginBottom: 16, animation: "pulse 1.5s infinite" }}>🧠</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--accent)", marginBottom: 8 }}>
                ZONO מייצר קונספטים שיווקיים…
              </div>
              <div style={{ fontSize: 13, color: "var(--foreground-muted)" }}>
                מנתח DNA שיווקי, בונה זוויות שיווקיות, מתאים קהלי יעד
              </div>
            </div>
          </SectionCard>
        )}

        {/* Concepts Grid */}
        {!conceptsLoading && concepts.length > 0 && (
          <>
            {/* Approved */}
            {approved.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#22c55e", marginBottom: 12 }}>
                  ✓ קונספטים מאושרים ({approved.length})
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
                  {approved.map(renderConceptCard)}
                </div>
              </div>
            )}

            {/* Favorites */}
            {favorites.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--neon-yellow)", marginBottom: 12 }}>
                  ★ מועדפים ({favorites.length})
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
                  {favorites.map(renderConceptCard)}
                </div>
              </div>
            )}

            {/* Others */}
            {others.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                {(approved.length > 0 || favorites.length > 0) && (
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground-muted)", marginBottom: 12 }}>
                    קונספטים נוספים ({others.length})
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
                  {others.map(renderConceptCard)}
                </div>
              </div>
            )}

            {/* Rejected (collapsed) */}
            {rejected.length > 0 && (
              <div style={{ marginTop: 16, opacity: 0.5 }}>
                <div style={{ fontSize: 12, color: "var(--foreground-muted)", marginBottom: 8 }}>
                  נדחו ({rejected.length})
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
                  {rejected.map(renderConceptCard)}
                </div>
              </div>
            )}
          </>
        )}

        {/* Detail Modal */}
        {conceptDetailOpen && selectedConcept && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(8px)",
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
            }}
            onClick={() => setConceptDetailOpen(false)}
          >
            <div
              style={{
                background: "var(--surface-raised)",
                borderRadius: 20,
                maxWidth: 680,
                width: "100%",
                maxHeight: "85vh",
                overflow: "auto",
                padding: 32,
                direction: "rtl",
                border: "1px solid var(--border)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "var(--foreground)", marginBottom: 4 }}>
                    {selectedConcept.title}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600 }}>
                    {CONCEPT_TYPE_LABELS_CLIENT[selectedConcept.conceptType] || selectedConcept.conceptType}
                    <span style={{ margin: "0 8px", color: "var(--border)" }}>|</span>
                    <span style={{ color: getConfidenceColor(selectedConcept.confidenceScore) }}>
                      ביטחון: {selectedConcept.confidenceScore}%
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setConceptDetailOpen(false)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: "none",
                    background: "var(--surface)",
                    color: "var(--foreground-muted)",
                    fontSize: 16,
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Detail Fields */}
              {[
                { label: "תיאור", value: selectedConcept.description },
                { label: "זווית שיווקית", value: selectedConcept.marketingAngle },
                { label: "טריגר רגשי", value: selectedConcept.emotionalTrigger },
                { label: "הוק ויזואלי", value: selectedConcept.visualHook },
                { label: "הוק קופי", value: selectedConcept.copyHook },
                { label: "פריסה מומלצת", value: selectedConcept.recommendedLayout },
                { label: "סגנון CTA מומלץ", value: selectedConcept.recommendedCtaStyle },
                { label: "קהל יעד", value: selectedConcept.recommendedAudience },
                { label: "למה ZONO חושב שזה מתאים", value: selectedConcept.reasoning },
              ].map((field) =>
                field.value ? (
                  <div key={field.label} style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", marginBottom: 4, textTransform: "uppercase" as const }}>
                      {field.label}
                    </div>
                    <div style={{ fontSize: 14, color: "var(--foreground)", lineHeight: 1.7 }}>
                      {field.value}
                    </div>
                  </div>
                ) : null,
              )}

              {/* Modal Actions */}
              <div style={{ display: "flex", gap: 10, marginTop: 24, borderTop: "1px solid var(--border)", paddingTop: 20 }}>
                <Btn
                  variant={selectedConcept.isFavorite ? "accent" : "default"}
                  onClick={() => handleFavoriteConcept(selectedConcept)}
                >
                  {selectedConcept.isFavorite ? "★ מועדף" : "☆ הוסף למועדפים"}
                </Btn>
                <Btn
                  variant={selectedConcept.isApproved ? "accent" : "default"}
                  onClick={() => handleApproveConcept(selectedConcept)}
                >
                  {selectedConcept.isApproved ? "✓ מאושר" : "אשר קונספט"}
                </Btn>
                <Btn
                  variant="default"
                  onClick={() => handleRejectConcept(selectedConcept)}
                >
                  {selectedConcept.isRejected ? "בטל דחייה" : "דחה"}
                </Btn>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── 8. Designs ─────────────────────────────────────────────────────────────
  const renderDesigns = () => {
    const filteredSets = designTypeFilter === 'all'
      ? entityDesignSets
      : entityDesignSets.filter((ds: DesignSet) => ds.designType === designTypeFilter);

    const approvedSets = entityDesignSets.filter((ds: DesignSet) => ds.status === 'approved');
    const allVariants = designVariantsHook.data || [];

    const designOutputTypes: DesignOutputType[] = [
      'feed_post', 'story', 'carousel', 'banner', 'website_hero', 'google_display', 'reel_cover',
    ];

    const layoutGradients: Record<string, string> = {
      editorial: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      luxury: 'linear-gradient(135deg, #b8860b 0%, #2c2c2c 100%)',
      minimal: 'linear-gradient(135deg, #e0e0e0 0%, #f5f5f5 100%)',
      sales: 'linear-gradient(135deg, #ff6b6b 0%, #ffa500 100%)',
      corporate: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)',
      real_estate_premium: 'linear-gradient(135deg, #1a1a2e 0%, #c9a96e 100%)',
      magazine: 'linear-gradient(135deg, #e74c3c 0%, #2c3e50 100%)',
      modern_tech: 'linear-gradient(135deg, #00B5FE 0%, #0a0a2e 100%)',
      split_layout: 'linear-gradient(135deg, #00B5FE 0%, #F0FF02 100%)',
      hero_image: 'linear-gradient(135deg, #2d3436 0%, #636e72 100%)',
      offer_layout: 'linear-gradient(135deg, #F0FF02 0%, #00B5FE 100%)',
    };

    const statusColors: Record<string, string> = {
      draft: '#888', generating: '#f59e0b', ready: '#00B5FE',
      approved: '#22c55e', rejected: '#ef4444', archived: '#6b7280',
    };

    return (
      <div style={{ direction: 'rtl' }}>
        {/* Header + Stats */}
        <SectionCard style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <SectionTitle>עיצובים</SectionTitle>
              <div style={{ display: 'flex', gap: 20, fontSize: 13, color: 'var(--foreground-muted)' }}>
                <span>סה״כ סטים: <strong style={{ color: 'var(--foreground)' }}>{entityDesignSets.length}</strong></span>
                <span>מאושרים: <strong style={{ color: '#22c55e' }}>{approvedSets.length}</strong></span>
                {generatingDesigns && (
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                    ⏳ מייצר עיצובים...
                  </span>
                )}
              </div>
            </div>
            <Btn variant="accent" onClick={() => handleGenerateDesigns('feed_post')} disabled={generatingDesigns}>
              {generatingDesigns ? 'ZONO מעצב...' : 'ייצר סט עיצובים'}
            </Btn>
          </div>
        </SectionCard>

        {/* Design Type Filter Bar */}
        <div style={{
          display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 20,
          flexWrap: 'wrap',
        }}>
          <button
            onClick={() => setDesignTypeFilter('all')}
            style={{
              padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
              background: designTypeFilter === 'all' ? 'var(--accent)' : 'var(--surface-raised)',
              color: designTypeFilter === 'all' ? '#000' : 'var(--foreground-muted)',
            }}
          >
            הכל
          </button>
          {designOutputTypes.map((dt) => (
            <button
              key={dt}
              onClick={() => setDesignTypeFilter(dt)}
              style={{
                padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
                background: designTypeFilter === dt ? 'var(--accent)' : 'var(--surface-raised)',
                color: designTypeFilter === dt ? '#000' : 'var(--foreground-muted)',
              }}
            >
              {DESIGN_OUTPUT_LABELS[dt] || dt}
            </button>
          ))}
        </div>

        {/* Empty State */}
        {!designSetsHook.loading && filteredSets.length === 0 && !generatingDesigns && (
          <SectionCard style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎨</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 8px' }}>
              עדיין לא נוצרו עיצובים
            </h3>
            <p style={{ color: 'var(--foreground-muted)', fontSize: 14, margin: '0 0 20px' }}>
              ZONO ייצר עיצובים מותאמים על בסיס ה-Brand DNA והקונספטים של הלקוח
            </p>
            <Btn variant="accent" onClick={() => handleGenerateDesigns('feed_post')}>
              צור סט עיצובים ראשון
            </Btn>
          </SectionCard>
        )}

        {/* Loading spinner */}
        {generatingDesigns && (
          <SectionCard style={{ textAlign: 'center', padding: '40px 24px', marginBottom: 20 }}>
            <div style={{
              width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--accent)',
              borderRadius: '50%', margin: '0 auto 16px',
              animation: 'spin 1s linear infinite',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ color: 'var(--foreground-muted)', fontSize: 14, margin: 0 }}>ZONO מייצר עיצובים...</p>
          </SectionCard>
        )}

        {/* Design Sets Grid */}
        {filteredSets.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}>
            {filteredSets.map((ds: DesignSet) => {
              const dsVariants = allVariants.filter((v: DesignVariant) => v.designSetId === ds.id);
              const firstVariant = dsVariants[0] as DesignVariant | undefined;
              const stColor = statusColors[ds.status] || '#888';

              return (
                <div
                  key={ds.id}
                  onClick={() => openDesignViewer(ds)}
                  style={{
                    background: 'var(--surface-raised)',
                    border: '1px solid var(--border)',
                    borderRadius: 14,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,181,254,0.12)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                  }}
                >
                  {/* Thumbnail */}
                  <div style={{
                    height: 160,
                    background: layoutGradients[ds.layoutType] || 'linear-gradient(135deg, #333 0%, #555 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                  }}>
                    <span style={{ fontSize: 40, opacity: 0.6 }}>🎨</span>
                    {/* Status badge */}
                    <span style={{
                      position: 'absolute', top: 10, left: 10,
                      padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                      background: `${stColor}22`, color: stColor, border: `1px solid ${stColor}44`,
                    }}>
                      {DESIGN_STATUS_LABELS[ds.status] || ds.status}
                    </span>
                    {/* Variants count */}
                    <span style={{
                      position: 'absolute', bottom: 10, right: 10,
                      padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                      background: 'rgba(0,0,0,0.6)', color: '#fff',
                    }}>
                      {ds.totalVariants || dsVariants.length} וריאנטים
                    </span>
                  </div>

                  {/* Card body */}
                  <div style={{ padding: '14px 16px' }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 6px', lineHeight: 1.4 }}>
                      {ds.title || 'סט עיצובים'}
                    </h4>
                    {ds.conceptTitle && (
                      <p style={{ fontSize: 12, color: 'var(--foreground-muted)', margin: '0 0 8px' }}>
                        קונספט: {ds.conceptTitle}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                        background: 'rgba(0,181,254,0.12)', color: 'var(--accent)',
                        border: '1px solid rgba(0,181,254,0.25)',
                      }}>
                        {DESIGN_OUTPUT_LABELS[ds.designType] || ds.designType}
                      </span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                        background: 'rgba(240,255,2,0.12)', color: '#c5cc00',
                        border: '1px solid rgba(240,255,2,0.25)',
                      }}>
                        {DESIGN_LAYOUT_LABELS[ds.layoutType] || ds.layoutType}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
                        {fmtDate(ds.createdAt)}
                      </span>
                      <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                        {firstVariant && (
                          <button
                            onClick={() => handleFavoriteDesignVariant(firstVariant)}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 4,
                              color: firstVariant.isFavorite ? '#f59e0b' : 'var(--foreground-muted)',
                            }}
                            title="מועדף"
                          >
                            {firstVariant.isFavorite ? '★' : '☆'}
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteDesignSet(ds)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: 4,
                            color: 'var(--foreground-muted)',
                          }}
                          title="מחק"
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Design Viewer Modal */}
        {designViewerOpen && selectedDesignSet && (() => {
          const dsVariants = allVariants.filter((v: DesignVariant) => v.designSetId === selectedDesignSet.id);
          const currentVariant = selectedVariant || dsVariants[0];
          const scores = currentVariant?.scores as DesignScore | undefined;

          return (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
              zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
              direction: 'rtl',
            }}>
              <div style={{
                width: '94vw', maxWidth: 1200, height: '88vh',
                background: 'var(--surface)', borderRadius: 16, overflow: 'hidden',
                display: 'grid', gridTemplateColumns: '80px 1fr 300px',
                border: '1px solid var(--border)',
                boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
              }}>
                {/* Left panel — variant thumbnails */}
                <div style={{
                  background: 'var(--surface-raised)', borderLeft: '1px solid var(--border)',
                  overflowY: 'auto', padding: '12px 8px',
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  {dsVariants.map((v: DesignVariant, idx: number) => (
                    <button
                      key={v.id}
                      onClick={() => { setSelectedVariant(v); setEditingVariant(null); }}
                      style={{
                        width: 60, height: 60, borderRadius: 8, cursor: 'pointer',
                        border: currentVariant?.id === v.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                        background: layoutGradients[v.layoutType] || 'var(--surface)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, color: '#fff',
                        flexShrink: 0,
                      }}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>

                {/* Center — preview */}
                <div style={{
                  overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 24, background: '#1a1a1a',
                }}>
                  {currentVariant?.previewHtml ? (
                    <div style={{
                      width: currentVariant.width || 540,
                      maxWidth: '100%',
                      aspectRatio: `${currentVariant.width || 1080} / ${currentVariant.height || 1350}`,
                      overflow: 'hidden',
                      borderRadius: 8,
                      boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
                      background: '#fff',
                    }}>
                      <div
                        style={{
                          width: currentVariant.width || 1080,
                          height: currentVariant.height || 1350,
                          transform: `scale(${Math.min(1, 540 / (currentVariant.width || 1080))})`,
                          transformOrigin: 'top right',
                        }}
                        dangerouslySetInnerHTML={{ __html: currentVariant.previewHtml }}
                      />
                    </div>
                  ) : (
                    <div style={{
                      width: 400, height: 500, borderRadius: 12,
                      background: layoutGradients[selectedDesignSet.layoutType] || '#333',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexDirection: 'column', gap: 12,
                    }}>
                      <span style={{ fontSize: 56 }}>🎨</span>
                      <span style={{ color: '#fff', fontSize: 14, opacity: 0.7 }}>אין תצוגה מקדימה</span>
                    </div>
                  )}
                </div>

                {/* Right panel — details */}
                <div style={{
                  background: 'var(--surface-raised)', borderRight: '1px solid var(--border)',
                  overflowY: 'auto', padding: 20, direction: 'rtl',
                }}>
                  {/* Close button */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
                      {selectedDesignSet.title || 'סט עיצובים'}
                    </h3>
                    <button
                      onClick={() => { setDesignViewerOpen(false); setSelectedDesignSet(null); setSelectedVariant(null); setEditingVariant(null); }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 20, color: 'var(--foreground-muted)', padding: 4,
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  {currentVariant && (
                    <>
                      <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 16px' }}>
                        {currentVariant.variantName || `וריאנט ${(currentVariant.variantIndex || 0) + 1}`}
                      </p>

                      {/* Scores */}
                      {scores && (
                        <div style={{ marginBottom: 20 }}>
                          <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 12px' }}>ציונים</h4>
                          <ScoreBar label="התאמת מותג" value={scores.brandMatch ?? 0} />
                          <ScoreBar label="קריאות" value={scores.readability ?? 0} />
                          <ScoreBar label="קריאות מובייל" value={scores.mobileReadability ?? 0} />
                          <ScoreBar label="היררכיה ויזואלית" value={scores.visualHierarchy ?? 0} />
                          <ScoreBar label="פוטנציאל המרה" value={scores.conversionPotential ?? 0} />
                          <div style={{
                            marginTop: 8, padding: '8px 12px', borderRadius: 8,
                            background: 'rgba(0,181,254,0.08)', border: '1px solid rgba(0,181,254,0.2)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>ציון כולל</span>
                            <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>{scores.overall ?? 0}</span>
                          </div>
                        </div>
                      )}

                      {/* Meta info */}
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                            background: 'rgba(0,181,254,0.12)', color: 'var(--accent)',
                          }}>
                            {DESIGN_OUTPUT_LABELS[selectedDesignSet.designType] || selectedDesignSet.designType}
                          </span>
                          <span style={{
                            padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                            background: 'rgba(240,255,2,0.12)', color: '#c5cc00',
                          }}>
                            {DESIGN_LAYOUT_LABELS[currentVariant.layoutType] || currentVariant.layoutType}
                          </span>
                        </div>
                        {selectedDesignSet.conceptTitle && (
                          <p style={{ fontSize: 12, color: 'var(--foreground-muted)', margin: '0 0 4px' }}>
                            קונספט: {selectedDesignSet.conceptTitle}
                          </p>
                        )}
                        <p style={{ fontSize: 11, color: 'var(--foreground-muted)', margin: 0 }}>
                          {fmtDate(selectedDesignSet.createdAt)}
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                        <Btn
                          variant={currentVariant.isFavorite ? 'yellow' : 'ghost'}
                          onClick={() => handleFavoriteDesignVariant(currentVariant)}
                          style={{ flex: 1 }}
                        >
                          {currentVariant.isFavorite ? '★ מועדף' : '☆ מועדף'}
                        </Btn>
                        <Btn
                          variant={currentVariant.isApproved ? 'accent' : 'ghost'}
                          onClick={() => handleApproveDesignVariant(currentVariant)}
                          style={{ flex: 1 }}
                        >
                          {currentVariant.isApproved ? '✓ מאושר' : '✓ אשר'}
                        </Btn>
                        <Btn
                          variant={currentVariant.isRejected ? 'danger' : 'ghost'}
                          onClick={() => handleRejectDesignVariant(currentVariant)}
                          style={{ flex: 1 }}
                        >
                          {currentVariant.isRejected ? '✗ נדחה' : '✗ דחה'}
                        </Btn>
                      </div>

                      {/* Edit button */}
                      <Btn
                        variant="default"
                        onClick={() => setEditingVariant(editingVariant?.id === currentVariant.id ? null : currentVariant)}
                        style={{ width: '100%' }}
                      >
                        {editingVariant?.id === currentVariant.id ? 'סגור עורך' : '✏️ ערוך אלמנטים'}
                      </Btn>
                    </>
                  )}

                  {!currentVariant && (
                    <p style={{ color: 'var(--foreground-muted)', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
                      אין וריאנטים לסט זה
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Design Editor Foundation */}
        {editingVariant && (
          <SectionCard style={{ marginTop: 20 }}>
            <SectionTitle>עורך אלמנטים — {editingVariant.variantName || `וריאנט ${(editingVariant.variantIndex || 0) + 1}`}</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {editingVariant.designJson?.elements?.map((el, elIdx) => {
                const isTextEl = ['headline', 'subtitle', 'body_text', 'cta_button'].includes(el.type);
                return (
                  <div
                    key={el.id || elIdx}
                    style={{
                      padding: 14, borderRadius: 10,
                      background: el.visible === false ? 'rgba(100,100,100,0.08)' : 'var(--surface)',
                      border: '1px solid var(--border)',
                      opacity: el.visible === false ? 0.5 : 1,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14 }}>
                          {el.type === 'headline' ? '🔤' : el.type === 'subtitle' ? '📝' : el.type === 'body_text' ? '📄' : el.type === 'cta_button' ? '🔘' : el.type === 'image' ? '🖼️' : el.type === 'logo' ? '✦' : '◻️'}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
                          {el.type === 'headline' ? 'כותרת' : el.type === 'subtitle' ? 'כותרת משנה' : el.type === 'body_text' ? 'גוף טקסט' : el.type === 'cta_button' ? 'כפתור CTA' : el.type === 'image' ? 'תמונה' : el.type === 'logo' ? 'לוגו' : el.type}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          const updated = { ...editingVariant };
                          const elements = [...(updated.designJson?.elements || [])];
                          elements[elIdx] = { ...elements[elIdx], visible: elements[elIdx].visible === false ? true : false };
                          updated.designJson = { ...updated.designJson, elements };
                          setEditingVariant(updated);
                        }}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', fontSize: 16,
                          color: el.visible === false ? 'var(--foreground-muted)' : 'var(--accent)',
                        }}
                      >
                        {el.visible === false ? '👁️‍🗨️' : '👁️'}
                      </button>
                    </div>

                    {isTextEl && (
                      <div style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: 11, color: 'var(--foreground-muted)', display: 'block', marginBottom: 4 }}>טקסט</label>
                        <input
                          type="text"
                          value={el.props?.text || ''}
                          onChange={(e) => {
                            const updated = { ...editingVariant };
                            const elements = [...(updated.designJson?.elements || [])];
                            elements[elIdx] = { ...elements[elIdx], props: { ...elements[elIdx].props, text: e.target.value } };
                            updated.designJson = { ...updated.designJson, elements };
                            setEditingVariant(updated);
                          }}
                          style={{
                            width: '100%', padding: '6px 10px', borderRadius: 6,
                            border: '1px solid var(--border)', background: 'var(--surface-raised)',
                            color: 'var(--foreground)', fontSize: 13, direction: 'rtl',
                          }}
                        />
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <div>
                        <label style={{ fontSize: 11, color: 'var(--foreground-muted)', display: 'block', marginBottom: 4 }}>צבע</label>
                        <input
                          type="text"
                          value={el.style?.color || ''}
                          placeholder="#000000"
                          onChange={(e) => {
                            const updated = { ...editingVariant };
                            const elements = [...(updated.designJson?.elements || [])];
                            elements[elIdx] = { ...elements[elIdx], style: { ...elements[elIdx].style, color: e.target.value } };
                            updated.designJson = { ...updated.designJson, elements };
                            setEditingVariant(updated);
                          }}
                          style={{
                            width: 90, padding: '6px 10px', borderRadius: 6,
                            border: '1px solid var(--border)', background: 'var(--surface-raised)',
                            color: 'var(--foreground)', fontSize: 12,
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: 'var(--foreground-muted)', display: 'block', marginBottom: 4 }}>גודל גופן</label>
                        <input
                          type="number"
                          value={el.style?.fontSize || ''}
                          onChange={(e) => {
                            const updated = { ...editingVariant };
                            const elements = [...(updated.designJson?.elements || [])];
                            elements[elIdx] = { ...elements[elIdx], style: { ...elements[elIdx].style, fontSize: Number(e.target.value) } };
                            updated.designJson = { ...updated.designJson, elements };
                            setEditingVariant(updated);
                          }}
                          style={{
                            width: 70, padding: '6px 10px', borderRadius: 6,
                            border: '1px solid var(--border)', background: 'var(--surface-raised)',
                            color: 'var(--foreground)', fontSize: 12,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <Btn
                variant="accent"
                onClick={async () => {
                  await designVariantsHook.update(editingVariant.id, {
                    designJson: editingVariant.designJson,
                  } as Partial<DesignVariant>);
                  setEditingVariant(null);
                  designVariantsHook.refetch();
                }}
              >
                עדכן עיצוב
              </Btn>
              <Btn variant="ghost" onClick={() => setEditingVariant(null)}>
                ביטול
              </Btn>
            </div>
          </SectionCard>
        )}
      </div>
    );
  };

  // ── 9. Visuals ─────────────────────────────────────────────────────────────
  const renderVisuals = () => {
    const filteredVisuals = visualTypeFilter === 'all'
      ? entityVisualAssets
      : entityVisualAssets.filter((a) => a.assetType === visualTypeFilter);

    const approvedVisuals = entityVisualAssets.filter((a) => a.isApproved);
    const pendingVisuals = entityVisualAssets.filter((a) => !a.isApproved && !a.isRejected);
    const activeJobs = entityVisualJobs.filter((j) => j.status === 'processing' || j.status === 'queued');

    const visualAssetTypes: VisualAssetType[] = [
      'hero_image', 'advertising_visual', 'background', 'project_render', 'lifestyle_imagery', 'brand_visual',
    ];

    const allVisualTypes: VisualAssetType[] = [
      'hero_image', 'advertising_visual', 'background', 'project_render', 'lifestyle_imagery',
      'scene_extension', 'image_variation', 'image_improvement', 'image_upscale', 'image_cleanup',
      'object_replacement', 'brand_visual',
    ];

    const statusColors: Record<string, string> = {
      generated: '#00B5FE', approved: '#22c55e', rejected: '#ef4444',
      favorite: '#f59e0b', injected: '#a855f7',
    };

    const providerLabels: Record<string, string> = {
      gemini: 'Gemini', openai: 'OpenAI', mock: 'Mock',
    };

    const typeEmojis: Record<string, string> = {
      hero_image: '🖼️', advertising_visual: '📢', background: '🌄',
      project_render: '🏗️', lifestyle_imagery: '🌟', brand_visual: '✦',
    };

    return (
      <div style={{ direction: 'rtl' }}>
        {/* Header + Stats */}
        <SectionCard style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <SectionTitle>ויז'ואלים AI</SectionTitle>
              <div style={{ display: 'flex', gap: 20, fontSize: 13, color: 'var(--foreground-muted)' }}>
                <span>סה״כ: <strong style={{ color: 'var(--foreground)' }}>{entityVisualAssets.length}</strong></span>
                <span>מאושרים: <strong style={{ color: '#22c55e' }}>{approvedVisuals.length}</strong></span>
                <span>ממתינים: <strong style={{ color: 'var(--accent)' }}>{pendingVisuals.length}</strong></span>
                {activeJobs.length > 0 && (
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                    ⏳ {activeJobs.length} משימות פעילות
                  </span>
                )}
                {generatingVisuals && (
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                    ⏳ מייצר ויז'ואלים...
                  </span>
                )}
              </div>
            </div>
            <Btn variant="accent" onClick={() => handleGenerateVisuals('hero_image')} disabled={generatingVisuals}>
              {generatingVisuals ? 'מייצר ויז\'ואלים...' : 'ייצר ויז\'ואלים'}
            </Btn>
          </div>
        </SectionCard>

        {/* Generation Type Selector */}
        <SectionCard style={{ marginBottom: 20 }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 14px' }}>
            בחר סוג ויז'ואל לייצור
          </h4>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 12,
          }}>
            {visualAssetTypes.map((vt) => (
              <div
                key={vt}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 14,
                  padding: 16,
                  textAlign: 'center',
                  transition: 'all 0.2s',
                  cursor: generatingVisuals ? 'not-allowed' : 'default',
                  opacity: generatingVisuals ? 0.5 : 1,
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>{typeEmojis[vt] || '🎨'}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 10 }}>
                  {VISUAL_ASSET_TYPE_LABELS[vt]}
                </div>
                <Btn
                  variant="ghost"
                  onClick={() => handleGenerateVisuals(vt)}
                  disabled={generatingVisuals}
                  style={{ width: '100%', fontSize: 12, padding: '6px 12px' }}
                >
                  {generatingVisuals ? '...' : 'ייצר'}
                </Btn>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Asset Type Filter Bar */}
        <div style={{
          display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 20,
          flexWrap: 'wrap',
        }}>
          <button
            onClick={() => setVisualTypeFilter('all')}
            style={{
              padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
              background: visualTypeFilter === 'all' ? 'var(--accent)' : 'var(--surface-raised)',
              color: visualTypeFilter === 'all' ? '#000' : 'var(--foreground-muted)',
            }}
          >
            הכל
          </button>
          {allVisualTypes.map((vt) => (
            <button
              key={vt}
              onClick={() => setVisualTypeFilter(vt)}
              style={{
                padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
                background: visualTypeFilter === vt ? 'var(--accent)' : 'var(--surface-raised)',
                color: visualTypeFilter === vt ? '#000' : 'var(--foreground-muted)',
              }}
            >
              {VISUAL_ASSET_TYPE_LABELS[vt]}
            </button>
          ))}
        </div>

        {/* Active Jobs Status */}
        {activeJobs.length > 0 && (
          <SectionCard style={{ marginBottom: 20, background: 'rgba(0,181,254,0.06)', border: '1px solid rgba(0,181,254,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--accent)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
                  מייצר ויז'ואלים...
                </div>
                <div style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                  {activeJobs.length} משימות בתור — זמן משוער: ~30 שניות
                </div>
              </div>
            </div>
          </SectionCard>
        )}

        {/* Loading spinner */}
        {generatingVisuals && (
          <SectionCard style={{ textAlign: 'center', padding: '40px 24px', marginBottom: 20 }}>
            <div style={{
              width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--accent)',
              borderRadius: '50%', margin: '0 auto 16px',
              animation: 'spin 1s linear infinite',
            }} />
            <p style={{ color: 'var(--foreground-muted)', fontSize: 14, margin: 0 }}>ZONO מייצר ויז'ואלים...</p>
          </SectionCard>
        )}

        {/* Empty State */}
        {!visualAssetsHook.loading && filteredVisuals.length === 0 && !generatingVisuals && (
          <SectionCard style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🖼️</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 8px' }}>
              עדיין לא נוצרו ויז'ואלים
            </h3>
            <p style={{ color: 'var(--foreground-muted)', fontSize: 14, margin: '0 0 20px' }}>
              בחר סוג ויז'ואל למעלה כדי להתחיל
            </p>
            <Btn variant="accent" onClick={() => handleGenerateVisuals('hero_image')}>
              צור ויז'ואל ראשון
            </Btn>
          </SectionCard>
        )}

        {/* Visual Assets Grid */}
        {filteredVisuals.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}>
            {filteredVisuals.map((asset) => {
              const stColor = statusColors[asset.status] || '#888';
              const isDataSvg = asset.imageUrl?.startsWith('data:image/svg');
              const overallScore = asset.scores?.overall ?? null;

              return (
                <div
                  key={asset.id}
                  style={{
                    background: 'var(--surface-raised)',
                    border: '1px solid var(--border)',
                    borderRadius: 14,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                  onClick={() => {
                    setSelectedVisualAsset(asset);
                    setVisualViewerOpen(true);
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,181,254,0.12)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                  }}
                >
                  {/* Image Preview */}
                  <div style={{
                    height: 180,
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    {!isDataSvg && asset.imageUrl ? (
                      <img
                        src={asset.thumbnailUrl || asset.imageUrl}
                        alt={asset.title || 'visual'}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{
                        width: '100%', height: '100%',
                        background: 'linear-gradient(135deg, rgba(0,181,254,0.15) 0%, rgba(240,255,2,0.08) 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ fontSize: 48, opacity: 0.4 }}>🖼️</span>
                      </div>
                    )}
                    {/* Status badge — top-left */}
                    <span style={{
                      position: 'absolute', top: 10, left: 10,
                      padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                      background: `${stColor}22`, color: stColor, border: `1px solid ${stColor}44`,
                    }}>
                      {VISUAL_STATUS_LABELS[asset.status] || asset.status}
                    </span>
                    {/* Asset type badge — top-right */}
                    <span style={{
                      position: 'absolute', top: 10, right: 10,
                      padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                      background: 'rgba(0,181,254,0.15)', color: 'var(--accent)',
                      border: '1px solid rgba(0,181,254,0.3)',
                    }}>
                      {VISUAL_ASSET_TYPE_LABELS[asset.assetType] || asset.assetType}
                    </span>
                    {/* Provider badge — bottom-left */}
                    <span style={{
                      position: 'absolute', bottom: 10, left: 10,
                      padding: '3px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600,
                      background: 'rgba(0,0,0,0.6)', color: '#fff',
                    }}>
                      {providerLabels[asset.provider] || asset.provider}
                    </span>
                    {/* Score — bottom-right */}
                    {overallScore !== null && (
                      <span style={{
                        position: 'absolute', bottom: 10, right: 10,
                        padding: '3px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                        background: overallScore > 70 ? 'rgba(34,197,94,0.2)' : overallScore > 40 ? 'rgba(240,255,2,0.15)' : 'rgba(100,100,100,0.2)',
                        color: overallScore > 70 ? '#22c55e' : overallScore > 40 ? '#c5cc00' : 'var(--foreground-muted)',
                        border: `1px solid ${overallScore > 70 ? 'rgba(34,197,94,0.4)' : overallScore > 40 ? 'rgba(240,255,2,0.3)' : 'rgba(100,100,100,0.3)'}`,
                      }}>
                        {overallScore}
                      </span>
                    )}
                  </div>

                  {/* Card Body */}
                  <div style={{ padding: '14px 16px' }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 6px', lineHeight: 1.4 }}>
                      {asset.title || VISUAL_ASSET_TYPE_LABELS[asset.assetType]}
                    </h4>
                    <div style={{ fontSize: 11, color: 'var(--foreground-muted)', marginBottom: 10 }}>
                      {fmtDate(asset.createdAt)}
                    </div>

                    {/* Action buttons row */}
                    <div
                      style={{ display: 'flex', gap: 4, borderTop: '1px solid var(--border)', paddingTop: 10 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => handleApproveVisual(asset)}
                        title="אשר"
                        style={{
                          background: asset.isApproved ? 'rgba(34,197,94,0.15)' : 'none',
                          border: asset.isApproved ? '1px solid rgba(34,197,94,0.3)' : '1px solid var(--border)',
                          cursor: 'pointer', fontSize: 14, padding: '4px 10px', borderRadius: 8,
                          color: asset.isApproved ? '#22c55e' : 'var(--foreground-muted)',
                        }}
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => handleRejectVisual(asset)}
                        title="דחה"
                        style={{
                          background: asset.isRejected ? 'rgba(239,68,68,0.15)' : 'none',
                          border: asset.isRejected ? '1px solid rgba(239,68,68,0.3)' : '1px solid var(--border)',
                          cursor: 'pointer', fontSize: 14, padding: '4px 10px', borderRadius: 8,
                          color: asset.isRejected ? '#ef4444' : 'var(--foreground-muted)',
                        }}
                      >
                        ✗
                      </button>
                      <button
                        onClick={() => handleFavoriteVisual(asset)}
                        title="מועדף"
                        style={{
                          background: asset.isFavorite ? 'rgba(245,158,11,0.15)' : 'none',
                          border: asset.isFavorite ? '1px solid rgba(245,158,11,0.3)' : '1px solid var(--border)',
                          cursor: 'pointer', fontSize: 14, padding: '4px 10px', borderRadius: 8,
                          color: asset.isFavorite ? '#f59e0b' : 'var(--foreground-muted)',
                        }}
                      >
                        ★
                      </button>
                      <button
                        onClick={() => {
                          setVariationTarget(asset);
                          setVariationModalOpen(true);
                        }}
                        title="וריאציות"
                        style={{
                          background: 'none', border: '1px solid var(--border)',
                          cursor: 'pointer', fontSize: 11, padding: '4px 10px', borderRadius: 8,
                          color: 'var(--foreground-muted)', fontWeight: 600,
                        }}
                      >
                        וריאציות
                      </button>
                      {asset.isApproved && (
                        <button
                          onClick={() => handleInjectIntoDesign(asset)}
                          title="הזרק לעיצוב"
                          style={{
                            background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)',
                            cursor: 'pointer', fontSize: 11, padding: '4px 10px', borderRadius: 8,
                            color: '#a855f7', fontWeight: 600,
                          }}
                        >
                          הזרק לעיצוב
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Visual Detail Viewer Modal */}
        {visualViewerOpen && selectedVisualAsset && (() => {
          const asset = selectedVisualAsset;
          const scores = asset.scores as VisualScore | null;
          const isDataSvg = asset.imageUrl?.startsWith('data:image/svg');

          return (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
              zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
              direction: 'rtl',
            }}>
              <div style={{
                width: '94vw', maxWidth: 1100, height: '88vh',
                background: 'var(--surface)', borderRadius: 16, overflow: 'hidden',
                display: 'grid', gridTemplateColumns: '1fr 320px',
                border: '1px solid var(--border)',
                boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
              }}>
                {/* Left — large image preview */}
                <div style={{
                  overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 24, background: '#1a1a1a',
                }}>
                  {!isDataSvg && asset.imageUrl ? (
                    <img
                      src={asset.imageUrl}
                      alt={asset.title || 'visual'}
                      style={{
                        maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
                        borderRadius: 8, boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
                      }}
                    />
                  ) : (
                    <div style={{
                      width: 400, height: 400, borderRadius: 12,
                      background: 'linear-gradient(135deg, rgba(0,181,254,0.15) 0%, rgba(240,255,2,0.08) 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexDirection: 'column', gap: 12,
                    }}>
                      <span style={{ fontSize: 56 }}>🖼️</span>
                      <span style={{ color: '#fff', fontSize: 14, opacity: 0.7 }}>אין תצוגה מקדימה</span>
                    </div>
                  )}
                </div>

                {/* Right panel — details */}
                <div style={{
                  background: 'var(--surface-raised)', borderRight: '1px solid var(--border)',
                  overflowY: 'auto', padding: 20, direction: 'rtl',
                }}>
                  {/* Close button */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
                      {asset.title || VISUAL_ASSET_TYPE_LABELS[asset.assetType]}
                    </h3>
                    <button
                      onClick={() => { setVisualViewerOpen(false); setSelectedVisualAsset(null); }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 20, color: 'var(--foreground-muted)', padding: 4,
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  {/* Scores */}
                  {scores && (
                    <div style={{ marginBottom: 20 }}>
                      <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 12px' }}>ציונים</h4>
                      <ScoreBar label="התאמת מותג" value={scores.brandMatch ?? 0} />
                      <ScoreBar label="ריאליזם" value={scores.realismScore ?? 0} />
                      <ScoreBar label="קומפוזיציה" value={scores.compositionScore ?? 0} />
                      <ScoreBar label="תאימות קריאות" value={scores.readabilityCompatibility ?? 0} />
                      <ScoreBar label="רמת יוקרה" value={scores.luxuryScore ?? 0} />
                      <ScoreBar label="פוטנציאל המרה" value={scores.conversionPotential ?? 0} />
                      <div style={{
                        marginTop: 8, padding: '8px 12px', borderRadius: 8,
                        background: 'rgba(0,181,254,0.08)', border: '1px solid rgba(0,181,254,0.2)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>ציון כולל</span>
                        <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>{scores.overall ?? 0}</span>
                      </div>
                    </div>
                  )}

                  {/* Meta info */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                        background: 'rgba(0,181,254,0.12)', color: 'var(--accent)',
                      }}>
                        {VISUAL_ASSET_TYPE_LABELS[asset.assetType] || asset.assetType}
                      </span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                        background: `${statusColors[asset.status] || '#888'}22`,
                        color: statusColors[asset.status] || '#888',
                      }}>
                        {VISUAL_STATUS_LABELS[asset.status] || asset.status}
                      </span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                        background: 'rgba(255,255,255,0.06)', color: 'var(--foreground-muted)',
                      }}>
                        {providerLabels[asset.provider] || asset.provider}
                      </span>
                    </div>
                    {asset.generationReason && (
                      <p style={{ fontSize: 12, color: 'var(--foreground-muted)', margin: '0 0 4px' }}>
                        סיבת יצירה: {asset.generationReason}
                      </p>
                    )}
                    {asset.promptVersion && (
                      <p style={{ fontSize: 11, color: 'var(--foreground-muted)', margin: '0 0 4px' }}>
                        גרסת פרומפט: {asset.promptVersion}
                      </p>
                    )}
                    <p style={{ fontSize: 11, color: 'var(--foreground-muted)', margin: 0 }}>
                      {fmtDate(asset.createdAt)}
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                    <Btn
                      variant={asset.isFavorite ? 'yellow' : 'ghost'}
                      onClick={() => handleFavoriteVisual(asset)}
                      style={{ flex: 1 }}
                    >
                      {asset.isFavorite ? '★ מועדף' : '☆ מועדף'}
                    </Btn>
                    <Btn
                      variant={asset.isApproved ? 'accent' : 'ghost'}
                      onClick={() => handleApproveVisual(asset)}
                      style={{ flex: 1 }}
                    >
                      {asset.isApproved ? '✓ מאושר' : '✓ אשר'}
                    </Btn>
                    <Btn
                      variant={asset.isRejected ? 'danger' : 'ghost'}
                      onClick={() => handleRejectVisual(asset)}
                      style={{ flex: 1 }}
                    >
                      {asset.isRejected ? '✗ נדחה' : '✗ דחה'}
                    </Btn>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Btn
                      variant="default"
                      onClick={() => {
                        setVariationTarget(asset);
                        setVariationModalOpen(true);
                      }}
                      style={{ flex: 1 }}
                    >
                      וריאציות
                    </Btn>
                    {asset.isApproved && (
                      <Btn
                        variant="ghost"
                        onClick={() => handleInjectIntoDesign(asset)}
                        style={{ flex: 1 }}
                      >
                        הזרק לעיצוב
                      </Btn>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Variation Direction Modal */}
        {variationModalOpen && variationTarget && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            direction: 'rtl',
          }}>
            <div style={{
              background: 'var(--surface)', borderRadius: 16, padding: 28,
              width: '90vw', maxWidth: 480,
              border: '1px solid var(--border)',
              boxShadow: '0 16px 60px rgba(0,0,0,0.4)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
                  בחר כיוון וריאציה
                </h3>
                <button
                  onClick={() => { setVariationModalOpen(false); setVariationTarget(null); }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 20, color: 'var(--foreground-muted)', padding: 4,
                  }}
                >
                  ✕
                </button>
              </div>
              <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 16px' }}>
                ייצור 2 וריאציות חדשות על בסיס: {variationTarget.title || VISUAL_ASSET_TYPE_LABELS[variationTarget.assetType]}
              </p>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 10,
              }}>
                {VARIATION_DIRECTIONS.map((dir) => (
                  <Btn
                    key={dir.id}
                    variant="ghost"
                    onClick={() => handleGenerateVariation(variationTarget, dir.id)}
                    disabled={generatingVisuals}
                    style={{ fontSize: 13, padding: '10px 14px' }}
                  >
                    {dir.label}
                  </Btn>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── 10. Campaign Factory ─────────────────────────────────────────────────────
  const renderCampaignFactory = () => {
    const activeCampaigns = entityCampaigns.filter(c => c.status !== 'archived');
    const completedCampaigns = entityCampaigns.filter(c => c.status === 'approved' || c.status === 'published');
    const allCampaignTypes: CampaignFactoryType[] = [
      'lead_generation', 'brand_awareness', 'launch_campaign', 'sales_campaign',
      'project_marketing', 'real_estate_project_launch', 'property_marketing',
      'holiday_campaign', 'recruitment_campaign', 'event_campaign',
      'website_traffic', 'remarketing', 'custom',
    ];

    const campaignCopySets = (copySetsHook.data || []).filter((cs: CampaignCopySet) => cs.clientId === client.id);

    const inputStyle: React.CSSProperties = {
      width: '100%',
      padding: 12,
      borderRadius: 12,
      border: '1px solid rgba(255,255,255,0.1)',
      background: 'rgba(255,255,255,0.04)',
      color: '#fff',
      fontSize: 14,
      direction: 'rtl' as const,
      outline: 'none',
      transition: 'border-color 0.2s',
    };

    const textareaStyle: React.CSSProperties = {
      ...inputStyle,
      minHeight: 80,
      resize: 'vertical' as const,
      fontFamily: 'inherit',
    };

    return (
      <div style={{ direction: 'rtl' }}>
        {/* Header + Stats */}
        <SectionCard style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <SectionTitle>מפעל קמפיינים</SectionTitle>
              <p style={{ color: 'var(--foreground-muted)', fontSize: 13, margin: '0 0 12px' }}>
                הפקת חבילה שיווקית מלאה בלחיצה אחת
              </p>
              <div style={{ display: 'flex', gap: 20, fontSize: 13, color: 'var(--foreground-muted)' }}>
                <span>סה״כ: <strong style={{ color: 'var(--foreground)' }}>{entityCampaigns.length}</strong></span>
                <span>פעילים: <strong style={{ color: 'var(--accent)' }}>{activeCampaigns.length}</strong></span>
                <span>הושלמו: <strong style={{ color: '#4CAF50' }}>{completedCampaigns.length}</strong></span>
              </div>
              {generatingCampaign && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent)', fontWeight: 600, fontSize: 13 }}>
                  <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  מייצר חבילת קמפיין...
                </div>
              )}
            </div>
            <Btn variant="accent" onClick={() => setShowCampaignCreator(true)} disabled={generatingCampaign}>
              {generatingCampaign ? 'מייצר...' : 'צור קמפיין חדש'}
            </Btn>
          </div>
        </SectionCard>

        {/* Campaign Creation Form Modal */}
        {showCampaignCreator && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}>
            <div style={{
              background: 'var(--surface)', borderRadius: 16,
              border: '1px solid var(--border)', padding: 32,
              maxWidth: 700, width: '100%', maxHeight: '90vh', overflowY: 'auto',
              direction: 'rtl',
            }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 24px' }}>
                יצירת קמפיין חדש
              </h3>

              {/* Title */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--foreground-muted)', marginBottom: 6 }}>
                  שם הקמפיין *
                </label>
                <input
                  type="text"
                  value={cfTitle}
                  onChange={e => setCfTitle(e.target.value)}
                  placeholder="למשל: קמפיין השקה - דירות חדשות בתל אביב"
                  style={inputStyle}
                />
              </div>

              {/* Objective */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--foreground-muted)', marginBottom: 6 }}>
                  מטרה
                </label>
                <input
                  type="text"
                  value={cfObjective}
                  onChange={e => setCfObjective(e.target.value)}
                  placeholder="מה המטרה המרכזית של הקמפיין?"
                  style={inputStyle}
                />
              </div>

              {/* Campaign Type Grid */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--foreground-muted)', marginBottom: 10 }}>
                  סוג קמפיין
                </label>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: 8,
                }}>
                  {allCampaignTypes.map(ct => (
                    <button
                      key={ct}
                      onClick={() => setCfType(ct)}
                      style={{
                        padding: '10px 8px',
                        borderRadius: 10,
                        border: cfType === ct ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
                        background: cfType === ct ? 'rgba(0,181,254,0.12)' : 'rgba(255,255,255,0.04)',
                        color: cfType === ct ? 'var(--accent)' : 'var(--foreground-muted)',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: cfType === ct ? 700 : 500,
                        textAlign: 'center',
                        transition: 'all 0.15s',
                        display: 'flex',
                        flexDirection: 'column' as const,
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span style={{ fontSize: 20 }}>{CAMPAIGN_TYPE_EMOJIS[ct]}</span>
                      <span>{CAMPAIGN_TYPE_LABELS[ct]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Industry */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--foreground-muted)', marginBottom: 6 }}>
                  תעשייה
                </label>
                <input
                  type="text"
                  value={cfIndustry}
                  onChange={e => setCfIndustry(e.target.value)}
                  placeholder={client.company || 'סוג העסק / תעשייה'}
                  style={inputStyle}
                />
              </div>

              {/* Target Audience */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--foreground-muted)', marginBottom: 6 }}>
                  קהל יעד
                </label>
                <textarea
                  value={cfAudience}
                  onChange={e => setCfAudience(e.target.value)}
                  placeholder="תאר את קהל היעד..."
                  style={textareaStyle}
                />
              </div>

              {/* Offer */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--foreground-muted)', marginBottom: 6 }}>
                  הצעה
                </label>
                <textarea
                  value={cfOffer}
                  onChange={e => setCfOffer(e.target.value)}
                  placeholder="מה ההצעה ללקוח? מה הערך?"
                  style={textareaStyle}
                />
              </div>

              {/* Main Message */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--foreground-muted)', marginBottom: 6 }}>
                  מסר מרכזי
                </label>
                <textarea
                  value={cfMessage}
                  onChange={e => setCfMessage(e.target.value)}
                  placeholder="מה המסר העיקרי שהקמפיין צריך להעביר?"
                  style={textareaStyle}
                />
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-start' }}>
                <Btn variant="accent" onClick={handleCreateCampaign} disabled={!cfTitle.trim()}>
                  התחל הפקה
                </Btn>
                <Btn variant="ghost" onClick={() => setShowCampaignCreator(false)}>
                  ביטול
                </Btn>
              </div>
            </div>
          </div>
        )}

        {/* Campaign Cards Grid */}
        {entityCampaigns.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 16,
          }}>
            {entityCampaigns.map(campaign => {
              const campAssets = entityCampaignAssets.filter(a => a.campaignId === campaign.id);
              const approvedCount = campAssets.filter(a => a.isApproved).length;
              const statusColor = CAMPAIGN_STATUS_COLORS[campaign.status] || '#888';

              return (
                <div
                  key={campaign.id}
                  style={{
                    background: campaign.status === 'approved'
                      ? 'linear-gradient(135deg, rgba(76,175,80,0.06), var(--surface-raised))'
                      : campaign.status === 'generating'
                      ? 'linear-gradient(135deg, rgba(240,255,2,0.04), var(--surface-raised))'
                      : 'var(--surface-raised)',
                    border: `1px solid ${statusColor}33`,
                    borderRadius: 14,
                    padding: 20,
                    transition: 'all 0.2s',
                  }}
                >
                  {/* Campaign Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', marginBottom: 6 }}>
                        {campaign.title}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                        <Badge color="var(--accent)">
                          {CAMPAIGN_TYPE_EMOJIS[campaign.campaignType]} {CAMPAIGN_TYPE_LABELS[campaign.campaignType]}
                        </Badge>
                        <Badge color={statusColor}>
                          {CAMPAIGN_STATUS_LABELS[campaign.status] || campaign.status}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--foreground-muted)', marginBottom: 4 }}>
                      <span>{approvedCount}/{campAssets.length} נכסים מאושרים</span>
                      <span>{campaign.completionPercent}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${campaign.completionPercent}%`,
                        borderRadius: 4,
                        background: campaign.completionPercent === 100 ? '#4CAF50' : 'var(--accent)',
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>

                  {/* Objective */}
                  {campaign.objective && (
                    <p style={{
                      fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 12px',
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
                    }}>
                      {campaign.objective}
                    </p>
                  )}

                  {/* Created date */}
                  <div style={{ fontSize: 12, color: 'var(--foreground-muted)', marginBottom: 14 }}>
                    נוצר: {fmtDate(campaign.createdAt)}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Btn variant="accent" style={{ flex: 1, fontSize: 12, padding: '6px 12px' }} onClick={() => {
                      setSelectedCampaign(campaign);
                      setCampaignViewerOpen(true);
                    }}>
                      צפה
                    </Btn>
                    <Btn variant="ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => handleApproveAllAssets(campaign.id)}>
                      אשר הכל
                    </Btn>
                    <Btn variant="ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => handleDuplicateCampaign(campaign)}>
                      שכפל
                    </Btn>
                    <Btn variant="ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => handleArchiveCampaign(campaign)}>
                      ארכיון
                    </Btn>
                  </div>
                </div>
              );
            })}
          </div>
        ) : !generatingCampaign ? (
          /* Empty State */
          <SectionCard>
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🏭</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 8px' }}>
                עדיין לא נוצרו קמפיינים
              </h3>
              <p style={{ color: 'var(--foreground-muted)', fontSize: 14, margin: '0 0 20px', lineHeight: 1.6 }}>
                צור את הקמפיין הראשון שלך ותקבל חבילה שיווקית מלאה:
              </p>
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 24,
              }}>
                {['3 פוסטים', '3 סטוריז', 'קרוסלה', 'באנר', 'Hero', 'כותרת מייל', 'Google Display'].map(item => (
                  <span key={item} style={{
                    padding: '4px 12px', borderRadius: 20,
                    background: 'rgba(0,181,254,0.08)', color: 'var(--accent)',
                    fontSize: 12, fontWeight: 500, border: '1px solid rgba(0,181,254,0.15)',
                  }}>
                    {item}
                  </span>
                ))}
              </div>
              <p style={{ color: 'var(--foreground-muted)', fontSize: 13, margin: '0 0 20px' }}>
                ועוד... כולל קופירייטינג, DNA קמפיין, ותוכנית פרסום
              </p>
              <Btn variant="accent" onClick={() => setShowCampaignCreator(true)} style={{ padding: '12px 32px', fontSize: 15 }}>
                צור את הקמפיין הראשון שלך
              </Btn>
            </div>
          </SectionCard>
        ) : null}

        {/* Campaign Viewer Modal */}
        {campaignViewerOpen && selectedCampaign && (() => {
          const campAssets = entityCampaignAssets.filter(a => a.campaignId === selectedCampaign.id);
          const campCopySet = campaignCopySets.find((cs: CampaignCopySet) => cs.campaignId === selectedCampaign.id);
          const dna = selectedCampaign.campaignDna;
          const statusColor = CAMPAIGN_STATUS_COLORS[selectedCampaign.status] || '#888';

          // Group assets by format
          const assetsByFormat: Record<string, CampaignFactoryAsset[]> = {};
          campAssets.forEach(a => {
            const key = a.format;
            if (!assetsByFormat[key]) assetsByFormat[key] = [];
            assetsByFormat[key].push(a);
          });

          return (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.85)', zIndex: 1000,
              display: 'flex', direction: 'rtl',
            }}>
              {/* Left Panel - Campaign Info */}
              <div style={{
                width: '30%', minWidth: 320, maxWidth: 400,
                background: 'var(--surface)', borderLeft: '1px solid var(--border)',
                overflowY: 'auto', padding: 28,
              }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 16px' }}>
                  {selectedCampaign.title}
                </h3>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                  <Badge color="var(--accent)">
                    {CAMPAIGN_TYPE_EMOJIS[selectedCampaign.campaignType]} {CAMPAIGN_TYPE_LABELS[selectedCampaign.campaignType]}
                  </Badge>
                  <Badge color={statusColor}>
                    {CAMPAIGN_STATUS_LABELS[selectedCampaign.status] || selectedCampaign.status}
                  </Badge>
                </div>

                {/* Objective */}
                {selectedCampaign.objective && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground-muted)', marginBottom: 4 }}>מטרה</div>
                    <p style={{ fontSize: 13, color: 'var(--foreground)', margin: 0, lineHeight: 1.6 }}>{selectedCampaign.objective}</p>
                  </div>
                )}

                {/* Audience */}
                {selectedCampaign.targetAudience && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground-muted)', marginBottom: 4 }}>קהל יעד</div>
                    <p style={{ fontSize: 13, color: 'var(--foreground)', margin: 0, lineHeight: 1.6 }}>{selectedCampaign.targetAudience}</p>
                  </div>
                )}

                {/* Offer */}
                {selectedCampaign.offer && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground-muted)', marginBottom: 4 }}>הצעה</div>
                    <p style={{ fontSize: 13, color: 'var(--foreground)', margin: 0, lineHeight: 1.6 }}>{selectedCampaign.offer}</p>
                  </div>
                )}

                {/* Main Message */}
                {selectedCampaign.mainMessage && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground-muted)', marginBottom: 4 }}>מסר מרכזי</div>
                    <p style={{ fontSize: 13, color: 'var(--foreground)', margin: 0, lineHeight: 1.6 }}>{selectedCampaign.mainMessage}</p>
                  </div>
                )}

                {/* Campaign DNA */}
                {dna && (
                  <div style={{
                    marginBottom: 20, padding: 16, borderRadius: 12,
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', marginBottom: 12 }}>
                      DNA קמפיין
                    </div>
                    <ScoreBar label="דחיפות" value={dna.urgency} />
                    <ScoreBar label="רמת CTA" value={dna.ctaLevel} />
                    <ScoreBar label="אגרסיביות מכירתית" value={dna.salesAggressiveness} />
                    <ScoreBar label="עוצמה ויזואלית" value={dna.visualIntensity} />
                    {dna.toneOfVoice && (
                      <div style={{ fontSize: 12, color: 'var(--foreground-muted)', marginTop: 8 }}>
                        טון: <span style={{ color: 'var(--foreground)' }}>{dna.toneOfVoice}</span>
                      </div>
                    )}
                    {dna.emotionalAngle && (
                      <div style={{ fontSize: 12, color: 'var(--foreground-muted)', marginTop: 4 }}>
                        זווית רגשית: <span style={{ color: 'var(--foreground)' }}>{dna.emotionalAngle}</span>
                      </div>
                    )}
                    {dna.moodKeywords && dna.moodKeywords.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                        {dna.moodKeywords.map((kw, i) => (
                          <span key={i} style={{
                            padding: '2px 8px', borderRadius: 10, fontSize: 11,
                            background: 'rgba(0,181,254,0.1)', color: 'var(--accent)',
                            border: '1px solid rgba(0,181,254,0.15)',
                          }}>{kw}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Copy Set Preview */}
                {campCopySet && (
                  <div style={{
                    padding: 16, borderRadius: 12,
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', marginBottom: 12 }}>
                      קופי קמפיין
                    </div>
                    {campCopySet.headlines && campCopySet.headlines.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground-muted)', marginBottom: 4 }}>כותרות</div>
                        {campCopySet.headlines.slice(0, 3).map((h: string, i: number) => (
                          <div key={i} style={{ fontSize: 12, color: 'var(--foreground)', marginBottom: 2 }}>• {h}</div>
                        ))}
                      </div>
                    )}
                    {campCopySet.ctaVariations && campCopySet.ctaVariations.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground-muted)', marginBottom: 4 }}>CTAs</div>
                        {campCopySet.ctaVariations.slice(0, 3).map((c: string, i: number) => (
                          <div key={i} style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 2 }}>• {c}</div>
                        ))}
                      </div>
                    )}
                    {campCopySet.socialCaptions && campCopySet.socialCaptions.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground-muted)', marginBottom: 4 }}>קפשנים</div>
                        {campCopySet.socialCaptions.slice(0, 2).map((c: string, i: number) => (
                          <div key={i} style={{
                            fontSize: 12, color: 'var(--foreground)', marginBottom: 4, lineHeight: 1.5,
                            overflow: 'hidden', textOverflow: 'ellipsis',
                            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const,
                          }}>• {c}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right Panel - Assets Grid */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 28 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
                    נכסי קמפיין ({campAssets.length})
                  </h3>
                </div>

                {/* Assets grouped by format */}
                {Object.entries(assetsByFormat).map(([format, formatAssets]) => (
                  <div key={format} style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', marginBottom: 12 }}>
                      {ASSET_FORMAT_LABELS[format as CampaignAssetFormat] || format}
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                      gap: 14,
                    }}>
                      {formatAssets.map(asset => {
                        const assetStatusColor = asset.isApproved ? '#4CAF50' : asset.isRejected ? '#ef4444' : '#888';
                        return (
                          <div key={asset.id} style={{
                            background: asset.isApproved
                              ? 'linear-gradient(135deg, rgba(76,175,80,0.06), rgba(255,255,255,0.04))'
                              : asset.isRejected
                              ? 'linear-gradient(135deg, rgba(239,68,68,0.06), rgba(255,255,255,0.04))'
                              : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${assetStatusColor}33`,
                            borderRadius: 12,
                            padding: 16,
                          }}>
                            {/* Format badge */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                              <Badge color="var(--accent)">
                                {ASSET_FORMAT_LABELS[asset.format] || asset.format}
                              </Badge>
                              <Badge color={assetStatusColor}>
                                {asset.isApproved ? 'מאושר' : asset.isRejected ? 'נדחה' : 'ממתין'}
                              </Badge>
                            </div>

                            {/* Image placeholder or preview */}
                            {asset.imageUrl || asset.thumbnailUrl ? (
                              <div style={{
                                width: '100%', height: 160, borderRadius: 8,
                                background: 'rgba(0,0,0,0.3)', marginBottom: 12,
                                overflow: 'hidden',
                              }}>
                                <img
                                  src={asset.thumbnailUrl || asset.imageUrl || ''}
                                  alt={asset.title}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              </div>
                            ) : (
                              <div style={{
                                width: '100%', height: 120, borderRadius: 8,
                                background: 'rgba(255,255,255,0.03)', marginBottom: 12,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: '1px dashed rgba(255,255,255,0.08)',
                                color: 'var(--foreground-muted)', fontSize: 13,
                              }}>
                                ממתין ליצירה
                              </div>
                            )}

                            {/* Copy */}
                            {asset.copy && (
                              <div style={{ marginBottom: 10 }}>
                                {asset.copy.headline && (
                                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', marginBottom: 3 }}>
                                    {asset.copy.headline}
                                  </div>
                                )}
                                {asset.copy.subHeadline && (
                                  <div style={{ fontSize: 12, color: 'var(--foreground-muted)', marginBottom: 3 }}>
                                    {asset.copy.subHeadline}
                                  </div>
                                )}
                                {asset.copy.cta && (
                                  <div style={{
                                    display: 'inline-block', padding: '3px 10px', borderRadius: 6,
                                    background: 'rgba(0,181,254,0.1)', color: 'var(--accent)',
                                    fontSize: 11, fontWeight: 600, marginTop: 4,
                                  }}>
                                    {asset.copy.cta}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Intelligence note */}
                            {asset.intelligenceNote && (
                              <div style={{
                                fontSize: 11, color: 'var(--foreground-muted)', marginBottom: 10,
                                padding: '6px 10px', borderRadius: 8,
                                background: 'rgba(240,255,2,0.04)', border: '1px solid rgba(240,255,2,0.1)',
                                lineHeight: 1.5,
                              }}>
                                💡 {asset.intelligenceNote}
                              </div>
                            )}

                            {/* Action buttons */}
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                onClick={() => handleApproveCampaignAsset(asset)}
                                title="אשר"
                                style={{
                                  flex: 1, padding: '6px 0', borderRadius: 6, cursor: 'pointer',
                                  background: asset.isApproved ? 'rgba(76,175,80,0.15)' : 'rgba(255,255,255,0.04)',
                                  border: asset.isApproved ? '1px solid rgba(76,175,80,0.3)' : '1px solid rgba(255,255,255,0.08)',
                                  color: asset.isApproved ? '#4CAF50' : 'var(--foreground-muted)',
                                  fontSize: 16, fontWeight: 700,
                                }}
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => handleRejectCampaignAsset(asset)}
                                title="דחה"
                                style={{
                                  flex: 1, padding: '6px 0', borderRadius: 6, cursor: 'pointer',
                                  background: asset.isRejected ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
                                  border: asset.isRejected ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.08)',
                                  color: asset.isRejected ? '#ef4444' : 'var(--foreground-muted)',
                                  fontSize: 16, fontWeight: 700,
                                }}
                              >
                                ✗
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Bottom bulk actions bar */}
                <div style={{
                  display: 'flex', gap: 12, padding: '16px 0', marginTop: 12,
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <Btn variant="accent" onClick={() => handleApproveAllAssets(selectedCampaign.id)}>
                    אשר הכל
                  </Btn>
                  <Btn variant="yellow" onClick={() => {
                    // Export placeholder
                    alert('ייצוא חבילת קמפיין - בקרוב!');
                  }}>
                    ייצא חבילה
                  </Btn>
                  <Btn variant="ghost" onClick={() => { setCampaignViewerOpen(false); setSelectedCampaign(null); }}>
                    סגור
                  </Btn>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  // ── 11. Creative Director Debug Panel (Admin Only) ──────────────────────────
  const renderCreativeDirector = () => {
    // Check admin mode via localStorage
    const isAdmin = typeof window !== 'undefined' && localStorage.getItem('frameai_role') === 'admin';

    // Gather CD metadata from existing concepts, designs, visuals
    const cdConcepts = concepts.filter((c: any) => c.creativeDirectorMetadata || c.creativeStrategy);
    const cdDesignSets = (designSetsHook.data || []).filter((d: any) => d.creativeDirectorMetadata || d.creativeStrategy);

    if (!isAdmin) {
      return (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <div style={{
            background: "var(--surface-secondary)",
            borderRadius: 16,
            padding: "40px 32px",
            textAlign: "center",
            maxWidth: 480,
            border: "1px solid var(--border)",
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--foreground)", marginBottom: 8 }}>
              שכבת Creative Director
            </div>
            <div style={{ fontSize: 14, color: "var(--foreground-muted)", lineHeight: 1.6 }}>
              פאנל זה זמין למנהלי מערכת בלבד. שכבת ה-Creative Director פועלת באופן פנימי ומעשירה את כל היצירות בתובנות אסטרטגיות.
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, rgba(0,181,254,0.08), rgba(240,255,2,0.05))",
          borderRadius: 16,
          padding: "24px 28px",
          border: "1px solid rgba(0,181,254,0.2)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span style={{ fontSize: 28 }}>🧠</span>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--foreground)" }}>
                PIXEL Creative Director Engine
              </div>
              <div style={{ fontSize: 13, color: "var(--foreground-muted)" }}>
                שכבת מנהל קריאייטיב פנימית — Admin Debug Mode
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
            {[
              { label: "קונספטים מועשרים", value: cdConcepts.length, color: "var(--accent)" },
              { label: "עיצובים מועשרים", value: cdDesignSets.length, color: "var(--neon-yellow)" },
              { label: "אסטרטגיות ויזואליות", value: 6, color: "#22c55e" },
              { label: "כללי תעשייה", value: 7, color: "#a855f7" },
            ].map((s) => (
              <div key={s.label} style={{
                background: "var(--surface-secondary)",
                borderRadius: 10,
                padding: "14px 12px",
                textAlign: "center",
                border: "1px solid var(--border)",
              }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "var(--foreground-muted)", fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Visual Strategies */}
        <SectionCard>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", marginBottom: 16 }}>
            6 אסטרטגיות ויזואליות Meta-Native
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {[
              { name: "PROTAGONIST IN CONTEXT", he: "גיבור בהקשר", desc: "אדם אמיתי בסביבה טבעית" },
              { name: "BEFORE/AFTER SPLIT", he: "לפני/אחרי", desc: "פיצול מסך דרמטי" },
              { name: "DOCUMENT/ARTIFACT", he: "מסמך/ארטיפקט", desc: "צילום מסמך בסביבה" },
              { name: "DATA DRAMA", he: "דאטה דרמטי", desc: "מספרים שעוצרים גלילה" },
              { name: "BRUTALIST TYPOGRAPHY", he: "טיפוגרפיה ברוטליסטית", desc: "טקסט גדול ועוצמתי" },
              { name: "CINEMATIC SCENE", he: "סצנה קולנועית", desc: "פריים קולנועי מושלם" },
            ].map((strategy) => (
              <div key={strategy.name} style={{
                background: "var(--surface-secondary)",
                borderRadius: 10,
                padding: "14px 16px",
                border: "1px solid var(--border)",
              }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "var(--accent)", letterSpacing: 1, textTransform: "uppercase" as const, marginBottom: 4 }}>
                  {strategy.name}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", marginBottom: 4, direction: "rtl" as const }}>
                  {strategy.he}
                </div>
                <div style={{ fontSize: 12, color: "var(--foreground-muted)", direction: "rtl" as const }}>
                  {strategy.desc}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Blacklist */}
        <SectionCard>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#ef4444", marginBottom: 12, direction: "rtl" as const }}>
            🚫 רשימה שחורה מוחלטת — ABSOLUTE BLACKLIST
          </div>
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8 }}>
            {[
              "stock photos גנריים",
              "clipart או אייקונים שטוחים",
              "שקיפות PNG על רקע צבעוני",
              "mockups מחשב/טלפון עם מסך ירוק",
              "אנשים מחייכים למצלמה ללא הקשר",
              "רקעות gradient גנריים",
              "לוגו ענק במרכז",
              "טקסט על תמונה ללא קונטרסט",
            ].map((item) => (
              <span key={item} style={{
                background: "rgba(239,68,68,0.1)",
                color: "#ef4444",
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                border: "1px solid rgba(239,68,68,0.2)",
                direction: "rtl" as const,
              }}>
                {item}
              </span>
            ))}
          </div>
        </SectionCard>

        {/* Enriched Items Debug */}
        {cdConcepts.length > 0 && (
          <SectionCard>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", marginBottom: 16, direction: "rtl" as const }}>
              🔍 קונספטים מועשרים ע״י Creative Director ({cdConcepts.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {cdConcepts.slice(0, 5).map((concept: any) => (
                <div key={concept.id} style={{
                  background: "var(--surface-secondary)",
                  borderRadius: 10,
                  padding: "14px 16px",
                  border: "1px solid var(--border)",
                  direction: "rtl" as const,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>
                      {concept.title}
                    </div>
                    {concept.creativeDirectorScore != null && (
                      <div style={{
                        background: concept.creativeDirectorScore >= 70 ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                        color: concept.creativeDirectorScore >= 70 ? "#22c55e" : "#ef4444",
                        padding: "3px 10px",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 700,
                      }}>
                        CD Score: {concept.creativeDirectorScore}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
                    {concept.creativeStrategy && (
                      <span style={{ background: "rgba(0,181,254,0.1)", color: "var(--accent)", padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                        {concept.creativeStrategy}
                      </span>
                    )}
                    {concept.industryAnchor && (
                      <span style={{ background: "rgba(168,85,247,0.1)", color: "#a855f7", padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                        {concept.industryAnchor}
                      </span>
                    )}
                    {concept.scrollStopReason && (
                      <span style={{ background: "rgba(240,255,2,0.15)", color: "#a3a300", padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                        {concept.scrollStopReason}
                      </span>
                    )}
                  </div>
                  {concept.creativeDirectorMetadata && (
                    <details style={{ marginTop: 8 }}>
                      <summary style={{ fontSize: 11, color: "var(--foreground-muted)", cursor: "pointer" }}>
                        Raw CD Metadata
                      </summary>
                      <pre style={{ fontSize: 10, color: "var(--foreground-muted)", marginTop: 6, overflow: "auto" as const, maxHeight: 120, background: "rgba(0,0,0,0.03)", padding: 8, borderRadius: 6 }}>
                        {JSON.stringify(concept.creativeDirectorMetadata, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Validation Rules */}
        <SectionCard>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", marginBottom: 12, direction: "rtl" as const }}>
            ✅ כללי ולידציה — 8 בדיקות אוטומטיות
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
            {[
              { name: "בדיקת Blacklist", desc: "סינון 8 פריטים אסורים" },
              { name: "כיווניות RTL", desc: "וידוא עברית ימין-לשמאל" },
              { name: "שימור קופי", desc: "העתק המקורי לא נפגע" },
              { name: "רלוונטיות תעשייתית", desc: "התאמה לתעשיית הלקוח" },
              { name: "קונטרסט", desc: "יחס ניגודיות מספק" },
              { name: "היררכיה ויזואלית", desc: "סדר קריאה נכון" },
              { name: "Scroll-Stop", desc: "אלמנט עצירת גלילה" },
              { name: "עקביות מותג", desc: "התאמה ל-Brand DNA" },
            ].map((rule) => (
              <div key={rule.name} style={{
                background: "var(--surface-secondary)",
                borderRadius: 8,
                padding: "10px 14px",
                border: "1px solid var(--border)",
                direction: "rtl" as const,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>{rule.name}</div>
                <div style={{ fontSize: 11, color: "var(--foreground-muted)" }}>{rule.desc}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    );
  };

  // ── 12. Future Generator ──────────────────────────────────────────────────────
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
      {activeSection === "learned" && renderLearned()}
      {activeSection === "dna" && renderDNA()}
      {activeSection === "feedback" && renderFeedback()}
      {activeSection === "concepts" && renderConcepts()}
      {activeSection === "designs" && renderDesigns()}
      {activeSection === "visuals" && renderVisuals()}
      {activeSection === "campaign-factory" && renderCampaignFactory()}
      {activeSection === "creative-director" && renderCreativeDirector()}
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
