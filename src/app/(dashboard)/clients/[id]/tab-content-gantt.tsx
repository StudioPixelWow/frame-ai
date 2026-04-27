"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import type { Client, Employee, ClientGanttItem } from "@/lib/db/schema";
import { useClientGanttItems, useTasks, useEmployees, useProjects, useEmployeeTasks } from "@/lib/api/use-entity";
import { useToast } from "@/components/ui/toast";
import { fetchReferences, getStyleLabel, isDemoReference, type ReferenceItem, type ReferenceQuery } from "@/lib/gantt/reference-engine";

const HEB_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

const HEB_WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const GANTT_STATUS_COLORS: Record<string, { label: string; color: string }> = {
  new_idea: { label: "חדש", color: "#a855f7" },
  draft: { label: "טיוטה", color: "#6b7280" },
  planned: { label: "מתוכנן", color: "#3b82f6" },
  in_progress: { label: "בעבודה", color: "#f59e0b" },
  submitted_for_approval: { label: "ממתין לאישור", color: "#0092cc" },
  returned_for_changes: { label: "חזר לתיקון", color: "#f97316" },
  approved: { label: "מאושר", color: "#22c55e" },
  scheduled: { label: "מתוזמן", color: "#06b6d4" },
  published: { label: "פורסם", color: "#15803d" },
  cancelled: { label: "בוטל", color: "#ef4444" },
  none: { label: "לא יוצר", color: "#9ca3af" },
};

const RESEARCH_SOURCE_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  weakness: { label: "חולשה", emoji: "⚠️", color: "#ef4444" },
  opportunity: { label: "הזדמנות", emoji: "🚀", color: "#22c55e" },
  competitor: { label: "מתחרה", emoji: "🧲", color: "#3b82f6" },
  audience: { label: "קהל", emoji: "👥", color: "#0092cc" },
  campaign_concept: { label: "קמפיין", emoji: "🎯", color: "#f59e0b" },
  content_angle: { label: "זווית תוכן", emoji: "💡", color: "#f97316" },
};

const ITEM_TYPE_CONFIG: Record<string, { emoji: string; label: string; color: string }> = {
  social_post: { emoji: "📱", label: "פוסט", color: "#3b82f6" },
  story: { emoji: "📸", label: "סטורי", color: "#ec4899" },
  reel: { emoji: "🎬", label: "ריל", color: "#f59e0b" },
  carousel: { emoji: "🖼️", label: "קרוסלה", color: "#10b981" },
  internal_task: { emoji: "🏢", label: "פנימי", color: "#0092cc" },
  campaign_task: { emoji: "📣", label: "קמפיין", color: "#f97316" },
};

const PLATFORM_COLORS: Record<string, string> = {
  facebook: "#1877F2",
  instagram: "#E4405F",
  tiktok: "#000000",
  all: "#3b82f6",
};

const FORMAT_CONFIG: Record<string, string> = {
  image: "תמונה",
  video: "וידאו",
  story: "סטורי",
  reel: "ריל",
  carousel: "קרוסלה",
  live: "לייב",
  text: "טקסט",
};

const TASK_TYPE_CONFIG: Record<string, { emoji: string; label: string; color: string }> = {
  internal: { emoji: "🏢", label: "פנימי", color: "#0092cc" },
  design: { emoji: "🎨", label: "עיצוב", color: "#ec4899" },
  website: { emoji: "🌐", label: "אתר", color: "#10b981" },
  branding: { emoji: "✨", label: "מיתוג", color: "#f59e0b" },
  social: { emoji: "📱", label: "סושיאל", color: "#3b82f6" },
  general: { emoji: "📋", label: "כללי", color: "#6b7280" },
};

const KANBAN_COLUMNS = [
  { key: "new_idea", label: "חדש", emoji: "✨" },
  { key: "draft", label: "טיוטה", emoji: "💡" },
  { key: "in_progress", label: "בעבודה", emoji: "⚙️" },
  { key: "submitted_for_approval", label: "ממתין לאישור", emoji: "⏳" },
  { key: "approved", label: "מאושר", emoji: "✅" },
  { key: "scheduled", label: "מתוזמן", emoji: "📅" },
  { key: "published", label: "פורסם", emoji: "🚀" },
];

// Protected statuses — items in these statuses are LOCKED during regeneration
const PROTECTED_STATUSES = new Set([
  "approved",
  "in_progress",
  "scheduled",
  "published",
  "submitted_for_approval",
]);

// Items with these statuses CAN be regenerated
const REGENERATABLE_STATUSES = new Set([
  "new_idea",
  "draft",
  "returned_for_changes",
  "cancelled",
  "none",
]);

function isItemProtected(item: ClientGanttItem, sentToTaskIds: Set<string>): boolean {
  // Protected if status is in the protected set OR if already sent to tasks
  return PROTECTED_STATUSES.has(item.status) || sentToTaskIds.has(item.id);
}

function getProtectionBadge(item: ClientGanttItem, sentToTaskIds: Set<string>): { label: string; color: string } | null {
  if (sentToTaskIds.has(item.id)) return { label: "הועבר לעבודה", color: "#3b82f6" };
  if (item.status === "approved") return { label: "אושר", color: "#22c55e" };
  if (item.status === "published") return { label: "פורסם", color: "#15803d" };
  if (item.status === "in_progress") return { label: "בעבודה", color: "#f59e0b" };
  if (item.status === "scheduled") return { label: "מתוזמן", color: "#06b6d4" };
  if (item.status === "submitted_for_approval") return { label: "ממתין לאישור", color: "#0092cc" };
  return null;
}

const TEAM_MEMBERS = ["טל זטלמן", "מאיה זטלמן", "נועם בוברין", "מיכאלה"];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const months = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDateLong(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${HEB_WEEKDAYS[d.getDay()]}, ${d.getDate()} ${HEB_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function getWeekNumber(date: Date): number {
  const firstDay = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDay.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDay.getDay() + 1) / 7);
}

function getImmediateStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

interface TabContentGanttProps {
  client: Client;
  employees: Employee[];
}

type ViewType = "list" | "calendar" | "annual" | "queue";

export default function TabContentGantt({ client, employees }: TabContentGanttProps) {
  const toast = useToast();
  const { data: ganttItemsAll = [], create: createGanttItem, update: updateGanttItem, remove: removeGanttItem, refetch: refetchGanttItems } = useClientGanttItems();
  const { data: tasksAll = [], create: createGlobalTask } = useTasks();
  const { data: allEmployees = [] } = useEmployees();
  const { create: createVideoProject } = useProjects();
  const { data: employeeTasksAll = [], create: createEmployeeTask } = useEmployeeTasks();

  const ganttItems = ganttItemsAll.filter((g) => g.clientId === client.id);
  const tasks = tasksAll.filter((t) => t.clientId === client.id);

  const [activeView, setActiveView] = useState<ViewType>("list");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [showMonthlyGenModal, setShowMonthlyGenModal] = useState(false);
  const [showAnnualGenModal, setShowAnnualGenModal] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showSendApprovalModal, setShowSendApprovalModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [ganttVersion, setGanttVersion] = useState(1);
  const [showRegenConfirmModal, setShowRegenConfirmModal] = useState(false);

  // Manual entry modal state
  const [showManualEntryModal, setShowManualEntryModal] = useState(false);
  const [manualTopic, setManualTopic] = useState("");
  const [manualDate, setManualDate] = useState("");
  const [manualContentType, setManualContentType] = useState("post");
  const [isCreatingManual, setIsCreatingManual] = useState(false);

  // Holiday injection state
  const [isInjectingHolidays, setIsInjectingHolidays] = useState(false);

  // Generation modal state
  const [genMonth, setGenMonth] = useState(new Date().getMonth());
  const [genYear, setGenYear] = useState(new Date().getFullYear());
  const [weeklyPostsCount, setWeeklyPostsCount] = useState(3);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["instagram"]);
  const [selectedFormats, setSelectedFormats] = useState<string[]>(["reel", "carousel"]);
  const [genCampaigns, setGenCampaigns] = useState("");
  const [genPrompt, setGenPrompt] = useState("");
  const [annualYear, setAnnualYear] = useState(new Date().getFullYear());
  const [annualPrompt, setAnnualPrompt] = useState("");

  // Send approval modal state
  const [selectedItemsForApproval, setSelectedItemsForApproval] = useState<Set<string>>(new Set());
  const [isSendingApproval, setIsSendingApproval] = useState(false);
  // Initialize sentToTaskIds from existing employee tasks that have ganttItemId
  const [sentToTaskIds, setSentToTaskIds] = useState<Set<string>>(() => {
    const existingGanttTaskIds = employeeTasksAll
      .filter(t => t.ganttItemId && t.clientId === client.id)
      .map(t => t.ganttItemId as string);
    return new Set(existingGanttTaskIds);
  });

  // Manual task form state
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskType, setNewTaskType] = useState("general");
  const [newTaskAssignee, setNewTaskAssignee] = useState(client.assignedManagerId || "");
  const [newTaskPriority, setNewTaskPriority] = useState("medium");
  const [newTaskStatus, setNewTaskStatus] = useState("backlog");

  // Item edit modal state
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editIdea, setEditIdea] = useState("");
  const [editGraphicText, setEditGraphicText] = useState("");
  const [editCaption, setEditCaption] = useState("");
  const [editVisualConcept, setEditVisualConcept] = useState("");
  const [editItemType, setEditItemType] = useState("social_post");
  const [editPlatform, setEditPlatform] = useState("instagram");
  const [editFormat, setEditFormat] = useState("image");
  const [editAssignee, setEditAssignee] = useState("");
  const [editStatus, setEditStatus] = useState("draft");
  const [editInternalNotes, setEditInternalNotes] = useState("");
  const [editClientNotes, setEditClientNotes] = useState("");
  const [editHolidayTag, setEditHolidayTag] = useState("");
  const [editCampaignTag, setEditCampaignTag] = useState("");
  const [editAttachedFiles, setEditAttachedFiles] = useState<string[]>([]);
  const [editImageUrls, setEditImageUrls] = useState<string[]>([]);
  const [newAttachedFilePath, setNewAttachedFilePath] = useState("");
  const [editRelatedVideoId, setEditRelatedVideoId] = useState("");

  // Reference preview state
  const [refModalOpen, setRefModalOpen] = useState(false);
  const [refModalItem, setRefModalItem] = useState<ReferenceItem | null>(null);
  const [expandedRefIds, setExpandedRefIds] = useState<Set<string>>(new Set());
  const [itemRefsMap, setItemRefsMap] = useState<Record<string, ReferenceItem[]>>({});

  /** Load references for a gantt item */
  const loadReferencesForItem = useCallback(async (item: ClientGanttItem) => {
    // Use functional state check to avoid itemRefsMap in deps (prevents infinite loop)
    setItemRefsMap(prev => {
      if (prev[item.id]) return prev; // already loaded — skip
      // Fire async fetch outside setState
      const query: ReferenceQuery = {
        ideaTitle: item.title || '',
        ideaSummary: item.ideaSummary || '',
        contentType: item.itemType || 'social_post',
        format: item.format || 'image',
        platform: item.platform || 'instagram',
        clientIndustry: client.businessField || '',
        clientName: client.name || '',
      };
      fetchReferences(query).then(refs => {
        setItemRefsMap(p => ({ ...p, [item.id]: refs }));
      }).catch(() => {});
      return { ...prev, [item.id]: [] }; // mark as loading with empty array
    });
  }, [client.businessField, client.name]);

  // Calculations
  const now = new Date();
  const currentWeek = getWeekNumber(now);
  const weekStart = getImmediateStartOfWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonth = nextMonthDate.getMonth();
  const nextYear = nextMonthDate.getFullYear();

  const monthlyItems = useMemo(
    () =>
      ganttItems.filter((item) => {
        if (!item.date || item.ganttType !== "monthly") return false;
        const d = new Date(item.date);
        return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
      }),
    [ganttItems, selectedMonth, selectedYear]
  );

  // Load references for visible monthly items on mount or when items change
  useEffect(() => {
    monthlyItems.forEach(item => {
      loadReferencesForItem(item);
    });
  }, [monthlyItems, loadReferencesForItem]);

  const calendarItems = useMemo(
    () =>
      ganttItems.filter((item) => {
        if (!item.date || item.ganttType !== "monthly") return false;
        const d = new Date(item.date);
        return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
      }),
    [ganttItems, selectedMonth, selectedYear]
  );

  // Annual view shows BOTH annual-typed items AND monthly items for the selected year
  // This ensures the annual overview reflects the same source of truth as the monthly calendar
  const annualItems = ganttItems.filter((item) => {
    if (item.ganttType === "annual" && item.year === selectedYear) return true;
    if (item.ganttType === "monthly" && item.date) {
      const d = new Date(item.date);
      return d.getFullYear() === selectedYear;
    }
    return false;
  });

  const thisWeekPosts = ganttItems.filter(
    (item) =>
      item.date &&
      new Date(item.date) >= weekStart &&
      new Date(item.date) <= weekEnd &&
      item.itemType !== "internal_task"
  ).length;

  const approvedItems = ganttItems.filter((item) => item.status === "approved" || item.status === "published").length;

  const monthsWithoutGantt = HEB_MONTHS.filter((_, idx) => {
    const hasItems = ganttItems.some((item) => {
      if (!item.date || item.ganttType !== "monthly") return false;
      const d = new Date(item.date);
      return d.getMonth() === idx && d.getFullYear() === selectedYear;
    });
    return !hasItems;
  }).length;

  // Planning health calculation
  const nextMonthItems = ganttItems.filter((item) => {
    if (!item.date || item.ganttType !== "monthly") return false;
    const d = new Date(item.date);
    return d.getMonth() === nextMonth && d.getFullYear() === nextYear;
  });

  const nextMonthApprovedItems = nextMonthItems.filter(
    (item) => item.status === "approved" || item.status === "published"
  ).length;

  const currentMonthWeeklyItems = ganttItems.filter((item) => {
    if (!item.date || item.itemType === "internal_task") return false;
    const d = new Date(item.date);
    return (
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear() &&
      d >= weekStart &&
      d <= weekEnd
    );
  }).length;

  let planningHealth: "בריא" | "חסר תכנון" | "דחוף" = "בריא";
  let healthColor = "#22c55e";
  if (nextMonthItems.length === 0) {
    planningHealth = "חסר תכנון";
    healthColor = "#f59e0b";
  } else if (currentMonthWeeklyItems < 2 && approvedItems === 0) {
    planningHealth = "דחוף";
    healthColor = "#ef4444";
  }

  // Edit item initialization
  const editingItem = editingItemId ? ganttItems.find((i) => i.id === editingItemId) : null;
  if (editingItem && editTitle === "") {
    setEditTitle(editingItem.title);
    setEditDate(editingItem.date);
    setEditIdea(editingItem.ideaSummary);
    setEditGraphicText(editingItem.graphicText);
    setEditCaption(editingItem.caption);
    setEditVisualConcept(editingItem.visualConcept || "");
    setEditItemType(editingItem.itemType);
    setEditPlatform(editingItem.platform);
    setEditFormat(editingItem.format);
    setEditAssignee(editingItem.assigneeId || "");
    setEditStatus(editingItem.status);
    setEditInternalNotes(editingItem.internalNotes);
    setEditClientNotes(editingItem.clientNotes);
    setEditHolidayTag(editingItem.holidayTag);
    setEditCampaignTag(editingItem.campaignTag);
    setEditAttachedFiles(editingItem.attachedFiles || []);
    setEditImageUrls(editingItem.imageUrls || []);
    setEditRelatedVideoId(editingItem.relatedVideoId || "");
  }

  const handleSaveGanttItem = async () => {
    if (!editingItem) return;
    try {
      await updateGanttItem(editingItem.id, {
        title: editTitle,
        date: editDate,
        ideaSummary: editIdea,
        graphicText: editGraphicText,
        caption: editCaption,
        visualConcept: editVisualConcept,
        itemType: editItemType,
        platform: editPlatform,
        format: editFormat,
        assigneeId: editAssignee || null,
        status: editStatus,
        internalNotes: editInternalNotes,
        clientNotes: editClientNotes,
        holidayTag: editHolidayTag,
        campaignTag: editCampaignTag,
        attachedFiles: editAttachedFiles,
        imageUrls: editImageUrls,
        relatedVideoId: editRelatedVideoId || "",
      } as any);
      setEditingItemId(null);
      setEditTitle("");
      setEditDate("");
      setEditIdea("");
      setEditGraphicText("");
      setEditCaption("");
      setEditVisualConcept("");
      setEditItemType("social_post");
      setEditPlatform("instagram");
      setEditFormat("image");
      setEditAssignee("");
      setEditStatus("draft");
      setEditInternalNotes("");
      setEditClientNotes("");
      setEditHolidayTag("");
      setEditCampaignTag("");
      setEditAttachedFiles([]);
      setEditImageUrls([]);
      setNewAttachedFilePath("");
      toast("הפריט נשמר בהצלחה", "success");
    } catch (err) {
      console.error(err);
      toast("שגיאה בשמירת הפריט", "error");
    }
  };

  const handleDeleteGanttItem = async (id: string) => {
    if (!confirm("האם אתה בטוח שברצונך למחוק פריט זה?")) return;
    try {
      await removeGanttItem(id);
      setEditingItemId(null);
      toast("הפריט נמחק בהצלחה", "success");
    } catch (err) {
      console.error(err);
      toast("שגיאה במחיקת הפריט", "error");
    }
  };

  const handleChangeStatus = async (id: string, newStatus: string) => {
    try {
      await updateGanttItem(id, { status: newStatus } as any);
      toast("הסטטוס עודכן בהצלחה", "success");
    } catch (err) {
      console.error(err);
      toast("שגיאה בעדכון הסטטוס", "error");
    }
  };

  const handleSendToTask = async (ganttItem: ClientGanttItem) => {
    try {
      // === Duplicate prevention ===
      // Check local state
      if (sentToTaskIds.has(ganttItem.id)) {
        console.warn(`[SendToTask] Duplicate blocked (local): ganttItem ${ganttItem.id}`);
        toast("משימה כבר נוצרה עבור פריט זה", "warning");
        return;
      }
      // Check DB for existing task with this ganttItemId
      const existingTask = employeeTasksAll.find(t => t.ganttItemId === ganttItem.id);
      if (existingTask) {
        console.warn(`[SendToTask] Duplicate blocked (DB): ganttItem ${ganttItem.id} → task ${existingTask.id}`);
        setSentToTaskIds(new Set([...sentToTaskIds, ganttItem.id]));
        toast("משימה כבר קיימת עבור פריט זה", "warning");
        return;
      }

      // === Resolve assignee ===
      // Priority: 1. ganttItem.assigneeId  2. client.assignedManagerId  3. warn + no assignee
      let assigneeId = '';
      let assigneeName = '';
      if (ganttItem.assigneeId) {
        assigneeId = ganttItem.assigneeId;
        const emp = allEmployees.find(e => e.id === ganttItem.assigneeId);
        assigneeName = emp?.name || ganttItem.assigneeId;
      } else if (client.assignedManagerId) {
        assigneeId = client.assignedManagerId;
        const emp = allEmployees.find(e => e.id === client.assignedManagerId);
        assigneeName = emp?.name || client.assignedManagerId;
      }

      if (!assigneeId) {
        console.warn(`[SendToTask] No assignee found for ganttItem ${ganttItem.id}. Client ${client.id} has no assignedManagerId.`);
        toast("⚠️ לא נמצא עובד מוקצה — המשימה נוצרה ללא שיוך", "warning");
      }

      console.log(`[SendToTask] Creating task for ganttItem ${ganttItem.id}:`, {
        assigneeId,
        assigneeName,
        clientId: client.id,
        title: ganttItem.title,
        platform: ganttItem.platform,
        format: ganttItem.format,
      });

      // === Calculate due date: 2 days before publish date ===
      const publishDate = new Date(ganttItem.date);
      const dueDate = new Date(publishDate);
      dueDate.setDate(dueDate.getDate() - 2);
      const dueDateStr = dueDate.toISOString().split('T')[0];

      // === Build full content payload ===
      const fullDescription = [
        ganttItem.ideaSummary && `📝 סיכום: ${ganttItem.ideaSummary}`,
        ganttItem.graphicText && `🎨 טקסט לגרפיקה:\n${ganttItem.graphicText}`,
        ganttItem.caption && `💬 כיתוב:\n${ganttItem.caption}`,
        ganttItem.visualConcept && `🖼️ קונספט ויזואלי:\n${ganttItem.visualConcept}`,
        `📅 פלטפורמה: ${ganttItem.platform} | פורמט: ${ganttItem.format}`,
        ganttItem.holidayTag && `🎉 חג/אירוע: ${ganttItem.holidayTag}`,
        ganttItem.researchSource && `🔬 מקור מחקרי: ${ganttItem.researchSource}${ganttItem.researchReason ? ' — ' + ganttItem.researchReason : ''}`,
      ].filter(Boolean).join('\n\n');

      // === Save to Employee Tasks store ===
      await createEmployeeTask({
        title: ganttItem.title || 'משימה מגאנט',
        description: fullDescription,
        clientId: client.id,
        clientName: client.name,
        ganttItemId: ganttItem.id,
        dueDate: dueDateStr,
        status: 'new',
        priority: 'medium',
        assignedEmployeeId: assigneeId,
        projectId: null,
        files: ganttItem.attachedFiles || [],
        notes: ganttItem.internalNotes || '',
      } as any);

      // === Also save to Global Tasks store ===
      try {
        await createGlobalTask({
          title: ganttItem.title || 'משימה מגאנט',
          description: fullDescription,
          clientId: client.id,
          clientName: client.name,
          assigneeIds: assigneeId ? [assigneeId] : [],
          dueDate: dueDateStr,
          status: 'new',
          priority: 'medium',
          ganttItemId: ganttItem.id,
        } as any);
      } catch (globalErr) {
        console.warn('[SendToTask] Failed to create global task (non-critical):', globalErr);
      }

      setSentToTaskIds(new Set([...sentToTaskIds, ganttItem.id]));
      const successMsg = assigneeId
        ? `✅ משימה נוצרה ושויכה ל-${assigneeName}`
        : `✅ משימה נוצרה (ללא שיוך עובד)`;
      toast(successMsg, "success");

      console.log(`[SendToTask] ✅ Task created successfully for ganttItem ${ganttItem.id} → assignee: ${assigneeId || 'NONE'}`);
    } catch (err) {
      console.error('[SendToTask] Error creating task:', err);
      toast("שגיאה בהעברת הפריט למשימה", "error");
    }
  };

  const handleSendForApproval = async () => {
    if (selectedItemsForApproval.size === 0) return;
    setIsSendingApproval(true);
    try {
      // Update status for selected items
      const itemsToUpdate = Array.from(selectedItemsForApproval);
      await Promise.all(
        itemsToUpdate.map((itemId) =>
          handleChangeStatus(itemId, "submitted_for_approval")
        )
      );

      // Send email
      const res = await fetch(`/api/clients/${client.id}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "gantt_approval",
          itemIds: itemsToUpdate,
          month: selectedMonth + 1,
          year: selectedYear,
        }),
      });
      if (!res.ok) throw new Error("Failed to send approval request");
      setShowSendApprovalModal(false);
      setSelectedItemsForApproval(new Set());
      toast("הבקשה נשלחה לאישור", "success");
    } catch (err) {
      console.error(err);
      toast("שגיאה בשליחת בקשת האישור", "error");
    } finally {
      setIsSendingApproval(false);
    }
  };

  const handleGenerateMonthly = async () => {
    setIsGenerating(true);
    try {
      console.log("[Gantt Monthly] Starting generation for client:", client.id, client.name);
      console.log("[Gantt Monthly] Params:", { month: genMonth + 1, year: genYear, weeklyPosts: weeklyPostsCount, platforms: selectedPlatforms, formats: selectedFormats });
      const res = await fetch(`/api/clients/${client.id}/generate-gantt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: genMonth + 1,
          year: genYear,
          weeklyPosts: weeklyPostsCount,
          platforms: selectedPlatforms,
          formats: selectedFormats,
          campaigns: genCampaigns,
          customPrompt: genPrompt,
        }),
      });
      const data = await res.json();
      console.log("[Gantt Monthly] Response status:", res.status, "data:", data);
      if (!res.ok) {
        const errMsg = data?.error || "שגיאה ביצירת הגאנט";
        throw new Error(errMsg);
      }
      console.log("[Gantt Monthly] Items created:", data?.items?.length ?? data?.count ?? "unknown");
      setShowMonthlyGenModal(false);
      // Reset form
      setGenMonth(new Date().getMonth());
      setGenYear(new Date().getFullYear());
      setWeeklyPostsCount(3);
      setSelectedPlatforms(["instagram"]);
      setSelectedFormats(["reel", "carousel"]);
      setGenCampaigns("");
      setGenPrompt("");
      await refetchGanttItems();
      toast(`הגאנט נוצר בהצלחה — ${data?.items?.length ?? ""} פריטים`, "success");
    } catch (err: any) {
      console.error("[Gantt Monthly] Error:", err);
      toast(err?.message || "שגיאה ביצירת הגאנט", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  // Classify monthly items into protected vs regeneratable
  const protectedItems = useMemo(
    () => monthlyItems.filter((item) => isItemProtected(item, sentToTaskIds)),
    [monthlyItems, sentToTaskIds]
  );
  const regeneratableItems = useMemo(
    () => monthlyItems.filter((item) => !isItemProtected(item, sentToTaskIds)),
    [monthlyItems, sentToTaskIds]
  );

  // Regenerate gantt — only replace non-approved/non-worked items
  const handleRegenerateMonthly = async () => {
    if (monthlyItems.length === 0) {
      toast("אין גאנט קיים לייצור מחדש", "warning");
      return;
    }

    // If there are protected items, show confirmation modal first
    if (protectedItems.length > 0 && !showRegenConfirmModal) {
      setShowRegenConfirmModal(true);
      return;
    }

    // If ALL items are protected, nothing to regenerate
    if (regeneratableItems.length === 0) {
      toast("כל הפריטים אושרו או בעבודה — אין מה לייצר מחדש", "warning");
      setShowRegenConfirmModal(false);
      return;
    }

    setShowRegenConfirmModal(false);
    setIsRegenerating(true);
    const newVersion = ganttVersion + 1;
    try {
      const protectedIds = protectedItems.map((item) => item.id);
      const deleteIds = regeneratableItems.map((item) => item.id);
      const protectedDates = protectedItems.map((item) => item.date).filter(Boolean);
      const excludeTitles = [
        ...protectedItems.map((item) => item.title),
        ...regeneratableItems.map((item) => item.title), // also exclude discarded titles
      ].filter(Boolean);

      console.log(`[Gantt Regen] Starting selective regeneration v${newVersion} for client:`, client.id, {
        month: `${selectedMonth + 1}/${selectedYear}`,
        protected: protectedIds.length,
        toRegenerate: deleteIds.length,
        protectedDates,
        excludeTitles: excludeTitles.length,
      });
      toast(`מייצר ${deleteIds.length} פריטים חדשים (${protectedIds.length} נשמרים)...`, "info");

      const res = await fetch(`/api/clients/${client.id}/generate-gantt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: selectedMonth + 1,
          year: selectedYear,
          weeklyPosts: 3,
          platforms: ["instagram", "facebook"],
          formats: ["reel", "carousel", "image"],
          ganttVersion: newVersion,
          isRegeneration: true,
          protectedItemIds: protectedIds,
          deleteItemIds: deleteIds,
          protectedDates,
          excludeTitles,
        }),
      });
      const data = await res.json();
      console.log("[Gantt Regen] Response:", res.status, data);
      if (!res.ok) {
        throw new Error(data?.error || "שגיאה בייצור מחדש");
      }
      setGanttVersion(newVersion);
      await refetchGanttItems();
      const researchPct = data?.generationMeta?.researchUsagePct || 0;
      const regenMeta = data?.generationMeta?.selectiveRegeneration;
      const regenMsg = regenMeta
        ? `${regenMeta.protectedItems} נשמרו, ${regenMeta.regeneratedItems} חדשים`
        : `${data?.items?.length ?? ""} פריטים`;
      toast(`גאנט v${newVersion} — ${regenMsg} (${researchPct}% מבוסס מחקר)`, "success");
    } catch (err: any) {
      console.error("[Gantt Regen] Error:", err);
      toast(err?.message || "שגיאה בייצור מחדש", "error");
    } finally {
      setIsRegenerating(false);
    }
  };

  // Manual entry handler — creates a gantt item with AI-generated content from a user topic
  const handleManualEntry = async () => {
    if (!manualTopic.trim()) {
      toast("יש להזין נושא / רעיון", "warning");
      return;
    }
    setIsCreatingManual(true);
    try {
      const res = await fetch(`/api/clients/${client.id}/sync-ideas-to-gantt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: selectedMonth + 1,
          year: selectedYear,
          manualTopic: manualTopic.trim(),
          manualDate: manualDate || undefined,
          manualContentType: manualContentType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "שגיאה ביצירת הרשומה");
      setShowManualEntryModal(false);
      setManualTopic("");
      setManualDate("");
      setManualContentType("post");
      await refetchGanttItems();
      toast("✔ הרשומה נוצרה והושלמה על ידי AI", "success");
    } catch (err: any) {
      console.error("[ManualEntry]", err);
      toast(err?.message || "שגיאה ביצירת רשומה ידנית", "error");
    } finally {
      setIsCreatingManual(false);
    }
  };

  // Holiday auto-injection handler
  const handleInjectHolidays = async () => {
    setIsInjectingHolidays(true);
    try {
      const res = await fetch(`/api/clients/${client.id}/sync-ideas-to-gantt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: selectedMonth + 1,
          year: selectedYear,
          injectHolidays: true,
          ideas: [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "שגיאה בהזרקת חגים");
      await refetchGanttItems();
      if (data.items?.length > 0) {
        toast(`✔ ${data.items.length} חגים נוספו לגאנט (${data.skipped || 0} כבר קיימים)`, "success");
      } else {
        toast(`אין חגים חדשים להוסיף ל${selectedMonth + 1 > 12 ? 'חודש זה' : 'חודש זה'} (${data.skipped || 0} כבר קיימים)`, "info");
      }
    } catch (err: any) {
      console.error("[InjectHolidays]", err);
      toast(err?.message || "שגיאה בהזרקת חגים", "error");
    } finally {
      setIsInjectingHolidays(false);
    }
  };

  const handleGenerateAnnual = async () => {
    setIsGenerating(true);
    try {
      console.log("[Gantt Annual] Starting generation for client:", client.id, client.name);
      console.log("[Gantt Annual] Params:", { year: annualYear, customPrompt: annualPrompt });
      const res = await fetch(`/api/clients/${client.id}/generate-annual-gantt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: annualYear,
          customPrompt: annualPrompt,
        }),
      });
      const data = await res.json();
      console.log("[Gantt Annual] Response status:", res.status, "data:", data);
      if (!res.ok) {
        const errMsg = data?.error || "שגיאה ביצירת הגאנט השנתי";
        throw new Error(errMsg);
      }
      console.log("[Gantt Annual] Items created:", data?.items?.length ?? data?.count ?? "unknown");
      setShowAnnualGenModal(false);
      setAnnualYear(new Date().getFullYear());
      setAnnualPrompt("");
      await refetchGanttItems();
      toast(`הגאנט השנתי נוצר בהצלחה — ${data?.items?.length ?? ""} פריטים`, "success");
    } catch (err: any) {
      console.error("[Gantt Annual] Error:", err);
      toast(err?.message || "שגיאה ביצירת הגאנט השנתי", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    try {
      await createGlobalTask({
        clientId: client.id,
        clientName: client.name,
        title: newTaskTitle,
        description: newTaskDescription,
        dueDate: newTaskDueDate || null,
        tags: [newTaskType],
        assigneeIds: newTaskAssignee ? [newTaskAssignee] : [],
        priority: newTaskPriority,
        status: newTaskStatus === 'backlog' ? 'new' : newTaskStatus,
        files: [],
        notes: "",
      } as any);
      setShowAddTask(false);
      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskDueDate("");
      setNewTaskType("general");
      setNewTaskAssignee(client.assignedManagerId || "");
      setNewTaskPriority("medium");
      setNewTaskStatus("backlog");
      toast("המשימה נוצרה בהצלחה", "success");
    } catch (err) {
      console.error(err);
      toast("שגיאה ביצירת המשימה", "error");
    }
  };

  // Render functions
  const renderStatusBadge = (status: string) => {
    const info = GANTT_STATUS_COLORS[status] || GANTT_STATUS_COLORS.none;
    return (
      <span
        style={{
          fontSize: "0.7rem",
          fontWeight: 600,
          padding: "0.25rem 0.5rem",
          borderRadius: 4,
          background: `${info.color}15`,
          color: info.color,
          border: `1px solid ${info.color}30`,
          display: "inline-block",
          whiteSpace: "nowrap",
        }}
      >
        {info.label}
      </span>
    );
  };

  const renderTypeBadge = (type: string) => {
    const config = ITEM_TYPE_CONFIG[type];
    if (!config) return null;
    return (
      <span
        style={{
          fontSize: "0.75rem",
          fontWeight: 500,
          padding: "0.25rem 0.5rem",
          borderRadius: 4,
          background: `${config.color}15`,
          color: config.color,
          display: "inline-block",
        }}
      >
        {config.emoji} {config.label}
      </span>
    );
  };

  const renderPlatformBadge = (platform: string) => {
    const color = PLATFORM_COLORS[platform] || "#6b7280";
    const labels: Record<string, string> = {
      facebook: "FB",
      instagram: "IG",
      tiktok: "TK",
      all: "הכל",
    };
    return (
      <span
        style={{
          fontSize: "0.65rem",
          fontWeight: 600,
          padding: "0.2rem 0.45rem",
          borderRadius: 3,
          background: `${color}20`,
          color: color,
          display: "inline-block",
        }}
      >
        {labels[platform] || platform}
      </span>
    );
  };

  const renderFormatBadge = (format: string) => {
    return (
      <span
        style={{
          fontSize: "0.65rem",
          fontWeight: 500,
          padding: "0.2rem 0.45rem",
          borderRadius: 3,
          background: "#06b6d415",
          color: "#06b6d4",
          display: "inline-block",
        }}
      >
        {FORMAT_CONFIG[format] || format}
      </span>
    );
  };

  const getKanbanItemsForStatus = (status: string) => {
    return monthlyItems.filter((item) => item.status === status);
  };

  const getAttachmentIndicator = (item: ClientGanttItem) => {
    const hasAttachments = (item.imageUrls && item.imageUrls.length > 0) ||
                          (item.attachedFiles && item.attachedFiles.length > 0);
    return hasAttachments ? "📎" : "";
  };

  // Main render
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Summary Bar */}
      <div
        style={{
          background: "var(--surface-raised)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
          padding: "1rem",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "1rem",
        }}
      >
        <div style={{ padding: "0.75rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--foreground-muted)", marginBottom: "0.5rem" }}>
            📅 גאנט חודשי
          </div>
          <div>{renderStatusBadge(client.monthlyGanttStatus || "none")}</div>
        </div>
        <div style={{ padding: "0.75rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--foreground-muted)", marginBottom: "0.5rem" }}>
            📆 גאנט שנתי
          </div>
          <div>{renderStatusBadge(client.annualGanttStatus || "none")}</div>
        </div>
        <div style={{ padding: "0.75rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--foreground-muted)", marginBottom: "0.5rem" }}>
            📊 השבוע
          </div>
          <div style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--foreground)" }}>{thisWeekPosts}</div>
        </div>
        <div style={{ padding: "0.75rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--foreground-muted)", marginBottom: "0.5rem" }}>
            ✓ מאושר
          </div>
          <div style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--foreground)" }}>{approvedItems}</div>
        </div>
        <div style={{ padding: "0.75rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--foreground-muted)", marginBottom: "0.5rem" }}>
            ⚠️ חסרים
          </div>
          <div style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--foreground)" }}>{monthsWithoutGantt}</div>
        </div>
        <div style={{ padding: "0.75rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--foreground-muted)", marginBottom: "0.5rem" }}>
            📈 בריאות תכנון
          </div>
          <div style={{
            fontSize: "0.85rem",
            fontWeight: 600,
            color: healthColor,
            display: "inline-block",
            padding: "0.25rem 0.5rem",
            borderRadius: 4,
            background: `${healthColor}15`,
            border: `1px solid ${healthColor}30`,
          }}>
            {planningHealth}
          </div>
        </div>
        <div style={{ padding: "0.75rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--foreground-muted)", marginBottom: "0.5rem" }}>
            🗓️ החודש הבא
          </div>
          <div style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--foreground)" }}>
            {nextMonthItems.length}
            <span style={{ fontSize: "0.75rem", marginInlineStart: "0.25rem", color: "var(--foreground-muted)" }}>
              ({nextMonthApprovedItems} מאושר)
            </span>
          </div>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          flexWrap: "wrap",
          justifyContent: "flex-start",
        }}
      >
        <button
          className="mod-btn-primary"
          onClick={() => setShowMonthlyGenModal(true)}
          style={{
            fontSize: "0.8rem",
            padding: "0.5rem 1rem",
          }}
        >
          📅 צור גאנט חודשי
        </button>
        {monthlyItems.length > 0 && (
          <button
            className="mod-btn-ghost"
            onClick={handleRegenerateMonthly}
            disabled={isRegenerating || isGenerating}
            style={{
              fontSize: "0.8rem",
              padding: "0.5rem 1rem",
              opacity: isRegenerating ? 0.6 : 1,
              border: "1px solid var(--accent)",
              color: "var(--accent)",
            }}
          >
            {isRegenerating ? "⏳ מייצר מחדש..." : regeneratableItems.length < monthlyItems.length ? `🔄 ייצר ${regeneratableItems.length} מחדש (${protectedItems.length} נשמרים)` : "🔄 צור גאנט חדש"}
          </button>
        )}
        <button
          className="mod-btn-ghost"
          onClick={() => setShowAnnualGenModal(true)}
          style={{
            fontSize: "0.8rem",
            padding: "0.5rem 1rem",
          }}
        >
          📆 צור גאנט שנתי
        </button>
        <button
          className="mod-btn-ghost"
          onClick={() => setShowAddTask(!showAddTask)}
          style={{
            fontSize: "0.8rem",
            padding: "0.5rem 1rem",
          }}
        >
          📋 הוסף משימה ידנית
        </button>
        <button
          className="mod-btn-ghost"
          onClick={() => setShowSendApprovalModal(true)}
          style={{
            fontSize: "0.8rem",
            padding: "0.5rem 1rem",
          }}
        >
          📨 שלח גאנט לאישור
        </button>
        <button
          className="mod-btn-ghost"
          onClick={() => {
            window.open(`/api/clients/${client.id}/gantt-pdf?month=${selectedMonth + 1}&year=${selectedYear}`, "_blank");
          }}
          style={{
            fontSize: "0.8rem",
            padding: "0.5rem 1rem",
          }}
        >
          📄 הפק PDF
        </button>
        <button
          className="mod-btn-ghost"
          onClick={() => setShowManualEntryModal(true)}
          style={{
            fontSize: "0.8rem",
            padding: "0.5rem 1rem",
            border: "1px solid #22c55e",
            color: "#22c55e",
          }}
        >
          ✏️ הוסף רשומה ידנית
        </button>
        <button
          className="mod-btn-ghost"
          onClick={handleInjectHolidays}
          disabled={isInjectingHolidays}
          style={{
            fontSize: "0.8rem",
            padding: "0.5rem 1rem",
            opacity: isInjectingHolidays ? 0.6 : 1,
            border: "1px solid #f59e0b",
            color: "#f59e0b",
          }}
        >
          {isInjectingHolidays ? "⏳ טוען חגים..." : "🎉 הוסף חגים"}
        </button>
      </div>

      {/* View Toggle */}
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--border)", paddingBottom: "1rem" }}>
        {(["list", "calendar", "annual", "queue"] as const).map((view) => (
          <button
            key={view}
            onClick={() => setActiveView(view)}
            style={{
              fontSize: "0.8rem",
              fontWeight: activeView === view ? 600 : 500,
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              background: activeView === view ? "var(--accent-muted)" : "transparent",
              color: activeView === view ? "var(--accent)" : "var(--foreground-muted)",
              border: activeView === view ? "1px solid var(--accent)" : "1px solid transparent",
              cursor: "pointer",
              transition: "all 150ms",
            }}
          >
            {view === "list" && "📋 רשימה"}
            {view === "calendar" && "📅 לוח חודשי"}
            {view === "annual" && "📆 תצוגה שנתית"}
            {view === "queue" && "🎯 קנבן"}
          </button>
        ))}
      </div>

      {/* List View */}
      {activeView === "list" && (
        <div
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
          }}
        >
          <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--foreground)", margin: "0 0 1.5rem 0" }}>
            פריטי תוכן — {HEB_MONTHS[selectedMonth]} {selectedYear}
          </h3>

          {monthlyItems.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {monthlyItems.map((item) => {
                const protectionBadge = getProtectionBadge(item, sentToTaskIds);
                const itemIsProtected = isItemProtected(item, sentToTaskIds);
                return (
                <div
                  key={item.id}
                  style={{
                    padding: "1rem",
                    border: itemIsProtected ? `1px solid ${protectionBadge?.color || "#22c55e"}40` : "1px solid var(--border)",
                    borderRadius: "0.5rem",
                    borderLeft: `4px solid ${item.holidayTag ? "#f59e0b" : (ITEM_TYPE_CONFIG[item.itemType]?.color || "#6b7280")}`,
                    background: editingItemId === item.id ? "var(--accent-muted)" : item.holidayTag ? "rgba(245, 158, 11, 0.06)" : itemIsProtected ? `${protectionBadge?.color || "#22c55e"}08` : "transparent",
                    position: "relative",
                  }}
                >
                  {/* Protection badge for locked items */}
                  {protectionBadge && (
                    <span style={{
                      position: "absolute",
                      top: "0.5rem",
                      left: "0.5rem",
                      fontSize: "0.65rem",
                      fontWeight: 600,
                      padding: "0.1rem 0.4rem",
                      borderRadius: "0.2rem",
                      background: `${protectionBadge.color}15`,
                      color: protectionBadge.color,
                      border: `1px solid ${protectionBadge.color}30`,
                    }}>
                      {protectionBadge.label}
                    </span>
                  )}
                  {editingItemId !== item.id && (
                    <>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "0.75rem" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--foreground)" }}>
                              {item.title || "ללא כותרת"}
                            </span>
                            {getAttachmentIndicator(item) && (
                              <span style={{ fontSize: "0.8rem" }}>{getAttachmentIndicator(item)}</span>
                            )}
                          </div>
                          {item.ideaSummary && (
                            <div style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", marginBottom: "0.5rem" }}>
                              {item.ideaSummary}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                          {item.status === "new_idea" && (
                            <button
                              className="mod-btn-ghost"
                              onClick={() => {
                                handleChangeStatus(item.id, "in_progress");
                                handleSendToTask(item);
                              }}
                              style={{
                                fontSize: "0.75rem",
                                padding: "0.4rem 0.75rem",
                                color: "#22c55e",
                                fontWeight: 600,
                              }}
                              title="העבר לעבודה ויצור משימה"
                            >
                              ▶️ העבר לעבודה
                            </button>
                          )}
                          {item.status === "in_progress" && (
                            <button
                              className="mod-btn-ghost"
                              onClick={() => handleChangeStatus(item.id, "submitted_for_approval")}
                              style={{
                                fontSize: "0.75rem",
                                padding: "0.4rem 0.75rem",
                              }}
                              title="שלח לאישור"
                            >
                              🔍
                            </button>
                          )}
                          {item.status === "submitted_for_approval" && (
                            <>
                              <button
                                className="mod-btn-ghost"
                                onClick={() => handleChangeStatus(item.id, "approved")}
                                style={{
                                  fontSize: "0.75rem",
                                  padding: "0.4rem 0.75rem",
                                }}
                                title="אשר"
                              >
                                ✅
                              </button>
                              <button
                                className="mod-btn-ghost"
                                onClick={() => handleChangeStatus(item.id, "in_progress")}
                                style={{
                                  fontSize: "0.75rem",
                                  padding: "0.4rem 0.75rem",
                                }}
                                title="החזר לתיקון"
                              >
                                ↩️
                              </button>
                            </>
                          )}
                          <button
                            className="mod-btn-ghost"
                            onClick={() => setEditingItemId(item.id)}
                            style={{
                              fontSize: "0.8rem",
                              padding: "0.4rem 0.75rem",
                            }}
                            title="עריכה"
                          >
                            ✏️
                          </button>
                          {!sentToTaskIds.has(item.id) ? (
                            <button
                              className="mod-btn-ghost"
                              onClick={() => handleSendToTask(item)}
                              style={{
                                fontSize: "0.8rem",
                                padding: "0.4rem 0.75rem",
                                color: "#3b82f6",
                              }}
                              title="העבר למשימה"
                            >
                              📋
                            </button>
                          ) : (
                            <button
                              className="mod-btn-ghost"
                              disabled
                              style={{
                                fontSize: "0.8rem",
                                padding: "0.4rem 0.75rem",
                                color: "#22c55e",
                                opacity: 0.7,
                              }}
                              title="הועבר למשימה"
                            >
                              ✓
                            </button>
                          )}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                        <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--foreground-muted)" }}>
                          📅 {formatDate(item.date)}
                        </span>
                        {renderTypeBadge(item.itemType)}
                        {renderPlatformBadge(item.platform)}
                        {renderFormatBadge(item.format)}
                        {renderStatusBadge(item.status)}
                        {item.researchSource && RESEARCH_SOURCE_LABELS[item.researchSource] && (
                          <span
                            title={item.researchReason || ''}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.25rem",
                              padding: "0.15rem 0.5rem",
                              borderRadius: "0.375rem",
                              fontSize: "0.7rem",
                              fontWeight: 500,
                              backgroundColor: `${RESEARCH_SOURCE_LABELS[item.researchSource].color}15`,
                              color: RESEARCH_SOURCE_LABELS[item.researchSource].color,
                              border: `1px solid ${RESEARCH_SOURCE_LABELS[item.researchSource].color}30`,
                            }}
                          >
                            {RESEARCH_SOURCE_LABELS[item.researchSource].emoji} {RESEARCH_SOURCE_LABELS[item.researchSource].label}
                          </span>
                        )}
                      </div>

                      {item.researchReason && (
                        <div style={{ fontSize: "0.7rem", color: "var(--foreground-muted)", fontStyle: "italic", marginBottom: "0.25rem", paddingRight: "0.25rem" }}>
                          🔗 {item.researchReason}
                        </div>
                      )}

                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", fontSize: "0.75rem", color: "var(--foreground-muted)" }}>
                        {item.assigneeId && (
                          <span>👤 {allEmployees.find((e) => e.id === item.assigneeId)?.name || "Unknown"}</span>
                        )}
                        {item.holidayTag && <span>🎉 {item.holidayTag}</span>}
                        {item.campaignTag && <span>📌 {item.campaignTag}</span>}
                        {item.relatedVideoId && (
                          <a
                            href={`/projects/${item.relatedVideoId}`}
                            style={{ color: "var(--accent)", textDecoration: "none" }}
                          >
                            🎬 וידאו מקושר
                          </a>
                        )}
                        {(item.imageUrls?.length > 0 || item.attachedFiles?.length > 0) && (
                          <span>📎 {(item.imageUrls?.length || 0) + (item.attachedFiles?.length || 0)} קבצים</span>
                        )}
                      </div>

                      {item.visualConcept && (
                        <div style={{
                          marginTop: "0.75rem",
                          padding: "0.75rem",
                          background: "var(--accent-muted)",
                          borderRadius: "0.375rem",
                          borderRight: "3px solid var(--accent)",
                          fontSize: "0.75rem",
                          color: "var(--foreground)"
                        }}>
                          <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>🎨 קונספט ויזואלי:</div>
                          <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.4 }}>
                            {item.visualConcept}
                          </div>
                        </div>
                      )}

                      {/* ── Reference Previews (REAL DATA ONLY) ── */}
                      {(() => {
                        const refs = itemRefsMap[item.id] || [];
                        const isExpanded = expandedRefIds.has(item.id);
                        const visibleRefs = isExpanded ? refs : refs.slice(0, 3);
                        return (
                          <div style={{ marginTop: "0.75rem" }}>
                            {refs.length === 0 ? (
                              <div style={{
                                padding: "0.6rem 0.75rem",
                                background: "var(--surface)",
                                borderRadius: "0.375rem",
                                border: "1px dashed var(--border)",
                                textAlign: "center",
                              }}>
                                <p style={{ fontSize: "0.72rem", color: "var(--foreground-muted)", margin: "0 0 0.4rem 0" }}>
                                  אין רפרנסים מספריית מודעות למשימה זו
                                </p>
                                <a
                                  href="/settings/references"
                                  style={{
                                    fontSize: "0.7rem", color: "var(--accent)",
                                    textDecoration: "none", fontWeight: 600,
                                  }}
                                >
                                  חפש רפרנסים בספריית המודעות →
                                </a>
                              </div>
                            ) : (
                              <>
                                {/* Demo references banner */}
                                {refs.length > 0 && refs.every(r => isDemoReference(r)) && (
                                  <div style={{
                                    padding: "0.4rem 0.6rem", marginBottom: "0.4rem",
                                    background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)",
                                    borderRadius: "0.375rem", fontSize: "0.65rem", color: "#b45309",
                                    textAlign: "center",
                                  }}>
                                    ⚠️ דוגמאות השראה זמניות — חבר Meta Ads Library בהגדרות כדי לראות מודעות אמיתיות
                                  </div>
                                )}
                                <div
                                  style={{
                                    display: "flex", alignItems: "center", justifyContent: "space-between",
                                    marginBottom: "0.4rem",
                                  }}
                                >
                                  <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground-muted)" }}>
                                    {refs.every(r => isDemoReference(r)) ? '💡 דוגמאות השראה' : '🔍 רפרנסים'} ({refs.length})
                                  </span>
                                  {refs.length > 3 && (
                                    <button
                                      className="mod-btn-ghost"
                                      onClick={() => {
                                        setExpandedRefIds(prev => {
                                          const next = new Set(prev);
                                          if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                                          return next;
                                        });
                                      }}
                                      style={{ fontSize: "0.65rem", padding: "0.15rem 0.4rem", color: "var(--accent)" }}
                                    >
                                      {isExpanded ? "הצג פחות" : `הצג הכל (${refs.length})`}
                                    </button>
                                  )}
                                </div>
                                <div style={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))",
                                  gap: "0.4rem",
                                }}>
                                  {visibleRefs.map((ref) => (
                                    <div
                                      key={ref.id}
                                      onClick={() => { setRefModalItem(ref); setRefModalOpen(true); }}
                                      className="gantt-ref-thumb"
                                      style={{
                                        position: "relative",
                                        borderRadius: "0.375rem",
                                        overflow: "hidden",
                                        border: "1px solid var(--border)",
                                        cursor: "pointer",
                                        aspectRatio: "5 / 4",
                                        background: "var(--surface)",
                                      }}
                                    >
                                      <img
                                        src={ref.imageUrl}
                                        alt={ref.description}
                                        style={{
                                          width: "100%", height: "100%",
                                          objectFit: "cover",
                                          display: "block",
                                          transition: "transform 200ms ease",
                                        }}
                                        loading="lazy"
                                      />
                                      <div style={{
                                        position: "absolute", bottom: 0, left: 0, right: 0,
                                        padding: "0.15rem 0.3rem",
                                        background: "linear-gradient(transparent, rgba(0,0,0,0.65))",
                                        fontSize: "0.55rem", fontWeight: 600,
                                        color: "#fff", lineHeight: 1.3,
                                        pointerEvents: "none",
                                      }}>
                                        {ref.advertiserName || getStyleLabel(ref.style)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })()}

                      {/* Approval action buttons */}
                      {item.status === "in_progress" && (
                        <div style={{ marginTop: "0.5rem" }}>
                          <button
                            className="mod-btn-ghost"
                            onClick={async () => {
                              await updateGanttItem(item.id, { status: "submitted_for_approval" } as any);
                              toast("נשלח לאישור", "success");
                            }}
                            style={{ fontSize: "0.7rem", padding: "0.3rem 0.6rem", color: "#0092cc" }}
                          >
                            🔍 שלח לאישור
                          </button>
                        </div>
                      )}
                      {item.status === "submitted_for_approval" && (
                        <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem" }}>
                          <button
                            className="mod-btn-ghost"
                            onClick={async () => {
                              await updateGanttItem(item.id, { status: "approved" } as any);
                              toast("הפריט אושר", "success");
                            }}
                            style={{ fontSize: "0.7rem", padding: "0.3rem 0.6rem", color: "#22c55e" }}
                          >
                            ✅ אשר
                          </button>
                          <button
                            className="mod-btn-ghost"
                            onClick={async () => {
                              await updateGanttItem(item.id, { status: "returned_for_changes" } as any);
                              toast("הפריט הוחזר לתיקון", "success");
                            }}
                            style={{ fontSize: "0.7rem", padding: "0.3rem 0.6rem", color: "#f97316" }}
                          >
                            ↩️ החזר לתיקון
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {editingItemId === item.id && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      <div>
                        <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>
                          כותרת
                        </label>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="form-input"
                          style={{ width: "100%" }}
                        />
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                        <div>
                          <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>
                            תאריך
                          </label>
                          <input
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className="form-input"
                            style={{ width: "100%" }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>
                            סוג פריט
                          </label>
                          <select
                            value={editItemType}
                            onChange={(e) => setEditItemType(e.target.value)}
                            className="form-select"
                            style={{ width: "100%" }}
                          >
                            {Object.entries(ITEM_TYPE_CONFIG).map(([key, val]) => (
                              <option key={key} value={key}>
                                {val.emoji} {val.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
                        <div>
                          <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>
                            פלטפורמה
                          </label>
                          <select
                            value={editPlatform}
                            onChange={(e) => setEditPlatform(e.target.value)}
                            className="form-select"
                            style={{ width: "100%" }}
                          >
                            <option value="facebook">Facebook</option>
                            <option value="instagram">Instagram</option>
                            <option value="tiktok">TikTok</option>
                            <option value="all">הכל</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>
                            פורמט
                          </label>
                          <select
                            value={editFormat}
                            onChange={(e) => setEditFormat(e.target.value)}
                            className="form-select"
                            style={{ width: "100%" }}
                          >
                            {Object.entries(FORMAT_CONFIG).map(([key, label]) => (
                              <option key={key} value={key}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>
                            סטטוס
                          </label>
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value)}
                            className="form-select"
                            style={{ width: "100%" }}
                          >
                            {Object.entries(GANTT_STATUS_COLORS).map(([key, val]) => (
                              <option key={key} value={key}>
                                {val.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                        <div>
                          <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>
                            מקצוע
                          </label>
                          <select
                            value={editAssignee}
                            onChange={(e) => setEditAssignee(e.target.value)}
                            className="form-select"
                            style={{ width: "100%" }}
                          >
                            <option value="">ללא</option>
                            {allEmployees.filter(e => TEAM_MEMBERS.includes(e.name)).map((emp) => (
                              <option key={emp.id} value={emp.id}>
                                {emp.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>
                            תג חג
                          </label>
                          <input
                            type="text"
                            value={editHolidayTag}
                            onChange={(e) => setEditHolidayTag(e.target.value)}
                            placeholder="למשל: חנוכה"
                            className="form-input"
                            style={{ width: "100%" }}
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>
                          רעיון
                        </label>
                        <textarea
                          value={editIdea}
                          onChange={(e) => setEditIdea(e.target.value)}
                          className="form-input"
                          style={{ width: "100%", minHeight: "60px" }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>
                          טקסט לגרפיקה (עד שתי שורות)
                        </label>
                        <textarea
                          value={editGraphicText}
                          onChange={(e) => setEditGraphicText(e.target.value)}
                          className="form-input"
                          style={{ width: "100%", minHeight: "50px" }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>
                          כיתוביות
                        </label>
                        <textarea
                          value={editCaption}
                          onChange={(e) => setEditCaption(e.target.value)}
                          className="form-input"
                          style={{ width: "100%", minHeight: "80px" }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>
                          🎨 קונספט ויזואלי
                        </label>
                        <textarea
                          value={editVisualConcept}
                          onChange={(e) => setEditVisualConcept(e.target.value)}
                          className="form-input"
                          placeholder="תיאור מדויק של הויזואל: רקע, צבעים, אובייקטים, זווית צילום, מצב רוח"
                          style={{ width: "100%", minHeight: "60px" }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>
                          הערות פנימיות
                        </label>
                        <textarea
                          value={editInternalNotes}
                          onChange={(e) => setEditInternalNotes(e.target.value)}
                          className="form-input"
                          style={{ width: "100%", minHeight: "50px" }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>
                          הערות ללקוח
                        </label>
                        <textarea
                          value={editClientNotes}
                          onChange={(e) => setEditClientNotes(e.target.value)}
                          className="form-input"
                          style={{ width: "100%", minHeight: "50px" }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>
                          תג קמפיין
                        </label>
                        <input
                          type="text"
                          value={editCampaignTag}
                          onChange={(e) => setEditCampaignTag(e.target.value)}
                          placeholder="למשל: Black Friday"
                          className="form-input"
                          style={{ width: "100%" }}
                        />
                      </div>

                      {/* Video & Campaign Connection */}
                      <div
                        style={{
                          background: "linear-gradient(135deg, #3b82f610, #0092cc10)",
                          padding: "1rem",
                          borderRadius: "0.5rem",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: "0.75rem" }}>
                          🔗 חיבורים
                        </label>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                          <div>
                            <label style={{ fontSize: "0.7rem", fontWeight: 500, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>
                              🎬 פרויקט וידאו מקושר
                            </label>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                              <input
                                type="text"
                                value={editRelatedVideoId}
                                onChange={(e) => setEditRelatedVideoId(e.target.value)}
                                placeholder="מזהה פרויקט"
                                className="form-input"
                                style={{ width: "100%", fontSize: "0.75rem" }}
                              />
                            </div>
                            {!editRelatedVideoId && (
                              <button
                                className="mod-btn-ghost"
                                onClick={async () => {
                                  try {
                                    const project = await createVideoProject({
                                      name: editTitle || "פרויקט חדש",
                                      clientId: client.id,
                                      clientName: client.name,
                                      status: "draft",
                                      format: editFormat === "reel" || editFormat === "story" ? "9:16" : "16:9",
                                      preset: "default",
                                      durationSec: 30,
                                      segments: 1,
                                    } as any);
                                    setEditRelatedVideoId(project.id);
                                    toast("פרויקט וידאו נוצר בהצלחה", "success");
                                  } catch {
                                    toast("שגיאה ביצירת פרויקט", "error");
                                  }
                                }}
                                style={{
                                  fontSize: "0.7rem",
                                  padding: "0.3rem 0.5rem",
                                  marginTop: "0.35rem",
                                  width: "100%",
                                }}
                              >
                                + צור פרויקט וידאו חדש
                              </button>
                            )}
                            {editRelatedVideoId && (
                              <a
                                href={`/projects/${editRelatedVideoId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  fontSize: "0.7rem",
                                  color: "var(--accent)",
                                  marginTop: "0.35rem",
                                  display: "inline-block",
                                }}
                              >
                                🔗 פתח פרויקט →
                              </a>
                            )}
                          </div>

                          <div>
                            <label style={{ fontSize: "0.7rem", fontWeight: 500, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>
                              📣 קמפיין מקושר
                            </label>
                            <input
                              type="text"
                              value={editCampaignTag}
                              readOnly
                              className="form-input"
                              style={{ width: "100%", fontSize: "0.75rem", opacity: 0.7 }}
                            />
                            {editCampaignTag && (
                              <span style={{ fontSize: "0.7rem", color: "var(--foreground-muted)", marginTop: "0.25rem", display: "block" }}>
                                📌 {editCampaignTag}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* File Upload Section */}
                      <div
                        style={{
                          background: "var(--foreground-muted-opacity)",
                          padding: "1rem",
                          borderRadius: "0.5rem",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--foreground-muted)", display: "block", marginBottom: "0.5rem" }}>
                          📎 קבצים מצורפים
                        </label>

                        {(editAttachedFiles.length > 0 || editImageUrls.length > 0) && (
                          <div style={{ marginBottom: "0.5rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                            {editAttachedFiles.map((file, idx) => (
                              <div
                                key={`attached-${idx}`}
                                style={{
                                  fontSize: "0.7rem",
                                  padding: "0.35rem 0.5rem",
                                  borderRadius: "3px",
                                  background: "var(--accent-muted)",
                                  color: "var(--accent)",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.5rem",
                                }}
                              >
                                📄 {file.split("/").pop()}
                                <button
                                  onClick={() => setEditAttachedFiles(editAttachedFiles.filter((_, i) => i !== idx))}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    color: "var(--accent)",
                                    cursor: "pointer",
                                    padding: "0",
                                    fontSize: "0.75rem",
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                            {editImageUrls.map((url, idx) => (
                              <div
                                key={`image-${idx}`}
                                style={{
                                  fontSize: "0.7rem",
                                  padding: "0.35rem 0.5rem",
                                  borderRadius: "3px",
                                  background: "#ec48991a",
                                  color: "#ec4899",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.5rem",
                                }}
                              >
                                🖼️ {url.split("/").pop()}
                                <button
                                  onClick={() => setEditImageUrls(editImageUrls.filter((_, i) => i !== idx))}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    color: "#ec4899",
                                    cursor: "pointer",
                                    padding: "0",
                                    fontSize: "0.75rem",
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.5rem" }}>
                          <input
                            type="text"
                            placeholder="הדבק קישור לקובץ..."
                            value={newAttachedFilePath}
                            onChange={(e) => setNewAttachedFilePath(e.target.value)}
                            className="form-input"
                            style={{ fontSize: "0.75rem" }}
                          />
                          <button
                            className="mod-btn-ghost"
                            onClick={() => {
                              if (newAttachedFilePath) {
                                setEditAttachedFiles([...editAttachedFiles, newAttachedFilePath]);
                                setNewAttachedFilePath("");
                              }
                            }}
                            style={{
                              fontSize: "0.75rem",
                              padding: "0.4rem 0.75rem",
                              whiteSpace: "nowrap",
                            }}
                          >
                            + הוסף
                          </button>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          className="mod-btn-primary"
                          onClick={handleSaveGanttItem}
                          style={{
                            fontSize: "0.75rem",
                            padding: "0.5rem 1rem",
                            flex: 1,
                          }}
                        >
                          💾 שמור
                        </button>
                        <button
                          className="mod-btn-ghost"
                          onClick={() => handleDeleteGanttItem(item.id)}
                          style={{
                            fontSize: "0.75rem",
                            padding: "0.5rem 1rem",
                            color: "#ef4444",
                          }}
                        >
                          🗑 מחק
                        </button>
                        <button
                          className="mod-btn-ghost"
                          onClick={() => setEditingItemId(null)}
                          style={{
                            fontSize: "0.75rem",
                            padding: "0.5rem 1rem",
                          }}
                        >
                          ביטול
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
              })}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "2rem 1rem", color: "var(--foreground-muted)" }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>📭</div>
              <p style={{ fontSize: "0.9rem", margin: 0 }}>אין פריטים בגאנט זה</p>
            </div>
          )}
        </div>
      )}

      {/* Calendar View */}
      {activeView === "calendar" && (
        <div
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
              {HEB_MONTHS[selectedMonth]} {selectedYear}
            </h3>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                className="mod-btn-ghost"
                onClick={() => setSelectedMonth(selectedMonth === 0 ? 11 : selectedMonth - 1)}
                style={{ fontSize: "0.8rem", padding: "0.4rem 0.75rem" }}
              >
                ➡️
              </button>
              <button
                className="mod-btn-ghost"
                onClick={() => setSelectedMonth(selectedMonth === 11 ? 0 : selectedMonth + 1)}
                style={{ fontSize: "0.8rem", padding: "0.4rem 0.75rem" }}
              >
                ⬅️
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: "0.5rem",
              marginBottom: "1.5rem",
            }}
          >
            {HEB_WEEKDAYS.map((day) => (
              <div
                key={day}
                style={{
                  textAlign: "center",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "var(--foreground-muted)",
                  padding: "0.5rem",
                }}
              >
                {day}
              </div>
            ))}

            {(() => {
              const firstDay = new Date(selectedYear, selectedMonth, 1);
              const lastDay = new Date(selectedYear, selectedMonth + 1, 0);
              const days: (number | null)[] = [];
              for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
              for (let i = 1; i <= lastDay.getDate(); i++) days.push(i);
              return days.map((day, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "0.5rem",
                    border: "1px solid var(--border)",
                    borderRadius: "0.5rem",
                    background: day ? "transparent" : "var(--foreground-muted-opacity)",
                    minHeight: "60px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "flex-start",
                  }}
                >
                  {day && (
                    <>
                      <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.25rem" }}>
                        {day}
                      </span>
                      {(() => {
                        const dayItems = calendarItems.filter((item) => {
                          const d = new Date(item.date);
                          return d.getDate() === day;
                        });
                        return (
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", width: "100%", alignItems: "center" }}>
                            {dayItems.slice(0, 2).map((item) => (
                              <div
                                key={item.id}
                                style={{
                                  fontSize: "0.55rem",
                                  padding: "0.15rem 0.3rem",
                                  borderRadius: "2px",
                                  background: `${ITEM_TYPE_CONFIG[item.itemType]?.color || "#6b7280"}20`,
                                  color: ITEM_TYPE_CONFIG[item.itemType]?.color || "#6b7280",
                                  fontWeight: 500,
                                  maxWidth: "100%",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  cursor: "pointer",
                                }}
                                onClick={() => setEditingItemId(item.id)}
                                title={item.title}
                              >
                                {ITEM_TYPE_CONFIG[item.itemType]?.emoji} {item.title?.substring(0, 8)}
                              </div>
                            ))}
                            {dayItems.length > 2 && (
                              <div style={{ fontSize: "0.5rem", color: "var(--foreground-muted)" }}>
                                +{dayItems.length - 2}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* Annual View */}
      {activeView === "annual" && (
        <div
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
              תצוגה שנתית — {selectedYear}
            </h3>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                className="mod-btn-ghost"
                onClick={() => {
                  window.open(`/api/clients/${client.id}/gantt-pdf?year=${selectedYear}&type=annual`, "_blank");
                }}
                style={{ fontSize: "0.8rem", padding: "0.4rem 0.75rem" }}
              >
                📄 הפק PDF שנתי
              </button>
              <button
                className="mod-btn-ghost"
                onClick={() => setSelectedYear(selectedYear - 1)}
                style={{ fontSize: "0.8rem", padding: "0.4rem 0.75rem" }}
              >
                ➡️
              </button>
              <button
                className="mod-btn-ghost"
                onClick={() => setSelectedYear(selectedYear + 1)}
                style={{ fontSize: "0.8rem", padding: "0.4rem 0.75rem" }}
              >
                ⬅️
              </button>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "1rem",
            }}
          >
            {HEB_MONTHS.map((month, idx) => {
              const monthAnnualItems = annualItems.filter((item) => {
                if (item.ganttType === "annual") return item.month === idx + 1;
                if (item.ganttType === "monthly" && item.date) return new Date(item.date).getMonth() === idx;
                return false;
              });
              const monthHasItems = monthAnnualItems.length > 0;
              return (
                <div
                  key={month}
                  style={{
                    padding: "1rem",
                    border: "1px solid var(--border)",
                    borderRadius: "0.5rem",
                    background: monthHasItems ? "var(--accent-muted)" : "transparent",
                  }}
                >
                  <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--foreground)", marginBottom: "0.75rem" }}>
                    {month}
                  </div>
                  {monthAnnualItems.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {monthAnnualItems.map((item) => (
                        <div key={item.id} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                          <div style={{ fontSize: "0.7rem", fontWeight: 500, color: "var(--foreground)" }}>
                            {item.title || "ללא שם"}
                          </div>
                          <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                            {renderTypeBadge(item.itemType)}
                            {renderStatusBadge(item.status)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: "0.7rem", color: "var(--foreground-muted)", fontStyle: "italic" }}>
                      אין פריטים
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Kanban View */}
      {activeView === "queue" && (
        <div
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
          }}
        >
          <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--foreground)", margin: "0 0 1.5rem 0" }}>
            🎯 תור תוכן — {HEB_MONTHS[selectedMonth]} {selectedYear}
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "1rem",
            }}
          >
            {KANBAN_COLUMNS.map((column) => {
              const columnItems = getKanbanItemsForStatus(column.key);
              return (
                <div
                  key={column.key}
                  style={{
                    padding: "1rem",
                    border: "1px solid var(--border)",
                    borderRadius: "0.75rem",
                    background: "var(--foreground-muted-opacity)",
                    minHeight: "400px",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--foreground)", marginBottom: "0.75rem" }}>
                    {column.emoji} {column.label}
                    <span style={{ fontSize: "0.7rem", fontWeight: 500, color: "var(--foreground-muted)", marginInlineStart: "0.5rem" }}>
                      ({columnItems.length})
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", flex: 1 }}>
                    {columnItems.length > 0 ? (
                      columnItems.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => setEditingItemId(item.id)}
                          style={{
                            padding: "0.75rem",
                            border: "1px solid var(--border)",
                            borderRadius: "0.5rem",
                            background: "var(--surface-raised)",
                            cursor: "pointer",
                            transition: "all 150ms",
                            borderLeft: `3px solid ${ITEM_TYPE_CONFIG[item.itemType]?.color || "#6b7280"}`,
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.boxShadow = "none";
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.5rem" }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--foreground)", wordWrap: "break-word" }}>
                                {item.title || "ללא כותרת"}
                              </div>
                              <div style={{ fontSize: "0.7rem", color: "var(--foreground-muted)", marginTop: "0.25rem" }}>
                                📅 {formatDate(item.date)}
                              </div>
                            </div>
                            <span style={{ fontSize: "0.8rem", flexShrink: 0 }}>
                              {getAttachmentIndicator(item)}
                            </span>
                          </div>

                          <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                            {renderTypeBadge(item.itemType)}
                            {renderPlatformBadge(item.platform)}
                          </div>

                          {item.assigneeId && (
                            <div style={{ fontSize: "0.7rem", color: "var(--foreground-muted)", marginBottom: "0.5rem" }}>
                              👤 {allEmployees.find((e) => e.id === item.assigneeId)?.name || "Unknown"}
                            </div>
                          )}

                          <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                            {renderStatusBadge(item.status)}
                          </div>

                          {/* Move Buttons */}
                          <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.5rem" }}>
                            {column.key !== "draft" && (
                              <button
                                className="mod-btn-ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const currentIdx = KANBAN_COLUMNS.findIndex((c) => c.key === column.key);
                                  if (currentIdx > 0) {
                                    handleChangeStatus(item.id, KANBAN_COLUMNS[currentIdx - 1].key);
                                  }
                                }}
                                style={{
                                  fontSize: "0.65rem",
                                  padding: "0.3rem 0.5rem",
                                  flex: 1,
                                }}
                                title="הזז שמאלה"
                              >
                                ➡️
                              </button>
                            )}
                            {column.key !== "published" && (
                              <button
                                className="mod-btn-ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const currentIdx = KANBAN_COLUMNS.findIndex((c) => c.key === column.key);
                                  if (currentIdx < KANBAN_COLUMNS.length - 1) {
                                    handleChangeStatus(item.id, KANBAN_COLUMNS[currentIdx + 1].key);
                                  }
                                }}
                                style={{
                                  fontSize: "0.65rem",
                                  padding: "0.3rem 0.5rem",
                                  flex: 1,
                                }}
                                title="הזז ימינה"
                              >
                                ⬅️
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ textAlign: "center", padding: "2rem 1rem", color: "var(--foreground-muted)", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ fontSize: "1.5rem" }}>📭</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Selected Item Detail Panel (for non-list views) ── */}
      {activeView !== "list" && editingItemId && (() => {
        const selectedItem = ganttItems.find((i) => i.id === editingItemId);
        if (!selectedItem) return null;
        // Ensure references are loaded for this item
        if (!itemRefsMap[selectedItem.id]) {
          loadReferencesForItem(selectedItem);
        }
        const refs = itemRefsMap[selectedItem.id] || [];
        const isExpanded = expandedRefIds.has(selectedItem.id);
        const visibleRefs = isExpanded ? refs : refs.slice(0, 3);
        const statusInfo = GANTT_STATUS_COLORS[selectedItem.status] || GANTT_STATUS_COLORS.draft;
        const typeInfo = ITEM_TYPE_CONFIG[selectedItem.itemType] || ITEM_TYPE_CONFIG.social_post;
        return (
          <div
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border)",
              borderRadius: "0.75rem",
              padding: "1.25rem",
              marginTop: "1rem",
              direction: "rtl",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <h4 style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
                {typeInfo.emoji} {selectedItem.title || "ללא כותרת"}
              </h4>
              <button
                className="mod-btn-ghost"
                onClick={() => setEditingItemId(null)}
                style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}
              >
                סגור
              </button>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
              <span style={{
                fontSize: "0.7rem", padding: "0.15rem 0.5rem", borderRadius: "0.25rem",
                background: `${statusInfo.color}20`, color: statusInfo.color, fontWeight: 500,
              }}>
                {statusInfo.label}
              </span>
              <span style={{
                fontSize: "0.7rem", padding: "0.15rem 0.5rem", borderRadius: "0.25rem",
                background: `${typeInfo.color}20`, color: typeInfo.color, fontWeight: 500,
              }}>
                {typeInfo.label}
              </span>
              {selectedItem.date && (
                <span style={{ fontSize: "0.7rem", color: "var(--foreground-muted)" }}>
                  {formatDate(selectedItem.date)}
                </span>
              )}
            </div>

            {selectedItem.ideaSummary && (
              <div style={{ fontSize: "0.8rem", color: "var(--foreground)", marginBottom: "0.75rem", lineHeight: 1.5 }}>
                {selectedItem.ideaSummary}
              </div>
            )}

            {selectedItem.caption && (
              <div style={{
                marginBottom: "0.75rem", padding: "0.5rem 0.75rem",
                background: "var(--accent-muted)", borderRadius: "0.375rem",
                borderRight: "3px solid var(--accent)", fontSize: "0.75rem",
              }}>
                <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>קופי:</div>
                <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.4 }}>
                  {selectedItem.caption}
                </div>
              </div>
            )}

            {selectedItem.visualConcept && (
              <div style={{
                marginBottom: "0.75rem", padding: "0.5rem 0.75rem",
                background: "var(--accent-muted)", borderRadius: "0.375rem",
                borderRight: "3px solid var(--accent)", fontSize: "0.75rem",
              }}>
                <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>קונספט ויזואלי:</div>
                <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.4 }}>
                  {selectedItem.visualConcept}
                </div>
              </div>
            )}

            {/* References (REAL DATA ONLY — no mock/fake) */}
            <div style={{ marginTop: "0.5rem" }}>
              {refs.length === 0 ? (
                <div style={{
                  padding: "0.75rem",
                  background: "var(--surface)",
                  borderRadius: "0.375rem",
                  border: "1px dashed var(--border)",
                  textAlign: "center",
                }}>
                  <p style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", margin: "0 0 0.5rem 0" }}>
                    אין רפרנסים מספריית מודעות למשימה זו
                  </p>
                  <a
                    href="/settings/references"
                    style={{
                      display: "inline-block",
                      padding: "0.4rem 0.8rem",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "var(--accent)",
                      background: "var(--accent-muted)",
                      borderRadius: "0.375rem",
                      textDecoration: "none",
                      transition: "opacity 150ms ease",
                    }}
                  >
                    🔍 חפש רפרנסים בספריית המודעות
                  </a>
                </div>
              ) : (
                <>
                  {/* Demo references banner */}
                  {refs.length > 0 && refs.every(r => isDemoReference(r)) && (
                    <div style={{
                      padding: "0.5rem 0.75rem", marginBottom: "0.5rem",
                      background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)",
                      borderRadius: "0.375rem", fontSize: "0.75rem", color: "#b45309",
                      textAlign: "center",
                    }}>
                      ⚠️ דוגמאות השראה זמניות — חבר Meta Ads Library בהגדרות כדי לראות מודעות אמיתיות
                    </div>
                  )}
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    marginBottom: "0.4rem",
                  }}>
                    <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground-muted)" }}>
                      {refs.every(r => isDemoReference(r)) ? '💡 דוגמאות השראה' : '🔍 רפרנסים'} ({refs.length})
                    </span>
                    {refs.length > 3 && (
                      <button
                        className="mod-btn-ghost"
                        onClick={() => {
                          setExpandedRefIds(prev => {
                            const next = new Set(prev);
                            if (next.has(selectedItem.id)) next.delete(selectedItem.id); else next.add(selectedItem.id);
                            return next;
                          });
                        }}
                        style={{ fontSize: "0.65rem", padding: "0.15rem 0.4rem", color: "var(--accent)" }}
                      >
                        {isExpanded ? "הצג פחות" : `הצג הכל (${refs.length})`}
                      </button>
                    )}
                  </div>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))",
                    gap: "0.4rem",
                  }}>
                    {visibleRefs.map((ref) => (
                      <div
                        key={ref.id}
                        onClick={() => { setRefModalItem(ref); setRefModalOpen(true); }}
                        className="gantt-ref-thumb"
                        style={{
                          position: "relative", borderRadius: "0.375rem", overflow: "hidden",
                          border: "1px solid var(--border)", cursor: "pointer",
                          aspectRatio: "5 / 4", background: "var(--surface)",
                        }}
                      >
                        <img
                          src={ref.imageUrl}
                          alt={ref.description}
                          style={{
                            width: "100%", height: "100%", objectFit: "cover",
                            display: "block", transition: "transform 200ms ease",
                          }}
                          loading="lazy"
                        />
                        <div style={{
                          position: "absolute", bottom: 0, left: 0, right: 0,
                          padding: "0.15rem 0.3rem",
                          background: "linear-gradient(transparent, rgba(0,0,0,0.65))",
                          fontSize: "0.55rem", fontWeight: 600,
                          color: "#fff", lineHeight: 1.3, pointerEvents: "none",
                        }}>
                          {ref.advertiserName || getStyleLabel(ref.style)}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Switch to list for full editing */}
            <div style={{ marginTop: "0.75rem", textAlign: "center" }}>
              <button
                className="mod-btn-ghost"
                onClick={() => setActiveView("list")}
                style={{ fontSize: "0.75rem", padding: "0.4rem 0.8rem", color: "var(--accent)" }}
              >
                עבור לתצוגת רשימה לעריכה מלאה
              </button>
            </div>
          </div>
        );
      })()}

      {/* Selective Regeneration Confirmation Modal */}
      {showRegenConfirmModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowRegenConfirmModal(false)}
        >
          <div
            style={{
              background: "var(--surface-raised)",
              borderRadius: "0.75rem",
              padding: "1.5rem",
              maxWidth: "420px",
              width: "90%",
              direction: "rtl",
              border: "1px solid var(--border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--foreground)", margin: "0 0 1rem 0" }}>
              ייצור מחדש חלקי
            </h3>
            <div style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", lineHeight: 1.8, marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <span style={{
                  background: "#22c55e20",
                  color: "#22c55e",
                  padding: "0.15rem 0.5rem",
                  borderRadius: "0.25rem",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                }}>
                  {protectedItems.length} נשמרים
                </span>
                <span style={{ color: "var(--foreground-muted)", fontSize: "0.8rem" }}>
                  פריטים מאושרים / בעבודה — לא ישתנו
                </span>
              </div>
              {protectedItems.map((item) => {
                const badge = getProtectionBadge(item, sentToTaskIds);
                return (
                  <div key={item.id} style={{ fontSize: "0.78rem", color: "var(--foreground-muted)", paddingInlineStart: "0.5rem", marginBottom: "0.25rem" }}>
                    <span style={{ color: badge?.color || "#22c55e", fontWeight: 500 }}>{badge?.label || "נשמר"}</span>
                    {" — "}
                    {item.title || "ללא כותרת"}
                  </div>
                );
              })}
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.75rem", marginBottom: "0.5rem" }}>
                <span style={{
                  background: "#f59e0b20",
                  color: "#f59e0b",
                  padding: "0.15rem 0.5rem",
                  borderRadius: "0.25rem",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                }}>
                  {regeneratableItems.length} יוחלפו
                </span>
                <span style={{ color: "var(--foreground-muted)", fontSize: "0.8rem" }}>
                  פריטים פתוחים — ייוצרו מחדש עם רעיונות שונים
                </span>
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button
                className="mod-btn-ghost"
                onClick={() => setShowRegenConfirmModal(false)}
                style={{ fontSize: "0.8rem", padding: "0.5rem 1rem" }}
              >
                ביטול
              </button>
              <button
                className="mod-btn-primary"
                onClick={handleRegenerateMonthly}
                style={{ fontSize: "0.8rem", padding: "0.5rem 1rem" }}
              >
                ייצר {regeneratableItems.length} פריטים חדשים
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Entry Modal */}
      {showManualEntryModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowManualEntryModal(false)}
        >
          <div
            style={{
              background: "var(--surface-raised)",
              borderRadius: "0.75rem",
              padding: "1.5rem",
              maxWidth: "420px",
              width: "90%",
              direction: "rtl",
              border: "1px solid var(--border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--foreground)", margin: "0 0 1rem 0" }}>
              ✏️ הוסף רשומה ידנית
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem" }}>
              <div>
                <label style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", marginBottom: "0.25rem", display: "block" }}>נושא / רעיון *</label>
                <input
                  type="text"
                  value={manualTopic}
                  onChange={(e) => setManualTopic(e.target.value)}
                  placeholder="למשל: טיפים לחיסכון בעסקים קטנים"
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    borderRadius: "0.375rem",
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    color: "var(--foreground)",
                    fontSize: "0.85rem",
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", marginBottom: "0.25rem", display: "block" }}>תאריך</label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    borderRadius: "0.375rem",
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    color: "var(--foreground)",
                    fontSize: "0.85rem",
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", marginBottom: "0.25rem", display: "block" }}>סוג תוכן</label>
                <select
                  value={manualContentType}
                  onChange={(e) => setManualContentType(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    borderRadius: "0.375rem",
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    color: "var(--foreground)",
                    fontSize: "0.85rem",
                  }}
                >
                  <option value="post">פוסט</option>
                  <option value="reel">ריל</option>
                  <option value="story">סטורי</option>
                  <option value="carousel">קרוסלה</option>
                </select>
              </div>
            </div>
            <p style={{ fontSize: "0.78rem", color: "var(--foreground-muted)", marginBottom: "1rem" }}>
              AI ייצר תוכן מלא על בסיס הנושא: כותרת, סיכום, טקסט לגרפיקה, כיתוב, CTA, וקונספט ויזואלי.
            </p>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button
                className="mod-btn-ghost"
                onClick={() => setShowManualEntryModal(false)}
                style={{ fontSize: "0.8rem", padding: "0.5rem 1rem" }}
              >
                ביטול
              </button>
              <button
                className="mod-btn-primary"
                onClick={handleManualEntry}
                disabled={isCreatingManual || !manualTopic.trim()}
                style={{
                  fontSize: "0.8rem",
                  padding: "0.5rem 1rem",
                  opacity: isCreatingManual || !manualTopic.trim() ? 0.6 : 1,
                }}
              >
                {isCreatingManual ? "⏳ יוצר תוכן..." : "צור רשומה"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send for Approval Modal */}
      {showSendApprovalModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: "1rem",
          }}
          onClick={() => setShowSendApprovalModal(false)}
        >
          <div
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border)",
              borderRadius: "0.75rem",
              padding: "2rem",
              maxWidth: "500px",
              width: "100%",
              maxHeight: "80vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--foreground)", margin: "0 0 1.5rem 0" }}>
              📨 שלח גאנט לאישור
            </h2>

            <div style={{ marginBottom: "1.5rem" }}>
              <h3 style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--foreground-muted)", marginBottom: "0.75rem" }}>
                בחר פריטים לשליחה:
              </h3>

              {monthlyItems.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "300px", overflow: "auto" }}>
                  {monthlyItems.map((item) => (
                    <label
                      key={item.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        padding: "0.5rem 0.75rem",
                        border: "1px solid var(--border)",
                        borderRadius: "0.5rem",
                        cursor: "pointer",
                        background: selectedItemsForApproval.has(item.id) ? "var(--accent-muted)" : "transparent",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedItemsForApproval.has(item.id)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedItemsForApproval);
                          if (e.target.checked) {
                            newSelected.add(item.id);
                          } else {
                            newSelected.delete(item.id);
                          }
                          setSelectedItemsForApproval(newSelected);
                        }}
                        style={{
                          cursor: "pointer",
                          width: "16px",
                          height: "16px",
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--foreground)" }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: "0.7rem", color: "var(--foreground-muted)" }}>
                          {formatDate(item.date)}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "1rem", color: "var(--foreground-muted)", fontSize: "0.85rem" }}>
                  אין פריטים בחודש זה
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                className="mod-btn-primary"
                onClick={handleSendForApproval}
                disabled={selectedItemsForApproval.size === 0 || isSendingApproval}
                style={{
                  fontSize: "0.8rem",
                  padding: "0.6rem 1.125rem",
                  flex: 1,
                  opacity: selectedItemsForApproval.size === 0 || isSendingApproval ? 0.6 : 1,
                  cursor: selectedItemsForApproval.size === 0 || isSendingApproval ? "not-allowed" : "pointer",
                }}
              >
                {isSendingApproval ? "⏳ שולח..." : "📨 שלח לאישור"}
              </button>
              <button
                className="mod-btn-ghost"
                onClick={() => setShowSendApprovalModal(false)}
                style={{
                  fontSize: "0.8rem",
                  padding: "0.6rem 1.125rem",
                }}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Generation Modal */}
      {showMonthlyGenModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: "1rem",
          }}
          onClick={() => setShowMonthlyGenModal(false)}
        >
          <div
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border)",
              borderRadius: "0.75rem",
              padding: "2rem",
              maxWidth: "500px",
              width: "100%",
              maxHeight: "80vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--foreground)", margin: "0 0 1.5rem 0" }}>
              📅 צור גאנט חודשי
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                    חודש
                  </label>
                  <select
                    value={genMonth}
                    onChange={(e) => setGenMonth(parseInt(e.target.value))}
                    className="form-select"
                    style={{ width: "100%" }}
                  >
                    {HEB_MONTHS.map((m, idx) => (
                      <option key={idx} value={idx}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                    שנה
                  </label>
                  <input
                    type="number"
                    value={genYear}
                    onChange={(e) => setGenYear(parseInt(e.target.value))}
                    className="form-input"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                  מספר פוסטים בשבוע
                </label>
                <input
                  type="number"
                  value={weeklyPostsCount}
                  onChange={(e) => setWeeklyPostsCount(parseInt(e.target.value))}
                  min="1"
                  max="7"
                  className="form-input"
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                  פלטפורמות
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.5rem" }}>
                  {["facebook", "instagram", "tiktok"].map((platform) => (
                    <label key={platform} style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={selectedPlatforms.includes(platform)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPlatforms([...selectedPlatforms, platform]);
                          } else {
                            setSelectedPlatforms(selectedPlatforms.filter((p) => p !== platform));
                          }
                        }}
                        style={{ cursor: "pointer" }}
                      />
                      <span style={{ fontSize: "0.8rem", color: "var(--foreground)" }}>
                        {platform === "facebook" && "📘"}
                        {platform === "instagram" && "📷"}
                        {platform === "tiktok" && "🎵"}
                        {" " + platform}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                  פורמטים
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.5rem" }}>
                  {["image", "video", "reel", "carousel"].map((format) => (
                    <label key={format} style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={selectedFormats.includes(format)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedFormats([...selectedFormats, format]);
                          } else {
                            setSelectedFormats(selectedFormats.filter((f) => f !== format));
                          }
                        }}
                        style={{ cursor: "pointer" }}
                      />
                      <span style={{ fontSize: "0.8rem", color: "var(--foreground)" }}>
                        {FORMAT_CONFIG[format]}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                  קמפיינים
                </label>
                <textarea
                  value={genCampaigns}
                  onChange={(e) => setGenCampaigns(e.target.value)}
                  placeholder="למשל: Black Friday, עיצוב חדש"
                  className="form-input"
                  style={{ width: "100%", minHeight: "50px" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                  הנחיות וממורמוזים
                </label>
                <textarea
                  value={genPrompt}
                  onChange={(e) => setGenPrompt(e.target.value)}
                  placeholder="לדוגמה: דגש על מוצרים חדשים, שימוש בווידאו"
                  className="form-input"
                  style={{ width: "100%", minHeight: "80px" }}
                />
              </div>

              <div style={{ background: "var(--accent-muted)", padding: "1rem", borderRadius: "0.5rem" }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--foreground)", marginBottom: "0.5rem" }}>
                  📋 הקשר עסקי
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", lineHeight: "1.5" }}>
                  <div>
                    <strong>תחום:</strong> {client.businessField || "לא מוגדר"}
                  </div>
                  <div>
                    <strong>יעדי מרקטינג:</strong> {client.marketingGoals || "לא מוגדר"}
                  </div>
                  <div>
                    <strong>מסרים מרכזיים:</strong> {client.keyMarketingMessages || "לא מוגדר"}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  className="mod-btn-primary"
                  onClick={handleGenerateMonthly}
                  disabled={isGenerating}
                  style={{
                    fontSize: "0.8rem",
                    padding: "0.6rem 1.125rem",
                    flex: 1,
                    opacity: isGenerating ? 0.6 : 1,
                  }}
                >
                  {isGenerating ? "⏳ יוצר..." : "🤖 צור גאנט חודשי"}
                </button>
                <button
                  className="mod-btn-ghost"
                  onClick={() => setShowMonthlyGenModal(false)}
                  style={{
                    fontSize: "0.8rem",
                    padding: "0.6rem 1.125rem",
                  }}
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Annual Generation Modal */}
      {showAnnualGenModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: "1rem",
          }}
          onClick={() => setShowAnnualGenModal(false)}
        >
          <div
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border)",
              borderRadius: "0.75rem",
              padding: "2rem",
              maxWidth: "500px",
              width: "100%",
              maxHeight: "80vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--foreground)", margin: "0 0 1.5rem 0" }}>
              📆 צור גאנט שנתי
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                  שנה
                </label>
                <input
                  type="number"
                  value={annualYear}
                  onChange={(e) => setAnnualYear(parseInt(e.target.value))}
                  className="form-input"
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                  הנחיות וממורמוזים
                </label>
                <textarea
                  value={annualPrompt}
                  onChange={(e) => setAnnualPrompt(e.target.value)}
                  placeholder="לדוגמה: דגש על עונות השנה, אירועי עיתוי, קמפיינים גלובליים"
                  className="form-input"
                  style={{ width: "100%", minHeight: "80px" }}
                />
              </div>

              <div style={{ background: "var(--accent-muted)", padding: "1rem", borderRadius: "0.5rem" }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--foreground)", marginBottom: "0.5rem" }}>
                  📋 הקשר עסקי
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", lineHeight: "1.5" }}>
                  <div>
                    <strong>תחום:</strong> {client.businessField || "לא מוגדר"}
                  </div>
                  <div>
                    <strong>יעדי מרקטינג:</strong> {client.marketingGoals || "לא מוגדר"}
                  </div>
                  <div>
                    <strong>מסרים מרכזיים:</strong> {client.keyMarketingMessages || "לא מוגדר"}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  className="mod-btn-primary"
                  onClick={handleGenerateAnnual}
                  disabled={isGenerating}
                  style={{
                    fontSize: "0.8rem",
                    padding: "0.6rem 1.125rem",
                    flex: 1,
                    opacity: isGenerating ? 0.6 : 1,
                  }}
                >
                  {isGenerating ? "⏳ יוצר..." : "🤖 צור גאנט שנתי"}
                </button>
                <button
                  className="mod-btn-ghost"
                  onClick={() => setShowAnnualGenModal(false)}
                  style={{
                    fontSize: "0.8rem",
                    padding: "0.6rem 1.125rem",
                  }}
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Task Section */}
      <div
        style={{
          background: "var(--surface-raised)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
          padding: "1.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
            📋 משימות ידניות
          </h3>
          <button
            className="mod-btn-primary"
            onClick={() => setShowAddTask(!showAddTask)}
            style={{
              fontSize: "0.8rem",
              padding: "0.4rem 0.75rem",
            }}
          >
            + הוסף משימה
          </button>
        </div>

        {showAddTask && (
          <div style={{ background: "var(--accent-muted)", padding: "1rem", borderRadius: "0.5rem", marginBottom: "1rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <input
                type="text"
                placeholder="כותרת משימה"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="form-input"
                style={{ width: "100%" }}
              />
              <textarea
                placeholder="תיאור"
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                className="form-input"
                style={{ width: "100%", minHeight: "40px" }}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <input
                  type="date"
                  value={newTaskDueDate}
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                  className="form-input"
                  style={{ width: "100%" }}
                />
                <select
                  value={newTaskType}
                  onChange={(e) => setNewTaskType(e.target.value)}
                  className="form-select"
                  style={{ width: "100%" }}
                >
                  {Object.entries(TASK_TYPE_CONFIG).map(([key, val]) => (
                    <option key={key} value={key}>
                      {val.emoji} {val.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
                <select
                  value={newTaskAssignee}
                  onChange={(e) => setNewTaskAssignee(e.target.value)}
                  className="form-select"
                  style={{ width: "100%" }}
                >
                  <option value="">בחר מקצוע</option>
                  {employees.filter(e => TEAM_MEMBERS.includes(e.name)).map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
                <select
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value)}
                  className="form-select"
                  style={{ width: "100%" }}
                >
                  <option value="low">נמוכה</option>
                  <option value="medium">בינונית</option>
                  <option value="high">גבוהה</option>
                </select>
                <select
                  value={newTaskStatus}
                  onChange={(e) => setNewTaskStatus(e.target.value)}
                  className="form-select"
                  style={{ width: "100%" }}
                >
                  <option value="backlog">ברשימה</option>
                  <option value="todo">לביצוע</option>
                  <option value="in_progress">בעבודה</option>
                  <option value="done">הושלם</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button className="mod-btn-primary" onClick={handleAddTask} style={{ fontSize: "0.75rem", padding: "0.5rem 1rem", flex: 1 }}>
                  ✓ הוסף משימה
                </button>
                <button
                  className="mod-btn-ghost"
                  onClick={() => setShowAddTask(false)}
                  style={{ fontSize: "0.75rem", padding: "0.5rem 1rem" }}
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        )}

        {tasks && tasks.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {tasks.map((task: any) => {
              const assignee = employees.find((e) => e.id === ((task.assigneeIds || [])[0] || task.assigneeId));
              const taskTypeTag = (task.tags || [])[0] || task.taskType || "general";
              const taskTypeConfig = TASK_TYPE_CONFIG[taskTypeTag] || TASK_TYPE_CONFIG.general;
              return (
                <div
                  key={task.id}
                  style={{
                    padding: "1rem",
                    border: "1px solid var(--border)",
                    borderRadius: "0.5rem",
                    borderLeft: `4px solid ${taskTypeConfig?.color || "#6b7280"}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "0.5rem" }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: "0.9rem", color: "var(--foreground)" }}>
                        {task.title}
                      </div>
                      {task.description && (
                        <div style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", marginTop: "0.25rem" }}>
                          {task.description}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.5rem", fontSize: "0.75rem" }}>
                    {renderStatusBadge(task.status || "backlog")}
                    {taskTypeConfig && (
                      <span
                        style={{
                          padding: "0.25rem 0.5rem",
                          borderRadius: 4,
                          background: `${taskTypeConfig.color}15`,
                          color: taskTypeConfig.color,
                          fontWeight: 500,
                        }}
                      >
                        {taskTypeConfig.emoji} {taskTypeConfig.label}
                      </span>
                    )}
                    {assignee && <span style={{ color: "var(--foreground-muted)" }}>👤 {assignee.name}</span>}
                    {task.dueDate && <span style={{ color: "var(--foreground-muted)" }}>📅 {formatDate(task.dueDate)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "2rem 1rem", color: "var(--foreground-muted)" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>✓</div>
            <p style={{ fontSize: "0.9rem", margin: 0 }}>אין משימות ידניות</p>
          </div>
        )}
      </div>

      {/* ── Reference Preview Modal ── */}
      {refModalOpen && refModalItem && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "1.5rem",
          }}
          onClick={() => { setRefModalOpen(false); setRefModalItem(null); }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border)",
              borderRadius: "0.75rem",
              maxWidth: "480px",
              width: "100%",
              overflow: "hidden",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            {/* Preview image */}
            <div style={{ width: "100%", aspectRatio: "5 / 4", overflow: "hidden", background: "var(--surface)" }}>
              <img
                src={refModalItem.imageUrl}
                alt={refModalItem.description}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </div>

            {/* Info */}
            <div style={{ padding: "1.25rem" }}>
              {/* Advertiser name */}
              {refModalItem.advertiserName && (
                <p style={{
                  fontSize: "0.95rem", fontWeight: 700,
                  color: "var(--foreground)", margin: "0 0 0.5rem 0",
                }}>
                  {refModalItem.advertiserName}
                </p>
              )}

              {/* Badges row: style, source, platform, active status, engagement */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                <span style={{
                  fontSize: "0.68rem", fontWeight: 600,
                  padding: "0.15rem 0.45rem", borderRadius: "0.25rem",
                  background: "var(--accent-muted)", color: "var(--accent)",
                  border: "1px solid var(--accent)",
                }}>
                  {getStyleLabel(refModalItem.style)}
                </span>
                <span style={{
                  fontSize: "0.65rem", fontWeight: 500,
                  padding: "0.15rem 0.4rem", borderRadius: "0.25rem",
                  background: "var(--surface)", border: "1px solid var(--border)",
                  color: "var(--foreground-muted)",
                }}>
                  {refModalItem.source}
                </span>
                {refModalItem.platform && (
                  <span style={{
                    fontSize: "0.65rem", fontWeight: 500,
                    padding: "0.15rem 0.4rem", borderRadius: "0.25rem",
                    background: "var(--surface)", border: "1px solid var(--border)",
                    color: "var(--foreground-muted)",
                  }}>
                    {refModalItem.platform}
                  </span>
                )}
                {/* Active / inactive status */}
                <span style={{
                  fontSize: "0.62rem", fontWeight: 600,
                  padding: "0.15rem 0.4rem", borderRadius: "0.25rem",
                  background: refModalItem.isActive ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                  color: refModalItem.isActive ? "#22c55e" : "#ef4444",
                  border: `1px solid ${refModalItem.isActive ? "#22c55e" : "#ef4444"}`,
                }}>
                  {refModalItem.isActive ? "פעיל" : "לא פעיל"}
                </span>
                <span style={{
                  fontSize: "0.65rem", fontWeight: 600, marginInlineStart: "auto",
                  color: refModalItem.engagementScore > 70 ? "#22c55e" : refModalItem.engagementScore > 50 ? "#f59e0b" : "var(--foreground-muted)",
                }}>
                  ⚡ {refModalItem.engagementScore}%
                </span>
              </div>

              {/* Description */}
              <p style={{ fontSize: "0.82rem", color: "var(--foreground)", lineHeight: 1.5, margin: "0 0 0.75rem 0" }}>
                {refModalItem.description}
              </p>

              {/* Metadata: dates + source link */}
              <div style={{
                display: "flex", flexDirection: "column", gap: "0.3rem",
                fontSize: "0.7rem", color: "var(--foreground-muted)",
                marginBottom: "1rem", paddingTop: "0.5rem",
                borderTop: "1px solid var(--border)",
              }}>
                {refModalItem.sourceUrl && (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <span style={{ fontWeight: 600 }}>🔗 מקור:</span>
                    <a
                      href={refModalItem.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--accent)", textDecoration: "underline", wordBreak: "break-all" }}
                    >
                      צפה במודעה המקורית
                    </a>
                  </div>
                )}
                {refModalItem.createdAt && (
                  <div>
                    <span style={{ fontWeight: 600 }}>📥 נוסף:</span>{" "}
                    {new Date(refModalItem.createdAt).toLocaleDateString("he-IL")}
                  </div>
                )}
                {refModalItem.updatedAt && (
                  <div>
                    <span style={{ fontWeight: 600 }}>🔄 עודכן:</span>{" "}
                    {new Date(refModalItem.updatedAt).toLocaleDateString("he-IL")}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                {refModalItem.sourceUrl && (
                  <a
                    href={refModalItem.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mod-btn-ghost"
                    style={{
                      fontSize: "0.78rem", fontWeight: 600,
                      padding: "0.55rem 0.75rem", borderRadius: "0.375rem",
                      cursor: "pointer", textDecoration: "none", textAlign: "center",
                    }}
                  >
                    פתח מקור ↗
                  </a>
                )}
                <button
                  className="mod-btn-primary"
                  onClick={() => {
                    toast("הרפרנס נשמר כהשראה", "success");
                    setRefModalOpen(false);
                    setRefModalItem(null);
                  }}
                  style={{
                    flex: 1, fontSize: "0.78rem", fontWeight: 600,
                    padding: "0.55rem 1rem", borderRadius: "0.375rem",
                    cursor: "pointer",
                  }}
                >
                  השתמש כהשראה
                </button>
                <button
                  className="mod-btn-ghost"
                  onClick={() => { setRefModalOpen(false); setRefModalItem(null); }}
                  style={{
                    fontSize: "0.78rem", fontWeight: 600,
                    padding: "0.55rem 0.75rem", borderRadius: "0.375rem",
                    cursor: "pointer",
                  }}
                >
                  סגור
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
