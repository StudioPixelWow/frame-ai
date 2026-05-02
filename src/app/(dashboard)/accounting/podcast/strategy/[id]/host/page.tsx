'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePodcastStrategies } from '@/lib/api/use-entity';
import { useToast } from '@/components/ui/toast';
import type { PodcastQuestion } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

function HostModeContent() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.id as string;
  const toast = useToast();

  const { data: strategies, update: updateStrategy } = usePodcastStrategies();

  // Find strategy by sessionId
  const strategy = useMemo(() => {
    return strategies?.find((s) => s.sessionId === sessionId);
  }, [strategies, sessionId]);

  // State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [localQuestions, setLocalQuestions] = useState<PodcastQuestion[]>([]);
  const [showAddInput, setShowAddInput] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Initialize questions from strategy
  useEffect(() => {
    if (strategy) {
      const selectedQuestions = (strategy.questions || [])
        .filter((q) => q.selected === true)
        .sort((a, b) => a.order - b.order);
      setLocalQuestions(selectedQuestions);
    }
  }, [strategy]);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentQuestion = localQuestions[currentIndex];
  const previousQuestion = currentIndex > 0 ? localQuestions[currentIndex - 1] : null;
  const nextQuestion = currentIndex < localQuestions.length - 1 ? localQuestions[currentIndex + 1] : null;

  const handleMarkDone = async () => {
    if (!currentQuestion || !strategy) return;

    const updatedQuestions = localQuestions.map((q) =>
      q.id === currentQuestion.id ? { ...q, status: 'done' as const } : q
    );

    setLocalQuestions(updatedQuestions);

    // Persist to database
    const strategyQuestions = strategy.questions || [];
    const persistedQuestions = strategyQuestions.map((q) => {
      const updated = updatedQuestions.find((uq) => uq.id === q.id);
      return updated || q;
    });

    try {
      await updateStrategy(strategy.id, { questions: persistedQuestions });
      toast('שאלה סומנה כמסיימת', 'success');
    } catch (error) {
      toast('שגיאה בשמירה', 'error');
    }

    // Advance to next
    if (currentIndex < localQuestions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleSkip = async () => {
    if (!currentQuestion || !strategy) return;

    const updatedQuestions = localQuestions.map((q) =>
      q.id === currentQuestion.id ? { ...q, status: 'skipped' as const } : q
    );

    setLocalQuestions(updatedQuestions);

    // Persist to database
    const strategyQuestions = strategy.questions || [];
    const persistedQuestions = strategyQuestions.map((q) => {
      const updated = updatedQuestions.find((uq) => uq.id === q.id);
      return updated || q;
    });

    try {
      await updateStrategy(strategy.id, { questions: persistedQuestions });
      toast('שאלה סומנה כדלוגה', 'success');
    } catch (error) {
      toast('שגיאה בשמירה', 'error');
    }

    // Advance to next
    if (currentIndex < localQuestions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleAddQuestion = async () => {
    if (!newQuestionText.trim() || !strategy) return;

    const newQuestion: PodcastQuestion = {
      id: `manual_${Date.now()}`,
      text: newQuestionText,
      type: 'hook',
      score: 50,
      labels: [],
      selected: true,
      order: localQuestions.length,
      status: 'pending',
    };

    const updatedLocalQuestions = [...localQuestions, newQuestion];
    setLocalQuestions(updatedLocalQuestions);
    setNewQuestionText('');
    setShowAddInput(false);

    // Persist to database
    const strategyQuestions = strategy.questions || [];
    const persistedQuestions = [...strategyQuestions, newQuestion];

    try {
      await updateStrategy(strategy.id, { questions: persistedQuestions });
      toast('שאלה נוספה בהצלחה', 'success');
    } catch (error) {
      toast('שגיאה בהוספת השאלה', 'error');
    }
  };

  const handleEndRecording = () => {
    router.push(`/accounting/podcast/strategy/${sessionId}`);
  };

  if (!strategy) {
    return (
      <div
        style={{
          background: '#0a0a0a',
          color: '#ffffff',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.1rem',
        }}
      >
        טוען אסטרטגיה...
      </div>
    );
  }

  if (localQuestions.length === 0) {
    return (
      <div
        style={{
          background: '#0a0a0a',
          color: '#ffffff',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '1rem',
          textAlign: 'center',
          padding: '2rem',
        }}
      >
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎙️</div>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>לא נבחרו שאלות</h1>
        <p style={{ margin: '0.5rem 0 0 0', color: '#999', fontSize: '1rem' }}>
          אנא חזור לאסטרטגיה ובחר שאלות לאורח המצטיין שלך
        </p>
        <button
          onClick={() => router.push(`/accounting/podcast/strategy/${sessionId}`)}
          style={{
            marginTop: '2rem',
            padding: '0.75rem 1.5rem',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          🔙 חזור לאסטרטגיה
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        background: '#0a0a0a',
        color: '#ffffff',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        direction: 'rtl',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '1.5rem 2rem',
          borderBottom: '1px solid #222',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#111',
        }}
      >
        <div>
          <div style={{ fontSize: '0.9rem', color: '#999' }}>
            {strategy.clientName} • {strategy.episodeType}
          </div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>🎙️ מצב הקלטה</h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', color: '#999', marginBottom: '0.5rem' }}>זמן שחלף</div>
            <div style={{ fontSize: '2rem', fontFamily: 'monospace', fontWeight: 700 }}>
              {formatTime(elapsedSeconds)}
            </div>
          </div>

          <button
            onClick={handleEndRecording}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontWeight: 600,
              fontSize: '0.95rem',
              cursor: 'pointer',
              transition: 'background 150ms',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#dc2626')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#ef4444')}
          >
            סיים הקלטה
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '3rem 2rem',
          overflow: 'auto',
        }}
      >
        {/* Previous Question (Faded) */}
        {previousQuestion && (
          <div
            style={{
              width: '100%',
              maxWidth: '800px',
              marginBottom: '3rem',
              padding: '1.5rem',
              backgroundColor: '#1a1a1a',
              borderRadius: '0.75rem',
              border: '1px solid #333',
              opacity: 0.4,
              transform: 'translateY(-50px)',
            }}
          >
            <div style={{ fontSize: '0.85rem', color: '#999', marginBottom: '0.75rem' }}>
              ✓ השאלה הקודמת
            </div>
            <p style={{ fontSize: '1rem', margin: 0, lineHeight: 1.6, color: '#ccc' }}>
              {previousQuestion.text}
            </p>
          </div>
        )}

        {/* Current Question (Prominent) */}
        {currentQuestion && (
          <div
            style={{
              width: '100%',
              maxWidth: '900px',
              padding: '3rem',
              backgroundColor: '#1a1a1a',
              borderRadius: '1rem',
              border: '2px solid #333',
              marginBottom: '3rem',
              animation: 'slideIn 500ms ease-out',
            }}
          >
            <div style={{ fontSize: '0.9rem', color: '#999', marginBottom: '1rem', fontWeight: 600 }}>
              שאלה {currentIndex + 1} מתוך {localQuestions.length}
            </div>
            <h2
              style={{
                fontSize: '2.5rem',
                margin: 0,
                lineHeight: 1.4,
                fontWeight: 700,
                color: '#ffffff',
              }}
            >
              {currentQuestion.text}
            </h2>
            {currentQuestion.labels && currentQuestion.labels.length > 0 && (
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {currentQuestion.labels.map((label) => (
                  <span
                    key={label}
                    style={{
                      fontSize: '0.8rem',
                      padding: '0.4rem 0.75rem',
                      backgroundColor: '#333',
                      color: '#aaa',
                      borderRadius: '0.25rem',
                      textTransform: 'capitalize',
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Next Question (Faded) */}
        {nextQuestion && (
          <div
            style={{
              width: '100%',
              maxWidth: '800px',
              marginBottom: '3rem',
              padding: '1.5rem',
              backgroundColor: '#1a1a1a',
              borderRadius: '0.75rem',
              border: '1px solid #333',
              opacity: 0.4,
              transform: 'translateY(50px)',
            }}
          >
            <div style={{ fontSize: '0.85rem', color: '#999', marginBottom: '0.75rem' }}>
              ▼ השאלה הבאה
            </div>
            <p style={{ fontSize: '1rem', margin: 0, lineHeight: 1.6, color: '#ccc' }}>
              {nextQuestion.text}
            </p>
          </div>
        )}
      </div>

      {/* Controls Bottom Bar */}
      <div
        style={{
          padding: '2rem',
          borderTop: '1px solid #222',
          background: '#111',
          display: 'flex',
          justifyContent: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={handleMarkDone}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#22c55e',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: 'pointer',
            transition: 'background 150ms',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#16a34a')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#22c55e')}
        >
          ✓ סיימתי
        </button>

        <button
          onClick={handleSkip}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#f59e0b',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: 'pointer',
            transition: 'background 150ms',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#d97706')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#f59e0b')}
        >
          ⏭ דלג
        </button>

        <button
          onClick={() => setShowAddInput(true)}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: 'pointer',
            transition: 'background 150ms',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#2563eb')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#3b82f6')}
        >
          ✏️ הוסף שאלה
        </button>
      </div>

      {/* Add Question Modal */}
      {showAddInput && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '2rem',
          }}
        >
          <div
            style={{
              background: '#1a1a1a',
              borderRadius: '1rem',
              border: '1px solid #333',
              padding: '2rem',
              maxWidth: '500px',
              width: '100%',
            }}
          >
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: 700 }}>
              הוספת שאלה חדשה
            </h3>

            <textarea
              value={newQuestionText}
              onChange={(e) => setNewQuestionText(e.target.value)}
              placeholder="הזן את השאלה..."
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: '#0a0a0a',
                border: '1px solid #333',
                borderRadius: '0.5rem',
                color: '#ffffff',
                fontSize: '1rem',
                fontFamily: 'inherit',
                minHeight: '100px',
                resize: 'vertical',
                boxSizing: 'border-box',
                marginBottom: '1rem',
              }}
              autoFocus
            />

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowAddInput(false);
                  setNewQuestionText('');
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#333',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ביטול
              </button>

              <button
                onClick={handleAddQuestion}
                disabled={!newQuestionText.trim()}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: newQuestionText.trim() ? '#22c55e' : '#666',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontWeight: 600,
                  cursor: newQuestionText.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                הוסף
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress at bottom right */}
      <div
        style={{
          position: 'fixed',
          bottom: '2rem',
          left: '2rem',
          textAlign: 'center',
          background: '#1a1a1a',
          padding: '1rem',
          borderRadius: '0.75rem',
          border: '1px solid #333',
        }}
      >
        <div style={{ fontSize: '0.85rem', color: '#999', marginBottom: '0.5rem' }}>התקדמות</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
          {currentIndex + 1}/{localQuestions.length}
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

export default function HostModePage() {
  return <HostModeContent />;
}
