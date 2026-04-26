"use client";

import Link from "next/link";
import { useProjects, useClients } from "@/lib/api/use-entity";
import type { Project } from "@/lib/db/schema";

export default function VideoEditorLandingPage() {
  const { data: projects } = useProjects();
  const { data: clients } = useClients();

  const clientMap = new Map(clients.map((c) => [c.id, c.name]));

  return (
    <div style={{ direction: "rtl", padding: "2rem" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--foreground)", marginBottom: "0.5rem" }}>
          🎬 עורך וידאו
        </h1>
        <p style={{ fontSize: "0.95rem", color: "var(--foreground-muted)" }}>
          בחר פרויקט לעריכת וידאו מתקדמת
        </p>
      </div>

      {projects.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "3rem 2rem",
            background: "var(--surface)",
            borderRadius: "8px",
            border: "1px solid var(--border)",
          }}
        >
          <p style={{ fontSize: "1.1rem", color: "var(--foreground-muted)", marginBottom: "0.5rem" }}>
            אין פרויקטים עדיין
          </p>
          <p style={{ fontSize: "0.9rem", color: "var(--foreground-muted)", opacity: 0.6 }}>
            צור פרויקט חדש כדי להתחיל לערוך וידאו
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1rem" }}>
          {projects.map((project: Project) => (
            <Link
              key={project.id}
              href={`/editor/${project.id}`}
              style={{
                display: "block",
                padding: "1.25rem",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                textDecoration: "none",
                color: "inherit",
                transition: "box-shadow 200ms ease, border-color 200ms ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
                (e.currentTarget as HTMLElement).style.borderColor = "#8b5cf6";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
              }}
            >
              {/* Thumbnail */}
              {project.thumbnailUrl && (
                <div
                  style={{
                    width: "100%",
                    height: "160px",
                    borderRadius: "6px",
                    overflow: "hidden",
                    marginBottom: "0.75rem",
                    background: "#000",
                  }}
                >
                  <img
                    src={project.thumbnailUrl}
                    alt={project.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
              )}

              <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--foreground)", marginBottom: "0.3rem" }}>
                {project.name || "פרויקט ללא שם"}
              </h3>

              <p style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", marginBottom: "0.5rem" }}>
                {clientMap.get(project.clientId) || "ללא לקוח"}
              </p>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "0.25rem 0.6rem",
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    borderRadius: "4px",
                    background: project.sourceVideoKey ? "rgba(139,92,246,0.1)" : "rgba(0,0,0,0.05)",
                    color: project.sourceVideoKey ? "#8b5cf6" : "var(--foreground-muted)",
                  }}
                >
                  {project.sourceVideoKey ? "📹 יש וידאו מקור" : "📝 ללא וידאו מקור"}
                </span>
                {project.status && (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--foreground-muted)",
                      opacity: 0.7,
                    }}
                  >
                    {project.status}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
