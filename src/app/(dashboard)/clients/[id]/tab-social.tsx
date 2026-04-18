"use client";

import { useState, useEffect } from "react";
import {
  useClientGanttItems,
  useSocialPosts,
  useClients,
} from "@/lib/api/use-entity";
import { useToast } from "@/components/ui/toast";
import type { Client, Employee, ClientGanttItem, SocialPost } from "@/lib/db/schema";

interface TabSocialProps {
  client: Client;
  employees: Employee[];
}

type SocialLinkKey =
  | "facebookPageUrl"
  | "instagramProfileUrl"
  | "tiktokProfileUrl"
  | "linkedinUrl"
  | "youtubeUrl"
  | "websiteUrl";

interface SocialLinkConfig {
  key: SocialLinkKey;
  label: string;
  icon: string;
  placeholder: string;
}

const SOCIAL_LINKS: SocialLinkConfig[] = [
  {
    key: "facebookPageUrl",
    label: "Facebook",
    icon: "f",
    placeholder: "https://facebook.com/...",
  },
  {
    key: "instagramProfileUrl",
    label: "Instagram",
    icon: "📷",
    placeholder: "https://instagram.com/...",
  },
  {
    key: "tiktokProfileUrl",
    label: "TikTok",
    icon: "🎵",
    placeholder: "https://tiktok.com/...",
  },
  {
    key: "linkedinUrl",
    label: "LinkedIn",
    icon: "in",
    placeholder: "https://linkedin.com/...",
  },
  {
    key: "youtubeUrl",
    label: "YouTube",
    icon: "▶",
    placeholder: "https://youtube.com/...",
  },
  {
    key: "websiteUrl",
    label: "Website",
    icon: "🌐",
    placeholder: "https://...",
  },
];

interface ABTest {
  id: string;
  originalText: string;
  winningVariation: string;
  performanceDelta: number;
}

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `לפני ${diffMins} דקות`;
  if (diffHours < 24) return `לפני ${diffHours} שעות`;
  if (diffDays < 7) return `לפני ${diffDays} ימים`;

  const months = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
};

const getStatusColor = (
  status: string
): { bg: string; text: string; label: string } => {
  const statusMap: Record<string, { bg: string; text: string; label: string }> = {
    draft: { bg: "#4b5563", text: "#e0e6ed", label: "טיוטה" },
    pending: { bg: "#d4a500", text: "#1a1a1a", label: "ממתין" },
    approved: { bg: "#10b981", text: "#ffffff", label: "אושר" },
    published: { bg: "#00B5FE", text: "#ffffff", label: "פורסם" },
    scheduled: { bg: "#8b5cf6", text: "#ffffff", label: "מתוזמן" },
    submitted_for_approval: {
      bg: "#f59e0b",
      text: "#ffffff",
      label: "ממתין לאישור",
    },
    returned_for_changes: {
      bg: "#ef4444",
      text: "#ffffff",
      label: "חזר לשינויים",
    },
  };
  return (
    statusMap[status] || { bg: "#6b7280", text: "#f3f4f6", label: "לא ידוע" }
  );
};

const getPlatformBadgeColor = (platform: string): string => {
  const colors: Record<string, string> = {
    facebook: "#1877F2",
    instagram: "#E4405F",
    tiktok: "#000000",
    all: "#00B5FE",
  };
  return colors[platform] || "#6b7280";
};

export default function TabSocial({ client, employees }: TabSocialProps) {
  const { data: ganttItems } = useClientGanttItems();
  const { data: socialPosts } = useSocialPosts();
  const { update: updateClient } = useClients();
  const toast = useToast();

  const [editingField, setEditingField] = useState<SocialLinkKey | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [abTests, setAbTests] = useState<ABTest[]>([]);
  const [abLoading, setAbLoading] = useState(false);

  // Fetch A/B tests on mount
  useEffect(() => {
    const fetchABTests = async () => {
      setAbLoading(true);
      try {
        const response = await fetch(
          `/api/ai/ab-testing?clientId=${client.id}`
        );
        if (response.ok) {
          const data = await response.json();
          setAbTests(Array.isArray(data) ? data.slice(0, 3) : []);
        }
      } catch (error) {
        console.error("Error fetching A/B tests:", error);
      } finally {
        setAbLoading(false);
      }
    };
    fetchABTests();
  }, [client.id]);

  // Filter gantt items and social posts for this client
  const clientGanttItems = (ganttItems || []).filter(
    (g) => g.clientId === client.id
  );
  const clientSocialPosts = (socialPosts || []).filter(
    (p) => p.clientId === client.id
  );

  // Count stats
  const totalCreated = clientGanttItems.length;
  const totalPublished = clientSocialPosts.filter(
    (p) => p.status === "published"
  ).length;
  const totalPending = clientGanttItems.filter(
    (g) => g.status === "submitted_for_approval"
  ).length;

  // Recent posts (last 10, sorted by date descending)
  const recentPosts = [...clientGanttItems, ...clientSocialPosts]
    .sort((a, b) => {
      const dateA = new Date(
        (a as any).date || (a as any).publishedAt || a.createdAt || ""
      ).getTime();
      const dateB = new Date(
        (b as any).date || (b as any).publishedAt || b.createdAt || ""
      ).getTime();
      return dateB - dateA;
    })
    .slice(0, 10);

  const handleSaveLink = async (fieldName: SocialLinkKey, value: string) => {
    if (!value.trim()) {
      toast("אנא הזן כתובת תקינה", "error");
      return;
    }

    setIsSaving(true);
    try {
      await updateClient(client.id, { [fieldName]: value });
      toast("הקישור עודכן בהצלחה", "success");
      setEditingField(null);
      setEditingValue("");
    } catch (error) {
      toast("שגיאה בעדכון הקישור", "error");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const startEditingLink = (fieldName: SocialLinkKey, currentValue: string) => {
    setEditingField(fieldName);
    setEditingValue(currentValue || "");
  };

  const getLinkValue = (key: SocialLinkKey): string => {
    return (client[key as keyof Client] as string) || "";
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "2rem",
      }}
    >
      {/* Social Links Section */}
      <div
        style={{
          background: "var(--surface-raised)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
          padding: "1.5rem",
        }}
      >
        <h3
          style={{
            fontSize: "0.95rem",
            fontWeight: 600,
            color: "var(--foreground)",
            margin: "0 0 1.5rem 0",
          }}
        >
          📱 קישורים לרשתות חברתיות
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "1rem",
          }}
        >
          {SOCIAL_LINKS.map((linkConfig) => {
            const currentValue = getLinkValue(linkConfig.key);
            const isEditing = editingField === linkConfig.key;

            return (
              <div
                key={linkConfig.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.875rem",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.5rem",
                  direction: "rtl",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "32px",
                    height: "32px",
                    borderRadius: "0.375rem",
                    background: "#00B5FE20",
                    color: "#00B5FE",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {linkConfig.icon}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    gap: "0.25rem",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "var(--foreground-muted)",
                    }}
                  >
                    {linkConfig.label}
                  </div>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      placeholder={linkConfig.placeholder}
                      style={{
                        padding: "0.375rem 0.5rem",
                        fontSize: "0.75rem",
                        background: "var(--surface-raised)",
                        border: "1px solid var(--accent)",
                        borderRadius: "0.375rem",
                        color: "var(--foreground)",
                      }}
                      autoFocus
                    />
                  ) : currentValue ? (
                    <a
                      href={currentValue.startsWith("http") ? currentValue : `https://${currentValue}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={currentValue}
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--accent)",
                        textDecoration: "none",
                        wordBreak: "break-all",
                        cursor: "pointer",
                      }}
                    >
                      {currentValue.replace(/^https?:\/\//, "")}
                    </a>
                  ) : (
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--foreground-muted)",
                      }}
                    >
                      לא מוגדר
                    </div>
                  )}
                </div>
                {isEditing ? (
                  <div style={{ display: "flex", gap: "0.25rem", flexShrink: 0 }}>
                    <button
                      onClick={() =>
                        handleSaveLink(linkConfig.key, editingValue)
                      }
                      disabled={isSaving}
                      style={{
                        padding: "0.375rem 0.5rem",
                        background: "#10b981",
                        color: "white",
                        border: "none",
                        borderRadius: "0.375rem",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        cursor: isSaving ? "not-allowed" : "pointer",
                        opacity: isSaving ? 0.6 : 1,
                      }}
                    >
                      💾
                    </button>
                    <button
                      onClick={() => setEditingField(null)}
                      style={{
                        padding: "0.375rem 0.5rem",
                        background: "#6b7280",
                        color: "white",
                        border: "none",
                        borderRadius: "0.375rem",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() =>
                      startEditingLink(linkConfig.key, currentValue)
                    }
                    title="ערוך"
                    style={{
                      padding: "0.375rem 0.5rem",
                      background: "transparent",
                      color: "var(--accent)",
                      border: "none",
                      borderRadius: "0.375rem",
                      fontSize: "0.875rem",
                      cursor: "pointer",
                      opacity: 0.7,
                      transition: "opacity 150ms",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.opacity = "1";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.opacity = "0.7";
                    }}
                  >
                    ✎
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Social Stats Overview */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "1rem",
        }}
      >
        {/* Posts Created */}
        <div
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "var(--accent)",
              marginBottom: "0.5rem",
            }}
          >
            {totalCreated}
          </div>
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--foreground-muted)",
              fontWeight: 500,
            }}
          >
            פוסטים שנוצרו
          </div>
        </div>

        {/* Posts Published */}
        <div
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "#10b981",
              marginBottom: "0.5rem",
            }}
          >
            {totalPublished}
          </div>
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--foreground-muted)",
              fontWeight: 500,
            }}
          >
            פוסטים שפורסמו
          </div>
        </div>

        {/* Pending Approval */}
        <div
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "#f59e0b",
              marginBottom: "0.5rem",
            }}
          >
            {totalPending}
          </div>
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--foreground-muted)",
              fontWeight: 500,
            }}
          >
            ממתינים לאישור
          </div>
        </div>
      </div>

      {/* Recent Posts Feed */}
      <div
        style={{
          background: "var(--surface-raised)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
          padding: "1.5rem",
        }}
      >
        <h3
          style={{
            fontSize: "0.95rem",
            fontWeight: 600,
            color: "var(--foreground)",
            margin: "0 0 1rem 0",
          }}
        >
          📰 פוסטים אחרונים
        </h3>
        {recentPosts.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "2rem",
              color: "var(--foreground-muted)",
            }}
          >
            אין פוסטים עדיין
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            {recentPosts.map((item: any, idx: number) => {
              const isPlatformItem = (item: any): item is ClientGanttItem =>
                "itemType" in item;
              const isSocialPost = (item: any): item is SocialPost =>
                "postType" in item;

              const platform = isPlatformItem(item)
                ? item.platform
                : isSocialPost(item)
                  ? item.platform
                  : "all";
              const status = isPlatformItem(item) ? item.status : item.status;
              const content = isPlatformItem(item)
                ? item.caption || item.ideaSummary
                : item.content;
              const publishDate = isPlatformItem(item) ? item.date : item.publishedAt || item.scheduledAt || item.createdAt;
              const statusColor = getStatusColor(status);
              const platformColor = getPlatformBadgeColor(platform);

              return (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    gap: "1rem",
                    padding: "0.875rem",
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.5rem",
                    cursor: "pointer",
                    transition: "all 150ms",
                    direction: "rtl",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor =
                      "var(--accent)";
                    (e.currentTarget as HTMLElement).style.background =
                      "#00B5FE10";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor =
                      "var(--border)";
                    (e.currentTarget as HTMLElement).style.background =
                      "var(--surface)";
                  }}
                >
                  <div style={{ display: "flex", gap: "0.75rem", flex: 1 }}>
                    {/* Date */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "flex-start",
                        minWidth: "60px",
                        fontSize: "0.7rem",
                        color: "var(--foreground-muted)",
                      }}
                    >
                      <div>{formatDate(publishDate)}</div>
                    </div>

                    {/* Platform Badge */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: "40px",
                        height: "40px",
                        background: platformColor + "20",
                        color: platformColor,
                        borderRadius: "0.375rem",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      {platform === "all"
                        ? "✦"
                        : platform === "facebook"
                          ? "f"
                          : platform === "instagram"
                            ? "📷"
                            : "🎵"}
                    </div>

                    {/* Content Preview */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.25rem",
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--foreground)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {content
                          ? content.substring(0, 100) +
                            (content.length > 100 ? "..." : "")
                          : "ללא תוכן"}
                      </div>
                      {isPlatformItem(item) && (
                        <div
                          style={{
                            fontSize: "0.7rem",
                            color: "var(--foreground-muted)",
                          }}
                        >
                          {item.itemType === "social_post"
                            ? "פוסט"
                            : item.itemType === "story"
                              ? "סטורי"
                              : item.itemType === "reel"
                                ? "ריל"
                                : item.itemType === "carousel"
                                  ? "קרוסלה"
                                  : "משימה"}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        padding: "0.375rem 0.625rem",
                        background: statusColor.bg,
                        color: statusColor.text,
                        borderRadius: "0.375rem",
                        fontSize: "0.7rem",
                        fontWeight: 600,
                      }}
                    >
                      {statusColor.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* A/B Testing Results */}
      <div
        style={{
          background: "var(--surface-raised)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
          padding: "1.5rem",
        }}
      >
        <h3
          style={{
            fontSize: "0.95rem",
            fontWeight: 600,
            color: "var(--foreground)",
            margin: "0 0 1.5rem 0",
          }}
        >
          🧪 בדיקות A/B
        </h3>
        {abLoading ? (
          <div
            style={{
              textAlign: "center",
              padding: "2rem",
              color: "var(--foreground-muted)",
            }}
          >
            טוען...
          </div>
        ) : abTests.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "2rem",
              color: "var(--foreground-muted)",
            }}
          >
            אין בדיקות A/B עדיין
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            {abTests.map((test: ABTest, idx: number) => (
              <div
                key={idx}
                style={{
                  padding: "1rem",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.5rem",
                  direction: "rtl",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "1rem",
                    marginBottom: "0.75rem",
                  }}
                >
                  {/* Original */}
                  <div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "var(--foreground-muted)",
                        marginBottom: "0.375rem",
                      }}
                    >
                      הטקסט המקורי
                    </div>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--foreground)",
                        padding: "0.5rem",
                        background: "#00000020",
                        borderRadius: "0.375rem",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {test.originalText}
                    </div>
                  </div>

                  {/* Winning */}
                  <div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "var(--foreground-muted)",
                        marginBottom: "0.375rem",
                      }}
                    >
                      הגרסה המנצחת ✓
                    </div>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "#10b981",
                        padding: "0.5rem",
                        background: "#10b98120",
                        borderRadius: "0.375rem",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {test.winningVariation}
                    </div>
                  </div>
                </div>

                {/* Performance Delta */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontSize: "0.75rem",
                  }}
                >
                  <span style={{ color: "var(--foreground-muted)" }}>
                    שיפור:
                  </span>
                  <span
                    style={{
                      fontWeight: 600,
                      color: test.performanceDelta > 0 ? "#10b981" : "#ef4444",
                    }}
                  >
                    {test.performanceDelta > 0 ? "+" : ""}
                    {(test.performanceDelta * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
