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

// Role labels that must never be shown as a person's name.
const ROLE_WORDS = ["מנהל", "עובד", "מנהל מחלקה", "admin", "employee", "manager", "owner", "team_lead", "super_admin", "לקוח", "client", "user", "משתמש"];
const isRoleWord = (s: string) => ROLE_WORDS.includes((s || "").trim().toLowerCase()) || ROLE_WORDS.includes((s || "").trim());

export default function WelcomePopup() {
  const { role, employeeId, displayName, email } = useAuth();
  const { data: employees } = useEmployees();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ name: string; avatar: string; message: string } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (role === "client") return; // clients don't get the team welcome
    const uid = localStorage.getItem("frameai_user_id") || employeeId || "user";
    const key = `frameai_welcome_shown_${uid}`;
    if (sessionStorage.getItem(key)) return; // already shown this session

    // Resolve the real person from the employees list — by linked id first,
    // then by matching the logged-in email (covers accounts where employeeId
    // isn't linked). Never fall back to a bare role label like "מנהל"/"עובד".
    const authEmail = (email || localStorage.getItem("frameai_email") || "").trim().toLowerCase();
    const emp =
      (employees || []).find((e: any) => e.id === employeeId) ||
      (authEmail ? (employees || []).find((e: any) => String((e as any).email || "").trim().toLowerCase() === authEmail) : undefined);

    // Prefer the employee's real name; only use displayName if it's an actual
    // name (not the role word the account may have been seeded with).
    const candidates = [emp?.name, displayName, localStorage.getItem("frameai_display_name")];
    let name = (candidates.find((c) => c && c.trim() && !isRoleWord(c)) || "").trim();
    // Last resort: derive a readable name from the email local-part, so we never
    // greet someone with a role word.
    if (!name && authEmail) {
      name = authEmail.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()).trim();
    }
    const first = name.split(/\s+/)[0] || name;
    const empRole = (emp as any)?.role || role;
    const isManager = ["admin", "manager", "owner", "super_admin", "team_lead"].includes(String(empRole));
    const personal: string[] = Array.isArray((emp as any)?.welcomeMessages) ? (emp as any).welcomeMessages.filter((x: string) => typeof x === "string" && x.trim()) : [];
    const pool = personal.length ? personal : (isManager ? MANAGER_MSGS : EMPLOYEE_MSGS);
    const message = (pool[Math.floor(Math.random() * pool.length)] || "").replace(/\{name\}/g, first || "");

    // Wait until employees have loaded so we can resolve the real name (by id or
    // email) before showing — prevents a flash of a role-word/empty greeting.
    if (!employees && !name) return;

    setData({ name, avatar: (emp as any)?.avatarUrl || "", message });
    const t = setTimeout(() => { setOpen(true); sessionStorage.setItem(key, "1"); }, 600);
    return () => clearTimeout(t);
  }, [role, employeeId, displayName, email, employees]);

  if (!open || !data) return null;

  return (
    <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 8000, padding: 20, animation: "wp-fade 0.3s ease" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface-raised)", borderRadius: 22, padding: "2rem 2.2rem", maxWidth: 380, width: "92%", textAlign: "center", direction: "rtl", boxShadow: "0 24px 70px rgba(0,0,0,0.28)", animation: "wp-pop 0.4s cubic-bezier(0.18,1.25,0.4,1)" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <div className="wp-avatar-wrap">
            <span className="wp-ring" aria-hidden />
            <span className="wp-avatar-float">
              <Avatar src={data.avatar} name={data.name} size={164} />
            </span>
          </div>
        </div>
        <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--foreground)", marginBottom: 8 }}>היי, {data.name} 👋</div>
        <div style={{ fontSize: "1rem", color: "var(--foreground-muted)", lineHeight: 1.5, marginBottom: 20 }}>{data.message}</div>
        <button onClick={() => setOpen(false)} style={{ width: "100%", padding: "0.7rem", borderRadius: 12, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 800, fontSize: "0.95rem", cursor: "pointer" }}>קדימה לעבודה ✨</button>
      </div>
      <style>{`
        @keyframes wp-fade{from{opacity:0}to{opacity:1}}
        @keyframes wp-pop{from{opacity:0;transform:scale(0.85)}to{opacity:1;transform:scale(1)}}
        @keyframes wp-spin{to{transform:rotate(360deg)}}
        @keyframes wp-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes wp-glow{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:.95;transform:scale(1.06)}}
        .wp-avatar-wrap{position:relative;width:164px;height:164px;display:flex;align-items:center;justify-content:center}
        .wp-ring{position:absolute;inset:-16px;border-radius:50%;background:conic-gradient(from 0deg,var(--accent,#00B5FE),var(--yellow,#E8F401),var(--accent,#00B5FE),var(--yellow,#E8F401),var(--accent,#00B5FE));filter:blur(11px);opacity:.75;z-index:0;animation:wp-spin 4.5s linear infinite,wp-glow 2.6s ease-in-out infinite}
        .wp-avatar-float{position:relative;z-index:1;border-radius:50%;animation:wp-float 3.2s ease-in-out infinite}
        @media (prefers-reduced-motion: reduce){.wp-ring,.wp-avatar-float{animation:none}}
      `}</style>
    </div>
  );
}
