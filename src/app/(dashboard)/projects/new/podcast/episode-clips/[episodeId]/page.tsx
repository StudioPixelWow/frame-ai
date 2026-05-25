'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

interface CandidateClip {
  id: string;
  episodeId: string;
  title: string;
  startTime: number;
  endTime: number;
  transcriptExcerpt: string;
  topicTags: string[];
  viralScore: number;
  engagementScore: number;
  hookScore: number;
  reasoning: string;
  candidateStatus: 'suggested' | 'edited_by_user' | 'approved' | 'rejected' | 'replaced';
  clipIndex: number | null;
  description: string | null;
  confidenceScore: number | null;
  userAdjustedStart: number | null;
  userAdjustedEnd: number | null;
}

interface ApprovedClipData {
  id: string;
  episodeId: string;
  clipCandidateId: string;
  sourceEpisodeVideoId: string;
  startTime: number;
  endTime: number;
  duration: number;
  title: string;
  description: string;
  transcriptSnippet: string;
  viralScore: number;
  engagementScore: number;
  confidenceScore: number;
  status: string;
  queuePosition: number | null;
  pipelineStateId: string | null;
  approvedAt: string;
  completedAt: string | null;
}

interface EpisodeAnalysisData {
  episode: {
    id: string;
    status: string;
    title: string;
    processingProgress: any;
    sourceFilePath: string;
    durationSeconds: number | null;
  };
  analysis: {
    topicSegments: Array<{
      id: string;
      startTime: number;
      endTime: number;
      label: string;
      keywords: string[];
    }>;
    silences: Array<{ start: number; end: number; duration: number }>;
    highEngagementMoments: Array<{ start: number; end: number; score: number; reason: string }>;
    durationSeconds: number;
  } | null;
  candidates: CandidateClip[];
  summary: {
    totalCandidates: number;
    suggested: number;
    approved: number;
    rejected: number;
    edited: number;
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Colors
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
  suggested: '#3B82F6',
  approved: '#10B981',
  rejected: '#EF4444',
  edited: '#F59E0B',
};

/* ═══════════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════════ */

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} שניות`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m}:${String(s).padStart(2, '0')} דקות` : `${m} דקות`;
}

function parseTimeToSeconds(timeStr: string): number | null {
  if (!timeStr) return null;
  // Support MM:SS or HH:MM:SS formats
  const parts = timeStr.split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function statusColor(status: string): string {
  switch (status) {
    case 'suggested': return COLORS.suggested;
    case 'approved': return COLORS.approved;
    case 'rejected': return COLORS.rejected;
    case 'edited_by_user': return COLORS.edited;
    default: return COLORS.textSecondary;
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'suggested': return 'מומלץ';
    case 'approved': return 'מאושר';
    case 'rejected': return 'נדחה';
    case 'edited_by_user': return 'נערך';
    case 'replaced': return 'הוחלף';
    default: return status;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════════════════ */

export default function EpisodeClipsPage() {
  const params = useParams();
  const router = useRouter();
  const episodeId = params.episodeId as string;

  const [data, setData] = useState<EpisodeAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClips, setSelectedClips] = useState<Set<string>>(new Set());
  const [approving, setApproving] = useState(false);
  const [expandedClip, setExpandedClip] = useState<string | null>(null);
  const [editingTimes, setEditingTimes] = useState<Record<string, { start: string; end: string }>>({});
  const [savingClip, setSavingClip] = useState<string | null>(null);
  const [previewingClip, setPreviewingClip] = useState<string | null>(null);
  const [addingManual, setAddingManual] = useState(false);
  const [manualClip, setManualClip] = useState({ title: '', startTime: '', endTime: '', description: '' });
  const [approvedClipsList, setApprovedClipsList] = useState<ApprovedClipData[]>([]);
  const [loadingApproved, setLoadingApproved] = useState(false);
  const [playingApprovedClip, setPlayingApprovedClip] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const approvedVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const approvedTimerRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timelineSectionRef = useRef<HTMLDivElement>(null);
  const clipListSectionRef = useRef<HTMLDivElement>(null);
  const videoSectionRef = useRef<HTMLDivElement>(null);
  const approveSectionRef = useRef<HTMLDivElement>(null);

  // ── Load data ─────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/podcast/episode-analysis/${episodeId}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'שגיאה בטעינת הנתונים');
      }
      const result: EpisodeAnalysisData = await res.json();
      setData(result);

      // Auto-select all suggested candidates
      const suggestedIds = new Set(
        result.candidates
          .filter(c => c.candidateStatus === 'suggested' || c.candidateStatus === 'edited_by_user')
          .map(c => c.id)
      );
      setSelectedClips(suggestedIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה');
    } finally {
      setLoading(false);
    }
  }, [episodeId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Load approved clips when episode is approved ─────────────────────────
  const loadApprovedClips = useCallback(async () => {
    setLoadingApproved(true);
    try {
      const res = await fetch(`/api/podcast/episode-queue?episodeId=${episodeId}`);
      if (res.ok) {
        const result = await res.json();
        setApprovedClipsList(result.clips || []);
      }
    } catch (err) {
      console.warn('[episode-clips] Failed to load approved clips:', err);
    } finally {
      setLoadingApproved(false);
    }
  }, [episodeId]);

  useEffect(() => {
    if (data?.episode?.status === 'clips_approved' || data?.episode?.status === 'processing_clips') {
      loadApprovedClips();
    }
  }, [data?.episode?.status, loadApprovedClips]);

  // ── Play approved clip preview ────────────────────────────────────────────
  const playApprovedClip = useCallback((clip: ApprovedClipData) => {
    const video = approvedVideoRefs.current[clip.id];
    if (!video) return;

    // Stop any currently playing clip
    if (playingApprovedClip && playingApprovedClip !== clip.id) {
      const prev = approvedVideoRefs.current[playingApprovedClip];
      if (prev) prev.pause();
      if (approvedTimerRefs.current[playingApprovedClip]) {
        clearInterval(approvedTimerRefs.current[playingApprovedClip]);
        delete approvedTimerRefs.current[playingApprovedClip];
      }
    }

    video.currentTime = clip.startTime;
    video.play();
    setPlayingApprovedClip(clip.id);

    approvedTimerRefs.current[clip.id] = setInterval(() => {
      if (video.currentTime >= clip.endTime || video.paused) {
        video.pause();
        setPlayingApprovedClip(prev => prev === clip.id ? null : prev);
        clearInterval(approvedTimerRefs.current[clip.id]);
        delete approvedTimerRefs.current[clip.id];
      }
    }, 100);
  }, [playingApprovedClip]);

  const stopApprovedClip = useCallback((clipId: string) => {
    const video = approvedVideoRefs.current[clipId];
    if (video) video.pause();
    if (approvedTimerRefs.current[clipId]) {
      clearInterval(approvedTimerRefs.current[clipId]);
      delete approvedTimerRefs.current[clipId];
    }
    setPlayingApprovedClip(prev => prev === clipId ? null : prev);
  }, []);

  // ── Navigate to clip editing ──────────────────────────────────────────────
  const [creatingClipProject, setCreatingClipProject] = useState<string | null>(null);

  const startClipEditing = useCallback((clip: ApprovedClipData) => {
    if (creatingClipProject) return; // prevent double-click
    setCreatingClipProject(clip.id);

    // Navigate to the single-video wizard with podcast-clip params pre-loaded
    // Video URL is fetched by the wizard from the episode API (avoids signed URL encoding issues)
    const params = new URLSearchParams({
      mode: 'video',
      source: 'podcast-clip',
      clipId: clip.id,
      episodeId,
      startTime: String(clip.startTime),
      endTime: String(clip.endTime),
      clipTitle: clip.title || '',
    });

    router.push(`/projects/new?${params.toString()}`);
  }, [episodeId, data?.episode?.sourceFilePath, router, creatingClipProject]);

  // ── Toggle clip selection ─────────────────────────────────────────────────
  const toggleClip = (clipId: string) => {
    setSelectedClips(prev => {
      const next = new Set(prev);
      if (next.has(clipId)) next.delete(clipId);
      else next.add(clipId);
      return next;
    });
  };

  // ── Approve selected clips ───────────────────────────────────────────────
  const handleApprove = async () => {
    if (selectedClips.size === 0 || !data) return;

    setApproving(true);
    try {
      const approvals = Array.from(selectedClips).map(candidateId => {
        const candidate = data.candidates.find(c => c.id === candidateId);
        return {
          candidateId,
          startTime: candidate?.userAdjustedStart ?? undefined,
          endTime: candidate?.userAdjustedEnd ?? undefined,
        };
      });

      const res = await fetch('/api/podcast/episode-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episodeId,
          sourceEpisodeVideoId: data.episode.id,
          approvals,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'שגיאה באישור');
      }

      const result = await res.json();
      console.log('[episode-clips] Approval result:', result);

      // Auto-trigger the processing queue after approval
      try {
        await fetch('/api/podcast/episode-queue', { method: 'POST' });
      } catch {
        // Queue trigger is best-effort — clips are already approved
        console.warn('[episode-clips] Queue trigger failed, clips are saved and can be triggered manually');
      }

      // Reload data to see updated statuses, then navigate to podcast page
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה באישור');
    } finally {
      setApproving(false);
    }
  };

  // ── Reject a candidate ────────────────────────────────────────────────────
  const handleReject = async (candidateId: string) => {
    try {
      const res = await fetch(`/api/podcast/episode-candidates/${candidateId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('שגיאה בדחייה');

      // Remove from selection and reload
      setSelectedClips(prev => {
        const next = new Set(prev);
        next.delete(candidateId);
        return next;
      });
      await loadData();
    } catch (err) {
      console.error('Reject error:', err);
    }
  };

  // ── Seek video to clip ──────────────────────────────────────────────────
  const seekToClip = useCallback((startTime: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = startTime;
      videoRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  // ── Preview clip (play from start to end) ────────────────────────────────
  const previewClip = useCallback((clip: CandidateClip) => {
    const video = videoRef.current;
    if (!video) return;

    // Stop any existing preview
    if (previewTimerRef.current) {
      clearInterval(previewTimerRef.current);
      previewTimerRef.current = null;
    }

    const start = clip.userAdjustedStart ?? clip.startTime;
    const end = clip.userAdjustedEnd ?? clip.endTime;

    video.currentTime = start;
    video.play();
    setPreviewingClip(clip.id);
    video.scrollIntoView({ behavior: 'smooth', block: 'center' });

    previewTimerRef.current = setInterval(() => {
      if (video.currentTime >= end || video.paused) {
        video.pause();
        setPreviewingClip(null);
        if (previewTimerRef.current) {
          clearInterval(previewTimerRef.current);
          previewTimerRef.current = null;
        }
      }
    }, 100);
  }, []);

  // ── Stop preview ─────────────────────────────────────────────────────────
  const stopPreview = useCallback(() => {
    if (videoRef.current) videoRef.current.pause();
    if (previewTimerRef.current) {
      clearInterval(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    setPreviewingClip(null);
  }, []);

  // ── Save time edits ─────────────────────────────────────────────────────
  const saveTimeEdits = async (clipId: string) => {
    const edits = editingTimes[clipId];
    if (!edits) return;

    const startSeconds = parseTimeToSeconds(edits.start);
    const endSeconds = parseTimeToSeconds(edits.end);

    if (startSeconds === null || endSeconds === null || endSeconds <= startSeconds) {
      alert('זמנים לא תקינים — ודא שזמן הסיום גדול מזמן ההתחלה');
      return;
    }

    setSavingClip(clipId);
    try {
      const res = await fetch(`/api/podcast/episode-candidates/${clipId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startTime: startSeconds, endTime: endSeconds }),
      });
      if (!res.ok) throw new Error('שגיאה בשמירה');
      await loadData();
      // Clear editing state for this clip
      setEditingTimes(prev => {
        const next = { ...prev };
        delete next[clipId];
        return next;
      });
    } catch (err) {
      console.error('Save time edit error:', err);
      alert('שגיאה בשמירת הזמנים');
    } finally {
      setSavingClip(null);
    }
  };

  // ── Add manual clip ─────────────────────────────────────────────────────
  const handleAddManualClip = async () => {
    if (!data) return;
    const start = parseTimeToSeconds(manualClip.startTime);
    const end = parseTimeToSeconds(manualClip.endTime);

    if (start === null || end === null || end <= start) {
      alert('זמנים לא תקינים');
      return;
    }
    if (!manualClip.title.trim()) {
      alert('נא להזין כותרת');
      return;
    }

    setSavingClip('manual');
    try {
      const res = await fetch('/api/podcast/episode-candidates/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episodeId,
          title: manualClip.title,
          startTime: start,
          endTime: end,
          description: manualClip.description || '',
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'שגיאה בהוספה');
      }
      setManualClip({ title: '', startTime: '', endTime: '', description: '' });
      setAddingManual(false);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'שגיאה בהוספת קליפ ידני');
    } finally {
      setSavingClip(null);
    }
  };

  // Clean up preview timers on unmount
  useEffect(() => {
    return () => {
      if (previewTimerRef.current) clearInterval(previewTimerRef.current);
      Object.values(approvedTimerRefs.current).forEach(t => clearInterval(t));
    };
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
          <p style={{ color: COLORS.textSecondary, fontSize: 18 }}>טוען ניתוח פרק...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <p style={{ color: COLORS.error, fontSize: 18, marginBottom: 12 }}>{error || 'לא נמצאו נתונים'}</p>
          <button
            onClick={() => router.back()}
            style={{
              padding: '10px 24px',
              background: COLORS.primary,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            חזרה
          </button>
        </div>
      </div>
    );
  }

  const { episode, analysis, candidates, summary } = data;
  const totalDuration = analysis?.durationSeconds || episode.durationSeconds || 0;
  const isAlreadyApproved = episode.status === 'clips_approved' || episode.status === 'processing_clips';

  return (
    <div dir="rtl" style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* ── Step Flow Navigation ─────────────────────────────────────────── */}
      {(() => {
        type FlowStep = {
          label: string;
          icon: string;
          done?: boolean;
          active?: boolean;
          scrollRef?: React.RefObject<HTMLDivElement | null>;
          onClick?: () => void;
        };
        const FLOW_STEPS: FlowStep[] = [
          { label: 'אימות פרק', icon: '✅', done: true },
          { label: 'ניתוח פרק', icon: '🔍', done: true },
          { label: 'זיהוי קליפים מומלצים', icon: '🎯', done: true },
          { label: 'תצוגת פרק מלא', icon: '🎬', done: true, scrollRef: videoSectionRef },
          { label: 'קליפים מוצעים על ציר הזמן', icon: '📊', active: !isAlreadyApproved, scrollRef: timelineSectionRef },
          { label: 'אישור / עריכה / החלפה', icon: '✏️', active: !isAlreadyApproved, scrollRef: clipListSectionRef },
          { label: 'שמירה למסד נתונים', icon: '💾', done: isAlreadyApproved },
          { label: 'יצירת רשומות קליפ', icon: '📋', done: isAlreadyApproved },
          { label: 'עיבוד כל קליפ בנפרד', icon: '⚙️', done: episode.status === 'processing_clips', scrollRef: approveSectionRef },
        ];
        return (
          <div style={{
            background: COLORS.card,
            borderRadius: 16,
            padding: '16px 24px',
            marginBottom: 24,
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            border: `1px solid ${COLORS.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            overflowX: 'auto',
          }}>
            {FLOW_STEPS.map((step, i) => {
              const isClickable = !!(step.scrollRef || step.onClick);
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <div
                    onClick={() => {
                      if (step.onClick) step.onClick();
                      else if (step.scrollRef?.current) {
                        step.scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: step.active ? `${COLORS.primary}15` : step.done ? `${COLORS.success}10` : 'transparent',
                      border: step.active ? `2px solid ${COLORS.primary}` : step.done ? `1px solid ${COLORS.success}40` : `1px solid ${COLORS.border}`,
                      cursor: isClickable ? 'pointer' : 'default',
                      transition: 'all 0.2s',
                      ...(isClickable ? { ':hover': { opacity: 0.8 } } as any : {}),
                    }}
                    title={isClickable ? `לחץ לגלול ל${step.label}` : undefined}
                  >
                    <span style={{ fontSize: 14 }}>{step.icon}</span>
                    <span style={{
                      fontSize: 12,
                      fontWeight: step.active ? 700 : 500,
                      color: step.active ? COLORS.primary : step.done ? COLORS.success : COLORS.textSecondary,
                      whiteSpace: 'nowrap',
                    }}>
                      {step.label}
                    </span>
                  </div>
                  {i < FLOW_STEPS.length - 1 && (
                    <span style={{ color: COLORS.border, margin: '0 2px', fontSize: 12 }}>←</span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <button
          onClick={() => router.back()}
          style={{
            background: 'none',
            border: 'none',
            color: COLORS.primary,
            cursor: 'pointer',
            fontSize: 14,
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          → חזרה לפרק
        </button>

        <h1 style={{ fontSize: 28, fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>
          בחירת קליפים מתוך הפרק
        </h1>
        <p style={{ color: COLORS.textSecondary, fontSize: 15 }}>
          {episode.title || 'פרק ללא שם'} • {totalDuration > 0 ? formatDuration(totalDuration) : 'משך לא ידוע'}
        </p>
      </div>

      {/* ── Summary cards ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'סה"כ מומלצים', value: summary.totalCandidates, color: COLORS.primary, icon: '🎬' },
          { label: 'נבחרו', value: selectedClips.size, color: COLORS.approved, icon: '✅' },
          { label: 'נדחו', value: summary.rejected, color: COLORS.rejected, icon: '❌' },
          { label: 'נערכו', value: summary.edited, color: COLORS.edited, icon: '✏️' },
        ].map(card => (
          <div
            key={card.label}
            style={{
              background: COLORS.card,
              borderRadius: 12,
              padding: '20px 24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>{card.icon}</span>
              <span style={{ color: COLORS.textSecondary, fontSize: 13 }}>{card.label}</span>
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* ── Video Player ──────────────────────────────────────────────────── */}
      {episode.sourceFilePath && (
        <div ref={videoSectionRef} style={{
          background: COLORS.card,
          borderRadius: 12,
          padding: 24,
          marginBottom: 32,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          border: `1px solid ${COLORS.border}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: COLORS.text }}>
              נגן וידאו
            </h3>
            {previewingClip && (
              <button
                onClick={stopPreview}
                style={{
                  padding: '6px 16px',
                  background: COLORS.error,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                עצור תצוגה מקדימה
              </button>
            )}
          </div>
          <video
            ref={videoRef}
            src={episode.sourceFilePath}
            controls
            crossOrigin="anonymous"
            onError={(e) => {
              const errMsg = (e.target as HTMLVideoElement).error?.message || 'שגיאה בטעינת הסרטון';
              console.error('[episode-clips] Main video load error:', errMsg);
              setVideoError(errMsg);
            }}
            style={{
              width: '100%',
              maxHeight: 400,
              borderRadius: 8,
              background: '#000',
            }}
          />
          {videoError && (
            <div style={{ marginTop: 8, padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, color: '#B91C1C', fontSize: 13 }}>
              שגיאה בטעינת הסרטון: {videoError}
            </div>
          )}
        </div>
      )}

      {/* Show message when no video URL available */}
      {!episode.sourceFilePath && (
        <div style={{
          background: COLORS.card,
          borderRadius: 12,
          padding: 24,
          marginBottom: 32,
          textAlign: 'center',
          color: COLORS.textSecondary,
          fontSize: 14,
          border: `1px solid ${COLORS.border}`,
        }}>
          לא נמצא כתובת וידאו לפרק זה — ייתכן שיש בעיה ביצירת ה-Signed URL
        </div>
      )}

      {/* ── Timeline visualization ─────────────────────────────────────────── */}
      {totalDuration > 0 && (
        <div ref={timelineSectionRef} style={{
          background: COLORS.card,
          borderRadius: 12,
          padding: 24,
          marginBottom: 32,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          border: `1px solid ${COLORS.border}`,
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: COLORS.text }}>
            ציר הזמן — קליפים מומלצים
          </h3>
          <div style={{
            position: 'relative',
            height: 60,
            background: '#F1F5F9',
            borderRadius: 8,
            overflow: 'hidden',
          }}>
            {/* Topic segments background */}
            {analysis?.topicSegments?.map((seg, i) => (
              <div
                key={seg.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `${(seg.startTime / totalDuration) * 100}%`,
                  width: `${((seg.endTime - seg.startTime) / totalDuration) * 100}%`,
                  background: i % 2 === 0 ? 'rgba(0,181,254,0.08)' : 'rgba(0,181,254,0.04)',
                  borderLeft: i > 0 ? '1px dashed rgba(0,181,254,0.2)' : undefined,
                }}
                title={seg.label}
              />
            ))}

            {/* Clip candidates on timeline */}
            {candidates.filter(c => c.candidateStatus !== 'rejected').map(clip => {
              const leftPct = (clip.startTime / totalDuration) * 100;
              const widthPct = ((clip.endTime - clip.startTime) / totalDuration) * 100;
              const isSelected = selectedClips.has(clip.id);

              return (
                <div
                  key={clip.id}
                  onClick={() => {
                    seekToClip(clip.startTime);
                    toggleClip(clip.id);
                  }}
                  style={{
                    position: 'absolute',
                    top: 8,
                    bottom: 8,
                    left: `${leftPct}%`,
                    width: `${Math.max(widthPct, 1)}%`,
                    background: isSelected
                      ? 'rgba(16,185,129,0.6)'
                      : 'rgba(59,130,246,0.4)',
                    borderRadius: 4,
                    cursor: 'pointer',
                    border: isSelected
                      ? '2px solid #10B981'
                      : '1px solid rgba(59,130,246,0.5)',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    color: '#fff',
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    padding: '0 4px',
                  }}
                  title={`${clip.title} (${formatTime(clip.startTime)} - ${formatTime(clip.endTime)})`}
                >
                  {widthPct > 4 ? (clip.clipIndex ?? '') : ''}
                </div>
              );
            })}
          </div>

          {/* Time markers */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 11, color: COLORS.textSecondary }}>00:00</span>
            <span style={{ fontSize: 11, color: COLORS.textSecondary }}>{formatTime(totalDuration / 2)}</span>
            <span style={{ fontSize: 11, color: COLORS.textSecondary }}>{formatTime(totalDuration)}</span>
          </div>
        </div>
      )}

      {/* ── Clip candidates list ───────────────────────────────────────────── */}
      <div ref={clipListSectionRef} style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: COLORS.text }}>
            קליפים מומלצים ({candidates.length})
          </h3>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setAddingManual(!addingManual)}
              style={{
                padding: '8px 16px',
                background: addingManual ? COLORS.primary : 'transparent',
                border: `1px solid ${addingManual ? COLORS.primary : COLORS.accent}`,
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 13,
                color: addingManual ? '#fff' : COLORS.primary,
                fontWeight: 600,
              }}
            >
              {addingManual ? 'ביטול' : '+ הוסף קליפ ידני'}
            </button>
            <button
              onClick={() => {
                const allIds = new Set(
                  candidates
                    .filter(c => c.candidateStatus !== 'rejected')
                    .map(c => c.id)
                );
                setSelectedClips(allIds);
              }}
              style={{
                padding: '8px 16px',
                background: 'transparent',
                border: `1px solid ${COLORS.border}`,
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 13,
                color: COLORS.textSecondary,
              }}
            >
              בחר הכל
            </button>
            <button
              onClick={() => setSelectedClips(new Set())}
              style={{
                padding: '8px 16px',
                background: 'transparent',
                border: `1px solid ${COLORS.border}`,
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 13,
                color: COLORS.textSecondary,
              }}
            >
              נקה בחירה
            </button>
          </div>
        </div>

        {/* Manual clip form */}
        {addingManual && (
          <div style={{
            background: COLORS.card,
            borderRadius: 12,
            padding: 20,
            marginBottom: 16,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            border: `2px solid ${COLORS.primary}`,
          }}>
            <h4 style={{ fontSize: 15, fontWeight: 600, color: COLORS.text, marginBottom: 12 }}>
              הוספת קליפ ידני
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: COLORS.textSecondary, display: 'block', marginBottom: 4 }}>
                  כותרת הקליפ *
                </label>
                <input
                  type="text"
                  value={manualClip.title}
                  onChange={(e) => setManualClip(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="למשל: הרגע הכי מצחיק בפרק"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: COLORS.textSecondary, display: 'block', marginBottom: 4 }}>
                  תיאור (אופציונלי)
                </label>
                <input
                  type="text"
                  value={manualClip.description}
                  onChange={(e) => setManualClip(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="תיאור קצר"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: COLORS.textSecondary, display: 'block', marginBottom: 4 }}>
                  זמן התחלה * (MM:SS)
                </label>
                <input
                  type="text"
                  value={manualClip.startTime}
                  onChange={(e) => setManualClip(prev => ({ ...prev, startTime: e.target.value }))}
                  placeholder="01:30"
                  dir="ltr"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 6,
                    fontSize: 13,
                    textAlign: 'center',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: COLORS.textSecondary, display: 'block', marginBottom: 4 }}>
                  זמן סיום * (MM:SS)
                </label>
                <input
                  type="text"
                  value={manualClip.endTime}
                  onChange={(e) => setManualClip(prev => ({ ...prev, endTime: e.target.value }))}
                  placeholder="02:45"
                  dir="ltr"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 6,
                    fontSize: 13,
                    textAlign: 'center',
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-start' }}>
              <button
                onClick={handleAddManualClip}
                disabled={savingClip === 'manual'}
                style={{
                  padding: '8px 24px',
                  background: COLORS.primary,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {savingClip === 'manual' ? 'מוסיף...' : 'הוסף קליפ'}
              </button>
              <button
                onClick={() => setAddingManual(false)}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 13,
                  color: COLORS.textSecondary,
                }}
              >
                ביטול
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {candidates.map(clip => {
            const isSelected = selectedClips.has(clip.id);
            const isExpanded = expandedClip === clip.id;
            const duration = clip.endTime - clip.startTime;
            const isRejected = clip.candidateStatus === 'rejected';

            return (
              <div
                key={clip.id}
                style={{
                  background: COLORS.card,
                  borderRadius: 12,
                  padding: '16px 20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  border: isRejected
                    ? `1px solid ${COLORS.rejected}40`
                    : isSelected
                      ? `2px solid ${COLORS.approved}`
                      : `1px solid ${COLORS.border}`,
                  opacity: isRejected ? 0.5 : 1,
                  transition: 'all 0.2s',
                }}
              >
                {/* Top row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Checkbox */}
                  <div
                    onClick={() => !isRejected && toggleClip(clip.id)}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      border: `2px solid ${isSelected ? COLORS.approved : COLORS.border}`,
                      background: isSelected ? COLORS.approved : 'transparent',
                      cursor: isRejected ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {isSelected && <span style={{ color: '#fff', fontSize: 14 }}>✓</span>}
                  </div>

                  {/* Index badge */}
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: statusColor(clip.candidateStatus),
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>
                    {clip.clipIndex ?? '?'}
                  </div>

                  {/* Title + meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: COLORS.text, marginBottom: 4 }}>
                      {clip.title}
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 12, color: COLORS.textSecondary }}>
                      <span>{formatTime(clip.startTime)} — {formatTime(clip.endTime)}</span>
                      <span>({formatDuration(duration)})</span>
                      <span style={{ color: statusColor(clip.candidateStatus), fontWeight: 600 }}>
                        {statusLabel(clip.candidateStatus)}
                      </span>
                    </div>
                  </div>

                  {/* Scores */}
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 2 }}>ויראלי</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: clip.viralScore >= 70 ? COLORS.success : COLORS.warning }}>
                        {clip.viralScore}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 2 }}>מעורבות</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: clip.engagementScore >= 70 ? COLORS.success : COLORS.warning }}>
                        {clip.engagementScore}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 2 }}>Hook</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: clip.hookScore >= 70 ? COLORS.success : COLORS.warning }}>
                        {clip.hookScore}
                      </div>
                    </div>
                    {clip.confidenceScore != null && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 2 }}>ביטחון</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: clip.confidenceScore >= 70 ? COLORS.success : COLORS.warning }}>
                          {clip.confidenceScore}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {/* Jump to position button — always visible */}
                    {episode.sourceFilePath && !isRejected && (
                      <button
                        onClick={() => seekToClip(clip.userAdjustedStart ?? clip.startTime)}
                        style={{
                          padding: '6px 12px',
                          background: 'transparent',
                          border: `1px solid ${COLORS.accent}`,
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontSize: 12,
                          color: COLORS.accent,
                          fontWeight: 600,
                        }}
                      >
                        🎯 קפוץ
                      </button>
                    )}
                    {/* Preview button */}
                    {episode.sourceFilePath && !isRejected && (
                      <button
                        onClick={() => previewingClip === clip.id ? stopPreview() : previewClip(clip)}
                        style={{
                          padding: '6px 12px',
                          background: previewingClip === clip.id ? COLORS.primary : 'transparent',
                          border: `1px solid ${COLORS.primary}`,
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontSize: 12,
                          color: previewingClip === clip.id ? '#fff' : COLORS.primary,
                          fontWeight: 600,
                        }}
                      >
                        {previewingClip === clip.id ? '⏹ עצור' : '▶ תצוגה'}
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedClip(isExpanded ? null : clip.id)}
                      style={{
                        padding: '6px 12px',
                        background: 'transparent',
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: 12,
                        color: COLORS.textSecondary,
                      }}
                    >
                      {isExpanded ? 'סגור' : 'פרטים'}
                    </button>
                    {!isRejected && (
                      <button
                        onClick={() => handleReject(clip.id)}
                        style={{
                          padding: '6px 12px',
                          background: 'transparent',
                          border: `1px solid ${COLORS.error}40`,
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontSize: 12,
                          color: COLORS.error,
                        }}
                      >
                        דחה
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div style={{
                    marginTop: 16,
                    paddingTop: 16,
                    borderTop: `1px solid ${COLORS.border}`,
                  }}>
                    {/* Time range editing */}
                    {!isRejected && (
                      <div style={{
                        marginBottom: 16,
                        padding: 16,
                        background: '#F0F9FF',
                        borderRadius: 8,
                        border: `1px solid ${COLORS.primary}30`,
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 10 }}>
                          עריכת טווח זמנים
                        </div>
                        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <label style={{ fontSize: 12, color: COLORS.textSecondary }}>התחלה:</label>
                            <input
                              type="text"
                              placeholder={formatTime(clip.userAdjustedStart ?? clip.startTime)}
                              value={editingTimes[clip.id]?.start ?? ''}
                              onChange={(e) => setEditingTimes(prev => ({
                                ...prev,
                                [clip.id]: { start: e.target.value, end: prev[clip.id]?.end ?? '' },
                              }))}
                              style={{
                                width: 80,
                                padding: '6px 10px',
                                border: `1px solid ${COLORS.border}`,
                                borderRadius: 6,
                                fontSize: 13,
                                textAlign: 'center',
                                direction: 'ltr',
                              }}
                            />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <label style={{ fontSize: 12, color: COLORS.textSecondary }}>סיום:</label>
                            <input
                              type="text"
                              placeholder={formatTime(clip.userAdjustedEnd ?? clip.endTime)}
                              value={editingTimes[clip.id]?.end ?? ''}
                              onChange={(e) => setEditingTimes(prev => ({
                                ...prev,
                                [clip.id]: { start: prev[clip.id]?.start ?? '', end: e.target.value },
                              }))}
                              style={{
                                width: 80,
                                padding: '6px 10px',
                                border: `1px solid ${COLORS.border}`,
                                borderRadius: 6,
                                fontSize: 13,
                                textAlign: 'center',
                                direction: 'ltr',
                              }}
                            />
                          </div>
                          <span style={{ fontSize: 11, color: COLORS.textSecondary }}>
                            (פורמט: MM:SS)
                          </span>
                          <button
                            onClick={() => saveTimeEdits(clip.id)}
                            disabled={savingClip === clip.id || (!editingTimes[clip.id]?.start && !editingTimes[clip.id]?.end)}
                            style={{
                              padding: '6px 16px',
                              background: (!editingTimes[clip.id]?.start && !editingTimes[clip.id]?.end) ? '#D1D5DB' : COLORS.primary,
                              color: '#fff',
                              border: 'none',
                              borderRadius: 6,
                              cursor: (!editingTimes[clip.id]?.start && !editingTimes[clip.id]?.end) ? 'not-allowed' : 'pointer',
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            {savingClip === clip.id ? 'שומר...' : 'שמור שינויים'}
                          </button>
                          {/* Seek to start button */}
                          {episode.sourceFilePath && (
                            <button
                              onClick={() => seekToClip(clip.userAdjustedStart ?? clip.startTime)}
                              style={{
                                padding: '6px 12px',
                                background: 'transparent',
                                border: `1px solid ${COLORS.primary}`,
                                borderRadius: 6,
                                cursor: 'pointer',
                                fontSize: 12,
                                color: COLORS.primary,
                              }}
                            >
                              קפוץ לנקודה בוידאו
                            </button>
                          )}
                        </div>
                        {(clip.userAdjustedStart != null || clip.userAdjustedEnd != null) && (
                          <div style={{ marginTop: 8, fontSize: 11, color: COLORS.edited }}>
                            זמנים ערוכים: {formatTime(clip.userAdjustedStart ?? clip.startTime)} — {formatTime(clip.userAdjustedEnd ?? clip.endTime)}
                            {' '}(מקור: {formatTime(clip.startTime)} — {formatTime(clip.endTime)})
                          </div>
                        )}
                      </div>
                    )}

                    {/* Description */}
                    {clip.description && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.textSecondary, marginBottom: 4 }}>
                          תיאור:
                        </div>
                        <p style={{ fontSize: 14, color: COLORS.text, lineHeight: 1.6 }}>
                          {clip.description}
                        </p>
                      </div>
                    )}

                    {clip.reasoning && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.textSecondary, marginBottom: 4 }}>
                          סיבת הבחירה:
                        </div>
                        <p style={{ fontSize: 14, color: COLORS.text, lineHeight: 1.6 }}>
                          {clip.reasoning}
                        </p>
                      </div>
                    )}

                    {clip.transcriptExcerpt && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.textSecondary, marginBottom: 4 }}>
                          קטע תמלול:
                        </div>
                        <p style={{
                          fontSize: 13,
                          color: COLORS.textSecondary,
                          lineHeight: 1.6,
                          background: '#F8FAFC',
                          padding: 12,
                          borderRadius: 8,
                          maxHeight: 120,
                          overflow: 'auto',
                        }}>
                          {clip.transcriptExcerpt.slice(0, 500)}
                          {clip.transcriptExcerpt.length > 500 ? '...' : ''}
                        </p>
                      </div>
                    )}

                    {clip.topicTags?.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {clip.topicTags.map(tag => (
                          <span
                            key={tag}
                            style={{
                              padding: '4px 10px',
                              background: `${COLORS.primary}15`,
                              color: COLORS.primary,
                              borderRadius: 20,
                              fontSize: 12,
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Post-approval: Approved clips editing section ─────────────────── */}
      {isAlreadyApproved && (
        <div ref={approveSectionRef} style={{ marginBottom: 32 }}>
          {/* Header */}
          <div style={{
            background: `linear-gradient(135deg, ${COLORS.success}15, ${COLORS.primary}10)`,
            borderRadius: 16,
            padding: '24px 28px',
            marginBottom: 24,
            border: `2px solid ${COLORS.success}40`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <span style={{ fontSize: 28 }}>🎬</span>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: COLORS.text, margin: 0 }}>
                קליפים מאושרים — מוכנים לעריכה
              </h2>
            </div>
            <p style={{ color: COLORS.textSecondary, fontSize: 14, margin: 0 }}>
              {approvedClipsList.length > 0
                ? `${approvedClipsList.length} קליפים אושרו. לחץ "התחל עריכה" כדי לערוך כל קליפ בנפרד.`
                : 'טוען קליפים מאושרים...'}
            </p>
          </div>

          {/* Loading state */}
          {loadingApproved && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
              <p style={{ color: COLORS.textSecondary }}>טוען קליפים מאושרים...</p>
            </div>
          )}

          {/* Approved clips grid */}
          {!loadingApproved && approvedClipsList.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 20 }}>
              {approvedClipsList.map((clip, idx) => {
                const isPlaying = playingApprovedClip === clip.id;
                // A clip is only "edited" if it was manually edited and completed by the user
                // pipelineStateId being set means the user started editing
                const isUserEdited = clip.status === 'completed' && !!clip.pipelineStateId;
                const isEdited = isUserEdited;
                const statusIcon = isUserEdited ? '✅' :
                  clip.status === 'failed' ? '❌' : '🎬';
                const statusText = isUserEdited ? 'נערך' :
                  clip.status === 'failed' ? 'נכשל' : 'ממתין לעריכה';

                return (
                  <div
                    key={clip.id}
                    style={{
                      background: COLORS.card,
                      borderRadius: 16,
                      overflow: 'hidden',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                      border: isEdited
                        ? `2px solid ${COLORS.success}`
                        : `1px solid ${COLORS.border}`,
                      transition: 'all 0.2s',
                    }}
                  >
                    {/* Video preview */}
                    {episode.sourceFilePath && (
                      <div style={{
                        position: 'relative',
                        background: '#000',
                        aspectRatio: '16/9',
                      }}>
                        <video
                          ref={el => { approvedVideoRefs.current[clip.id] = el; }}
                          src={`${episode.sourceFilePath}#t=${clip.startTime},${clip.endTime}`}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                          }}
                          preload="metadata"
                          crossOrigin="anonymous"
                          onError={(e) => console.error('[episode-clips] Approved clip video error:', clip.id, (e.target as HTMLVideoElement).error?.message)}
                        />
                        {/* Play overlay */}
                        <div
                          onClick={() => isPlaying ? stopApprovedClip(clip.id) : playApprovedClip(clip)}
                          style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: isPlaying ? 'transparent' : 'rgba(0,0,0,0.3)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                        >
                          {!isPlaying && (
                            <div style={{
                              width: 56,
                              height: 56,
                              borderRadius: '50%',
                              background: 'rgba(255,255,255,0.9)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 24,
                            }}>
                              ▶
                            </div>
                          )}
                        </div>
                        {/* Duration badge */}
                        <div style={{
                          position: 'absolute',
                          bottom: 8,
                          left: 8,
                          background: 'rgba(0,0,0,0.7)',
                          color: '#fff',
                          padding: '4px 8px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          direction: 'ltr',
                        }}>
                          {formatTime(clip.startTime)} — {formatTime(clip.endTime)}
                        </div>
                        {/* Queue position */}
                        <div style={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          background: COLORS.primary,
                          color: '#fff',
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 13,
                          fontWeight: 700,
                        }}>
                          {idx + 1}
                        </div>
                      </div>
                    )}

                    {/* Clip info */}
                    <div style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <h4 style={{ fontSize: 15, fontWeight: 600, color: COLORS.text, margin: 0, flex: 1 }}>
                          {clip.title}
                        </h4>
                        <span style={{
                          fontSize: 11,
                          padding: '3px 8px',
                          borderRadius: 12,
                          background: clip.status === 'completed' ? `${COLORS.success}15` :
                            clip.status === 'failed' ? `${COLORS.error}15` : `${COLORS.primary}10`,
                          color: clip.status === 'completed' ? COLORS.success :
                            clip.status === 'failed' ? COLORS.error : COLORS.primary,
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          marginRight: 8,
                        }}>
                          {statusIcon} {statusText}
                        </span>
                      </div>

                      {clip.description && (
                        <p style={{
                          fontSize: 13,
                          color: COLORS.textSecondary,
                          margin: '0 0 12px 0',
                          lineHeight: 1.5,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical' as const,
                          overflow: 'hidden',
                        }}>
                          {clip.description}
                        </p>
                      )}

                      {/* Scores row */}
                      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                        {[
                          { label: 'ויראלי', value: clip.viralScore },
                          { label: 'מעורבות', value: clip.engagementScore },
                          { label: 'ביטחון', value: clip.confidenceScore },
                        ].map(s => (
                          <div key={s.label} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: COLORS.textSecondary }}>{s.label}</div>
                            <div style={{
                              fontSize: 15,
                              fontWeight: 700,
                              color: s.value >= 70 ? COLORS.success : COLORS.warning,
                            }}>
                              {s.value}
                            </div>
                          </div>
                        ))}
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 10, color: COLORS.textSecondary }}>משך</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text }}>
                            {formatDuration(clip.duration)}
                          </div>
                        </div>
                      </div>

                      {/* Action button */}
                      <button
                        onClick={() => startClipEditing(clip)}
                        disabled={creatingClipProject === clip.id}
                        style={{
                          width: '100%',
                          padding: '12px 20px',
                          background: creatingClipProject === clip.id
                            ? '#93C5FD'
                            : isUserEdited
                            ? COLORS.success
                              : COLORS.primary,
                          color: '#fff',
                          border: 'none',
                          borderRadius: 10,
                          cursor: creatingClipProject === clip.id ? 'wait' : 'pointer',
                          fontSize: 14,
                          fontWeight: 700,
                          transition: 'all 0.2s',
                          boxShadow: '0 3px 10px rgba(0,181,254,0.2)',
                        }}
                      >
                        {creatingClipProject === clip.id
                          ? '⏳ פותח עורך...'
                          : isUserEdited
                            ? '🎬 צפה בקליפ הערוך'
                            : '✂️ התחל עריכה'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Summary section — shows when some clips are completed */}
          {!loadingApproved && approvedClipsList.some(c => c.status === 'completed') && (
            <div style={{
              marginTop: 32,
              background: COLORS.card,
              borderRadius: 16,
              padding: 28,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              border: `1px solid ${COLORS.border}`,
            }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: COLORS.text, marginBottom: 20 }}>
                סיכום קליפים
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {/* Original clips */}
                <div>
                  <h4 style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: COLORS.textSecondary,
                    marginBottom: 12,
                    paddingBottom: 8,
                    borderBottom: `2px solid ${COLORS.border}`,
                  }}>
                    🎬 קליפים לפני עריכה ({approvedClipsList.length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {approvedClipsList.map((clip, i) => (
                      <div key={`orig-${clip.id}`} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 12px',
                        background: '#F8FAFC',
                        borderRadius: 8,
                      }}>
                        <span style={{
                          width: 24, height: 24, borderRadius: '50%',
                          background: COLORS.primary, color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700, flexShrink: 0,
                        }}>{i + 1}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>
                            {clip.title}
                          </div>
                          <div style={{ fontSize: 11, color: COLORS.textSecondary }}>
                            {formatTime(clip.startTime)} — {formatTime(clip.endTime)} ({formatDuration(clip.duration)})
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Edited clips */}
                <div>
                  <h4 style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: COLORS.success,
                    marginBottom: 12,
                    paddingBottom: 8,
                    borderBottom: `2px solid ${COLORS.success}40`,
                  }}>
                    ✅ קליפים ערוכים ({approvedClipsList.filter(c => c.status === 'completed').length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {approvedClipsList.filter(c => c.status === 'completed').map((clip, i) => (
                      <div key={`edit-${clip.id}`} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 12px',
                        background: `${COLORS.success}08`,
                        borderRadius: 8,
                        border: `1px solid ${COLORS.success}20`,
                      }}>
                        <span style={{
                          width: 24, height: 24, borderRadius: '50%',
                          background: COLORS.success, color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700, flexShrink: 0,
                        }}>✓</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>
                            {clip.title}
                          </div>
                          <div style={{ fontSize: 11, color: COLORS.textSecondary }}>
                            הושלם {clip.completedAt ? new Date(clip.completedAt).toLocaleDateString('he-IL') : ''}
                          </div>
                        </div>
                        <button
                          onClick={() => startClipEditing(clip)}
                          style={{
                            padding: '4px 12px',
                            background: 'transparent',
                            border: `1px solid ${COLORS.success}`,
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: 11,
                            color: COLORS.success,
                            fontWeight: 600,
                          }}
                        >
                          צפה
                        </button>
                      </div>
                    ))}
                    {approvedClipsList.filter(c => c.status !== 'completed').length > 0 && (
                      <div style={{
                        padding: '12px 16px',
                        background: `${COLORS.warning}08`,
                        borderRadius: 8,
                        border: `1px dashed ${COLORS.warning}40`,
                        textAlign: 'center',
                        fontSize: 13,
                        color: COLORS.warning,
                      }}>
                        ⏳ {approvedClipsList.filter(c => c.status !== 'completed').length} קליפים ממתינים לעריכה
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Approve button (only when not yet approved) ─────────────────────── */}
      {!isAlreadyApproved && (
        <div style={{
          position: 'sticky',
          bottom: 0,
          background: 'linear-gradient(transparent, rgba(247,249,252,0.95) 20%)',
          padding: '24px 0',
          display: 'flex',
          justifyContent: 'center',
          gap: 16,
        }}>
          <button
            onClick={handleApprove}
            disabled={selectedClips.size === 0 || approving}
            style={{
              padding: '14px 40px',
              background: selectedClips.size === 0 ? '#D1D5DB' : COLORS.approved,
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              cursor: selectedClips.size === 0 ? 'not-allowed' : 'pointer',
              fontSize: 16,
              fontWeight: 700,
              boxShadow: selectedClips.size > 0 ? '0 4px 14px rgba(16,185,129,0.3)' : undefined,
              transition: 'all 0.2s',
            }}
          >
            {approving
              ? 'מאשר...'
              : `אשר ${selectedClips.size} קליפים והתחל עיבוד`}
          </button>

          <button
            onClick={() => router.back()}
            style={{
              padding: '14px 24px',
              background: 'transparent',
              border: `1px solid ${COLORS.border}`,
              borderRadius: 12,
              cursor: 'pointer',
              fontSize: 14,
              color: COLORS.textSecondary,
            }}
          >
            חזור ללא שינוי
          </button>
        </div>
      )}
    </div>
  );
}
