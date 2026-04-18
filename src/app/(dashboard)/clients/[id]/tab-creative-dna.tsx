"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/toast";
import type { Client, Employee, CreativeDNA } from "@/lib/db/schema";

interface TabCreativeDNAProps {
  client: Client;
  employees: Employee[];
}

export default function TabCreativeDNA({ client, employees }: TabCreativeDNAProps) {
  const toast = useToast();
  const [dna, setDna] = useState<CreativeDNA | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Partial<CreativeDNA>>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Load existing DNA — auto-generate if research exists but DNA doesn't
  useEffect(() => {
    let cancelled = false;

    const fetchDNA = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/ai/creative-dna?clientId=${client.id}`);
        if (res.ok) {
          const result = await res.json();
          if (!cancelled) setDna(result.data ?? null);
        } else {
          if (!cancelled) setDna(null);

          // DNA doesn't exist — check if research exists, and if so auto-generate
          try {
            const researchRes = await fetch(`/api/ai/client-research?clientId=${client.id}`);
            if (researchRes.ok && !cancelled) {
              console.log(`[CreativeDNA] No DNA but research exists for ${client.id} — auto-generating`);
              setIsGenerating(true);
              const genRes = await fetch("/api/ai/creative-dna", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  clientId: client.id,
                  clientData: {
                    name: client.name,
                    businessField: client.businessField,
                    clientType: client.clientType,
                    brandVoice: client.keyMarketingMessages,
                    targetAudience: client.marketingGoals,
                    keyMarketingMessages: client.keyMarketingMessages,
                    platforms: ["facebook", "instagram", "tiktok"],
                  },
                }),
              });
              if (genRes.ok && !cancelled) {
                const genResult = await genRes.json();
                setDna(genResult.data ?? null);
                console.log(`[CreativeDNA] Auto-generated DNA for ${client.id}`);
              }
              if (!cancelled) setIsGenerating(false);
            }
          } catch (autoErr) {
            console.warn('[CreativeDNA] Auto-generation check failed:', autoErr);
            if (!cancelled) setIsGenerating(false);
          }
        }
      } catch (error) {
        console.error("Failed to fetch creative DNA:", error);
        if (!cancelled) toast("שגיאה בטעינת DNA יצירתי", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchDNA();
    return () => { cancelled = true; };
  }, [client.id, client.name, client.businessField, client.clientType, client.keyMarketingMessages, client.marketingGoals, toast]);

  // Generate or regenerate DNA
  const handleGenerateDNA = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/ai/creative-dna", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          clientData: {
            name: client.name,
            businessField: client.businessField,
            clientType: client.clientType,
            brandVoice: client.keyMarketingMessages,
            targetAudience: client.marketingGoals,
            keyMarketingMessages: client.keyMarketingMessages,
            platforms: ["facebook", "instagram", "tiktok"],
          },
        }),
      });

      if (res.ok) {
        const result = await res.json();
        setDna(result.data);
        toast("DNA יצירתי נוצר בהצלחה", "success");
        setIsEditMode(false);
      } else {
        const error = await res.json();
        toast(error.error || "שגיאה בהנרשם DNA", "error");
      }
    } catch (error) {
      console.error("Error generating DNA:", error);
      toast("שגיאה בהנרשם DNA", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  // Enter edit mode
  const handleEditClick = () => {
    if (dna) {
      setEditForm(dna);
      setIsEditMode(true);
    }
  };

  // Save edits
  const handleSaveEdits = async () => {
    if (!dna) return;

    setIsSavingEdit(true);
    try {
      const res = await fetch("/api/ai/creative-dna", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          updates: editForm,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        setDna(result.data);
        toast("DNA יצירתי עודכן בהצלחה", "success");
        setIsEditMode(false);
      } else {
        const error = await res.json();
        toast(error.error || "שגיאה בעדכון DNA", "error");
      }
    } catch (error) {
      console.error("Error saving DNA:", error);
      toast("שגיאה בעדכון DNA", "error");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditForm({});
  };

  // Helper: render tag input
  const TagInput = ({
    value,
    onChange,
    label,
  }: {
    value: string[];
    onChange: (newValue: string[]) => void;
    label: string;
  }) => {
    const [inputValue, setInputValue] = useState("");

    const handleAddTag = () => {
      if (inputValue.trim() && !value.includes(inputValue.trim())) {
        onChange([...value, inputValue.trim()]);
        setInputValue("");
      }
    };

    const handleRemoveTag = (tag: string) => {
      onChange(value.filter((t) => t !== tag));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddTag();
      }
    };

    return (
      <div style={{ marginBottom: "1.5rem" }}>
        <label
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "var(--foreground)",
          }}
        >
          {label}
        </label>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
            marginBottom: "0.5rem",
          }}
        >
          {value.map((tag) => (
            <div
              key={tag}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                backgroundColor: "var(--surface-raised)",
                border: "1px solid var(--border)",
                borderRadius: "0.375rem",
                padding: "0.375rem 0.75rem",
                fontSize: "0.875rem",
              }}
            >
              <span>{tag}</span>
              <button
                onClick={() => handleRemoveTag(tag)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "0",
                  color: "var(--foreground-muted)",
                  fontSize: "1rem",
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`הוסף ${label}...`}
            className="form-input"
            style={{
              flex: 1,
              padding: "0.5rem 0.75rem",
              fontSize: "0.875rem",
            }}
          />
          <button
            onClick={handleAddTag}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "var(--accent)",
              color: "white",
              border: "none",
              borderRadius: "0.375rem",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: 600,
            }}
          >
            הוסף
          </button>
        </div>
      </div>
    );
  };

  // Helper: render color swatch
  const ColorSwatch = ({
    color,
    label,
  }: {
    color: string;
    label?: string;
  }) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.5rem",
      }}
    >
      <div
        style={{
          width: "3rem",
          height: "3rem",
          backgroundColor: color,
          border: "2px solid var(--border)",
          borderRadius: "0.5rem",
        }}
      />
      {label && (
        <span
          style={{
            fontSize: "0.75rem",
            color: "var(--foreground-muted)",
            textAlign: "center",
          }}
        >
          {label}
        </span>
      )}
    </div>
  );

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "20rem",
          color: "var(--foreground-muted)",
        }}
      >
        טוען DNA יצירתי...
      </div>
    );
  }

  // No DNA exists yet
  if (!dna && !isEditMode) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        {/* Big CTA Card */}
        <div
          style={{
            backgroundColor: "var(--surface-raised)",
            border: "2px solid var(--border)",
            borderRadius: "1rem",
            padding: "3rem 2rem",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🧬</div>
          <h3
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              marginBottom: "0.5rem",
              color: "var(--foreground)",
            }}
          >
            עדיין לא נוצר DNA יצירתי
          </h3>
          <p
            style={{
              color: "var(--foreground-muted)",
              marginBottom: "2rem",
              fontSize: "0.95rem",
            }}
          >
            DNA יצירתי הוא המוח של כל טעם ויצירתיות של המותג שלך. הוא מגדיר את הטון, הסגנון, ודפוסי התוכן.
          </p>
          <button
            onClick={handleGenerateDNA}
            disabled={isGenerating}
            style={{
              padding: "0.875rem 2rem",
              background: isGenerating
                ? "var(--foreground-muted)"
                : "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
              color: "white",
              border: "none",
              borderRadius: "0.5rem",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: isGenerating ? "not-allowed" : "pointer",
              opacity: isGenerating ? 0.6 : 1,
            }}
          >
            {isGenerating ? "יוצר DNA..." : "צור DNA יצירתי"}
          </button>
        </div>
      </div>
    );
  }

  // DNA exists - view or edit mode
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Action Buttons */}
      <div style={{ display: "flex", gap: "1rem" }}>
        {!isEditMode && dna && (
          <>
            <button
              onClick={handleEditClick}
              style={{
                padding: "0.625rem 1.125rem",
                backgroundColor: "var(--surface-raised)",
                border: "1px solid var(--border)",
                borderRadius: "0.375rem",
                color: "var(--foreground)",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ✏️ ערוך DNA
            </button>
            <button
              onClick={handleGenerateDNA}
              disabled={isGenerating}
              style={{
                padding: "0.625rem 1.125rem",
                background: isGenerating
                  ? "var(--foreground-muted)"
                  : "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
                color: "white",
                border: "none",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: isGenerating ? "not-allowed" : "pointer",
                opacity: isGenerating ? 0.6 : 1,
              }}
            >
              {isGenerating ? "חדש DNA..." : "🔄 חדש DNA"}
            </button>
          </>
        )}
      </div>

      {/* Edit Mode */}
      {isEditMode && (
        <div
          style={{
            backgroundColor: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "1rem",
            padding: "2rem",
          }}
        >
          <h3
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              marginBottom: "1.5rem",
              color: "var(--foreground)",
            }}
          >
            עריכת DNA יצירתי
          </h3>

          {/* Text Fields */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Tone of Voice */}
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "var(--foreground)",
                }}
              >
                טון הקול (Tone of Voice)
              </label>
              <textarea
                value={(editForm.toneOfVoice as string) || ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, toneOfVoice: e.target.value })
                }
                className="form-input"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  fontSize: "0.875rem",
                  minHeight: "4rem",
                  fontFamily: "inherit",
                }}
              />
            </div>

            {/* Selling Style */}
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "var(--foreground)",
                }}
              >
                סגנון מכירה (Selling Style)
              </label>
              <input
                type="text"
                value={(editForm.sellingStyle as string) || ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, sellingStyle: e.target.value })
                }
                className="form-input"
                style={{ width: "100%", padding: "0.75rem", fontSize: "0.875rem" }}
              />
            </div>

            {/* Visual Style */}
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "var(--foreground)",
                }}
              >
                סגנון ויזואלי (Visual Style)
              </label>
              <textarea
                value={(editForm.visualStyle as string) || ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, visualStyle: e.target.value })
                }
                className="form-input"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  fontSize: "0.875rem",
                  minHeight: "3rem",
                  fontFamily: "inherit",
                }}
              />
            </div>

            {/* Audience Style */}
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "var(--foreground)",
                }}
              >
                סגנון פנייה לקהל (Audience Style)
              </label>
              <textarea
                value={(editForm.audienceStyle as string) || ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, audienceStyle: e.target.value })
                }
                className="form-input"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  fontSize: "0.875rem",
                  minHeight: "3rem",
                  fontFamily: "inherit",
                }}
              />
            </div>

            {/* Hashtag Strategy */}
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "var(--foreground)",
                }}
              >
                אסטרטגיית Hashtag
              </label>
              <input
                type="text"
                value={(editForm.hashtagStrategy as string) || ""}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    hashtagStrategy: e.target.value,
                  })
                }
                className="form-input"
                style={{ width: "100%", padding: "0.75rem", fontSize: "0.875rem" }}
              />
            </div>

            {/* Photography Style */}
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "var(--foreground)",
                }}
              >
                סגנון צילום (Photography Style)
              </label>
              <textarea
                value={(editForm.photographyStyle as string) || ""}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    photographyStyle: e.target.value,
                  })
                }
                className="form-input"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  fontSize: "0.875rem",
                  minHeight: "3rem",
                  fontFamily: "inherit",
                }}
              />
            </div>

            {/* Graphic Style */}
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "var(--foreground)",
                }}
              >
                סגנון גרפי (Graphic Style)
              </label>
              <textarea
                value={(editForm.graphicStyle as string) || ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, graphicStyle: e.target.value })
                }
                className="form-input"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  fontSize: "0.875rem",
                  minHeight: "3rem",
                  fontFamily: "inherit",
                }}
              />
            </div>

            {/* Arrays */}
            <TagInput
              value={(editForm.hookTypes as string[]) || []}
              onChange={(val) => setEditForm({ ...editForm, hookTypes: val })}
              label="סוגי Hook"
            />
            <TagInput
              value={(editForm.contentTypes as string[]) || []}
              onChange={(val) => setEditForm({ ...editForm, contentTypes: val })}
              label="סוגי תוכן"
            />
            <TagInput
              value={(editForm.doNotUsePatterns as string[]) || []}
              onChange={(val) =>
                setEditForm({ ...editForm, doNotUsePatterns: val })
              }
              label="דפוסים שלא לעשות"
            />
            <TagInput
              value={(editForm.preferredEmojis as string[]) || []}
              onChange={(val) =>
                setEditForm({ ...editForm, preferredEmojis: val })
              }
              label="Emojis מעדיפים"
            />
            <TagInput
              value={(editForm.colorPalette as string[]) || []}
              onChange={(val) => setEditForm({ ...editForm, colorPalette: val })}
              label="צבעים (hex codes)"
            />

            {/* Save/Cancel */}
            <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
              <button
                onClick={handleSaveEdits}
                disabled={isSavingEdit}
                className="mod-btn-primary"
                style={{
                  padding: "0.625rem 1.125rem",
                  background: isSavingEdit
                    ? "var(--foreground-muted)"
                    : "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "0.375rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  cursor: isSavingEdit ? "not-allowed" : "pointer",
                  opacity: isSavingEdit ? 0.6 : 1,
                }}
              >
                {isSavingEdit ? "שומר..." : "💾 שמור שינויים"}
              </button>
              <button
                onClick={handleCancelEdit}
                style={{
                  padding: "0.625rem 1.125rem",
                  backgroundColor: "var(--surface-raised)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.375rem",
                  color: "var(--foreground)",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Mode - Summary Cards */}
      {!isEditMode && dna && (
        <>
          {/* Core Brand Identity Section */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <h3
              style={{
                fontSize: "1.125rem",
                fontWeight: 700,
                color: "var(--foreground)",
              }}
            >
              🎯 זהות יצירתית ייסודית
            </h3>

            {/* Tone of Voice Card */}
            <div
              style={{
                backgroundColor: "var(--surface-raised)",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                padding: "1.5rem",
              }}
            >
              <h4
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  color: "var(--foreground-muted)",
                  marginBottom: "0.5rem",
                  textTransform: "uppercase",
                }}
              >
                טון הקול
              </h4>
              <p
                style={{
                  color: "var(--foreground)",
                  fontSize: "1rem",
                  margin: 0,
                }}
              >
                {dna.toneOfVoice}
              </p>
            </div>

            {/* Selling Style Card */}
            <div
              style={{
                backgroundColor: "var(--surface-raised)",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                padding: "1.5rem",
              }}
            >
              <h4
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  color: "var(--foreground-muted)",
                  marginBottom: "0.5rem",
                  textTransform: "uppercase",
                }}
              >
                סגנון מכירה
              </h4>
              <p
                style={{
                  color: "var(--foreground)",
                  fontSize: "1rem",
                  margin: 0,
                }}
              >
                {dna.sellingStyle}
              </p>
            </div>

            {/* Visual Style Card */}
            <div
              style={{
                backgroundColor: "var(--surface-raised)",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                padding: "1.5rem",
              }}
            >
              <h4
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  color: "var(--foreground-muted)",
                  marginBottom: "0.5rem",
                  textTransform: "uppercase",
                }}
              >
                סגנון ויזואלי
              </h4>
              <p
                style={{
                  color: "var(--foreground)",
                  fontSize: "1rem",
                  margin: 0,
                }}
              >
                {dna.visualStyle}
              </p>
            </div>
          </div>

          {/* Content Patterns Section */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <h3
              style={{
                fontSize: "1.125rem",
                fontWeight: 700,
                color: "var(--foreground)",
              }}
            >
              📝 דפוסי תוכן
            </h3>

            {/* Hook Types */}
            <div
              style={{
                backgroundColor: "var(--surface-raised)",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                padding: "1.5rem",
              }}
            >
              <h4
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  color: "var(--foreground-muted)",
                  marginBottom: "0.75rem",
                  textTransform: "uppercase",
                }}
              >
                סוגי Hook
              </h4>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {dna.hookTypes.map((hook) => (
                  <span
                    key={hook}
                    style={{
                      display: "inline-block",
                      backgroundColor: "var(--accent)",
                      color: "white",
                      padding: "0.375rem 0.75rem",
                      borderRadius: "0.25rem",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                    }}
                  >
                    {hook}
                  </span>
                ))}
              </div>
            </div>

            {/* Content Types */}
            <div
              style={{
                backgroundColor: "var(--surface-raised)",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                padding: "1.5rem",
              }}
            >
              <h4
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  color: "var(--foreground-muted)",
                  marginBottom: "0.75rem",
                  textTransform: "uppercase",
                }}
              >
                סוגי תוכן מאושרים
              </h4>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {dna.contentTypes.map((type) => (
                  <span
                    key={type}
                    style={{
                      display: "inline-block",
                      backgroundColor: "var(--accent)",
                      color: "white",
                      padding: "0.375rem 0.75rem",
                      borderRadius: "0.25rem",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                    }}
                  >
                    {type}
                  </span>
                ))}
              </div>
            </div>

            {/* Audience Style */}
            <div
              style={{
                backgroundColor: "var(--surface-raised)",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                padding: "1.5rem",
              }}
            >
              <h4
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  color: "var(--foreground-muted)",
                  marginBottom: "0.5rem",
                  textTransform: "uppercase",
                }}
              >
                סגנון פנייה לקהל
              </h4>
              <p
                style={{
                  color: "var(--foreground)",
                  fontSize: "0.95rem",
                  margin: 0,
                }}
              >
                {dna.audienceStyle}
              </p>
            </div>
          </div>

          {/* Restrictions Section */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <h3
              style={{
                fontSize: "1.125rem",
                fontWeight: 700,
                color: "var(--foreground)",
              }}
            >
              ⛔ הגבלות יצירתיות
            </h3>

            {/* Do Not Use Patterns */}
            <div
              style={{
                backgroundColor: "#1a1a1a",
                border: "1px solid #ef4444",
                borderRadius: "0.75rem",
                padding: "1.5rem",
              }}
            >
              <h4
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  color: "#ef4444",
                  marginBottom: "0.75rem",
                  textTransform: "uppercase",
                }}
              >
                דפוסים שלא לעשות
              </h4>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {dna.doNotUsePatterns.map((pattern) => (
                  <span
                    key={pattern}
                    style={{
                      display: "inline-block",
                      backgroundColor: "#ef4444",
                      color: "white",
                      padding: "0.375rem 0.75rem",
                      borderRadius: "0.25rem",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                    }}
                  >
                    {pattern}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Branding Section */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <h3
              style={{
                fontSize: "1.125rem",
                fontWeight: 700,
                color: "var(--foreground)",
              }}
            >
              🎨 מיתוג וויזואל
            </h3>

            {/* Color Palette */}
            <div
              style={{
                backgroundColor: "var(--surface-raised)",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                padding: "1.5rem",
              }}
            >
              <h4
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  color: "var(--foreground-muted)",
                  marginBottom: "1rem",
                  textTransform: "uppercase",
                }}
              >
                팔레ט צבעים
              </h4>
              <div
                style={{
                  display: "flex",
                  gap: "2rem",
                  flexWrap: "wrap",
                }}
              >
                {dna.colorPalette.map((color) => (
                  <ColorSwatch key={color} color={color} label={color} />
                ))}
              </div>
            </div>

            {/* Photography Style */}
            <div
              style={{
                backgroundColor: "var(--surface-raised)",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                padding: "1.5rem",
              }}
            >
              <h4
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  color: "var(--foreground-muted)",
                  marginBottom: "0.5rem",
                  textTransform: "uppercase",
                }}
              >
                סגנון צילום
              </h4>
              <p
                style={{
                  color: "var(--foreground)",
                  fontSize: "0.95rem",
                  margin: 0,
                }}
              >
                {dna.photographyStyle}
              </p>
            </div>

            {/* Graphic Style */}
            <div
              style={{
                backgroundColor: "var(--surface-raised)",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                padding: "1.5rem",
              }}
            >
              <h4
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  color: "var(--foreground-muted)",
                  marginBottom: "0.5rem",
                  textTransform: "uppercase",
                }}
              >
                סגנון גרפי
              </h4>
              <p
                style={{
                  color: "var(--foreground)",
                  fontSize: "0.95rem",
                  margin: 0,
                }}
              >
                {dna.graphicStyle}
              </p>
            </div>
          </div>

          {/* Branding Elements Section */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <h3
              style={{
                fontSize: "1.125rem",
                fontWeight: 700,
                color: "var(--foreground)",
              }}
            >
              💎 אלמנטים תגיים
            </h3>

            {/* Preferred Emojis */}
            <div
              style={{
                backgroundColor: "var(--surface-raised)",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                padding: "1.5rem",
              }}
            >
              <h4
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  color: "var(--foreground-muted)",
                  marginBottom: "0.75rem",
                  textTransform: "uppercase",
                }}
              >
                Emojis מעדיפים
              </h4>
              <div
                style={{
                  display: "flex",
                  gap: "1rem",
                  fontSize: "2rem",
                  flexWrap: "wrap",
                }}
              >
                {dna.preferredEmojis.map((emoji) => (
                  <span key={emoji}>{emoji}</span>
                ))}
              </div>
            </div>

            {/* Hashtag Strategy */}
            <div
              style={{
                backgroundColor: "var(--surface-raised)",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                padding: "1.5rem",
              }}
            >
              <h4
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  color: "var(--foreground-muted)",
                  marginBottom: "0.5rem",
                  textTransform: "uppercase",
                }}
              >
                אסטרטגיית Hashtag
              </h4>
              <p
                style={{
                  color: "var(--foreground)",
                  fontSize: "0.95rem",
                  margin: 0,
                }}
              >
                {dna.hashtagStrategy}
              </p>
            </div>
          </div>

          {/* Meta Information */}
          <div
            style={{
              backgroundColor: "var(--surface-raised)",
              border: "1px solid var(--border)",
              borderRadius: "0.75rem",
              padding: "1rem",
              fontSize: "0.75rem",
              color: "var(--foreground-muted)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <p style={{ margin: "0.25rem 0" }}>
                נוצר על ידי: {dna.generatedBy === "ai" ? "🤖 AI" : "✏️ ידני"}
              </p>
              <p style={{ margin: "0.25rem 0" }}>
                עודכן: {new Date(dna.updatedAt).toLocaleDateString("he-IL")}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
