'use client';

import React from 'react';

/** Shimmer skeleton — wraps CSS class from globals.css */
export function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton ${className}`} style={style} />;
}

/** Card-shaped skeleton with title + 2 text rows */
export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="skeleton-card">
      <Skeleton className="skeleton-title" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="skeleton-text" style={{ width: `${70 + Math.random() * 25}%` }} />
      ))}
    </div>
  );
}

/** KPI-shaped skeleton (number + label) */
export function SkeletonKPI() {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '0.875rem',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.75rem',
      }}
    >
      <Skeleton style={{ width: 64, height: 36, borderRadius: '0.5rem' }} />
      <Skeleton className="skeleton-text" style={{ width: '60%' }} />
    </div>
  );
}

/** Grid of skeleton cards */
export function SkeletonGrid({ count = 4, columns = 'repeat(auto-fill, minmax(280px, 1fr))' }: { count?: number; columns?: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: columns, gap: '1rem' }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/** Row of skeleton KPIs */
export function SkeletonKPIRow({ count = 4 }: { count?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(140px, 1fr))`, gap: '1rem' }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonKPI key={i} />
      ))}
    </div>
  );
}
