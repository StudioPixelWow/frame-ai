'use client';

import { useState, useEffect, useCallback } from 'react';

const POST_TYPE_LABELS: Record<string, string> = {
  text: 'טקסט',
  article: 'מאמר',
  carousel: 'קרוסלה',
  video: 'וידאו',
  poll: 'סקר',
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: 'טיוטה', color: 'bg-gray-500/20 text-gray-300' },
  scheduled: { label: 'מתוזמן', color: 'bg-blue-500/20 text-blue-300' },
  published: { label: 'פורסם', color: 'bg-green-500/20 text-green-300' },
  failed: { label: 'נכשל', color: 'bg-red-500/20 text-red-300' },
  pending_approval: { label: 'ממתין לאישור', color: 'bg-orange-500/20 text-orange-300' },
};

const LANGUAGE_LABELS: Record<string, string> = {
  he: 'עברית',
  en: 'אנגלית',
  bilingual: 'דו-לשוני',
};

export default function LinkedInPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [form, setForm] = useState({
    clientId: '',
    contentHebrew: '',
    contentEnglish: '',
    language: 'he' as 'he' | 'en' | 'bilingual',
    postType: 'text',
    industry: '',
    targetAudience: '',
    scheduledAt: '',
  });

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/linkedin?${params}`);
      if (res.ok) setPosts(await res.json());
    } catch {}
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.clientId || (!form.contentHebrew && !form.contentEnglish)) return;
    try {
      const res = await fetch('/api/linkedin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          scheduledAt: form.scheduledAt || null,
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        setForm({ clientId: '', contentHebrew: '', contentEnglish: '', language: 'he', postType: 'text', industry: '', targetAudience: '', scheduledAt: '' });
        load();
      }
    } catch {}
  };

  const totalImpressions = posts.reduce((sum, p) => sum + (p.impressions || 0), 0);
  const totalReactions = posts.reduce((sum, p) => sum + (p.reactions || 0), 0);
  const publishedCount = posts.filter(p => p.status === 'published').length;
  const draftCount = posts.filter(p => p.status === 'draft').length;

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">לינקדאין</h1>
          <p className="text-sm text-white/50 mt-1">ניהול תוכן ואסטרטגיה ללינקדאין</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + פוסט חדש
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="text-sm text-white/50">סה&quot;כ פוסטים</div>
          <div className="text-2xl font-bold text-white mt-1">{posts.length}</div>
        </div>
        <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/20">
          <div className="text-sm text-green-300/70">פורסמו</div>
          <div className="text-2xl font-bold text-green-300 mt-1">{publishedCount}</div>
        </div>
        <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
          <div className="text-sm text-blue-300/70">חשיפות</div>
          <div className="text-2xl font-bold text-blue-300 mt-1">{totalImpressions.toLocaleString()}</div>
        </div>
        <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/20">
          <div className="text-sm text-purple-300/70">תגובות</div>
          <div className="text-2xl font-bold text-purple-300 mt-1">{totalReactions.toLocaleString()}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {[
          { val: '', label: 'הכל' },
          { val: 'draft', label: 'טיוטות' },
          { val: 'scheduled', label: 'מתוזמנים' },
          { val: 'published', label: 'פורסמו' },
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

      {/* Info Banner */}
      <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20 mb-8">
        <h3 className="text-sm font-medium text-blue-300 mb-1">💡 מצב מקומי — תכנון בלבד</h3>
        <p className="text-xs text-white/50">
          פוסטים נשמרים כטיוטות לתכנון ותזמון. פרסום בלינקדאין דורש חיבור LinkedIn API —
          הגדר את מפתחות ה-API בהגדרות לפרסום אוטומטי.
        </p>
      </div>

      {/* Post List */}
      {loading ? (
        <div className="text-center text-white/40 py-20">טוען פוסטים...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-4xl mb-4">💼</div>
          <p className="text-white/50">{statusFilter ? 'אין פוסטים בסטטוס זה' : 'אין פוסטים בלינקדאין'}</p>
          <button onClick={() => setShowCreate(true)} className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg text-sm">
            צור פוסט ראשון
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post: any) => {
            const sInfo = STATUS_MAP[post.status] || STATUS_MAP.draft;
            const content = post.language === 'en' ? post.contentEnglish : post.contentHebrew;
            return (
              <div key={post.id} className="bg-white/5 rounded-xl p-5 border border-white/10 hover:border-white/20 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${sInfo.color}`}>{sInfo.label}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-white/60">
                        {POST_TYPE_LABELS[post.postType] || post.postType}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-white/60">
                        {LANGUAGE_LABELS[post.language] || post.language}
                      </span>
                    </div>
                    <p className="text-sm text-white/80 line-clamp-2">{content || '(אין תוכן)'}</p>
                    {post.industry && (
                      <p className="text-xs text-white/40 mt-1">תעשייה: {post.industry}</p>
                    )}
                    {post.targetAudience && (
                      <p className="text-xs text-white/40">קהל יעד: {post.targetAudience}</p>
                    )}
                    {post.scheduledAt && (
                      <p className="text-xs text-white/40 mt-1">
                        תזמון: {new Date(post.scheduledAt).toLocaleString('he-IL')}
                      </p>
                    )}
                  </div>
                  {post.status === 'published' && (
                    <div className="flex gap-4 text-center flex-shrink-0">
                      <div>
                        <div className="text-lg font-bold text-white">{(post.impressions || 0).toLocaleString()}</div>
                        <div className="text-xs text-white/40">חשיפות</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-white">{post.reactions || 0}</div>
                        <div className="text-xs text-white/40">תגובות</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-white">{post.comments || 0}</div>
                        <div className="text-xs text-white/40">תגובות</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-white">{post.shares || 0}</div>
                        <div className="text-xs text-white/40">שיתופים</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1f2e] rounded-2xl p-6 w-full max-w-lg border border-white/10 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-6">פוסט לינקדאין חדש</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-white/60 block mb-1">מזהה לקוח</label>
                <input value={form.clientId} onChange={e => setForm(p => ({ ...p, clientId: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" placeholder="מזהה לקוח" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-white/60 block mb-1">שפה</label>
                  <select value={form.language} onChange={e => setForm(p => ({ ...p, language: e.target.value as any }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                    <option value="he">עברית</option>
                    <option value="en">אנגלית</option>
                    <option value="bilingual">דו-לשוני</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-white/60 block mb-1">סוג פוסט</label>
                  <select value={form.postType} onChange={e => setForm(p => ({ ...p, postType: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                    {Object.entries(POST_TYPE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              {(form.language === 'he' || form.language === 'bilingual') && (
                <div>
                  <label className="text-sm text-white/60 block mb-1">תוכן בעברית</label>
                  <textarea value={form.contentHebrew} onChange={e => setForm(p => ({ ...p, contentHebrew: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm h-28 resize-none"
                    placeholder="כתוב את תוכן הפוסט בעברית..." />
                </div>
              )}
              {(form.language === 'en' || form.language === 'bilingual') && (
                <div>
                  <label className="text-sm text-white/60 block mb-1">תוכן באנגלית</label>
                  <textarea value={form.contentEnglish} onChange={e => setForm(p => ({ ...p, contentEnglish: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm h-28 resize-none"
                    placeholder="Write the post content in English..." dir="ltr" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-white/60 block mb-1">תעשייה</label>
                  <input value={form.industry} onChange={e => setForm(p => ({ ...p, industry: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" placeholder="למשל: טכנולוגיה, שיווק" />
                </div>
                <div>
                  <label className="text-sm text-white/60 block mb-1">קהל יעד</label>
                  <input value={form.targetAudience} onChange={e => setForm(p => ({ ...p, targetAudience: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" placeholder="למשל: מנהלי שיווק" />
                </div>
              </div>
              <div>
                <label className="text-sm text-white/60 block mb-1">תזמון (אופציונלי)</label>
                <input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(p => ({ ...p, scheduledAt: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setShowCreate(false)} className="px-5 py-2 bg-white/10 text-white rounded-lg text-sm">ביטול</button>
              <button onClick={handleCreate} className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium">צור פוסט</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
