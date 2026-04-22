'use client';

import React, { useState, useEffect } from 'react';
import { Client, Employee } from '@/lib/db/schema';

interface TabResearchProps {
  client: Client;
  employees: Employee[];
}

interface ResearchData {
  id: string;
  clientId: string;
  identity: {
    whatTheySell: string;
    positioning: string;
    tone: string;
    uniqueValue: string;
    targetAudience: string;
  };
  audience: {
    primary: string;
    secondary: string;
    painPoints: string[];
  };
  weaknesses: Array<{
    area: string;
    description: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    recommendation: string;
  }>;
  competitors: Array<{
    name: string;
    whatWorks: string[];
    contentTypes: string[];
    toneDifference: string;
    weakness: string;
  }>;
  competitorSummary: {
    doMoreOf: string[];
    avoid: string[];
    contentTypesPerforming: string[];
  };
  opportunities: Array<{
    title: string;
    description: string;
    potentialImpact: 'high' | 'medium' | 'low';
    category: 'gap' | 'underused_angle' | 'positioning' | 'trend';
  }>;
  recommendedContentAngles: string[];
  contentIdeas25?: Array<{
    id: string;
    title: string;
    explanation: string;
    category: 'weakness' | 'opportunity' | 'audience' | 'competitor' | 'trend' | 'seasonal' | 'brand' | 'engagement';
  }>;
  recommendedCampaignConcepts: Array<{
    name: string;
    goal: string;
    platforms: string[];
    format: string;
  }>;
  actionPlan: {
    thingsToDo: Array<{ action: string; priority: 'urgent' | 'high' | 'medium'; }>;
    thingsToStop: Array<{ action: string; reason: string; }>;
    contentIdeas: Array<{ idea: string; format: string; platform: string; }>;
  };
  generatedAt?: string;
  strategicNotes?: string;
  notesAppliedAt?: string;
  savedAt?: string;
  status: 'pending' | 'analyzing' | 'complete' | 'failed';
  error?: string;
}

export default function TabResearch({ client }: TabResearchProps) {
  const [research, setResearch] = useState<ResearchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [notesText, setNotesText] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [updatingWithNotes, setUpdatingWithNotes] = useState(false);
  const [researchSaving, setResearchSaving] = useState(false);
  const [researchSavedAt, setResearchSavedAt] = useState<string | null>(null);
  const [researchSaveError, setResearchSaveError] = useState<string | null>(null);

  // Idea selection + Gantt sync state
  const [selectedIdeaIds, setSelectedIdeaIds] = useState<Set<string>>(new Set());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [syncMonth, setSyncMonth] = useState(new Date().getMonth() + 1); // 1-12
  const [syncYear, setSyncYear] = useState(new Date().getFullYear());
  const [isSyncingToGantt, setIsSyncingToGantt] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);

  const messages = [
    'מנתח את העסק...',
    'סורק מתחרים בשוק...',
    'מזהה חולשות ספציפיות...',
    'מחפש הזדמנויות תוכן...',
    'בונה קונספטים לקמפיינים...',
    'מגבש תוכנית פעולה...',
  ];

  useEffect(() => {
    fetchResearch();
  }, [client.id]);

  useEffect(() => {
    if (!generating) return;
    let messageIndex = 0;
    setStatusMessage(messages[0]);
    const interval = setInterval(() => {
      messageIndex = (messageIndex + 1) % messages.length;
      setStatusMessage(messages[messageIndex]);
    }, 3000);
    return () => clearInterval(interval);
  }, [generating]);

  const fetchResearch = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/ai/client-research?clientId=${client.id}`);
      const result = await response.json();
      if (response.ok && result.data) {
        if (result.data.strategicNotes) {
          setNotesText(result.data.strategicNotes);
        }
        if (result.data.savedAt) {
          setResearchSavedAt(result.data.savedAt);
        }
        if (result.data.status === 'complete') {
          setResearch(result.data);
        } else {
          setResearch(null);
        }
      } else {
        setResearch(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch research');
      setResearch(null);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateResearch = async () => {
    try {
      setGenerating(true);
      setError(null);
      setStatusMessage(messages[0]);

      const response = await fetch('/api/ai/client-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to generate research');
      }

      setResearch(result.data);
      if (result.data.savedAt) setResearchSavedAt(result.data.savedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate research');
    } finally {
      setGenerating(false);
      setStatusMessage('');
    }
  };

  const handleSaveResearch = async () => {
    try {
      setResearchSaving(true);
      setResearchSaveError(null);
      const response = await fetch('/api/ai/client-research', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to save research');
      }
      setResearchSavedAt(result.data.savedAt);
      if (result.data.strategicNotes) setNotesText(result.data.strategicNotes);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save research';
      setResearchSaveError(msg);
      setError(msg);
    } finally {
      setResearchSaving(false);
    }
  };

  const handleSaveNotes = async () => {
    try {
      setNotesSaving(true);
      setNotesSaved(false);
      const response = await fetch('/api/ai/client-research', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, strategicNotes: notesText }),
      });
      if (!response.ok) throw new Error('Failed to save notes');
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save notes');
    } finally {
      setNotesSaving(false);
    }
  };

  const handleUpdateWithNotes = async () => {
    if (!notesText.trim()) {
      setError('אנא כתוב הערות לפני עדכון הדוח');
      return;
    }
    try {
      setUpdatingWithNotes(true);
      setGenerating(true);
      setError(null);
      setStatusMessage('שומר הערות ומעדכן דוח...');

      const response = await fetch('/api/ai/client-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, strategicNotes: notesText }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Failed to update research');
      setResearch(result.data);
      if (result.data.savedAt) setResearchSavedAt(result.data.savedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update research');
    } finally {
      setUpdatingWithNotes(false);
      setGenerating(false);
      setStatusMessage('');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#dc2626';
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#22c55e';
      default: return '#6b7280';
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return '#22c55e';
      case 'medium': return '#f59e0b';
      case 'low': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'gap': return '#3b82f6';
      case 'underused_angle': return '#0092cc';
      case 'positioning': return '#f97316';
      case 'trend': return '#ef4444';
      default: return '#6b7280';
    }
  };

  // Safe defaults
  const safeIdentity = research?.identity ?? { whatTheySell: '', positioning: '', tone: '', uniqueValue: '', targetAudience: '' };
  const safeAudience = { primary: research?.audience?.primary ?? '', secondary: research?.audience?.secondary ?? '', painPoints: research?.audience?.painPoints ?? [] };
  const safeWeaknesses = research?.weaknesses ?? [];
  const safeCompetitors = (research?.competitors ?? []).map((c) => ({
    ...c, whatWorks: c.whatWorks ?? [], contentTypes: c.contentTypes ?? [], toneDifference: c.toneDifference ?? '', weakness: c.weakness ?? '',
  }));
  const safeCompetitorSummary = {
    doMoreOf: research?.competitorSummary?.doMoreOf ?? [],
    avoid: research?.competitorSummary?.avoid ?? [],
    contentTypesPerforming: research?.competitorSummary?.contentTypesPerforming ?? [],
  };
  const safeOpportunities = research?.opportunities ?? [];
  const safeContentAngles = research?.recommendedContentAngles ?? [];
  const safeCampaignConcepts = (research?.recommendedCampaignConcepts ?? []).map((c) => ({
    ...c, platforms: c.platforms ?? [], goal: c.goal ?? '', format: c.format ?? '',
  }));
  const safeActionPlan = {
    thingsToDo: research?.actionPlan?.thingsToDo ?? [],
    thingsToStop: research?.actionPlan?.thingsToStop ?? [],
    contentIdeas: research?.actionPlan?.contentIdeas ?? [],
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--surface-raised)',
    border: '1px solid var(--border)',
    borderRadius: '0.75rem',
    padding: '1.5rem',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '1.25rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '1.5rem',
    color: 'var(--foreground)',
  };

  // ---- Generate 25 Ideas for existing research ----
  const handleGenerateIdeas = async () => {
    setIsGeneratingIdeas(true);
    try {
      const res = await fetch('/api/ai/generate-content-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Failed to generate ideas');
      }
      // Update local research state with the new ideas
      setResearch(result.data);
      console.log(`[Research UI] Generated ${result.ideasCount} ideas`);
    } catch (err) {
      console.error('[Research UI] Generate ideas error:', err);
      alert(err instanceof Error ? err.message : 'שגיאה ביצירת רעיונות');
    } finally {
      setIsGeneratingIdeas(false);
    }
  };

  // ---- Idea Selection Handlers ----
  const toggleIdeaSelection = (ideaId: string) => {
    setSelectedIdeaIds((prev) => {
      const next = new Set(prev);
      if (next.has(ideaId)) next.delete(ideaId);
      else next.add(ideaId);
      return next;
    });
  };

  const selectAllIdeas = () => {
    const all = research?.contentIdeas25 || [];
    if (selectedIdeaIds.size === all.length) {
      setSelectedIdeaIds(new Set());
    } else {
      setSelectedIdeaIds(new Set(all.map((i) => i.id)));
    }
  };

  const handleSyncToGantt = async () => {
    if (selectedIdeaIds.size === 0 || !research) return;
    setIsSyncingToGantt(true);
    setSyncSuccess(null);
    try {
      const selectedIdeas = (research.contentIdeas25 || []).filter((i) => selectedIdeaIds.has(i.id));
      const res = await fetch(`/api/clients/${client.id}/sync-ideas-to-gantt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ideas: selectedIdeas,
          month: syncMonth,
          year: syncYear,
          researchId: research.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'שגיאה בסנכרון');
      setShowMonthPicker(false);
      setSelectedIdeaIds(new Set());
      setSyncSuccess(`✔ ${data?.items?.length ?? selectedIdeas.length} רעיונות נוספו לגאנט ונבנה עבורם תוכן`);
      setTimeout(() => setSyncSuccess(null), 6000);
    } catch (err: any) {
      console.error('[SyncToGantt]', err);
      setSyncSuccess(null);
      alert(err?.message || 'שגיאה בסנכרון לגאנט');
    } finally {
      setIsSyncingToGantt(false);
    }
  };

  const IDEA_CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
    weakness: { label: 'חולשה', color: '#ef4444' },
    opportunity: { label: 'הזדמנות', color: '#22c55e' },
    audience: { label: 'קהל', color: '#0092cc' },
    competitor: { label: 'מתחרה', color: '#3b82f6' },
    trend: { label: 'טרנד', color: '#f59e0b' },
    seasonal: { label: 'עונתי', color: '#06b6d4' },
    brand: { label: 'מותג', color: '#ec4899' },
    engagement: { label: 'אינטראקציה', color: '#f97316' },
  };

  const HEB_MONTH_NAMES = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

  const hoverHandlers = {
    onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.1)';
    },
    onMouseLeave: (e: React.MouseEvent<HTMLDivElement>) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = 'none';
    },
  };

  if (loading) {
    return (
      <div style={{ direction: 'rtl', padding: '1.5rem' }}>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }`}</style>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ ...cardStyle, height: '150px', marginBottom: '1rem', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
    );
  }

  if (generating) {
    return (
      <div style={{ direction: 'rtl', padding: '1.5rem' }}>
        <style>{`
          @keyframes gradientPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
        <div style={{
          ...cardStyle,
          padding: '3rem',
          textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(109, 40, 217, 0.1) 100%)',
          animation: 'gradientPulse 2s ease-in-out infinite',
        }}>
          <div style={{ width: '50px', height: '50px', border: '4px solid var(--border)', borderTop: '4px solid var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1.5rem' }} />
          <p style={{ fontSize: '1.125rem', fontWeight: 500, color: 'var(--foreground)', marginBottom: '0.5rem' }}>{statusMessage}</p>
          <p style={{ fontSize: '0.875rem', color: 'var(--foreground-muted)' }}>זה עלול לקחת כמה דקות...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ direction: 'rtl', padding: '1.5rem' }}>
      {error && (
        <div style={{ backgroundColor: 'rgba(220, 38, 38, 0.1)', border: '1px solid rgba(220, 38, 38, 0.3)', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.5rem', color: '#dc2626', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {!research ? (
        <div style={{ textAlign: 'center', ...cardStyle, padding: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ fontSize: '3rem' }}>🔍</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--foreground)' }}>חקור לקוח עם AI</h2>
          <p style={{ fontSize: '1rem', color: 'var(--foreground-muted)', maxWidth: '400px' }}>ניתוח מעמיק של העסק, המתחרים, וההזדמנויות — הכל מבוסס AI</p>
          <button
            onClick={handleGenerateResearch}
            style={{ backgroundColor: 'transparent', background: 'linear-gradient(135deg, #0092cc 0%, #6d28d9 100%)', color: 'white', border: 'none', borderRadius: '0.5rem', padding: '0.75rem 1.5rem', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 16px rgba(139, 92, 246, 0.3)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            🔍 התחל חקירה
          </button>
          <p style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', marginTop: '1rem' }}>הניתוח משתמש ב-OpenAI ומחזיר תוצאות ספציפיות לעסק</p>
        </div>
      ) : (
        <>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--foreground-muted)' }}>
                ניתוח אחרון: {research.generatedAt ? new Date(research.generatedAt).toLocaleDateString('he-IL') + ' ' + new Date(research.generatedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : 'לא זמין'}
              </p>
              {researchSavedAt && (
                <p style={{ fontSize: '0.75rem', color: '#22c55e', fontWeight: 500 }}>
                  ✓ החקר נשמר — {new Date(researchSavedAt).toLocaleDateString('he-IL')} {new Date(researchSavedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
              {researchSaveError && (
                <p style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 500 }}>
                  ✗ שגיאה בשמירה: {researchSaveError}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleSaveResearch}
                disabled={researchSaving}
                style={{
                  backgroundColor: 'var(--surface)',
                  color: '#22c55e',
                  border: '1px solid #22c55e',
                  borderRadius: '0.5rem',
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity: researchSaving ? 0.6 : 1,
                }}
              >
                {researchSaving ? '...שומר' : '💾 שמור חקר'}
              </button>
              <button
                onClick={handleGenerateResearch}
                disabled={generating}
                style={{ backgroundColor: 'transparent', background: 'linear-gradient(135deg, #0092cc 0%, #6d28d9 100%)', color: 'white', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', opacity: generating ? 0.6 : 1 }}
              >
                🔄 חקור מחדש
              </button>
            </div>
          </div>

          {/* Strategic Notes Section */}
          <div style={{ ...cardStyle, marginBottom: '2rem', borderLeft: '4px solid #f59e0b' }}>
            <h3 style={sectionTitleStyle}>📝 הערות אסטרטגיות שלי</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--foreground-muted)', marginBottom: '1rem' }}>
              כתוב כאן תובנות מהיכרות אישית עם הלקוח: מטרות נסתרות, התנגדויות מכירה, ניואנסים של קהל יעד, מידע פנימי שלא גלוי מהאתר/סושיאל
            </p>
            <textarea
              value={notesText}
              onChange={(e) => { setNotesText(e.target.value); setNotesSaved(false); }}
              placeholder="לדוגמה: הלקוח רוצה להתמקד בקהל של 30-45, הוא מתביש להעלות מחירים אבל המתחרים שלו גובים פי 2. הוא סיפר לי שהלקוחות שלו באים מהמלצות ולא מהסושיאל. המטרה האמיתית שלו היא להוריד תלות בהמלצות ולבנות מותג..."
              style={{
                width: '100%',
                minHeight: '120px',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--surface)',
                color: 'var(--foreground)',
                fontSize: '0.875rem',
                lineHeight: '1.6',
                resize: 'vertical',
                fontFamily: 'inherit',
                direction: 'rtl',
              }}
            />
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', alignItems: 'center' }}>
              <button
                onClick={handleSaveNotes}
                disabled={notesSaving}
                style={{
                  backgroundColor: 'var(--surface)',
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.5rem',
                  padding: '0.5rem 1rem',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  opacity: notesSaving ? 0.6 : 1,
                }}
              >
                {notesSaving ? '...שומר' : '💾 שמור הערות'}
              </button>
              <button
                onClick={handleUpdateWithNotes}
                disabled={updatingWithNotes || !notesText.trim()}
                style={{
                  backgroundColor: 'transparent',
                  background: notesText.trim() ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  padding: '0.5rem 1rem',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: notesText.trim() ? 'pointer' : 'not-allowed',
                  opacity: updatingWithNotes ? 0.6 : 1,
                }}
              >
                {updatingWithNotes ? '...מעדכן דוח' : '🔄 עדכן דוח לפי ההערות שלי'}
              </button>
              {notesSaved && (
                <span style={{ fontSize: '0.8125rem', color: '#22c55e', fontWeight: 500 }}>✓ נשמר</span>
              )}
            </div>
            {research?.notesAppliedAt && (
              <div style={{
                marginTop: '0.75rem',
                padding: '0.5rem 0.75rem',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                color: '#d97706',
              }}>
                📋 הדוח עודכן לפי ההערות האסטרטגיות שלך — {new Date(research.notesAppliedAt).toLocaleDateString('he-IL')} {new Date(research.notesAppliedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>

          {/* Section A: Identity */}
          <div style={{ ...cardStyle, marginBottom: '2rem', borderLeft: '4px solid #0092cc' }}>
            <h3 style={sectionTitleStyle}>🧠 מי הלקוח</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div>
                <p style={{ fontSize: '0.875rem', color: 'var(--foreground-muted)', marginBottom: '0.25rem' }}>מה הם מוכרים באמת:</p>
                <p style={{ fontSize: '1rem', color: 'var(--foreground)', fontWeight: 500 }}>{safeIdentity.whatTheySell || '—'}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.875rem', color: 'var(--foreground-muted)', marginBottom: '0.25rem' }}>מיצוב:</p>
                <p style={{ fontSize: '1rem', color: 'var(--foreground)', fontWeight: 500 }}>{safeIdentity.positioning || '—'}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.875rem', color: 'var(--foreground-muted)', marginBottom: '0.25rem' }}>טון תקשורת:</p>
                <p style={{ fontSize: '1rem', color: 'var(--foreground)', fontWeight: 500 }}>{safeIdentity.tone || '—'}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.875rem', color: 'var(--foreground-muted)', marginBottom: '0.25rem' }}>ערך ייחודי:</p>
                <p style={{ fontSize: '1rem', color: 'var(--foreground)', fontWeight: 500 }}>{safeIdentity.uniqueValue || '—'}</p>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <p style={{ fontSize: '0.875rem', color: 'var(--foreground-muted)', marginBottom: '0.25rem' }}>קהל יעד:</p>
                <p style={{ fontSize: '1rem', color: 'var(--foreground)', fontWeight: 500 }}>{safeIdentity.targetAudience || '—'}</p>
              </div>
            </div>
          </div>

          {/* Section B: Audience Deep Dive */}
          <div style={{ ...cardStyle, marginBottom: '2rem', borderLeft: '4px solid #3b82f6' }}>
            <h3 style={sectionTitleStyle}>👥 הכרת קהל היעד</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div>
                <p style={{ fontSize: '0.875rem', color: 'var(--foreground-muted)', marginBottom: '0.25rem' }}>קהל עיקרי:</p>
                <p style={{ fontSize: '1rem', color: 'var(--foreground)', fontWeight: 500 }}>{safeAudience.primary || '—'}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.875rem', color: 'var(--foreground-muted)', marginBottom: '0.25rem' }}>קהל משני:</p>
                <p style={{ fontSize: '1rem', color: 'var(--foreground)', fontWeight: 500 }}>{safeAudience.secondary || '—'}</p>
              </div>
            </div>
            {safeAudience.painPoints.length > 0 && (
              <div>
                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '0.75rem' }}>נקודות כאב:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {safeAudience.painPoints.map((point, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--foreground-muted)' }}>
                      <span style={{ color: '#ef4444', flexShrink: 0 }}>•</span>
                      {point}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section C: Weaknesses */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={sectionTitleStyle}>❌ מה לא עובד</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
              {safeWeaknesses.length === 0 && <p style={{ fontSize: '0.875rem', color: 'var(--foreground-muted)', padding: '1rem' }}>לא זוהו חולשות</p>}
              {safeWeaknesses.map((weakness, idx) => (
                <div key={idx} style={{ ...cardStyle, cursor: 'pointer' }} {...hoverHandlers}>
                  <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }`}</style>
                  <div style={{ display: 'inline-block', backgroundColor: getSeverityColor(weakness.severity), color: 'white', padding: '0.25rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.75rem', animation: weakness.severity === 'critical' ? 'pulse 2s ease-in-out infinite' : 'none' }}>
                    {weakness.severity === 'critical' && '🔴 דחוף'}
                    {weakness.severity === 'high' && '⚠️ גבוה'}
                    {weakness.severity === 'medium' && '⚠️ בינוני'}
                    {weakness.severity === 'low' && '✓ נמוך'}
                  </div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.5rem' }}>{weakness.area}</h4>
                  <p style={{ fontSize: '0.875rem', color: 'var(--foreground-muted)', marginBottom: '1rem', lineHeight: '1.5' }}>{weakness.description}</p>
                  <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.05)', border: '1px solid rgba(34, 197, 94, 0.2)', borderLeft: '3px solid #22c55e', borderRadius: '0.375rem', padding: '0.75rem', fontSize: '0.875rem', color: '#22c55e' }}>
                    {weakness.recommendation}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section D: Competitor Insights */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={sectionTitleStyle}>🧲 מה עובד למתחרים</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
              {safeCompetitors.length === 0 && <p style={{ fontSize: '0.875rem', color: 'var(--foreground-muted)', padding: '1rem' }}>לא זוהו מתחרים</p>}
              {safeCompetitors.map((competitor, idx) => (
                <div key={idx} style={cardStyle} {...hoverHandlers}>
                  <h4 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '1rem' }}>{competitor.name}</h4>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '0.5rem' }}>מה עובד:</p>
                  <ul style={{ listStyle: 'none', padding: 0, marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {competitor.whatWorks.map((work, widx) => (
                      <li key={widx} style={{ fontSize: '0.875rem', color: 'var(--foreground-muted)', paddingRight: '1rem', position: 'relative' }}>
                        <span style={{ position: 'absolute', right: 0 }}>•</span>{work}
                      </li>
                    ))}
                  </ul>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '0.5rem' }}>סוגי תוכן:</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                    {competitor.contentTypes.map((type, tidx) => (
                      <span key={tidx} style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', color: '#0092cc', padding: '0.25rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 500 }}>{type}</span>
                    ))}
                  </div>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '0.5rem' }}>הבדל בטון:</p>
                  <p style={{ fontSize: '0.875rem', color: 'var(--foreground-muted)', marginBottom: '1rem' }}>{competitor.toneDifference}</p>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '0.5rem' }}>חולשה (הזדמנות):</p>
                  <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.05)', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: '0.375rem', padding: '0.75rem', fontSize: '0.875rem', color: '#22c55e', fontWeight: 500 }}>{competitor.weakness}</div>
                </div>
              ))}
            </div>

            {/* Competitor Summary */}
            <div style={{ ...cardStyle, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem' }}>
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#22c55e', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>✅ לעשות יותר</h4>
                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {safeCompetitorSummary.doMoreOf.map((item, idx) => (
                    <li key={idx} style={{ fontSize: '0.875rem', color: 'var(--foreground)', paddingRight: '0.5rem' }}>
                      <span style={{ color: '#22c55e', marginRight: '0.5rem' }}>✓</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#ef4444', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>❌ להימנע</h4>
                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {safeCompetitorSummary.avoid.map((item, idx) => (
                    <li key={idx} style={{ fontSize: '0.875rem', color: 'var(--foreground)', paddingRight: '0.5rem' }}>
                      <span style={{ color: '#ef4444', marginRight: '0.5rem' }}>✕</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#3b82f6', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>📊 סוגי תוכן שעובדים</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {safeCompetitorSummary.contentTypesPerforming.map((type, idx) => (
                    <span key={idx} style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#3b82f6', padding: '0.25rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 500 }}>{type}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section E: Opportunities */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={sectionTitleStyle}>🚀 הזדמנויות</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
              {safeOpportunities.map((opp, idx) => {
                const impactColor = getImpactColor(opp.potentialImpact);
                const categoryColor = getCategoryColor(opp.category);
                const rgb = opp.potentialImpact === 'high' ? '34, 197, 94' : opp.potentialImpact === 'medium' ? '245, 158, 11' : '107, 114, 128';
                const bgOpacity = opp.potentialImpact === 'high' ? 0.1 : opp.potentialImpact === 'medium' ? 0.06 : 0.03;
                return (
                  <div key={idx} style={{ backgroundColor: `rgba(${rgb}, ${bgOpacity})`, border: `1px solid rgba(${rgb}, 0.2)`, borderRadius: '0.75rem', padding: '1.5rem', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }} {...hoverHandlers}>
                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', alignItems: 'center' }}>
                      <span style={{ backgroundColor: impactColor, color: 'white', padding: '0.25rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 600 }}>
                        {opp.potentialImpact === 'high' && '⬆️ גבוה'}{opp.potentialImpact === 'medium' && '⬆️ בינוני'}{opp.potentialImpact === 'low' && '⬆️ נמוך'}
                      </span>
                      <span style={{ backgroundColor: categoryColor, color: 'white', padding: '0.25rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 600 }}>
                        {opp.category === 'gap' && 'פער'}{opp.category === 'underused_angle' && 'זווית לא מנוצלת'}{opp.category === 'positioning' && 'מיצוב'}{opp.category === 'trend' && 'טרנד'}
                      </span>
                    </div>
                    <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.5rem' }}>{opp.title}</h4>
                    <p style={{ fontSize: '0.875rem', color: 'var(--foreground-muted)', lineHeight: '1.5' }}>{opp.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section G: Campaign Concepts */}
          {safeCampaignConcepts.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={sectionTitleStyle}>🎯 קונספטים לקמפיינים</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {safeCampaignConcepts.map((concept, idx) => (
                  <div key={idx} style={{ ...cardStyle, borderLeft: '4px solid #0092cc' }} {...hoverHandlers}>
                    <h4 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.75rem' }}>{concept.name}</h4>
                    <p style={{ fontSize: '0.875rem', color: 'var(--foreground-muted)', marginBottom: '1rem', lineHeight: '1.5' }}>{concept.goal}</p>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                      {concept.platforms.map((p, pidx) => (
                        <span key={pidx} style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', color: '#0092cc', padding: '0.2rem 0.6rem', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 500 }}>{p}</span>
                      ))}
                    </div>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--foreground-muted)' }}>פורמט: {concept.format}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section H: Action Plan */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={sectionTitleStyle}>📋 תוכנית פעולה</h3>

            {/* Things to Do */}
            <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>✅ דברים לעשות</h4>
              <ol style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {safeActionPlan.thingsToDo.map((action, idx) => (
                  <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                    <span style={{ backgroundColor: getSeverityColor(action.priority), color: 'white', padding: '0.25rem 0.5rem', borderRadius: '0.375rem', fontSize: '0.6875rem', fontWeight: 600, whiteSpace: 'nowrap', marginTop: '2px' }}>
                      {action.priority === 'urgent' && 'דחוף'}{action.priority === 'high' && 'גבוה'}{action.priority === 'medium' && 'בינוני'}
                    </span>
                    <p style={{ fontSize: '0.9375rem', color: 'var(--foreground)', lineHeight: '1.5' }}>{action.action}</p>
                  </li>
                ))}
              </ol>
            </div>

            {/* Things to Stop */}
            <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#ef4444', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>🛑 דברים להפסיק</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {safeActionPlan.thingsToStop.map((item, idx) => (
                  <div key={idx} style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '0.5rem', padding: '1rem' }}>
                    <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '0.25rem' }}>{item.action}</p>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--foreground-muted)' }}>למה: {item.reason}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* ============================================ */}
          {/* SECTION I: CONTENT IDEAS — ALWAYS RENDERED   */}
          {/* ============================================ */}
          <div style={{ marginBottom: '2rem' }}>
            {/* Debug markers */}
            <div style={{ background: '#1e293b', color: '#38bdf8', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.7rem', fontFamily: 'monospace', marginBottom: '0.75rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <span>IDEAS COUNT: {research?.contentIdeas25?.length ?? 0}</span>
              <span>SELECTED COUNT: {selectedIdeaIds.size}</span>
              <span>BUTTON RENDERED: YES</span>
              <span>SECTION MOUNTED: YES</span>
            </div>

            {/* Header row — always visible */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ ...sectionTitleStyle, marginBottom: 0 }}>
                💡 רעיונות תוכן {research?.contentIdeas25?.length ? `(${research.contentIdeas25.length})` : ''}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                {/* Generate ideas button — shown when ideas don't exist */}
                {(!research?.contentIdeas25 || research.contentIdeas25.length === 0) && (
                  <button
                    onClick={handleGenerateIdeas}
                    disabled={isGeneratingIdeas}
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      padding: '0.4rem 1rem',
                      borderRadius: '0.375rem',
                      border: 'none',
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      color: 'white',
                      cursor: isGeneratingIdeas ? 'not-allowed' : 'pointer',
                      opacity: isGeneratingIdeas ? 0.6 : 1,
                    }}
                  >
                    {isGeneratingIdeas ? '⏳ מייצר 25 רעיונות...' : '✨ צור 25 רעיונות תוכן'}
                  </button>
                )}
                {/* Select all / deselect — shown when ideas exist */}
                {research?.contentIdeas25 && research.contentIdeas25.length > 0 && (
                  <>
                    <button
                      onClick={selectAllIdeas}
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.3rem 0.75rem',
                        borderRadius: '0.375rem',
                        border: '1px solid var(--border)',
                        background: 'transparent',
                        color: 'var(--foreground-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      {selectedIdeaIds.size === research.contentIdeas25.length ? 'בטל הכל' : 'בחר הכל'}
                    </button>
                    {/* Regenerate ideas button */}
                    <button
                      onClick={handleGenerateIdeas}
                      disabled={isGeneratingIdeas}
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.3rem 0.75rem',
                        borderRadius: '0.375rem',
                        border: '1px solid var(--border)',
                        background: 'transparent',
                        color: 'var(--foreground-muted)',
                        cursor: isGeneratingIdeas ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {isGeneratingIdeas ? '⏳ מייצר...' : '🔄 ייצר מחדש'}
                    </button>
                  </>
                )}
                {/* Add to gantt button — ALWAYS visible when ideas exist */}
                {research?.contentIdeas25 && research.contentIdeas25.length > 0 && (
                  <button
                    onClick={() => {
                      if (selectedIdeaIds.size === 0) {
                        alert('יש לבחור לפחות רעיון אחד');
                        return;
                      }
                      setShowMonthPicker(true);
                    }}
                    disabled={isSyncingToGantt}
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      padding: '0.4rem 1rem',
                      borderRadius: '0.375rem',
                      border: '1px solid #00B5FE',
                      background: selectedIdeaIds.size > 0 ? '#00B5FE' : 'transparent',
                      color: selectedIdeaIds.size > 0 ? 'white' : '#00B5FE',
                      cursor: isSyncingToGantt ? 'not-allowed' : 'pointer',
                      opacity: isSyncingToGantt ? 0.6 : 1,
                    }}
                  >
                    {isSyncingToGantt ? '⏳ מסנכרן...' : `הוסף לגאנט${selectedIdeaIds.size > 0 ? ` (${selectedIdeaIds.size})` : ''}`}
                  </button>
                )}
              </div>
            </div>

            {/* Success feedback */}
            {syncSuccess && (
              <div style={{
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: '0.5rem',
                padding: '0.75rem 1rem',
                marginBottom: '1rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#22c55e',
              }}>
                {syncSuccess}
              </div>
            )}

            {/* No ideas yet — show prompt */}
            {(!research?.contentIdeas25 || research.contentIdeas25.length === 0) && (
              <div style={{
                ...cardStyle,
                textAlign: 'center',
                padding: '2rem',
                borderLeft: '4px solid #f59e0b',
              }}>
                <p style={{ fontSize: '0.9rem', color: 'var(--foreground-muted)', marginBottom: '0.5rem' }}>
                  לא נוצרו עדיין רעיונות תוכן לחקר זה.
                </p>
                <p style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)' }}>
                  לחץ על "צור 25 רעיונות תוכן" כדי לייצר רעיונות מבוססי חקר.
                </p>
              </div>
            )}

            {/* Ideas grid — rendered when ideas exist */}
            {research?.contentIdeas25 && research.contentIdeas25.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                {research.contentIdeas25.map((idea) => {
                  const isSelected = selectedIdeaIds.has(idea.id);
                  const catInfo = IDEA_CATEGORY_LABELS[idea.category] || { label: idea.category, color: '#6b7280' };
                  return (
                    <div
                      key={idea.id}
                      onClick={() => toggleIdeaSelection(idea.id)}
                      style={{
                        padding: '1rem',
                        borderRadius: '0.5rem',
                        borderTop: isSelected ? '2px solid #00B5FE' : '1px solid var(--border)',
                        borderRight: isSelected ? '2px solid #00B5FE' : '1px solid var(--border)',
                        borderBottom: isSelected ? '2px solid #00B5FE' : '1px solid var(--border)',
                        borderLeft: `4px solid ${catInfo.color}`,
                        background: isSelected ? 'rgba(0, 181, 254, 0.05)' : 'var(--surface-raised)',
                        cursor: 'pointer',
                        transition: 'all 150ms ease',
                        position: 'relative',
                      }}
                    >
                      {/* Checkbox */}
                      <div style={{
                        position: 'absolute',
                        top: '0.75rem',
                        left: '0.75rem',
                        width: '20px',
                        height: '20px',
                        borderRadius: '4px',
                        border: isSelected ? '2px solid #00B5FE' : '2px solid var(--border)',
                        background: isSelected ? '#00B5FE' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.7rem',
                        color: 'white',
                        fontWeight: 700,
                      }}>
                        {isSelected && '✓'}
                      </div>

                      {/* Category badge */}
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span style={{
                          fontSize: '0.65rem',
                          fontWeight: 600,
                          padding: '0.1rem 0.4rem',
                          borderRadius: '0.2rem',
                          background: `${catInfo.color}15`,
                          color: catInfo.color,
                          border: `1px solid ${catInfo.color}30`,
                        }}>
                          {catInfo.label}
                        </span>
                      </div>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.35rem', lineHeight: 1.4 }}>{idea.title}</h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)', lineHeight: 1.5, margin: 0 }}>{idea.explanation}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Month Picker Popup for Gantt Sync */}
          {showMonthPicker && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
              }}
              onClick={() => setShowMonthPicker(false)}
            >
              <div
                style={{
                  background: 'var(--surface-raised)',
                  borderRadius: '0.75rem',
                  padding: '1.5rem',
                  maxWidth: '360px',
                  width: '90%',
                  direction: 'rtl',
                  border: '1px solid var(--border)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)', margin: '0 0 1rem 0' }}>
                  לאיזה חודש לשייך את הרעיונות?
                </h3>
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', marginBottom: '0.25rem', display: 'block' }}>חודש</label>
                    <select
                      value={syncMonth}
                      onChange={(e) => setSyncMonth(parseInt(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        borderRadius: '0.375rem',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--foreground)',
                        fontSize: '0.85rem',
                      }}
                    >
                      {HEB_MONTH_NAMES.map((m, i) => (
                        <option key={i} value={i + 1}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', marginBottom: '0.25rem', display: 'block' }}>שנה</label>
                    <select
                      value={syncYear}
                      onChange={(e) => setSyncYear(parseInt(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        borderRadius: '0.375rem',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--foreground)',
                        fontSize: '0.85rem',
                      }}
                    >
                      {[2025, 2026, 2027].map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)', marginBottom: '1rem' }}>
                  {selectedIdeaIds.size} רעיונות נבחרו — ייווצר תוכן AI מלא עבור כל אחד
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setShowMonthPicker(false)}
                    style={{
                      fontSize: '0.8rem',
                      padding: '0.5rem 1rem',
                      borderRadius: '0.375rem',
                      border: '1px solid var(--border)',
                      background: 'transparent',
                      color: 'var(--foreground-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    ביטול
                  </button>
                  <button
                    onClick={handleSyncToGantt}
                    disabled={isSyncingToGantt}
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      padding: '0.5rem 1rem',
                      borderRadius: '0.375rem',
                      border: 'none',
                      background: '#00B5FE',
                      color: 'white',
                      cursor: isSyncingToGantt ? 'not-allowed' : 'pointer',
                      opacity: isSyncingToGantt ? 0.6 : 1,
                    }}
                  >
                    {isSyncingToGantt ? '⏳ מייצר תוכן...' : 'הוסף לגאנט'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
