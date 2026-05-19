'use client';

import { useState, useCallback, useRef, useEffect, type ChangeEvent, type DragEvent } from 'react';
import { usePodcastEpisodes } from '@/lib/api/use-podcast';
import { TusUploader } from '@/lib/storage/tus-upload';
import { createClient } from '@supabase/supabase-js';

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

interface EpisodeData {
  file: File | null;
  title: string;
  guestNames: string;
  showName: string;
  language: 'he' | 'en';
  clientId: string;
}

interface UploadProgress {
  percent: number;
  speed: number; // bytes/sec
  eta: number; // seconds
}

type ProcessingStageStatus = 'pending' | 'running' | 'done' | 'error';

interface ProcessingStage {
  key: string;
  label: string;
  status: ProcessingStageStatus;
  progress: number;
  statusText?: string;
  startedAt?: number; // timestamp when this stage started running
}

interface Clip {
  id: string;
  title: string;
  duration: number; // seconds
  topicTags: string[];
  viralScore: number;
  engagementScore: number;
  hookScore: number;
  selected: boolean;
  format: '16:9' | '9:16' | '1:1' | '4:5';
  preset: string;
  subtitles: boolean;
  broll: boolean;
}

interface RenderItem {
  clipId: string;
  title: string;
  progress: number;
  status: 'queued' | 'rendering' | 'done' | 'error';
  downloadUrl: string | null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Constants & Colors
   ═══════════════════════════════════════════════════════════════════════════ */

const COLORS = {
  primary: '#00B5FE',
  accent: '#E8F401',
  bg: '#F7F9FC',
  card: '#FFFFFF',
  text: '#1A1A2E',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
};

const STAGE_LABELS = ['העלאה', 'עיבוד', 'סקירת קליפים', 'הגדרות', 'רנדור'];

const FORMAT_OPTIONS = [
  { value: '16:9', label: '16:9 (רוחבי)' },
  { value: '9:16', label: '9:16 (אנכי)' },
  { value: '1:1', label: '1:1 (ריבוע)' },
  { value: '4:5', label: '4:5 (פורטרט)' },
] as const;

const PRESET_OPTIONS = [
  { value: 'youtube-short', label: 'YouTube Short' },
  { value: 'instagram-reel', label: 'Instagram Reel' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'full-highlight', label: 'Full Highlight' },
];

const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5 GB

/* ═══════════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════════ */

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)} שניות`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} דקות`;
  return `${(seconds / 3600).toFixed(1)} שעות`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════════════ */

export default function PodcastClipEnginePage() {
  // ── Stage navigation
  const [currentStage, setCurrentStage] = useState<number>(1);

  // ── Episode ID (set after createEpisode API call)
  const [episodeId, setEpisodeId] = useState<string | null>(null);

  // ── API hooks
  const { episodes, loading: episodesLoading, createEpisode } = usePodcastEpisodes();

  // ── Clients
  const [clients, setClients] = useState<Array<{id: string; name: string}>>([]);
  useEffect(() => {
    fetch('/api/data/clients')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const list = Array.isArray(data) ? data : data.clients || data.data || [];
        setClients(list.map((c: any) => ({ id: c.id, name: c.name || c.business_name || 'ללא שם' })));
      })
      .catch(() => {});
  }, []);

  // ── Stage 1: Upload
  const [episode, setEpisode] = useState<EpisodeData>({
    file: null,
    title: '',
    guestNames: '',
    showName: '',
    language: 'he',
    clientId: '',
  });
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);

  // ── Stage 2: Processing
  const [processingStages, setProcessingStages] = useState<ProcessingStage[]>([
    { key: 'upload', label: 'העלאת קובץ', status: 'pending', progress: 0 },
    { key: 'validate', label: 'אימות קובץ', status: 'pending', progress: 0 },
    { key: 'audio', label: 'חילוץ אודיו', status: 'pending', progress: 0 },
    { key: 'transcribe', label: 'תמלול', status: 'pending', progress: 0 },
    { key: 'segment', label: 'פילוח נושאים', status: 'pending', progress: 0 },
    { key: 'analyze', label: 'ניתוח AI', status: 'pending', progress: 0 },
    { key: 'clips', label: 'זיהוי קליפים', status: 'pending', progress: 0 },
  ]);

  // ── Stage 3: Review Clips
  const [clips, setClips] = useState<Clip[]>([]);
  const [clipsLoading, setClipsLoading] = useState(false);

  // ── Stage 5: Render
  const [renderItems, setRenderItems] = useState<RenderItem[]>([]);
  const renderPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── File handling
  const handleFile = useCallback((file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      alert('הקובץ גדול מ-5GB. אנא בחר קובץ קטן יותר.');
      return;
    }
    setEpisode((prev) => ({ ...prev, file }));
  }, []);

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const onFileSelect = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  // ── Fetch clips from API
  const fetchClips = useCallback(async (epId: string) => {
    setClipsLoading(true);
    try {
      const res = await fetch(`/api/podcast/clips?episodeId=${encodeURIComponent(epId)}`);
      if (!res.ok) throw new Error('Failed to fetch clips');
      const data = await res.json();
      const mapped: Clip[] = (Array.isArray(data) ? data : []).map((c: Record<string, unknown>, i: number) => ({
        id: c.id as string,
        title: (c.title as string) || `Clip ${i + 1}`,
        duration: ((c.end_time as number) || 0) - ((c.start_time as number) || 0),
        topicTags: Array.isArray(c.topic_tags) ? c.topic_tags as string[] : [],
        viralScore: (c.viral_score as number) || 0,
        engagementScore: (c.engagement_score as number) || 0,
        hookScore: (c.hook_score as number) || 0,
        selected: i < 5,
        format: '9:16' as const,
        preset: 'youtube-short',
        subtitles: true,
        broll: false,
      }));
      setClips(mapped);
    } catch (err) {
      console.error('Error fetching clips:', err);
    } finally {
      setClipsLoading(false);
    }
  }, []);

  // ── Helper: apply progress from DB row to local state
  const applyProgressFromRow = useCallback((row: Record<string, unknown>) => {
    const progress = row.processing_progress as {
      stage?: number;
      stageName?: string;
      percent?: number;
      statusText?: string;
    } | null;

    if (progress && typeof progress.stage === 'number') {
      setProcessingStages((prev) =>
        prev.map((s, idx) => {
          if (s.key === 'upload') {
            return { ...s, status: 'done', progress: 100 };
          }
          if (idx < progress.stage!) {
            return { ...s, status: 'done', progress: 100, statusText: undefined };
          }
          if (idx === progress.stage!) {
            return {
              ...s,
              status: progress.percent === 100 ? 'done' : 'running',
              progress: progress.percent ?? 0,
              statusText: progress.statusText || progress.stageName,
              startedAt: s.status !== 'running' ? Date.now() : s.startedAt,
            };
          }
          return { ...s, status: 'pending', progress: 0, statusText: undefined };
        }),
      );
    }

    if (row.status === 'processed') {
      setCurrentStage(3);
      if (typeof row.id === 'string') fetchClips(row.id);
    }

    if (row.status === 'error') {
      setProcessingError((row.error_message as string) || 'העיבוד נכשל');
      setProcessingStages((prev) =>
        prev.map((s) =>
          s.status === 'running' ? { ...s, status: 'error' } : s,
        ),
      );
    }
  }, [fetchClips]);

  // ── Supabase Realtime subscription for processing progress
  useEffect(() => {
    if (!episodeId || currentStage !== 2) return;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const channel = supabase
      .channel(`episode-${episodeId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'podcast_episodes',
          filter: `id=eq.${episodeId}`,
        },
        (payload) => {
          applyProgressFromRow(payload.new as Record<string, unknown>);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [episodeId, currentStage, applyProgressFromRow]);

  // ── Polling fallback: fetch episode status every 5 seconds
  //    Works even if Realtime is not enabled for the table
  useEffect(() => {
    if (!episodeId || currentStage !== 2) return;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const poll = async () => {
      try {
        const { data, error } = await supabase
          .from('podcast_episodes')
          .select('id, status, processing_progress, error_message')
          .eq('id', episodeId)
          .single();

        if (!error && data) {
          applyProgressFromRow(data as Record<string, unknown>);
        }
      } catch {
        // Silently retry on next poll
      }
    };

    // First poll immediately
    poll();

    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [episodeId, currentStage, applyProgressFromRow]);

  // ── Stage transitions
  const startProcessing = useCallback(async () => {
    if (!episode.file) return;
    setProcessingError(null);

    // Reset processing stages
    setProcessingStages((prev) =>
      prev.map((s) => ({ ...s, status: 'pending' as const, progress: 0 })),
    );

    // Step 1: Upload the file via TUS to Supabase Storage
    const timestamp = Date.now();
    const storagePath = `uploads/${timestamp}-${episode.file.name}`;

    setCurrentStage(2);
    // Mark upload stage as running
    setProcessingStages((prev) =>
      prev.map((s) =>
        s.key === 'upload' ? { ...s, status: 'running' as const, progress: 0 } : s,
      ),
    );
    setUploadProgress({ percent: 0, speed: 0, eta: 0 });

    try {
      const uploader = new TusUploader(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );

      await uploader.upload(episode.file, 'project-files', storagePath, {
        onProgress: (percent, speed, eta) => {
          setUploadProgress({ percent, speed, eta });
          // Update upload stage progress
          setProcessingStages((prev) =>
            prev.map((s) =>
              s.key === 'upload' ? { ...s, progress: percent } : s,
            ),
          );
        },
        onError: (err) => {
          setProcessingError(`Upload failed: ${err.message}`);
          setProcessingStages((prev) =>
            prev.map((s) =>
              s.key === 'upload' ? { ...s, status: 'error' as const } : s,
            ),
          );
        },
      });

      // Mark upload stage as done
      setProcessingStages((prev) =>
        prev.map((s) =>
          s.key === 'upload' ? { ...s, status: 'done' as const, progress: 100 } : s,
        ),
      );
      setUploadProgress(null);

      // Step 2: Create the episode record via API
      const created = await createEpisode({
        title: episode.title || episode.file.name,
        showName: episode.showName || undefined,
        guestNames: episode.guestNames || undefined,
        language: episode.language,
        sourceFilePath: storagePath,
        sourceFileSize: episode.file.size,
        clientId: episode.clientId || undefined,
      } as Record<string, unknown> as Parameters<typeof createEpisode>[0]);

      const newEpisodeId = created.id;
      setEpisodeId(newEpisodeId);

      // Step 3: Trigger processing pipeline — reset timer NOW
      setProcessingStartTime(Date.now());
      setElapsedSeconds(0);

      const processRes = await fetch('/api/podcast/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episodeId: newEpisodeId }),
      });

      if (!processRes.ok) {
        const errBody = await processRes.json().catch(() => ({}));
        throw new Error((errBody as { error?: string }).error || 'Failed to start processing');
      }

      // Realtime subscription (in useEffect above) will handle progress updates
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setProcessingError(message);
      console.error('startProcessing error:', message);
    }
  }, [episode, createEpisode]);

  const selectTop5 = useCallback(() => {
    setClips((prev) => {
      const sorted = [...prev].sort((a, b) => b.viralScore - a.viralScore);
      const top5Ids = new Set(sorted.slice(0, 5).map((c) => c.id));
      return prev.map((c) => ({ ...c, selected: top5Ids.has(c.id) }));
    });
  }, []);

  const selectAbove80 = useCallback(() => {
    setClips((prev) =>
      prev.map((c) => ({ ...c, selected: c.viralScore >= 80 })),
    );
  }, []);

  const toggleClip = useCallback((clipId: string) => {
    setClips((prev) =>
      prev.map((c) => (c.id === clipId ? { ...c, selected: !c.selected } : c)),
    );
  }, []);

  const updateClipConfig = useCallback(
    (clipId: string, field: keyof Clip, value: unknown) => {
      setClips((prev) =>
        prev.map((c) => (c.id === clipId ? { ...c, [field]: value } : c)),
      );
    },
    [],
  );

  const startRender = useCallback(async () => {
    if (!episodeId) return;

    const selectedClips = clips.filter((c) => c.selected);
    if (selectedClips.length === 0) return;

    // Initialize render items as queued
    setRenderItems(
      selectedClips.map((clip) => ({
        clipId: clip.id,
        title: clip.title,
        progress: 0,
        status: 'queued',
        downloadUrl: null,
      })),
    );
    setCurrentStage(5);

    try {
      // Submit render batch to API
      const res = await fetch('/api/podcast/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episodeId,
          clipIds: selectedClips.map((c) => c.id),
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error((errBody as { error?: string }).error || 'Failed to submit render');
      }

      // Start polling for render status
      if (renderPollRef.current) clearInterval(renderPollRef.current);

      renderPollRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(
            `/api/podcast/render?episodeId=${encodeURIComponent(episodeId)}`,
          );
          if (!statusRes.ok) return;
          const renders = await statusRes.json();
          if (!Array.isArray(renders)) return;

          setRenderItems((prev) =>
            prev.map((item) => {
              const match = renders.find(
                (r: Record<string, unknown>) => r.clip_candidate_id === item.clipId,
              );
              if (!match) return item;
              return {
                ...item,
                progress:
                  (match as Record<string, unknown>).status === 'completed'
                    ? 100
                    : ((match as Record<string, unknown>).progress as number) || item.progress,
                status:
                  (match as Record<string, unknown>).status === 'completed'
                    ? 'done'
                    : (match as Record<string, unknown>).status === 'failed'
                      ? 'error'
                      : (match as Record<string, unknown>).status === 'rendering'
                        ? 'rendering'
                        : 'queued',
                downloadUrl:
                  ((match as Record<string, unknown>).output_url as string) || item.downloadUrl,
              };
            }),
          );

          // Stop polling when all renders are done or errored
          const allFinished = renders.every(
            (r: Record<string, unknown>) =>
              r.status === 'completed' || r.status === 'failed',
          );
          if (allFinished && renderPollRef.current) {
            clearInterval(renderPollRef.current);
            renderPollRef.current = null;
          }
        } catch {
          // Silently retry on next poll
        }
      }, 3000);
    } catch (err) {
      console.error('startRender error:', err);
    }
  }, [clips, episodeId]);

  // Cleanup render polling on unmount
  useEffect(() => {
    return () => {
      if (renderPollRef.current) {
        clearInterval(renderPollRef.current);
      }
    };
  }, []);

  // ── Shared styles
  const cardStyle: React.CSSProperties = {
    background: COLORS.card,
    borderRadius: 16,
    padding: 24,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    border: `1px solid ${COLORS.border}`,
  };

  const buttonPrimary: React.CSSProperties = {
    background: COLORS.primary,
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '12px 32px',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  };

  const buttonSecondary: React.CSSProperties = {
    background: 'transparent',
    color: COLORS.primary,
    border: `2px solid ${COLORS.primary}`,
    borderRadius: 12,
    padding: '10px 24px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 10,
    border: `1px solid ${COLORS.border}`,
    fontSize: 15,
    direction: 'rtl',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 14,
    fontWeight: 600,
    color: COLORS.text,
    marginBottom: 6,
  };

  /* ═══════════════════════════════════════════════════════════════════════
     Render: Progress Bar (Top)
     ═══════════════════════════════════════════════════════════════════════ */

  const renderTopProgress = () => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
        marginBottom: 40,
        direction: 'rtl',
      }}
    >
      {STAGE_LABELS.map((label, i) => {
        const stageNum = i + 1;
        const isActive = stageNum === currentStage;
        const isDone = stageNum < currentStage;

        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 100 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 700,
                  background: isDone ? COLORS.success : isActive ? COLORS.primary : COLORS.border,
                  color: isDone || isActive ? '#fff' : COLORS.textSecondary,
                  transition: 'all 0.3s',
                }}
              >
                {isDone ? '✓' : stageNum}
              </div>
              <span
                style={{
                  marginTop: 8,
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? COLORS.primary : isDone ? COLORS.success : COLORS.textSecondary,
                }}
              >
                {label}
              </span>
            </div>
            {i < STAGE_LABELS.length - 1 && (
              <div
                style={{
                  width: 60,
                  height: 3,
                  background: stageNum < currentStage ? COLORS.success : COLORS.border,
                  borderRadius: 2,
                  margin: '0 4px',
                  marginBottom: 24,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  /* ═══════════════════════════════════════════════════════════════════════
     Render: Stage 1 — Upload
     ═══════════════════════════════════════════════════════════════════════ */

  const renderUploadStage = () => (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          ...cardStyle,
          border: isDragging
            ? `2px dashed ${COLORS.primary}`
            : `2px dashed ${COLORS.border}`,
          background: isDragging ? 'rgba(0,181,254,0.04)' : COLORS.card,
          textAlign: 'center',
          padding: '48px 24px',
          cursor: 'pointer',
          transition: 'all 0.2s',
          marginBottom: 24,
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,audio/*"
          onChange={onFileSelect}
          style={{ display: 'none' }}
        />
        <div style={{ fontSize: 48, marginBottom: 12 }}>🎙️</div>
        {episode.file ? (
          <div>
            <p style={{ fontSize: 18, fontWeight: 600, color: COLORS.text, margin: 0 }}>
              {episode.file.name}
            </p>
            <p style={{ fontSize: 14, color: COLORS.textSecondary, margin: '8px 0 0' }}>
              {formatBytes(episode.file.size)}
            </p>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 18, fontWeight: 600, color: COLORS.text, margin: 0 }}>
              גרור קובץ וידאו לכאן
            </p>
            <p style={{ fontSize: 14, color: COLORS.textSecondary, margin: '8px 0 0' }}>
              או לחץ לבחירת קובץ — עד 5GB
            </p>
          </div>
        )}
      </div>

      {/* Upload progress */}
      {uploadProgress && (
        <div style={{ ...cardStyle, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
            <span style={{ color: COLORS.textSecondary }}>
              {formatBytes(uploadProgress.speed)}/s — {formatEta(uploadProgress.eta)} נותרו
            </span>
            <span style={{ fontWeight: 600, color: COLORS.primary }}>{uploadProgress.percent}%</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: COLORS.border }}>
            <div
              style={{
                height: '100%',
                borderRadius: 4,
                background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.accent})`,
                width: `${uploadProgress.percent}%`,
                transition: 'width 0.3s',
              }}
            />
          </div>
          <p style={{ fontSize: 12, color: COLORS.success, marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>🟢</span> בטוח לסגירה — ההעלאה תמשיך ברקע
          </p>
        </div>
      )}

      {/* Metadata fields */}
      <div style={{ ...cardStyle }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: COLORS.text, margin: '0 0 20px' }}>
          פרטי הפרק
        </h3>
        <div style={{ display: 'grid', gap: 16 }}>
          <div>
            <label style={labelStyle}>לקוח</label>
            <select
              style={{ ...inputStyle, cursor: 'pointer' }}
              value={episode.clientId}
              onChange={(e) => setEpisode((prev) => ({ ...prev, clientId: e.target.value }))}
            >
              <option value="">בחר לקוח...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>שם הפרק</label>
            <input
              style={inputStyle}
              placeholder="למשל: פרק 42 — ראיון עם ..."
              value={episode.title}
              onChange={(e) => setEpisode((prev) => ({ ...prev, title: e.target.value }))}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>שמות אורחים</label>
              <input
                style={inputStyle}
                placeholder="מופרדים בפסיקים"
                value={episode.guestNames}
                onChange={(e) => setEpisode((prev) => ({ ...prev, guestNames: e.target.value }))}
              />
            </div>
            <div>
              <label style={labelStyle}>שם התוכנית</label>
              <input
                style={inputStyle}
                placeholder="שם הפודקאסט"
                value={episode.showName}
                onChange={(e) => setEpisode((prev) => ({ ...prev, showName: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label style={labelStyle}>שפה</label>
            <select
              style={{ ...inputStyle, cursor: 'pointer' }}
              value={episode.language}
              onChange={(e) =>
                setEpisode((prev) => ({ ...prev, language: e.target.value as 'he' | 'en' }))
              }
            >
              <option value="he">עברית</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-start' }}>
          <button
            style={{
              ...buttonPrimary,
              opacity: episode.file ? 1 : 0.5,
              pointerEvents: episode.file ? 'auto' : 'none',
            }}
            onClick={startProcessing}
          >
            התחל עיבוד
          </button>
        </div>
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════════════════════════════════
     Render: Stage 2 — Processing (Premium Waiting Experience)
     ═══════════════════════════════════════════════════════════════════════ */

  const WAITING_TIPS = [
    { icon: '🎯', text: 'הקליפים ידורגו לפי פוטנציאל ויראלי, מעורבות צפויה ואיכות ההוק' },
    { icon: '🎬', text: 'המערכת מזהה אוטומטית רגעים מעניינים, פאנצ׳ליינים וסיפורים שלמים' },
    { icon: '📊', text: 'כל קליפ יקבל ציון ויראלי מ-0 עד 100 — התמקד בקליפים מעל 80' },
    { icon: '✂️', text: 'תוכל לערוך את הקליפים — לשנות התחלה, סוף, כתוביות ותבנית' },
    { icon: '🚀', text: 'הקליפים המוכנים יהיו מותאמים ישירות לפלטפורמות — TikTok, Reels, Shorts' },
    { icon: '🎙️', text: 'זיהוי דוברים אוטומטי מאפשר כתוביות מדויקות עם שמות' },
    { icon: '🧠', text: 'ניתוח AI מזהה נושאים, רגשות וטון שיחה לבחירת קליפים חכמה' },
    { icon: '🎨', text: 'בסיום תוכל להוסיף אינטרו, אאוטרו, לוגו ובראנדינג לכל קליפ' },
  ];

  const [tipIndex, setTipIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [processingStartTime, setProcessingStartTime] = useState(() => Date.now());

  // Rotate tips every 5 seconds
  useEffect(() => {
    if (currentStage !== 2) return;
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % WAITING_TIPS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [currentStage]);

  // Elapsed time counter
  useEffect(() => {
    if (currentStage !== 2) return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - processingStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [currentStage, processingStartTime]);

  const stageIcons: Record<string, string> = {
    upload: '☁️',
    validate: '🔍',
    audio: '🎵',
    transcribe: '📝',
    segment: '🧩',
    analyze: '🧠',
    clips: '✂️',
  };

  const overallPercent = (() => {
    const doneCount = processingStages.filter((s) => s.status === 'done').length;
    const runningStage = processingStages.find((s) => s.status === 'running');
    const runningFraction = runningStage ? runningStage.progress / 100 : 0;
    return Math.round(((doneCount + runningFraction) / processingStages.length) * 100);
  })();

  const renderProcessingStage = () => (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      {/* CSS Animations */}
      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(0.95); opacity: 0.7; }
          50% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.7; }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(0,181,254,0.15); }
          50% { box-shadow: 0 0 40px rgba(0,181,254,0.3); }
        }
        .stage-item-enter { animation: fade-in-up 0.4s ease-out; }
        .tip-fade { animation: fade-in-up 0.5s ease-out; }
      `}</style>

      {/* ── Hero Progress Circle ── */}
      <div style={{
        ...cardStyle,
        background: 'linear-gradient(135deg, #FFFFFF 0%, #F0F7FF 100%)',
        padding: '40px 32px 32px',
        textAlign: 'center',
        marginBottom: 20,
        animation: 'glow-pulse 3s ease-in-out infinite',
      }}>
        {/* Circular progress */}
        <div style={{ position: 'relative', width: 160, height: 160, margin: '0 auto 24px' }}>
          {/* Background ring */}
          <svg width="160" height="160" style={{ position: 'absolute', top: 0, left: 0 }}>
            <circle cx="80" cy="80" r="70" fill="none" stroke={COLORS.border} strokeWidth="8" />
            <circle
              cx="80" cy="80" r="70"
              fill="none"
              stroke="url(#progressGradient)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 70}`}
              strokeDashoffset={`${2 * Math.PI * 70 * (1 - overallPercent / 100)}`}
              transform="rotate(-90 80 80)"
              style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
            />
            <defs>
              <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={COLORS.primary} />
                <stop offset="100%" stopColor={COLORS.accent} />
              </linearGradient>
            </defs>
          </svg>
          {/* Spinning outer ring for active state */}
          <div style={{
            position: 'absolute',
            top: -4,
            left: -4,
            width: 168,
            height: 168,
            borderRadius: '50%',
            border: '2px dashed rgba(0,181,254,0.2)',
            animation: 'spin-slow 12s linear infinite',
          }} />
          {/* Center content */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 160,
            height: 160,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span style={{
              fontSize: 40,
              fontWeight: 800,
              color: COLORS.primary,
              lineHeight: 1,
              background: `linear-gradient(135deg, ${COLORS.primary}, #0090CC)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              {overallPercent}%
            </span>
            <span style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 4 }}>
              התקדמות כללית
            </span>
          </div>
        </div>

        {/* Dynamic title */}
        <h3 style={{
          fontSize: 22,
          fontWeight: 700,
          color: COLORS.text,
          margin: '0 0 6px',
        }}>
          {uploadProgress ? 'מעלה את הקובץ לענן' : (() => {
            const running = processingStages.find(s => s.status === 'running');
            return running?.statusText || running?.label || 'מעבד את הפרק';
          })()}
        </h3>
        <p style={{ fontSize: 14, color: COLORS.textSecondary, margin: 0 }}>
          {formatDuration(elapsedSeconds)} עברו
          {uploadProgress && uploadProgress.eta > 0 && (
            <span> — עוד {formatEta(uploadProgress.eta)} בערך</span>
          )}
          {!uploadProgress && overallPercent > 0 && overallPercent < 100 && (
            <span> — {processingStages.filter(s => s.status === 'done').length} מתוך {processingStages.length} שלבים הושלמו</span>
          )}
        </p>

        {/* Upload speed badge */}
        {uploadProgress && uploadProgress.speed > 0 && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 12,
            padding: '6px 16px',
            borderRadius: 20,
            background: 'rgba(0,181,254,0.08)',
            fontSize: 13,
            fontWeight: 600,
            color: COLORS.primary,
          }}>
            <span style={{ animation: 'pulse-ring 1.5s ease-in-out infinite' }}>⚡</span>
            {formatBytes(uploadProgress.speed)}/s
          </div>
        )}
      </div>

      {/* ── File Info Card ── */}
      {episode.file && (
        <div style={{
          ...cardStyle,
          padding: '16px 20px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(0,181,254,0.1), rgba(232,244,1,0.1))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            flexShrink: 0,
          }}>
            {episode.file.type?.includes('video') ? '🎬' : '🎙️'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontSize: 14,
              fontWeight: 600,
              color: COLORS.text,
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {episode.file.name}
            </p>
            <p style={{ fontSize: 12, color: COLORS.textSecondary, margin: '2px 0 0' }}>
              {formatBytes(episode.file.size)}
              {episode.title && ` — ${episode.title}`}
            </p>
          </div>
          {uploadProgress && (
            <div style={{
              fontSize: 13,
              fontWeight: 700,
              color: COLORS.primary,
              flexShrink: 0,
            }}>
              {uploadProgress.percent}%
            </div>
          )}
        </div>
      )}

      {/* ── Stages Timeline ── */}
      <div style={{
        ...cardStyle,
        padding: '24px 20px',
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h4 style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, margin: 0 }}>שלבי עיבוד</h4>
          <span style={{ fontSize: 13, color: COLORS.textSecondary }}>
            {processingStages.filter((s) => s.status === 'done').length}/{processingStages.length}
          </span>
        </div>

        <div style={{ display: 'grid', gap: 4 }}>
          {processingStages.map((stage, idx) => {
            const isRunning = stage.status === 'running';
            const isDone = stage.status === 'done';
            const isError = stage.status === 'error';
            const isPending = stage.status === 'pending';

            return (
              <div
                key={stage.key}
                className="stage-item-enter"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: isRunning
                    ? 'rgba(0,181,254,0.05)'
                    : isDone
                      ? 'rgba(16,185,129,0.04)'
                      : 'transparent',
                  border: isRunning
                    ? '1px solid rgba(0,181,254,0.15)'
                    : '1px solid transparent',
                  transition: 'all 0.3s ease',
                }}
              >
                {/* Icon */}
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  background: isDone
                    ? 'rgba(16,185,129,0.1)'
                    : isRunning
                      ? 'rgba(0,181,254,0.1)'
                      : isError
                        ? 'rgba(239,68,68,0.1)'
                        : '#F3F4F6',
                  flexShrink: 0,
                  transition: 'all 0.3s',
                  ...(isRunning ? { animation: 'pulse-ring 2s ease-in-out infinite' } : {}),
                }}>
                  {isDone ? '✓' : isError ? '✕' : stageIcons[stage.key] || '⏳'}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontSize: 14,
                      fontWeight: isRunning ? 700 : isDone ? 600 : 400,
                      color: isRunning
                        ? COLORS.primary
                        : isDone
                          ? COLORS.success
                          : isError
                            ? COLORS.error
                            : isPending
                              ? COLORS.textSecondary
                              : COLORS.text,
                      transition: 'color 0.3s',
                    }}>
                      {stage.label}
                    </span>
                    {isRunning && (
                      <span style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: COLORS.primary,
                        background: 'rgba(0,181,254,0.08)',
                        padding: '2px 10px',
                        borderRadius: 12,
                      }}>
                        {Math.round(stage.progress)}%
                      </span>
                    )}
                    {isDone && (
                      <span style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: COLORS.success,
                        background: 'rgba(16,185,129,0.08)',
                        padding: '2px 10px',
                        borderRadius: 12,
                      }}>
                        הושלם
                      </span>
                    )}
                  </div>

                  {/* Progress bar for running stage */}
                  {isRunning && (
                    <div style={{
                      height: 4,
                      borderRadius: 2,
                      background: COLORS.border,
                      marginTop: 8,
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        borderRadius: 2,
                        background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.accent})`,
                        backgroundSize: '200% 100%',
                        width: `${stage.progress}%`,
                        transition: 'width 0.4s ease-out',
                        ...(stage.progress > 0 && stage.progress < 100
                          ? { animation: 'shimmer 2s linear infinite' }
                          : {}),
                      }} />
                    </div>
                  )}

                  {/* Upload speed & ETA */}
                  {stage.key === 'upload' && isRunning && uploadProgress && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginTop: 6,
                      fontSize: 12,
                      color: COLORS.textSecondary,
                    }}>
                      <span>{formatBytes(uploadProgress.speed)}/s</span>
                      <span>{formatEta(uploadProgress.eta)} נותרו</span>
                    </div>
                  )}

                  {/* Status text for running server stages */}
                  {isRunning && stage.key !== 'upload' && stage.statusText && (
                    <div style={{
                      marginTop: 6,
                      fontSize: 12,
                      color: COLORS.primary,
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}>
                      <span style={{
                        display: 'inline-block',
                        width: 6, height: 6, borderRadius: '50%',
                        background: COLORS.primary,
                        animation: 'pulse-ring 1.5s ease-in-out infinite',
                      }} />
                      {stage.statusText}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Tips Carousel ── */}
      <div style={{
        ...cardStyle,
        padding: '20px 24px',
        marginBottom: 20,
        background: 'linear-gradient(135deg, rgba(0,181,254,0.03), rgba(232,244,1,0.03))',
        border: '1px solid rgba(0,181,254,0.1)',
      }}>
        <div className="tip-fade" key={tipIndex} style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
        }}>
          <span style={{
            fontSize: 24,
            lineHeight: 1,
            flexShrink: 0,
            marginTop: 2,
          }}>
            {WAITING_TIPS[tipIndex].icon}
          </span>
          <div>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              color: COLORS.primary,
              textTransform: 'uppercase' as const,
              letterSpacing: 1,
            }}>
              ידעת ש...
            </span>
            <p style={{
              fontSize: 14,
              color: COLORS.text,
              margin: '4px 0 0',
              lineHeight: 1.5,
            }}>
              {WAITING_TIPS[tipIndex].text}
            </p>
          </div>
        </div>
        {/* Tip dots */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 6,
          marginTop: 14,
        }}>
          {WAITING_TIPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === tipIndex ? 20 : 6,
                height: 6,
                borderRadius: 3,
                background: i === tipIndex ? COLORS.primary : COLORS.border,
                transition: 'all 0.3s',
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Safe to close notice ── */}
      {uploadProgress && (
        <div style={{
          textAlign: 'center',
          padding: '10px 16px',
          borderRadius: 10,
          background: 'rgba(16,185,129,0.06)',
          border: '1px solid rgba(16,185,129,0.15)',
          fontSize: 13,
          color: COLORS.success,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}>
          <span style={{ animation: 'pulse-ring 2s ease-in-out infinite' }}>🟢</span>
          בטוח לסגירה — ההעלאה תמשיך ברקע ותוכל לחזור מאוחר יותר
        </div>
      )}

      {/* ── Error ── */}
      {processingError && (
        <div style={{
          marginTop: 16,
          padding: '14px 18px',
          borderRadius: 12,
          background: 'rgba(239,68,68,0.06)',
          border: '1px solid rgba(239,68,68,0.2)',
          color: COLORS.error,
          fontSize: 14,
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          {processingError}
        </div>
      )}
    </div>
  );

  /* ═══════════════════════════════════════════════════════════════════════
     Render: Stage 3 — Review Clips
     ═══════════════════════════════════════════════════════════════════════ */

  const ScoreBar = ({ value, color }: { value: number; color: string }) => (
    <div style={{ height: 6, borderRadius: 3, background: COLORS.border, flex: 1 }}>
      <div
        style={{
          height: '100%',
          borderRadius: 3,
          background: color,
          width: `${value}%`,
          transition: 'width 0.3s',
        }}
      />
    </div>
  );

  const renderReviewStage = () => (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {clipsLoading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ fontSize: 16, color: COLORS.textSecondary }}>טוען קליפים...</p>
        </div>
      )}
      {!clipsLoading && clips.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ fontSize: 16, color: COLORS.textSecondary }}>לא נמצאו קליפים עבור פרק זה.</p>
        </div>
      )}
      {/* Bulk actions */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <button style={buttonSecondary} onClick={selectTop5}>
          בחר Top 5
        </button>
        <button style={buttonSecondary} onClick={selectAbove80}>
          בחר מעל 80
        </button>
        <span style={{ fontSize: 14, color: COLORS.textSecondary, display: 'flex', alignItems: 'center' }}>
          {clips.filter((c) => c.selected).length} קליפים נבחרו מתוך {clips.length}
        </span>
        <div style={{ flex: 1 }} />
        <button
          style={{
            ...buttonPrimary,
            opacity: clips.some((c) => c.selected) ? 1 : 0.5,
            pointerEvents: clips.some((c) => c.selected) ? 'auto' : 'none',
          }}
          onClick={() => setCurrentStage(4)}
        >
          המשך להגדרות
        </button>
      </div>

      {/* Clip grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {clips.map((clip) => (
          <div
            key={clip.id}
            onClick={() => toggleClip(clip.id)}
            style={{
              ...cardStyle,
              cursor: 'pointer',
              borderColor: clip.selected ? COLORS.primary : COLORS.border,
              borderWidth: clip.selected ? 2 : 1,
              position: 'relative',
              transition: 'all 0.2s',
            }}
          >
            {/* Selection badge */}
            <div
              style={{
                position: 'absolute',
                top: 12,
                left: 12,
                width: 24,
                height: 24,
                borderRadius: 6,
                border: `2px solid ${clip.selected ? COLORS.primary : COLORS.border}`,
                background: clip.selected ? COLORS.primary : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              {clip.selected && '✓'}
            </div>

            <h4 style={{ fontSize: 15, fontWeight: 600, color: COLORS.text, margin: '0 0 8px', paddingLeft: 32 }}>
              {clip.title}
            </h4>

            <span style={{ fontSize: 13, color: COLORS.textSecondary }}>
              {formatDuration(clip.duration)}
            </span>

            {/* Tags */}
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              {clip.topicTags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    background: 'rgba(0,181,254,0.1)',
                    color: COLORS.primary,
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '3px 10px',
                    borderRadius: 20,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Scores */}
            <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: COLORS.textSecondary, minWidth: 55 }}>ויראלי</span>
                <ScoreBar value={clip.viralScore} color="#EF4444" />
                <span style={{ fontSize: 12, fontWeight: 600, minWidth: 28, textAlign: 'left' }}>{clip.viralScore}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: COLORS.textSecondary, minWidth: 55 }}>מעורבות</span>
                <ScoreBar value={clip.engagementScore} color={COLORS.primary} />
                <span style={{ fontSize: 12, fontWeight: 600, minWidth: 28, textAlign: 'left' }}>{clip.engagementScore}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: COLORS.textSecondary, minWidth: 55 }}>הוק</span>
                <ScoreBar value={clip.hookScore} color={COLORS.accent} />
                <span style={{ fontSize: 12, fontWeight: 600, minWidth: 28, textAlign: 'left' }}>{clip.hookScore}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════════════════════════════════
     Render: Stage 4 — Configure
     ═══════════════════════════════════════════════════════════════════════ */

  const renderConfigureStage = () => {
    const selectedClips = clips.filter((c) => c.selected);

    return (
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: COLORS.text, margin: 0 }}>
            הגדרות — {selectedClips.length} קליפים
          </h3>
          <button style={buttonPrimary} onClick={startRender}>
            התחל רנדור
          </button>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          {selectedClips.map((clip) => (
            <div key={clip.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <h4 style={{ fontSize: 16, fontWeight: 600, color: COLORS.text, margin: 0 }}>
                    {clip.title}
                  </h4>
                  <span style={{ fontSize: 13, color: COLORS.textSecondary }}>
                    {formatDuration(clip.duration)}
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Format */}
                <div>
                  <label style={labelStyle}>פורמט</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {FORMAT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => updateClipConfig(clip.id, 'format', opt.value)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 8,
                          fontSize: 13,
                          fontWeight: 600,
                          border: `1.5px solid ${clip.format === opt.value ? COLORS.primary : COLORS.border}`,
                          background: clip.format === opt.value ? 'rgba(0,181,254,0.08)' : 'transparent',
                          color: clip.format === opt.value ? COLORS.primary : COLORS.text,
                          cursor: 'pointer',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preset */}
                <div>
                  <label style={labelStyle}>תבנית</label>
                  <select
                    style={{ ...inputStyle, cursor: 'pointer' }}
                    value={clip.preset}
                    onChange={(e) => updateClipConfig(clip.id, 'preset', e.target.value)}
                  >
                    {PRESET_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Toggles */}
              <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={clip.subtitles}
                    onChange={(e) => updateClipConfig(clip.id, 'subtitles', e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: COLORS.primary }}
                  />
                  כתוביות
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={clip.broll}
                    onChange={(e) => updateClipConfig(clip.id, 'broll', e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: COLORS.primary }}
                  />
                  B-Roll
                </label>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
          <button style={buttonSecondary} onClick={() => setCurrentStage(3)}>
            חזרה לסקירה
          </button>
        </div>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════════════
     Render: Stage 5 — Render
     ═══════════════════════════════════════════════════════════════════════ */

  const renderRenderStage = () => {
    const allDone = renderItems.length > 0 && renderItems.every((r) => r.status === 'done');

    const statusBadge = (status: RenderItem['status']) => {
      const map: Record<string, { bg: string; color: string; label: string }> = {
        queued: { bg: '#F3F4F6', color: COLORS.textSecondary, label: 'בתור' },
        rendering: { bg: 'rgba(0,181,254,0.1)', color: COLORS.primary, label: 'מרנדר' },
        done: { bg: 'rgba(16,185,129,0.1)', color: COLORS.success, label: 'הושלם' },
        error: { bg: 'rgba(239,68,68,0.1)', color: COLORS.error, label: 'שגיאה' },
      };
      const s = map[status];
      return (
        <span
          style={{
            background: s.bg,
            color: s.color,
            fontSize: 12,
            fontWeight: 600,
            padding: '4px 12px',
            borderRadius: 20,
          }}
        >
          {s.label}
        </span>
      );
    };

    return (
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <h3 style={{ fontSize: 20, fontWeight: 700, color: COLORS.text, margin: '0 0 24px', textAlign: 'center' }}>
          תור רנדור
        </h3>

        <div style={{ display: 'grid', gap: 12 }}>
          {renderItems.map((item) => (
            <div key={item.clipId} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: COLORS.text }}>{item.title}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {statusBadge(item.status)}
                  {item.status === 'done' && item.downloadUrl && (
                    <button
                      style={{
                        background: COLORS.success,
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        padding: '6px 16px',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                      onClick={() => window.open(item.downloadUrl!, '_blank')}
                    >
                      הורד
                    </button>
                  )}
                </div>
              </div>
              {(item.status === 'rendering' || item.status === 'done') && (
                <div style={{ height: 6, borderRadius: 3, background: COLORS.border }}>
                  <div
                    style={{
                      height: '100%',
                      borderRadius: 3,
                      background: item.status === 'done' ? COLORS.success : COLORS.primary,
                      width: `${item.progress}%`,
                      transition: 'width 0.5s',
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {allDone && (
          <div style={{ marginTop: 32, textAlign: 'center' }}>
            <button
              style={{
                ...buttonPrimary,
                background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.accent})`,
                color: COLORS.text,
                padding: '14px 40px',
                fontSize: 17,
              }}
            >
              הורד הכל כ-ZIP
            </button>
          </div>
        )}
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════════════
     Main render
     ═══════════════════════════════════════════════════════════════════════ */

  return (
    <div
      style={{
        direction: 'rtl',
        minHeight: '100vh',
        background: COLORS.bg,
        padding: '32px 24px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: COLORS.text,
      }}
    >
      {/* Page title */}
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: COLORS.text }}>
          מנוע קליפים לפודקאסט
        </h1>
        <p style={{ fontSize: 15, color: COLORS.textSecondary, margin: '8px 0 32px' }}>
          העלה פרק, קבל קליפים מוכנים לפלטפורמות
        </p>
      </div>

      {renderTopProgress()}

      {currentStage === 1 && renderUploadStage()}
      {currentStage === 2 && renderProcessingStage()}
      {currentStage === 3 && renderReviewStage()}
      {currentStage === 4 && renderConfigureStage()}
      {currentStage === 5 && renderRenderStage()}

      {/* ── Previously uploaded episodes ─────────────────────────────── */}
      {currentStage === 1 && (
        <div style={{ maxWidth: 680, margin: '40px auto 0' }}>
          <div style={cardStyle}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: COLORS.text, margin: '0 0 16px' }}>
              פרקים קודמים
            </h3>
            {episodesLoading ? (
              <p style={{ fontSize: 14, color: COLORS.textSecondary }}>טוען...</p>
            ) : episodes.length === 0 ? (
              <p style={{ fontSize: 14, color: COLORS.textSecondary }}>עדיין לא הועלו פרקים.</p>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {episodes.map((ep) => (
                  <div
                    key={ep.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: `1px solid ${COLORS.border}`,
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      setEpisodeId(ep.id);
                      if (ep.status === 'processed') {
                        fetchClips(ep.id);
                        setCurrentStage(3);
                      } else if (ep.status === 'processing') {
                        setCurrentStage(2);
                      }
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 15, fontWeight: 600, color: COLORS.text }}>
                        {ep.title}
                      </span>
                      <span
                        style={{
                          display: 'block',
                          fontSize: 12,
                          color: COLORS.textSecondary,
                          marginTop: 2,
                        }}
                      >
                        {new Date(ep.createdAt).toLocaleDateString('he-IL')}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '4px 12px',
                        borderRadius: 20,
                        background:
                          ep.status === 'processed'
                            ? 'rgba(16,185,129,0.1)'
                            : ep.status === 'processing'
                              ? 'rgba(0,181,254,0.1)'
                              : ep.status === 'error'
                                ? 'rgba(239,68,68,0.1)'
                                : '#F3F4F6',
                        color:
                          ep.status === 'processed'
                            ? COLORS.success
                            : ep.status === 'processing'
                              ? COLORS.primary
                              : ep.status === 'error'
                                ? COLORS.error
                                : COLORS.textSecondary,
                      }}
                    >
                      {ep.status === 'processed'
                        ? 'הושלם'
                        : ep.status === 'processing'
                          ? 'בעיבוד'
                          : ep.status === 'error'
                            ? 'שגיאה'
                            : ep.status === 'uploaded'
                              ? 'הועלה'
                              : ep.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
