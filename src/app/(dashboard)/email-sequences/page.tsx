'use client';

import { useState, useEffect, useCallback } from 'react';

const TRIGGER_LABELS: Record<string, string> = {
  new_lead: 'ליד חדש',
  new_client: 'לקוח חדש',
  payment_received: 'תשלום התקבל',
  invoice_sent: 'חשבונית נשלחה',
  manual: 'ידני',
  form_submit: 'מילוי טופס',
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: 'טיוטה', color: 'bg-gray-500/20 text-gray-300' },
  active: { label: 'פעילה', color: 'bg-green-500/20 text-green-300' },
  paused: { label: 'מושהית', color: 'bg-orange-500/20 text-orange-300' },
  completed: { label: 'הושלמה', color: 'bg-blue-500/20 text-blue-300' },
};

export default function EmailSequencesPage() {
  const [sequences, setSequences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', trigger: 'new_lead',
    senderName: '', senderEmail: '', unsubscribeUrl: '',
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/email-sequences');
      if (res.ok) setSequences(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.name) return;
    try {
      await fetch('/api/email-sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setShowCreate(false);
      setForm({ name: '', description: '', trigger: 'new_lead', senderName: '', senderEmail: '', unsubscribeUrl: '' });
      load();
    } catch {}
  };

  const totalSubscribers = sequences.reduce((sum, s) => sum + (s.totalSubscribers || 0), 0);
  const totalSent = sequences.reduce((sum, s) => sum + (s.totalSent || 0), 0);
  const activeCount = sequences.filter(s => s.status === 'active').length;

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">סדרות מיילים</h1>
          <p className="text-sm text-white/50 mt-1">אוטומציית דיוור — תואם תיקון 40</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + סדרה חדשה
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="text-sm text-white/50">סדרות פעילות</div>
          <div className="text-2xl font-bold text-white mt-1">{activeCount}</div>
        </div>
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="text-sm text-white/50">סה&quot;כ סדרות</div>
          <div className="text-2xl font-bold text-white mt-1">{sequences.length}</div>
        </div>
        <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
          <div className="text-sm text-blue-300/70">מיילים נשלחו</div>
          <div className="text-2xl font-bold text-blue-300 mt-1">{totalSent.toLocaleString()}</div>
        </div>
        <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/20">
          <div className="text-sm text-green-300/70">נרשמים</div>
          <div className="text-2xl font-bold text-green-300 mt-1">{totalSubscribers.toLocaleString()}</div>
        </div>
      </div>

      {/* תיקון 40 Info */}
      <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/20 mb-8">
        <h3 className="text-sm font-medium text-amber-300 mb-1">📋 תיקון 40 — חוק הספאם הישראלי</h3>
        <p className="text-xs text-white/50">
          כל סדרת מיילים חייבת לכלול: קישור הסרה, שם השולח, כתובת מייל חוזרת.
          הסרה מיידית מרגע הבקשה. שליחה רק למי שנתן הסכמה מפורשת.
        </p>
      </div>

      {/* Sequence List */}
      {loading ? (
        <div className="text-center text-white/40 py-20">טוען סדרות...</div>
      ) : sequences.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-4xl mb-4">📧</div>
          <p className="text-white/50">אין סדרות מיילים</p>
          <button onClick={() => setShowCreate(true)} className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg text-sm">
            צור סדרה ראשונה
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sequences.map((seq: any) => {
            const sInfo = STATUS_MAP[seq.status] || STATUS_MAP.draft;
            return (
              <div key={seq.id} className="bg-white/5 rounded-xl p-5 border border-white/10 hover:border-white/20 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-medium text-white">{seq.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${sInfo.color}`}>{sInfo.label}</span>
                      {!seq.tikun40Compliant && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-300">⚠️ לא תואם תיקון 40</span>
                      )}
                    </div>
                    <div className="text-sm text-white/50">
                      טריגר: {TRIGGER_LABELS[seq.trigger] || seq.trigger}
                      {seq.steps?.length > 0 && ` · ${seq.steps.length} שלבים`}
                    </div>
                    {seq.description && <p className="text-xs text-white/40 mt-1">{seq.description}</p>}
                  </div>
                  <div className="flex gap-6 text-center">
                    <div>
                      <div className="text-lg font-bold text-white">{seq.totalSubscribers || 0}</div>
                      <div className="text-xs text-white/40">נרשמים</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-white">{seq.totalSent || 0}</div>
                      <div className="text-xs text-white/40">נשלחו</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-green-400">
                        {seq.totalSent > 0 ? Math.round((seq.totalOpened / seq.totalSent) * 100) : 0}%
                      </div>
                      <div className="text-xs text-white/40">פתיחה</div>
                    </div>
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
          <div className="bg-[#1a1f2e] rounded-2xl p-6 w-full max-w-lg border border-white/10">
            <h2 className="text-xl font-bold text-white mb-6">סדרת מיילים חדשה</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-white/60 block mb-1">שם הסדרה</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" placeholder="למשל: ברוכים הבאים ללקוחות חדשים" />
              </div>
              <div>
                <label className="text-sm text-white/60 block mb-1">תיאור</label>
                <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" placeholder="תיאור קצר" />
              </div>
              <div>
                <label className="text-sm text-white/60 block mb-1">טריגר הפעלה</label>
                <select value={form.trigger} onChange={e => setForm(p => ({ ...p, trigger: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                  {Object.entries(TRIGGER_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="border-t border-white/10 pt-4">
                <h4 className="text-sm font-medium text-white/70 mb-3">תאימות תיקון 40</h4>
                <div className="space-y-3">
                  <input value={form.senderName} onChange={e => setForm(p => ({ ...p, senderName: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" placeholder="שם השולח" />
                  <input value={form.senderEmail} onChange={e => setForm(p => ({ ...p, senderEmail: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" placeholder="מייל השולח" />
                  <input value={form.unsubscribeUrl} onChange={e => setForm(p => ({ ...p, unsubscribeUrl: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" placeholder="קישור הסרה מרשימה" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setShowCreate(false)} className="px-5 py-2 bg-white/10 text-white rounded-lg text-sm">ביטול</button>
              <button onClick={handleCreate} className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium">צור סדרה</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
