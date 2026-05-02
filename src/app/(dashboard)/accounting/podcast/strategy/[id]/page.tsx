'use client';

export const dynamic = 'force-dynamic';

import { useRouter, useParams } from 'next/navigation';
import { Suspense, useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePodcastSessions, usePodcastStrategies } from '@/lib/api/use-entity';
import { useToast } from '@/components/ui/toast';
import type {
  PodcastStrategy,
  PodcastEpisodeType,
  PodcastGoal,
  PodcastGuestPersona,
  PodcastQuestion,
  PodcastClipIdea,
  PodcastEpisodeStructure,
} from '@/lib/db/schema';

const EPISODE_TYPE_OPTIONS: Array<{
  type: PodcastEpisodeType;
  emoji: string;
  label: string;
  color: string;
}> = [
  { type: 'deep_interview', emoji: '🎤', label: 'ראיון עומק', color: '#ec4899' },
  { type: 'sales', emoji: '💰', label: 'פרק מכירתי', color: '#f59e0b' },
  { type: 'educational', emoji: '📚', label: 'פרק חינוכי', color: '#3b82f6' },
  { type: 'viral_short', emoji: '🔥', label: 'פרק ויראלי קצר', color: '#ef4444' },
  { type: 'authority', emoji: '👑', label: 'פרק סמכות', color: '#a855f7' },
];

const GOALS_OPTIONS: Array<{ value: PodcastGoal; label: string }> = [
  { value: 'personal_exposure', label: 'חשיפה אישית' },
  { value: 'trust_building', label: 'בניית אמון' },
  { value: 'professional_differentiation', label: 'בידול מקצועי' },
  { value: 'lead_generation', label: 'יצירת לידים' },
  { value: 'sales', label: 'מכירה' },
  { value: 'market_education', label: 'חינוך שוק' },
  { value: 'storytelling', label: 'סטוריטלינג' },
  { value: 'objection_handling', label: 'טיפול בהתנגדויות' },
];

const TONE_OPTIONS: Array<{ value: 'formal' | 'casual' | 'sharp'; label: string }> = [
  { value: 'formal', label: 'רשמי' },
  { value: 'casual', label: 'קז׳ואל' },
  { value: 'sharp', label: 'חד' },
];

const EXPERTISE_OPTIONS: Array<{
  value: 'beginner' | 'intermediate' | 'expert' | 'thought_leader';
  label: string;
}> = [
  { value: 'beginner', label: 'מתחיל' },
  { value: 'intermediate', label: 'בינוני' },
  { value: 'expert', label: 'מומחה' },
  { value: 'thought_leader', label: 'מנהיג דעה' },
];

const QUESTION_TYPE_COLORS: Record<string, string> = {
  hook: '#a855f7',
  story: '#3b82f6',
  authority: '#fbbf24',
  objection: '#ef4444',
  cta: '#22c55e',
};

const STEP_LABELS = [
  'סוג פרק',
  'יעדים',
  'פרופיל אורח',
  'אסטרטגיה',
  'שאלות',
  'בחירה וסדר',
  'קליפים',
];

function StrategyWizardContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = params.id as string;
  const mode = (searchParams?.get('mode') || 'full') as 'full' | 'questions';
  const toast = useToast();

  const { data: sessions } = usePodcastSessions();
  const { data: strategies, create: createStrategy, update: updateStrategy } = usePodcastStrategies();

  const session = useMemo(() => sessions?.find((s) => s.id === sessionId), [sessions, sessionId]);

  // State
  const [step, setStep] = useState(mode === 'questions' ? 5 : 1);
  const [episodeType, setEpisodeType] = useState<PodcastEpisodeType | null>(null);
  const [goals, setGoals] = useState<PodcastGoal[]>([]);
  const [persona, setPersona] = useState<PodcastGuestPersona>({
    tone: 'casual',
    expertiseLevel: 'expert',
    speakingStyle: '',
    industry: '',
    audience: '',
  });
  const [structure, setStructure] = useState<PodcastEpisodeStructure | null>(null);
  const [questions, setQuestions] = useState<PodcastQuestion[]>([]);
  const [clipIdeas, setClipIdeas] = useState<PodcastClipIdea[]>([]);
  const [useRealAI, setUseRealAI] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [strategyId, setStrategyId] = useState<string | null>(null);
  const loadedRef = useRef(false);

  // ── Load existing strategy from DB on mount ───────────���──────────
  useEffect(() => {
    if (loadedRef.current || !strategies || strategies.length === 0 || !sessionId) return;

    const existing = strategies.find((s) => s.sessionId === sessionId);
    if (existing) {
      console.log('[Strategy Wizard] Loading existing strategy from DB:', existing.id);
      loadedRef.current = true;
      setStrategyId(existing.id);
      if (existing.episodeType) setEpisodeType(existing.episodeType);
      if (existing.goals?.length) setGoals(existing.goals);
      if (existing.persona) setPersona(existing.persona);
      if (existing.episodeStructure) setStructure(existing.episodeStructure);
      if (existing.questions?.length) setQuestions(existing.questions);
      if (existing.clipIdeas?.length) setClipIdeas(existing.clipIdeas);
      if (existing.useRealAI !== undefined) setUseRealAI(existing.useRealAI);
    }
  }, [strategies, sessionId]);

  // Scroll to top on step change
  const handleNextStep = () => {
    if (step === 1 && !episodeType) {
      toast('אנא בחר סוג פרק', 'error');
      return;
    }
    if (step === 2 && goals.length === 0) {
      toast('אנא בחר לפחות יעד אחד', 'error');
      return;
    }
    if (step === 6 && questions.filter((q) => q.selected).length === 0) {
      toast('אנא בחר לפחות שאלה אחת', 'error');
      return;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    setStep(step + 1);
  };

  const handlePrevStep = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setStep(step - 1);
  };

  // Helper to call the server-side AI generation API
  const callGenerateAPI = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/podcast-strategy-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Generation failed');
    return json.data;
  };

  const handleGenerateStrategy = async () => {
    if (!episodeType || goals.length === 0) {
      toast('אנא השלם את שלבים 1 ו-2 קודם', 'error');
      return;
    }

    setIsGenerating(true);
    try {
      const generated = await callGenerateAPI({
        action: 'structure',
        episodeType,
        goals,
        persona,
        clientName: session?.clientName || 'הלקוח',
        useRealAI,
      });
      setStructure(generated);
      toast('אסטרטגיה נוצרה בהצלחה!', 'success');
    } catch (error) {
      toast('שגיאה בעת יצירת אסטרטגיה', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerateStrategy = async () => {
    setIsGenerating(true);
    try {
      const generated = await callGenerateAPI({
        action: 'structure',
        episodeType: episodeType!,
        goals,
        persona,
        clientName: session?.clientName || 'הלקוח',
        useRealAI,
      });
      setStructure(generated);
      toast('אסטרטגיה חדשה נוצרה!', 'success');
    } catch (error) {
      toast('שגיאה בעת יצירת אסטרטגיה', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateQuestions = async () => {
    if (!episodeType || !persona.industry) {
      toast('אנא השלם את השלבים הקודמים קודם', 'error');
      return;
    }

    setIsGenerating(true);
    try {
      const generated = await callGenerateAPI({
        action: 'questions',
        episodeType,
        goals,
        persona,
        clientName: session?.clientName || 'הלקוח',
        industry: persona.industry,
        useRealAI,
      });
      setQuestions(generated);
      toast('20 שאלות נוצרו בהצלחה!', 'success');
    } catch (error) {
      toast('שגיאה בעת יצירת שאלות', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerateQuestions = async () => {
    setIsGenerating(true);
    try {
      const generated = await callGenerateAPI({
        action: 'questions',
        episodeType: episodeType!,
        goals,
        persona,
        clientName: session?.clientName || 'הלקוח',
        industry: persona.industry,
        useRealAI,
      });
      setQuestions(generated);
      toast('20 שאלות חדשות נוצרו!', 'success');
    } catch (error) {
      toast('שגיאה בעת יצירת שאלות', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateClipIdeas = async () => {
    const selectedQuestions = questions.filter((q) => q.selected);
    if (selectedQuestions.length === 0) {
      toast('אנא בחר לפחות שאלה אחת', 'error');
      return;
    }

    setIsGenerating(true);
    try {
      const generated = await callGenerateAPI({
        action: 'clips',
        questions: selectedQuestions,
        clientName: session?.clientName || 'הלקוח',
        useRealAI,
      });
      setClipIdeas(generated);
      toast('רעיונות קליפים נוצרו בהצלחה!', 'success');
    } catch (error) {
      toast('שגיאה בעת יצירת קליפים', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!session) {
      toast('לא ניתן למצוא את הסשן', 'error');
      return;
    }

    const strategyData: Partial<PodcastStrategy> = {
      sessionId: session.id,
      clientId: session.clientId || '',
      clientName: session.clientName || '',
      episodeType: episodeType || 'deep_interview',
      goals,
      persona,
      episodeStructure: structure,
      questions,
      clipIdeas,
      status: 'draft',
      useRealAI,
      clientApproved: false,
      clientApprovedAt: null,
    };

    try {
      if (strategyId) {
        console.log('[Strategy Wizard] UPDATE draft id:', strategyId);
        const updated = await updateStrategy(strategyId, strategyData);
        console.log('[Strategy Wizard] UPDATE response:', updated?.id);
        toast('אסטרטגיה עודכנה!', 'success');
      } else {
        console.log('[Strategy Wizard] CREATE draft for session:', session.id);
        const created = await createStrategy(strategyData);
        console.log('[Strategy Wizard] CREATE response id:', created?.id);
        if (created?.id) {
          setStrategyId(created.id);
        } else {
          console.error('[Strategy Wizard] CREATE returned no id!', created);
          toast('אירעה שגיאה בשמירה — אין מזהה', 'error');
          return;
        }
        toast('אסטרטגיה שמורה כטיוטה!', 'success');
      }
    } catch (error) {
      console.error('[Strategy Wizard] Save draft error:', error);
      toast('אירעה שגיאה בשמירה', 'error');
    }
  };

  const handleSaveAndComplete = async () => {
    if (!session) {
      toast('לא ניתן למצוא את הסשן', 'error');
      return;
    }

    const strategyData: Partial<PodcastStrategy> = {
      sessionId: session.id,
      clientId: session.clientId || '',
      clientName: session.clientName || '',
      episodeType: episodeType || 'deep_interview',
      goals,
      persona,
      episodeStructure: structure,
      questions,
      clipIdeas,
      status: 'ready',
      useRealAI,
      clientApproved: false,
      clientApprovedAt: null,
    };

    try {
      if (strategyId) {
        console.log('[Strategy Wizard] UPDATE complete id:', strategyId);
        await updateStrategy(strategyId, strategyData);
      } else {
        console.log('[Strategy Wizard] CREATE complete for session:', session.id);
        const created = await createStrategy(strategyData);
        console.log('[Strategy Wizard] CREATE response id:', created?.id);
        if (created?.id) {
          setStrategyId(created.id);
        } else {
          console.error('[Strategy Wizard] CREATE returned no id!', created);
          toast('אירעה שגיאה בשמירה — אין מזהה', 'error');
          return;
        }
      }
      toast('אסטרטגיה שמורה בהצלחה!', 'success');
      router.push('/accounting/podcast');
    } catch (error) {
      console.error('[Strategy Wizard] Save complete error:', error);
      toast('אירעה שגיאה בשמירה', 'error');
    }
  };

  const toggleGoal = (goal: PodcastGoal) => {
    if (goals.includes(goal)) {
      setGoals(goals.filter((g) => g !== goal));
    } else {
      if (goals.length < 3) {
        setGoals([...goals, goal]);
      } else {
        toast('ניתן לבחור עד 3 יעדים בלבד', 'error');
      }
    }
  };

  const toggleQuestion = (questionId: string) => {
    setQuestions(
      questions.map((q) =>
        q.id === questionId ? { ...q, selected: !q.selected } : q
      )
    );
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    const newQuestions = [...questions];
    const newIndex = direction === 'up' ? index - 1 : index + 1;

    if (newIndex >= 0 && newIndex < newQuestions.length) {
      [newQuestions[index], newQuestions[newIndex]] = [
        newQuestions[newIndex],
        newQuestions[index],
      ];
      setQuestions(newQuestions);
    }
  };

  const selectedQuestionCount = questions.filter((q) => q.selected).length;

  // Determine which step to show
  const effectiveStep = mode === 'questions' ? step : step;

  const renderStepIndicator = () => {
    const stepLabels =
      mode === 'questions'
        ? ['שאלות', 'בחירה וסדר', 'קליפים']
        : STEP_LABELS;

    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: '3rem',
          gap: '0.75rem',
        }}
      >
        {stepLabels.map((label, i) => {
          const displayStep = mode === 'questions' ? i + 5 : i + 1;
          const isActive = displayStep === step;
          const isCompleted = displayStep < step;

          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '2.5rem',
                  height: '2.5rem',
                  borderRadius: '50%',
                  backgroundColor: isActive
                    ? 'var(--accent)'
                    : isCompleted
                      ? 'var(--accent)'
                      : 'var(--surface)',
                  border: `2px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isActive || isCompleted ? 'white' : 'var(--foreground)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.875rem',
                }}
              >
                {isCompleted ? '✓' : displayStep}
              </div>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: isActive ? 'var(--accent)' : 'var(--foreground-muted)',
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {label}
              </span>
              {i < stepLabels.length - 1 && (
                <div
                  style={{
                    width: '2rem',
                    height: '2px',
                    backgroundColor: isCompleted ? 'var(--accent)' : 'var(--border)',
                    margin: '0 0.5rem',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      style={{
        direction: 'rtl',
        minHeight: '100vh',
        backgroundColor: 'var(--background)',
        padding: '2rem',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '2rem' }}>🎙️</div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
            {mode === 'questions' ? 'בחירת שאלות' : 'אסטרטגיית פודקאסט'}
          </h1>
        </div>
        {session && (
          <p style={{ margin: '0.5rem 0 0 0', color: 'var(--foreground-muted)', fontSize: '0.9rem' }}>
            {session.clientName} • {new Date(session.sessionDate).toLocaleDateString('he-IL')}
          </p>
        )}
      </div>

      {/* Step Indicator */}
      {renderStepIndicator()}

      {/* Content Area */}
      <div
        style={{
          maxWidth: '900px',
          margin: '0 auto',
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          border: '1px solid var(--border)',
          padding: '2rem',
          minHeight: '500px',
        }}
      >
        {/* Step 1: Episode Type Selection */}
        {step === 1 && mode === 'full' && (
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', color: 'var(--foreground)' }}>
              בחר סוג פרק
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '1rem',
              }}
            >
              {EPISODE_TYPE_OPTIONS.map((option) => (
                <div
                  key={option.type}
                  onClick={() => setEpisodeType(option.type)}
                  style={{
                    padding: '1.5rem',
                    borderRadius: '0.75rem',
                    border: `2px solid ${episodeType === option.type ? option.color : 'var(--border)'}`,
                    borderLeftWidth: '5px',
                    backgroundColor: episodeType === option.type ? `${option.color}10` : 'white',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{option.emoji}</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--foreground)' }}>
                    {option.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Goals Selection */}
        {step === 2 && mode === 'full' && (
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', color: 'var(--foreground)' }}>
              בחר יעדים (עד 3)
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              {GOALS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => toggleGoal(option.value)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '2rem',
                    border: goals.includes(option.value) ? '2px solid var(--accent)' : '1px solid var(--border)',
                    backgroundColor: goals.includes(option.value) ? 'var(--accent)' : 'white',
                    color: goals.includes(option.value) ? 'white' : 'var(--foreground)',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: 500,
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p style={{ marginTop: '1rem', color: 'var(--foreground-muted)', fontSize: '0.85rem' }}>
              {goals.length} / 3 יעדים נבחרו
            </p>
          </div>
        )}

        {/* Step 3: Guest Persona */}
        {step === 3 && mode === 'full' && (
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', color: 'var(--foreground)' }}>
              פרופיל האורח
            </h2>

            {/* Tone */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '0.5rem', display: 'block' }}>
                טון
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {TONE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setPersona({ ...persona, tone: option.value })}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '0.5rem',
                      border: persona.tone === option.value ? '2px solid var(--accent)' : '1px solid var(--border)',
                      backgroundColor: persona.tone === option.value ? 'var(--accent)' : 'white',
                      color: persona.tone === option.value ? 'white' : 'var(--foreground)',
                      cursor: 'pointer',
                      fontWeight: 500,
                      fontSize: '0.85rem',
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Expertise Level */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '0.5rem', display: 'block' }}>
                רמת ידע
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {EXPERTISE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setPersona({ ...persona, expertiseLevel: option.value })}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '0.5rem',
                      border:
                        persona.expertiseLevel === option.value ? '2px solid var(--accent)' : '1px solid var(--border)',
                      backgroundColor: persona.expertiseLevel === option.value ? 'var(--accent)' : 'white',
                      color: persona.expertiseLevel === option.value ? 'white' : 'var(--foreground)',
                      cursor: 'pointer',
                      fontWeight: 500,
                      fontSize: '0.85rem',
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Speaking Style */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '0.5rem', display: 'block' }}>
                סגנון דברים
              </label>
              <input
                type="text"
                placeholder="ישיר, מספר סיפורים, אנרגטי..."
                value={persona.speakingStyle}
                onChange={(e) => setPersona({ ...persona, speakingStyle: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border)',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Industry */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '0.5rem', display: 'block' }}>
                תחום
              </label>
              <input
                type="text"
                placeholder="למשל: טכנולוגיה, שיווק דיגיטלי..."
                value={persona.industry}
                onChange={(e) => setPersona({ ...persona, industry: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border)',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Audience */}
            <div>
              <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '0.5rem', display: 'block' }}>
                קהל יעד
              </label>
              <input
                type="text"
                placeholder="בעלי עסקים קטנים, מנהלי שיווק..."
                value={persona.audience}
                onChange={(e) => setPersona({ ...persona, audience: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border)',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        )}

        {/* Step 4: Generate Strategy */}
        {step === 4 && mode === 'full' && (
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', color: 'var(--foreground)' }}>
              יצירת אסטרטגיית פרק
            </h2>

            {!structure ? (
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={useRealAI}
                    onChange={(e) => setUseRealAI(e.target.checked)}
                    style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.9rem', color: 'var(--foreground)' }}>השתמש ב-AI אמיתי (דורש קבע API)</span>
                </label>

                <button
                  onClick={handleGenerateStrategy}
                  disabled={isGenerating}
                  style={{
                    padding: '0.75rem 1.5rem',
                    borderRadius: '0.5rem',
                    backgroundColor: isGenerating ? '#cccccc' : 'var(--accent)',
                    color: 'white',
                    border: 'none',
                    cursor: isGenerating ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    fontSize: '1rem',
                  }}
                >
                  {isGenerating ? 'מייצר אסטרטגיית פרק...' : 'יצירת אסטרטגיה'}
                </button>
              </div>
            ) : (
              <div>
                {/* Opening Hook */}
                <div
                  style={{
                    padding: '1rem',
                    backgroundColor: 'var(--accent)',
                    color: 'white',
                    borderRadius: '0.5rem',
                    marginBottom: '1.5rem',
                  }}
                >
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem', opacity: 0.9 }}>
                    פתיחה תופסת
                  </div>
                  <div style={{ fontSize: '0.95rem' }}>{structure.openingHook}</div>
                </div>

                {/* Intro */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--foreground)' }}>
                    הקדמה
                  </h3>
                  <p style={{ margin: 0, color: 'var(--foreground-muted)', lineHeight: 1.6 }}>
                    {structure.intro}
                  </p>
                </div>

                {/* Segments */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--foreground)' }}>
                    סגמנטים
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {(structure.segments ?? []).map((segment, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '1rem',
                          backgroundColor: 'var(--surface)',
                          borderRadius: '0.5rem',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                          <h4 style={{ margin: 0, fontWeight: 600, color: 'var(--foreground)', fontSize: '0.95rem' }}>
                            {i + 1}. {segment.title}
                          </h4>
                          <span style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)' }}>
                            {segment.durationMinutes} דקות
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--foreground-muted)', lineHeight: 1.5 }}>
                          {segment.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Transitions */}
                {(structure.transitions ?? []).length > 0 && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--foreground)' }}>
                      מעברים
                    </h3>
                    <ul style={{ margin: 0, paddingRight: '1.5rem', color: 'var(--foreground-muted)', fontSize: '0.9rem' }}>
                      {structure.transitions.map((t, i) => (
                        <li key={i} style={{ marginBottom: '0.25rem' }}>
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Closing CTA */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--foreground)' }}>
                    קריאה לפעולה בסיום
                  </h3>
                  <p style={{ margin: 0, color: 'var(--foreground-muted)', lineHeight: 1.6, fontSize: '0.9rem' }}>
                    {structure.closingCTA}
                  </p>
                </div>

                <button
                  onClick={handleRegenerateStrategy}
                  disabled={isGenerating}
                  style={{
                    padding: '0.75rem 1.5rem',
                    borderRadius: '0.5rem',
                    backgroundColor: 'white',
                    color: 'var(--accent)',
                    border: '2px solid var(--accent)',
                    cursor: isGenerating ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                  }}
                >
                  {isGenerating ? 'מייצר מחדש...' : 'ייצר מחדש'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 5: View 20 Questions */}
        {step === 5 && (
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', color: 'var(--foreground)' }}>
              {mode === 'questions' ? '20 שאלות פרימיום' : 'צפייה ב-20 שאלות'}
            </h2>

            {questions.length === 0 ? (
              <button
                onClick={handleGenerateQuestions}
                disabled={isGenerating || (mode === 'full' && !episodeType)}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '0.5rem',
                  backgroundColor: isGenerating ? '#cccccc' : 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  cursor: isGenerating || (mode === 'full' && !episodeType) ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: '1rem',
                }}
              >
                {isGenerating ? 'מייצר 20 שאלות פרימיום...' : 'יצירת 20 שאלות'}
              </button>
            ) : (
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  {(questions ?? []).map((question) => (
                    <div
                      key={question.id}
                      style={{
                        padding: '1rem',
                        backgroundColor: 'var(--surface)',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--foreground)', lineHeight: 1.5 }}>
                            {question.text}
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            padding: '0.25rem 0.5rem',
                            borderRadius: '0.25rem',
                            backgroundColor: QUESTION_TYPE_COLORS[question.type] || '#6b7280',
                            color: 'white',
                            textTransform: 'capitalize',
                          }}
                        >
                          {question.type}
                        </span>

                        <div
                          style={{
                            flex: 1,
                            height: '4px',
                            backgroundColor: 'var(--border)',
                            borderRadius: '2px',
                            overflow: 'hidden',
                            minWidth: '100px',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${question.score}%`,
                              backgroundColor: 'var(--accent)',
                            }}
                          />
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', minWidth: '30px' }}>
                          {question.score}
                        </span>

                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                          {(question.labels ?? []).map((label) => (
                            <span
                              key={label}
                              style={{
                                fontSize: '0.7rem',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '0.25rem',
                                backgroundColor: '#f0f0f0',
                                color: 'var(--foreground)',
                                textTransform: 'capitalize',
                              }}
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleRegenerateQuestions}
                  disabled={isGenerating}
                  style={{
                    padding: '0.75rem 1.5rem',
                    borderRadius: '0.5rem',
                    backgroundColor: 'white',
                    color: 'var(--accent)',
                    border: '2px solid var(--accent)',
                    cursor: isGenerating ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                  }}
                >
                  {isGenerating ? 'מייצר מחדש...' : 'ייצר מחדש'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 6: Select & Reorder Questions */}
        {step === 6 && (
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', color: 'var(--foreground)' }}>
              בחירה וסדר שאלות
            </h2>

            <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'var(--surface)', borderRadius: '0.5rem' }}>
              <div style={{ fontSize: '0.9rem', color: 'var(--foreground)', fontWeight: 500 }}>
                {selectedQuestionCount} / 15 שאלות נבחרו
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  onClick={() => setQuestions(questions.map((q) => ({ ...q, selected: true })))}
                  style={{
                    padding: '0.4rem 0.8rem',
                    borderRadius: '0.25rem',
                    border: '1px solid var(--border)',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                  }}
                >
                  בחר הכל
                </button>
                <button
                  onClick={() => setQuestions(questions.map((q) => ({ ...q, selected: false })))}
                  style={{
                    padding: '0.4rem 0.8rem',
                    borderRadius: '0.25rem',
                    border: '1px solid var(--border)',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                  }}
                >
                  נקה בחירה
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {(questions ?? []).map((question, index) => (
                <div
                  key={question.id}
                  style={{
                    padding: '1rem',
                    backgroundColor: question.selected ? 'var(--accent)15' : 'var(--surface)',
                    borderRadius: '0.5rem',
                    border: question.selected ? '2px solid var(--accent)' : '1px solid var(--border)',
                    display: 'flex',
                    gap: '0.75rem',
                    alignItems: 'flex-start',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={question.selected}
                    onChange={() => toggleQuestion(question.id)}
                    style={{ marginTop: '0.5rem', cursor: 'pointer', width: '1.125rem', height: '1.125rem' }}
                  />

                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--foreground)', lineHeight: 1.5 }}>
                      {question.text}
                    </p>
                  </div>

                  {question.selected && (
                    <div style={{ display: 'flex', gap: '0.25rem', flexDirection: 'column' }}>
                      <button
                        onClick={() => moveQuestion(index, 'up')}
                        disabled={index === 0}
                        style={{
                          padding: '0.4rem 0.6rem',
                          borderRadius: '0.25rem',
                          border: '1px solid var(--border)',
                          backgroundColor: index === 0 ? '#f0f0f0' : 'white',
                          cursor: index === 0 ? 'not-allowed' : 'pointer',
                          fontSize: '0.75rem',
                          color: index === 0 ? '#aaa' : 'var(--foreground)',
                        }}
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveQuestion(index, 'down')}
                        disabled={index === questions.length - 1}
                        style={{
                          padding: '0.4rem 0.6rem',
                          borderRadius: '0.25rem',
                          border: '1px solid var(--border)',
                          backgroundColor: index === questions.length - 1 ? '#f0f0f0' : 'white',
                          cursor: index === questions.length - 1 ? 'not-allowed' : 'pointer',
                          fontSize: '0.75rem',
                          color: index === questions.length - 1 ? '#aaa' : 'var(--foreground)',
                        }}
                      >
                        ↓
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 7: Clip Ideas */}
        {step === 7 && (
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', color: 'var(--foreground)' }}>
              רעיונות קליפים לרשתות חברתיות
            </h2>

            {clipIdeas.length === 0 ? (
              <button
                onClick={handleGenerateClipIdeas}
                disabled={isGenerating || selectedQuestionCount === 0}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '0.5rem',
                  backgroundColor: isGenerating ? '#cccccc' : 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  cursor: isGenerating || selectedQuestionCount === 0 ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: '1rem',
                }}
              >
                {isGenerating ? 'מייצר רעיונות לקליפים...' : 'יצירת רעיונות קליפים'}
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {(clipIdeas ?? []).map((clip, index) => {
                  const relatedQuestion = questions.find((q) => q.id === clip.questionId);
                  return (
                    <div
                      key={index}
                      style={{
                        padding: '1.5rem',
                        backgroundColor: 'var(--surface)',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {relatedQuestion && (
                        <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--foreground-muted)', marginBottom: '0.25rem' }}>
                            שאלה
                          </div>
                          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--foreground)', lineHeight: 1.5 }}>
                            {relatedQuestion.text}
                          </p>
                        </div>
                      )}

                      <div style={{ marginBottom: '1rem' }}>
                        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)' }}>
                          {clip.clipTitle}
                        </h3>
                      </div>

                      <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'var(--accent)15', borderRadius: '0.5rem' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent)', marginBottom: '0.25rem' }}>
                          שורת ווירוס
                        </div>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--foreground)' }}>
                          {clip.hookLine}
                        </p>
                      </div>

                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--foreground-muted)', marginBottom: '0.25rem' }}>
                          אפשרות כיתוביון
                        </div>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--foreground)' }}>
                          {clip.captionIdea}
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {(clip.platformFit ?? []).map((platform) => (
                          <span
                            key={platform}
                            style={{
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              padding: '0.4rem 0.75rem',
                              borderRadius: '0.25rem',
                              backgroundColor: 'var(--accent)',
                              color: 'white',
                              textTransform: 'capitalize',
                            }}
                          >
                            {platform === 'youtube_shorts' ? 'YouTube Shorts' : platform === 'tiktok' ? 'TikTok' : 'Reels'}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div
        style={{
          maxWidth: '900px',
          margin: '2rem auto 0',
          display: 'flex',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={handlePrevStep}
          disabled={step === (mode === 'questions' ? 5 : 1)}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '0.5rem',
            border: '2px solid var(--border)',
            backgroundColor: 'white',
            color: 'var(--foreground)',
            cursor: step === (mode === 'questions' ? 5 : 1) ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            opacity: step === (mode === 'questions' ? 5 : 1) ? 0.5 : 1,
          }}
        >
          הקודם
        </button>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={handleSaveDraft}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border)',
              backgroundColor: 'white',
              color: 'var(--accent)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
            }}
          >
            שמור טיוטה
          </button>

          {step === (mode === 'questions' ? 7 : 7) ? (
            <button
              onClick={handleSaveAndComplete}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                backgroundColor: 'var(--accent)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              סיים ושמור
            </button>
          ) : (
            <button
              onClick={handleNextStep}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                backgroundColor: 'var(--accent)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              הבא
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StrategyWizardPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>טוען...</div>}>
      <StrategyWizardContent />
    </Suspense>
  );
}
