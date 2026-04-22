"use client";

export const dynamic = "force-dynamic";

import { useRouter } from "next/navigation";
import { usePayments, useClients, useHostingRecords, useProjectPayments } from "@/lib/api/use-entity";
import { useState, useMemo } from "react";

export default function AccountingPage() {
  const router = useRouter();
  const { data: payments } = usePayments();
  const { data: clients } = useClients();
  const { data: hostingRecords } = useHostingRecords();
  const { data: projectPayments } = useProjectPayments();

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    let totalRevenue = 0;
    let pendingCollections = 0;
    let overdueAmount = 0;

    // Old payments table
    if (payments) {
      payments.forEach((p: any) => {
        const dueDate = new Date(p.dueDate);
        if (p.paymentStatus === "paid" && dueDate >= monthStart && dueDate <= monthEnd) {
          totalRevenue += p.amount || 0;
        }
        if (p.paymentStatus === "pending") {
          pendingCollections += p.amount || 0;
        }
        if (p.paymentStatus === "collection_needed" && dueDate < now) {
          overdueAmount += p.amount || 0;
        }
      });
    }

    // Business project payments (source of truth: business_project_payments)
    if (projectPayments) {
      projectPayments.forEach((p: any) => {
        const amt = Number(p.amount) || 0;
        if (p.status === "paid") {
          const paidDate = p.paidAt ? new Date(p.paidAt) : (p.updatedAt ? new Date(p.updatedAt) : now);
          if (paidDate >= monthStart && paidDate <= monthEnd) {
            totalRevenue += amt;
          }
        } else if (p.isDue && p.status !== "paid") {
          // Due but not paid = pending collection
          pendingCollections += amt;
          // If it has a dueDate in the past, it's overdue
          if (p.dueDate && new Date(p.dueDate) < now) {
            overdueAmount += amt;
          }
        }
      });
    }

    return { totalRevenue, pendingCollections, overdueAmount };
  }, [payments, projectPayments]);

  // Counts: old payments + project payments that are due & unpaid
  const dueProjectPayments = projectPayments?.filter((p: any) => p.isDue && p.status !== "paid") || [];
  const pendingPaymentCount = (payments?.filter((p: any) => p.paymentStatus === "pending").length || 0) + dueProjectPayments.length;
  const overdueCount = (payments?.filter((p: any) => p.paymentStatus === "collection_needed").length || 0)
    + dueProjectPayments.filter((p: any) => p.dueDate && new Date(p.dueDate) < new Date()).length;

  return (
    <div style={{ direction: "rtl", padding: "2rem" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: "0.5rem", color: "var(--foreground)" }}>
          ניהול חשבונות
        </h1>
        <p style={{ color: "var(--foreground-muted)", fontSize: "0.95rem" }}>ניהול תשלומים, גבייות ומסמכים</p>
      </div>

      {/* Summary Stats */}
      <div
        className="ux-stagger"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1rem",
          marginBottom: "3rem",
        }}
      >
        <div
          className="premium-card ux-stagger-item"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
          }}
        >
          <p style={{ color: "var(--foreground-muted)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
            הכנסות החודש
          </p>
          <p style={{ fontSize: "1.75rem", fontWeight: "bold", color: "var(--accent)" }}>
            ₪{stats.totalRevenue.toLocaleString("he-IL")}
          </p>
        </div>

        <div
          className="premium-card ux-stagger-item"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
          }}
        >
          <p style={{ color: "var(--foreground-muted)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
            גבייות בהמתנה
          </p>
          <p style={{ fontSize: "1.75rem", fontWeight: "bold", color: "#f97316" }}>
            ₪{stats.pendingCollections.toLocaleString("he-IL")}
          </p>
          <p style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", marginTop: "0.5rem" }}>
            {pendingPaymentCount} תשלומים
          </p>
        </div>

        <div
          className="premium-card ux-stagger-item"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
          }}
        >
          <p style={{ color: "var(--foreground-muted)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
            סכומים באיחור
          </p>
          <p style={{ fontSize: "1.75rem", fontWeight: "bold", color: "#ef4444" }}>
            ₪{stats.overdueAmount.toLocaleString("he-IL")}
          </p>
          <p style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", marginTop: "0.5rem" }}>
            {overdueCount} תשלומים
          </p>
        </div>
      </div>

      {/* Navigation Cards Grid */}
      <div
        className="ux-stagger"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "1.5rem",
        }}
      >
        {/* Payments Card */}
        <button
          className="premium-card ux-stagger-item"
          onClick={() => router.push("/accounting/payments")}
          style={{
            background: "var(--surface-raised)",
            border: "2px solid var(--border)",
            borderRadius: "1rem",
            padding: "2rem",
            cursor: "pointer",
            transition: "all 0.3s ease",
            textAlign: "right",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 16px rgba(0, 181, 254, 0.2)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.1)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
          }}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>💰</div>
          <h3 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "0.5rem", color: "var(--foreground)" }}>
            תשלומים
          </h3>
          <p style={{ color: "var(--foreground-muted)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
            ניהול כל התשלומים
          </p>
          <div
            style={{
              display: "inline-block",
              background: "var(--accent)",
              color: "#000",
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              fontSize: "0.85rem",
              fontWeight: "600",
            }}
          >
            {pendingPaymentCount} בהמתנה
          </div>
        </button>

        {/* Collections Card */}
        <button
          className="premium-card ux-stagger-item"
          onClick={() => router.push("/accounting/collections")}
          style={{
            background: "var(--surface-raised)",
            border: "2px solid var(--border)",
            borderRadius: "1rem",
            padding: "2rem",
            cursor: "pointer",
            transition: "all 0.3s ease",
            textAlign: "right",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 16px rgba(0, 181, 254, 0.2)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.1)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
          }}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>📅</div>
          <h3 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "0.5rem", color: "var(--foreground)" }}>
            גבייה
          </h3>
          <p style={{ color: "var(--foreground-muted)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
            לוח גבייה חודשי
          </p>
          <div
            style={{
              display: "inline-block",
              background: "#f97316",
              color: "#fff",
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              fontSize: "0.85rem",
              fontWeight: "600",
            }}
          >
            {overdueCount} באיחור
          </div>
        </button>

        {/* Accountant Documents Card */}
        <button
          className="premium-card ux-stagger-item"
          onClick={() => router.push("/accounting/documents")}
          style={{
            background: "var(--surface-raised)",
            border: "2px solid var(--border)",
            borderRadius: "1rem",
            padding: "2rem",
            cursor: "pointer",
            transition: "all 0.3s ease",
            textAlign: "right",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 16px rgba(0, 181, 254, 0.2)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.1)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
          }}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>📄</div>
          <h3 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "0.5rem", color: "var(--foreground)" }}>
            מסמכי רואה חשבון
          </h3>
          <p style={{ color: "var(--foreground-muted)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
            ניהול מסמכים דו-חודשי
          </p>
          <div
            style={{
              display: "inline-block",
              background: "#10b981",
              color: "#fff",
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              fontSize: "0.85rem",
              fontWeight: "600",
            }}
          >
            ניהול מסמכים
          </div>
        </button>

        {/* Podcast Card */}
        <button
          className="premium-card ux-stagger-item"
          onClick={() => router.push("/accounting/podcast")}
          style={{
            background: "var(--surface-raised)",
            border: "2px solid var(--border)",
            borderRadius: "1rem",
            padding: "2rem",
            cursor: "pointer",
            transition: "all 0.3s ease",
            textAlign: "right",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 16px rgba(255, 235, 59, 0.3)";
            (e.currentTarget as HTMLElement).style.borderColor = "#ffeb3b";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.1)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
          }}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🎙️</div>
          <h3 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "0.5rem", color: "var(--foreground)" }}>
            פודקאסט
          </h3>
          <p style={{ color: "var(--foreground-muted)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
            ניהול LOUD
          </p>
          <div
            style={{
              display: "inline-block",
              background: "#ffeb3b",
              color: "#000",
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              fontSize: "0.85rem",
              fontWeight: "600",
            }}
          >
            ניהול תשלומים
          </div>
        </button>
      </div>
    </div>
  );
}
