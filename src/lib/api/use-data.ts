"use client";

import { useState, useEffect, useCallback, useRef } from 'react';

// ── Persistence Logging ───────────────────────────────────────────
// Structured client-side logs for every write operation.
// Visible in browser console with [Persist] prefix for easy filtering.
function logPersistence(
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'FETCH',
  endpoint: string,
  url: string,
  status: number,
  ok: boolean,
  error?: string,
) {
  const icon = ok ? '✅' : '❌';
  const method = action === 'CREATE' ? 'POST' : action === 'UPDATE' ? 'PUT' : action === 'DELETE' ? 'DELETE' : 'GET';
  const level = ok ? 'log' : 'error';
  console[level](`${icon} [Persist] ${method} ${url} → ${status}${error ? ` | ${error}` : ''} [${endpoint}]`);
}

/** Build role headers from localStorage for API calls */
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

// ── Global Data Event Bus ──────────────────────────────────────────
// Lightweight pub/sub so any hook instance can notify others when data changes.
// Usage: when entity X is mutated, other components watching X auto-refetch.
type DataEventListener = () => void;
const listeners = new Map<string, Set<DataEventListener>>();

export function onDataChange(endpoint: string, listener: DataEventListener): () => void {
  if (!listeners.has(endpoint)) listeners.set(endpoint, new Set());
  listeners.get(endpoint)!.add(listener);
  return () => { listeners.get(endpoint)?.delete(listener); };
}

export function emitDataChange(endpoint: string) {
  listeners.get(endpoint)?.forEach(fn => fn());
}

// Notify multiple related entities at once
export function emitMultiDataChange(...endpoints: string[]) {
  endpoints.forEach(ep => emitDataChange(ep));
}

// ── Core Data Hook ─────────────────────────────────────────────────
interface UseDataResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  create: (item: Partial<T>) => Promise<T>;
  update: (id: string, item: Partial<T>) => Promise<T>;
  remove: (id: string) => Promise<void>;
}

export function useData<T extends { id: string }>(endpoint: string): UseDataResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const fetchData = useCallback(async () => {
    const url = `/api/data/${endpoint}`;
    try {
      setLoading(true);
      const res = await fetch(url, { cache: 'no-store', headers: getRoleHeaders() });
      logPersistence('FETCH', endpoint, url, res.status, res.ok);
      if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
      const json = await res.json();
      if (isMounted.current) {
        setData(Array.isArray(json) ? json : []);
        setError(null);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      logPersistence('FETCH', endpoint, url, 0, false, msg);
      if (isMounted.current) {
        setError(msg);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [endpoint]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Listen for external data change events (cross-component refresh)
  useEffect(() => {
    const unsub = onDataChange(endpoint, () => {
      fetchData();
    });
    return unsub;
  }, [endpoint, fetchData]);

  const create = async (item: Partial<T>): Promise<T> => {
    const url = `/api/data/${endpoint}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getRoleHeaders() },
      body: JSON.stringify(item),
    });
    if (!res.ok) {
      let msg = `Failed to create (${res.status})`;
      try { const body = await res.json(); if (body?.error) msg = body.error; } catch {}
      logPersistence('CREATE', endpoint, url, res.status, false, msg);
      throw new Error(msg);
    }
    const created = await res.json();
    logPersistence('CREATE', endpoint, url, res.status, true);
    if (isMounted.current) {
      setData(prev => [...prev, created]);
    }
    emitDataChange(endpoint);
    return created;
  };

  const update = async (id: string, item: Partial<T>): Promise<T> => {
    const url = `/api/data/${endpoint}/${id}`;
    console.log(`[useData] update called: PUT ${url}`, JSON.stringify(item).slice(0, 200));
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getRoleHeaders() },
      body: JSON.stringify(item),
    });
    if (!res.ok) {
      let msg = `Failed to update (${res.status})`;
      try { const body = await res.json(); if (body?.error) msg = body.error; } catch {}
      logPersistence('UPDATE', endpoint, url, res.status, false, msg);
      throw new Error(msg);
    }
    const updated = await res.json();
    logPersistence('UPDATE', endpoint, url, res.status, true);
    if (isMounted.current) {
      setData(prev => prev.map(d => d.id === id ? updated : d));
    }
    emitDataChange(endpoint);
    return updated;
  };

  const remove = async (id: string): Promise<void> => {
    const url = `/api/data/${endpoint}/${id}`;
    const res = await fetch(url, { method: 'DELETE', headers: getRoleHeaders() });
    if (!res.ok) {
      let msg = `Failed to delete (${res.status})`;
      try { const body = await res.json(); if (body?.error) msg = body.error; } catch {}
      logPersistence('DELETE', endpoint, url, res.status, false, msg);
      throw new Error(msg);
    }
    logPersistence('DELETE', endpoint, url, res.status, true);
    if (isMounted.current) {
      setData(prev => prev.filter(d => d.id !== id));
    }
    emitDataChange(endpoint);
  };

  return { data, loading, error, refetch: fetchData, create, update, remove };
}
