"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  useClients,
  useCampaigns,
  useAdSets,
  useAds,
  useClientFiles,
} from "@/lib/api/use-entity";
import { useToast } from "@/components/ui/toast";
import type {
  CampaignType,
  CampaignStatus,
  CampaignPlatform,
  CampaignMediaType,
  AdCreativeType,
  Client,
  ClientFile,
} from "@/lib/db/schema";

// ── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { key: 1, label: "קמפיין", icon: "📋" },
  { key: 2, label: "קבוצת מודעות", icon: "🎯" },
  { key: 3, label: "מודעות", icon: "🎨" },
  { key: 4, label: "סיכום והפעלה", icon: "🚀" },
] as const;

const PLATFORM_OPTIONS: Array<{ value: CampaignPlatform; label: string; icon: string }> = [
  { value: "facebook", label: "Facebook", icon: "📘" },
  { value: "instagram", label: "Instagram", icon: "📸" },
  { value: "tiktok", label: "TikTok", icon: "🎵" },
  { value: "multi_platform", label: "מולטי-פלטפורמה", icon: "🌐" },
];

const GOAL_OPTIONS: Array<{ value: CampaignType; label: string; description: string }> = [
  { value: "lead_gen", label: "לידים", description: "איסוף פרטי יצירת קשר מלקוחות פוטנציאליים" },
  { value: "paid_social", label: "תנועה", description: "הפניית תנועה לאתר או דף נחיתה" },
  { value: "awareness", label: "מודעות", description: "חשיפה מקסימלית למותג או למוצר" },
  { value: "remarketing", label: "מכירות", description: "המרת לקוחות קיימים לרכישה" },
];

const AD_FORMAT_OPTIONS = [
  { value: "single", label: "מודעה בודדת", icon: "🖼️" },
  { value: "carousel", label: "קרוסלה", icon: "🎠" },
  { value: "reel", label: "ריל / סטורי", icon: "🎬" },
];

const CTA_OPTIONS = [
  { value: "", label: "ללא CTA" },
  { value: "learn_more", label: "למידע נוסף" },
  { value: "sign_up", label: "הירשמו עכשיו" },
  { value: "shop_now", label: "קנו עכשיו" },
  { value: "contact_us", label: "צרו קשר" },
  { value: "book_now", label: "הזמינו עכשיו" },
  { value: "get_offer", label: "קבלו הצעה" },
];

const GENDER_OPTIONS = [
  { value: "all", label: "הכל" },
  { value: "male", label: "גברים" },
  { value: "female", label: "נשים" },
];

const TARGETING_MODES = [
  { value: "living", label: "גרים במיקום", icon: "🏠" },
  { value: "recently", label: "היו לאחרונה", icon: "📍" },
  { value: "traveling", label: "מטיילים במיקום", icon: "✈️" },
  { value: "everyone", label: "כולם", icon: "🌍" },
] as const;

const ISRAELI_CITIES = [
  "תל אביב", "ירושלים", "חיפה", "ראשון לציון", "פתח תקווה", "אשדוד", "נתניה",
  "באר שבע", "בני ברק", "חולון", "רמת גן", "אשקלון", "רחובות", "בת ים", "הרצליה",
  "כפר סבא", "רעננה", "מודיעין", "לוד", "רמלה", "נצרת", "הוד השרון", "גבעתיים",
  "קריית אתא", "עכו", "אילת", "טבריה", "רמת השרון", "יהוד", "כפר יונה",
  "גוש דן", "שרון", "מרכז", "צפון", "דרום", "ישראל",
];

// ── Wizard State Types ───────────────────────────────────────────────────────

interface GeoLocation {
  city: string;
  radius: number; // km
}

type TargetingMode = "living" | "recently" | "traveling" | "everyone";

/** Single ad entry in the builder */
interface WizardAd {
  name: string;
  mediaType: CampaignMediaType;
  adFormat: string;
  linkedClientFileId: string | null;
  externalMediaUrl: string;
  caption: string;
  headline: string;
  cta: string;
}

const EMPTY_AD: WizardAd = {
  name: "",
  mediaType: "image",
  adFormat: "single",
  linkedClientFileId: null,
  externalMediaUrl: "",
  caption: "",
  headline: "",
  cta: "",
};

interface WizardData {
  // Step 1 — Campaign
  campaignName: string;
  clientId: string;
  platform: CampaignPlatform;
  campaignType: CampaignType;
  startDate: string;
  endDate: string;
  // Step 2 — Ad Set (audience + budget)
  adSetName: string;
  locations: GeoLocation[];
  excludedLocations: string[];
  targetingMode: TargetingMode;
  ageMin: number;
  ageMax: number;
  gender: string;
  interests: string[];
  audienceNotes: string;
  budgetType: "daily" | "total";
  budget: number | "";
  // Step 3 — Ads (multiple)
  ads: WizardAd[];
  // Step 4 — Review & Status
  finalStatus: CampaignStatus;
}

const INITIAL_DATA: WizardData = {
  campaignName: "",
  clientId: "",
  platform: "facebook",
  campaignType: "lead_gen",
  startDate: "",
  endDate: "",
  adSetName: "",
  locations: [],
  excludedLocations: [],
  targetingMode: "living",
  ageMin: 18,
  ageMax: 65,
  gender: "all",
  interests: [],
  audienceNotes: "",
  budgetType: "daily",
  budget: "",
  ads: [{ ...EMPTY_AD }],
  finalStatus: "draft",
};

// ── Validation ───────────────────────────────────────────────────────────────

type StepErrors = Record<string, string>;

function validateStep(step: number, data: WizardData): StepErrors {
  const errors: StepErrors = {};

  if (step === 1) {
    if (!data.campaignName.trim()) errors.campaignName = "חובה להזין שם קמפיין";
    if (!data.clientId) errors.clientId = "חובה לבחור לקוח";
    if (!data.startDate) errors.startDate = "חובה לבחור תאריך התחלה";
  }

  if (step === 2) {
    if (data.budget === "" || data.budget <= 0) errors.budget = "חובה להזין תקציב תקין";
  }

  if (step === 3) {
    if (data.ads.length === 0) errors.ads = "חובה להוסיף לפחות מודעה אחת";
    data.ads.forEach((ad, i) => {
      if (!ad.caption.trim()) errors[`ad_${i}_caption`] = `מודעה ${i + 1}: חובה להזין טקסט ראשי`;
    });
  }

  return errors;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0",
        marginBottom: "2rem",
      }}
    >
      {STEPS.map((step, i) => {
        const isActive = step.key === current;
        const isDone = step.key < current;
        const color = isActive
          ? "var(--accent)"
          : isDone
            ? "#22c55e"
            : "var(--foreground-muted)";
        const bg = isActive
          ? "rgba(0,181,254,0.12)"
          : isDone
            ? "rgba(34,197,94,0.08)"
            : "transparent";

        return (
          <div key={step.key} style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.35rem",
                minWidth: "80px",
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  border: `2px solid ${color}`,
                  background: bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: isDone ? "0.9rem" : "0.85rem",
                  fontWeight: 700,
                  color,
                  transition: "all 200ms",
                }}
              >
                {isDone ? "✓" : step.icon}
              </div>
              <span
                style={{
                  fontSize: "0.65rem",
                  fontWeight: isActive ? 700 : 500,
                  color,
                  textAlign: "center",
                  whiteSpace: "nowrap",
                }}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                style={{
                  width: "48px",
                  height: "2px",
                  background: step.key < current ? "#22c55e" : "var(--border)",
                  margin: "0 0.25rem",
                  marginBottom: "1.25rem",
                  borderRadius: "1px",
                  transition: "background 200ms",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <label
      style={{
        display: "block",
        fontSize: "0.78rem",
        fontWeight: 600,
        color: "var(--foreground)",
        marginBottom: "0.35rem",
      }}
    >
      {label}
      {required && (
        <span style={{ color: "#ef4444", marginRight: "0.25rem" }}>*</span>
      )}
    </label>
  );
}

function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <div
      style={{
        fontSize: "0.7rem",
        color: "#ef4444",
        marginTop: "0.25rem",
      }}
    >
      {error}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.75rem",
  borderRadius: "0.5rem",
  border: "1px solid var(--border)",
  background: "var(--surface-raised)",
  color: "var(--foreground)",
  fontSize: "0.8rem",
  outline: "none",
  transition: "border-color 150ms",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
};

// ── Step Components ──────────────────────────────────────────────────────────

function Step1Basics({
  data,
  onChange,
  errors,
  clients,
  clientsLoading,
  clientsError,
}: {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
  errors: StepErrors;
  clients: Client[];
  clientsLoading: boolean;
  clientsError: string | null;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div className="premium-card" style={{ padding: "1.25rem" }}>
        <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--foreground)", marginBottom: "1rem" }}>
          פרטי קמפיין בסיסיים
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Campaign name */}
          <div>
            <FieldLabel label="שם קמפיין" required />
            <input
              type="text"
              value={data.campaignName}
              onChange={(e) => onChange({ campaignName: e.target.value })}
              placeholder="לדוגמה: קמפיין לידים מרץ 2026"
              style={{
                ...inputStyle,
                ...(errors.campaignName ? { borderColor: "#ef4444" } : {}),
              }}
            />
            <FieldError error={errors.campaignName} />
          </div>

          {/* Client selection */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--foreground)" }}>
                לקוח <span style={{ color: "#ef4444", marginRight: "0.25rem" }}>*</span>
              </span>
              <a
                href="/clients"
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  color: "var(--accent)",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                + לקוח חדש
              </a>
            </div>

            {/* Client dropdown — always render the select, show status inline */}
            <select
              value={data.clientId}
              onChange={(e) => onChange({ clientId: e.target.value })}
              disabled={clientsLoading && (clients || []).length === 0}
              style={{
                ...selectStyle,
                ...(errors.clientId ? { borderColor: "#ef4444" } : {}),
                ...(clientsLoading && (clients || []).length === 0 ? { opacity: 0.6 } : {}),
              }}
            >
              {clientsLoading && (clients || []).length === 0 ? (
                <option value="">טוען לקוחות...</option>
              ) : clientsError ? (
                <option value="">שגיאה בטעינת לקוחות — נסה לרענן</option>
              ) : (clients || []).length === 0 ? (
                <option value="">אין לקוחות במערכת — צור לקוח קודם</option>
              ) : (
                <>
                  <option value="">— בחר לקוח ({(clients || []).length}) —</option>
                  {(clients || []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.company ? ` (${c.company})` : ""}
                    </option>
                  ))}
                </>
              )}
            </select>
            {clientsError && (
              <div style={{ fontSize: "0.68rem", color: "#ef4444", marginTop: "0.25rem" }}>
                {clientsError}
              </div>
            )}
            {!clientsLoading && !clientsError && (clients || []).length === 0 && (
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                <Link
                  href="/clients"
                  className="mod-btn-primary"
                  style={{
                    padding: "0.35rem 0.75rem",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    borderRadius: "0.375rem",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.25rem",
                  }}
                >
                  + צור לקוח חדש
                </Link>
              </div>
            )}
            <FieldError error={errors.clientId} />
          </div>

          {/* Platform */}
          <div>
            <FieldLabel label="פלטפורמה" />
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {PLATFORM_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange({ platform: opt.value })}
                  className={data.platform === opt.value ? "mod-btn-primary" : "mod-btn-ghost"}
                  style={{
                    padding: "0.4rem 0.75rem",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    borderRadius: "0.375rem",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.3rem",
                  }}
                >
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Goal */}
          <div>
            <FieldLabel label="מטרת הקמפיין" />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: "0.5rem",
              }}
            >
              {GOAL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange({ campaignType: opt.value })}
                  style={{
                    padding: "0.75rem",
                    borderRadius: "0.5rem",
                    border: `2px solid ${data.campaignType === opt.value ? "var(--accent)" : "var(--border)"}`,
                    background: data.campaignType === opt.value ? "rgba(0,181,254,0.06)" : "var(--surface-raised)",
                    cursor: "pointer",
                    textAlign: "right",
                    transition: "all 150ms",
                  }}
                >
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--foreground)", marginBottom: "0.2rem" }}>
                    {opt.label}
                  </div>
                  <div style={{ fontSize: "0.68rem", color: "var(--foreground-muted)", lineHeight: 1.4 }}>
                    {opt.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <FieldLabel label="תאריך התחלה" required />
              <input
                type="date"
                value={data.startDate}
                onChange={(e) => onChange({ startDate: e.target.value })}
                style={{
                  ...inputStyle,
                  ...(errors.startDate ? { borderColor: "#ef4444" } : {}),
                }}
              />
              <FieldError error={errors.startDate} />
            </div>
            <div>
              <FieldLabel label="תאריך סיום" />
              <input
                type="date"
                value={data.endDate}
                onChange={(e) => onChange({ endDate: e.target.value })}
                style={inputStyle}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step2AdSet({
  data,
  onChange,
  errors,
  selectedClient,
  toast,
}: {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
  errors: StepErrors;
  selectedClient: Client | undefined;
  toast: (msg: string, type: "success" | "error") => void;
}) {
  const [cityInput, setCityInput] = useState("");
  const [cityRadius, setCityRadius] = useState(25);
  const [excludeInput, setExcludeInput] = useState("");
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [excludeSuggestions, setExcludeSuggestions] = useState<string[]>([]);
  const [interestInput, setInterestInput] = useState("");
  const [aiInterestsLoading, setAiInterestsLoading] = useState(false);
  const [aiInterestSuggestions, setAiInterestSuggestions] = useState<string[]>([]);

  // Autocomplete for city input
  const handleCityInputChange = useCallback((value: string, isExclude?: boolean) => {
    if (isExclude) {
      setExcludeInput(value);
      if (value.trim().length >= 1) {
        setExcludeSuggestions(
          ISRAELI_CITIES.filter(
            (c) => c.includes(value.trim()) && !data.excludedLocations.includes(c)
          ).slice(0, 6)
        );
      } else {
        setExcludeSuggestions([]);
      }
    } else {
      setCityInput(value);
      if (value.trim().length >= 1) {
        setCitySuggestions(
          ISRAELI_CITIES.filter(
            (c) => c.includes(value.trim()) && !data.locations.some((l) => l.city === c)
          ).slice(0, 6)
        );
      } else {
        setCitySuggestions([]);
      }
    }
  }, [data.locations, data.excludedLocations]);

  const addLocation = useCallback((city: string) => {
    if (!city.trim()) return;
    if (data.locations.some((l) => l.city === city.trim())) return;
    onChange({ locations: [...data.locations, { city: city.trim(), radius: cityRadius }] });
    setCityInput("");
    setCitySuggestions([]);
  }, [data.locations, cityRadius, onChange]);

  const removeLocation = useCallback((index: number) => {
    onChange({ locations: data.locations.filter((_, i) => i !== index) });
  }, [data.locations, onChange]);

  const addExclude = useCallback((city: string) => {
    if (!city.trim()) return;
    if (data.excludedLocations.includes(city.trim())) return;
    onChange({ excludedLocations: [...data.excludedLocations, city.trim()] });
    setExcludeInput("");
    setExcludeSuggestions([]);
  }, [data.excludedLocations, onChange]);

  const removeExclude = useCallback((index: number) => {
    onChange({ excludedLocations: data.excludedLocations.filter((_, i) => i !== index) });
  }, [data.excludedLocations, onChange]);

  const addInterest = useCallback((interest: string) => {
    const trimmed = interest.trim();
    if (!trimmed || data.interests.includes(trimmed)) return;
    onChange({ interests: [...data.interests, trimmed] });
    setInterestInput("");
  }, [data.interests, onChange]);

  const removeInterest = useCallback((index: number) => {
    onChange({ interests: data.interests.filter((_, i) => i !== index) });
  }, [data.interests, onChange]);

  // AI interest suggestions
  const handleAiInterests = useCallback(async () => {
    if (!data.clientId) {
      toast("יש לבחור לקוח בשלב 1 כדי לקבל הצעות AI", "error");
      return;
    }
    setAiInterestsLoading(true);
    setAiInterestSuggestions([]);
    try {
      const res = await fetch("/api/ai/campaign-interests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: data.clientId,
          clientName: selectedClient?.name || "",
          businessField: selectedClient?.businessField || "",
          campaignType: data.campaignType,
          platform: data.platform,
          existingInterests: data.interests,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `AI failed (${res.status})`);
      }
      const json = await res.json();
      if (json.interests && json.interests.length > 0) {
        // Filter out already-selected interests
        const filtered = (json.interests as string[]).filter((i: string) => !data.interests.includes(i));
        setAiInterestSuggestions(filtered);
      } else {
        toast("AI לא הצליח ליצור הצעות — נסה שנית", "error");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "שגיאה ביצירת הצעות";
      toast(msg, "error");
    } finally {
      setAiInterestsLoading(false);
    }
  }, [data.clientId, data.campaignType, data.platform, data.interests, selectedClient, toast]);

  const chipStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.3rem",
    padding: "0.3rem 0.6rem",
    fontSize: "0.72rem",
    fontWeight: 600,
    borderRadius: "1rem",
    border: "1px solid var(--border)",
    background: "var(--surface-raised)",
    color: "var(--foreground)",
    transition: "all 150ms",
  };

  const removeChipBtnStyle: React.CSSProperties = {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "0.8rem",
    color: "var(--foreground-muted)",
    padding: "0",
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
  };

  const suggestionDropdownStyle: React.CSSProperties = {
    position: "absolute",
    top: "100%",
    right: 0,
    left: 0,
    zIndex: 20,
    background: "var(--surface-raised)",
    border: "1px solid var(--border)",
    borderRadius: "0.5rem",
    boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
    maxHeight: "200px",
    overflowY: "auto",
  };

  const suggestionItemStyle: React.CSSProperties = {
    padding: "0.5rem 0.75rem",
    fontSize: "0.75rem",
    cursor: "pointer",
    borderBottom: "1px solid var(--border)",
    transition: "background 100ms",
  };

  const budgetNum = typeof data.budget === "number" ? data.budget : 0;
  const days = data.startDate && data.endDate
    ? Math.max(1, Math.ceil((new Date(data.endDate).getTime() - new Date(data.startDate).getTime()) / 86400000))
    : 30;
  const totalBudget = data.budgetType === "daily" ? budgetNum * days : budgetNum;
  const dailyBudget = data.budgetType === "total" ? (days > 0 ? budgetNum / days : 0) : budgetNum;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* ── Ad Set Name ── */}
      <div className="premium-card" style={{ padding: "1.25rem" }}>
        <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--foreground)", marginBottom: "1rem" }}>
          🎯 קבוצת מודעות (Ad Set)
        </div>
        <div>
          <FieldLabel label="שם קבוצת מודעות" />
          <input
            type="text"
            value={data.adSetName}
            onChange={(e) => onChange({ adSetName: e.target.value })}
            placeholder={data.campaignName ? `${data.campaignName} — קבוצה ראשית` : "לדוגמה: קהל נשים 25-45 מרכז"}
            style={inputStyle}
          />
          <div style={{ fontSize: "0.65rem", color: "var(--foreground-muted)", marginTop: "0.25rem" }}>
            אם ריק, ייווצר שם אוטומטי מתוך שם הקמפיין
          </div>
        </div>
      </div>

      {/* ── Geographic Targeting ── */}
      <div className="premium-card" style={{ padding: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
          <span style={{ fontSize: "1.1rem" }}>📍</span>
          <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--foreground)" }}>
            טרגוט גאוגרפי
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Targeting mode */}
          <div>
            <FieldLabel label="מצב טרגוט" />
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              {TARGETING_MODES.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => onChange({ targetingMode: mode.value })}
                  className={data.targetingMode === mode.value ? "mod-btn-primary" : "mod-btn-ghost"}
                  style={{
                    padding: "0.4rem 0.75rem",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    borderRadius: "0.375rem",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.25rem",
                  }}
                >
                  {mode.icon} {mode.label}
                </button>
              ))}
            </div>
          </div>

          {/* Include locations */}
          <div>
            <FieldLabel label="מיקומי יעד" />
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
              <div style={{ flex: 1, position: "relative" }}>
                <input
                  type="text"
                  value={cityInput}
                  onChange={(e) => handleCityInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (citySuggestions.length > 0) {
                        addLocation(citySuggestions[0]);
                      } else if (cityInput.trim()) {
                        addLocation(cityInput);
                      }
                    }
                  }}
                  placeholder="הקלד עיר או אזור..."
                  style={inputStyle}
                />
                {citySuggestions.length > 0 && (
                  <div style={suggestionDropdownStyle}>
                    {citySuggestions.map((city) => (
                      <div
                        key={city}
                        style={suggestionItemStyle}
                        onClick={() => addLocation(city)}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,181,254,0.06)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      >
                        📍 {city}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", minWidth: "110px" }}>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={cityRadius}
                  onChange={(e) => setCityRadius(Math.max(1, Number(e.target.value) || 25))}
                  style={{ ...inputStyle, width: "60px", textAlign: "center" }}
                />
                <span style={{ fontSize: "0.7rem", color: "var(--foreground-muted)", whiteSpace: "nowrap" }}>ק&quot;מ</span>
              </div>
            </div>

            {/* Location chips */}
            {data.locations.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.6rem" }}>
                {data.locations.map((loc, i) => (
                  <span key={i} style={{ ...chipStyle, background: "rgba(0,181,254,0.08)", borderColor: "rgba(0,181,254,0.25)" }}>
                    📍 {loc.city}
                    <span style={{ fontSize: "0.62rem", color: "var(--foreground-muted)" }}>+{loc.radius}km</span>
                    <button type="button" style={removeChipBtnStyle} onClick={() => removeLocation(i)}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Exclude locations */}
          <div>
            <FieldLabel label="מיקומים לא לכלול (אופציונלי)" />
            <div style={{ position: "relative" }}>
              <input
                type="text"
                value={excludeInput}
                onChange={(e) => handleCityInputChange(e.target.value, true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (excludeSuggestions.length > 0) {
                      addExclude(excludeSuggestions[0]);
                    } else if (excludeInput.trim()) {
                      addExclude(excludeInput);
                    }
                  }
                }}
                placeholder="עיר או אזור להוציא מהטרגוט..."
                style={inputStyle}
              />
              {excludeSuggestions.length > 0 && (
                <div style={suggestionDropdownStyle}>
                  {excludeSuggestions.map((city) => (
                    <div
                      key={city}
                      style={suggestionItemStyle}
                      onClick={() => addExclude(city)}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.06)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      🚫 {city}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {data.excludedLocations.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.6rem" }}>
                {data.excludedLocations.map((loc, i) => (
                  <span key={i} style={{ ...chipStyle, background: "rgba(239,68,68,0.06)", borderColor: "rgba(239,68,68,0.2)", color: "#ef4444" }}>
                    🚫 {loc}
                    <button type="button" style={{ ...removeChipBtnStyle, color: "#ef4444" }} onClick={() => removeExclude(i)}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Demographics ── */}
      <div className="premium-card" style={{ padding: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
          <span style={{ fontSize: "1.1rem" }}>👥</span>
          <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--foreground)" }}>
            דמוגרפיה
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Age range */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <FieldLabel label="גיל מינימום" />
              <input
                type="number"
                min={13}
                max={65}
                value={data.ageMin}
                onChange={(e) => onChange({ ageMin: Number(e.target.value) || 18 })}
                style={inputStyle}
              />
            </div>
            <div>
              <FieldLabel label="גיל מקסימום" />
              <input
                type="number"
                min={13}
                max={65}
                value={data.ageMax}
                onChange={(e) => onChange({ ageMax: Number(e.target.value) || 65 })}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Gender */}
          <div>
            <FieldLabel label="מגדר" />
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {GENDER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange({ gender: opt.value })}
                  className={data.gender === opt.value ? "mod-btn-primary" : "mod-btn-ghost"}
                  style={{
                    padding: "0.4rem 0.875rem",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    borderRadius: "0.375rem",
                    cursor: "pointer",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Interests (with AI) ── */}
      <div className="premium-card" style={{ padding: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "1.1rem" }}>🎯</span>
            <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--foreground)" }}>
              תחומי עניין
            </div>
          </div>
          <button
            type="button"
            disabled={aiInterestsLoading || !data.clientId}
            onClick={handleAiInterests}
            className="mod-btn-ghost"
            style={{
              padding: "0.35rem 0.7rem",
              fontSize: "0.7rem",
              fontWeight: 600,
              borderRadius: "0.375rem",
              cursor: aiInterestsLoading ? "wait" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              opacity: !data.clientId ? 0.5 : 1,
              background: "rgba(139,92,246,0.06)",
              borderColor: "rgba(139,92,246,0.2)",
              color: "#0092cc",
            }}
          >
            {aiInterestsLoading ? (
              <><span className="skeleton" style={{ width: 12, height: 12, borderRadius: "50%", display: "inline-block" }} /> AI מנתח...</>
            ) : (
              <>🤖 הצע תחומי עניין</>
            )}
          </button>
        </div>

        {/* Manual interest input */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <input
            type="text"
            value={interestInput}
            onChange={(e) => setInterestInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addInterest(interestInput);
              }
            }}
            placeholder="הקלד תחום עניין ולחץ Enter..."
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            type="button"
            onClick={() => addInterest(interestInput)}
            disabled={!interestInput.trim()}
            className="mod-btn-ghost"
            style={{
              padding: "0.4rem 0.75rem",
              fontSize: "0.75rem",
              fontWeight: 600,
              borderRadius: "0.375rem",
              cursor: "pointer",
              opacity: !interestInput.trim() ? 0.5 : 1,
            }}
          >
            + הוסף
          </button>
        </div>

        {/* Selected interests */}
        {data.interests.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: "0.75rem" }}>
            {data.interests.map((interest, i) => (
              <span key={i} style={{ ...chipStyle, background: "rgba(139,92,246,0.08)", borderColor: "rgba(139,92,246,0.2)" }}>
                🎯 {interest}
                <button type="button" style={removeChipBtnStyle} onClick={() => removeInterest(i)}>×</button>
              </span>
            ))}
          </div>
        )}

        {/* AI suggestions */}
        {aiInterestSuggestions.length > 0 && (
          <div style={{
            padding: "0.75rem",
            background: "rgba(139,92,246,0.04)",
            border: "1px solid rgba(139,92,246,0.15)",
            borderRadius: "0.5rem",
          }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "#0092cc", marginBottom: "0.5rem" }}>
              ✨ הצעות AI — לחץ להוספה:
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
              {aiInterestSuggestions.map((interest, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    addInterest(interest);
                    setAiInterestSuggestions((prev) => prev.filter((_, idx) => idx !== i));
                  }}
                  style={{
                    ...chipStyle,
                    cursor: "pointer",
                    background: "rgba(139,92,246,0.08)",
                    borderColor: "rgba(139,92,246,0.25)",
                    borderStyle: "dashed",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.15)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.08)"; }}
                >
                  + {interest}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setAiInterestSuggestions([])}
              className="mod-btn-ghost"
              style={{ marginTop: "0.5rem", padding: "0.2rem 0.5rem", fontSize: "0.65rem", borderRadius: "0.25rem", cursor: "pointer" }}
            >
              סגור הצעות
            </button>
          </div>
        )}

        {!data.clientId && (
          <div style={{ fontSize: "0.68rem", color: "var(--foreground-muted)", marginTop: "0.25rem" }}>
            בחר לקוח בשלב 1 כדי לקבל הצעות AI מותאמות
          </div>
        )}
      </div>

      {/* ── Audience notes ── */}
      <div className="premium-card" style={{ padding: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <span style={{ fontSize: "1.1rem" }}>📝</span>
          <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--foreground)" }}>
            הערות טרגוט נוספות
          </div>
        </div>
        <textarea
          value={data.audienceNotes}
          onChange={(e) => onChange({ audienceNotes: e.target.value })}
          placeholder="הערות חופשיות — Lookalike, Custom Audience, Exclude..."
          rows={2}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </div>

      {/* Client knowledge box */}
      {selectedClient && (selectedClient.marketingGoals || selectedClient.keyMarketingMessages) && (
        <div className="premium-card" style={{ padding: "1.25rem" }}>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--foreground)", marginBottom: "0.75rem" }}>
            📎 ידע קיים על הלקוח
          </div>
          {selectedClient.marketingGoals && (
            <div style={{ marginBottom: "0.5rem" }}>
              <div style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.2rem" }}>
                מטרות שיווק:
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--foreground)", lineHeight: 1.5 }}>
                {selectedClient.marketingGoals}
              </div>
            </div>
          )}
          {selectedClient.keyMarketingMessages && (
            <div>
              <div style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.2rem" }}>
                מסרים שיווקיים:
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--foreground)", lineHeight: 1.5 }}>
                {selectedClient.keyMarketingMessages}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Budget (moved from Step 4 — budget is an Ad Set concern) ── */}
      <div className="premium-card" style={{ padding: "1.25rem" }}>
        <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--foreground)", marginBottom: "1rem" }}>
          💰 תקציב
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <FieldLabel label="סוג תקציב" />
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => onChange({ budgetType: "daily" })}
                className={data.budgetType === "daily" ? "mod-btn-primary" : "mod-btn-ghost"}
                style={{ padding: "0.4rem 0.875rem", fontSize: "0.75rem", fontWeight: 600, borderRadius: "0.375rem", cursor: "pointer" }}
              >
                יומי
              </button>
              <button
                type="button"
                onClick={() => onChange({ budgetType: "total" })}
                className={data.budgetType === "total" ? "mod-btn-primary" : "mod-btn-ghost"}
                style={{ padding: "0.4rem 0.875rem", fontSize: "0.75rem", fontWeight: 600, borderRadius: "0.375rem", cursor: "pointer" }}
              >
                כולל
              </button>
            </div>
          </div>
          <div>
            <FieldLabel label={data.budgetType === "daily" ? "תקציב יומי (₪)" : "תקציב כולל (₪)"} required />
            <input
              type="number"
              min={0}
              value={data.budget}
              onChange={(e) => {
                const v = e.target.value;
                onChange({ budget: v === "" ? "" : Number(v) });
              }}
              placeholder="0"
              style={{
                ...inputStyle,
                direction: "ltr",
                textAlign: "left",
                ...(errors.budget ? { borderColor: "#ef4444" } : {}),
              }}
            />
            <FieldError error={errors.budget} />
          </div>
          {budgetNum > 0 && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: "0.5rem",
            }}>
              <div style={{ textAlign: "center", padding: "0.6rem", background: "var(--surface-raised)", borderRadius: "0.5rem", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: "1rem", fontWeight: 800, color: "#22c55e" }}>₪{Math.round(totalBudget).toLocaleString()}</div>
                <div style={{ fontSize: "0.6rem", color: "var(--foreground-muted)", fontWeight: 600 }}>כולל</div>
              </div>
              <div style={{ textAlign: "center", padding: "0.6rem", background: "var(--surface-raised)", borderRadius: "0.5rem", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: "1rem", fontWeight: 800, color: "#3b82f6" }}>₪{Math.round(dailyBudget).toLocaleString()}</div>
                <div style={{ fontSize: "0.6rem", color: "var(--foreground-muted)", fontWeight: 600 }}>יומי</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Step3Ads({
  data,
  onChange,
  errors,
  clientFiles,
  selectedClient,
  refetchClientFiles,
  createClientFile,
  toast,
}: {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
  errors: StepErrors;
  clientFiles: ClientFile[];
  selectedClient: Client | undefined;
  refetchClientFiles: () => Promise<void>;
  createClientFile: (item: Partial<ClientFile>) => Promise<ClientFile>;
  toast: (msg: string, type: "success" | "error") => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [activeAdIndex, setActiveAdIndex] = useState(0);

  // AI state
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiResults, setAiResults] = useState<{ field: string; results: string[] } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const relevantFiles = clientFiles.filter(
    (f) => f.fileType === "image" || f.fileType === "video"
  );

  // Current ad being edited
  const currentAd = data.ads[activeAdIndex] || EMPTY_AD;

  // Helper to update a field on the active ad
  const updateAd = useCallback((partial: Partial<WizardAd>) => {
    const newAds = [...data.ads];
    newAds[activeAdIndex] = { ...newAds[activeAdIndex], ...partial };
    onChange({ ads: newAds });
  }, [data.ads, activeAdIndex, onChange]);

  const addAd = useCallback(() => {
    const newAd: WizardAd = { ...EMPTY_AD, name: `מודעה ${data.ads.length + 1}` };
    onChange({ ads: [...data.ads, newAd] });
    setActiveAdIndex(data.ads.length);
  }, [data.ads, onChange]);

  const removeAd = useCallback((index: number) => {
    if (data.ads.length <= 1) {
      toast("חובה לפחות מודעה אחת", "error");
      return;
    }
    const newAds = data.ads.filter((_, i) => i !== index);
    onChange({ ads: newAds });
    if (activeAdIndex >= newAds.length) setActiveAdIndex(Math.max(0, newAds.length - 1));
  }, [data.ads, activeAdIndex, onChange, toast]);

  const duplicateAd = useCallback((index: number) => {
    const source = data.ads[index];
    const newAd: WizardAd = { ...source, name: `${source.name || "מודעה"} (עותק)` };
    const newAds = [...data.ads];
    newAds.splice(index + 1, 0, newAd);
    onChange({ ads: newAds });
    setActiveAdIndex(index + 1);
  }, [data.ads, onChange]);

  // ── Upload handler (reuses real signed-URL pattern) ──
  const handleFileUpload = useCallback(async (file: File) => {
    if (!data.clientId) {
      toast("יש לבחור לקוח לפני העלאת קובץ", "error");
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      // Step 1: Get signed upload URL
      const signedRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size,
        }),
      });

      if (!signedRes.ok) {
        const err = await signedRes.json().catch(() => ({}));
        throw new Error(err.error || `Upload init failed (${signedRes.status})`);
      }

      const { uploadUrl, publicUrl, token } = await signedRes.json();

      // Step 2: PUT file directly to Supabase Storage
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          Authorization: `Bearer ${token}`,
        },
        body: file,
      });

      if (!putRes.ok) {
        throw new Error(`File upload failed (${putRes.status})`);
      }

      // Step 3: Create client-file DB record
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const fileType: ClientFile["fileType"] =
        ["mp4", "webm", "mov", "avi"].includes(ext) ? "video"
        : ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext) ? "image"
        : ["pdf"].includes(ext) ? "pdf"
        : "other";

      const created = await createClientFile({
        clientId: data.clientId,
        fileName: file.name,
        fileUrl: publicUrl,
        fileType,
        category: "social_media" as ClientFile["category"],
        fileSize: file.size,
        uploadedBy: "campaign-builder",
        notes: `הועלה מבונה הקמפיינים`,
      });

      // Step 4: Refresh file list and auto-select
      await refetchClientFiles();
      updateAd({ linkedClientFileId: created.id });

      setUploadSuccess(file.name);
      toast(`הקובץ "${file.name}" הועלה בהצלחה`, "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "שגיאה בהעלאת קובץ";
      setUploadError(msg);
      toast(msg, "error");
    } finally {
      setUploading(false);
      // Reset the file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [data.clientId, createClientFile, refetchClientFiles, onChange, toast]);

  // ── AI copy handler ──
  const handleAI = useCallback(async (field: "caption" | "headline", mode: "improve" | "variations") => {
    const key = `${field}-${mode}`;
    setAiLoading(key);
    setAiError(null);
    setAiResults(null);

    try {
      const res = await fetch("/api/ai/campaign-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          field,
          currentText: field === "caption" ? currentAd.caption : currentAd.headline,
          context: {
            clientId: data.clientId,
            clientName: selectedClient?.name || "",
            businessField: selectedClient?.businessField || "",
            campaignType: data.campaignType,
            platform: data.platform,
            mediaType: currentAd.mediaType,
            adFormat: currentAd.adFormat,
            ...(field === "headline" && currentAd.caption.trim() ? { primaryText: currentAd.caption } : {}),
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `AI generation failed (${res.status})`);
      }

      const json = await res.json();
      if (json.results && json.results.length > 0) {
        setAiResults({ field, results: json.results });
      } else {
        throw new Error("AI returned empty results");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "שגיאה ביצירת טקסט";
      setAiError(msg);
    } finally {
      setAiLoading(null);
    }
  }, [currentAd, data.clientId, data.campaignType, data.platform, selectedClient]);

  const applyAiResult = useCallback((field: string, text: string) => {
    if (field === "caption") updateAd({ caption: text });
    else if (field === "headline") updateAd({ headline: text });
    setAiResults(null);
  }, [updateAd]);

  const dismissAiResults = useCallback(() => {
    setAiResults(null);
    setAiError(null);
  }, []);

  // ── AI results chooser ──
  const renderAiChooser = (field: string) => {
    if (aiError) {
      return (
        <div style={{ padding: "0.75rem", background: "rgba(239,68,68,0.06)", borderRadius: "0.5rem", border: "1px solid rgba(239,68,68,0.2)", marginTop: "0.5rem" }}>
          <div style={{ fontSize: "0.75rem", color: "#ef4444", fontWeight: 600, marginBottom: "0.25rem" }}>שגיאה ביצירת AI</div>
          <div style={{ fontSize: "0.68rem", color: "var(--foreground-muted)" }}>{aiError}</div>
          <button type="button" onClick={dismissAiResults} className="mod-btn-ghost" style={{ marginTop: "0.5rem", padding: "0.25rem 0.5rem", fontSize: "0.68rem", borderRadius: "0.25rem", cursor: "pointer" }}>
            סגור
          </button>
        </div>
      );
    }
    if (!aiResults || aiResults.field !== field) return null;
    return (
      <div className="ux-type-reveal" style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.15rem" }}>
          <span className="ux-ai-label">AI</span>
          <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground)" }}>בחר גרסה:</span>
        </div>
        {aiResults.results.map((text, i) => (
          <div
            key={i}
            className="premium-card-sm"
            style={{
              padding: "0.6rem 0.75rem",
              background: "var(--surface-raised)",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "flex-start",
              gap: "0.5rem",
              animationDelay: `${i * 80}ms`,
            }}
            onClick={() => applyAiResult(field, text)}
          >
            <span style={{
              fontSize: "0.65rem", fontWeight: 800, minWidth: "1.4rem", height: "1.4rem",
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: "50%", background: "rgba(0,181,254,0.08)", color: "var(--accent)",
              flexShrink: 0, marginTop: "0.05rem",
            }}>
              {i + 1}
            </span>
            <span style={{ fontSize: "0.78rem", color: "var(--foreground)", lineHeight: 1.5, flex: 1 }}>
              {text}
            </span>
          </div>
        ))}
        <button type="button" onClick={dismissAiResults} className="mod-btn-ghost" style={{ alignSelf: "flex-start", padding: "0.25rem 0.5rem", fontSize: "0.68rem", borderRadius: "0.25rem", cursor: "pointer", marginTop: "0.15rem" }}>
          ביטול
        </button>
      </div>
    );
  };

  // ── AI buttons row ──
  const renderAiButtons = (field: "caption" | "headline", improveLabel: string, variationsLabel: string) => {
    const isFieldLoading = aiLoading?.startsWith(field);
    const currentText = field === "caption" ? currentAd.caption : currentAd.headline;
    const hasText = currentText && currentText.trim().length > 5;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.35rem" }}>
        {/* AI thinking indicator */}
        {isFieldLoading && (
          <div style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            padding: "0.5rem 0.75rem", borderRadius: "0.5rem",
            background: "linear-gradient(135deg, rgba(0,181,254,0.04), rgba(139,92,246,0.04))",
            border: "1px solid rgba(0,181,254,0.12)",
          }}>
            <div className="ux-ai-thinking-dots" style={{ display: "flex", gap: "3px" }}>
              <span /><span /><span />
            </div>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--accent)" }}>
              AI {aiLoading === `${field}-improve` ? "משפר את הטקסט..." : "יוצר גרסאות..."}
            </span>
          </div>
        )}
        {/* Main AI buttons */}
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={!!aiLoading || !data.clientId}
            onClick={() => handleAI(field, "improve")}
            className="ux-ai-tone-btn"
            style={{
              opacity: aiLoading && !isFieldLoading ? 0.4 : 1,
              cursor: aiLoading ? "wait" : !data.clientId ? "not-allowed" : "pointer",
            }}
          >
            {aiLoading === `${field}-improve` ? (
              <>🔄 משפר...</>
            ) : (
              <>✨ {improveLabel}</>
            )}
          </button>
          <button
            type="button"
            disabled={!!aiLoading || !data.clientId}
            onClick={() => handleAI(field, "variations")}
            className="ux-ai-tone-btn"
            style={{
              opacity: aiLoading && !isFieldLoading ? 0.4 : 1,
              cursor: aiLoading ? "wait" : !data.clientId ? "not-allowed" : "pointer",
            }}
          >
            {aiLoading === `${field}-variations` ? (
              <>🔄 יוצר...</>
            ) : (
              <>🔄 {variationsLabel}</>
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* ── Ad Tabs ── */}
      <div className="premium-card" style={{ padding: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--foreground)" }}>
            🎨 מודעות ({data.ads.length})
          </div>
          <button
            type="button"
            onClick={addAd}
            className="mod-btn-primary"
            style={{ padding: "0.35rem 0.75rem", fontSize: "0.72rem", fontWeight: 600, borderRadius: "0.375rem", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
          >
            + הוסף מודעה
          </button>
        </div>
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
          {data.ads.map((ad, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "0" }}>
              <button
                type="button"
                onClick={() => setActiveAdIndex(i)}
                style={{
                  padding: "0.4rem 0.75rem",
                  fontSize: "0.72rem",
                  fontWeight: activeAdIndex === i ? 700 : 500,
                  borderRadius: "0.375rem 0 0 0.375rem",
                  border: `1px solid ${activeAdIndex === i ? "var(--accent)" : "var(--border)"}`,
                  borderLeft: activeAdIndex === i ? `1px solid var(--accent)` : `1px solid var(--border)`,
                  backgroundColor: activeAdIndex === i ? "rgba(0,181,254,0.08)" : "transparent",
                  color: activeAdIndex === i ? "var(--accent)" : "var(--foreground-muted)",
                  cursor: "pointer",
                  transition: "all 150ms",
                }}
              >
                {ad.name || `מודעה ${i + 1}`}
              </button>
              <div style={{ display: "flex", gap: "0" }}>
                <button
                  type="button"
                  title="שכפל"
                  onClick={() => duplicateAd(i)}
                  style={{
                    padding: "0.4rem 0.35rem",
                    fontSize: "0.65rem",
                    border: `1px solid var(--border)`,
                    borderRight: "none",
                    borderLeft: "none",
                    backgroundColor: "transparent",
                    color: "var(--foreground-muted)",
                    cursor: "pointer",
                  }}
                >
                  📋
                </button>
                {data.ads.length > 1 && (
                  <button
                    type="button"
                    title="מחק"
                    onClick={() => removeAd(i)}
                    style={{
                      padding: "0.4rem 0.35rem",
                      fontSize: "0.65rem",
                      border: `1px solid var(--border)`,
                      borderRadius: "0 0.375rem 0.375rem 0",
                      backgroundColor: "transparent",
                      color: "#ef4444",
                      cursor: "pointer",
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        {errors.ads && <FieldError error={errors.ads} />}
      </div>

      {/* ── Active Ad Editor ── */}
      <div className="premium-card" style={{ padding: "1.25rem" }}>
        <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--foreground)", marginBottom: "1rem" }}>
          מדיה וקריאייטיב — {currentAd.name || `מודעה ${activeAdIndex + 1}`}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Ad name */}
          <div>
            <FieldLabel label="שם מודעה" />
            <input
              type="text"
              value={currentAd.name}
              onChange={(e) => updateAd({ name: e.target.value })}
              placeholder={`מודעה ${activeAdIndex + 1}`}
              style={inputStyle}
            />
          </div>

          {/* Media type */}
          <div>
            <FieldLabel label="סוג מדיה" />
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => updateAd({ mediaType: "image" })}
                className={currentAd.mediaType === "image" ? "mod-btn-primary" : "mod-btn-ghost"}
                style={{ padding: "0.4rem 0.875rem", fontSize: "0.75rem", fontWeight: 600, borderRadius: "0.375rem", cursor: "pointer" }}
              >
                🖼️ תמונה
              </button>
              <button
                type="button"
                onClick={() => updateAd({ mediaType: "video" })}
                className={currentAd.mediaType === "video" ? "mod-btn-primary" : "mod-btn-ghost"}
                style={{ padding: "0.4rem 0.875rem", fontSize: "0.75rem", fontWeight: 600, borderRadius: "0.375rem", cursor: "pointer" }}
              >
                🎬 וידאו
              </button>
            </div>
          </div>

          {/* Ad format */}
          <div>
            <FieldLabel label="פורמט מודעה" />
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {AD_FORMAT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateAd({ adFormat: opt.value })}
                  className={currentAd.adFormat === opt.value ? "mod-btn-primary" : "mod-btn-ghost"}
                  style={{ padding: "0.4rem 0.75rem", fontSize: "0.75rem", fontWeight: 600, borderRadius: "0.375rem", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
                >
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Select from existing files */}
          <div>
            <FieldLabel label="בחר קובץ מהלקוח" />
            {relevantFiles.length > 0 ? (
              <select
                value={currentAd.linkedClientFileId || ""}
                onChange={(e) =>
                  updateAd({
                    linkedClientFileId: e.target.value || null,
                  })
                }
                style={selectStyle}
              >
                <option value="">— בחר קובץ קיים ({relevantFiles.length}) —</option>
                {relevantFiles.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.fileName} ({f.fileType})
                  </option>
                ))}
              </select>
            ) : (
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--foreground-muted)",
                  padding: "0.75rem",
                  background: "var(--surface-raised)",
                  borderRadius: "0.375rem",
                  border: "1px solid var(--border)",
                  textAlign: "center",
                }}
              >
                {data.clientId
                  ? "אין קבצי תמונה/וידאו ללקוח זה — העלה קובץ חדש"
                  : "בחר לקוח כדי לראות קבצים קיימים"}
              </div>
            )}
          </div>

          {/* Upload new file */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
            />
            <button
              type="button"
              disabled={uploading || !data.clientId}
              onClick={() => fileInputRef.current?.click()}
              className="mod-btn-ghost"
              style={{
                padding: "0.5rem 0.875rem",
                fontSize: "0.75rem",
                fontWeight: 600,
                borderRadius: "0.375rem",
                cursor: uploading ? "wait" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                opacity: !data.clientId ? 0.5 : 1,
                width: "100%",
                justifyContent: "center",
                border: "1px dashed var(--border)",
                background: "var(--surface-raised)",
                transition: "all 150ms",
              }}
            >
              {uploading ? (
                <><span className="skeleton" style={{ width: 14, height: 14, borderRadius: "50%", display: "inline-block" }} /> מעלה קובץ...</>
              ) : (
                <>📤 העלה קובץ חדש</>
              )}
            </button>
            {!data.clientId && (
              <div style={{ fontSize: "0.65rem", color: "var(--foreground-muted)", marginTop: "0.25rem" }}>
                יש לבחור לקוח בשלב 1 לפני העלאת קובץ
              </div>
            )}
            {uploadError && (
              <div style={{ fontSize: "0.7rem", color: "#ef4444", marginTop: "0.35rem", padding: "0.4rem 0.6rem", background: "rgba(239,68,68,0.06)", borderRadius: "0.375rem", border: "1px solid rgba(239,68,68,0.15)" }}>
                {uploadError}
              </div>
            )}
            {uploadSuccess && (
              <div style={{ fontSize: "0.7rem", color: "#22c55e", marginTop: "0.35rem", padding: "0.4rem 0.6rem", background: "rgba(34,197,94,0.06)", borderRadius: "0.375rem", border: "1px solid rgba(34,197,94,0.15)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                ✅ הקובץ &quot;{uploadSuccess}&quot; הועלה ונבחר
              </div>
            )}
          </div>

          {/* Or external URL */}
          <div>
            <FieldLabel label="או — קישור חיצוני למדיה" />
            <input
              type="url"
              value={currentAd.externalMediaUrl}
              onChange={(e) => updateAd({ externalMediaUrl: e.target.value })}
              placeholder="https://..."
              style={{ ...inputStyle, direction: "ltr", textAlign: "left" }}
            />
          </div>
        </div>
      </div>

      <div className="premium-card" style={{ padding: "1.25rem" }}>
        <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--foreground)", marginBottom: "1rem" }}>
          טקסט מודעה
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Primary text */}
          <div>
            <FieldLabel label="טקסט ראשי (Primary Text)" required />
            <textarea
              value={currentAd.caption}
              onChange={(e) => updateAd({ caption: e.target.value })}
              placeholder="הטקסט הראשי של המודעה..."
              rows={4}
              style={{
                ...inputStyle,
                resize: "vertical",
                ...(errors[`ad_${activeAdIndex}_caption`] ? { borderColor: "#ef4444" } : {}),
              }}
            />
            <FieldError error={errors[`ad_${activeAdIndex}_caption`]} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: "0.2rem" }}>
              <div>{renderAiButtons("caption", "שפר עם AI", "צור 3 גרסאות")}</div>
              <div style={{ fontSize: "0.65rem", color: "var(--foreground-muted)", direction: "ltr", minWidth: "4rem", textAlign: "left", paddingTop: "0.35rem" }}>
                {currentAd.caption.length} / 500
              </div>
            </div>
            {renderAiChooser("caption")}
          </div>

          {/* Headline */}
          <div>
            <FieldLabel label="כותרת (Headline)" />
            <input
              type="text"
              value={currentAd.headline}
              onChange={(e) => updateAd({ headline: e.target.value })}
              placeholder="כותרת קצרה ומושכת"
              style={inputStyle}
            />
            {renderAiButtons("headline", "שפר עם AI", "צור 3 כותרות")}
            {renderAiChooser("headline")}
          </div>

          {/* CTA */}
          <div>
            <FieldLabel label="כפתור CTA" />
            <select
              value={currentAd.cta}
              onChange={(e) => updateAd({ cta: e.target.value })}
              style={selectStyle}
            >
              {CTA_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step4Review({
  data,
  onChange,
  selectedClient,
}: {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
  selectedClient: Client | undefined;
}) {
  const budgetNum = typeof data.budget === "number" ? data.budget : 0;
  const days = data.startDate && data.endDate
    ? Math.max(1, Math.ceil((new Date(data.endDate).getTime() - new Date(data.startDate).getTime()) / 86400000))
    : 30;
  const totalBudget = data.budgetType === "daily" ? budgetNum * days : budgetNum;
  const dailyBudget = data.budgetType === "total" ? (days > 0 ? budgetNum / days : 0) : budgetNum;
  const estimatedLeads = dailyBudget > 0 ? Math.round((totalBudget / (dailyBudget > 50 ? 25 : 40))) : 0;

  const reviewRow = (label: string, value: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.45rem 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--foreground-muted)" }}>{label}</span>
      <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--foreground)", maxWidth: "60%", textAlign: "left", direction: "ltr" }}>{value || "—"}</span>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Campaign summary */}
      <div className="premium-card" style={{ padding: "1.25rem" }}>
        <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--foreground)", marginBottom: "0.75rem" }}>
          📋 קמפיין
        </div>
        {reviewRow("שם קמפיין", data.campaignName)}
        {reviewRow("לקוח", selectedClient?.name || "—")}
        {reviewRow("פלטפורמה", PLATFORM_OPTIONS.find(p => p.value === data.platform)?.label || data.platform)}
        {reviewRow("סוג", GOAL_OPTIONS.find(g => g.value === data.campaignType)?.label || data.campaignType)}
        {reviewRow("תאריכים", `${data.startDate || "—"} → ${data.endDate || "—"}`)}
      </div>

      {/* Ad Set summary */}
      <div className="premium-card" style={{ padding: "1.25rem" }}>
        <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--foreground)", marginBottom: "0.75rem" }}>
          🎯 קבוצת מודעות
        </div>
        {reviewRow("שם", data.adSetName || `${data.campaignName} — קבוצה ראשית`)}
        {reviewRow("מיקומים", data.locations.map(l => `${l.city}(+${l.radius}km)`).join(", ") || "—")}
        {reviewRow("גילאים", `${data.ageMin}–${data.ageMax}`)}
        {reviewRow("מגדר", GENDER_OPTIONS.find(g => g.value === data.gender)?.label || data.gender)}
        {reviewRow("תחומי עניין", data.interests.join(", ") || "—")}
        {reviewRow("תקציב", budgetNum > 0 ? `₪${budgetNum.toLocaleString()} (${data.budgetType === "daily" ? "יומי" : "כולל"})` : "—")}
      </div>

      {/* Ads summary */}
      <div className="premium-card" style={{ padding: "1.25rem" }}>
        <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--foreground)", marginBottom: "0.75rem" }}>
          🎨 מודעות ({data.ads.length})
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {data.ads.map((ad, i) => (
            <div key={i} style={{ padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--surface-raised)" }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--accent)", marginBottom: "0.35rem" }}>
                {ad.name || `מודעה ${i + 1}`}
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--foreground-muted)", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                <span>סוג: {ad.mediaType === "image" ? "תמונה" : "וידאו"}</span>
                <span>פורמט: {AD_FORMAT_OPTIONS.find(f => f.value === ad.adFormat)?.label || ad.adFormat}</span>
                {ad.cta && <span>CTA: {CTA_OPTIONS.find(c => c.value === ad.cta)?.label || ad.cta}</span>}
              </div>
              {ad.caption && (
                <div style={{ fontSize: "0.72rem", color: "var(--foreground)", marginTop: "0.35rem", lineHeight: 1.5, maxHeight: "2.5rem", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {ad.caption.slice(0, 120)}{ad.caption.length > 120 ? "..." : ""}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Estimates */}
      {budgetNum > 0 && (
        <div className="premium-card" style={{ padding: "1.25rem" }}>
          <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--foreground)", marginBottom: "0.75rem" }}>
            📊 תחזית (אומדן)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "0.5rem" }}>
            <div style={{ textAlign: "center", padding: "0.6rem", background: "var(--surface)", borderRadius: "0.5rem", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "1rem", fontWeight: 800, color: "#22c55e" }}>₪{Math.round(totalBudget).toLocaleString()}</div>
              <div style={{ fontSize: "0.6rem", color: "var(--foreground-muted)", fontWeight: 600 }}>כולל</div>
            </div>
            <div style={{ textAlign: "center", padding: "0.6rem", background: "var(--surface)", borderRadius: "0.5rem", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "1rem", fontWeight: 800, color: "#3b82f6" }}>₪{Math.round(dailyBudget).toLocaleString()}</div>
              <div style={{ fontSize: "0.6rem", color: "var(--foreground-muted)", fontWeight: 600 }}>יומי</div>
            </div>
            <div style={{ textAlign: "center", padding: "0.6rem", background: "var(--surface)", borderRadius: "0.5rem", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "1rem", fontWeight: 800, color: "#a78bfa" }}>~{estimatedLeads}</div>
              <div style={{ fontSize: "0.6rem", color: "var(--foreground-muted)", fontWeight: 600 }}>לידים צפויים</div>
            </div>
          </div>
          <div style={{ fontSize: "0.6rem", color: "var(--foreground-muted)", textAlign: "center", marginTop: "0.5rem", opacity: 0.6 }}>
            * אומדן בלבד
          </div>
        </div>
      )}

      {/* Final status toggle */}
      <div className="premium-card" style={{ padding: "1.25rem" }}>
        <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--foreground)", marginBottom: "1rem" }}>
          סטטוס לאחר יצירה
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            type="button"
            onClick={() => onChange({ finalStatus: "draft" })}
            style={{
              flex: 1, padding: "1rem", borderRadius: "0.5rem",
              border: `2px solid ${data.finalStatus === "draft" ? "#6b7280" : "var(--border)"}`,
              background: data.finalStatus === "draft" ? "rgba(107,114,128,0.08)" : "var(--surface-raised)",
              cursor: "pointer", textAlign: "center", transition: "all 150ms",
            }}
          >
            <div style={{ fontSize: "1.25rem", marginBottom: "0.25rem" }}>📝</div>
            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--foreground)" }}>טיוטה</div>
            <div style={{ fontSize: "0.65rem", color: "var(--foreground-muted)", marginTop: "0.15rem" }}>שמור לעריכה נוספת</div>
          </button>
          <button
            type="button"
            onClick={() => onChange({ finalStatus: "waiting_approval" })}
            style={{
              flex: 1, padding: "1rem", borderRadius: "0.5rem",
              border: `2px solid ${data.finalStatus === "waiting_approval" ? "#22c55e" : "var(--border)"}`,
              background: data.finalStatus === "waiting_approval" ? "rgba(34,197,94,0.08)" : "var(--surface-raised)",
              cursor: "pointer", textAlign: "center", transition: "all 150ms",
            }}
          >
            <div style={{ fontSize: "1.25rem", marginBottom: "0.25rem" }}>🚀</div>
            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--foreground)" }}>מוכן לפרסום</div>
            <div style={{ fontSize: "0.65rem", color: "var(--foreground-muted)", marginTop: "0.15rem" }}>שלח לאישור ופרסום</div>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function CampaignBuilderPage() {
  const router = useRouter();
  const toast = useToast();
  const { data: clients, loading: clientsLoading, error: clientsError } = useClients();
  const { create: createCampaign } = useCampaigns();
  const { create: createAdSet } = useAdSets();
  const { create: createAd } = useAds();
  const { data: allClientFiles, refetch: refetchClientFiles, create: createClientFile } = useClientFiles();

  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>(INITIAL_DATA);
  const [errors, setErrors] = useState<StepErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Derived
  const selectedClient = useMemo(
    () => (clients || []).find((c) => c.id === data.clientId),
    [clients, data.clientId]
  );

  const clientFiles = useMemo(
    () =>
      data.clientId
        ? (allClientFiles || []).filter((f) => f.clientId === data.clientId)
        : [],
    [allClientFiles, data.clientId]
  );

  // Update handler
  const handleChange = useCallback((partial: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...partial }));
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(partial)) {
        delete next[key];
      }
      return next;
    });
  }, []);

  // Navigation
  const handleNext = useCallback(() => {
    const stepErrors = validateStep(step, data);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }
    setErrors({});
    setStep((s) => Math.min(s + 1, 4));
  }, [step, data]);

  const handleBack = useCallback(() => {
    setErrors({});
    setStep((s) => Math.max(s - 1, 1));
  }, []);

  // ── Helper: build structured records from wizard data ──
  const buildRecords = useCallback((status: CampaignStatus) => {
    const clientName = selectedClient?.name || "";
    const firstAd = data.ads[0] || EMPTY_AD;

    // Campaign record (backward-compatible: still store summary in objective/notes/caption)
    const campaignPayload = {
      campaignName: data.campaignName || "טיוטה חדשה",
      clientId: data.clientId,
      clientName,
      campaignType: data.campaignType,
      objective: [
        data.locations.length > 0 && `מיקום: ${data.locations.map(l => `${l.city}(+${l.radius}km)`).join(", ")}`,
        data.excludedLocations.length > 0 && `הוצא: ${data.excludedLocations.join(", ")}`,
        data.targetingMode !== "living" && `מצב: ${TARGETING_MODES.find(m => m.value === data.targetingMode)?.label || data.targetingMode}`,
        data.interests.length > 0 && `עניינים: ${data.interests.join(", ")}`,
        data.audienceNotes,
      ].filter(Boolean).join(" | ") || "",
      platform: data.platform,
      status,
      mediaType: firstAd.mediaType,
      budget: typeof data.budget === "number" ? data.budget : 0,
      caption: firstAd.caption,
      notes: [
        firstAd.headline && `כותרת: ${firstAd.headline}`,
        firstAd.cta && `CTA: ${firstAd.cta}`,
        firstAd.adFormat && `פורמט: ${firstAd.adFormat}`,
        `קהל: ${data.gender}, ${data.ageMin}-${data.ageMax}`,
        data.budgetType === "daily" ? "תקציב יומי" : "תקציב כולל",
      ].filter(Boolean).join(" | "),
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      linkedVideoProjectId: null as string | null,
      linkedClientFileId: firstAd.linkedClientFileId,
      externalMediaUrl: firstAd.externalMediaUrl,
      adAccountId: "",
      leadFormIds: [] as string[],
    };

    return { campaignPayload, clientName };
  }, [data, selectedClient]);

  // Save as draft — Campaign only (quick save)
  const handleSaveDraft = useCallback(async () => {
    setSubmitting(true);
    try {
      const { campaignPayload } = buildRecords("draft" as CampaignStatus);
      const campaign = await createCampaign(campaignPayload);

      // Also create AdSet + Ads if we have enough data
      if (campaign && campaign.id) {
        try {
          const adSetName = data.adSetName || `${data.campaignName} — קבוצה ראשית`;
          const adSet = await createAdSet({
            campaignId: campaign.id,
            name: adSetName,
            status: "draft" as const,
            ageMin: data.ageMin,
            ageMax: data.ageMax,
            genders: [data.gender as "male" | "female" | "all"],
            geoLocations: data.locations.map(l => l.city),
            interests: data.interests,
            customAudiences: [],
            excludedAudiences: data.excludedLocations,
            placements: [],
            dailyBudget: data.budgetType === "daily" ? (typeof data.budget === "number" ? data.budget : null) : null,
            lifetimeBudget: data.budgetType === "total" ? (typeof data.budget === "number" ? data.budget : null) : null,
            startDate: data.startDate || null,
            endDate: data.endDate || null,
            bidStrategy: null,
            bidAmount: null,
            notes: data.audienceNotes,
          });

          if (adSet && adSet.id) {
            for (const wizAd of data.ads) {
              if (!wizAd.caption.trim()) continue;
              await createAd({
                adSetId: adSet.id,
                campaignId: campaign.id,
                name: wizAd.name || `${data.campaignName} — מודעה`,
                status: "draft" as const,
                creativeType: (wizAd.adFormat === "carousel" ? "carousel" : wizAd.mediaType === "video" ? "video" : "image") as AdCreativeType,
                mediaUrl: wizAd.externalMediaUrl || "",
                thumbnailUrl: null,
                primaryText: wizAd.caption,
                headline: wizAd.headline,
                description: "",
                ctaType: wizAd.cta ? wizAd.cta.toUpperCase() : "",
                ctaLink: "",
                linkedVideoProjectId: null,
                linkedClientFileId: wizAd.linkedClientFileId,
                impressions: 0, clicks: 0, spend: 0, leads: 0, conversions: 0,
                ctr: 0, cpl: 0, cpc: 0, roas: 0,
                notes: "",
              });
            }
          }
        } catch {
          // AdSet/Ad creation failed but campaign was saved — acceptable for draft
        }
      }

      toast("טיוטה נשמרה בהצלחה", "success");
      router.push("/campaigns");
    } catch {
      toast("שגיאה בשמירת טיוטה", "error");
    } finally {
      setSubmitting(false);
    }
  }, [data, buildRecords, createCampaign, createAdSet, createAd, toast, router]);

  // Final submit — creates Campaign → AdSet → Ad(s)
  const handleSubmit = useCallback(async () => {
    // Validate step 3 (ads) since step 4 is review-only
    const step3Errors = validateStep(3, data);
    if (Object.keys(step3Errors).length > 0) {
      setErrors(step3Errors);
      return;
    }

    setSubmitting(true);
    try {
      const { campaignPayload } = buildRecords(data.finalStatus);

      // 1. Create Campaign
      const campaign = await createCampaign(campaignPayload);
      if (!campaign || !campaign.id) throw new Error("Campaign creation failed");

      // 2. Create AdSet
      const adSetName = data.adSetName || `${data.campaignName} — קבוצה ראשית`;
      const adSet = await createAdSet({
        campaignId: campaign.id,
        name: adSetName,
        status: data.finalStatus === "draft" ? "draft" as const : "active" as const,
        ageMin: data.ageMin,
        ageMax: data.ageMax,
        genders: [data.gender as "male" | "female" | "all"],
        geoLocations: data.locations.map(l => l.city),
        interests: data.interests,
        customAudiences: [],
        excludedAudiences: data.excludedLocations,
        placements: [],
        dailyBudget: data.budgetType === "daily" ? (typeof data.budget === "number" ? data.budget : null) : null,
        lifetimeBudget: data.budgetType === "total" ? (typeof data.budget === "number" ? data.budget : null) : null,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        bidStrategy: null,
        bidAmount: null,
        notes: data.audienceNotes,
      });
      if (!adSet || !adSet.id) throw new Error("AdSet creation failed");

      // 3. Create Ads
      for (let i = 0; i < data.ads.length; i++) {
        const wizAd = data.ads[i];
        await createAd({
          adSetId: adSet.id,
          campaignId: campaign.id,
          name: wizAd.name || `${data.campaignName} — מודעה ${i + 1}`,
          status: data.finalStatus === "draft" ? "draft" as const : "active" as const,
          creativeType: (wizAd.adFormat === "carousel" ? "carousel" : wizAd.mediaType === "video" ? "video" : "image") as AdCreativeType,
          mediaUrl: wizAd.externalMediaUrl || "",
          thumbnailUrl: null,
          primaryText: wizAd.caption,
          headline: wizAd.headline,
          description: "",
          ctaType: wizAd.cta ? wizAd.cta.toUpperCase() : "",
          ctaLink: "",
          linkedVideoProjectId: null,
          linkedClientFileId: wizAd.linkedClientFileId,
          impressions: 0, clicks: 0, spend: 0, leads: 0, conversions: 0,
          ctr: 0, cpl: 0, cpc: 0, roas: 0,
          notes: "",
        });
      }

      toast(
        data.finalStatus === "draft"
          ? "קמפיין נשמר כטיוטה"
          : `קמפיין נוצר בהצלחה — ${data.ads.length} מודעות, קבוצה אחת`,
        "success"
      );
      router.push("/campaigns");
    } catch {
      toast("שגיאה ביצירת קמפיין", "error");
    } finally {
      setSubmitting(false);
    }
  }, [data, buildRecords, createCampaign, createAdSet, createAd, toast, router]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main
      style={{
        maxWidth: "820px",
        margin: "0 auto",
        padding: "2rem 1.5rem",
        direction: "rtl",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.5rem",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 800,
              color: "var(--foreground)",
              letterSpacing: "-0.02em",
            }}
          >
            🚀 בניית קמפיין חדש
          </h1>
          <p style={{ color: "var(--foreground-muted)", fontSize: "0.8rem", marginTop: "0.15rem" }}>
            קמפיין → קבוצת מודעות → מודעות → סיכום
          </p>
        </div>
        <Link
          href="/command-center"
          className="mod-btn-ghost"
          style={{
            padding: "0.4rem 0.75rem",
            fontSize: "0.75rem",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.3rem",
          }}
        >
          ← מרכז שליטה
        </Link>
      </div>

      {/* Stepper */}
      <StepIndicator current={step} />

      {/* Step content */}
      {step === 1 && (
        <Step1Basics
          data={data}
          onChange={handleChange}
          errors={errors}
          clients={clients}
          clientsLoading={clientsLoading}
          clientsError={clientsError}
        />
      )}
      {step === 2 && (
        <Step2AdSet
          data={data}
          onChange={handleChange}
          errors={errors}
          selectedClient={selectedClient}
          toast={toast}
        />
      )}
      {step === 3 && (
        <Step3Ads
          data={data}
          onChange={handleChange}
          errors={errors}
          clientFiles={clientFiles}
          selectedClient={selectedClient}
          refetchClientFiles={refetchClientFiles}
          createClientFile={createClientFile}
          toast={toast}
        />
      )}
      {step === 4 && (
        <Step4Review
          data={data}
          onChange={handleChange}
          selectedClient={selectedClient}
        />
      )}

      {/* Navigation buttons */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "1.5rem",
          paddingTop: "1rem",
          borderTop: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {step > 1 && (
            <button
              type="button"
              onClick={handleBack}
              className="mod-btn-ghost"
              style={{
                padding: "0.5rem 1.25rem",
                fontSize: "0.8rem",
                fontWeight: 600,
                borderRadius: "0.5rem",
                cursor: "pointer",
              }}
            >
              → הקודם
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          {/* Save draft at any step */}
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={submitting || !data.campaignName.trim()}
            className="mod-btn-ghost"
            style={{
              padding: "0.5rem 1.25rem",
              fontSize: "0.8rem",
              fontWeight: 600,
              borderRadius: "0.5rem",
              cursor: submitting ? "wait" : "pointer",
              opacity: submitting || !data.campaignName.trim() ? 0.5 : 1,
            }}
          >
            💾 שמור טיוטה
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              className="mod-btn-primary"
              style={{
                padding: "0.5rem 1.5rem",
                fontSize: "0.8rem",
                fontWeight: 600,
                borderRadius: "0.5rem",
                cursor: "pointer",
              }}
            >
              הבא ←
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="mod-btn-primary"
              style={{
                padding: "0.5rem 1.5rem",
                fontSize: "0.8rem",
                fontWeight: 700,
                borderRadius: "0.5rem",
                cursor: submitting ? "wait" : "pointer",
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? "שומר..." : "🚀 צור קמפיין"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
