'use client';

import React, { useRef, useCallback, type ChangeEvent, type DragEvent } from 'react';

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

export interface EpisodeData {
  file: File | null;
  title: string;
  guestNames: string;
  showName: string;
  language: 'he' | 'en';
}

export interface UploadProgress {
  percent: number;
  speed: number; // bytes/sec
  eta: number; // seconds
}

interface UploadStageProps {
  episode: EpisodeData;
  onEpisodeChange: (episode: EpisodeData) => void;
  uploadProgress: UploadProgress | null;
  onStartProcessing: () => void;
  onFileSelect: (file: File) => void;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Constants
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

function formatEta(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)} שניות`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} דקות`;
  return `${(seconds / 3600).toFixed(1)} שעות`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Styles
   ═══════════════════════════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════════════ */

export default function UploadStage({
  episode,
  onEpisodeChange,
  uploadProgress,
  onStartProcessing,
  onFileSelect,
}: UploadStageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const handleFile = useCallback(
    (file: File) => {
      const MAX_FILE_SIZE = 24 * 1024 * 1024 * 1024; // 24 GB
      if (file.size > MAX_FILE_SIZE) {
        alert('הקובץ גדול מ-24GB. אנא בחר קובץ קטן יותר.');
        return;
      }
      onFileSelect(file);
    },
    [onFileSelect],
  );

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

  const onInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', direction: 'rtl' }}>
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
          onChange={onInputChange}
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
              או לחץ לבחירת קובץ — עד 24GB
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
            <label style={labelStyle}>שם הפרק</label>
            <input
              style={inputStyle}
              placeholder="למשל: פרק 42 — ראיון עם ..."
              value={episode.title}
              onChange={(e) => onEpisodeChange({ ...episode, title: e.target.value })}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>שמות אורחים</label>
              <input
                style={inputStyle}
                placeholder="מופרדים בפסיקים"
                value={episode.guestNames}
                onChange={(e) => onEpisodeChange({ ...episode, guestNames: e.target.value })}
              />
            </div>
            <div>
              <label style={labelStyle}>שם התוכנית</label>
              <input
                style={inputStyle}
                placeholder="שם הפודקאסט"
                value={episode.showName}
                onChange={(e) => onEpisodeChange({ ...episode, showName: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label style={labelStyle}>שפה</label>
            <select
              style={{ ...inputStyle, cursor: 'pointer' }}
              value={episode.language}
              onChange={(e) =>
                onEpisodeChange({ ...episode, language: e.target.value as 'he' | 'en' })
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
            onClick={onStartProcessing}
          >
            התחל עיבוד
          </button>
        </div>
      </div>
    </div>
  );
}
