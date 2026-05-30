"use client";

import { useState, useCallback } from "react";
import type { Client } from "@/lib/db/schema";
import { useToast } from "@/components/ui/toast";
import PostPreview from "@/components/meta/post-preview";

/* ── Types ── */

interface FacebookPage {
  id: string;
  name: string;
  accessToken: string;
  pictureUrl: string;
  fanCount: number;
  category: string;
}

/* ── Helpers ── */

function getRoleHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const role = localStorage.getItem("app_role") || "admin";
  const clientId = localStorage.getItem("app_client_id") || "";
  const employeeId = localStorage.getItem("app_employee_id") || "";
  const headers: Record<string, string> = { "x-app-role": role };
  if (clientId) headers["x-app-client-id"] = clientId;
  if (employeeId) headers["x-app-employee-id"] = employeeId;
  return headers;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.75rem",
  fontSize: "0.82rem",
  borderRadius: "0.375rem",
  border: "1px solid var(--border)",
  background: "var(--surface-sunken, var(--background))",
  color: "var(--foreground)",
  fontFamily: "inherit",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: "100px",
  resize: "vertical" as const,
  lineHeight: 1.6,
};

/* ── Component ── */

export default function TabPublishingChannels({ client }: { client: Client }) {
  const toast = useToast();
  const c = client as any;

  // Connected page state (from client record) — prefer the new dedicated fields.
  const connectedPageId = c.fbPageId || c.fb_page_id || c.facebookPageId || c.facebook_page_id || "";
  const connectedPageName = c.fbPageName || c.fb_page_name || c.facebookPageName || c.facebook_page_name || "";
  const igUsername = c.igUsername || c.ig_username || "";
  const hasInstagram = !!(c.igUserId || c.ig_user_id);
  const isConnected = !!connectedPageId;

  // Page picker state
  const [showPicker, setShowPicker] = useState(false);
  const [loadingPages, setLoadingPages] = useState(false);
  const [availablePages, setAvailablePages] = useState<FacebookPage[]>([]);
  const [pagesError, setPagesError] = useState("");
  const [connecting, setConnecting] = useState<string | null>(null);

  // Disconnect state
  const [disconnecting, setDisconnecting] = useState(false);

  // Publish form state
  const [showPublishForm, setShowPublishForm] = useState(false);
  const [publishMessage, setPublishMessage] = useState("");
  const [publishMediaUrl, setPublishMediaUrl] = useState("");
  const [publishMediaType, setPublishMediaType] = useState<"image" | "video">("image");
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ success: boolean; postId?: string; error?: string } | null>(null);
  // New: kind (post/story), targets (fb/ig), scheduling
  const [publishKind, setPublishKind] = useState<"post" | "story">("post");
  const [targetFb, setTargetFb] = useState(true);
  const [targetIg, setTargetIg] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");

  // Fetch available pages
  const handleFetchPages = useCallback(async () => {
    setLoadingPages(true);
    setPagesError("");
    setAvailablePages([]);
    try {
      const res = await fetch(`/api/clients/${client.id}/facebook-pages`, {
        headers: getRoleHeaders(),
      });
      const data = await res.json();

      if (!res.ok) {
        setPagesError(data.error || "שגיאה בטעינת דפי פייסבוק");
        return;
      }

      setAvailablePages(data.pages || []);
      if ((data.pages || []).length === 0) {
        setPagesError("לא נמצאו דפי פייסבוק — ודאו שחשבון Meta Business Manager מחובר בהגדרות");
      }
    } catch {
      setPagesError("שגיאת רשת — נסו שוב");
    } finally {
      setLoadingPages(false);
    }
  }, [client.id]);

  // Connect a page
  const handleConnectPage = useCallback(async (page: FacebookPage) => {
    setConnecting(page.id);
    try {
      const res = await fetch(`/api/clients/${client.id}/facebook-pages/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getRoleHeaders() },
        body: JSON.stringify({
          pageId: page.id,
          pageName: page.name,
          pageAccessToken: page.accessToken,
          pictureUrl: page.pictureUrl,
        }),
      });
      const data = await res.json();

      if (data.success) {
        toast(`דף "${page.name}" חובר בהצלחה`, "success");
        setShowPicker(false);
        // Reload page to reflect changes
        window.location.reload();
      } else {
        toast(data.error || "שגיאה בחיבור הדף", "error");
      }
    } catch {
      toast("שגיאת רשת", "error");
    } finally {
      setConnecting(null);
    }
  }, [client.id, toast]);

  // Disconnect page
  const handleDisconnect = useCallback(async () => {
    if (!confirm("האם לנתק את דף הפייסבוק מלקוח זה?")) return;
    setDisconnecting(true);
    try {
      const res = await fetch(`/api/clients/${client.id}/facebook-pages/connect`, {
        method: "DELETE",
        headers: getRoleHeaders(),
      });
      const data = await res.json();

      if (data.success) {
        toast("דף הפייסבוק נותק בהצלחה", "success");
        window.location.reload();
      } else {
        toast(data.error || "שגיאה בניתוק", "error");
      }
    } catch {
      toast("שגיאת רשת", "error");
    } finally {
      setDisconnecting(false);
    }
  }, [client.id, toast]);

  // Publish / schedule content
  const handlePublish = useCallback(async () => {
    if (!publishMessage && !publishMediaUrl) {
      toast("יש להזין טקסט או מדיה", "error"); return;
    }
    if (!targetFb && !targetIg) { toast("בחר לפחות רשת אחת", "error"); return; }
    if (publishKind === "story" && !publishMediaUrl) { toast("סטורי דורש מדיה", "error"); return; }
    if (targetIg && !publishMediaUrl) { toast("אינסטגרם דורש מדיה", "error"); return; }
    setPublishing(true);
    setPublishResult(null);
    try {
      const res = await fetch(`/api/clients/${client.id}/facebook-pages/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getRoleHeaders() },
        body: JSON.stringify({
          kind: publishKind,
          message: publishMessage,
          mediaUrl: publishMediaUrl || undefined,
          mediaType: publishMediaUrl ? publishMediaType : undefined,
          targets: { facebook: targetFb, instagram: targetIg },
          scheduledAt: scheduledAt || undefined,
        }),
      });
      const data = await res.json();

      if (data.success) {
        if (data.scheduled) {
          setPublishResult({ success: true });
          toast("הפוסט תוזמן בהצלחה", "success");
        } else {
          const fb = data.outcome?.facebook, ig = data.outcome?.instagram;
          const parts = [fb && (fb.ok ? "✓ פייסבוק" : "✗ פייסבוק"), ig && (ig.ok ? "✓ אינסטגרם" : "✗ אינסטגרם")].filter(Boolean);
          setPublishResult({ success: true });
          toast(`פורסם: ${parts.join(" · ")}`, "success");
        }
        setPublishMessage(""); setPublishMediaUrl(""); setScheduledAt("");
      } else {
        setPublishResult({ success: false, error: data.error });
        toast(data.error || "שגיאה בפרסום", "error");
      }
    } catch {
      setPublishResult({ success: false, error: "שגיאת רשת" });
      toast("שגיאת רשת", "error");
    } finally {
      setPublishing(false);
    }
  }, [client.id, publishKind, publishMessage, publishMediaUrl, publishMediaType, targetFb, targetIg, scheduledAt, toast]);

  return (
    <div style={{ direction: "rtl" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
        <div>
          <h3 style={{ margin: "0 0 0.25rem 0", fontSize: "1.05rem", fontWeight: 700, color: "var(--foreground)" }}>
            ערוצי פרסום
          </h3>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--foreground-muted)" }}>
            חיבור דפי פייסבוק ופרסום תוכן ישירות מהמערכת
          </p>
        </div>
        <div style={{
          padding: "0.35rem 0.75rem", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 600,
          background: isConnected ? "rgba(34, 197, 94, 0.1)" : "rgba(107, 114, 128, 0.1)",
          color: isConnected ? "#22c55e" : "#6b7280",
          border: `1px solid ${isConnected ? "rgba(34, 197, 94, 0.2)" : "rgba(107, 114, 128, 0.2)"}`,
        }}>
          {isConnected ? "דף מחובר" : "לא מחובר"}
        </div>
      </div>

      {/* ═══ FACEBOOK PAGE SECTION ═══ */}
      <div style={{
        background: "var(--surface-raised)",
        border: `1px solid ${isConnected ? "rgba(34, 197, 94, 0.25)" : "var(--border)"}`,
        borderRadius: "0.75rem",
        padding: "1.25rem",
        marginBottom: "0.75rem",
        borderRight: `4px solid ${isConnected ? "#22c55e" : "#1877f2"}`,
      }}>
        {/* Section header */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
          <span style={{ fontSize: "1.5rem" }}>📘</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--foreground)" }}>
              דף פייסבוק
              <span style={{ fontSize: "0.72rem", fontWeight: 400, color: "var(--foreground-muted)", marginRight: "0.5rem" }}>
                Facebook Page
              </span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", marginTop: "0.1rem" }}>
              חבר דף פייסבוק לפרסום תוכן ישיר מהמערכת
            </div>
          </div>
        </div>

        {/* ── Connected Page Display ── */}
        {isConnected && (
          <div style={{
            background: "rgba(34, 197, 94, 0.04)",
            border: "1px solid rgba(34, 197, 94, 0.15)",
            borderRadius: "0.625rem",
            padding: "1rem",
            marginBottom: "1rem",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%",
                background: "var(--surface)", border: "2px solid rgba(34, 197, 94, 0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1.5rem", overflow: "hidden",
              }}>
                📘
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--foreground)" }}>
                  {connectedPageName || connectedPageId}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.2rem" }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block",
                  }} />
                  <span style={{ fontSize: "0.75rem", color: "#22c55e", fontWeight: 600 }}>מחובר</span>
                  <span style={{ fontSize: "0.7rem", color: "var(--foreground-muted)" }}>
                    ID: {connectedPageId}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setShowPublishForm(!showPublishForm)}
                  style={{
                    padding: "0.4rem 0.85rem", fontSize: "0.78rem", fontWeight: 600, borderRadius: "0.375rem",
                    border: "1px solid #1877f2", background: "#1877f2", color: "#fff",
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  {showPublishForm ? "סגור" : "📝 פרסם תוכן"}
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  style={{
                    padding: "0.4rem 0.85rem", fontSize: "0.78rem", fontWeight: 600, borderRadius: "0.375rem",
                    border: "1px solid rgba(239, 68, 68, 0.3)", background: "rgba(239, 68, 68, 0.06)", color: "#ef4444",
                    cursor: disconnecting ? "wait" : "pointer", fontFamily: "inherit",
                    opacity: disconnecting ? 0.5 : 1,
                  }}
                >
                  {disconnecting ? "מנתק..." : "נתק"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Publish Form ── */}
        {isConnected && showPublishForm && (
          <div style={{
            background: "var(--surface-sunken, var(--background))",
            border: "1px solid var(--border)",
            borderRadius: "0.625rem",
            padding: "1rem",
            marginBottom: "1rem",
          }}>
            <h4 style={{ margin: "0 0 0.75rem 0", fontSize: "0.88rem", fontWeight: 700, color: "var(--foreground)" }}>
              פרסם תוכן לדף {connectedPageName}
            </h4>

            {/* Kind: post / story */}
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
              {(["post", "story"] as const).map((k) => (
                <button key={k} type="button" onClick={() => setPublishKind(k)}
                  style={{
                    padding: "0.4rem 0.9rem", fontSize: "0.78rem", fontWeight: 600, borderRadius: "0.375rem", cursor: "pointer",
                    border: `1px solid ${publishKind === k ? "#1877f2" : "var(--border)"}`,
                    background: publishKind === k ? "#1877f2" : "transparent",
                    color: publishKind === k ? "#fff" : "var(--foreground-muted)",
                  }}>
                  {k === "post" ? "📰 פוסט" : "⭕ סטורי"}
                </button>
              ))}
            </div>

            {/* Targets: facebook / instagram */}
            <div style={{ display: "flex", gap: "1rem", marginBottom: "0.75rem", fontSize: "0.8rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", cursor: "pointer" }}>
                <input type="checkbox" checked={targetFb} onChange={(e) => setTargetFb(e.target.checked)} /> פייסבוק
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", cursor: hasInstagram ? "pointer" : "not-allowed", opacity: hasInstagram ? 1 : 0.5 }}>
                <input type="checkbox" checked={targetIg} disabled={!hasInstagram} onChange={(e) => setTargetIg(e.target.checked)} />
                אינסטגרם {hasInstagram ? (igUsername ? `(@${igUsername})` : "") : "(לא מקושר)"}
              </label>
            </div>

            {/* Message */}
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.25rem" }}>
                טקסט הפוסט
              </label>
              <textarea
                placeholder="כתבו כאן את תוכן הפוסט..."
                value={publishMessage}
                onChange={(e) => setPublishMessage(e.target.value)}
                style={textareaStyle}
                dir="rtl"
              />
            </div>

            {/* Media URL */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.25rem" }}>
                  קישור למדיה (אופציונלי)
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={publishMediaUrl}
                  onChange={(e) => setPublishMediaUrl(e.target.value)}
                  style={{ ...inputStyle, direction: "ltr" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.25rem" }}>
                  סוג
                </label>
                <select
                  value={publishMediaType}
                  onChange={(e) => setPublishMediaType(e.target.value as "image" | "video")}
                  style={{ ...inputStyle, cursor: "pointer" }}
                >
                  <option value="image">תמונה</option>
                  <option value="video">סרטון</option>
                </select>
              </div>
            </div>

            {/* Schedule (optional) */}
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.25rem" }}>
                תזמון (אופציונלי — ריק = פרסום מיידי)
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                style={{ ...inputStyle, cursor: "pointer" }}
              />
            </div>

            {/* Live preview */}
            {(targetFb || targetIg) && (publishMessage || publishMediaUrl) && (
              <div style={{ marginBottom: "0.85rem" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.4rem" }}>תצוגה מקדימה</div>
                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                  {targetFb && (
                    <PostPreview network="facebook" kind={publishKind} pageName={connectedPageName}
                      message={publishMessage} mediaUrl={publishMediaUrl} mediaType={publishMediaType} />
                  )}
                  {targetIg && (
                    <PostPreview network="instagram" kind={publishKind} pageName={connectedPageName} igUsername={igUsername}
                      message={publishMessage} mediaUrl={publishMediaUrl} mediaType={publishMediaType} />
                  )}
                </div>
              </div>
            )}

            {/* Publish result */}
            {publishResult && (
              <div style={{
                padding: "0.6rem 0.85rem", borderRadius: "0.375rem", marginBottom: "0.75rem",
                background: publishResult.success ? "rgba(34, 197, 94, 0.08)" : "rgba(239, 68, 68, 0.08)",
                border: `1px solid ${publishResult.success ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)"}`,
                fontSize: "0.78rem", color: publishResult.success ? "#22c55e" : "#ef4444",
              }}>
                {publishResult.success
                  ? (scheduledAt ? "✓ התוכן תוזמן בהצלחה" : "✓ התוכן פורסם בהצלחה")
                  : `✗ ${publishResult.error}`}
              </div>
            )}

            {/* Publish button */}
            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing || (!publishMessage && !publishMediaUrl)}
              style={{
                padding: "0.5rem 1.25rem", fontSize: "0.82rem", fontWeight: 600, borderRadius: "0.375rem",
                border: "1px solid #1877f2", background: "#1877f2", color: "#fff",
                cursor: publishing ? "wait" : "pointer", fontFamily: "inherit",
                opacity: publishing || (!publishMessage && !publishMediaUrl) ? 0.5 : 1,
                display: "inline-flex", alignItems: "center", gap: "0.4rem",
              }}
            >
              {publishing ? "מפרסם..." : "🚀 פרסם עכשיו"}
            </button>
          </div>
        )}

        {/* ── Connect Button (when not connected) ── */}
        {!isConnected && !showPicker && (
          <button
            type="button"
            onClick={() => {
              setShowPicker(true);
              handleFetchPages();
            }}
            style={{
              padding: "0.6rem 1.25rem", fontSize: "0.85rem", fontWeight: 600, borderRadius: "0.5rem",
              border: "1px solid #1877f2", background: "#1877f2", color: "#fff",
              cursor: "pointer", fontFamily: "inherit",
              display: "inline-flex", alignItems: "center", gap: "0.5rem",
            }}
          >
            📘 חבר עמוד פייסבוק
          </button>
        )}

        {/* ── Page Picker ── */}
        {showPicker && (
          <div style={{
            background: "var(--surface-sunken, var(--background))",
            border: "1px solid var(--border)",
            borderRadius: "0.625rem",
            padding: "1rem",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h4 style={{ margin: 0, fontSize: "0.88rem", fontWeight: 700, color: "var(--foreground)" }}>
                בחר דף פייסבוק לחיבור
              </h4>
              <button
                type="button"
                onClick={() => setShowPicker(false)}
                style={{
                  padding: "0.25rem 0.5rem", fontSize: "0.75rem", borderRadius: "0.25rem",
                  border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground-muted)",
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                ✕ סגור
              </button>
            </div>

            {loadingPages && (
              <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--foreground-muted)", fontSize: "0.85rem" }}>
                טוען דפים זמינים...
              </div>
            )}

            {pagesError && (
              <div style={{
                padding: "0.75rem", borderRadius: "0.375rem", marginBottom: "0.75rem",
                background: "rgba(239, 68, 68, 0.06)", border: "1px solid rgba(239, 68, 68, 0.15)",
                fontSize: "0.78rem", color: "#ef4444",
              }}>
                {pagesError}
              </div>
            )}

            {!loadingPages && availablePages.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {availablePages.map((page) => (
                  <div
                    key={page.id}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.75rem",
                      padding: "0.75rem",
                      background: "var(--surface-raised)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.5rem",
                    }}
                  >
                    <div style={{
                      width: 40, height: 40, borderRadius: "50%", overflow: "hidden",
                      background: "var(--surface)", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {page.pictureUrl ? (
                        <img src={page.pictureUrl} alt={page.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <span style={{ fontSize: "1.25rem" }}>📘</span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--foreground)" }}>
                        {page.name}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--foreground-muted)", display: "flex", gap: "0.75rem" }}>
                        {page.category && <span>{page.category}</span>}
                        {page.fanCount > 0 && <span>{page.fanCount.toLocaleString()} עוקבים</span>}
                        <span style={{ direction: "ltr" }}>ID: {page.id}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleConnectPage(page)}
                      disabled={connecting !== null}
                      style={{
                        padding: "0.35rem 0.75rem", fontSize: "0.75rem", fontWeight: 600, borderRadius: "0.375rem",
                        border: "1px solid #1877f2", background: connecting === page.id ? "#1877f2" : "rgba(24, 119, 242, 0.08)",
                        color: connecting === page.id ? "#fff" : "#1877f2",
                        cursor: connecting !== null ? "wait" : "pointer", fontFamily: "inherit",
                        opacity: connecting !== null && connecting !== page.id ? 0.4 : 1,
                      }}
                    >
                      {connecting === page.id ? "מחבר..." : "חבר"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Retry button */}
            {!loadingPages && pagesError && (
              <button
                type="button"
                onClick={handleFetchPages}
                style={{
                  marginTop: "0.5rem",
                  padding: "0.4rem 0.85rem", fontSize: "0.78rem", fontWeight: 600, borderRadius: "0.375rem",
                  border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)",
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                🔄 נסה שוב
              </button>
            )}
          </div>
        )}
      </div>

      {/* ═══ FUTURE CHANNELS PLACEHOLDER ═══ */}
      <div style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--border)",
        borderRadius: "0.75rem",
        padding: "1.25rem",
        marginBottom: "0.75rem",
        opacity: 0.6,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "1.5rem" }}>📸</span>
          <div>
            <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--foreground)" }}>
              אינסטגרם
              <span style={{ fontSize: "0.72rem", fontWeight: 400, color: "var(--foreground-muted)", marginRight: "0.5rem" }}>
                Instagram
              </span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", marginTop: "0.1rem" }}>
              בקרוב — פרסום ישיר לאינסטגרם
            </div>
          </div>
          <div style={{ marginRight: "auto" }}>
            <span style={{
              fontSize: "0.7rem", fontWeight: 700, padding: "0.2rem 0.6rem",
              borderRadius: "999px", background: "rgba(107, 114, 128, 0.1)",
              color: "#6b7280", border: "1px solid rgba(107, 114, 128, 0.2)",
            }}>
              בקרוב
            </span>
          </div>
        </div>
      </div>

      <div style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--border)",
        borderRadius: "0.75rem",
        padding: "1.25rem",
        opacity: 0.6,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "1.5rem" }}>🎵</span>
          <div>
            <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--foreground)" }}>
              טיקטוק
              <span style={{ fontSize: "0.72rem", fontWeight: 400, color: "var(--foreground-muted)", marginRight: "0.5rem" }}>
                TikTok
              </span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", marginTop: "0.1rem" }}>
              בקרוב — פרסום ישיר לטיקטוק
            </div>
          </div>
          <div style={{ marginRight: "auto" }}>
            <span style={{
              fontSize: "0.7rem", fontWeight: 700, padding: "0.2rem 0.6rem",
              borderRadius: "999px", background: "rgba(107, 114, 128, 0.1)",
              color: "#6b7280", border: "1px solid rgba(107, 114, 128, 0.2)",
            }}>
              בקרוב
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
