"use client";

import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react';

/**
 * Consolidated dashboard data hook with module-level shared cache.
 * No matter how many components call useDashboardData(), only ONE fetch is made.
 * All instances share the same data through a simple pub/sub store.
 */

export interface DashboardData {
  clients: any[];
  tasks: any[];
  payments: any[];
  leads: any[];
  employees: any[];
  campaigns: any[];
  adSets: any[];
  ads: any[];
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
  adSets: [],
  ads: [],
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

/* ── Module-level shared store ──────────────────────────────────────── */

interface StoreState {
  data: DashboardData;
  loading: boolean;
  error: string | null;
}

let _state: StoreState = { data: EMPTY_DATA, loading: true, error: null };
let _listeners: Set<() => void> = new Set();
let _fetchPromise: Promise<void> | null = null;
let _hasFetched = false;

function _notify() {
  _listeners.forEach((l) => l());
}

function _subscribe(listener: () => void) {
  _listeners.add(listener);
  return () => { _listeners.delete(listener); };
}

function _getSnapshot(): StoreState {
  return _state;
}

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

async function _doFetch() {
  // If already fetching, don't start another
  if (_fetchPromise) return _fetchPromise;

  _fetchPromise = (async () => {
    try {
      _state = { ..._state, loading: true };
      _notify();

      const res = await fetch('/api/data/dashboard-data', {
        cache: 'no-store',
        headers: getRoleHeaders(),
      });
      if (!res.ok) throw new Error(`Failed to fetch dashboard data (${res.status})`);
      const json = await res.json();

      _state = { data: json, loading: false, error: null };
      _hasFetched = true;

      if (json._meta?.errors?.length > 0) {
        console.warn('[Dashboard] Some tables had errors:', json._meta.errors);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      console.error('[Dashboard] Failed to fetch data:', msg);
      _state = { ..._state, loading: false, error: msg };
    } finally {
      _fetchPromise = null;
      _notify();
    }
  })();

  return _fetchPromise;
}

function _refetch() {
  _doFetch();
}

/* ── Public hook ────────────────────────────────────────────────────── */

export function useDashboardData() {
  const state = useSyncExternalStore(_subscribe, _getSnapshot, () => _state);

  // Trigger initial fetch once
  useEffect(() => {
    if (!_hasFetched && !_fetchPromise) {
      _doFetch();
    }
  }, []);

  // Refetch on window focus (debounced — at most once per 30s)
  useEffect(() => {
    let lastFocus = 0;
    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFocus > 30000) {
        lastFocus = now;
        _doFetch();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    refetch: _refetch,
  };
}
