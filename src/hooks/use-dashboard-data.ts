"use client";

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Consolidated dashboard data hook.
 * Fetches ALL dashboard data in a single API call instead of 24+ separate ones.
 * Reduces browser connection saturation and eliminates race conditions.
 */

export interface DashboardData {
  clients: any[];
  tasks: any[];
  payments: any[];
  leads: any[];
  employees: any[];
  campaigns: any[];
  approvals: any[];
  podcastSessions: any[];
  meetings: any[];
  employeeTasks: any[];
  businessProjects: any[];
  socialPosts: any[];
  activities: any[];
  hosting: any[];
  projectPayments: any[];
  ganttItems: any[];
  _meta: { fetchedAt: string; errors: string[] };
}

const EMPTY_DATA: DashboardData = {
  clients: [],
  tasks: [],
  payments: [],
  leads: [],
  employees: [],
  campaigns: [],
  approvals: [],
  podcastSessions: [],
  meetings: [],
  employeeTasks: [],
  businessProjects: [],
  socialPosts: [],
  activities: [],
  hosting: [],
  projectPayments: [],
  ganttItems: [],
  _meta: { fetchedAt: '', errors: [] },
};

function getRoleHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  try {
    const role = localStorage.getItem('frameai_role');
    if (role) headers['x-app-role'] = role;
    const clientId = localStorage.getItem('frameai_client_id');
    if (clientId) headers['x-app-client-id'] = clientId;
    const employeeId = localStorage.getItem('frameai_employee_id');
    if (employeeId) headers['x-app-employee-id'] = employeeId;
  } catch {}
  return headers;
}

export function useDashboardData() {
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/data/dashboard-data', {
        cache: 'no-store',
        headers: getRoleHeaders(),
      });
      if (!res.ok) throw new Error(`Failed to fetch dashboard data (${res.status})`);
      const json = await res.json();
      if (isMounted.current) {
        setData(json);
        setError(null);
        if (json._meta?.errors?.length > 0) {
          console.warn('[Dashboard] Some tables had errors:', json._meta.errors);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      console.error('[Dashboard] Failed to fetch data:', msg);
      if (isMounted.current) {
        setError(msg);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refetch on window focus
  useEffect(() => {
    const handleFocus = () => fetchData();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
