'use client';

import { useState, useEffect, useCallback } from 'react';

const SURVEY_TYPE_LABELS: Record<string, string> = {
  nps: 'NPS',
  csat: 'שביעות רצון',
  feedback: 'משוב',
  research: 'מחקר',
  custom: 'מותאם אישית',
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: 'טיוטה', color: 'bg-gray-500/20 text-gray-300' },
  active: { label: 'פעיל', color: 'bg-green-500/20 text-green-300' },
  closed: { label: 'סגור', color: 'bg-red-500/20 text-red-300' },
  archived: { label: 'בארכיון', color: 'bg-white/10 text-white/40' },
};

const QUESTION_TYPE_LABELS: Record<string, string> = {
  rating: 'דירוג (1-5)',
  nps: 'NPS (0-10)',
  text: 'טקסט חופשי',
  multiple_choice: 'בחירה מרובה',
  single_choice: 'בחירה יחידה',
  scale: 'סולם',
};

export default function SurveysPage() {
  const [surveys, setSurveys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'nps' as string,
    brandColor: '#3b82f6',
    thankYouMessage: 'תודה על המשוב!',
    questions: [] as { type: string; text: string; required: boolean; options: string[] }[],
  });
  const [newQuestion, setNewQuestion] = useState({ type: 'rating', text: '', required: true, options: '' });

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/surveys?${params}`);
      if (res.ok) setSurveys(await res.json());
    } catch {}
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const addQuestion = () => {
    if (!newQuestion.text) return;
    setForm(p => ({
      ...p,
      questions: [
        ...p.questions,
        {
          type: newQuestion.type,
          text: newQuestion.text,
          required: newQuestion.required,
          options: newQuestion.options ? newQuestion.options.split(',').map(o => o.trim()) : [],
        },
      ],
    }));
    setNewQuestion({ type: 'rating', text: '', required: true, options: '' });
  };

  const removeQuestion = (idx: number) => {
    setForm(p => ({ ...p, questions: p.questions.filter((_, i) => i !== idx) }));
  };

  const handleCreate = async () => {
    if (!form.title || !form.type) return;
    try {
      const payload = {
        title: form.title,
        description: form.description,
        type: form.type,
        brandColor: form.brandColor,
        thankYouMessage: form.thankYouMessage,
        questions: form.questions.map((q, i) => ({
          id: `q_${Date.now()}_${i}`,
          type: q.type,
          text: q.text,
          required: q.required,
          order: i,
          options: q.options,
        })),
      };
      const res = await fetch('/api/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setShowCreate(false);
        setForm({ title: '', description: '', type: 'nps', brandColor: '#3b82f6', thankYouMessage: 'תודה על המשוב!', questions: [] });
        load();
      }
    } catch {}
  };

  const totalResponses = surveys.reduce((sum, s) => sum + (s.totalResponses || 0), 0);
  const activeCount = surveys.filter(s => s.status === 'active').length;
  const avgNps = (() => {
    const withNps = surveys.filter(s => s.npsScore !== null && s.npsScore !== undefined);
    if (withNps.length === 0) return null;
    return Math.round(withNps.reduce((sum, s) => sum + s.npsScore, 0) / withNps.length);
  })();

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">סקרים ומשוב</h1>
          <p className="text-sm text-white/50 mt-1">בניית סקרים, NPS ואיסוף משוב מלקוחות</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + סקר חדש
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="text-sm text-white/50">סקרים פעילים</div>
          <div className="text-2xl font-bold text-white mt-1">{activeCount}</div>
        </div>
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="text-sm text-white/50">סה&quot;כ סקרים</div>
          <div className="text-2xl font-bold text-white mt-1">{surveys.length}</div>
        </div>
        <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
          <div className="text-sm text-blue-300/70">תגובות</div>
          <div className="text-2xl font-bold text-blue-300 mt-1">{totalResponses.toLocaleString()}</div>
        </div>
        <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/20">
          <div className="text-sm text-green-300/70">ציון NPS ממוצע</div>
          <div className="text-2xl font-bold text-green-300 mt-1">{avgNps !== null ? avgNps : '—'}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {[
          { val: '', label: 'הכל' },
          { val: 'draft', label: 'טיוטות' },
          { val: 'active', label: 'פעילים' },
          { val: 'closed', label: 'סגורים' },
        ].map(f => (
          <button
            key={f.val}
            onClick={() => setStatusFilter(f.val)}
            className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${
              statusFilter === f.val
                ? 'bg-blue-600 text-white'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Survey List */}
      {loading ? (
        <div className="text-center text-white/40 py-20">טוען סקרים...</div>
      ) : surveys.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-4xl mb-4">📋</div>
          <p className="text-white/50">{statusFilter ? 'אין סקרים בסטטוס זה' : 'אין סקרים עדיין'}</p>
          <button onClick={() => setShowCreate(true)} className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg text-sm">
            צור סקר ראשון
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {surveys.map((survey: any) => {
            const sInfo = STATUS_MAP[survey.status] || STATUS_MAP.draft;
            return (
              <div key={survey.id} className="bg-white/5 rounded-xl p-5 border border-white/10 hover:border-white/20 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-medium text-white">{survey.title}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${sInfo.color}`}>{sInfo.label}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-white/60">
                        {SURVEY_TYPE_LABELS[survey.type] || survey.type}
                      </span>
                    </div>
                    {survey.description && <p className="text-xs text-white/40 mt-1">{survey.description}</p>}
                    <div className="text-xs text-white/40 mt-1">
                      {survey.questions?.length || 0} שאלות
                      {survey.distributionChannels?.length > 0 && ` · הפצה: ${survey.distributionChannels.join(', ')}`}
                    </div>
                  </div>
                  <div className="flex gap-6 text-center flex-shrink-0">
                    <div>
                      <div className="text-lg font-bold text-white">{survey.totalResponses || 0}</div>
                      <div className="text-xs text-white/40">תגובות</div>
                    </div>
                    {survey.avgScore !== null && survey.avgScore !== undefined && (
                      <div>
                        <div className="text-lg font-bold text-blue-400">{Number(survey.avgScore).toFixed(1)}</div>
                        <div className="text-xs text-white/40">ממוצע</div>
                      </div>
                    )}
                    {survey.npsScore !== null && survey.npsScore !== undefined && (
                      <div>
                        <div className={`text-lg font-bold ${survey.npsScore >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {survey.npsScore}
                        </div>
                        <div className="text-xs text-white/40">NPS</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1f2e] rounded-2xl p-6 w-full max-w-2xl border border-white/10 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-6">סקר חדש</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-white/60 block mb-1">שם הסקר</label>
                  <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" placeholder="למשל: סקר שביעות רצון Q1" />
                </div>
                <div>
                  <label className="text-sm text-white/60 block mb-1">סוג סקר</label>
                  <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                    {Object.entries(SURVEY_TYPE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm text-white/60 block mb-1">תיאור</label>
                <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" placeholder="תיאור קצר של הסקר" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-white/60 block mb-1">צבע מותג</label>
                  <input type="color" value={form.brandColor} onChange={e => setForm(p => ({ ...p, brandColor: e.target.value }))}
                    className="w-full h-10 bg-white/5 border border-white/10 rounded-lg cursor-pointer" />
                </div>
                <div>
                  <label className="text-sm text-white/60 block mb-1">הודעת תודה</label>
                  <input value={form.thankYouMessage} onChange={e => setForm(p => ({ ...p, thankYouMessage: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
                </div>
              </div>

              {/* Questions Builder */}
              <div className="border-t border-white/10 pt-4">
                <h4 className="text-sm font-medium text-white/70 mb-3">שאלות ({form.questions.length})</h4>

                {form.questions.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {form.questions.map((q, i) => (
                      <div key={i} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                        <span className="text-xs text-white/40 w-6">{i + 1}.</span>
                        <span className="text-sm text-white flex-1">{q.text}</span>
                        <span className="text-xs text-white/40">{QUESTION_TYPE_LABELS[q.type]}</span>
                        {q.required && <span className="text-xs text-red-400">*</span>}
                        <button onClick={() => removeQuestion(i)} className="text-red-400 hover:text-red-300 text-xs px-1">✕</button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="bg-white/5 rounded-lg p-3 space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <select value={newQuestion.type} onChange={e => setNewQuestion(p => ({ ...p, type: e.target.value }))}
                      className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs">
                      {Object.entries(QUESTION_TYPE_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                    <input value={newQuestion.text} onChange={e => setNewQuestion(p => ({ ...p, text: e.target.value }))}
                      className="col-span-2 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs"
                      placeholder="טקסט השאלה" />
                  </div>
                  {(newQuestion.type === 'multiple_choice' || newQuestion.type === 'single_choice') && (
                    <input value={newQuestion.options} onChange={e => setNewQuestion(p => ({ ...p, options: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs"
                      placeholder="אפשרויות (מופרדות בפסיק): אפשרות 1, אפשרות 2, אפשרות 3" />
                  )}
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs text-white/60">
                      <input type="checkbox" checked={newQuestion.required} onChange={e => setNewQuestion(p => ({ ...p, required: e.target.checked }))}
                        className="rounded" />
                      שאלת חובה
                    </label>
                    <button onClick={addQuestion} className="px-3 py-1 bg-blue-600 text-white rounded text-xs">+ הוסף שאלה</button>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setShowCreate(false)} className="px-5 py-2 bg-white/10 text-white rounded-lg text-sm">ביטול</button>
              <button onClick={handleCreate} className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium">צור סקר</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
