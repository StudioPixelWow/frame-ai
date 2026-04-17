'use client';

import { useAuth, type AppRole } from '@/lib/auth/auth-context';
import { ReactNode } from 'react';

interface RoleGateProps {
  children: ReactNode;
  allowed: AppRole[];
  fallback?: ReactNode;
}

export function RoleGate({ children, allowed, fallback = null }: RoleGateProps) {
  const { role } = useAuth();
  if (!allowed.includes(role)) return <>{fallback}</>;
  return <>{children}</>;
}

export function AdminOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return <RoleGate allowed={['admin']} fallback={fallback}>{children}</RoleGate>;
}

export function StaffOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return <RoleGate allowed={['admin', 'employee']} fallback={fallback}>{children}</RoleGate>;
}
