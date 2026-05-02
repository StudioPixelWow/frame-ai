'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

export type AppRole = 'admin' | 'employee' | 'client';

interface AuthContextType {
  // Identity
  userId: string | null;
  email: string | null;
  displayName: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Role
  role: AppRole;
  setRole: (role: AppRole) => void;
  isAdmin: boolean;
  isEmployee: boolean;
  isClient: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageUsers: boolean;

  // Linked entities
  clientId: string | null;
  setClientId: (id: string | null) => void;
  employeeId: string | null;
  setEmployeeId: (id: string | null) => void;

  // Actions
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<AppRole>('admin');
  const [clientId, setClientIdState] = useState<string | null>(null);
  const [employeeId, setEmployeeIdState] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  // Read localStorage first for instant UI, then verify with server
  useEffect(() => {
    setMounted(true);

    // Step 1: Read localStorage for instant display (prevents flash)
    try {
      const saved = localStorage.getItem('frameai_role') as AppRole;
      if (saved && ['admin', 'employee', 'client'].includes(saved)) {
        setRoleState(saved);
      }
      const savedClientId = localStorage.getItem('frameai_client_id');
      if (savedClientId) setClientIdState(savedClientId);
      const savedEmployeeId = localStorage.getItem('frameai_employee_id');
      if (savedEmployeeId) setEmployeeIdState(savedEmployeeId);
      const savedEmail = localStorage.getItem('frameai_email');
      if (savedEmail) setEmail(savedEmail);
      const savedUserId = localStorage.getItem('frameai_user_id');
      if (savedUserId) setUserId(savedUserId);
      const savedDisplayName = localStorage.getItem('frameai_display_name');
      if (savedDisplayName) setDisplayName(savedDisplayName);
    } catch {}

    // Step 2: Verify with server session (cookie-based)
    fetch('/api/auth/me', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.authenticated && data.user) {
          const u = data.user;
          setRoleState(u.role || 'admin');
          setUserId(u.userId || null);
          setEmail(u.email || null);
          setClientIdState(u.clientId || null);
          setEmployeeIdState(u.employeeId || null);
          setIsAuthenticated(true);

          // Sync localStorage
          try {
            localStorage.setItem('frameai_role', u.role);
            localStorage.setItem('frameai_user_id', u.userId || '');
            localStorage.setItem('frameai_email', u.email || '');
            if (u.clientId) localStorage.setItem('frameai_client_id', u.clientId);
            if (u.employeeId) localStorage.setItem('frameai_employee_id', u.employeeId);
          } catch {}
        } else {
          // No server session — keep localStorage values for backward compatibility
          // This allows the system to work without auth during transition
          setIsAuthenticated(false);
        }
      })
      .catch(() => {
        // Network error — keep localStorage values
        setIsAuthenticated(false);
      })
      .finally(() => {
        setIsLoading(false);
      });
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

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {}

    // Clear all auth state
    setRoleState('admin');
    setUserId(null);
    setEmail(null);
    setDisplayName(null);
    setClientIdState(null);
    setEmployeeIdState(null);
    setIsAuthenticated(false);

    try {
      localStorage.removeItem('frameai_role');
      localStorage.removeItem('frameai_user_id');
      localStorage.removeItem('frameai_email');
      localStorage.removeItem('frameai_display_name');
      localStorage.removeItem('frameai_client_id');
      localStorage.removeItem('frameai_employee_id');
    } catch {}

    router.push('/login');
  }, [router]);

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await res.json();
      if (data.authenticated && data.user) {
        setRoleState(data.user.role);
        setUserId(data.user.userId);
        setEmail(data.user.email);
        setClientIdState(data.user.clientId || null);
        setEmployeeIdState(data.user.employeeId || null);
        setIsAuthenticated(true);
      }
    } catch {}
  }, []);

  const isAdmin = role === 'admin';
  const isEmployee = role === 'employee';
  const isClient = role === 'client';

  const value: AuthContextType = {
    userId,
    email,
    displayName,
    isAuthenticated,
    isLoading,
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
    logout,
    refreshSession,
  };

  if (!mounted) return <>{children}</>;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    // Fallback for components rendered outside AuthProvider
    return {
      userId: null,
      email: null,
      displayName: null,
      isAuthenticated: false,
      isLoading: false,
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
      logout: async () => {},
      refreshSession: async () => {},
    };
  }
  return ctx;
}
