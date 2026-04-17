"use client";

import { useState, useEffect, useCallback, useRef } from 'react';

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
    try {
      setLoading(true);
      const res = await fetch(`/api/data/${endpoint}`, { cache: 'no-store', headers: getRoleHeaders() });
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      if (isMounted.current) {
        // Guard: if the API returns a non-array (e.g. error object), keep data empty
        setData(Array.isArray(json) ? json : []);
        setError(null);
      }
    } catch (e) {
      if (isMounted.current) {
        setError(e instanceof Error ? e.message : 'Unknown error');
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
    const res = await fetch(`/api/data/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getRoleHeaders() },
      body: JSON.stringify(item),
    });
    if (!res.ok) {
      let msg = `Failed to create (${res.status})`;
      try { const body = await res.json(); if (body?.error) msg = body.error; } catch {}
      throw new Error(msg);
    }
    const created = await res.json();
    if (isMounted.current) {
      setData(prev => [...prev, created]);
    }
    // Notify other instances of the same hook
    emitDataChange(endpoint);
    return created;
  };

  const update = async (id: string, item: Partial<T>): Promise<T> => {
    const res = await fetch(`/api/data/${endpoint}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getRoleHeaders() },
      body: JSON.stringify(item),
    });
    if (!res.ok) {
      let msg = `Failed to update (${res.status})`;
      try { const body = await res.json(); if (body?.error) msg = body.error; } catch {}
      throw new Error(msg);
    }
    const updated = await res.json();
    if (isMounted.current) {
      setData(prev => prev.map(d => d.id === id ? updated : d));
    }
    emitDataChange(endpoint);
    return updated;
  };

  const remove = async (id: string): Promise<void> => {
    const res = await fetch(`/api/data/${endpoint}/${id}`, { method: 'DELETE', headers: getRoleHeaders() });
    if (!res.ok) {
      let msg = `Failed to delete (${res.status})`;
      try { const body = await res.json(); if (body?.error) msg = body.error; } catch {}
      throw new Error(msg);
    }
    if (isMounted.current) {
      setData(prev => prev.filter(d => d.id !== id));
    }
    emitDataChange(endpoint);
  };

  return { data, loading, error, refetch: fetchData, create, update, remove };
}
