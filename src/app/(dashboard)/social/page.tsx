'use client';

import { useState, useEffect, useCallback } from 'react';

const PLATFORMS = [
  { id: 'facebook', label: 'פייסבוק', icon: '📘' },
  { id: 'instagram', label: 'אינסטגרם', icon: '📸' },
  { id: 'tiktok', label: 'טיקטוק', icon: '🎵' },
  { id: 'linkedin', label: 'לינקדאין', icon: '💼' },
  { id: 'twitter', label: 'טוויטר / X', icon: '🐦' },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: 'טיוטה', color: 'bg-gray-500/20 text-gray-300' },
  scheduled: { label: 'מתוזמן', color: 'bg-blue-500/20 text-blue-300' },
  published: { label: 'פורסם', color: 'bg-green-500/20 text-green-300' },
  failed: { label: 'נכשל', color: 'bg-red-500/20 text-red-300' },
  pending_approval: { label: 'ממתין לאישור', color: 'bg-orange-500/20 text-orange-300' },
};

const ISRAELI_BEST_TIMES = [
  { platform: 'כל הפלטפורמות', times: 'ראשון-חמישי 09:00, 12:00, 18:00, 20:00' },
  { platform: 'אינסטגרם', times: '08:00, 12:00, 17:00, 21:00' },
  { platform: 'טיקטוק', times: '12:00, 18:00, 21:00-22:00 (כולל שישי)' },
  { platform: 'לינקדאין', times: '08:00, 10:00, 12:00, 17:00 (B2B)' },
];

export default function SocialDashboard() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [platformFilter, setPlatformFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    clientId: '', clientName: '', platform: 'instagram',
    content: '', hashtags: '', scheduledAt: '',
  });

  const loadPosts = useCallback(async () => {
    try {
      const url = platformFilter === 'all' ? '/api/social' : `/api/social?platform=${platformFilter}`;
      const res = await fetch(url);
      if (res.ok) setPosts(await res.json());
    } catch {}
    setLoading(false);
  }, [platformFilter]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const handleCreate = async () => {
    if (!form.content || !form.clientName) return;
    try {
      await fetch('/api/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          hashtags: form.hashtags.split(',').map(h => h.trim()).filter(Boolean),
          scheduledAt: form.scheduledAt || undefined,
        }),
      });
      setShowCreate(false);
      setForm({ clientId: '', clientName: '', platform: 'instagram', content: '', hashtags: '', scheduledAt: '' });
      loadPosts();
    } catch {}
  };

  // Platform stats
  const platformStats = PLATFORMS.map(p => ({
    ...p,
    count: posts.filter(post => post.platform === p.id).length,
    published: posts.filter(post => post.platform === p.id && post.status === 'published').length,
  }));

  // Calendar — group posts by date
  const postsByDate: Record<string, any[]> = {};
  posts.forEach(post => {
    const date = (post.scheduledAt || post.createdAt || '').split('T')[0];
    if (date) {
      if (!postsByDate[date]) postsByDate[date] = [];
      postsByDate[date].push(post);
    }
  });

  const sortedDates = Object.keys(postsByDate).sort((a, b) => b.localeCompare(a));

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">ניהול רשתות חברתיות</h1>
          <p className="text-sm text-white/50 mt-1">תזמון פוסטים, ניתוח ביצועים, חיבור Postiz</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + פוסט חדש
        </button>
      </div>

      {/* Platform Stats */}
      <div className="grid grid-cols-5 gap-3 mb-8">
        {platformStats.map(p => (
          <button
            key={p.id}
            onClick={() => setPlatformFilter(platformFilter === p.id ? 'all' : p.id)}
            className={`bg-white/5 rounded-xl p-4 border transition-colors text-center ${
              platformFilter === p.id ? 'border-blue-500/50 bg-blue-500/10' : 'border-white/10 hover:border-white/20'
            }`}
          >
            <div className="text-2xl mb-1">{p.icon}</div>
            <div className="text-sm font-medium text-white">{p.label}</div>
            <div className="text-xs text-white/50 mt-1">{p.count} פוסטים · {p.published} פורסמו</div>
          </button>
        ))}
      </div>

      {/* Israeli Posting Tips */}
      <div className="bg-gradient-to-l from-blue-500/10 to-cyan-500/10 rounded-xl p-4 border border-blue-500/20 mb-8">
        <h3 className="text-sm font-medium text-blue-300 mb-2">🇮🇱 זמני פרסום מומלצים לקהל ישראלי</h3>
        <div className="grid grid-cols-2 gap-2">
          {ISRAELI_BEST_TIMES.map((tip, i) => (
            <div key={i} className="text-xs text-white/60">
              <span className="text-white/80 font-medium">{tip.platform}:</span> {tip.times}
            </div>
          ))}
        </div>
      </div>

      {/* Posts Timeline */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">ציר זמן פוסטים</h2>
        <div className="text-sm text-white/40">{posts.length} פוסטים</div>
      </div>

      {loading ? (
        <div className="text-center text-white/40 py-20">טוען פוסטים...</div>
      ) : sortedDates.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-4xl mb-4">📱</div>
          <p className="text-white/50">אין פוסטים מתוזמנים</p>
          <button onClick={() => setShowCreate(true)} className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg text-sm">
            צור פוסט ראשון
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map(date => (
            <div key={date}>
              <div className="text-sm font-medium text-white/60 mb-3">
                {new Date(date).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
              <div className="space-y-2">
                {postsByDate[date].map((post: any) => {
                  const pInfo = PLATFORMS.find(p => p.id === post.platform);
                  const sInfo = STATUS_MAP[post.status] || STATUS_MAP.draft;
                  return (
                    <div key={post.id} className="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-white/20 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <span className="text-xl">{pInfo?.icon || '📱'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-white">{post.clientName || 'לקוח'}</span>
                              <span className="text-xs text-white/40">{pInfo?.label}</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs ${sInfo.color}`}>{sInfo.label}</span>
                            </div>
                            <p className="text-sm text-white/70 line-clamp-2">{post.content}</p>
                            {post.hashtags?.length > 0 && (
                              <div className="flex gap-1 mt-1 flex-wrap">
                                {post.hashtags.slice(0, 5).map((h: string, i: number) => (
                                  <span key={i} className="text-xs text-blue-400/70">{h.startsWith('#') ? h : `#${h}`}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-left text-xs text-white/40">
                          {post.scheduledAt && new Date(post.scheduledAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      {post.status === 'published' && (post.likes > 0 || post.comments > 0) && (
                        <div className="flex gap-4 mt-3 pt-3 border-t border-white/5 text-xs text-white/40">
                          <span>❤️ {post.likes}</span>
                          <span>💬 {post.comments}</span>
                          <span>🔄 {post.shares}</span>
                          <span>👁 {post.reach}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1f2e] rounded-2xl p-6 w-full max-w-lg border border-white/10">
            <h2 className="text-xl font-bold text-white mb-6">פוסט חדש</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-white/60 block mb-1">שם לקוח</label>
                <input
                  value={form.clientName}
                  onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="שם הלקוח"
                />
              </div>
              <div>
                <label className="text-sm text-white/60 block mb-1">פלטפורמה</label>
                <div className="flex gap-2">
                  {PLATFORMS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setForm(prev => ({ ...prev, platform: p.id }))}
                      className={`flex-1 py-2 rounded-lg text-center text-sm transition-colors ${
                        form.platform === p.id ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/60'
                      }`}
                    >
                      {p.icon}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm text-white/60 block mb-1">תוכן</label>
                <textarea
                  value={form.content}
                  onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm h-28 resize-none"
                  placeholder="כתוב את הפוסט כאן..."
                />
                <div className="text-xs text-white/30 mt-1">{form.content.length} תווים</div>
              </div>
              <div>
                <label className="text-sm text-white/60 block mb-1">האשטגים (מופרד בפסיקים)</label>
                <input
                  value={form.hashtags}
                  onChange={e => setForm(p => ({ ...p, hashtags: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="#שיווק, #עסקים"
                />
              </div>
              <div>
                <label className="text-sm text-white/60 block mb-1">תזמון (אופציונלי)</label>
                <input
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={e => setForm(p => ({ ...p, scheduledAt: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setShowCreate(false)} className="px-5 py-2 bg-white/10 text-white rounded-lg text-sm">ביטול</button>
              <button onClick={handleCreate} className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium">
                {form.scheduledAt ? 'תזמן פוסט' : 'שמור כטיוטה'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
