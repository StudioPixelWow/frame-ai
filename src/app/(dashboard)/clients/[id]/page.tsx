"use client";

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useClients, useEmployees, useClientGanttItems, useClientTasks, useTasks, useClientFiles } from "@/lib/api/use-entity";
import { useToast } from "@/components/ui/toast";
import type { Client, Employee } from "@/lib/db/schema";
import TabOverview from "./tab-overview";
import TabSocial from "./tab-social";
import TabFiles from "./tab-files";
import TabAccounting from "./tab-accounting";
import TabPortal from "./tab-portal";
import TabActivity from "./tab-activity";
import TabInsights from "./tab-insights";
import TabContentGantt from "./tab-content-gantt";
import TabLeads from "./tab-leads";
import TabCreativeDNA from "./tab-creative-dna";
import TabResearch from "./tab-research";
import TabVideos from "./tab-videos";

const AVATAR_COLORS = ["#00B5FE", "#8b5cf6", "#22c55e", "#f59e0b", "#ec4899", "#14b8a6"];

function avatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2);
}

const CLIENT_TYPE_LABELS: Record<string, { label: string; color: string; emoji?: string }> = {
  marketing: { label: "פרסום ושיווק", color: "#00B5FE" },
  branding: { label: "מיתוג", color: "#8b5cf6" },
  websites: { label: "בניית אתרים", color: "#22c55e" },
  hosting: { label: "אחסון", color: "#f59e0b" },
  podcast: { label: "פודקאסט", color: "#CCFF00", emoji: "🎙️" },
  lead: { label: "ליד", color: "#94a3b8", emoji: "🔗" },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: "פעיל", color: "#22c55e" },
  inactive: { label: "לא פעיל", color: "#f59e0b" },
  prospect: { label: "פוטנציאלי", color: "#a1a1aa" },
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  current: "#22c55e",
  overdue: "#ef4444",
  pending: "#f59e0b",
  none: "#6b7280",
};

const GANTT_STATUS_COLORS: Record<string, { label: string; color: string }> = {
  draft: { label: "טיוטה", color: "#6b7280" },
  approved: { label: "מאושר", color: "#22c55e" },
  sent_to_client: { label: "נשלח ללקוח", color: "#38bdf8" },
  client_approved: { label: "אושר על ידי לקוח", color: "#10b981" },
  none: { label: "לא יוצר", color: "#9ca3af" },
};

type TabName = "overview" | "content" | "tasks" | "leads" | "social" | "ads" | "files" | "accounting" | "portal" | "activity" | "dna" | "research" | "videos";

const TABS: { id: TabName; label: string; showFor?: string }[] = [
  { id: "overview", label: "סקירה" },
  { id: "content", label: "תוכן וגאנט" },
  { id: "videos", label: "סרטונים" },
  { id: "research", label: "חקור לקוח" },
  { id: "dna", label: "DNA יצירתי" },
  { id: "tasks", label: "משימות" },
  { id: "leads", label: "לידים", showFor: "all" },
  { id: "social", label: "סושיאל" },
  { id: "ads", label: "פרסום" },
  { id: "files", label: "קבצים" },
  { id: "accounting", label: "הנהח״ש" },
  { id: "portal", label: "פורטל" },
  { id: "activity", label: "פעילות" },
];

const TEAM_MEMBERS = ["טל זטלמן", "מאיה זטלמן", "נועם בוברין", "מיכאלה"];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const months = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export default function ClientDetailPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', color: 'var(--foreground-muted)' }}>טוען...</div>}>
      <ClientDetailContent />
    </Suspense>
  );
}

function ClientDetailContent() {
  const params = useParams();
  const router = useRouter();
  const clientId = (params?.id as string) || "";

  const { data: clients, loading: clientsLoading, update: updateClient } = useClients();
  const { data: employees, loading: employeesLoading } = useEmployees();
  const toast = useToast();

  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabName>((searchParams.get("tab") as TabName) || "overview");
  const [client, setClient] = useState<Client | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Client>>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // ── UGC Video Generation State ──
  const { create: createClientFile, refetch: refetchClientFiles } = useClientFiles();
  const [ugcModalOpen, setUgcModalOpen] = useState(false);
  const [ugcAvatars, setUgcAvatars] = useState<any[]>([]);
  const [ugcVoices, setUgcVoices] = useState<any[]>([]);
  const [ugcLoadingOptions, setUgcLoadingOptions] = useState(false);
  const [ugcAvatarId, setUgcAvatarId] = useState("");
  const [ugcVoiceId, setUgcVoiceId] = useState("");
  const [ugcScript, setUgcScript] = useState("");
  const [ugcFormat, setUgcFormat] = useState<"9:16" | "1:1" | "16:9">("9:16");
  const [ugcGenerating, setUgcGenerating] = useState(false);
  const [ugcVideoId, setUgcVideoId] = useState<string | null>(null);
  const [ugcStatus, setUgcStatus] = useState<string>("");
  const [ugcProgress, setUgcProgress] = useState<string>("");
  const [ugcVoicePlaying, setUgcVoicePlaying] = useState(false);
  const ugcPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ugcAudioRef = useRef<HTMLAudioElement | null>(null);

  // ── UGC Creative Input State ──
  const [ugcCreativePrompt, setUgcCreativePrompt] = useState("");
  const [ugcBrandName, setUgcBrandName] = useState("");
  const [ugcMainOffer, setUgcMainOffer] = useState("");
  const [ugcTargetAudience, setUgcTargetAudience] = useState("");
  const [ugcKeyMessage, setUgcKeyMessage] = useState("");
  const [ugcCallToAction, setUgcCallToAction] = useState("");
  const [ugcVisualStyle, setUgcVisualStyle] = useState("");
  const [ugcAdditionalInstructions, setUgcAdditionalInstructions] = useState("");
  const [ugcReferenceFiles, setUgcReferenceFiles] = useState<File[]>([]);
  const [ugcReferenceTexts, setUgcReferenceTexts] = useState<string[]>([]);
  const [ugcScriptGenerating, setUgcScriptGenerating] = useState(false);
  const [ugcShowStructuredFields, setUgcShowStructuredFields] = useState(false);
  const [ugcShowReferenceUpload, setUgcShowReferenceUpload] = useState(false);
  const [ugcScriptReplaceConfirm, setUgcScriptReplaceConfirm] = useState(false);
  const ugcFileInputRef = useRef<HTMLInputElement | null>(null);

  // Hebrew voice filter — keep only Hebrew-tagged voices (or fallback common Hebrew voice IDs)
  const HEBREW_VOICE_IDS = new Set([
    // Known Hebrew voice IDs in HeyGen
    "he-IL-AvriNeural", "he-IL-HilaNeural",
  ]);
  const hebrewVoices = useMemo(() => {
    return ugcVoices.filter((v: any) => {
      const lang = (v.language || v.locale || "").toLowerCase();
      if (lang.includes("hebrew") || lang.includes("he-il") || lang.includes("he")) return true;
      if (HEBREW_VOICE_IDS.has(v.voice_id)) return true;
      return false;
    });
  }, [ugcVoices]);

  // Selected avatar object for preview
  const selectedAvatar = useMemo(
    () => ugcAvatars.find((a: any) => a.avatar_id === ugcAvatarId),
    [ugcAvatars, ugcAvatarId],
  );

  useEffect(() => {
    if (clients && clientId) {
      const found = clients.find((c) => c.id === clientId);
      setClient(found || null);
    }
  }, [clients, clientId]);

  const ugcAutoOpened = useRef(false);

  const handleOpenEditModal = () => {
    if (client) {
      setEditForm({
        name: client.name,
        company: client.company,
        contactPerson: client.contactPerson,
        phone: client.phone,
        email: client.email,
        clientType: client.clientType,
        businessField: client.businessField,
        marketingGoals: client.marketingGoals,
        keyMarketingMessages: client.keyMarketingMessages,
        retainerAmount: client.retainerAmount,
        retainerDay: client.retainerDay,
        status: client.status,
        websiteUrl: client.websiteUrl,
        facebookPageUrl: client.facebookPageUrl,
        instagramProfileUrl: client.instagramProfileUrl,
        tiktokProfileUrl: client.tiktokProfileUrl,
        notes: client.notes,
      });
      setIsEditModalOpen(true);
    }
  };

  const handleSaveEdit = async () => {
    if (!editForm.name?.trim()) {
      toast("אנא הזן שם לקוח", "error");
      return;
    }

    setIsSavingEdit(true);
    try {
      await updateClient(client!.id, editForm);
      toast("לקוח עודכן בהצלחה", "success");
      setIsEditModalOpen(false);
    } catch (error) {
      toast("שגיאה בעדכון לקוח", "error");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ── UGC Video Handlers ──
  const openUgcModal = useCallback(async () => {
    setUgcModalOpen(true);
    setUgcAvatarId("");
    setUgcVoiceId("");
    setUgcScript("");
    setUgcVideoId(null);
    setUgcStatus("");
    setUgcProgress("");
    setUgcGenerating(false);
    // Reset creative inputs
    setUgcCreativePrompt("");
    setUgcBrandName(client?.name || "");
    setUgcMainOffer("");
    setUgcTargetAudience("");
    setUgcKeyMessage("");
    setUgcCallToAction("");
    setUgcVisualStyle("");
    setUgcAdditionalInstructions("");
    setUgcReferenceFiles([]);
    setUgcReferenceTexts([]);
    setUgcScriptGenerating(false);
    setUgcShowStructuredFields(false);
    setUgcShowReferenceUpload(false);
    setUgcScriptReplaceConfirm(false);

    setUgcLoadingOptions(true);
    try {
      const [avatarsRes, voicesRes] = await Promise.all([
        fetch("/api/data/heygen/avatars"),
        fetch("/api/data/heygen/voices"),
      ]);
      if (!avatarsRes.ok) {
        const err = await avatarsRes.json().catch(() => ({}));
        throw new Error(err?.error || `Avatars failed: ${avatarsRes.status}`);
      }
      if (!voicesRes.ok) {
        const err = await voicesRes.json().catch(() => ({}));
        throw new Error(err?.error || `Voices failed: ${voicesRes.status}`);
      }
      const avatars = await avatarsRes.json();
      const voices = await voicesRes.json();
      setUgcAvatars(Array.isArray(avatars) ? avatars : []);
      setUgcVoices(Array.isArray(voices) ? voices : []);
    } catch (err: any) {
      console.error("[UGC] Failed to load options:", err);
      toast(`שגיאה בטעינת אפשרויות HeyGen: ${err?.message || "unknown"}`, "error");
    } finally {
      setUgcLoadingOptions(false);
    }
  }, [toast, client]);

  const closeUgcModal = useCallback(() => {
    if (ugcPollRef.current) {
      clearInterval(ugcPollRef.current);
      ugcPollRef.current = null;
    }
    setUgcModalOpen(false);
  }, []);

  // Voice preview handler
  const handlePlayVoicePreview = useCallback(async () => {
    if (!ugcVoiceId) return;
    const voice = ugcVoices.find((v: any) => v.voice_id === ugcVoiceId);
    const previewUrl = voice?.preview_audio || voice?.sample_url || voice?.preview_url;
    if (previewUrl) {
      setUgcVoicePlaying(true);
      try {
        if (ugcAudioRef.current) { ugcAudioRef.current.pause(); }
        const audio = new Audio(previewUrl);
        ugcAudioRef.current = audio;
        audio.onended = () => setUgcVoicePlaying(false);
        audio.onerror = () => { setUgcVoicePlaying(false); toast("לא ניתן להשמיע תצוגה מקדימה של קול זה", "error"); };
        await audio.play();
      } catch { setUgcVoicePlaying(false); }
    } else {
      toast("אין תצוגה מקדימה זמינה לקול זה", "error");
    }
  }, [ugcVoiceId, ugcVoices, toast]);

  // ── Reference file upload handler ──
  const handleReferenceFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newFiles: File[] = [];
    const newTexts: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      newFiles.push(file);
      // Extract text from text-based files for script generation
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const isTextFile = ["txt", "md", "csv", "json", "html", "rtf"].includes(ext);
      const isDoc = ["doc", "docx", "pdf"].includes(ext);
      if (isTextFile) {
        try {
          const text = await file.text();
          newTexts.push(`[${file.name}]\n${text.slice(0, 2000)}`);
        } catch {
          newTexts.push(`[${file.name}] — לא ניתן לחלץ טקסט`);
        }
      } else if (isDoc) {
        newTexts.push(`[${file.name}] — קובץ ${ext.toUpperCase()} צורף (חילוץ טקסט אוטומטי לא זמין, המערכת תשתמש בשם הקובץ כהקשר)`);
      } else {
        // Image/logo/other — note it as context
        newTexts.push(`[${file.name}] — קובץ ${ext.toUpperCase()} צורף כחומר התייחסות ויזואלי`);
      }
    }
    setUgcReferenceFiles((prev) => [...prev, ...newFiles]);
    setUgcReferenceTexts((prev) => [...prev, ...newTexts]);
  }, []);

  const removeReferenceFile = useCallback((index: number) => {
    setUgcReferenceFiles((prev) => prev.filter((_, i) => i !== index));
    setUgcReferenceTexts((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ── AI Script Generation handler ──
  // mode: "replace" = overwrite existing script, "append" = add after existing
  const handleGenerateScript = useCallback(async (mode?: "replace" | "append") => {
    if (ugcScriptGenerating) return;

    // If script already has content and no explicit mode, ask before replacing
    if (ugcScript.trim().length > 0 && !mode) {
      setUgcScriptReplaceConfirm(true);
      return;
    }

    setUgcScriptGenerating(true);
    setUgcScriptReplaceConfirm(false);

    try {
      const res = await fetch("/api/data/ugc/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creativePrompt: ugcCreativePrompt,
          brandName: ugcBrandName,
          mainOffer: ugcMainOffer,
          targetAudience: ugcTargetAudience,
          keyMessage: ugcKeyMessage,
          callToAction: ugcCallToAction,
          visualStyleNotes: ugcVisualStyle,
          additionalInstructions: ugcAdditionalInstructions,
          referenceTexts: ugcReferenceTexts,
          clientId: client?.id || "",
          clientName: client?.name || ugcBrandName || "",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `שגיאה ${res.status}`);

      const script = data.script;
      if (!script || script.trim().length === 0) {
        throw new Error("התסריט שנוצר ריק. נסה להוסיף יותר פרטים.");
      }

      if (mode === "append") {
        setUgcScript((prev) => prev + "\n\n" + script);
      } else {
        setUgcScript(script);
      }
      toast("תסריט נוצר בהצלחה!", "success");
    } catch (err: any) {
      console.error("[UGC] Script generation error:", err);
      toast(`שגיאה ביצירת תסריט: ${err?.message}`, "error");
    } finally {
      setUgcScriptGenerating(false);
    }
  }, [
    ugcScriptGenerating, ugcScript,
    ugcCreativePrompt, ugcBrandName, ugcMainOffer, ugcTargetAudience,
    ugcKeyMessage, ugcCallToAction, ugcVisualStyle, ugcAdditionalInstructions,
    ugcReferenceTexts, client, toast,
  ]);

  // Format dimension map
  const FORMAT_DIMENSIONS: Record<string, { width: number; height: number; label: string }> = {
    "9:16": { width: 1080, height: 1920, label: "אנכי – TikTok / Reels" },
    "1:1": { width: 1080, height: 1080, label: "מרובע – סושיאל" },
    "16:9": { width: 1920, height: 1080, label: "אופקי – YouTube / אתר" },
  };

  const handleGenerateUGC = useCallback(async () => {
    if (!client || !ugcAvatarId || !ugcVoiceId || !ugcScript.trim()) {
      toast("יש למלא את כל השדות", "error");
      return;
    }

    setUgcGenerating(true);
    setUgcStatus("");
    setUgcProgress("שולח בקשה ל-HeyGen...");

    const dimension = FORMAT_DIMENSIONS[ugcFormat] || FORMAT_DIMENSIONS["9:16"];
    const formatSlug = ugcFormat.replace(":", "x");

    try {
      const res = await fetch("/api/data/heygen/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatarId: ugcAvatarId,
          voiceId: ugcVoiceId,
          script: ugcScript,
          dimension: { width: dimension.width, height: dimension.height },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Failed to generate (${res.status})`);

      const videoId = data.videoId;
      if (!videoId) throw new Error("לא התקבל מזהה סרטון מ-HeyGen");
      setUgcVideoId(videoId);
      setUgcProgress("הסרטון בתהליך יצירה... זה עשוי לקחת כמה דקות");

      // Poll for completion every 5 seconds
      const clientRef = client; // capture for closure
      ugcPollRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/data/heygen/status?videoId=${videoId}`);
          const statusData = await statusRes.json();
          const status = statusData?.status;
          setUgcStatus(status);

          if (status === "completed" && statusData.videoUrl) {
            if (ugcPollRef.current) { clearInterval(ugcPollRef.current); ugcPollRef.current = null; }

            // Validate the video URL before saving
            if (!statusData.videoUrl.startsWith("http")) {
              setUgcProgress("שגיאה: כתובת הסרטון אינה תקינה");
              setUgcGenerating(false);
              return;
            }

            setUgcProgress("שומר את הסרטון בקבצי הלקוח...");

            try {
              const now = new Date().toISOString();
              const savedFile = await createClientFile({
                clientId: clientRef.id,
                fileName: `UGC_${clientRef.name}_${formatSlug}_${now.split("T")[0]}.mp4`,
                fileUrl: statusData.videoUrl,
                fileType: "video",
                category: "social_media",
                fileSize: 0,
                uploadedBy: "HeyGen AI",
                notes: `סרטון UGC שנוצר באמצעות HeyGen.\nפורמט: ${ugcFormat} (${dimension.width}x${dimension.height})\nתסריט: ${ugcScript.slice(0, 200)}`,
                linkedTaskId: null,
                linkedGanttItemId: null,
                createdAt: now,
                updatedAt: now,
              } as any);

              // Verify the file was actually created with an ID
              if (!savedFile || !(savedFile as any).id) {
                throw new Error("השמירה החזירה תשובה ריקה — הקובץ לא נשמר בפועל");
              }

              await refetchClientFiles();
              setUgcProgress("הסרטון נוצר ונשמר בהצלחה! ניתן לראות בלשונית קבצים.");
              toast("סרטון UGC נוצר ונשמר בקבצי הלקוח!", "success");
            } catch (saveErr: any) {
              console.error("[UGC] Failed to save file:", saveErr);
              setUgcProgress(`הסרטון נוצר בהצלחה אבל השמירה נכשלה: ${saveErr?.message}.\nקישור לסרטון: ${statusData.videoUrl}`);
              toast("הסרטון נוצר אך השמירה נכשלה", "error");
            }

            setUgcGenerating(false);
          } else if (status === "failed") {
            if (ugcPollRef.current) { clearInterval(ugcPollRef.current); ugcPollRef.current = null; }
            setUgcProgress(`יצירת הסרטון נכשלה: ${statusData.error || "שגיאה לא ידועה"}`);
            setUgcGenerating(false);
          } else {
            setUgcProgress(`סטטוס: ${status || "processing"}... ממתין לסיום`);
          }
        } catch (pollErr: any) {
          console.error("[UGC] poll error:", pollErr);
        }
      }, 5000);
    } catch (err: any) {
      console.error("[UGC] generate error:", err);
      setUgcProgress("");
      toast(`שגיאה ביצירת סרטון: ${err?.message}`, "error");
      setUgcGenerating(false);
    }
  }, [client, ugcAvatarId, ugcVoiceId, ugcScript, ugcFormat, toast, createClientFile, refetchClientFiles]);

  // Cleanup poll interval on unmount
  useEffect(() => {
    return () => {
      if (ugcPollRef.current) clearInterval(ugcPollRef.current);
    };
  }, []);

  // Auto-open UGC modal when ?ugc=1 is in URL (e.g. from clients list page)
  useEffect(() => {
    if (searchParams.get("ugc") === "1" && client && !ugcAutoOpened.current) {
      ugcAutoOpened.current = true;
      openUgcModal();
    }
  }, [searchParams, client, openUgcModal]);

  const loading = clientsLoading || employeesLoading;

  if (loading) {
    return (
      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem 1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
          <div style={{ color: "var(--foreground-muted)" }}>טוען פרטי לקוח...</div>
        </div>
      </main>
    );
  }

  if (!client) {
    return (
      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem 1.5rem" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "60vh",
            gap: "1.5rem",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "3rem" }}>❌</div>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.5rem" }}>
              הלקוח לא נמצא
            </h2>
            <p style={{ color: "var(--foreground-muted)", marginBottom: "1.5rem" }}>
              לא יכולנו למצוא את הלקוח שחיפשת.
            </p>
          </div>
          <Link
            href="/clients"
            style={{
              display: "inline-block",
              padding: "0.5rem 1.125rem",
              backgroundColor: "var(--accent)",
              color: "white",
              borderRadius: "0.5rem",
              textDecoration: "none",
              fontSize: "0.875rem",
              fontWeight: 600,
            }}
          >
            ← חזור ללקוחות
          </Link>
        </div>
      </main>
    );
  }

  const color = client.color || avatarColor(client.id);
  const typeInfo = CLIENT_TYPE_LABELS[client.clientType] || CLIENT_TYPE_LABELS.marketing;
  const statusInfo = STATUS_LABELS[client.status] || STATUS_LABELS.active;
  const assignedManager = employees?.find((e) => e.id === client.assignedManagerId);

  return (
    <main style={{ maxWidth: "1400px", margin: "0 auto", padding: "2rem 1.5rem" }}>
      {/* Header Section */}
      <div style={{ marginBottom: "2.5rem" }}>
        {/* Back Button */}
        <Link
          href="/clients"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            fontSize: "0.875rem",
            color: "var(--foreground-muted)",
            textDecoration: "none",
            marginBottom: "1.5rem",
            transition: "color 150ms",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--foreground)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--foreground-muted)")}
        >
          ← חזור ללקוחות
        </Link>

        {/* Client Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "1.5rem", marginBottom: "2rem" }}>
          {/* Avatar */}
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: client.logoUrl ? "0.75rem" : "50%",
              background: client.logoUrl ? "transparent" : `${color}20`,
              border: client.logoUrl ? "none" : `2px solid ${color}40`,
              color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: "1.5rem",
              flexShrink: 0,
              backgroundImage: client.logoUrl ? `url(${client.logoUrl})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            {!client.logoUrl && initials(client.name)}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1.5rem", marginBottom: "1rem" }}>
              <div>
                <h1 style={{ fontSize: "2rem", fontWeight: 700, color: "var(--foreground)", margin: "0 0 0.25rem 0" }}>
                  {client.name}
                </h1>
                <p style={{ fontSize: "0.95rem", color: "var(--foreground-muted)", margin: 0 }}>
                  {client.company}
                </p>
              </div>

              {/* Quick Action Buttons */}
              <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                <button
                  onClick={handleOpenEditModal}
                  className="mod-btn-primary"
                  style={{
                    fontSize: "0.875rem",
                    padding: "0.5rem 1.125rem",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.375rem",
                  }}
                >
                  ✏️ ערוך לקוח
                </button>
                <button
                  className="mod-btn-ghost"
                  style={{
                    fontSize: "0.875rem",
                    padding: "0.5rem 1.125rem",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.375rem",
                  }}
                  onClick={() => setActiveTab("content")}
                >
                  📋 תוכן חדש
                </button>
                <button
                  className="mod-btn-ghost"
                  style={{
                    fontSize: "0.875rem",
                    padding: "0.5rem 1.125rem",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.375rem",
                  }}
                  onClick={() => setActiveTab("content")}
                >
                  📊 גאנט
                </button>
                <button
                  className="mod-btn-ghost"
                  style={{
                    fontSize: "0.875rem",
                    padding: "0.5rem 1.125rem",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    color: "#8b5cf6",
                    borderColor: "rgba(139,92,246,0.3)",
                    background: "rgba(139,92,246,0.06)",
                  }}
                  onClick={openUgcModal}
                >
                  🎬 צור סרטון UGC
                </button>
                <button
                  className="mod-btn-ghost"
                  style={{
                    fontSize: "0.875rem",
                    padding: "0.5rem 1.125rem",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    color: "#22c55e",
                    borderColor: "rgba(34,197,94,0.3)",
                    background: "rgba(34,197,94,0.06)",
                  }}
                  onClick={() => router.push(`/business-projects/new?clientId=${clientId}`)}
                >
                  📂 צור פרויקט
                </button>
              </div>
            </div>

            {/* Status and Type Badges */}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  padding: "0.35rem 0.75rem",
                  borderRadius: 999,
                  background: `${typeInfo.color}15`,
                  color: typeInfo.color,
                  border: `1px solid ${typeInfo.color}30`,
                }}
              >
                {typeInfo.label}
              </span>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  padding: "0.35rem 0.75rem",
                  borderRadius: 999,
                  background: `${statusInfo.color}15`,
                  color: statusInfo.color,
                  border: `1px solid ${statusInfo.color}30`,
                }}
              >
                {statusInfo.label}
              </span>
              {assignedManager && (
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 500,
                    padding: "0.35rem 0.75rem",
                    borderRadius: 999,
                    background: "rgba(100, 116, 139, 0.1)",
                    color: "var(--foreground-muted)",
                    border: "1px solid rgba(100, 116, 139, 0.2)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.3rem",
                  }}
                >
                  👤 {assignedManager.name}
                </span>
              )}
              {client.websiteUrl && (
                <a
                  href={client.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 500,
                    padding: "0.35rem 0.75rem",
                    borderRadius: 999,
                    background: "rgba(0, 181, 254, 0.1)",
                    color: "#00B5FE",
                    border: "1px solid rgba(0, 181, 254, 0.3)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.3rem",
                    textDecoration: "none",
                  }}
                >
                  🌐 אתר
                </a>
              )}
              {client.facebookPageUrl && (
                <a
                  href={client.facebookPageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 500,
                    padding: "0.35rem 0.75rem",
                    borderRadius: 999,
                    background: "rgba(24, 119, 242, 0.1)",
                    color: "#1877F2",
                    border: "1px solid rgba(24, 119, 242, 0.3)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.3rem",
                    textDecoration: "none",
                  }}
                >
                  📘 פייסבוק
                </a>
              )}
              {client.instagramProfileUrl && (
                <a
                  href={client.instagramProfileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 500,
                    padding: "0.35rem 0.75rem",
                    borderRadius: 999,
                    background: "rgba(228, 64, 95, 0.1)",
                    color: "#E4405F",
                    border: "1px solid rgba(228, 64, 95, 0.3)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.3rem",
                    textDecoration: "none",
                  }}
                >
                  📷 אינסטגרם
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Client Alerts */}
      <ClientAlerts client={client} />

      {/* Tab Navigation */}
      <div
        style={{
          display: "flex",
          gap: "0.25rem",
          borderBottom: "1px solid var(--border)",
          marginBottom: "2rem",
          overflowX: "auto",
          overflowY: "hidden",
          scrollBehavior: "smooth",
        }}
      >
        {TABS.map((tab) => {
          // Determine if tab should be visible based on client type
          let shouldShow = true;
          if (tab.showFor === "all") {
            shouldShow = true;
          } else if (tab.id === "content" || tab.id === "social" || tab.id === "ads" || tab.id === "portal") {
            shouldShow = client.clientType === "marketing";
          } else if (tab.id === "accounting") {
            shouldShow = client.clientType === "marketing" || client.clientType === "hosting";
          }
          // "overview", "tasks", "files", "activity" show for all types

          return (
            shouldShow && (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="mod-tab"
                style={{
                  padding: "0.875rem 1rem",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: activeTab === tab.id ? "var(--accent-text)" : "var(--foreground-muted)",
                  background: activeTab === tab.id ? "var(--accent-muted)" : "transparent",
                  border: "none",
                  borderRadius: "0.375rem",
                  cursor: "pointer",
                  transition: "color 150ms, background-color 150ms",
                  whiteSpace: "nowrap",
                  borderBottom: activeTab === tab.id ? `3px solid var(--accent)` : "none",
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== tab.id) {
                    (e.target as HTMLElement).style.color = "var(--foreground)";
                    (e.target as HTMLElement).style.background = "rgba(0, 181, 254, 0.05)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== tab.id) {
                    (e.target as HTMLElement).style.color = "var(--foreground-muted)";
                    (e.target as HTMLElement).style.background = "transparent";
                  }
                }}
              >
                {tab.label}
              </button>
            )
          );
        })}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "overview" && (
          <>
            <TabOverview
              client={client}
              assignedManager={assignedManager}
              color={color}
              onUpdateClient={async (updates) => { await updateClient(client.id, updates); }}
              employees={employees || []}
              onNavigateTab={(tab) => setActiveTab(tab as TabName)}
            />
            {/* AI Insights widget below overview */}
            <div style={{ marginTop: "2rem" }}>
              <TabInsights client={client} employees={employees || []} />
            </div>
          </>
        )}
        {activeTab === "content" && (
          <TabContentGantt client={client} employees={employees || []} />
        )}
        {activeTab === "research" && (
          <TabResearch client={client} employees={employees || []} />
        )}
        {activeTab === "videos" && (
          <TabVideos client={client} employees={employees || []} />
        )}
        {activeTab === "dna" && (
          <TabCreativeDNA client={client} employees={employees || []} />
        )}
        {activeTab === "tasks" && (
          <TabTasks client={client} employees={employees || []} />
        )}
        {activeTab === "leads" && (
          <TabLeads client={client} />
        )}
        {activeTab === "social" && (
          <TabSocial client={client} employees={employees || []} />
        )}
        {activeTab === "files" && (
          <TabFiles client={client} onOpenUgcModal={openUgcModal} />
        )}
        {activeTab === "accounting" && (
          <TabAccounting client={client} />
        )}
        {activeTab === "portal" && (
          <TabPortal client={client} />
        )}
        {activeTab === "activity" && (
          <TabActivity client={client} />
        )}
        {activeTab === "ads" && (
          <div
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border)",
              borderRadius: "0.75rem",
              padding: "2rem",
              textAlign: "center",
              color: "var(--foreground-muted)",
            }}
          >
            <div style={{ fontSize: "1.125rem", fontWeight: 500, marginBottom: "0.5rem" }}>
              פרסום ומודעות
            </div>
            <div style={{ fontSize: "0.9rem" }}>בקרוב...</div>
          </div>
        )}
      </div>

      {/* Edit Client Modal */}
      {isEditModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            direction: "rtl",
          }}
          onClick={() => setIsEditModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: "var(--surface)",
              borderRadius: "0.75rem",
              padding: "2rem",
              maxWidth: "600px",
              width: "90%",
              maxHeight: "90vh",
              overflowY: "auto",
              border: "1px solid var(--border)",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--foreground)", margin: "0 0 1.5rem 0" }}>
              ערוך לקוח
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* Row 1: Name and Company */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                    שם לקוח
                  </label>
                  <input
                    className="form-input"
                    value={editForm.name || ""}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="שם לקוח"
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                    חברה
                  </label>
                  <input
                    className="form-input"
                    value={editForm.company || ""}
                    onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                    placeholder="חברה"
                  />
                </div>
              </div>

              {/* Row 2: Contact and Phone */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                    איש קשר
                  </label>
                  <input
                    className="form-input"
                    value={editForm.contactPerson || ""}
                    onChange={(e) => setEditForm({ ...editForm, contactPerson: e.target.value })}
                    placeholder="איש קשר"
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                    טלפון
                  </label>
                  <input
                    className="form-input"
                    value={editForm.phone || ""}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="טלפון"
                  />
                </div>
              </div>

              {/* Row 3: Email */}
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                  אימייל
                </label>
                <input
                  className="form-input"
                  type="email"
                  value={editForm.email || ""}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="אימייל"
                />
              </div>

              {/* Row 4: Client Type and Status */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                    סוג לקוח
                  </label>
                  <select
                    className="form-select"
                    value={editForm.clientType || "marketing"}
                    onChange={(e) => setEditForm({ ...editForm, clientType: e.target.value as Client["clientType"] })}
                  >
                    <option value="marketing">פרסום ושיווק</option>
                    <option value="branding">מיתוג</option>
                    <option value="websites">בניית אתרים</option>
                    <option value="podcast">פודקאסט</option>
                    <option value="hosting">אחסון</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                    סטטוס
                  </label>
                  <select
                    className="form-select"
                    value={editForm.status || "active"}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as Client["status"] })}
                  >
                    <option value="active">פעיל</option>
                    <option value="inactive">לא פעיל</option>
                    <option value="prospect">פוטנציאלי</option>
                  </select>
                </div>
              </div>

              {/* Row 5: Business Field and Marketing Goals */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                    תחום עיסוק
                  </label>
                  <input
                    className="form-input"
                    value={editForm.businessField || ""}
                    onChange={(e) => setEditForm({ ...editForm, businessField: e.target.value })}
                    placeholder="תחום עיסוק"
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                    יעדי שיווק
                  </label>
                  <input
                    className="form-input"
                    value={editForm.marketingGoals || ""}
                    onChange={(e) => setEditForm({ ...editForm, marketingGoals: e.target.value })}
                    placeholder="יעדי שיווק"
                  />
                </div>
              </div>

              {/* Row 6: Key Messages */}
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                  מסרים שיווקיים עיקריים
                </label>
                <textarea
                  className="form-input"
                  value={editForm.keyMarketingMessages || ""}
                  onChange={(e) => setEditForm({ ...editForm, keyMarketingMessages: e.target.value })}
                  placeholder="מסרים שיווקיים עיקריים"
                  style={{ minHeight: "100px", fontFamily: "inherit" }}
                />
              </div>

              {/* Row 7: Retainer Amount and Day */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                    סכום ריטיינר
                  </label>
                  <input
                    className="form-input"
                    type="number"
                    value={editForm.retainerAmount || ""}
                    onChange={(e) => setEditForm({ ...editForm, retainerAmount: Number(e.target.value) })}
                    placeholder="סכום ריטיינר"
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                    יום ריטיינר
                  </label>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    max="31"
                    value={editForm.retainerDay || ""}
                    onChange={(e) => setEditForm({ ...editForm, retainerDay: Number(e.target.value) })}
                    placeholder="1-31"
                  />
                </div>
              </div>

              {/* Row 8: Social URLs */}
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                  אתר אינטרנט
                </label>
                <input
                  className="form-input"
                  value={editForm.websiteUrl || ""}
                  onChange={(e) => setEditForm({ ...editForm, websiteUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                  דף Facebook
                </label>
                <input
                  className="form-input"
                  value={editForm.facebookPageUrl || ""}
                  onChange={(e) => setEditForm({ ...editForm, facebookPageUrl: e.target.value })}
                  placeholder="https://facebook.com/..."
                />
              </div>

              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                  פרופיל Instagram
                </label>
                <input
                  className="form-input"
                  value={editForm.instagramProfileUrl || ""}
                  onChange={(e) => setEditForm({ ...editForm, instagramProfileUrl: e.target.value })}
                  placeholder="https://instagram.com/..."
                />
              </div>

              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                  פרופיל TikTok
                </label>
                <input
                  className="form-input"
                  value={editForm.tiktokProfileUrl || ""}
                  onChange={(e) => setEditForm({ ...editForm, tiktokProfileUrl: e.target.value })}
                  placeholder="https://tiktok.com/@..."
                />
              </div>

              {/* Row 9: Notes */}
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                  הערות
                </label>
                <textarea
                  className="form-input"
                  value={editForm.notes || ""}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  placeholder="הערות"
                  style={{ minHeight: "80px", fontFamily: "inherit" }}
                />
              </div>

              {/* Buttons */}
              <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
                <button
                  onClick={handleSaveEdit}
                  disabled={isSavingEdit}
                  className="mod-btn-primary"
                  style={{
                    flex: 1,
                    padding: "0.75rem 1.5rem",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    opacity: isSavingEdit ? 0.7 : 1,
                    cursor: isSavingEdit ? "not-allowed" : "pointer",
                  }}
                >
                  {isSavingEdit ? "שומר..." : "שמור שינויים"}
                </button>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="mod-btn-ghost"
                  style={{
                    flex: 1,
                    padding: "0.75rem 1.5rem",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                  }}
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── UGC Video Generation Modal ── */}
      {ugcModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            direction: "rtl",
          }}
          onClick={closeUgcModal}
        >
          <div
            style={{
              background: "var(--surface-raised)",
              borderRadius: "0.75rem",
              padding: "2rem",
              maxWidth: "720px",
              width: "95%",
              maxHeight: "90vh",
              overflowY: "auto",
              border: "1px solid var(--border)",
            }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--foreground)", marginBottom: "1.5rem" }}>
              יצירת סרטון UGC {client ? `— ${client.name}` : ""}
            </h2>

            {ugcLoadingOptions ? (
              <div style={{ textAlign: "center", padding: "2rem", color: "var(--foreground-muted)" }}>
                טוען אפשרויות מ-HeyGen...
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

                {/* ═══════════════════════════════════════
                    SECTION 1: Creative Brief (for AI script generation)
                    ═══════════════════════════════════════ */}
                <div style={{ background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.15)", borderRadius: "0.625rem", padding: "1.25rem" }}>
                  <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#8b5cf6", marginBottom: "0.75rem" }}>
                    בריף יצירתי
                  </h3>

                  {/* Creative Prompt */}
                  <div style={{ marginBottom: "1rem" }}>
                    <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: "0.375rem" }}>
                      פרומפט יצירתי
                    </label>
                    <textarea
                      className="form-input"
                      value={ugcCreativePrompt}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setUgcCreativePrompt(e.target.value)}
                      disabled={ugcGenerating || ugcScriptGenerating}
                      placeholder="תאר מה אתה רוצה לסרטון — טון דיבור, קהל יעד, סגנון, זווית מכירה, כיוון רגשי, UGC אותנטי / פרימיום / ישיר..."
                      rows={3}
                      style={{ width: "100%", padding: "0.625rem", fontSize: "0.85rem", resize: "vertical" }}
                    />
                    <p style={{ fontSize: "0.7rem", color: "var(--foreground-muted)", marginTop: "0.25rem" }}>
                      תיאור חופשי של מה שאתה מחפש. ישמש ליצירת התסריט עם AI.
                    </p>
                  </div>

                  {/* Toggle: Structured fields */}
                  <button
                    type="button"
                    onClick={() => setUgcShowStructuredFields((v) => !v)}
                    style={{
                      background: "none", border: "none", cursor: "pointer", padding: "0.375rem 0",
                      fontSize: "0.8rem", fontWeight: 600, color: "#8b5cf6", display: "flex", alignItems: "center", gap: "0.375rem",
                    }}
                  >
                    {ugcShowStructuredFields ? "▾" : "▸"} שדות מובנים (אופציונלי)
                  </button>

                  {ugcShowStructuredFields && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.625rem", marginTop: "0.625rem" }}>
                      {([
                        { label: "מותג / מוצר", value: ugcBrandName, setter: setUgcBrandName, placeholder: "שם המותג או המוצר" },
                        { label: "הצעת ערך / מבצע", value: ugcMainOffer, setter: setUgcMainOffer, placeholder: "מה ההצעה המרכזית?" },
                        { label: "קהל יעד", value: ugcTargetAudience, setter: setUgcTargetAudience, placeholder: "למי מיועד הסרטון?" },
                        { label: "מסר מרכזי", value: ugcKeyMessage, setter: setUgcKeyMessage, placeholder: "מה המסר העיקרי?" },
                        { label: "קריאה לפעולה (CTA)", value: ugcCallToAction, setter: setUgcCallToAction, placeholder: 'למשל: "הירשמו עכשיו"' },
                        { label: "סגנון ויזואלי", value: ugcVisualStyle, setter: setUgcVisualStyle, placeholder: "מינימליסטי, צבעוני, פרימיום..." },
                      ] as const).map(({ label, value, setter, placeholder }) => (
                        <div key={label}>
                          <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: "0.25rem" }}>
                            {label}
                          </label>
                          <input
                            className="form-input"
                            type="text"
                            value={value}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setter(e.target.value)}
                            disabled={ugcGenerating || ugcScriptGenerating}
                            placeholder={placeholder}
                            style={{ width: "100%", padding: "0.5rem", fontSize: "0.8rem" }}
                          />
                        </div>
                      ))}
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: "0.25rem" }}>
                          הנחיות נוספות
                        </label>
                        <input
                          className="form-input"
                          type="text"
                          value={ugcAdditionalInstructions}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUgcAdditionalInstructions(e.target.value)}
                          disabled={ugcGenerating || ugcScriptGenerating}
                          placeholder="כל דבר נוסף שחשוב לך..."
                          style={{ width: "100%", padding: "0.5rem", fontSize: "0.8rem" }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Toggle: Reference file upload */}
                  <div style={{ marginTop: "0.625rem" }}>
                    <button
                      type="button"
                      onClick={() => setUgcShowReferenceUpload((v) => !v)}
                      style={{
                        background: "none", border: "none", cursor: "pointer", padding: "0.375rem 0",
                        fontSize: "0.8rem", fontWeight: 600, color: "#8b5cf6", display: "flex", alignItems: "center", gap: "0.375rem",
                      }}
                    >
                      {ugcShowReferenceUpload ? "▾" : "▸"} חומרי התייחסות (אופציונלי)
                    </button>

                    {ugcShowReferenceUpload && (
                      <div style={{ marginTop: "0.5rem" }}>
                        <p style={{ fontSize: "0.7rem", color: "var(--foreground-muted)", marginBottom: "0.5rem" }}>
                          לוגו, בריף, סקריפט קיים, תמונות, PDF — המערכת תחלץ טקסט מקבצים נתמכים וישמש ליצירת התסריט.
                        </p>
                        <input
                          ref={ugcFileInputRef}
                          type="file"
                          multiple
                          accept=".txt,.md,.csv,.json,.html,.rtf,.pdf,.doc,.docx,.png,.jpg,.jpeg,.svg,.webp"
                          onChange={(e) => handleReferenceFileUpload(e.target.files)}
                          style={{ display: "none" }}
                        />
                        <button
                          type="button"
                          onClick={() => ugcFileInputRef.current?.click()}
                          disabled={ugcGenerating || ugcScriptGenerating}
                          style={{
                            padding: "0.4rem 0.875rem", fontSize: "0.8rem", fontWeight: 600,
                            borderRadius: "0.375rem", border: "1px dashed var(--border)",
                            background: "transparent", color: "var(--foreground)", cursor: "pointer",
                          }}
                        >
                          + העלה קבצים
                        </button>
                        {ugcReferenceFiles.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem", marginTop: "0.5rem" }}>
                            {ugcReferenceFiles.map((f, i) => (
                              <span
                                key={i}
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: "0.25rem",
                                  padding: "0.25rem 0.5rem", fontSize: "0.7rem", borderRadius: "0.25rem",
                                  background: "rgba(139,92,246,0.1)", color: "#8b5cf6",
                                }}
                              >
                                {f.name}
                                <button
                                  type="button"
                                  onClick={() => removeReferenceFile(i)}
                                  style={{ background: "none", border: "none", cursor: "pointer", color: "#8b5cf6", fontSize: "0.8rem", padding: 0, lineHeight: 1 }}
                                >
                                  x
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* ═══════════════════════════════════════
                    SECTION 2: Video Settings (avatar, voice, format)
                    ═══════════════════════════════════════ */}
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: "0.625rem", padding: "1.25rem" }}>
                  <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--foreground)", marginBottom: "0.75rem" }}>
                    הגדרות סרטון
                  </h3>

                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {/* ── Format / Aspect Ratio Selection ── */}
                    <div>
                      <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: "0.375rem" }}>
                        פורמט סרטון
                      </label>
                      <div style={{ display: "flex", gap: "0.75rem" }}>
                        {(["9:16", "1:1", "16:9"] as const).map((fmt) => {
                          const dim = FORMAT_DIMENSIONS[fmt];
                          const isActive = ugcFormat === fmt;
                          const aspectW = fmt === "9:16" ? 24 : fmt === "1:1" ? 32 : 42;
                          const aspectH = fmt === "9:16" ? 42 : fmt === "1:1" ? 32 : 24;
                          return (
                            <button
                              key={fmt}
                              type="button"
                              disabled={ugcGenerating}
                              onClick={() => setUgcFormat(fmt)}
                              style={{
                                flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.375rem",
                                padding: "0.625rem 0.5rem", borderRadius: "0.5rem",
                                border: isActive ? "2px solid #8b5cf6" : "1px solid var(--border)",
                                background: isActive ? "rgba(139,92,246,0.1)" : "transparent",
                                cursor: ugcGenerating ? "not-allowed" : "pointer", transition: "all 150ms",
                              }}
                            >
                              <div style={{ width: aspectW, height: aspectH, borderRadius: 3, border: `2px solid ${isActive ? "#8b5cf6" : "var(--foreground-muted)"}`, opacity: isActive ? 1 : 0.5 }} />
                              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: isActive ? "#8b5cf6" : "var(--foreground)" }}>{fmt}</span>
                              <span style={{ fontSize: "0.65rem", color: "var(--foreground-muted)", textAlign: "center", lineHeight: 1.2 }}>{dim.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* ── Avatar Selection + Preview ── */}
                    <div>
                      <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: "0.375rem" }}>
                        אווטאר (דמות)
                      </label>
                      <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                        <select
                          className="form-select"
                          value={ugcAvatarId}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setUgcAvatarId(e.target.value)}
                          disabled={ugcGenerating}
                          style={{ flex: 1, padding: "0.5rem", fontSize: "0.85rem" }}
                        >
                          <option value="">בחר אווטאר...</option>
                          {ugcAvatars.map((a: any) => (
                            <option key={a.avatar_id} value={a.avatar_id}>
                              {a.avatar_name || a.avatar_id}
                            </option>
                          ))}
                        </select>
                        {selectedAvatar && (selectedAvatar.preview_image_url || selectedAvatar.photo_url) && (
                          <div style={{ width: 48, height: 48, borderRadius: "0.5rem", overflow: "hidden", border: "1px solid var(--border)", flexShrink: 0 }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={selectedAvatar.preview_image_url || selectedAvatar.photo_url}
                              alt={selectedAvatar.avatar_name || "avatar"}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          </div>
                        )}
                      </div>
                      {ugcAvatars.length === 0 && !ugcLoadingOptions && (
                        <p style={{ fontSize: "0.7rem", color: "#f59e0b", marginTop: "0.25rem" }}>
                          לא נמצאו אווטארים. בדוק את מפתח ה-API של HeyGen.
                        </p>
                      )}
                    </div>

                    {/* ── Voice Selection (Hebrew only) + Preview ── */}
                    <div>
                      <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: "0.375rem" }}>
                        קול (עברית)
                      </label>
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <select
                          className="form-select"
                          value={ugcVoiceId}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setUgcVoiceId(e.target.value)}
                          disabled={ugcGenerating}
                          style={{ flex: 1, padding: "0.5rem", fontSize: "0.85rem" }}
                        >
                          <option value="">בחר קול...</option>
                          {(hebrewVoices.length > 0 ? hebrewVoices : ugcVoices).map((v: any) => (
                            <option key={v.voice_id} value={v.voice_id}>
                              {v.name || v.display_name || v.voice_id}{v.language ? ` (${v.language})` : ""}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={handlePlayVoicePreview}
                          disabled={!ugcVoiceId || ugcVoicePlaying || ugcGenerating}
                          title="השמע תצוגה מקדימה"
                          style={{
                            padding: "0.4rem 0.625rem", borderRadius: "0.5rem", border: "1px solid var(--border)",
                            background: ugcVoicePlaying ? "rgba(139,92,246,0.15)" : "transparent",
                            color: !ugcVoiceId ? "var(--foreground-muted)" : "#8b5cf6",
                            fontSize: "0.8rem", fontWeight: 600,
                            cursor: !ugcVoiceId || ugcGenerating ? "not-allowed" : "pointer",
                            opacity: !ugcVoiceId ? 0.4 : 1, transition: "all 150ms", whiteSpace: "nowrap", flexShrink: 0,
                          }}
                        >
                          {ugcVoicePlaying ? "מנגן..." : "השמע"}
                        </button>
                      </div>
                      {hebrewVoices.length === 0 && ugcVoices.length > 0 && (
                        <p style={{ fontSize: "0.7rem", color: "var(--foreground-muted)", marginTop: "0.25rem" }}>
                          לא נמצאו קולות בעברית — מוצגים כל הקולות הזמינים
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* ═══════════════════════════════════════
                    SECTION 3: Script (AI generation + manual edit)
                    ═══════════════════════════════════════ */}
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: "0.625rem", padding: "1.25rem" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.625rem" }}>
                    <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--foreground)", margin: 0 }}>
                      תסריט
                    </h3>
                    {/* ── Generate Script with AI button ── */}
                    {!ugcScriptReplaceConfirm ? (
                      <button
                        type="button"
                        onClick={() => handleGenerateScript()}
                        disabled={ugcScriptGenerating || ugcGenerating || (!ugcCreativePrompt.trim() && !ugcBrandName.trim() && !ugcMainOffer.trim() && !ugcTargetAudience.trim() && !ugcKeyMessage.trim() && ugcReferenceTexts.length === 0)}
                        style={{
                          padding: "0.4rem 0.875rem", fontSize: "0.8rem", fontWeight: 600,
                          borderRadius: "0.375rem", border: "1px solid rgba(139,92,246,0.3)",
                          background: ugcScriptGenerating ? "rgba(139,92,246,0.15)" : "rgba(139,92,246,0.08)",
                          color: "#8b5cf6", cursor: ugcScriptGenerating ? "wait" : "pointer",
                          opacity: (ugcScriptGenerating || ugcGenerating || (!ugcCreativePrompt.trim() && !ugcBrandName.trim() && !ugcMainOffer.trim() && !ugcTargetAudience.trim() && !ugcKeyMessage.trim() && ugcReferenceTexts.length === 0)) ? 0.5 : 1,
                          transition: "all 150ms",
                        }}
                      >
                        {ugcScriptGenerating ? "מייצר תסריט..." : "צור תסריט עם AI"}
                      </button>
                    ) : (
                      /* Replace/Append confirmation */
                      <div style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>יש כבר טקסט —</span>
                        <button
                          type="button"
                          onClick={() => handleGenerateScript("replace")}
                          style={{
                            padding: "0.3rem 0.625rem", fontSize: "0.75rem", fontWeight: 600,
                            borderRadius: "0.25rem", border: "1px solid rgba(139,92,246,0.3)",
                            background: "rgba(139,92,246,0.08)", color: "#8b5cf6", cursor: "pointer",
                          }}
                        >
                          החלף
                        </button>
                        <button
                          type="button"
                          onClick={() => handleGenerateScript("append")}
                          style={{
                            padding: "0.3rem 0.625rem", fontSize: "0.75rem", fontWeight: 600,
                            borderRadius: "0.25rem", border: "1px solid rgba(139,92,246,0.3)",
                            background: "rgba(139,92,246,0.08)", color: "#8b5cf6", cursor: "pointer",
                          }}
                        >
                          הוסף לקיים
                        </button>
                        <button
                          type="button"
                          onClick={() => setUgcScriptReplaceConfirm(false)}
                          style={{
                            padding: "0.3rem 0.5rem", fontSize: "0.75rem", fontWeight: 600,
                            borderRadius: "0.25rem", border: "1px solid var(--border)",
                            background: "transparent", color: "var(--foreground-muted)", cursor: "pointer",
                          }}
                        >
                          ביטול
                        </button>
                      </div>
                    )}
                  </div>

                  {ugcScriptGenerating && (
                    <div style={{
                      padding: "0.5rem 0.75rem", marginBottom: "0.5rem", borderRadius: "0.375rem",
                      background: "rgba(139,92,246,0.08)", color: "#8b5cf6", fontSize: "0.8rem",
                      display: "flex", alignItems: "center", gap: "0.5rem",
                    }}>
                      <span style={{ display: "inline-block", width: 14, height: 14, borderRadius: "50%", border: "2px solid #8b5cf6", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
                      מייצר תסריט בעברית על בסיס הבריף...
                      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </div>
                  )}

                  <textarea
                    className="form-input"
                    value={ugcScript}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setUgcScript(e.target.value)}
                    disabled={ugcGenerating || ugcScriptGenerating}
                    placeholder="כתוב כאן את הטקסט לסרטון UGC, או לחץ על ״צור תסריט עם AI״ למעלה..."
                    rows={6}
                    style={{ width: "100%", padding: "0.625rem", fontSize: "0.875rem", resize: "vertical" }}
                  />
                  <p style={{ fontSize: "0.7rem", color: "var(--foreground-muted)", marginTop: "0.25rem" }}>
                    זהו הטקסט הסופי שהאווטאר יגיד בסרטון. ניתן לערוך לאחר יצירה עם AI.
                  </p>
                </div>

                {/* ── Progress / Status ── */}
                {ugcProgress && (
                  <div
                    style={{
                      padding: "0.75rem 1rem",
                      borderRadius: "0.5rem",
                      background: ugcStatus === "completed"
                        ? "rgba(34,197,94,0.1)"
                        : ugcStatus === "failed"
                          ? "rgba(239,68,68,0.1)"
                          : "rgba(139,92,246,0.1)",
                      color: ugcStatus === "completed"
                        ? "#22c55e"
                        : ugcStatus === "failed"
                          ? "#ef4444"
                          : "#8b5cf6",
                      fontSize: "0.85rem",
                      fontWeight: 500,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {ugcProgress}
                  </div>
                )}

                {/* ── Buttons ── */}
                <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-start" }}>
                  <button
                    className="mod-btn-primary"
                    onClick={handleGenerateUGC}
                    disabled={ugcGenerating || !ugcAvatarId || !ugcVoiceId || !ugcScript.trim()}
                    style={{
                      padding: "0.625rem 1.5rem",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      opacity: (ugcGenerating || !ugcAvatarId || !ugcVoiceId || !ugcScript.trim()) ? 0.5 : 1,
                      background: "#8b5cf6",
                      color: "#fff",
                      border: "none",
                      borderRadius: "0.5rem",
                      cursor: ugcGenerating ? "wait" : "pointer",
                    }}
                  >
                    {ugcGenerating ? "מייצר סרטון..." : "צור סרטון"}
                  </button>
                  <button
                    onClick={closeUgcModal}
                    className="mod-btn-ghost"
                    style={{ padding: "0.625rem 1.5rem", fontSize: "0.875rem", fontWeight: 600 }}
                  >
                    סגור
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

/* ═══ Client Alerts ═══ */
function ClientAlerts({ client }: { client: Client }) {
  const alerts: { icon: string; text: string; color: string }[] = [];

  if (client.monthlyGanttStatus === "none") {
    alerts.push({ icon: "📊", text: "אין גאנט חודשי — מומלץ ליצור תוכנית תוכן", color: "#f59e0b" });
  }
  if (client.paymentStatus === "overdue") {
    alerts.push({ icon: "💰", text: "תשלום באיחור — יש לטפל בהקדם", color: "#ef4444" });
  }
  if (!client.assignedManagerId) {
    alerts.push({ icon: "👤", text: "לא הוקצה עובד אחראי", color: "#f59e0b" });
  }
  if (client.annualGanttStatus === "none") {
    alerts.push({ icon: "📆", text: "אין גאנט שנתי — מומלץ לתכנן", color: "#6b7280" });
  }
  if (client.portalEnabled && !client.portalUserId) {
    alerts.push({ icon: "🔑", text: "פורטל מופעל אך לא נוצרה גישה ללקוח", color: "#3b82f6" });
  }

  if (alerts.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.5rem" }}>
      {alerts.map((alert, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.625rem 1rem",
            borderRadius: "0.5rem",
            background: `${alert.color}10`,
            border: `1px solid ${alert.color}25`,
            fontSize: "0.82rem",
            color: alert.color,
            fontWeight: 500,
          }}
        >
          <span style={{ fontSize: "1rem" }}>{alert.icon}</span>
          {alert.text}
        </div>
      ))}
    </div>
  );
}



const TASK_TYPE_CONFIG: Record<string, { emoji: string; label: string; color: string }> = {
  social: { emoji: "📱", label: "סושיאל", color: "#3b82f6" },
  internal: { emoji: "🏢", label: "פנימי", color: "#8b5cf6" },
  design: { emoji: "🎨", label: "עיצוב", color: "#ec4899" },
  website: { emoji: "🌐", label: "אתר", color: "#10b981" },
  branding: { emoji: "✨", label: "מיתוג", color: "#f59e0b" },
  general: { emoji: "📋", label: "כללי", color: "#6b7280" },
};

const TASK_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  new: { label: "חדש", color: "#3b82f6" },
  in_progress: { label: "בעבודה", color: "#f59e0b" },
  under_review: { label: "בבדיקה", color: "#8b5cf6" },
  returned: { label: "הוחזר", color: "#f97316" },
  approved: { label: "אושר", color: "#22c55e" },
  completed: { label: "הושלם", color: "#10b981" },
};

const TASK_PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  urgent: { label: "דחוף", color: "#ef4444" },
  high: { label: "גבוה", color: "#f97316" },
  medium: { label: "בינוני", color: "#3b82f6" },
  low: { label: "נמוך", color: "#9ca3af" },
};

const HEBREW_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const HEBREW_WEEKDAYS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

interface TabTasksProps {
  client: Client;
  employees: Employee[];
}

function TabTasks({ client, employees }: TabTasksProps) {
  const [viewMode, setViewMode] = useState<"cards" | "calendar">("cards");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  // Form state — default assignee to client's responsible employee
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formType, setFormType] = useState<string>("general");
  const [formStatus, setFormStatus] = useState("new");
  const [formPriority, setFormPriority] = useState("medium");
  const [formAssignee, setFormAssignee] = useState(client.assignedManagerId || "");
  const [formDueDate, setFormDueDate] = useState("");

  // Use global tasks store — single source of truth
  const { data: allTasks, create: createTask } = useTasks();
  const clientTasks = (allTasks || []).filter((t: any) => t.clientId === client.id);

  // Helper: get task type from tags array
  const getTaskType = (task: any): string => {
    const tags = task.tags || [];
    const typeTag = tags.find((t: string) => Object.keys(TASK_TYPE_CONFIG).includes(t));
    return typeTag || 'general';
  };

  // Helper: get assignee from assigneeIds array
  const getAssigneeId = (task: any): string | null => {
    return (task.assigneeIds && task.assigneeIds.length > 0) ? task.assigneeIds[0] : null;
  };

  // Filter tasks
  const filteredTasks = clientTasks.filter((task: any) => {
    if (selectedCategory !== "all" && getTaskType(task) !== selectedCategory) return false;
    if (selectedStatus !== "all" && task.status !== selectedStatus) return false;
    return true;
  });

  // Group tasks by type
  const tasksByType = Object.keys(TASK_TYPE_CONFIG).reduce((acc, type) => {
    acc[type] = filteredTasks.filter((t: any) => getTaskType(t) === type);
    return acc;
  }, {} as Record<string, any[]>);

  // Calendar helpers
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(calYear, calMonth, 1).getDay();
  const adjustedFirstDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // 0=Monday

  // Get tasks for a specific day
  const getTasksForDay = (day: number): any[] => {
    return filteredTasks.filter((t) => {
      if (!t.dueDate) return false;
      const taskDate = new Date(t.dueDate);
      return (
        taskDate.getDate() === day &&
        taskDate.getMonth() === calMonth &&
        taskDate.getFullYear() === calYear
      );
    });
  };

  const isOverdue = (dueDate: string | null): boolean => {
    if (!dueDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return due < today;
  };

  const handleAddTask = async () => {
    if (!formTitle.trim()) return;

    // Write to global tasks store — single source of truth
    const newTask = {
      clientId: client.id,
      clientName: client.name,
      title: formTitle,
      description: formDescription,
      status: formStatus,
      priority: formPriority,
      assigneeIds: formAssignee ? [formAssignee] : [],
      dueDate: formDueDate || null,
      tags: [formType],  // Store task type as first tag
      files: [],
      notes: "",
    };

    try {
      await createTask(newTask as any);
      setFormTitle("");
      setFormDescription("");
      setFormType("general");
      setFormStatus("new");
      setFormPriority("medium");
      setFormAssignee(client.assignedManagerId || "");
      setFormDueDate("");
      setShowAddForm(false);
    } catch (error) {
      console.error("Error creating task:", error);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header with Controls */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
        <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
          משימות לקוח
        </h3>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={() => setViewMode("cards")}
            style={{
              fontSize: "0.75rem",
              padding: "0.4rem 0.75rem",
              background: viewMode === "cards" ? "var(--accent)" : "var(--surface-raised)",
              color: viewMode === "cards" ? "white" : "var(--foreground-muted)",
              border: `1px solid ${viewMode === "cards" ? "var(--accent)" : "var(--border)"}`,
              borderRadius: "0.375rem",
              cursor: "pointer",
              transition: "all 150ms",
              fontWeight: 500,
            }}
          >
            🎴 כרטיסים
          </button>
          <button
            onClick={() => setViewMode("calendar")}
            style={{
              fontSize: "0.75rem",
              padding: "0.4rem 0.75rem",
              background: viewMode === "calendar" ? "var(--accent)" : "var(--surface-raised)",
              color: viewMode === "calendar" ? "white" : "var(--foreground-muted)",
              border: `1px solid ${viewMode === "calendar" ? "var(--accent)" : "var(--border)"}`,
              borderRadius: "0.375rem",
              cursor: "pointer",
              transition: "all 150ms",
              fontWeight: 500,
            }}
          >
            📅 לוח שנה
          </button>
        </div>
      </div>

      {/* Category Filters */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", paddingBottom: "0.5rem" }}>
        <button
          onClick={() => setSelectedCategory("all")}
          style={{
            fontSize: "0.75rem",
            padding: "0.35rem 0.75rem",
            background: selectedCategory === "all" ? "var(--accent)" : "var(--surface-raised)",
            color: selectedCategory === "all" ? "white" : "var(--foreground-muted)",
            border: `1px solid ${selectedCategory === "all" ? "var(--accent)" : "var(--border)"}`,
            borderRadius: "999px",
            cursor: "pointer",
            transition: "all 150ms",
            fontWeight: 500,
          }}
        >
          הכל
        </button>
        {Object.entries(TASK_TYPE_CONFIG).map(([type, config]) => (
          <button
            key={type}
            onClick={() => setSelectedCategory(type)}
            style={{
              fontSize: "0.75rem",
              padding: "0.35rem 0.75rem",
              background: selectedCategory === type ? `${config.color}20` : "var(--surface-raised)",
              color: selectedCategory === type ? config.color : "var(--foreground-muted)",
              border: `1px solid ${selectedCategory === type ? config.color : "var(--border)"}`,
              borderRadius: "999px",
              cursor: "pointer",
              transition: "all 150ms",
              fontWeight: 500,
            }}
          >
            {config.emoji} {config.label}
          </button>
        ))}
      </div>

      {/* Status Filters */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", paddingBottom: "0.5rem" }}>
        <button
          onClick={() => setSelectedStatus("all")}
          style={{
            fontSize: "0.75rem",
            padding: "0.35rem 0.75rem",
            background: selectedStatus === "all" ? "var(--accent)" : "var(--surface-raised)",
            color: selectedStatus === "all" ? "white" : "var(--foreground-muted)",
            border: `1px solid ${selectedStatus === "all" ? "var(--accent)" : "var(--border)"}`,
            borderRadius: "999px",
            cursor: "pointer",
            transition: "all 150ms",
            fontWeight: 500,
          }}
        >
          הכל
        </button>
        {Object.entries(TASK_STATUS_CONFIG).map(([status, config]) => (
          <button
            key={status}
            onClick={() => setSelectedStatus(status)}
            style={{
              fontSize: "0.75rem",
              padding: "0.35rem 0.75rem",
              background: selectedStatus === status ? `${config.color}20` : "var(--surface-raised)",
              color: selectedStatus === status ? config.color : "var(--foreground-muted)",
              border: `1px solid ${selectedStatus === status ? config.color : "var(--border)"}`,
              borderRadius: "999px",
              cursor: "pointer",
              transition: "all 150ms",
              fontWeight: 500,
            }}
          >
            {config.label}
          </button>
        ))}
      </div>

      {/* Workflow Info Card */}
      <div
        style={{
          background: "#EEF2FF",
          border: "1px solid #C7D2FE",
          borderRadius: "0.5rem",
          padding: "0.75rem 1rem",
          fontSize: "0.8rem",
          color: "#3730A3",
          display: "flex",
          gap: "0.5rem",
          alignItems: "flex-start",
        }}
      >
        <span style={{ fontSize: "1rem", flexShrink: 0 }}>ℹ️</span>
        <div>כשמעלים קובץ למשימה, הסטטוס משתנה ל"בבדיקה" והמשימה נכנסת למרכז האישורים</div>
      </div>

      {/* Add Task Button */}
      <button
        onClick={() => setShowAddForm(!showAddForm)}
        className="mod-btn-primary"
        style={{
          fontSize: "0.8rem",
          padding: "0.5rem 1rem",
          width: "fit-content",
        }}
      >
        + משימה חדשה
      </button>

      {/* Add Task Form */}
      {showAddForm && (
        <div
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
          }}
        >
          <h4 style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--foreground)", marginBottom: "1rem", margin: 0 }}>
            משימה חדשה
          </h4>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem" }}>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                כותרת *
              </label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="כותרת המשימה"
                className="form-input"
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                תיאור
              </label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="פרטים נוספים על המשימה"
                className="form-input"
                style={{ width: "100%", minHeight: "60px", resize: "vertical" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                  סוג משימה
                </label>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {Object.entries(TASK_TYPE_CONFIG).map(([type, config]) => (
                    <button
                      key={type}
                      onClick={() => setFormType(type)}
                      style={{
                        fontSize: "0.7rem",
                        padding: "0.35rem 0.6rem",
                        background: formType === type ? `${config.color}20` : "transparent",
                        color: formType === type ? config.color : "var(--foreground-muted)",
                        border: `1px solid ${formType === type ? config.color : "var(--border)"}`,
                        borderRadius: "0.375rem",
                        cursor: "pointer",
                        transition: "all 150ms",
                        fontWeight: 500,
                      }}
                    >
                      {config.emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                  סטטוס
                </label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="form-select"
                  style={{ width: "100%" }}
                >
                  {Object.entries(TASK_STATUS_CONFIG).map(([status, config]) => (
                    <option key={status} value={status}>
                      {config.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                  עדיפות
                </label>
                <select
                  value={formPriority}
                  onChange={(e) => setFormPriority(e.target.value)}
                  className="form-select"
                  style={{ width: "100%" }}
                >
                  {Object.entries(TASK_PRIORITY_CONFIG).map(([priority, config]) => (
                    <option key={priority} value={priority}>
                      {config.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                  מוקדש ל
                </label>
                <select
                  value={formAssignee}
                  onChange={(e) => setFormAssignee(e.target.value)}
                  className="form-select"
                  style={{ width: "100%" }}
                >
                  <option value="">לא מוקצה</option>
                  {employees.filter(e => TEAM_MEMBERS.includes(e.name)).map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                  תאריך יעד
                </label>
                <input
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  className="form-input"
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", fontStyle: "italic" }}>
              ניתן להוסיף קבצים לאחר יצירת המשימה
            </div>

            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowAddForm(false)}
                className="mod-btn-ghost"
                style={{
                  fontSize: "0.8rem",
                  padding: "0.5rem 1rem",
                }}
              >
                ביטול
              </button>
              <button
                onClick={handleAddTask}
                className="mod-btn-primary"
                style={{
                  fontSize: "0.8rem",
                  padding: "0.5rem 1rem",
                }}
              >
                ✓ שמור משימה
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cards View */}
      {viewMode === "cards" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {Object.entries(tasksByType).map(([typeKey, tasks]) => {
            const config = TASK_TYPE_CONFIG[typeKey];
            if (tasks.length === 0) return null;

            return (
              <div key={typeKey}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.75rem",
                    paddingBottom: "0.5rem",
                    borderBottom: `2px solid ${config.color}30`,
                  }}
                >
                  <span style={{ fontSize: "1.25rem" }}>{config.emoji}</span>
                  <h4 style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
                    {config.label}
                  </h4>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      padding: "0.2rem 0.5rem",
                      background: `${config.color}20`,
                      color: config.color,
                      borderRadius: "999px",
                      marginInlineStart: "auto",
                    }}
                  >
                    {tasks.length}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {tasks.map((task: any) => {
                    const assignee = employees.find((e) => e.id === getAssigneeId(task));
                    const statusConfig = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG.new;
                    const priorityConfig = TASK_PRIORITY_CONFIG[task.priority] || TASK_PRIORITY_CONFIG.medium;
                    const isLate = isOverdue(task.dueDate);

                    return (
                      <div
                        key={task.id}
                        style={{
                          background: "var(--surface-raised)",
                          border: "1px solid var(--border)",
                          borderRadius: "0.5rem",
                          padding: "1rem",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.75rem",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--foreground)" }}>
                            {task.title}
                          </div>
                          {task.description && (
                            <div
                              style={{
                                fontSize: "0.8rem",
                                color: "var(--foreground-muted)",
                                marginTop: "0.25rem",
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                              }}
                            >
                              {task.description}
                            </div>
                          )}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                          <span
                            style={{
                              fontSize: "0.65rem",
                              fontWeight: 600,
                              padding: "0.25rem 0.5rem",
                              borderRadius: 3,
                              background: `${statusConfig.color}15`,
                              color: statusConfig.color,
                              border: `1px solid ${statusConfig.color}30`,
                            }}
                          >
                            {statusConfig.label}
                          </span>

                          <span
                            style={{
                              fontSize: "0.65rem",
                              fontWeight: 600,
                              padding: "0.25rem 0.5rem",
                              borderRadius: 3,
                              background: `${priorityConfig.color}15`,
                              color: priorityConfig.color,
                              border: `1px solid ${priorityConfig.color}30`,
                            }}
                          >
                            {priorityConfig.label}
                          </span>

                          {assignee && (
                            <span style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>
                              👤 {assignee.name}
                            </span>
                          )}

                          {task.dueDate && (
                            <span
                              style={{
                                fontSize: "0.75rem",
                                color: isLate ? "#ef4444" : "var(--foreground-muted)",
                                fontWeight: isLate ? 600 : 400,
                              }}
                            >
                              📅 {formatDate(task.dueDate)}
                            </span>
                          )}

                          {task.files && task.files.length > 0 && (
                            <span
                              style={{
                                fontSize: "0.65rem",
                                fontWeight: 600,
                                padding: "0.25rem 0.5rem",
                                borderRadius: 3,
                                background: "#38bdf820",
                                color: "#38bdf8",
                              }}
                            >
                              📎 {task.files.length}
                            </span>
                          )}

                          {task.notes && (
                            <span style={{ fontSize: "1rem" }} title="יש הערות">📝</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {filteredTasks.length === 0 && (
            <div style={{ textAlign: "center", padding: "2rem 1rem", color: "var(--foreground-muted)" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>✓</div>
              <p style={{ fontSize: "0.9rem", margin: 0 }}>אין משימות עדיין</p>
              <button
                onClick={() => setShowAddForm(true)}
                style={{
                  marginTop: "1rem",
                  fontSize: "0.8rem",
                  padding: "0.5rem 1rem",
                  color: "var(--accent)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 500,
                  textDecoration: "underline",
                }}
              >
                + צור משימה ראשונה
              </button>
            </div>
          )}
        </div>
      )}

      {/* Calendar View */}
      {viewMode === "calendar" && (
        <div
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
          }}
        >
          {/* Calendar Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
            <button
              onClick={() => setCalMonth(calMonth === 0 ? 11 : calMonth - 1)}
              style={{
                background: "none",
                border: "none",
                fontSize: "1.2rem",
                cursor: "pointer",
                color: "var(--foreground)",
              }}
            >
              ←
            </button>
            <h4 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
              {HEBREW_MONTHS[calMonth]} {calYear}
            </h4>
            <button
              onClick={() => setCalMonth(calMonth === 11 ? 0 : calMonth + 1)}
              style={{
                background: "none",
                border: "none",
                fontSize: "1.2rem",
                cursor: "pointer",
                color: "var(--foreground)",
              }}
            >
              →
            </button>
          </div>

          {/* Weekday Headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0.5rem", marginBottom: "0.75rem" }}>
            {HEBREW_WEEKDAYS.map((day) => (
              <div
                key={day}
                style={{
                  textAlign: "center",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "var(--foreground-muted)",
                  padding: "0.5rem 0",
                }}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0.5rem" }}>
            {/* Empty cells before first day */}
            {Array.from({ length: adjustedFirstDay }).map((_, i) => (
              <div
                key={`empty-${i}`}
                style={{
                  aspectRatio: "1",
                  background: "transparent",
                  borderRadius: "0.375rem",
                }}
              />
            ))}

            {/* Days of month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayTasks = getTasksForDay(day);

              return (
                <div
                  key={day}
                  style={{
                    aspectRatio: "1",
                    background: "var(--background)",
                    border: `1px solid var(--border)`,
                    borderRadius: "0.375rem",
                    padding: "0.35rem",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    cursor: dayTasks.length > 0 ? "pointer" : "default",
                  }}
                >
                  <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.25rem" }}>
                    {day}
                  </div>

                  {dayTasks.length > 0 && (
                    <div style={{ display: "flex", gap: "0.2rem", flexWrap: "wrap", justifyContent: "center" }}>
                      {dayTasks.slice(0, 3).map((task: any) => (
                        <div
                          key={task.id}
                          style={{
                            width: "0.4rem",
                            height: "0.4rem",
                            borderRadius: "50%",
                            background: (TASK_TYPE_CONFIG[getTaskType(task)] || TASK_TYPE_CONFIG.general).color,
                          }}
                          title={task.title}
                        />
                      ))}
                      {dayTasks.length > 3 && (
                        <div style={{ fontSize: "0.5rem", color: "var(--foreground-muted)", fontWeight: 600 }}>
                          +{dayTasks.length - 3}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Empty State */}
          {filteredTasks.length === 0 && (
            <div style={{ textAlign: "center", padding: "2rem 1rem", color: "var(--foreground-muted)", marginTop: "1rem" }}>
              <p style={{ fontSize: "0.9rem", margin: 0 }}>אין משימות בחודש זה</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
