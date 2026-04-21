"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  useClients,
  useCampaigns,
  useClientFiles,
} from "@/lib/api/use-entity";
import { useToast } from "@/components/ui/toast";
import type {
  CampaignType,
  CampaignStatus,
  CampaignPlatform,
  CampaignMediaType,
  Client,
  ClientFile,
} from "@/lib/db/schema";

// ── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { key: 1, label: "בסיס קמפיין", icon: "📋" },
  { key: 2, label: "קהל יעד", icon: "🎯" },
  { key: 3, label: "קריאייטיב", icon: "🎨" },
  { key: 4, label: "תקציב והפעלה", icon: "💰" },
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

// ── Wizard State Types ───────────────────────────────────────────────────────

interface WizardData {
  // Step 1 — basics
  campaignName: string;
  clientId: string;
  platform: CampaignPlatform;
  campaignType: CampaignType;
  startDate: string;
  endDate: string;
  // Step 2 — audience
  location: string;
  ageMin: number;
  ageMax: number;
  gender: string;
  interests: string;
  audienceNotes: string;
  // Step 3 — creative
  mediaType: CampaignMediaType;
  adFormat: string;
  linkedClientFileId: string | null;
  externalMediaUrl: string;
  caption: string;
  headline: string;
  cta: string;
  // Step 4 — budget
  budgetType: "daily" | "total";
  budget: number | "";
  finalStatus: CampaignStatus;
}

const INITIAL_DATA: WizardData = {
  campaignName: "",
  clientId: "",
  platform: "facebook",
  campaignType: "lead_gen",
  startDate: "",
  endDate: "",
  location: "",
  ageMin: 18,
  ageMax: 65,
  gender: "all",
  interests: "",
  audienceNotes: "",
  mediaType: "image",
  adFormat: "single",
  linkedClientFileId: null,
  externalMediaUrl: "",
  caption: "",
  headline: "",
  cta: "",
  budgetType: "daily",
  budget: "",
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

  if (step === 3) {
    if (!data.caption.trim()) errors.caption = "חובה להזין טקסט ראשי";
  }

  if (step === 4) {
    if (data.budget === "" || data.budget <= 0) errors.budget = "חובה להזין תקציב תקין";
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

function Step2Audience({
  data,
  onChange,
  selectedClient,
}: {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
  errors: StepErrors;
  selectedClient: Client | undefined;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* AI suggestion placeholder */}
      <div
        style={{
          padding: "1rem 1.25rem",
          background: "rgba(139,92,246,0.06)",
          border: "1px solid rgba(139,92,246,0.2)",
          borderRadius: "0.75rem",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
        }}
      >
        <span style={{ fontSize: "1.25rem" }}>🤖</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "0.825rem", fontWeight: 700, color: "#8b5cf6", marginBottom: "0.15rem" }}>
            הצעת AI לקהל יעד
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--foreground-muted)", lineHeight: 1.5 }}>
            {selectedClient
              ? `על בסיס נתוני הלקוח "${selectedClient.name}" — תחום: ${selectedClient.businessField || "לא הוגדר"}. הצעת AI תהיה זמינה בגרסה הבאה.`
              : "בחר לקוח בשלב 1 כדי לקבל הצעות AI מותאמות לקהל יעד"}
          </div>
        </div>
        <span
          style={{
            fontSize: "0.65rem",
            fontWeight: 700,
            background: "rgba(139,92,246,0.12)",
            color: "#8b5cf6",
            padding: "0.2rem 0.5rem",
            borderRadius: "0.25rem",
          }}
        >
          בקרוב
        </span>
      </div>

      <div className="premium-card" style={{ padding: "1.25rem" }}>
        <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--foreground)", marginBottom: "1rem" }}>
          הגדרת קהל יעד
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Location */}
          <div>
            <FieldLabel label="מיקום גאוגרפי" />
            <input
              type="text"
              value={data.location}
              onChange={(e) => onChange({ location: e.target.value })}
              placeholder="לדוגמה: ישראל, תל אביב, גוש דן"
              style={inputStyle}
            />
          </div>

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

          {/* Interests */}
          <div>
            <FieldLabel label="תחומי עניין" />
            <textarea
              value={data.interests}
              onChange={(e) => onChange({ interests: e.target.value })}
              placeholder="לדוגמה: כושר, תזונה, אורח חיים בריא, יוגה..."
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          {/* Manual notes */}
          <div>
            <FieldLabel label="הערות טרגוט נוספות" />
            <textarea
              value={data.audienceNotes}
              onChange={(e) => onChange({ audienceNotes: e.target.value })}
              placeholder="הערות חופשיות — Lookalike, Custom Audience, Exclude..."
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>
        </div>
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
    </div>
  );
}

function Step3Creative({
  data,
  onChange,
  errors,
  clientFiles,
}: {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
  errors: StepErrors;
  clientFiles: ClientFile[];
}) {
  const relevantFiles = clientFiles.filter(
    (f) => f.fileType === "image" || f.fileType === "video"
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div className="premium-card" style={{ padding: "1.25rem" }}>
        <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--foreground)", marginBottom: "1rem" }}>
          מדיה וקריאייטיב
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Media type */}
          <div>
            <FieldLabel label="סוג מדיה" />
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => onChange({ mediaType: "image" })}
                className={data.mediaType === "image" ? "mod-btn-primary" : "mod-btn-ghost"}
                style={{ padding: "0.4rem 0.875rem", fontSize: "0.75rem", fontWeight: 600, borderRadius: "0.375rem", cursor: "pointer" }}
              >
                🖼️ תמונה
              </button>
              <button
                type="button"
                onClick={() => onChange({ mediaType: "video" })}
                className={data.mediaType === "video" ? "mod-btn-primary" : "mod-btn-ghost"}
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
                  onClick={() => onChange({ adFormat: opt.value })}
                  className={data.adFormat === opt.value ? "mod-btn-primary" : "mod-btn-ghost"}
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
                value={data.linkedClientFileId || ""}
                onChange={(e) =>
                  onChange({
                    linkedClientFileId: e.target.value || null,
                  })
                }
                style={selectStyle}
              >
                <option value="">— בחר קובץ קיים —</option>
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
                  ? "אין קבצי תמונה/וידאו ללקוח זה"
                  : "בחר לקוח כדי לראות קבצים קיימים"}
              </div>
            )}
          </div>

          {/* Or external URL */}
          <div>
            <FieldLabel label="או — קישור חיצוני למדיה" />
            <input
              type="url"
              value={data.externalMediaUrl}
              onChange={(e) => onChange({ externalMediaUrl: e.target.value })}
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
              value={data.caption}
              onChange={(e) => onChange({ caption: e.target.value })}
              placeholder="הטקסט הראשי של המודעה..."
              rows={4}
              style={{
                ...inputStyle,
                resize: "vertical",
                ...(errors.caption ? { borderColor: "#ef4444" } : {}),
              }}
            />
            <FieldError error={errors.caption} />
            <div style={{ fontSize: "0.65rem", color: "var(--foreground-muted)", marginTop: "0.2rem", textAlign: "left", direction: "ltr" }}>
              {data.caption.length} / 500
            </div>
          </div>

          {/* Headline */}
          <div>
            <FieldLabel label="כותרת (Headline)" />
            <input
              type="text"
              value={data.headline}
              onChange={(e) => onChange({ headline: e.target.value })}
              placeholder="כותרת קצרה ומושכת"
              style={inputStyle}
            />
          </div>

          {/* CTA */}
          <div>
            <FieldLabel label="כפתור CTA" />
            <select
              value={data.cta}
              onChange={(e) => onChange({ cta: e.target.value })}
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

function Step4Budget({
  data,
  onChange,
  errors,
}: {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
  errors: StepErrors;
}) {
  const budgetNum = typeof data.budget === "number" ? data.budget : 0;
  const days = data.startDate && data.endDate
    ? Math.max(1, Math.ceil((new Date(data.endDate).getTime() - new Date(data.startDate).getTime()) / 86400000))
    : 30;
  const totalBudget = data.budgetType === "daily" ? budgetNum * days : budgetNum;
  const dailyBudget = data.budgetType === "total" ? (days > 0 ? budgetNum / days : 0) : budgetNum;

  // Mock calculation
  const estimatedLeads = dailyBudget > 0 ? Math.round((totalBudget / (dailyBudget > 50 ? 25 : 40))) : 0;
  const estimatedCPL = estimatedLeads > 0 ? totalBudget / estimatedLeads : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div className="premium-card" style={{ padding: "1.25rem" }}>
        <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--foreground)", marginBottom: "1rem" }}>
          תקציב
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Budget type toggle */}
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

          {/* Budget input */}
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
        </div>
      </div>

      {/* Mock estimates */}
      {budgetNum > 0 && (
        <div className="premium-card" style={{ padding: "1.25rem" }}>
          <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--foreground)", marginBottom: "1rem" }}>
            📊 תחזית (אומדן)
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "0.75rem",
            }}
          >
            <div style={{ textAlign: "center", padding: "0.75rem", background: "var(--surface-raised)", borderRadius: "0.5rem", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#22c55e" }}>
                ₪{Math.round(totalBudget).toLocaleString()}
              </div>
              <div style={{ fontSize: "0.65rem", color: "var(--foreground-muted)", fontWeight: 600, marginTop: "0.2rem" }}>תקציב כולל</div>
            </div>
            <div style={{ textAlign: "center", padding: "0.75rem", background: "var(--surface-raised)", borderRadius: "0.5rem", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#3b82f6" }}>
                ₪{Math.round(dailyBudget).toLocaleString()}
              </div>
              <div style={{ fontSize: "0.65rem", color: "var(--foreground-muted)", fontWeight: 600, marginTop: "0.2rem" }}>יומי</div>
            </div>
            <div style={{ textAlign: "center", padding: "0.75rem", background: "var(--surface-raised)", borderRadius: "0.5rem", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#a78bfa" }}>
                ~{estimatedLeads}
              </div>
              <div style={{ fontSize: "0.65rem", color: "var(--foreground-muted)", fontWeight: 600, marginTop: "0.2rem" }}>לידים צפויים</div>
            </div>
            <div style={{ textAlign: "center", padding: "0.75rem", background: "var(--surface-raised)", borderRadius: "0.5rem", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#f59e0b" }}>
                ₪{Math.round(estimatedCPL)}
              </div>
              <div style={{ fontSize: "0.65rem", color: "var(--foreground-muted)", fontWeight: 600, marginTop: "0.2rem" }}>עלות לליד צפויה</div>
            </div>
          </div>

          <div
            style={{
              fontSize: "0.65rem",
              color: "var(--foreground-muted)",
              textAlign: "center",
              marginTop: "0.75rem",
              opacity: 0.6,
            }}
          >
            * אומדן בלבד — תוצאות בפועל תלויות בקהל, קריאייטיב ותחרות
          </div>
        </div>
      )}

      {/* Platform breakdown mock */}
      <div className="premium-card" style={{ padding: "1.25rem" }}>
        <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--foreground)", marginBottom: "1rem" }}>
          חלוקת פלטפורמה
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "1.25rem" }}>
            {PLATFORM_OPTIONS.find((p) => p.value === data.platform)?.icon || "📱"}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--foreground)" }}>
              {PLATFORM_OPTIONS.find((p) => p.value === data.platform)?.label || data.platform}
            </div>
            <div
              style={{
                width: "100%",
                height: "6px",
                borderRadius: "3px",
                background: "var(--surface)",
                overflow: "hidden",
                marginTop: "0.35rem",
              }}
            >
              <div style={{ width: "100%", height: "100%", borderRadius: "3px", background: "var(--accent)" }} />
            </div>
          </div>
          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--foreground)" }}>100%</span>
        </div>
      </div>

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
              flex: 1,
              padding: "1rem",
              borderRadius: "0.5rem",
              border: `2px solid ${data.finalStatus === "draft" ? "#6b7280" : "var(--border)"}`,
              background: data.finalStatus === "draft" ? "rgba(107,114,128,0.08)" : "var(--surface-raised)",
              cursor: "pointer",
              textAlign: "center",
              transition: "all 150ms",
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
              flex: 1,
              padding: "1rem",
              borderRadius: "0.5rem",
              border: `2px solid ${data.finalStatus === "waiting_approval" ? "#22c55e" : "var(--border)"}`,
              background: data.finalStatus === "waiting_approval" ? "rgba(34,197,94,0.08)" : "var(--surface-raised)",
              cursor: "pointer",
              textAlign: "center",
              transition: "all 150ms",
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
  const { data: allClientFiles } = useClientFiles();

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
    // Clear errors for changed fields
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

  // Save as draft
  const handleSaveDraft = useCallback(async () => {
    setSubmitting(true);
    try {
      const clientName = selectedClient?.name || "";
      await createCampaign({
        campaignName: data.campaignName || "טיוטה חדשה",
        clientId: data.clientId,
        clientName,
        campaignType: data.campaignType,
        objective: [
          data.location && `מיקום: ${data.location}`,
          data.interests && `עניינים: ${data.interests}`,
          data.audienceNotes,
        ].filter(Boolean).join(" | ") || "",
        platform: data.platform,
        status: "draft" as CampaignStatus,
        mediaType: data.mediaType,
        budget: typeof data.budget === "number" ? data.budget : 0,
        caption: data.caption,
        notes: [
          data.headline && `כותרת: ${data.headline}`,
          data.cta && `CTA: ${data.cta}`,
          data.adFormat && `פורמט: ${data.adFormat}`,
          `קהל: ${data.gender}, ${data.ageMin}-${data.ageMax}`,
          data.budgetType === "daily" ? "תקציב יומי" : "תקציב כולל",
        ].filter(Boolean).join(" | "),
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        linkedVideoProjectId: null,
        linkedClientFileId: data.linkedClientFileId,
        externalMediaUrl: data.externalMediaUrl,
        adAccountId: "",
        leadFormIds: [],
      });
      toast("טיוטה נשמרה בהצלחה", "success");
      router.push("/campaigns");
    } catch {
      toast("שגיאה בשמירת טיוטה", "error");
    } finally {
      setSubmitting(false);
    }
  }, [data, selectedClient, createCampaign, toast, router]);

  // Final submit
  const handleSubmit = useCallback(async () => {
    const stepErrors = validateStep(4, data);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }

    setSubmitting(true);
    try {
      const clientName = selectedClient?.name || "";
      await createCampaign({
        campaignName: data.campaignName,
        clientId: data.clientId,
        clientName,
        campaignType: data.campaignType,
        objective: [
          data.location && `מיקום: ${data.location}`,
          data.interests && `עניינים: ${data.interests}`,
          data.audienceNotes,
        ].filter(Boolean).join(" | ") || "",
        platform: data.platform,
        status: data.finalStatus,
        mediaType: data.mediaType,
        budget: typeof data.budget === "number" ? data.budget : 0,
        caption: data.caption,
        notes: [
          data.headline && `כותרת: ${data.headline}`,
          data.cta && `CTA: ${data.cta}`,
          data.adFormat && `פורמט: ${data.adFormat}`,
          `קהל: ${data.gender}, ${data.ageMin}-${data.ageMax}`,
          data.budgetType === "daily" ? "תקציב יומי" : "תקציב כולל",
        ].filter(Boolean).join(" | "),
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        linkedVideoProjectId: null,
        linkedClientFileId: data.linkedClientFileId,
        externalMediaUrl: data.externalMediaUrl,
        adAccountId: "",
        leadFormIds: [],
      });
      toast(
        data.finalStatus === "draft"
          ? "קמפיין נשמר כטיוטה"
          : "קמפיין נוצר בהצלחה — ממתין לאישור",
        "success"
      );
      router.push("/campaigns");
    } catch {
      toast("שגיאה ביצירת קמפיין", "error");
    } finally {
      setSubmitting(false);
    }
  }, [data, selectedClient, createCampaign, toast, router]);

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
            4 שלבים ליצירת קמפיין מושלם
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
        <Step2Audience
          data={data}
          onChange={handleChange}
          errors={errors}
          selectedClient={selectedClient}
        />
      )}
      {step === 3 && (
        <Step3Creative
          data={data}
          onChange={handleChange}
          errors={errors}
          clientFiles={clientFiles}
        />
      )}
      {step === 4 && (
        <Step4Budget
          data={data}
          onChange={handleChange}
          errors={errors}
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
