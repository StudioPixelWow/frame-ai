"use client";

/**
 * Personalized login welcome popup — shown once per login session, anywhere in
 * the app, for admins/employees. Shows the user's circular avatar (brand-yellow
 * ring) above the name + a random welcome message (personal if set, else
 * role-based defaults). Soft scale/fade-in. Closes easily.
 */
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { useEmployees } from "@/lib/api/use-entity";
import Avatar from "@/components/ui/avatar";

const MANAGER_MSGS = [
  "היי {name}, עוד יום להוביל, להתמקד ולהזיז דברים קדימה 🚀",
  "{name}, היום הופכים בלאגן לבהירות 😎",
  "החלטות טובות מתחילות מקפה ודשבורד פתוח, {name} ☕",
  "{name}, הצוות רגוע יותר כשאתה על זה 💪",
  "נוביל את היום בחשיבה חדה ואנרגיה טובה, {name} ✨",
];
const EMPLOYEE_MSGS = [
  "היי {name}, עוד יום להפוך רעיונות לתוצאות ✨",
  "{name}, משימה אחת בכל פעם — וננצח את היום 💪",
  "בוא נעשה עבודה מצוינת היום, {name} 😎",
  "{name}, גם התקדמות קטנה מזיזה הכל קדימה 🚀",
  "פותחים דשבורד, מביאים אנרגיה, יוצאים לדרך 🔥",
];

export default function WelcomePopup() {
  const { role, employeeId, displayName } = useAuth();
  const { data: employees } = useEmployees();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ name: string; avatar: string; message: string } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (role === "client") return; // clients don't get the team welcome
    const uid = localStorage.getItem("frameai_user_id") || employeeId || "user";
    const key = `frameai_welcome_shown_${uid}`;
    if (sessionStorage.getItem(key)) return; // already shown this session

    const emp = (employees || []).find((e: any) => e.id === employeeId);
    const name = (emp?.name || displayName || localStorage.getItem("frameai_display_name") || "").trim();
    const first = name.split(/\s+/)[0] || name;
    const empRole = (emp as any)?.role || role;
    const isManager = ["admin", "manager", "owner", "super_admin", "team_lead"].includes(String(empRole));
    const personal: string[] = Array.isArray((emp as any)?.welcomeMessages) ? (emp as any).welcomeMessages.filter((x: string) => typeof x === "string" && x.trim()) : [];
    const pool = personal.length ? personal : (isManager ? MANAGER_MSGS : EMPLOYEE_MSGS);
    const message = (pool[Math.floor(Math.random() * pool.length)] || "").replace(/\{name\}/g, first || "");

    // Wait until employees have loaded (so personal messages/avatar are available),
    // but don't block forever — show after data resolves or a short delay.
    if (!employees && personal.length === 0 && !name) return;

    setData({ name, avatar: (emp as any)?.avatarUrl || "", message });
    const t = setTimeout(() => { setOpen(true); sessionStorage.setItem(key, "1"); }, 600);
    return () => clearTimeout(t);
  }, [role, employeeId, displayName, employees]);

  if (!open || !data) return null;

  return (
    <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 8000, padding: 20, animation: "wp-fade 0.3s ease" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface-raised)", borderRadius: 22, padding: "2rem 2.2rem", maxWidth: 380, width: "92%", textAlign: "center", direction: "rtl", boxShadow: "0 24px 70px rgba(0,0,0,0.28)", animation: "wp-pop 0.4s cubic-bezier(0.18,1.25,0.4,1)" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <Avatar src={data.avatar} name={data.name} size={104} />
        </div>
        <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--foreground)", marginBottom: 8 }}>היי, {data.name} 👋</div>
        <div style={{ fontSize: "1rem", color: "var(--foreground-muted)", lineHeight: 1.5, marginBottom: 20 }}>{data.message}</div>
        <button onClick={() => setOpen(false)} style={{ width: "100%", padding: "0.7rem", borderRadius: 12, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 800, fontSize: "0.95rem", cursor: "pointer" }}>קדימה לעבודה ✨</button>
      </div>
      <style>{`@keyframes wp-fade{from{opacity:0}to{opacity:1}}@keyframes wp-pop{from{opacity:0;transform:scale(0.85)}to{opacity:1;transform:scale(1)}}`}</style>
    </div>
  );
}
