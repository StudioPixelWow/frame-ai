"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────
interface ProgressStage {
  label: string;
  hint?: string;
  threshold: number; // 0–100, progress value when this stage activates
}

interface AIProgressModalProps {
  /** Whether the modal is visible */
  open: boolean;
  /** Current progress 0–100 */
  progress: number;
  /** Custom stages (defaults provided) */
  stages?: ProgressStage[];
  /** Called when success animation finishes */
  onComplete?: () => void;
  /** Override the success message */
  successMessage?: string;
}

const DEFAULT_STAGES: ProgressStage[] = [
  { label: "מנתח נתונים...", hint: "קורא את המידע הרלוונטי", threshold: 0 },
  { label: "בונה תובנות...", hint: "מעבד דפוסים וקשרים", threshold: 30 },
  { label: "מעבד...", hint: "מארגן את התוצאות", threshold: 60 },
  { label: "מסיים...", hint: "בדיקות אחרונות", threshold: 85 },
];

// SVG ring constants
const RADIUS = 62;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// ── Component ────────────────────────────────────────────────────────────
export function AIProgressModal({
  open,
  progress,
  stages = DEFAULT_STAGES,
  onComplete,
  successMessage = "הושלם בהצלחה",
}: AIProgressModalProps) {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [visible, setVisible] = useState(false);
  const rafRef = useRef<number>(0);
  const targetRef = useRef(0);

  // Smooth progress interpolation
  useEffect(() => {
    targetRef.current = Math.min(progress, 100);

    const animate = () => {
      setDisplayProgress((prev) => {
        const diff = targetRef.current - prev;
        if (Math.abs(diff) < 0.5) return targetRef.current;
        return prev + diff * 0.08; // smooth easing
      });
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [progress]);

  // Open/close lifecycle
  useEffect(() => {
    if (open) {
      setVisible(true);
      setIsSuccess(false);
      setIsExiting(false);
      setDisplayProgress(0);
    }
  }, [open]);

  // Success detection
  useEffect(() => {
    if (displayProgress >= 99.5 && open && !isSuccess) {
      setIsSuccess(true);
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(() => {
          setVisible(false);
          setIsExiting(false);
          setIsSuccess(false);
          onComplete?.();
        }, 400);
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [displayProgress, open, isSuccess, onComplete]);

  // Resolve current stage
  const currentStage = [...stages].reverse().find((s) => displayProgress >= s.threshold) ?? stages[0];
  const dashOffset = CIRCUMFERENCE - (CIRCUMFERENCE * Math.min(displayProgress, 100)) / 100;

  if (!visible) return null;

  const modalClass = [
    "pm-progress-modal",
    isSuccess ? "pm-success" : "",
    isExiting ? "pm-exiting" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className="pm-progress-backdrop">
      <div className={modalClass}>
        {/* Ring */}
        <div className="pm-progress-ring-wrap">
          <div className="pm-progress-ring-glow" />
          <svg className="pm-progress-ring" viewBox="0 0 140 140">
            <defs>
              <linearGradient id="pm-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#02AFFE" />
                <stop offset="100%" stopColor="#05E2FF" />
              </linearGradient>
            </defs>
            <circle className="pm-progress-ring-bg" cx="70" cy="70" r={RADIUS} />
            <circle
              className="pm-progress-ring-fill"
              cx="70"
              cy="70"
              r={RADIUS}
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
            />
          </svg>

          {/* Value inside ring */}
          <div className="pm-progress-value">
            {isSuccess ? (
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <path
                  d="M14 24L22 32L34 16"
                  stroke="#22c55e"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    strokeDasharray: 36,
                    strokeDashoffset: 0,
                    animation: "pm-check-draw 500ms var(--pm-ease-out) forwards",
                  }}
                />
              </svg>
            ) : (
              <>
                {Math.round(displayProgress)}
                <span>%</span>
              </>
            )}
          </div>
        </div>

        {/* Stage text */}
        <div className="pm-progress-stage">
          {isSuccess ? successMessage : currentStage.label}
        </div>
        {!isSuccess && currentStage.hint && (
          <div className="pm-progress-hint">{currentStage.hint}</div>
        )}
      </div>
    </div>
  );
}

export type { AIProgressModalProps, ProgressStage };
