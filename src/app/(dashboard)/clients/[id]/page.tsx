"use client";

export const dynamic = "force-dynamic";

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
import { TabAutomations } from "@/components/client/tab-automations";

const AVATAR_COLORS = ["#00B5FE", "#00B5FE", "#22c55e", "#f59e0b", "#ec4899", "#14b8a6"];

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
  branding: { label: "מיתוג", color: "#00B5FE" },
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

type TabName = "overview" | "content" | "tasks" | "leads" | "social" | "ads" | "files" | "accounting" | "portal" | "activity" | "dna" | "research" | "videos" | "automations";

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
  { id: "automations", label: "אוטומציות" },
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
  const [ugcScriptTemplate, setUgcScriptTemplate] = useState<string>("");
  const [ugcCreativePrompt, setUgcCreativePrompt] = useState("");
  const [ugcBrandName, setUgcBrandName] = useState("");
  const [ugcMainOffer, setUgcMainOffer] = useState("");
  const [ugcTargetAudience, setUgcTargetAudience] = useState("");
  const [ugcKeyMessage, setUgcKeyMessage] = useState("");
  const [ugcCallToAction, setUgcCallToAction] = useState("");
  const [ugcVisualStyle, setUgcVisualStyle] = useState("cinematic-dark");
  const [ugcAdditionalInstructions, setUgcAdditionalInstructions] = useState("");
  const [ugcReferenceFiles, setUgcReferenceFiles] = useState<File[]>([]);
  const [ugcReferenceTexts, setUgcReferenceTexts] = useState<string[]>([]);
  const [ugcScriptGenerating, setUgcScriptGenerating] = useState(false);
  const [ugcScriptReplaceConfirm, setUgcScriptReplaceConfirm] = useState(false);
  const [ugcMultiVersions, setUgcMultiVersions] = useState<string[]>([]);
  const [ugcMultiLabels, setUgcMultiLabels] = useState<string[]>([]);
  const [ugcMultiGenerating, setUgcMultiGenerating] = useState(false);
  const ugcFileInputRef = useRef<HTMLInputElement | null>(null);

  // ── UGC Branded Video Composition State ──
  const [ugcDuration, setUgcDuration] = useState<15 | 30 | 45 | 60>(30);
  const [ugcLogoUrl, setUgcLogoUrl] = useState<string | null>(null);
  const [ugcProductImageUrl, setUgcProductImageUrl] = useState<string | null>(null);
  const [ugcTagline, setUgcTagline] = useState("");
  const [ugcPlatform, setUgcPlatform] = useState<"instagram-reels" | "tiktok" | "youtube-shorts" | "facebook" | "linkedin" | "generic">("instagram-reels");
  const [ugcComposeJobId, setUgcComposeJobId] = useState<string | null>(null);
  const [ugcComposeProgress, setUgcComposeProgress] = useState(0);
  const [ugcComposeStage, setUgcComposeStage] = useState("");
  const ugcComposePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ugcLogoInputRef = useRef<HTMLInputElement | null>(null);
  const ugcProductInputRef = useRef<HTMLInputElement | null>(null);

  // Visual style definitions for the selector
  const UGC_VISUAL_STYLES: { id: string; label: string; desc: string; gradient: string[] }[] = [
    { id: "cinematic-dark", label: "קולנועי כהה", desc: "דרמטי, עמוק", gradient: ["#0a0a0f", "#1a1a2e"] },
    { id: "clean-minimal", label: "נקי ומינימלי", desc: "מודרני, בהיר", gradient: ["#fafafa", "#e8e8e8"] },
    { id: "bold-energy", label: "אנרגטי ונועז", desc: "חזק, מכירתי", gradient: ["#ff0844", "#ff6a00"] },
    { id: "luxury-gold", label: "יוקרתי זהוב", desc: "פרימיום, זהב", gradient: ["#0c0c0c", "#2d2006"] },
    { id: "neon-glow", label: "ניאון זוהר", desc: "טכנולוגי, צעיר", gradient: ["#0f0f23", "#1a0a2e"] },
    { id: "organic-warm", label: "אורגני וחם", desc: "טבעי, חם", gradient: ["#fef3e2", "#f5deb3"] },
    { id: "corporate-pro", label: "עסקי מקצועי", desc: "רשמי, B2B", gradient: ["#0f172a", "#334155"] },
    { id: "social-pop", label: "סושיאל פופ", desc: "שובב, צבעוני", gradient: ["#667eea", "#f093fb"] },
  ];

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
        marketingGoals: client.marketingGoals ?? '',
        keyMarketingMessages: client.keyMarketingMessages ?? '',
        retainerAmount: client.retainerAmount,
        retainerDay: client.retainerDay,
        status: client.status,
        notes: client.notes,
        websiteUrl: client.websiteUrl ?? '',
        facebookPageUrl: client.facebookPageUrl ?? '',
        instagramProfileUrl: client.instagramProfileUrl ?? '',
        tiktokProfileUrl: client.tiktokProfileUrl ?? '',
        linkedinUrl: client.linkedinUrl ?? '',
        youtubeUrl: client.youtubeUrl ?? '',
      });
      setIsEditModalOpen(true);
    }
  };

  const handleSaveEdit = async () => {
    console.log('[EDIT] handleSaveEdit called');
    console.log('[EDIT] editForm:', JSON.stringify(editForm));
    console.log('[EDIT] client:', client?.id, client?.name);
    console.log('[EDIT] isSavingEdit:', isSavingEdit);

    if (!editForm.name?.trim()) {
      console.log('[EDIT] BLOCKED: name is empty');
      toast("אנא הזן שם לקוח", "error");
      return;
    }

    setIsSavingEdit(true);
    try {
      console.log('[EDIT] calling updateClient with id:', client!.id);
      const result = await updateClient(client!.id, editForm);
      console.log('[EDIT] updateClient returned:', result);
      toast("לקוח עודכן בהצלחה", "success");
      setIsEditModalOpen(false);
    } catch (error) {
      console.error('[EDIT] updateClient FAILED:', error);
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
    setUgcScriptTemplate("");
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
    setUgcScriptReplaceConfirm(false);
    setUgcMultiVersions([]);
    setUgcMultiLabels([]);
    setUgcMultiGenerating(false);

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
          scriptTemplate: ugcScriptTemplate,
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
    ugcScriptGenerating, ugcScript, ugcScriptTemplate,
    ugcCreativePrompt, ugcBrandName, ugcMainOffer, ugcTargetAudience,
    ugcKeyMessage, ugcCallToAction, ugcVisualStyle, ugcAdditionalInstructions,
    ugcReferenceTexts, client, toast,
  ]);

  const handleGenerateMultiVersions = useCallback(async () => {
    if (ugcMultiGenerating || ugcScriptGenerating) return;
    setUgcMultiGenerating(true);
    setUgcMultiVersions([]);
    setUgcMultiLabels([]);

    try {
      const res = await fetch("/api/data/ugc/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creativePrompt: ugcCreativePrompt,
          scriptTemplate: ugcScriptTemplate,
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
          multiVersion: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `שגיאה ${res.status}`);

      if (data.versions && Array.isArray(data.versions)) {
        setUgcMultiVersions(data.versions);
        setUgcMultiLabels(data.labels || []);
        toast("3 גרסאות תסריט נוצרו בהצלחה!", "success");
      } else {
        throw new Error("תשובה לא תקינה מהשרת");
      }
    } catch (err: any) {
      console.error("[UGC] Multi-version generation error:", err);
      toast(`שגיאה ביצירת גרסאות: ${err?.message}`, "error");
    } finally {
      setUgcMultiGenerating(false);
    }
  }, [
    ugcMultiGenerating, ugcScriptGenerating, ugcScriptTemplate,
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
    setUgcProgress("preparing");
    setUgcComposeProgress(0);
    setUgcComposeStage("");

    const dimension = FORMAT_DIMENSIONS[ugcFormat] || FORMAT_DIMENSIONS["9:16"];
    const formatSlug = ugcFormat.replace(":", "x");

    try {
      // ═══ Stage 1: Generate avatar video via HeyGen ═══
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
      setUgcProgress("generating");

      // Poll for HeyGen completion every 5 seconds
      const clientRef = client;
      ugcPollRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/data/heygen/status?videoId=${videoId}`);
          const statusData = await statusRes.json();
          const status = statusData?.status;
          setUgcStatus(status);

          if (status === "completed" && statusData.videoUrl) {
            if (ugcPollRef.current) { clearInterval(ugcPollRef.current); ugcPollRef.current = null; }

            if (!statusData.videoUrl.startsWith("http")) {
              setUgcProgress("error");
              setUgcGenerating(false);
              return;
            }

            // ═══ Stage 2: Analyze script into scenes ═══
            setUgcProgress("analyzing");
            let scenes: any[] = [];
            try {
              const analyzeRes = await fetch("/api/data/ugc/analyze-script", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  script: ugcScript,
                  brandName: ugcBrandName || clientRef.name,
                  totalDurationSec: ugcDuration,
                  format: ugcFormat,
                  visualStyle: ugcVisualStyle,
                  hasLogo: !!ugcLogoUrl,
                  hasProductImage: !!ugcProductImageUrl,
                }),
              });
              const analyzeData = await analyzeRes.json();
              if (analyzeRes.ok && analyzeData.scenes) {
                scenes = analyzeData.scenes;
              }
            } catch (analyzeErr) {
              console.warn("[UGC] Scene analysis failed, using defaults:", analyzeErr);
            }

            // ═══ Stage 3: Queue Remotion composition render ═══
            setUgcProgress("composing");
            try {
              const composeRes = await fetch("/api/data/ugc/compose", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  avatarVideoUrl: statusData.videoUrl,
                  durationSec: ugcDuration,
                  format: ugcFormat,
                  visualStyle: ugcVisualStyle,
                  scenes,
                  logoUrl: ugcLogoUrl,
                  productImageUrl: ugcProductImageUrl,
                  brandName: ugcBrandName || clientRef.name,
                  tagline: ugcTagline,
                  musicUrl: null,
                  musicVolume: 20,
                  platform: ugcPlatform,
                  ctaText: ugcCallToAction || "",
                  ctaUrl: "",
                  watermarkEnabled: false,
                }),
              });
              const composeData = await composeRes.json();

              if (!composeRes.ok) throw new Error(composeData?.error || "Compose failed");
              const composeJobId = composeData.jobId;
              setUgcComposeJobId(composeJobId);

              // ═══ Stage 4: Poll for Remotion render completion ═══
              ugcComposePollRef.current = setInterval(async () => {
                try {
                  const jobRes = await fetch(`/api/data/ugc/compose?jobId=${composeJobId}`);
                  const jobData = await jobRes.json();

                  setUgcComposeProgress(jobData.progress || 0);
                  setUgcComposeStage(jobData.currentStage || "");

                  if (jobData.status === "completed" && jobData.videoUrl) {
                    if (ugcComposePollRef.current) { clearInterval(ugcComposePollRef.current); ugcComposePollRef.current = null; }

                    // ═══ Stage 5: Save final composed video ═══
                    setUgcProgress("saving");
                    const now = new Date().toISOString();
                    const savedFile = await createClientFile({
                      clientId: clientRef.id,
                      fileName: `UGC_Branded_${clientRef.name}_${formatSlug}_${now.split("T")[0]}.mp4`,
                      fileUrl: jobData.videoUrl,
                      fileType: "video",
                      category: "social_media",
                      fileSize: 0,
                      uploadedBy: "PixelManage AI",
                      notes: `סרטון UGC ממותג שנוצר עם PixelManage AI.\nסגנון: ${ugcVisualStyle}\nפלטפורמה: ${ugcPlatform}\nפורמט: ${ugcFormat} (${dimension.width}x${dimension.height})\nתסריט: ${ugcScript.slice(0, 200)}`,
                      linkedTaskId: null,
                      linkedGanttItemId: null,
                      createdAt: now,
                      updatedAt: now,
                    } as any);

                    if (!savedFile || !(savedFile as any).id) {
                      throw new Error("השמירה החזירה תשובה ריקה");
                    }

                    await refetchClientFiles();
                    setUgcProgress("done");
                    toast("סרטון UGC ממותג נוצר ונשמר בהצלחה!", "success");
                    setTimeout(() => {
                      setUgcGenerating(false);
                      setUgcModalOpen(false);
                      setActiveTab("files");
                    }, 2000);
                    return;
                  } else if (jobData.status === "failed") {
                    if (ugcComposePollRef.current) { clearInterval(ugcComposePollRef.current); ugcComposePollRef.current = null; }

                    // Fallback: save the raw HeyGen video
                    setUgcProgress("saving");
                    const now = new Date().toISOString();
                    await createClientFile({
                      clientId: clientRef.id,
                      fileName: `UGC_${clientRef.name}_${formatSlug}_${now.split("T")[0]}.mp4`,
                      fileUrl: statusData.videoUrl,
                      fileType: "video",
                      category: "social_media",
                      fileSize: 0,
                      uploadedBy: "HeyGen AI",
                      notes: `סרטון UGC (ללא מיתוג — הקומפוזיציה נכשלה).\nפורמט: ${ugcFormat}\nתסריט: ${ugcScript.slice(0, 200)}`,
                      linkedTaskId: null,
                      linkedGanttItemId: null,
                      createdAt: now,
                      updatedAt: now,
                    } as any);
                    await refetchClientFiles();
                    setUgcProgress("done");
                    toast("הקומפוזיציה נכשלה — הסרטון הגולמי נשמר", "warning" as any);
                    setTimeout(() => {
                      setUgcGenerating(false);
                      setUgcModalOpen(false);
                      setActiveTab("files");
                    }, 2000);
                  }
                } catch (composePollErr) {
                  console.error("[UGC] compose poll error:", composePollErr);
                }
              }, 3000);

            } catch (composeErr: any) {
              // Composition failed — fallback to saving raw HeyGen video
              console.error("[UGC] compose error, saving raw:", composeErr);
              setUgcProgress("saving");
              const now = new Date().toISOString();
              await createClientFile({
                clientId: clientRef.id,
                fileName: `UGC_${clientRef.name}_${formatSlug}_${now.split("T")[0]}.mp4`,
                fileUrl: statusData.videoUrl,
                fileType: "video",
                category: "social_media",
                fileSize: 0,
                uploadedBy: "HeyGen AI",
                notes: `סרטון UGC שנוצר באמצעות HeyGen.\nפורמט: ${ugcFormat}\nתסריט: ${ugcScript.slice(0, 200)}`,
                linkedTaskId: null,
                linkedGanttItemId: null,
                createdAt: now,
                updatedAt: now,
              } as any);
              await refetchClientFiles();
              setUgcProgress("done");
              toast("הסרטון נשמר (ללא קומפוזיציה ממותגת)", "success");
              setTimeout(() => {
                setUgcGenerating(false);
                setUgcModalOpen(false);
                setActiveTab("files");
              }, 2000);
            }

          } else if (status === "failed") {
            if (ugcPollRef.current) { clearInterval(ugcPollRef.current); ugcPollRef.current = null; }
            setUgcProgress("error");
            setUgcGenerating(false);
          } else {
            if (ugcProgress !== "generating") setUgcProgress("generating");
          }
        } catch (pollErr: any) {
          console.error("[UGC] poll error:", pollErr);
        }
      }, 5000);
    } catch (err: any) {
      console.error("[UGC] generate error:", err);
      setUgcProgress("error");
      toast(`שגיאה ביצירת סרטון: ${err?.message}`, "error");
      setUgcGenerating(false);
    }
  }, [client, ugcAvatarId, ugcVoiceId, ugcScript, ugcFormat, ugcDuration, ugcVisualStyle, ugcLogoUrl, ugcProductImageUrl, ugcBrandName, ugcTagline, ugcPlatform, ugcCallToAction, toast, createClientFile, refetchClientFiles, setActiveTab]);

  // Cleanup poll intervals on unmount
  useEffect(() => {
    return () => {
      if (ugcPollRef.current) clearInterval(ugcPollRef.current);
      if (ugcComposePollRef.current) clearInterval(ugcComposePollRef.current);
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

  // Only show full-page loading on INITIAL mount (no data yet).
  // Do NOT unmount the page on background refetches (e.g., window focus after
  // a file dialog closes) because that destroys the upload modal + file input
  // and causes the "page refresh" behavior.
  const isInitialLoad = loading && clients.length === 0;

  if (isInitialLoad) {
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
                    color: "#00B5FE",
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
        {activeTab === "automations" && (
          <TabAutomations clientId={client.id} clientName={client.name} />
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

              {/* Row 6: Marketing Goals & Key Messages */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
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
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                    מסרים שיווקיים עיקריים
                  </label>
                  <textarea
                    className="form-input"
                    value={editForm.keyMarketingMessages || ""}
                    onChange={(e) => setEditForm({ ...editForm, keyMarketingMessages: e.target.value })}
                    placeholder="מסרים שיווקיים עיקריים"
                    style={{ minHeight: "60px", fontFamily: "inherit" }}
                  />
                </div>
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                    אתר אינטרנט
                  </label>
                  <input className="form-input" value={editForm.websiteUrl || ""} onChange={(e) => setEditForm({ ...editForm, websiteUrl: e.target.value })} placeholder="https://..." />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                    דף Facebook
                  </label>
                  <input className="form-input" value={editForm.facebookPageUrl || ""} onChange={(e) => setEditForm({ ...editForm, facebookPageUrl: e.target.value })} placeholder="https://facebook.com/..." />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                    פרופיל Instagram
                  </label>
                  <input className="form-input" value={editForm.instagramProfileUrl || ""} onChange={(e) => setEditForm({ ...editForm, instagramProfileUrl: e.target.value })} placeholder="https://instagram.com/..." />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                    פרופיל TikTok
                  </label>
                  <input className="form-input" value={editForm.tiktokProfileUrl || ""} onChange={(e) => setEditForm({ ...editForm, tiktokProfileUrl: e.target.value })} placeholder="https://tiktok.com/@..." />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                    פרופיל LinkedIn
                  </label>
                  <input className="form-input" value={editForm.linkedinUrl || ""} onChange={(e) => setEditForm({ ...editForm, linkedinUrl: e.target.value })} placeholder="https://linkedin.com/company/..." />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                    ערוץ YouTube
                  </label>
                  <input className="form-input" value={editForm.youtubeUrl || ""} onChange={(e) => setEditForm({ ...editForm, youtubeUrl: e.target.value })} placeholder="https://youtube.com/@..." />
                </div>
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
                  type="button"
                  onClick={() => { console.log('[EDIT] Save button clicked'); handleSaveEdit(); }}
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

      {/* ── UGC Video Generation Panel ── */}
      {ugcModalOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "stretch", justifyContent: "center", zIndex: 50, direction: "rtl" }}
          onClick={closeUgcModal}
        >
          <div
            style={{
              background: "#16162a",
              width: "100%",
              maxWidth: "780px",
              overflowY: "auto",
              borderRight: "1px solid rgba(139,92,246,0.2)",
              borderLeft: "1px solid rgba(139,92,246,0.2)",
              padding: "2.5rem 2rem 3rem",
            }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem" }}>
              <div>
                <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.01em" }}>
                  יצירת סרטון UGC ממותג
                </h2>
                {client && <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.45)", marginTop: "0.25rem" }}>{client.name}</p>}
              </div>
              <button onClick={closeUgcModal} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.375rem", padding: "0.375rem 0.75rem", color: "rgba(255,255,255,0.5)", fontSize: "0.8rem", cursor: "pointer" }}>
                סגור
              </button>
            </div>

            {ugcLoadingOptions ? (
              <div style={{ textAlign: "center", padding: "4rem 0", color: "rgba(255,255,255,0.4)" }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid rgba(139,92,246,0.5)", borderTopColor: "transparent", margin: "0 auto 0.75rem", animation: "ugcSpin 0.8s linear infinite" }} />
                טוען אפשרויות מ-HeyGen...
                <style>{`@keyframes ugcSpin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>

                {/* ─────────────────────────────────────
                   1. CREATIVE PROMPT
                ───────────────────────────────────── */}
                <section style={{ marginBottom: "1.75rem" }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "#c4b5fd", display: "block", marginBottom: "0.5rem" }}>
                    Creative Prompt
                  </label>
                  <textarea
                    value={ugcCreativePrompt}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setUgcCreativePrompt(e.target.value)}
                    disabled={ugcGenerating || ugcScriptGenerating}
                    placeholder="תאר את הסרטון שאתה רוצה — טון דיבור, קהל יעד, סגנון UGC, זווית מכירה, כיוון רגשי, פרימיום / אותנטי / direct-response..."
                    rows={4}
                    style={{
                      width: "100%", padding: "0.875rem 1rem", fontSize: "0.9rem", lineHeight: 1.6,
                      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(139,92,246,0.2)",
                      borderRadius: "0.5rem", color: "#fff", resize: "vertical",
                      outline: "none",
                    }}
                  />
                  <p style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.3)", marginTop: "0.375rem" }}>
                    המקור העיקרי ליצירת התסריט. תאר בפירוט מה שאתה מחפש.
                  </p>
                </section>

                {/* Divider */}
                <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: "1.75rem" }} />

                {/* ─────────────────────────────────────
                   1.5. SCRIPT TEMPLATE SELECTOR
                ───────────────────────────────────── */}
                <section style={{ marginBottom: "1.75rem" }}>
                  <h3 style={{ fontSize: "0.8rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
                    תבנית תסריט
                  </h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    {([
                      { id: "sales", label: "מכירות / Direct Response", icon: "🎯" },
                      { id: "brand", label: "מיתוג / תדמית", icon: "✨" },
                      { id: "promo", label: "מבצע / הטבה", icon: "🔥" },
                      { id: "launch", label: "השקה / מוצר חדש", icon: "🚀" },
                      { id: "testimonial", label: "המלצה אישית / UGC", icon: "💬" },
                    ] as const).map(({ id, label, icon }) => {
                      const selected = ugcScriptTemplate === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setUgcScriptTemplate(selected ? "" : id)}
                          disabled={ugcGenerating || ugcScriptGenerating}
                          style={{
                            padding: "0.5rem 1rem",
                            fontSize: "0.8rem",
                            fontWeight: selected ? 700 : 500,
                            borderRadius: "9999px",
                            border: selected ? "1.5px solid #00B5FE" : "1px solid rgba(255,255,255,0.1)",
                            background: selected ? "rgba(139,92,246,0.18)" : "rgba(255,255,255,0.04)",
                            color: selected ? "#c4b5fd" : "rgba(255,255,255,0.55)",
                            cursor: (ugcGenerating || ugcScriptGenerating) ? "not-allowed" : "pointer",
                            transition: "all 0.15s ease",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.375rem",
                            boxShadow: selected ? "0 0 12px rgba(139,92,246,0.15)" : "none",
                          }}
                        >
                          <span>{icon}</span>
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.3)", marginTop: "0.5rem" }}>
                    בחר תבנית כדי לכוון את הטון, המבנה והסגנון של התסריט שייוצר.
                  </p>
                </section>

                {/* Divider */}
                <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: "1.75rem" }} />

                {/* ─────────────────────────────────────
                   2. STRUCTURED CONTENT INPUTS
                ───────────────────────────────────── */}
                <section style={{ marginBottom: "1.75rem" }}>
                  <h3 style={{ fontSize: "0.8rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.875rem" }}>
                    פרטי תוכן
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    {([
                      { label: "מותג / מוצר", val: ugcBrandName, set: setUgcBrandName, ph: "שם המותג או המוצר", wide: false },
                      { label: "הצעת ערך / מבצע", val: ugcMainOffer, set: setUgcMainOffer, ph: "מה ההצעה המרכזית?", wide: false },
                      { label: "קהל יעד", val: ugcTargetAudience, set: setUgcTargetAudience, ph: "למי מיועד הסרטון?", wide: false },
                      { label: "מסר מרכזי", val: ugcKeyMessage, set: setUgcKeyMessage, ph: "מה המסר העיקרי?", wide: false },
                      { label: "קריאה לפעולה (CTA)", val: ugcCallToAction, set: setUgcCallToAction, ph: 'למשל: ״הירשמו עכשיו״', wide: false },
                      { label: "סגנון ויזואלי", val: ugcVisualStyle, set: setUgcVisualStyle, ph: "מינימליסטי, צבעוני, פרימיום...", wide: false },
                    ] as const).map(({ label, val, set, ph }) => (
                      <div key={label}>
                        <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "rgba(255,255,255,0.55)", display: "block", marginBottom: "0.25rem" }}>
                          {label}
                        </label>
                        <input
                          type="text"
                          value={val}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => set(e.target.value)}
                          disabled={ugcGenerating || ugcScriptGenerating}
                          placeholder={ph}
                          style={{
                            width: "100%", padding: "0.5rem 0.75rem", fontSize: "0.825rem",
                            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: "0.375rem", color: "#fff", outline: "none",
                          }}
                        />
                      </div>
                    ))}
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "rgba(255,255,255,0.55)", display: "block", marginBottom: "0.25rem" }}>
                        הנחיות נוספות
                      </label>
                      <textarea
                        value={ugcAdditionalInstructions}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setUgcAdditionalInstructions(e.target.value)}
                        disabled={ugcGenerating || ugcScriptGenerating}
                        placeholder="כל דבר נוסף שחשוב לך..."
                        rows={2}
                        style={{
                          width: "100%", padding: "0.5rem 0.75rem", fontSize: "0.825rem",
                          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: "0.375rem", color: "#fff", resize: "vertical", outline: "none",
                        }}
                      />
                    </div>
                  </div>
                </section>

                {/* Divider */}
                <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: "1.75rem" }} />

                {/* ─────────────────────────────────────
                   3. REFERENCE MATERIALS
                ───────────────────────────────────── */}
                <section style={{ marginBottom: "1.75rem" }}>
                  <h3 style={{ fontSize: "0.8rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
                    חומרי התייחסות
                  </h3>
                  <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.3)", marginBottom: "0.625rem" }}>
                    לוגו, בריף, סקריפט קיים, תמונות, PDF — טקסט מקבצים נתמכים ישמש ליצירת התסריט עם AI.
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
                      padding: "0.5rem 1rem", fontSize: "0.8rem", fontWeight: 600,
                      borderRadius: "0.375rem", border: "1px dashed rgba(255,255,255,0.15)",
                      background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.6)", cursor: "pointer",
                      transition: "all 150ms",
                    }}
                  >
                    + העלה קבצים
                  </button>
                  {ugcReferenceFiles.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem", marginTop: "0.625rem" }}>
                      {ugcReferenceFiles.map((f, i) => (
                        <span key={i} style={{
                          display: "inline-flex", alignItems: "center", gap: "0.375rem",
                          padding: "0.3rem 0.625rem", fontSize: "0.72rem", borderRadius: "0.25rem",
                          background: "rgba(139,92,246,0.12)", color: "#c4b5fd",
                        }}>
                          {f.name}
                          <button
                            type="button" onClick={() => removeReferenceFile(i)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#c4b5fd", fontSize: "0.75rem", padding: 0, lineHeight: 1 }}
                          >
                            x
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </section>

                {/* Divider */}
                <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: "1.75rem" }} />

                {/* ─────────────────────────────────────
                   4. GENERATE SCRIPT WITH AI
                ───────────────────────────────────── */}
                <section style={{ marginBottom: "1.75rem" }}>
                  {!ugcScriptReplaceConfirm ? (
                    <div style={{ display: "flex", gap: "0.625rem" }}>
                      <button
                        type="button"
                        onClick={() => handleGenerateScript()}
                        disabled={ugcScriptGenerating || ugcMultiGenerating || ugcGenerating || (!ugcCreativePrompt.trim() && !ugcBrandName.trim() && !ugcMainOffer.trim() && !ugcTargetAudience.trim() && !ugcKeyMessage.trim() && ugcReferenceTexts.length === 0)}
                        style={{
                          flex: 1, padding: "0.75rem", fontSize: "0.9rem", fontWeight: 700,
                          borderRadius: "0.5rem", border: "1px solid rgba(139,92,246,0.35)",
                          background: ugcScriptGenerating
                            ? "rgba(139,92,246,0.15)"
                            : "linear-gradient(135deg, rgba(139,92,246,0.18) 0%, rgba(99,102,241,0.18) 100%)",
                          color: "#c4b5fd", cursor: ugcScriptGenerating ? "wait" : "pointer",
                          opacity: (ugcScriptGenerating || ugcMultiGenerating || ugcGenerating || (!ugcCreativePrompt.trim() && !ugcBrandName.trim() && !ugcMainOffer.trim() && !ugcTargetAudience.trim() && !ugcKeyMessage.trim() && ugcReferenceTexts.length === 0)) ? 0.4 : 1,
                          transition: "all 200ms", letterSpacing: "0.01em",
                        }}
                      >
                        {ugcScriptGenerating ? "מייצר תסריט..." : "צור תסריט עם AI"}
                      </button>
                      <button
                        type="button"
                        onClick={handleGenerateMultiVersions}
                        disabled={ugcScriptGenerating || ugcMultiGenerating || ugcGenerating || (!ugcCreativePrompt.trim() && !ugcBrandName.trim() && !ugcMainOffer.trim() && !ugcTargetAudience.trim() && !ugcKeyMessage.trim() && ugcReferenceTexts.length === 0)}
                        style={{
                          flex: 1, padding: "0.75rem", fontSize: "0.9rem", fontWeight: 700,
                          borderRadius: "0.5rem", border: "1px solid rgba(34,197,94,0.35)",
                          background: ugcMultiGenerating
                            ? "rgba(34,197,94,0.15)"
                            : "linear-gradient(135deg, rgba(34,197,94,0.18) 0%, rgba(16,185,129,0.18) 100%)",
                          color: "#86efac", cursor: ugcMultiGenerating ? "wait" : "pointer",
                          opacity: (ugcScriptGenerating || ugcMultiGenerating || ugcGenerating || (!ugcCreativePrompt.trim() && !ugcBrandName.trim() && !ugcMainOffer.trim() && !ugcTargetAudience.trim() && !ugcKeyMessage.trim() && ugcReferenceTexts.length === 0)) ? 0.4 : 1,
                          transition: "all 200ms", letterSpacing: "0.01em",
                        }}
                      >
                        {ugcMultiGenerating ? "מייצר 3 גרסאות..." : "צור 3 גרסאות"}
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", justifyContent: "center", padding: "0.5rem", background: "rgba(139,92,246,0.06)", borderRadius: "0.5rem", border: "1px solid rgba(139,92,246,0.15)" }}>
                      <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)" }}>יש כבר טקסט בתסריט —</span>
                      <button type="button" onClick={() => handleGenerateScript("replace")}
                        style={{ padding: "0.375rem 0.75rem", fontSize: "0.8rem", fontWeight: 600, borderRadius: "0.375rem", border: "1px solid rgba(139,92,246,0.3)", background: "rgba(139,92,246,0.1)", color: "#c4b5fd", cursor: "pointer" }}>
                        החלף
                      </button>
                      <button type="button" onClick={() => handleGenerateScript("append")}
                        style={{ padding: "0.375rem 0.75rem", fontSize: "0.8rem", fontWeight: 600, borderRadius: "0.375rem", border: "1px solid rgba(139,92,246,0.3)", background: "rgba(139,92,246,0.1)", color: "#c4b5fd", cursor: "pointer" }}>
                        הוסף לקיים
                      </button>
                      <button type="button" onClick={() => setUgcScriptReplaceConfirm(false)}
                        style={{ padding: "0.375rem 0.625rem", fontSize: "0.8rem", fontWeight: 600, borderRadius: "0.375rem", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.4)", cursor: "pointer" }}>
                        ביטול
                      </button>
                    </div>
                  )}
                  {(ugcScriptGenerating || ugcMultiGenerating) && (
                    <div style={{
                      marginTop: "0.625rem", padding: "0.5rem 0.75rem", borderRadius: "0.375rem",
                      background: "rgba(139,92,246,0.06)", color: "#a78bfa", fontSize: "0.8rem",
                      display: "flex", alignItems: "center", gap: "0.5rem",
                    }}>
                      <span style={{ display: "inline-block", width: 14, height: 14, borderRadius: "50%", border: "2px solid #a78bfa", borderTopColor: "transparent", animation: "ugcSpin 0.8s linear infinite" }} />
                      {ugcMultiGenerating ? "מייצר 3 גרסאות שונות בעברית..." : "מייצר תסריט בעברית על בסיס הבריף והשדות שמילאת..."}
                    </div>
                  )}
                </section>

                {/* ─────────────────────────────────────
                   4.5. MULTI-VERSION RESULTS
                ───────────────────────────────────── */}
                {ugcMultiVersions.length > 0 && (
                  <section style={{ marginBottom: "1.75rem" }}>
                    <h3 style={{ fontSize: "0.8rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
                      בחר גרסה
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      {ugcMultiVersions.map((version, idx) => {
                        if (!version) return null;
                        const angleLabel = ugcMultiLabels[idx] || `גרסה ${idx + 1}`;
                        const ANGLE_COLORS = ["#a78bfa", "#38bdf8", "#34d399"];
                        const accentColor = ANGLE_COLORS[idx] || "#a78bfa";
                        return (
                          <div
                            key={idx}
                            style={{
                              padding: "1rem 1.125rem",
                              background: "rgba(255,255,255,0.03)",
                              border: `1px solid rgba(255,255,255,0.08)`,
                              borderRadius: "0.625rem",
                              position: "relative",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.625rem" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <span style={{
                                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                                  width: 22, height: 22, borderRadius: "50%",
                                  background: accentColor, color: "#0f0f1a",
                                  fontSize: "0.7rem", fontWeight: 800,
                                }}>
                                  {idx + 1}
                                </span>
                                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: accentColor }}>
                                  {angleLabel}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setUgcScript(version);
                                  setUgcMultiVersions([]);
                                  setUgcMultiLabels([]);
                                  toast(`גרסה ${idx + 1} נבחרה — ניתן לערוך בשדה התסריט הסופי`, "success");
                                }}
                                style={{
                                  padding: "0.375rem 0.875rem", fontSize: "0.75rem", fontWeight: 700,
                                  borderRadius: "9999px", border: `1px solid ${accentColor}`,
                                  background: `${accentColor}22`,
                                  color: accentColor, cursor: "pointer",
                                  transition: "all 150ms",
                                }}
                              >
                                השתמש בגרסה זו
                              </button>
                            </div>
                            <p style={{
                              fontSize: "0.85rem", lineHeight: 1.7, color: "rgba(255,255,255,0.75)",
                              margin: 0, whiteSpace: "pre-wrap", direction: "rtl",
                            }}>
                              {version}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Divider */}
                <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: "1.75rem" }} />

                {/* ─────────────────────────────────────
                   5. FINAL SCRIPT
                ───────────────────────────────────── */}
                <section style={{ marginBottom: "1.75rem" }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "#c4b5fd", display: "block", marginBottom: "0.5rem" }}>
                    תסריט סופי
                  </label>
                  <textarea
                    value={ugcScript}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setUgcScript(e.target.value)}
                    disabled={ugcGenerating || ugcScriptGenerating}
                    placeholder="כתוב ידנית, או צור אוטומטית עם הכפתור למעלה..."
                    rows={6}
                    style={{
                      width: "100%", padding: "0.875rem 1rem", fontSize: "0.9rem", lineHeight: 1.65,
                      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(139,92,246,0.2)",
                      borderRadius: "0.5rem", color: "#fff", resize: "vertical", outline: "none",
                    }}
                  />
                  <p style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.3)", marginTop: "0.375rem" }}>
                    זהו הטקסט שהאווטאר יגיד בסרטון. ניתן לערוך בחופשיות.
                  </p>
                </section>

                {/* Divider */}
                <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: "1.75rem" }} />

                {/* ─────────────────────────────────────
                   6. AVATAR SELECTION (Visual Gallery)
                ───────────────────────────────────── */}
                <section style={{ marginBottom: "1.75rem" }}>
                  <h3 style={{ fontSize: "0.8rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
                    בחירת אווטאר
                  </h3>
                  {ugcAvatars.length === 0 && !ugcLoadingOptions && (
                    <p style={{ fontSize: "0.75rem", color: "#f59e0b" }}>לא נמצאו אווטארים. בדוק את מפתח ה-API של HeyGen.</p>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: "0.625rem" }}>
                    {ugcAvatars.map((a: any) => {
                      const isSelected = ugcAvatarId === a.avatar_id;
                      const imgUrl = a.preview_image_url || a.photo_url || "";
                      return (
                        <button
                          key={a.avatar_id}
                          type="button"
                          disabled={ugcGenerating}
                          onClick={() => setUgcAvatarId(a.avatar_id)}
                          style={{
                            display: "flex", flexDirection: "column", alignItems: "center", gap: "0.375rem",
                            padding: "0.5rem", borderRadius: "0.5rem",
                            border: isSelected ? "2px solid #00B5FE" : "1px solid rgba(255,255,255,0.08)",
                            background: isSelected ? "rgba(139,92,246,0.12)" : "rgba(255,255,255,0.02)",
                            cursor: ugcGenerating ? "not-allowed" : "pointer",
                            transition: "all 150ms", textAlign: "center",
                          }}
                        >
                          <div style={{
                            width: 56, height: 56, borderRadius: "50%", overflow: "hidden",
                            background: "rgba(255,255,255,0.06)", flexShrink: 0,
                            border: isSelected ? "2px solid #00B5FE" : "2px solid transparent",
                          }}>
                            {imgUrl ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={imgUrl} alt={a.avatar_name || a.avatar_id}
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                            ) : (
                              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", color: "rgba(255,255,255,0.3)" }}>
                                {(a.avatar_name || "?")[0]}
                              </div>
                            )}
                          </div>
                          <span style={{ fontSize: "0.65rem", fontWeight: isSelected ? 700 : 500, color: isSelected ? "#c4b5fd" : "rgba(255,255,255,0.5)", lineHeight: 1.2, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {a.avatar_name || a.avatar_id}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Divider */}
                <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: "1.75rem" }} />

                {/* ─────────────────────────────────────
                   7. VOICE SELECTION
                ───────────────────────────────────── */}
                <section style={{ marginBottom: "1.75rem" }}>
                  <h3 style={{ fontSize: "0.8rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.625rem" }}>
                    קול (עברית)
                  </h3>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <select
                      value={ugcVoiceId}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setUgcVoiceId(e.target.value)}
                      disabled={ugcGenerating}
                      style={{
                        flex: 1, padding: "0.625rem 0.75rem", fontSize: "0.85rem",
                        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: "0.375rem", color: "#fff", outline: "none",
                      }}
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
                      style={{
                        padding: "0.5rem 0.875rem", borderRadius: "0.375rem",
                        border: "1px solid rgba(139,92,246,0.25)",
                        background: ugcVoicePlaying ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.03)",
                        color: !ugcVoiceId ? "rgba(255,255,255,0.25)" : "#c4b5fd",
                        fontSize: "0.8rem", fontWeight: 600,
                        cursor: !ugcVoiceId || ugcGenerating ? "not-allowed" : "pointer",
                        opacity: !ugcVoiceId ? 0.5 : 1, transition: "all 150ms",
                        whiteSpace: "nowrap", flexShrink: 0,
                      }}
                    >
                      {ugcVoicePlaying ? "מנגן..." : "השמע"}
                    </button>
                  </div>
                  {hebrewVoices.length === 0 && ugcVoices.length > 0 && (
                    <p style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.3)", marginTop: "0.375rem" }}>
                      לא נמצאו קולות בעברית — מוצגים כל הקולות הזמינים
                    </p>
                  )}
                </section>

                {/* Divider */}
                <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: "1.75rem" }} />

                {/* ─────────────────────────────────────
                   8. VIDEO FORMAT
                ───────────────────────────────────── */}
                <section style={{ marginBottom: "1.75rem" }}>
                  <h3 style={{ fontSize: "0.8rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.625rem" }}>
                    פורמט סרטון
                  </h3>
                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    {(["9:16", "1:1", "16:9"] as const).map((fmt) => {
                      const dim = FORMAT_DIMENSIONS[fmt];
                      const isActive = ugcFormat === fmt;
                      const aspectW = fmt === "9:16" ? 22 : fmt === "1:1" ? 30 : 40;
                      const aspectH = fmt === "9:16" ? 38 : fmt === "1:1" ? 30 : 22;
                      return (
                        <button key={fmt} type="button" disabled={ugcGenerating}
                          onClick={() => setUgcFormat(fmt)}
                          style={{
                            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.375rem",
                            padding: "0.75rem 0.5rem", borderRadius: "0.5rem",
                            border: isActive ? "2px solid #00B5FE" : "1px solid rgba(255,255,255,0.08)",
                            background: isActive ? "rgba(139,92,246,0.12)" : "rgba(255,255,255,0.02)",
                            cursor: ugcGenerating ? "not-allowed" : "pointer", transition: "all 150ms",
                          }}
                        >
                          <div style={{ width: aspectW, height: aspectH, borderRadius: 3, border: `2px solid ${isActive ? "#00B5FE" : "rgba(255,255,255,0.2)"}`, opacity: isActive ? 1 : 0.5 }} />
                          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: isActive ? "#c4b5fd" : "rgba(255,255,255,0.5)" }}>{fmt}</span>
                          <span style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.3)", textAlign: "center", lineHeight: 1.2 }}>{dim.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* ─────────────────────────────────────
                   8A2. DURATION PRESET
                ───────────────────────────────────── */}
                <section style={{ marginBottom: "1.75rem" }}>
                  <h3 style={{ fontSize: "0.8rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.625rem" }}>
                    אורך סרטון
                  </h3>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    {([15, 30, 45, 60] as const).map((dur) => {
                      const isActive = ugcDuration === dur;
                      return (
                        <button key={dur} type="button" disabled={ugcGenerating}
                          onClick={() => setUgcDuration(dur)}
                          style={{
                            flex: 1, padding: "0.625rem 0.5rem", borderRadius: "0.5rem",
                            border: isActive ? "2px solid #00B5FE" : "1px solid rgba(255,255,255,0.08)",
                            background: isActive ? "rgba(139,92,246,0.12)" : "rgba(255,255,255,0.02)",
                            color: isActive ? "#c4b5fd" : "rgba(255,255,255,0.5)",
                            fontSize: "0.85rem", fontWeight: 700, cursor: ugcGenerating ? "not-allowed" : "pointer",
                            transition: "all 150ms", textAlign: "center",
                          }}
                        >
                          {dur}s
                        </button>
                      );
                    })}
                  </div>
                  <p style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.25)", marginTop: "0.375rem" }}>
                    מבנה 5 סצנות: Hook → Problem → Solution → Product → CTA
                  </p>
                </section>

                {/* Divider */}
                <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: "1.75rem" }} />

                {/* ─────────────────────────────────────
                   8B. VISUAL STYLE
                ───────────────────────────────────── */}
                <section style={{ marginBottom: "1.75rem" }}>
                  <h3 style={{ fontSize: "0.8rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.625rem" }}>
                    סגנון ויזואלי
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.5rem" }}>
                    {UGC_VISUAL_STYLES.map((vs) => {
                      const isActive = ugcVisualStyle === vs.id;
                      return (
                        <button key={vs.id} type="button" disabled={ugcGenerating}
                          onClick={() => setUgcVisualStyle(vs.id)}
                          style={{
                            display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem",
                            padding: "0.5rem 0.25rem", borderRadius: "0.5rem",
                            border: isActive ? "2px solid #00B5FE" : "1px solid rgba(255,255,255,0.08)",
                            background: isActive ? "rgba(139,92,246,0.12)" : "rgba(255,255,255,0.02)",
                            cursor: ugcGenerating ? "not-allowed" : "pointer", transition: "all 150ms",
                          }}
                        >
                          <div style={{
                            width: 32, height: 32, borderRadius: 8,
                            background: `linear-gradient(135deg, ${vs.gradient[0]}, ${vs.gradient[1]})`,
                            border: "1px solid rgba(255,255,255,0.1)",
                          }} />
                          <span style={{ fontSize: "0.65rem", fontWeight: 600, color: isActive ? "#c4b5fd" : "rgba(255,255,255,0.5)", textAlign: "center", lineHeight: 1.2 }}>{vs.label}</span>
                          <span style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.3)", textAlign: "center" }}>{vs.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Divider */}
                <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: "1.75rem" }} />

                {/* ─────────────────────────────────────
                   8C. PLATFORM TARGET
                ───────────────────────────────────── */}
                <section style={{ marginBottom: "1.75rem" }}>
                  <h3 style={{ fontSize: "0.8rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.625rem" }}>
                    פלטפורמה
                  </h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                    {([
                      { id: "instagram-reels" as const, label: "Instagram Reels" },
                      { id: "tiktok" as const, label: "TikTok" },
                      { id: "youtube-shorts" as const, label: "YouTube Shorts" },
                      { id: "facebook" as const, label: "Facebook" },
                      { id: "linkedin" as const, label: "LinkedIn" },
                      { id: "generic" as const, label: "כללי" },
                    ]).map((p) => {
                      const isActive = ugcPlatform === p.id;
                      return (
                        <button key={p.id} type="button" disabled={ugcGenerating}
                          onClick={() => setUgcPlatform(p.id)}
                          style={{
                            padding: "0.375rem 0.75rem", borderRadius: "1rem",
                            fontSize: "0.75rem", fontWeight: 600,
                            border: isActive ? "1px solid #00B5FE" : "1px solid rgba(255,255,255,0.08)",
                            background: isActive ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.02)",
                            color: isActive ? "#c4b5fd" : "rgba(255,255,255,0.4)",
                            cursor: ugcGenerating ? "not-allowed" : "pointer", transition: "all 150ms",
                          }}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Divider */}
                <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: "1.75rem" }} />

                {/* ─────────────────────────────────────
                   8D. BRAND ASSETS (Logo, Product, Tagline)
                ───────────────────────────────────── */}
                <section style={{ marginBottom: "1.75rem" }}>
                  <h3 style={{ fontSize: "0.8rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.625rem" }}>
                    נכסי מותג
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {/* Tagline */}
                    <input
                      type="text"
                      value={ugcTagline}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUgcTagline(e.target.value)}
                      disabled={ugcGenerating}
                      placeholder="סלוגן / תת-כותרת (לא חובה)"
                      style={{
                        width: "100%", padding: "0.625rem 0.875rem", fontSize: "0.85rem",
                        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(139,92,246,0.2)",
                        borderRadius: "0.5rem", color: "#fff", outline: "none",
                      }}
                    />

                    <div style={{ display: "flex", gap: "0.75rem" }}>
                      {/* Logo upload */}
                      <div style={{ flex: 1 }}>
                        <button type="button" disabled={ugcGenerating}
                          onClick={() => ugcLogoInputRef.current?.click()}
                          style={{
                            width: "100%", padding: "0.75rem", borderRadius: "0.5rem",
                            border: ugcLogoUrl ? "2px solid #00B5FE" : "1px dashed rgba(255,255,255,0.15)",
                            background: ugcLogoUrl ? "rgba(139,92,246,0.08)" : "rgba(255,255,255,0.02)",
                            color: ugcLogoUrl ? "#c4b5fd" : "rgba(255,255,255,0.35)",
                            fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
                            display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem",
                          }}
                        >
                          {ugcLogoUrl ? "✓ לוגו הועלה" : "העלה לוגו"}
                          <span style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.25)" }}>PNG / SVG</span>
                        </button>
                        <input
                          ref={ugcLogoInputRef}
                          type="file"
                          accept="image/*"
                          style={{ display: "none" }}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const url = URL.createObjectURL(file);
                              setUgcLogoUrl(url);
                            }
                          }}
                        />
                      </div>

                      {/* Product image upload */}
                      <div style={{ flex: 1 }}>
                        <button type="button" disabled={ugcGenerating}
                          onClick={() => ugcProductInputRef.current?.click()}
                          style={{
                            width: "100%", padding: "0.75rem", borderRadius: "0.5rem",
                            border: ugcProductImageUrl ? "2px solid #00B5FE" : "1px dashed rgba(255,255,255,0.15)",
                            background: ugcProductImageUrl ? "rgba(139,92,246,0.08)" : "rgba(255,255,255,0.02)",
                            color: ugcProductImageUrl ? "#c4b5fd" : "rgba(255,255,255,0.35)",
                            fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
                            display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem",
                          }}
                        >
                          {ugcProductImageUrl ? "✓ מוצר הועלה" : "העלה תמונת מוצר"}
                          <span style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.25)" }}>PNG / JPG</span>
                        </button>
                        <input
                          ref={ugcProductInputRef}
                          type="file"
                          accept="image/*"
                          style={{ display: "none" }}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const url = URL.createObjectURL(file);
                              setUgcProductImageUrl(url);
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Asset previews */}
                    {(ugcLogoUrl || ugcProductImageUrl) && (
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        {ugcLogoUrl && (
                          <div style={{
                            width: 48, height: 48, borderRadius: 8, overflow: "hidden",
                            border: "1px solid rgba(139,92,246,0.2)", background: "rgba(255,255,255,0.04)",
                            display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
                          }}>
                            <img src={ugcLogoUrl} alt="Logo" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                            <button type="button" onClick={() => setUgcLogoUrl(null)}
                              style={{
                                position: "absolute", top: -4, right: -4, width: 16, height: 16,
                                borderRadius: "50%", background: "#ef4444", border: "none",
                                color: "#fff", fontSize: "0.55rem", cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center",
                              }}>x</button>
                          </div>
                        )}
                        {ugcProductImageUrl && (
                          <div style={{
                            width: 48, height: 48, borderRadius: 8, overflow: "hidden",
                            border: "1px solid rgba(139,92,246,0.2)", background: "rgba(255,255,255,0.04)",
                            display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
                          }}>
                            <img src={ugcProductImageUrl} alt="Product" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                            <button type="button" onClick={() => setUgcProductImageUrl(null)}
                              style={{
                                position: "absolute", top: -4, right: -4, width: 16, height: 16,
                                borderRadius: "50%", background: "#ef4444", border: "none",
                                color: "#fff", fontSize: "0.55rem", cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center",
                              }}>x</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </section>

                {/* Divider */}
                <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: "1.75rem" }} />

                {/* ─────────────────────────────────────
                   Progress / Status — Premium Multi-Step
                ───────────────────────────────────── */}
                {ugcProgress && ugcProgress !== "" && (() => {
                  const PROGRESS_STEPS = [
                    { key: "preparing", label: "הכנה", icon: "📋" },
                    { key: "generating", label: "צילום אווטאר", icon: "🎬" },
                    { key: "analyzing", label: "ניתוח סצנות", icon: "🧠" },
                    { key: "composing", label: "קומפוזיציה", icon: "🎨" },
                    { key: "saving", label: "שמירה", icon: "💾" },
                    { key: "done", label: "הושלם", icon: "✅" },
                  ];
                  const isError = ugcProgress === "error" || ugcProgress === "save_error";
                  const currentIdx = PROGRESS_STEPS.findIndex(s => s.key === ugcProgress);
                  const activeIdx = isError ? -1 : currentIdx;

                  return (
                    <div style={{
                      padding: "1.5rem", borderRadius: "0.75rem", marginBottom: "1rem",
                      background: isError ? "rgba(239,68,68,0.06)" : "rgba(139,92,246,0.04)",
                      border: `1px solid ${isError ? "rgba(239,68,68,0.15)" : "rgba(139,92,246,0.12)"}`,
                    }}>
                      <style>{`
                        @keyframes ugc-pulse-dot { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
                        @keyframes ugc-progress-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
                        @keyframes ugc-check-pop { 0% { transform: scale(0); } 60% { transform: scale(1.2); } 100% { transform: scale(1); } }
                      `}</style>

                      {isError ? (
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>❌</div>
                          <div style={{ color: "#f87171", fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.25rem" }}>
                            {ugcProgress === "save_error" ? "הסרטון נוצר אך השמירה נכשלה" : "שגיאה ביצירת הסרטון"}
                          </div>
                          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem" }}>ניתן לנסות שוב</div>
                        </div>
                      ) : (
                        <>
                          {/* Step indicators */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
                            {PROGRESS_STEPS.map((step, i) => {
                              const isDone = i < activeIdx || ugcProgress === "done";
                              const isActive = i === activeIdx && ugcProgress !== "done";
                              return (
                                <div key={step.key} style={{ display: "flex", alignItems: "center", flex: i < PROGRESS_STEPS.length - 1 ? 1 : "none" }}>
                                  <div style={{
                                    display: "flex", flexDirection: "column", alignItems: "center", gap: "0.375rem",
                                    minWidth: "2.75rem",
                                  }}>
                                    <div style={{
                                      width: "2rem", height: "2rem", borderRadius: "50%",
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                      fontSize: isDone ? "0.85rem" : "0.75rem",
                                      background: isDone ? "rgba(34,197,94,0.15)" : isActive ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.04)",
                                      border: `2px solid ${isDone ? "#4ade80" : isActive ? "#a78bfa" : "rgba(255,255,255,0.08)"}`,
                                      transition: "all 0.4s ease",
                                      animation: isDone ? "ugc-check-pop 0.4s ease" : isActive ? "ugc-pulse-dot 1.5s ease-in-out infinite" : "none",
                                    }}>
                                      {isDone ? "✓" : step.icon}
                                    </div>
                                    <span style={{
                                      fontSize: "0.58rem", fontWeight: isActive ? 600 : 500,
                                      color: isDone ? "#4ade80" : isActive ? "#c4b5fd" : "rgba(255,255,255,0.25)",
                                      textAlign: "center", lineHeight: 1.2, whiteSpace: "nowrap",
                                    }}>
                                      {step.label}
                                    </span>
                                  </div>
                                  {i < PROGRESS_STEPS.length - 1 && (
                                    <div style={{
                                      flex: 1, height: "2px", margin: "0 0.2rem", marginBottom: "1.1rem",
                                      background: i < activeIdx || ugcProgress === "done"
                                        ? "#4ade80"
                                        : i === activeIdx
                                          ? "linear-gradient(90deg, #a78bfa, rgba(255,255,255,0.08))"
                                          : "rgba(255,255,255,0.06)",
                                      borderRadius: "1px",
                                      backgroundSize: i === activeIdx ? "200% 100%" : "auto",
                                      animation: i === activeIdx ? "ugc-progress-shimmer 2s linear infinite" : "none",
                                    }} />
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Composition progress bar (shown during composing stage) */}
                          {ugcProgress === "composing" && ugcComposeProgress > 0 && (
                            <div style={{ marginBottom: "0.75rem" }}>
                              <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                                <div style={{
                                  height: "100%", borderRadius: 2, width: `${ugcComposeProgress}%`,
                                  background: "linear-gradient(90deg, #00B5FE, #a78bfa)",
                                  transition: "width 0.5s ease",
                                }} />
                              </div>
                              {ugcComposeStage && (
                                <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.35)", marginTop: "0.375rem", textAlign: "center" }}>
                                  {ugcComposeStage} ({ugcComposeProgress}%)
                                </div>
                              )}
                            </div>
                          )}

                          {/* Status message */}
                          <div style={{ textAlign: "center" }}>
                            {ugcProgress === "done" ? (
                              <div style={{ color: "#4ade80", fontWeight: 600, fontSize: "0.85rem" }}>
                                הסרטון הממותג נוצר ונשמר בהצלחה — עובר לקבצים...
                              </div>
                            ) : (
                              <div style={{
                                color: "#c4b5fd", fontSize: "0.8rem", fontWeight: 500,
                                display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                              }}>
                                <span style={{ display: "inline-flex", gap: "3px" }}>
                                  <span style={{ animation: "ugc-pulse-dot 1.2s ease-in-out infinite", animationDelay: "0s" }}>.</span>
                                  <span style={{ animation: "ugc-pulse-dot 1.2s ease-in-out infinite", animationDelay: "0.2s" }}>.</span>
                                  <span style={{ animation: "ugc-pulse-dot 1.2s ease-in-out infinite", animationDelay: "0.4s" }}>.</span>
                                </span>
                                {ugcProgress === "preparing" && "מכין ושולח את הבקשה"}
                                {ugcProgress === "generating" && "HeyGen מייצר את סרטון האווטאר — זה עשוי לקחת כמה דקות"}
                                {ugcProgress === "analyzing" && "AI מנתח את התסריט ויוצר סצנות"}
                                {ugcProgress === "composing" && "מרכיב את הסרטון הממותג — רקעים, לוגו, טקסט ואפקטים"}
                                {ugcProgress === "saving" && "שומר את הסרטון בקבצי הלקוח"}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* ─────────────────────────────────────
                   9. FINAL ACTION
                ───────────────────────────────────── */}
                {!ugcGenerating && (
                <button
                  type="button"
                  onClick={handleGenerateUGC}
                  disabled={!ugcAvatarId || !ugcVoiceId || !ugcScript.trim()}
                  style={{
                    width: "100%", padding: "0.875rem", fontSize: "1rem", fontWeight: 800,
                    borderRadius: "0.5rem", border: "none",
                    background: (!ugcAvatarId || !ugcVoiceId || !ugcScript.trim())
                      ? "rgba(139,92,246,0.2)"
                      : "linear-gradient(135deg, #00B5FE 0%, #6366f1 100%)",
                    color: "#fff",
                    cursor: (!ugcAvatarId || !ugcVoiceId || !ugcScript.trim()) ? "not-allowed" : "pointer",
                    opacity: (!ugcAvatarId || !ugcVoiceId || !ugcScript.trim()) ? 0.5 : 1,
                    transition: "all 200ms", letterSpacing: "0.01em",
                  }}
                >
                  {(ugcProgress === "error" || ugcProgress === "save_error") ? "נסה שוב" : "צור סרטון UGC ממותג"}
                </button>
                )}

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
  internal: { emoji: "🏢", label: "פנימי", color: "#00B5FE" },
  design: { emoji: "🎨", label: "עיצוב", color: "#ec4899" },
  website: { emoji: "🌐", label: "אתר", color: "#10b981" },
  branding: { emoji: "✨", label: "מיתוג", color: "#f59e0b" },
  general: { emoji: "📋", label: "כללי", color: "#6b7280" },
};

const TASK_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  new: { label: "חדש", color: "#3b82f6" },
  in_progress: { label: "בעבודה", color: "#f59e0b" },
  under_review: { label: "בבדיקה", color: "#00B5FE" },
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
