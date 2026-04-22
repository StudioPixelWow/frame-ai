'use client';

import { useState, useCallback } from 'react';

type State = 'idle' | 'thinking' | 'result' | 'error';

interface AIActionButtonProps {
  label: string;
  icon?: string;
  onAction: () => Promise<string>;
  onApply?: (result: string) => void;
  variant?: 'inline' | 'block';
  disabled?: boolean;
}

interface AIActionGroupProps {
  actions: Array<{
    label: string;
    icon?: string;
    onAction: () => Promise<string>;
    onApply?: (result: string) => void;
  }>;
  layout?: 'row' | 'grid';
}

const AnimationStyles = () => (
  <style>{`
    @keyframes dotPulse {
      0%, 20% {
        opacity: 0.4;
        transform: scale(0.8);
      }
      50% {
        opacity: 1;
        transform: scale(1);
      }
      100% {
        opacity: 0.4;
        transform: scale(0.8);
      }
    }

    @keyframes progressPulse {
      0% {
        width: 0%;
        opacity: 1;
      }
      70% {
        width: 100%;
        opacity: 1;
      }
      100% {
        width: 100%;
        opacity: 0;
      }
    }

    @keyframes fadeInLineStagger {
      0% {
        opacity: 0;
        transform: translateY(8px);
      }
      100% {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes cardSlideIn {
      0% {
        opacity: 0;
        transform: translateY(-8px);
      }
      100% {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes accentPulse {
      0%, 100% {
        background: linear-gradient(135deg, rgba(var(--accent-rgb, 59, 130, 246), 0.08), rgba(var(--accent-rgb, 59, 130, 246), 0.04));
      }
      50% {
        background: linear-gradient(135deg, rgba(var(--accent-rgb, 59, 130, 246), 0.12), rgba(var(--accent-rgb, 59, 130, 246), 0.08));
      }
    }

    .ai-action-thinking {
      animation: accentPulse 2s ease-in-out infinite;
    }

    .ai-dot {
      display: inline-block;
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background-color: currentColor;
      animation: dotPulse 1.4s infinite;
    }

    .ai-dot:nth-child(2) {
      animation-delay: 0.2s;
    }

    .ai-dot:nth-child(3) {
      animation-delay: 0.4s;
    }

    .ai-progress-line {
      position: absolute;
      bottom: 0;
      right: 0;
      height: 2px;
      background-color: var(--accent, #3b82f6);
      border-radius: 1px;
      animation: progressPulse 3s ease-out forwards;
    }

    .ai-result-text {
      animation: fadeInLineStagger 0.6s ease-out both;
    }

    .ai-result-text:nth-child(1) {
      animation-delay: 0.1s;
    }

    .ai-result-text:nth-child(2) {
      animation-delay: 0.2s;
    }

    .ai-result-text:nth-child(3) {
      animation-delay: 0.3s;
    }

    .ai-result-card {
      animation: cardSlideIn 0.4s ease-out;
    }
  `}</style>
);

export function AIActionButton({
  label,
  icon = '✨',
  onAction,
  onApply,
  variant = 'inline',
  disabled = false,
}: AIActionButtonProps) {
  const [state, setState] = useState<State>('idle');
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleAction = useCallback(async () => {
    setState('thinking');
    setError('');
    try {
      const resultText = await onAction();
      setResult(resultText);
      setState('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בלתי צפויה');
      setState('error');
    }
  }, [onAction]);

  const handleApply = useCallback(() => {
    if (onApply) {
      onApply(result);
    }
    setState('idle');
    setResult('');
  }, [result, onApply]);

  const handleRetry = useCallback(() => {
    handleAction();
  }, [handleAction]);

  const handleClose = useCallback(() => {
    setState('idle');
    setResult('');
    setError('');
  }, []);

  const isLoading = state === 'thinking';
  const isShowingResult = state === 'result';
  const isShowingError = state === 'error';

  if (variant === 'inline') {
    return (
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <AnimationStyles />
        <button
          onClick={handleAction}
          disabled={disabled || isLoading}
          className={isLoading ? 'ai-action-thinking' : ''}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.75rem',
            padding: '0.35rem 0.75rem',
            backgroundColor: 'var(--accent-muted, rgba(59, 130, 246, 0.1))',
            border: `1px solid ${isLoading ? 'var(--accent-border, rgba(59, 130, 246, 0.3))' : 'var(--accent-border, rgba(59, 130, 246, 0.2))'}`,
            borderRadius: '0.5rem',
            cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            color: 'var(--accent-text, #1e3a8a)',
            transition: 'all 200ms ease',
            opacity: disabled ? 0.5 : 1,
            transform: isLoading ? 'scaleY(1.05)' : 'translateY(0)',
            position: 'relative',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            if (!disabled && !isLoading) {
              e.currentTarget.style.borderColor = 'var(--accent, #3b82f6)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }
          }}
          onMouseLeave={(e) => {
            if (!disabled && !isLoading) {
              e.currentTarget.style.borderColor = 'var(--accent-border, rgba(59, 130, 246, 0.2))';
              e.currentTarget.style.transform = 'translateY(0)';
            }
          }}
        >
          <span>{icon}</span>
          <span>
            {isLoading ? (
              <>
                חושב<span className="ai-dot" />
                <span className="ai-dot" />
                <span className="ai-dot" />
              </>
            ) : (
              label
            )}
          </span>
          {isLoading && <div className="ai-progress-line" />}
        </button>

        {(isShowingResult || isShowingError) && (
          <div
            className="ai-result-card"
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '0.5rem',
              minWidth: '280px',
              backgroundColor: 'var(--surface, #ffffff)',
              border: `1px solid var(--border, #e5e7eb)`,
              borderRadius: '0.75rem',
              padding: '1rem',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
              zIndex: 50,
              direction: 'rtl',
            }}
          >
            {isShowingError ? (
              <div
                style={{
                  color: 'var(--error, #dc2626)',
                  fontSize: '0.875rem',
                  marginBottom: '1rem',
                  lineHeight: 1.5,
                }}
              >
                {error}
              </div>
            ) : (
              <div
                style={{
                  marginBottom: '1rem',
                  fontSize: '0.875rem',
                  lineHeight: 1.6,
                  color: 'var(--text-secondary, #4b5563)',
                }}
              >
                {result.split('\n').map((line, idx) => (
                  <div
                    key={idx}
                    className="ai-result-text"
                    style={{
                      animationDelay: `${idx * 0.1}s`,
                    }}
                  >
                    {line}
                  </div>
                ))}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                justifyContent: 'flex-end',
              }}
            >
              <button
                onClick={handleClose}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.75rem',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border, #e5e7eb)',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  color: 'var(--text-secondary, #6b7280)',
                  fontFamily: 'inherit',
                  transition: 'all 200ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--surface-hover, #f9fafb)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                סגור
              </button>

              <button
                onClick={handleRetry}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.75rem',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border, #e5e7eb)',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  color: 'var(--text-secondary, #6b7280)',
                  fontFamily: 'inherit',
                  transition: 'all 200ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--surface-hover, #f9fafb)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                נסה שוב
              </button>

              {!isShowingError && onApply && (
                <button
                  onClick={handleApply}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.75rem',
                    backgroundColor: 'var(--accent, #3b82f6)',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    color: '#ffffff',
                    fontFamily: 'inherit',
                    fontWeight: 500,
                    transition: 'all 200ms ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--accent-dark, #2563eb)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--accent, #3b82f6)';
                  }}
                >
                  החל
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // variant === 'block'
  return (
    <div style={{ position: 'relative' }}>
      <AnimationStyles />
      <div
        className={isLoading ? 'ai-action-thinking' : ''}
        style={{
          width: '100%',
          padding: '1rem',
          backgroundColor: 'var(--surface-raised, #ffffff)',
          border: `1px solid ${isLoading ? 'var(--accent, #3b82f6)' : 'var(--border, #e5e7eb)'}`,
          borderRadius: '0.75rem',
          cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
          transition: 'all 200ms ease',
          opacity: disabled ? 0.5 : 1,
          position: 'relative',
          direction: 'rtl',
        }}
        onClick={!disabled && !isLoading ? handleAction : undefined}
        onMouseEnter={(e) => {
          if (!disabled && !isLoading) {
            e.currentTarget.style.borderColor = 'var(--accent, #3b82f6)';
            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(59, 130, 246, 0.1)';
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled && !isLoading) {
            e.currentTarget.style.borderColor = 'var(--border, #e5e7eb)';
            e.currentTarget.style.boxShadow = 'none';
          }
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <span style={{ fontSize: '1.5rem' }}>{icon}</span>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'var(--text-primary, #1f2937)',
                marginBottom: '0.25rem',
              }}
            >
              {isLoading ? (
                <>
                  חושב
                  <span className="ai-dot" style={{ marginRight: '0.25rem' }} />
                  <span className="ai-dot" style={{ marginRight: '0.25rem' }} />
                  <span className="ai-dot" />
                </>
              ) : (
                label
              )}
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-tertiary, #9ca3af)',
              }}
            >
              בעזרת AI
            </div>
          </div>
        </div>
        {isLoading && <div className="ai-progress-line" style={{ right: 0, bottom: 0 }} />}
      </div>

      {(isShowingResult || isShowingError) && (
        <div
          className="ai-result-card"
          style={{
            marginTop: '1rem',
            backgroundColor: 'var(--surface, #ffffff)',
            border: `1px solid var(--border, #e5e7eb)`,
            borderRadius: '0.75rem',
            padding: '1rem',
            direction: 'rtl',
          }}
        >
          {isShowingError ? (
            <div
              style={{
                color: 'var(--error, #dc2626)',
                fontSize: '0.875rem',
                marginBottom: '1rem',
                lineHeight: 1.5,
              }}
            >
              {error}
            </div>
          ) : (
            <div
              style={{
                marginBottom: '1rem',
                fontSize: '0.875rem',
                lineHeight: 1.6,
                color: 'var(--text-secondary, #4b5563)',
              }}
            >
              {result.split('\n').map((line, idx) => (
                <div
                  key={idx}
                  className="ai-result-text"
                  style={{
                    animationDelay: `${idx * 0.1}s`,
                  }}
                >
                  {line}
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.75rem',
            }}
          >
            <button
              onClick={handleClose}
              style={{
                padding: '0.5rem',
                fontSize: '0.75rem',
                backgroundColor: 'transparent',
                border: '1px solid var(--border, #e5e7eb)',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                color: 'var(--text-secondary, #6b7280)',
                fontFamily: 'inherit',
                transition: 'all 200ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--surface-hover, #f9fafb)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              סגור
            </button>

            <button
              onClick={handleRetry}
              style={{
                padding: '0.5rem',
                fontSize: '0.75rem',
                backgroundColor: 'transparent',
                border: '1px solid var(--border, #e5e7eb)',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                color: 'var(--text-secondary, #6b7280)',
                fontFamily: 'inherit',
                transition: 'all 200ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--surface-hover, #f9fafb)';
              }}
              onMouseLeave={(e) => {
                e.currentButton.style.backgroundColor = 'transparent';
              }}
            >
              נסה שוב
            </button>

            {!isShowingError && onApply && (
              <button
                onClick={handleApply}
                style={{
                  padding: '0.5rem',
                  fontSize: '0.75rem',
                  backgroundColor: 'var(--accent, #3b82f6)',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  color: '#ffffff',
                  fontFamily: 'inherit',
                  fontWeight: 500,
                  transition: 'all 200ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--accent-dark, #2563eb)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--accent, #3b82f6)';
                }}
              >
                החל
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function AIActionGroup({
  actions,
  layout = 'row',
}: AIActionGroupProps) {
  return (
    <div
      style={{
        display: layout === 'row' ? 'flex' : 'grid',
        gridTemplateColumns: layout === 'grid' ? 'repeat(2, 1fr)' : undefined,
        gap: layout === 'row' ? '0.5rem' : '1rem',
        flexWrap: 'wrap',
        direction: 'rtl',
      }}
    >
      {actions.map((action, idx) => (
        <AIActionButton
          key={idx}
          label={action.label}
          icon={action.icon}
          onAction={action.onAction}
          onApply={action.onApply}
          variant="inline"
        />
      ))}
    </div>
  );
}
