'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export type AppRole = 'admin' | 'employee' | 'client';

interface AuthContextType {
  role: AppRole;
  setRole: (role: AppRole) => void;
  isAdmin: boolean;
  isEmployee: boolean;
  isClient: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageUsers: boolean;
  clientId: string | null;
  setClientId: (id: string | null) => void;
  employeeId: string | null;
  setEmployeeId: (id: string | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<AppRole>('admin');
  const [clientId, setClientIdState] = useState<string | null>(null);
  const [employeeId, setEmployeeIdState] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem('frameai_role') as AppRole;
      if (saved && ['admin', 'employee', 'client'].includes(saved)) {
        setRoleState(saved);
      }
      const savedClientId = localStorage.getItem('frameai_client_id');
      if (savedClientId) setClientIdState(savedClientId);
      const savedEmployeeId = localStorage.getItem('frameai_employee_id');
      if (savedEmployeeId) setEmployeeIdState(savedEmployeeId);
    } catch {}
  }, []);

  const setRole = useCallback((r: AppRole) => {
    setRoleState(r);
    try {
      localStorage.setItem('frameai_role', r);
    } catch {}
  }, []);

  const setClientId = useCallback((id: string | null) => {
    setClientIdState(id);
    try {
      if (id) localStorage.setItem('frameai_client_id', id);
      else localStorage.removeItem('frameai_client_id');
    } catch {}
  }, []);

  const setEmployeeId = useCallback((id: string | null) => {
    setEmployeeIdState(id);
    try {
      if (id) localStorage.setItem('frameai_employee_id', id);
      else localStorage.removeItem('frameai_employee_id');
    } catch {}
  }, []);

  const isAdmin = role === 'admin';
  const isEmployee = role === 'employee';
  const isClient = role === 'client';

  const value: AuthContextType = {
    role,
    setRole,
    isAdmin,
    isEmployee,
    isClient,
    canEdit: isAdmin || isEmployee,
    canDelete: isAdmin,
    canManageUsers: isAdmin,
    clientId,
    setClientId,
    employeeId,
    setEmployeeId,
  };

  if (!mounted) return <>{children}</>;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      role: 'admin',
      setRole: () => {},
      isAdmin: true,
      isEmployee: false,
      isClient: false,
      canEdit: true,
      canDelete: true,
      canManageUsers: true,
      clientId: null,
      setClientId: () => {},
      employeeId: null,
      setEmployeeId: () => {},
    };
  }
  return ctx;
}
