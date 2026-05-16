"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/toast";

interface ConnectionStatus {
  connected: boolean;
  phoneNumberId: string | null;
  businessAccountId: string | null;
  displayPhone?: string;
  qualityRating?: string;
  error?: string;
  qrCode?: {
    code: string;
    prefilled_message?: string;
    deep_link_url?: string;
  } | null;
}

export function WhatsAppConnect() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [sendingTest, setSendingTest] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus | null>(null);

  // Form fields
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [businessAccountId, setBusinessAccountId] = useState("");
  const [verifyToken, setVerifyToken] = useState("pixelmanage_verify");
  const [testPhone, setTestPhone] = useState("");

  // Check connection status on mount
  useEffect(() => {
    checkStatus();
  }, []);

  async function checkStatus() {
    setChecking(true);
    try {
      const res = await fetch("/api/whatsapp/connect");
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ connected: false, phoneNumberId: null, businessAccountId: null });
    } finally {
      setChecking(false);
    }
  }

  async function handleSave() {
    if (!phoneNumberId || !accessToken) {
      toast("נדרשים Phone Number ID ו-Access Token", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumberId,
          accessToken,
          businessAccountId,
          verifyToken,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast("WhatsApp חובר בהצלחה!", "success");
        setStatus({
          connected: true,
          phoneNumberId,
          businessAccountId,
          displayPhone: data.displayPhone,
          qualityRating: data.qualityRating,
        });
        // Clear sensitive field
        setAccessToken("");
      } else {
        toast(data.error || "שגיאה בחיבור", "error");
      }
    } catch {
      toast("שגיאה בשמירת הגדרות", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendTest() {
    if (!testPhone) {
      toast("הכנס מספר טלפון לבדיקה", "error");
      return;
    }

    setSendingTest(true);
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: testPhone,
          message: "הודעת בדיקה מ-Frame AI — החיבור תקין! ✓",
        }),
      });

      const data = await res.json();
      if (data.error && !data.warning) {
        toast(`שגיאה: ${data.error}`, "error");
      } else if (data.warning) {
        toast(data.warning, "warning");
      } else {
        toast("הודעת בדיקה נשלחה בהצלחה!", "success");
      }
    } catch {
      toast("שגיאה בשליחת הודעה", "error");
    } finally {
      setSendingTest(false);
    }
  }

  return (
    <div dir="rtl" style={{ padding: "24px", maxWidth: 600 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
        חיבור WhatsApp Business
      </h2>
      <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 24 }}>
        חבר את חשבון WhatsApp Business שלך דרך Meta Cloud API כדי לשלוח ולקבל הודעות ישירות מהמערכת.
      </p>

      {/* Status Indicator */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          borderRadius: 10,
          marginBottom: 24,
          background: status?.connected
            ? "rgba(34,197,94,0.08)"
            : "rgba(239,68,68,0.08)",
          border: `1px solid ${status?.connected ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
        }}
      >
        <span style={{ fontSize: 18 }}>{checking ? "⏳" : status?.connected ? "🟢" : "🔴"}</span>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {checking
              ? "בודק חיבור..."
              : status?.connected
              ? "מחובר"
              : "לא מחובר"}
          </div>
          {status?.connected && status.displayPhone && (
            <div style={{ fontSize: 12, color: "#94a3b8" }}>
              {status.displayPhone}
              {status.qualityRating && ` • איכות: ${status.qualityRating}`}
            </div>
          )}
          {status?.error && !status.connected && (
            <div style={{ fontSize: 12, color: "#ef4444" }}>{status.error}</div>
          )}
        </div>
      </div>

      {/* QR Code */}
      {status?.qrCode && (
        <div
          style={{
            marginBottom: 24,
            padding: 16,
            background: "rgba(255,255,255,0.03)",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.08)",
            textAlign: "center",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
            קוד QR לקישור
          </div>
          <div
            style={{
              padding: 16,
              background: "#fff",
              borderRadius: 8,
              display: "inline-block",
            }}
          >
            <img
              src={`https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(
                status.qrCode.deep_link_url || status.qrCode.code
              )}`}
              alt="WhatsApp QR Code"
              style={{ width: 200, height: 200 }}
            />
          </div>
          {status.qrCode.prefilled_message && (
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>
              {status.qrCode.prefilled_message}
            </div>
          )}
        </div>
      )}

      {/* Connection Form */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 6,
              color: "#e2e8f0",
            }}
          >
            Phone Number ID *
          </label>
          <input
            type="text"
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
            placeholder="לדוגמה: 123456789012345"
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.04)",
              color: "#fff",
              fontSize: 14,
              direction: "ltr",
              textAlign: "left",
            }}
          />
          <span style={{ fontSize: 11, color: "#64748b" }}>
            מזהה מספר הטלפון מ-Meta Business Suite
          </span>
        </div>

        <div>
          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 6,
              color: "#e2e8f0",
            }}
          >
            Access Token *
          </label>
          <input
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="טוקן גישה מ-Meta Developer Console"
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.04)",
              color: "#fff",
              fontSize: 14,
              direction: "ltr",
              textAlign: "left",
            }}
          />
          <span style={{ fontSize: 11, color: "#64748b" }}>
            Permanent token מ-Meta Developer Console &gt; WhatsApp &gt; API Setup
          </span>
        </div>

        <div>
          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 6,
              color: "#e2e8f0",
            }}
          >
            Business Account ID
          </label>
          <input
            type="text"
            value={businessAccountId}
            onChange={(e) => setBusinessAccountId(e.target.value)}
            placeholder="לדוגמה: 987654321098765"
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.04)",
              color: "#fff",
              fontSize: 14,
              direction: "ltr",
              textAlign: "left",
            }}
          />
          <span style={{ fontSize: 11, color: "#64748b" }}>
            מזהה חשבון העסקי מ-Meta Business Suite (אופציונלי)
          </span>
        </div>

        <div>
          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 6,
              color: "#e2e8f0",
            }}
          >
            Verify Token
          </label>
          <input
            type="text"
            value={verifyToken}
            onChange={(e) => setVerifyToken(e.target.value)}
            placeholder="pixelmanage_verify"
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.04)",
              color: "#fff",
              fontSize: 14,
              direction: "ltr",
              textAlign: "left",
            }}
          />
          <span style={{ fontSize: 11, color: "#64748b" }}>
            טוקן אימות ל-Webhook — יש להגדיר אותו גם ב-Meta Developer Console
          </span>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={loading}
        style={{
          width: "100%",
          padding: "12px 20px",
          borderRadius: 8,
          border: "none",
          background: loading ? "#1e293b" : "#25D366",
          color: "#fff",
          fontWeight: 700,
          fontSize: 15,
          cursor: loading ? "not-allowed" : "pointer",
          marginBottom: 24,
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? "מתחבר..." : "שמור וחבר"}
      </button>

      {/* Test Message Section */}
      {status?.connected && (
        <div
          style={{
            padding: 16,
            borderRadius: 10,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>
            שליחת הודעת בדיקה
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="tel"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="050-1234567"
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
                color: "#fff",
                fontSize: 14,
                direction: "ltr",
                textAlign: "left",
              }}
            />
            <button
              onClick={handleSendTest}
              disabled={sendingTest}
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                border: "none",
                background: sendingTest ? "#1e293b" : "#3b82f6",
                color: "#fff",
                fontWeight: 600,
                fontSize: 14,
                cursor: sendingTest ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
                opacity: sendingTest ? 0.6 : 1,
              }}
            >
              {sendingTest ? "שולח..." : "שלח בדיקה"}
            </button>
          </div>
        </div>
      )}

      {/* Webhook URL Info */}
      <div
        style={{
          marginTop: 24,
          padding: 16,
          borderRadius: 10,
          background: "rgba(59,130,246,0.06)",
          border: "1px solid rgba(59,130,246,0.15)",
          fontSize: 13,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 8, color: "#93c5fd" }}>
          הגדרת Webhook ב-Meta Developer Console
        </div>
        <div style={{ color: "#94a3b8", lineHeight: 1.7 }}>
          <div>
            <strong>Callback URL:</strong>{" "}
            <code
              style={{
                background: "rgba(0,0,0,0.3)",
                padding: "2px 6px",
                borderRadius: 4,
                direction: "ltr",
                display: "inline-block",
              }}
            >
              https://YOUR_DOMAIN/api/whatsapp/webhook
            </code>
          </div>
          <div>
            <strong>Verify Token:</strong>{" "}
            <code
              style={{
                background: "rgba(0,0,0,0.3)",
                padding: "2px 6px",
                borderRadius: 4,
              }}
            >
              {verifyToken || "pixelmanage_verify"}
            </code>
          </div>
          <div style={{ marginTop: 4 }}>
            <strong>Subscribed Fields:</strong> messages
          </div>
        </div>
      </div>
    </div>
  );
}
