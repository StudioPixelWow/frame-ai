/**
 * Client Health Utility
 * Shared utility for calculating client health metrics, status inference, and snapshot counts
 * Hebrew business management app (Next.js, TypeScript)
 */

// ============================================================================
// Types
// ============================================================================

export type ClientStatusExtended =
  | "new"
  | "active"
  | "at_risk"
  | "paused"
  | "finished"
  | "inactive"
  | "prospect";

export type PaymentStatus =
  | "draft"
  | "pending"
  | "msg_sent"
  | "paid"
  | "overdue"
  | "write_off";

export type ProjectPaymentStatus =
  | "pending"
  | "collection_needed"
  | "paid"
  | "overdue";

export type TaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "done"
  | "cancelled";

export type HealthScoreStatus = "good" | "attention" | "risk";

export interface ClientData {
  id?: string;
  status: ClientStatusExtended;
  retainerAmount?: number;
  paymentStatus?: PaymentStatus;
  monthlyGanttStatus?: "draft" | "sent_to_client" | "approved" | "client_approved";
  annualGanttStatus?: "draft" | "sent_to_client" | "approved" | "client_approved";
  assignedManagerId?: string | null;
}

export interface Task {
  id?: string;
  clientId?: string;
  status: TaskStatus;
  dueDate?: Date | string;
  priority?: "low" | "medium" | "high";
}

export interface Payment {
  id?: string;
  clientId?: string;
  status: PaymentStatus;
  amount: number;
  dueDate?: Date | string;
}

export interface ProjectPayment {
  id?: string;
  clientId?: string;
  status: ProjectPaymentStatus;
  amount: number;
  dueDate?: Date | string;
  isDue?: boolean;
  isPaid?: boolean;
}

export interface ClientHealthScore {
  score: number;
  status: HealthScoreStatus;
  factors: string[];
  color: string;
}

export interface ClientSnapshot {
  activeCampaigns: number;
  openLeads: number;
  pendingTasks: number;
  upcomingContent: number;
  totalPosts: number;
}

export interface StatusLabel {
  label: string;
  color: string;
}

// ============================================================================
// Constants
// ============================================================================

export const STATUS_LABELS_EXTENDED: Record<ClientStatusExtended, StatusLabel> =
  {
    new: { label: "חדש", color: "#3b82f6" },
    active: { label: "פעיל", color: "#22c55e" },
    at_risk: { label: "בסיכון", color: "#ef4444" },
    paused: { label: "מושהה", color: "#f59e0b" },
    finished: { label: "הסתיים", color: "#6b7280" },
    inactive: { label: "לא פעיל", color: "#9ca3af" },
    prospect: { label: "פוטנציאלי", color: "#a78bfa" },
  };

const HEALTH_SCORE_COLORS = {
  good: "#22c55e",
  attention: "#f59e0b",
  risk: "#ef4444",
};

// ============================================================================
// Health Score Calculator
// ============================================================================

/**
 * Computes comprehensive health score for a client based on multiple factors
 * @param client - Client data with status, retainer, payment status, gantt status, manager assignment
 * @param tasks - Array of client tasks
 * @param payments - Array of invoices/payments
 * @param projectPayments - Array of project-based payments
 * @returns Health score (0-100), status category, contributing factors, and color
 */
export function computeClientHealth(
  client: ClientData,
  tasks: Task[] = [],
  payments: Payment[] = [],
  projectPayments: ProjectPayment[] = []
): ClientHealthScore {
  const factors: string[] = [];
  let totalScore = 0;

  // 1. Payment Health (35 points)
  const paymentScore = calculatePaymentHealth(
    payments,
    projectPayments,
    factors
  );
  totalScore += paymentScore;

  // 2. Gantt Planning (20 points)
  const ganttScore = calculateGanttHealth(client, factors);
  totalScore += ganttScore;

  // 3. Task Activity (20 points)
  const taskScore = calculateTaskHealth(tasks, factors);
  totalScore += taskScore;

  // 4. Financial Stability (15 points)
  const financialScore = calculateFinancialStability(client, factors);
  totalScore += financialScore;

  // 5. Management (10 points)
  const managementScore = calculateManagementHealth(client, factors);
  totalScore += managementScore;

  // Clamp score between 0 and 100
  const score = Math.max(0, Math.min(100, totalScore));

  // Determine status and color based on score
  let status: HealthScoreStatus;
  if (score >= 70) {
    status = "good";
  } else if (score >= 40) {
    status = "attention";
  } else {
    status = "risk";
  }

  const color = HEALTH_SCORE_COLORS[status];

  return {
    score: Math.round(score),
    status,
    factors,
    color,
  };
}

/**
 * Calculate payment health score (35 points max)
 */
function calculatePaymentHealth(
  payments: Payment[],
  projectPayments: ProjectPayment[],
  factors: string[]
): number {
  const allPayments = [...payments, ...projectPayments];

  if (allPayments.length === 0) {
    factors.push("אין היסטוריית תשלומים");
    return 17.5; // Middle score for no payment history
  }

  const overdue = allPayments.filter(
    (p): p is Payment | ProjectPayment =>
      ("status" in p && p.status === "overdue") ||
      (p instanceof Object &&
        "status" in p &&
        (p as any).status === "overdue")
  ).length;

  const writeOff = payments.filter((p) => p.status === "write_off").length;

  if (overdue === 0 && writeOff === 0) {
    const allPaid = allPayments.every(
      (p) =>
        ("status" in p && p.status === "paid") ||
        ("isPaid" in p && p.isPaid === true)
    );

    if (allPaid) {
      factors.push("כל התשלומים שולמו בזמן");
      return 35;
    }

    factors.push("אין תשלומים בפיגור");
    return 28;
  }

  // Deduct proportionally for overdue payments
  const overdueRatio = overdue / allPayments.length;
  const deduction = overdueRatio * 20; // Overdue can deduct up to 20 points
  const writeOffDeduction = writeOff * 5; // Each write-off is 5 points

  factors.push(
    `${overdue} תשלומים בפיגור${writeOff > 0 ? ` ו-${writeOff} חובות שנמחקו` : ""}`
  );

  return Math.max(5, 35 - deduction - writeOffDeduction);
}

/**
 * Calculate gantt/planning health score (20 points max)
 */
function calculateGanttHealth(client: ClientData, factors: string[]): number {
  const monthlyStatus = client.monthlyGanttStatus;
  const annualStatus = client.annualGanttStatus;

  // Use the better status of the two
  let bestStatus = monthlyStatus || annualStatus || "none";

  if (
    monthlyStatus === "approved" ||
    monthlyStatus === "client_approved" ||
    annualStatus === "approved" ||
    annualStatus === "client_approved"
  ) {
    factors.push("תוכנית גאנט אושרה");
    return 20;
  }

  if (
    monthlyStatus === "sent_to_client" ||
    annualStatus === "sent_to_client"
  ) {
    factors.push("תוכנית גאנט נשלחה לאישור");
    return 15;
  }

  if (monthlyStatus === "draft" || annualStatus === "draft") {
    factors.push("תוכנית גאנט בעבודה");
    return 10;
  }

  factors.push("אין תוכנית גאנט");
  return 0;
}

/**
 * Calculate task activity health score (20 points max)
 */
function calculateTaskHealth(tasks: Task[], factors: string[]): number {
  if (tasks.length === 0) {
    factors.push("אין משימות");
    return 5;
  }

  const activeTasks = tasks.filter(
    (t) =>
      t.status !== "completed" &&
      t.status !== "done" &&
      t.status !== "cancelled"
  );

  if (activeTasks.length > 0) {
    factors.push(`${activeTasks.length} משימות פעילות`);
    return 20;
  }

  const completedTasks = tasks.filter(
    (t) => t.status === "completed" || t.status === "done"
  );

  if (completedTasks.length === tasks.length) {
    factors.push("כל המשימות הושלמו");
    return 15;
  }

  factors.push("משימות במצב כלל");
  return 10;
}

/**
 * Calculate financial stability score (15 points max)
 */
function calculateFinancialStability(
  client: ClientData,
  factors: string[]
): number {
  if (client.retainerAmount && client.retainerAmount > 0) {
    factors.push(`יש הסכם אחזקה בגובה ${client.retainerAmount}`);
    return 15;
  }

  factors.push("אין הסכם אחזקה");
  return 5;
}

/**
 * Calculate management assignment score (10 points max)
 */
function calculateManagementHealth(
  client: ClientData,
  factors: string[]
): number {
  if (client.assignedManagerId) {
    factors.push("יש מנהל חשבון מוקצה");
    return 10;
  }

  factors.push("אין מנהל חשבון מוקצה");
  return 0;
}

// ============================================================================
// Status Inference
// ============================================================================

/**
 * Infers extended client status based on client data and health score
 * @param client - Client data
 * @param healthScore - Computed health score (optional)
 * @returns Inferred extended status
 */
export function inferClientStatus(
  client: ClientData,
  healthScore?: ClientHealthScore
): ClientStatusExtended {
  // Prospects stay as prospects
  if (client.status === "prospect") {
    return "prospect";
  }

  // At risk clients based on health
  if (
    healthScore &&
    healthScore.status === "risk"
  ) {
    return "at_risk";
  }

  // Inactive clients might be paused or finished
  if (client.status === "inactive") {
    // TODO: Check for recent activity to differentiate between paused and finished
    // This requires checking timestamps in tasks, payments, or communications
    // For now, return finished for inactive
    return "finished";
  }

  // Return status as-is for active/new
  return client.status;
}

// ============================================================================
// Snapshot Counts
// ============================================================================

export interface Campaign {
  id: string;
  clientId: string;
  status: "active" | "in_progress" | "paused" | "completed" | "archived";
}

export interface Lead {
  id: string;
  clientId: string;
  status: "new" | "contacted" | "qualified" | "won" | "lost" | "not_relevant";
}

export interface GanttItem {
  id: string;
  clientId: string;
  status: "draft" | "scheduled" | "in_progress" | "published" | "cancelled";
  date?: Date | string;
}

export interface SocialPost {
  id: string;
  clientId: string;
}

/**
 * Calculates snapshot counts for a client across various entities
 * @param clientId - Client ID to filter by
 * @param campaigns - Array of campaign objects
 * @param leads - Array of lead objects
 * @param tasks - Array of task objects
 * @param ganttItems - Array of gantt/content planning items
 * @param socialPosts - Array of social media posts
 * @returns Object with counts for various client metrics
 */
export function getClientSnapshotCounts(
  clientId: string,
  campaigns: Campaign[] = [],
  leads: Lead[] = [],
  tasks: Task[] = [],
  ganttItems: GanttItem[] = [],
  socialPosts: SocialPost[] = []
): ClientSnapshot {
  // Active campaigns (active or in_progress)
  const activeCampaigns = campaigns.filter(
    (c) =>
      c.clientId === clientId &&
      (c.status === "active" || c.status === "in_progress")
  ).length;

  // Open leads (not won, lost, or not_relevant)
  const openLeads = leads.filter(
    (l) =>
      l.clientId === clientId &&
      l.status !== "won" &&
      l.status !== "lost" &&
      l.status !== "not_relevant"
  ).length;

  // Pending tasks (not completed or done)
  const pendingTasks = tasks.filter(
    (t) =>
      t.clientId === clientId &&
      t.status !== "completed" &&
      t.status !== "done"
  ).length;

  // Upcoming content (not published or cancelled, with future date)
  const now = new Date();
  const upcomingContent = ganttItems.filter((g) => {
    if (
      g.clientId !== clientId ||
      g.status === "published" ||
      g.status === "cancelled"
    ) {
      return false;
    }

    if (!g.date) {
      return true; // Include items without dates
    }

    const itemDate = new Date(g.date);
    return itemDate > now;
  }).length;

  // Total social posts for this client
  const totalPosts = socialPosts.filter((p) => p.clientId === clientId).length;

  return {
    activeCampaigns,
    openLeads,
    pendingTasks,
    upcomingContent,
    totalPosts,
  };
}
