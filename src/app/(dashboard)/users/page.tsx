"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useUsers } from "@/lib/api/use-entity";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import type { User } from "@/lib/db/schema";

/* ── Role configuration ── */
const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  admin: { label: "מנהל", color: "#22c55e" },
  manager: { label: "מנהל פרויקטים", color: "#f59e0b" },
  editor: { label: "עורך", color: "#0092cc" },
  viewer: { label: "צופה", color: "#6b7280" },
};

/* ── Generate avatar with initials ── */
function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function getAvatarBg(id: string): string {
  const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8"];
  return colors[Math.abs(id.charCodeAt(1)) % colors.length];
}

interface FormData {
  name: string;
  email: string;
  role: "admin" | "manager" | "editor" | "viewer";
  status: "active" | "inactive";
}

const INITIAL_FORM: FormData = {
  name: "",
  email: "",
  role: "viewer",
  status: "active",
};

export default function UsersPage() {
  const { data: users, loading, create, update, remove } = useUsers();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const filteredUsers = (users || []).filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const handleOpenCreateModal = () => {
    setEditingUserId(null);
    setFormData(INITIAL_FORM);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: User) => {
    setEditingUserId(user.id);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData(INITIAL_FORM);
    setEditingUserId(null);
  };

  const handleSaveUser = async () => {
    if (!formData.name.trim() || !formData.email.trim()) {
      toast("אנא מלא את כל השדות הנדרשים", "error");
      return;
    }

    try {
      if (editingUserId) {
        await update(editingUserId, formData);
        toast("המשתמש עודכן בהצלחה", "success");
      } else {
        await create(formData);
        toast("המשתמש נוסף בהצלחה", "success");
      }
      handleCloseModal();
    } catch (error) {
      toast("שגיאה בשמירת המשתמש", "error");
    }
  };

  const handleOpenDeleteConfirm = (userId: string) => {
    setDeleteTargetId(userId);
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;

    try {
      await remove(deleteTargetId);
      toast("המשתמש הוסר בהצלחה", "success");
      setIsDeleteConfirmOpen(false);
      setDeleteTargetId(null);
    } catch (error) {
      toast("שגיאה בהסרת המשתמש", "error");
    }
  };

  return (
    <main className="max-w-[1100px] mx-auto px-6 py-8">
      <div className="usr-page" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", justifyContent: "space-between" }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.025em" }}>
              ניהול משתמשים
            </h1>
          </div>
          <button
            className="mod-btn-primary"
            onClick={handleOpenCreateModal}
            style={{
              padding: "0.5rem 1.125rem",
              fontSize: "0.9375rem",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
            disabled={loading}
          >
            + הוסף משתמש
          </button>
        </div>

        {/* Search Input */}
        <div
          style={{
            position: "relative",
            maxWidth: "400px",
          }}
        >
          <span
            style={{
              position: "absolute",
              insetInlineStart: "1rem",
              top: "50%",
              transform: "translateY(-50%)",
              opacity: 0.5,
              fontSize: "1rem",
              pointerEvents: "none",
            }}
          >
            🔍
          </span>
          <input
            type="search"
            className="mod-search"
            placeholder="חיפוש משתמש…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "0.75rem 1rem",
              paddingInlineStart: "2.5rem",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              background: "var(--surface)",
              color: "var(--foreground)",
              fontSize: "0.875rem",
            }}
            autoComplete="off"
          />
        </div>

        {/* Users Grid */}
        <div className="usr-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "1.5rem" }}>
          {loading ? (
            <div
              style={{
                gridColumn: "1 / -1",
                textAlign: "center",
                padding: "3rem 2rem",
                color: "var(--foreground-muted)",
              }}
            >
              <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>⏳</div>
              <p style={{ fontSize: "0.9375rem" }}>טוען משתמשים...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div
              style={{
                gridColumn: "1 / -1",
                textAlign: "center",
                padding: "3rem 2rem",
                color: "var(--foreground-muted)",
              }}
            >
              <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>👤</div>
              <p style={{ fontSize: "0.9375rem" }}>לא נמצאו משתמשים</p>
            </div>
          ) : (
            filteredUsers.map((user) => (
              <div
                key={user.id}
                className="usr-card"
                style={{
                  padding: "1.5rem",
                  border: "1px solid var(--border)",
                  borderRadius: "0.75rem",
                  background: "var(--surface)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  gap: "1rem",
                }}
              >
                {/* Avatar */}
                <div
                  className="usr-avatar"
                  style={{
                    width: "3rem",
                    height: "3rem",
                    borderRadius: "50%",
                    background: user.avatar || getAvatarBg(user.id),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: "white",
                  }}
                >
                  {getInitials(user.name)}
                </div>

                {/* Name */}
                <h3 className="usr-name" style={{ fontSize: "0.9375rem", fontWeight: 600 }}>
                  {user.name}
                </h3>

                {/* Email */}
                <p className="usr-email" style={{ fontSize: "0.8125rem", color: "var(--foreground-muted)", wordBreak: "break-word" }}>
                  {user.email}
                </p>

                {/* Role Badge */}
                <div
                  className="usr-role"
                  style={{
                    padding: "0.375rem 0.75rem",
                    borderRadius: "9999px",
                    background: `${ROLE_CONFIG[user.role].color}20`,
                    color: ROLE_CONFIG[user.role].color,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  }}
                >
                  {ROLE_CONFIG[user.role].label}
                </div>

                {/* Status Badge */}
                <div
                  style={{
                    padding: "0.375rem 0.75rem",
                    borderRadius: "9999px",
                    background: user.status === "active" ? "#10b98120" : "#ef444420",
                    color: user.status === "active" ? "#10b981" : "#ef4444",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  }}
                >
                  {user.status === "active" ? "פעיל" : "לא פעיל"}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "0.5rem", width: "100%", marginTop: "0.5rem" }}>
                  <button
                    className="mod-btn-ghost"
                    onClick={() => handleOpenEditModal(user)}
                    style={{
                      flex: 1,
                      padding: "0.5rem",
                      fontSize: "0.75rem",
                      border: "1px solid var(--border)",
                      borderRadius: "0.375rem",
                      background: "transparent",
                      color: "var(--foreground)",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--surface-raised)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    ✏️ ערוך
                  </button>
                  <button
                    className="mod-btn-ghost"
                    onClick={() => handleOpenDeleteConfirm(user.id)}
                    style={{
                      flex: 1,
                      padding: "0.5rem",
                      fontSize: "0.75rem",
                      border: "1px solid var(--border)",
                      borderRadius: "0.375rem",
                      background: "transparent",
                      color: "var(--foreground)",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--surface-raised)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    🗑️ הסר
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Modal open={isModalOpen} onClose={handleCloseModal} title={editingUserId ? "עריכת משתמש" : "הוספת משתמש חדש"}>
        <div
          style={{
            background: "var(--surface)",
            borderRadius: "0.75rem",
            padding: "2rem",
            maxWidth: "500px",
            width: "100%",
          }}
        >

          {/* Form Fields */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Name */}
            <div>
              <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--foreground-muted)" }}>
                שם
              </label>
              <input
                type="text"
                className="form-input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="הזן שם"
                style={{
                  width: "100%",
                  padding: "0.625rem 0.75rem",
                  border: "1px solid var(--border)",
                  borderRadius: "0.375rem",
                  background: "var(--surface-raised)",
                  color: "var(--foreground)",
                  fontSize: "0.875rem",
                }}
              />
            </div>

            {/* Email */}
            <div>
              <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--foreground-muted)" }}>
                דוא"ל
              </label>
              <input
                type="email"
                className="form-input"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="הזן דוא״ל"
                style={{
                  width: "100%",
                  padding: "0.625rem 0.75rem",
                  border: "1px solid var(--border)",
                  borderRadius: "0.375rem",
                  background: "var(--surface-raised)",
                  color: "var(--foreground)",
                  fontSize: "0.875rem",
                }}
              />
            </div>

            {/* Role Select */}
            <div>
              <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--foreground-muted)" }}>
                תפקיד
              </label>
              <select
                className="form-select"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as FormData["role"] })}
                style={{
                  width: "100%",
                  padding: "0.625rem 0.75rem",
                  border: "1px solid var(--border)",
                  borderRadius: "0.375rem",
                  background: "var(--surface-raised)",
                  color: "var(--foreground)",
                  fontSize: "0.875rem",
                  cursor: "pointer",
                }}
              >
                <option value="viewer">צופה</option>
                <option value="editor">עורך</option>
                <option value="manager">מנהל פרויקטים</option>
                <option value="admin">מנהל</option>
              </select>
            </div>

            {/* Status Select */}
            <div>
              <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--foreground-muted)" }}>
                סטטוס
              </label>
              <select
                className="form-select"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as FormData["status"] })}
                style={{
                  width: "100%",
                  padding: "0.625rem 0.75rem",
                  border: "1px solid var(--border)",
                  borderRadius: "0.375rem",
                  background: "var(--surface-raised)",
                  color: "var(--foreground)",
                  fontSize: "0.875rem",
                  cursor: "pointer",
                }}
              >
                <option value="active">פעיל</option>
                <option value="inactive">לא פעיל</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: "1rem", marginTop: "2rem", justifyContent: "flex-end" }}>
            <button
              className="mod-btn-ghost"
              onClick={handleCloseModal}
              style={{
                padding: "0.625rem 1rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                border: "1px solid var(--border)",
                borderRadius: "0.375rem",
                background: "transparent",
                color: "var(--foreground)",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              ביטול
            </button>
            <button
              className="mod-btn-primary"
              onClick={handleSaveUser}
              style={{
                padding: "0.625rem 1rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                borderRadius: "0.375rem",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              שמור
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} title="מחיקת משתמש">
        <div
          style={{
            background: "var(--surface)",
            borderRadius: "0.75rem",
            padding: "2rem",
            maxWidth: "400px",
            width: "100%",
          }}
        >
          <p style={{ fontSize: "0.9375rem", color: "var(--foreground-muted)", marginBottom: "2rem" }}>
            האם אתה בטוח שברצונך למחוק משתמש זה? פעולה זו לא ניתנת לביטול.
          </p>

          {/* Actions */}
          <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
            <button
              className="mod-btn-ghost"
              onClick={() => setIsDeleteConfirmOpen(false)}
              style={{
                padding: "0.625rem 1rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                border: "1px solid var(--border)",
                borderRadius: "0.375rem",
                background: "transparent",
                color: "var(--foreground)",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              ביטול
            </button>
            <button
              onClick={handleConfirmDelete}
              style={{
                padding: "0.625rem 1rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                borderRadius: "0.375rem",
                background: "#ef4444",
                color: "white",
                cursor: "pointer",
                transition: "all 0.2s ease",
                border: "none",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#dc2626";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#ef4444";
              }}
            >
              מחק
            </button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
