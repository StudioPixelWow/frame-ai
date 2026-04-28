'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import type { PodcastStrategy } from '@/lib/db/schema';

interface PodcastStrategySectionProps {
  sessionId: string;
}

export default function PodcastStrategySection({ sessionId }: PodcastStrategySectionProps) {
  const [strategy, setStrategy] = useState<PodcastStrategy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState({
    structure: true,
    questions: true,
    clips: true,
  });

  // Fetch strategy by sessionId directly
  const fetchStrategy = useCallback(async () => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    console.log('[PodcastStrategySection] Fetching strategy for sessionId:', sessionId);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/data/podcast-strategies?sessionId=${encodeURIComponent(sessionId)}`, {
        cache: 'no-store',
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      console.log('[PodcastStrategySection] Fetch result:', data ? `found id=${data.id}` : 'null (no strategy)');

      if (data && data.id) {
        setStrategy(data as PodcastStrategy);
      } else {
        setStrategy(null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[PodcastStrategySection] Fetch error:', msg);
      setError(msg);
      setStrategy(null);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchStrategy();
  }, [fetchStrategy]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div
        style={{
          padding: '2rem',
          backgroundColor: '#f8f8f8',
          borderRadius: '0.75rem',
          border: '1px solid #e0e0e0',
          textAlign: 'center',
          direction: 'rtl',
        }}
      >
        <div style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem', color: '#333' }}>
          🎙️ טוען אסטרטגיית פרק...
        </div>
        <div
          style={{
            width: '2rem',
            height: '2rem',
            border: '3px solid #e0e0e0',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '1rem auto 0',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <div
        style={{
          padding: '2rem',
          backgroundColor: '#fef2f2',
          borderRadius: '0.75rem',
          border: '1px solid #fecaca',
          textAlign: 'center',
          direction: 'rtl',
        }}
      >
        <div style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem', color: '#991b1b' }}>
          ❌ לא ניתן לטעון את אסטרטגיית הפרק
        </div>
        <p style={{ margin: 0, color: '#b91c1c', fontSize: '0.85rem' }}>{error}</p>
        <button
          onClick={fetchStrategy}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1.25rem',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          🔄 נסה שוב
        </button>
      </div>
    );
  }

  // ── No strategy exists — show CTA ──
  if (!strategy) {
    console.log('[PodcastStrategySection] No strategy found for sessionId:', sessionId, '→ showing create CTA');
    return (
      <div
        style={{
          padding: '2rem',
          backgroundColor: '#f8f8f8',
          borderRadius: '0.75rem',
          border: '1px solid #e0e0e0',
          textAlign: 'center',
          direction: 'rtl',
        }}
      >
        <div style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem', color: '#333' }}>
          🎙️ אסטרטגיית פודקאסט
        </div>
        <p style={{ margin: 0, color: '#666', fontSize: '0.95rem' }}>
          עדיין לא נוצרה אסטרטגיה לפרק הזה
        </p>
        <Link
          href={`/accounting/podcast/strategy/${sessionId}`}
          style={{
            display: 'inline-block',
            marginTop: '1rem',
            padding: '0.75rem 1.5rem',
            backgroundColor: '#3b82f6',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '0.5rem',
            fontWeight: 600,
            fontSize: '0.95rem',
            transition: 'background 150ms',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#2563eb')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#3b82f6')}
        >
          צור אסטרטגיית פרק
        </Link>
      </div>
    );
  }

  // ── Strategy exists — render it ──
  console.log('[PodcastStrategySection] Rendering saved strategy id:', strategy.id, 'for sessionId:', sessionId);

  const selectedQuestions = (strategy.questions || []).filter((q) => q.selected === true);
  const sortedQuestions = [...selectedQuestions].sort((a, b) => a.order - b.order);

  const QUESTION_TYPE_DISPLAY: Record<string, { emoji: string; label: string; color: string }> = {
    hook: { emoji: '🪝', label: 'Hook', color: '#a855f7' },
    story: { emoji: '📖', label: 'סיפור', color: '#3b82f6' },
    authority: { emoji: '👑', label: 'סמכות', color: '#fbbf24' },
    objection: { emoji: '🛡️', label: 'התנגדות', color: '#ef4444' },
    cta: { emoji: '🎯', label: 'קריאה לפעולה', color: '#22c55e' },
  };

  const PLATFORM_DISPLAY: Record<string, { emoji: string; label: string }> = {
    reels: { emoji: '📱', label: 'Reels' },
    tiktok: { emoji: '🎵', label: 'TikTok' },
    youtube_shorts: { emoji: '▶️', label: 'YouTube Shorts' },
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        direction: 'rtl',
      }}
    >
      {/* Strategy Overview */}
      <div
        style={{
          padding: '1.25rem',
          backgroundColor: '#f0f9ff',
          borderRadius: '0.75rem',
          border: '1px solid #bae6fd',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0c4a6e' }}>
            🎙️ אסטרטגיית פרק
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                padding: '0.2rem 0.5rem',
                borderRadius: '999px',
                backgroundColor: strategy.status === 'ready' ? '#dcfce7' : '#fef3c7',
                color: strategy.status === 'ready' ? '#166534' : '#92400e',
              }}
            >
              {strategy.status === 'ready' ? '✅ מוכן' : strategy.status === 'draft' ? '📝 טיוטה' : strategy.status}
            </span>
            {strategy.createdAt && (
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                {new Date(strategy.createdAt).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
          {strategy.episodeType && (
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.2rem' }}>סוג פרק</div>
              <div style={{ fontSize: '0.85rem', color: '#1f2937', fontWeight: 600 }}>
                {strategy.episodeType === 'deep_interview' ? '🎤 ראיון עומק' :
                 strategy.episodeType === 'sales' ? '💰 פרק מכירתי' :
                 strategy.episodeType === 'educational' ? '📚 פרק חינוכי' :
                 strategy.episodeType === 'viral_short' ? '🔥 פרק ויראלי קצר' :
                 strategy.episodeType === 'authority' ? '👑 פרק סמכות' : strategy.episodeType}
              </div>
            </div>
          )}
          {strategy.goals && strategy.goals.length > 0 && (
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.2rem' }}>יעדים</div>
              <div style={{ fontSize: '0.85rem', color: '#1f2937' }}>
                {strategy.goals.length} יעדים
              </div>
            </div>
          )}
          {sortedQuestions.length > 0 && (
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.2rem' }}>שאלות נבחרות</div>
              <div style={{ fontSize: '0.85rem', color: '#1f2937' }}>
                {sortedQuestions.length} שאלות
              </div>
            </div>
          )}
          {(strategy.clipIdeas || []).length > 0 && (
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.2rem' }}>רעיונות קליפים</div>
              <div style={{ fontSize: '0.85rem', color: '#1f2937' }}>
                {strategy.clipIdeas.length} קליפים
              </div>
            </div>
          )}
        </div>
        {(strategy as any).strategySummary && (
          <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #bae6fd' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.25rem' }}>תקציר אסטרטגיה</div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#1f2937', lineHeight: 1.5 }}>
              {(strategy as any).strategySummary}
            </p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div
        style={{
          display: 'flex',
          gap: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        <Link
          href={`/accounting/podcast/strategy/${strategy.sessionId}/host`}
          style={{
            flex: '1',
            minWidth: '150px',
            padding: '0.75rem 1.25rem',
            backgroundColor: '#22c55e',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '0.5rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            textAlign: 'center',
            transition: 'background 150ms',
            border: 'none',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#16a34a')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#22c55e')}
        >
          🎙️ מצב מנחה
        </Link>

        <Link
          href={`/accounting/podcast/strategy/${strategy.sessionId}`}
          style={{
            flex: '1',
            minWidth: '150px',
            padding: '0.75rem 1.25rem',
            backgroundColor: '#3b82f6',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '0.5rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            textAlign: 'center',
            transition: 'background 150ms',
            border: 'none',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#2563eb')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#3b82f6')}
        >
          ✏️ ערוך אסטרטגיה
        </Link>

        <button
          style={{
            flex: '1',
            minWidth: '150px',
            padding: '0.75rem 1.25rem',
            backgroundColor: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'not-allowed',
            opacity: 0.6,
          }}
        >
          📥 הורד PDF
        </button>
      </div>

      {/* Section 1: Episode Structure */}
      <CollapsibleSection
        title="אסטרטגיית פרק"
        emoji="🎬"
        isExpanded={expandedSections.structure}
        onToggle={() => toggleSection('structure')}
      >
        {strategy.episodeStructure ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Opening Hook */}
            <div
              style={{
                padding: '1rem',
                backgroundColor: '#a855f7',
                color: 'white',
                borderRadius: '0.5rem',
              }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem', opacity: 0.9 }}>
                🎯 פתיחה תופסת
              </div>
              <p style={{ margin: 0, lineHeight: 1.5, fontSize: '0.95rem' }}>
                {strategy.episodeStructure.openingHook}
              </p>
            </div>

            {/* Segments */}
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem', color: '#333' }}>
                סגמנטים
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {(strategy.episodeStructure.segments || []).map((segment, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '0.75rem',
                      backgroundColor: '#f3f4f6',
                      borderRadius: '0.5rem',
                      border: '1px solid #e5e7eb',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'start',
                        marginBottom: '0.25rem',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: '#1f2937', fontSize: '0.9rem' }}>
                        {i + 1}. {segment.title}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        {segment.durationMinutes} דקות
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#6b7280', lineHeight: 1.4 }}>
                      {segment.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Closing CTA */}
            <div
              style={{
                padding: '1rem',
                backgroundColor: '#e0f2fe',
                borderRadius: '0.5rem',
                border: '1px solid #bae6fd',
              }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem', color: '#0369a1' }}>
                ⏹️ קריאה לפעולה בסיום
              </div>
              <p style={{ margin: 0, color: '#0c4a6e', lineHeight: 1.5, fontSize: '0.9rem' }}>
                {strategy.episodeStructure.closingCTA}
              </p>
            </div>
          </div>
        ) : (
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>
            לא נוצרה אסטרטגיה פרק עדיין. יצור אחת בעורך.
          </p>
        )}
      </CollapsibleSection>

      {/* Section 2: Selected Questions */}
      <CollapsibleSection
        title="שאלות נבחרות"
        emoji="❓"
        count={sortedQuestions.length}
        isExpanded={expandedSections.questions}
        onToggle={() => toggleSection('questions')}
      >
        {sortedQuestions.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {sortedQuestions.map((question, index) => {
              const typeInfo =
                QUESTION_TYPE_DISPLAY[question.type] || {
                  emoji: '❓',
                  label: question.type,
                  color: '#6b7280',
                };
              return (
                <div
                  key={question.id}
                  style={{
                    padding: '0.75rem',
                    backgroundColor: '#f9fafb',
                    borderRadius: '0.5rem',
                    border: '1px solid #e5e7eb',
                  }}
                >
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '2rem',
                        height: '2rem',
                        backgroundColor: typeInfo.color,
                        color: 'white',
                        borderRadius: '0.5rem',
                        flexShrink: 0,
                        fontSize: '1rem',
                        fontWeight: 600,
                      }}
                    >
                      {index + 1}
                    </div>

                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: '0.95rem', color: '#1f2937', lineHeight: 1.5 }}>
                        {question.text}
                      </p>

                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            padding: '0.25rem 0.5rem',
                            borderRadius: '0.25rem',
                            backgroundColor: typeInfo.color,
                            color: 'white',
                          }}
                        >
                          {typeInfo.emoji} {typeInfo.label}
                        </span>

                        {/* Score Bar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: '120px' }}>
                          <div
                            style={{
                              flex: 1,
                              height: '3px',
                              backgroundColor: '#e5e7eb',
                              borderRadius: '2px',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                height: '100%',
                                width: `${question.score}%`,
                                backgroundColor: typeInfo.color,
                              }}
                            />
                          </div>
                          <span style={{ fontSize: '0.75rem', color: '#6b7280', minWidth: '25px' }}>
                            {question.score}
                          </span>
                        </div>

                        {/* Labels */}
                        {(question.labels || []).length > 0 && (
                          <div style={{ display: 'flex', gap: '0.3rem' }}>
                            {question.labels.map((label) => (
                              <span
                                key={label}
                                style={{
                                  fontSize: '0.65rem',
                                  padding: '0.15rem 0.4rem',
                                  borderRadius: '0.2rem',
                                  backgroundColor: '#f0f0f0',
                                  color: '#666',
                                  fontWeight: 500,
                                }}
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>
            לא נבחרו שאלות עדיין. בחר שאלות בעורך.
          </p>
        )}
      </CollapsibleSection>

      {/* Section 3: Clip Ideas */}
      <CollapsibleSection
        title="רעיונות לקליפים"
        emoji="🎥"
        count={(strategy.clipIdeas || []).length}
        isExpanded={expandedSections.clips}
        onToggle={() => toggleSection('clips')}
      >
        {(strategy.clipIdeas || []).length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {strategy.clipIdeas.map((clip, index) => {
              const relatedQuestion = strategy.questions?.find((q) => q.id === clip.questionId);
              return (
                <div
                  key={index}
                  style={{
                    padding: '1rem',
                    backgroundColor: '#f9fafb',
                    borderRadius: '0.5rem',
                    border: '1px solid #e5e7eb',
                  }}
                >
                  {/* Clip Title */}
                  <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 700, color: '#1f2937' }}>
                    {clip.clipTitle}
                  </h4>

                  {/* Hook Line */}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.25rem' }}>
                      🪝 שורת ווירוס
                    </div>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#1f2937', lineHeight: 1.4 }}>
                      "{clip.hookLine}"
                    </p>
                  </div>

                  {/* Caption Idea */}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.25rem' }}>
                      💬 אפשרות כיתוביון
                    </div>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#1f2937', lineHeight: 1.4 }}>
                      {clip.captionIdea}
                    </p>
                  </div>

                  {/* Platform Badges */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {(clip.platformFit || []).map((platform) => {
                      const platformInfo = PLATFORM_DISPLAY[platform] || { emoji: '📱', label: platform };
                      return (
                        <span
                          key={platform}
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '0.35rem 0.65rem',
                            borderRadius: '0.25rem',
                            backgroundColor: '#dbeafe',
                            color: '#0369a1',
                          }}
                        >
                          {platformInfo.emoji} {platformInfo.label}
                        </span>
                      );
                    })}
                  </div>

                  {/* Related Question */}
                  {relatedQuestion && (
                    <div
                      style={{
                        marginTop: '0.75rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px solid #e5e7eb',
                        fontSize: '0.8rem',
                        color: '#6b7280',
                      }}
                    >
                      <strong>שאלה הקשורה:</strong> {relatedQuestion.text}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>
            לא נוצרו רעיונות לקליפים עדיין. יצור אותם בעורך.
          </p>
        )}
      </CollapsibleSection>
    </div>
  );
}

interface CollapsibleSectionProps {
  title: string;
  emoji: string;
  count?: number;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  emoji,
  count,
  isExpanded,
  onToggle,
  children,
}: CollapsibleSectionProps) {
  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '0.75rem',
        border: '1px solid #e0e0e0',
        overflow: 'hidden',
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '1rem',
          backgroundColor: '#f8f8f8',
          border: 'none',
          borderBottom: isExpanded ? '1px solid #e0e0e0' : 'none',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          transition: 'background 150ms',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f0f0')}
        onMouseLeave={(e) => (e.currentTarget.style.background = '#f8f8f8')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.25rem' }}>{emoji}</span>
          <span style={{ fontWeight: 600, color: '#1f2937' }}>{title}</span>
          {count !== undefined && (
            <span
              style={{
                fontSize: '0.8rem',
                backgroundColor: '#e5e7eb',
                color: '#374151',
                padding: '0.25rem 0.5rem',
                borderRadius: '0.25rem',
                fontWeight: 600,
              }}
            >
              {count}
            </span>
          )}
        </div>
        <span
          style={{
            fontSize: '1.25rem',
            transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 200ms',
          }}
        >
          ▼
        </span>
      </button>

      {isExpanded && <div style={{ padding: '1.5rem' }}>{children}</div>}
    </div>
  );
}
