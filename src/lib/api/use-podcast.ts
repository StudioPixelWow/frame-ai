"use client";

import { useState, useEffect, useCallback, useRef } from 'react';

// ── Role headers (same pattern as use-data.ts) ──────────────────────
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

// ── Types ────────────────────────────────────────────────────────────

export interface PodcastEpisode {
  id: string;
  clientId: string;
  title: string;
  description?: string;
  audioUrl?: string;
  videoUrl?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface PodcastClip {
  id: string;
  episodeId: string;
  title: string;
  startTime: number;
  endTime: number;
  viralScore?: number;
  status: string;
  hookText?: string;
  subtitles?: Array<{ text: string; start: number; end: number }>;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface PodcastRender {
  id: string;
  episodeId: string;
  clipId?: string;
  status: 'queued' | 'rendering' | 'completed' | 'failed';
  progress?: number;
  outputUrl?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

// ── usePodcastEpisodes ──────────────────────────────────────────────

export function usePodcastEpisodes(clientId?: string) {
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    const params = clientId ? `?clientId=${encodeURIComponent(clientId)}` : '';
    const url = `/api/podcast/episodes${params}`;
    try {
      setLoading(true);
      const res = await fetch(url, { cache: 'no-store', headers: getRoleHeaders() });
      if (!res.ok) throw new Error(`Failed to fetch episodes (${res.status})`);
      const json = await res.json();
      if (isMounted.current) {
        setEpisodes(Array.isArray(json) ? json : json.episodes ?? []);
        setError(null);
      }
    } catch (e) {
      if (isMounted.current) setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { refresh(); }, [refresh]);

  const createEpisode = async (data: Partial<PodcastEpisode>): Promise<PodcastEpisode> => {
    const res = await fetch('/api/podcast/episodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getRoleHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      let msg = `Failed to create episode (${res.status})`;
      try { const body = await res.json(); if (body?.error) msg = body.error; } catch {}
      throw new Error(msg);
    }
    const created = await res.json();
    if (isMounted.current) setEpisodes(prev => [...prev, created]);
    return created;
  };

  const updateEpisode = async (id: string, data: Partial<PodcastEpisode>): Promise<PodcastEpisode> => {
    const res = await fetch(`/api/podcast/episodes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getRoleHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      let msg = `Failed to update episode (${res.status})`;
      try { const body = await res.json(); if (body?.error) msg = body.error; } catch {}
      throw new Error(msg);
    }
    const updated = await res.json();
    if (isMounted.current) setEpisodes(prev => prev.map(e => e.id === id ? updated : e));
    return updated;
  };

  return { episodes, loading, error, refresh, createEpisode, updateEpisode };
}

// ── usePodcastClips ─────────────────────────────────────────────────

export function usePodcastClips(episodeId: string) {
  const [clips, setClips] = useState<PodcastClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    if (!episodeId) return;
    const url = `/api/podcast/clips?episodeId=${encodeURIComponent(episodeId)}`;
    try {
      setLoading(true);
      const res = await fetch(url, { cache: 'no-store', headers: getRoleHeaders() });
      if (!res.ok) throw new Error(`Failed to fetch clips (${res.status})`);
      const json = await res.json();
      if (isMounted.current) {
        setClips(Array.isArray(json) ? json : json.clips ?? []);
        setError(null);
      }
    } catch (e) {
      if (isMounted.current) setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [episodeId]);

  useEffect(() => { refresh(); }, [refresh]);

  const updateClip = async (id: string, data: Partial<PodcastClip>): Promise<PodcastClip> => {
    const res = await fetch(`/api/podcast/clips/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getRoleHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      let msg = `Failed to update clip (${res.status})`;
      try { const body = await res.json(); if (body?.error) msg = body.error; } catch {}
      throw new Error(msg);
    }
    const updated = await res.json();
    if (isMounted.current) setClips(prev => prev.map(c => c.id === id ? updated : c));
    return updated;
  };

  const selectClip = (id: string) => setSelectedClipId(id);
  const deselectClip = () => setSelectedClipId(null);

  return { clips, loading, error, refresh, updateClip, selectClip, deselectClip, selectedClipId };
}

// ── usePodcastRenders ───────────────────────────────────────────────

export function usePodcastRenders(episodeId: string) {
  const [renders, setRenders] = useState<PodcastRender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    if (!episodeId) return;
    const url = `/api/podcast/render?episodeId=${encodeURIComponent(episodeId)}`;
    try {
      setLoading(true);
      const res = await fetch(url, { cache: 'no-store', headers: getRoleHeaders() });
      if (!res.ok) throw new Error(`Failed to fetch renders (${res.status})`);
      const json = await res.json();
      if (isMounted.current) {
        setRenders(Array.isArray(json) ? json : json.renders ?? []);
        setError(null);
      }
    } catch (e) {
      if (isMounted.current) setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [episodeId]);

  useEffect(() => { refresh(); }, [refresh]);

  const submitRender = async (data: {
    clipId?: string;
    outputFormat?: string;
    viralStyle?: string;
    [key: string]: unknown;
  }): Promise<PodcastRender> => {
    const res = await fetch('/api/podcast/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getRoleHeaders() },
      body: JSON.stringify({ episodeId, ...data }),
    });
    if (!res.ok) {
      let msg = `Failed to submit render (${res.status})`;
      try { const body = await res.json(); if (body?.error) msg = body.error; } catch {}
      throw new Error(msg);
    }
    const created = await res.json();
    if (isMounted.current) setRenders(prev => [...prev, created]);
    return created;
  };

  return { renders, loading, error, refresh, submitRender };
}
