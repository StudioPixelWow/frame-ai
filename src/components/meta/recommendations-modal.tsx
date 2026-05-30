'use client';

import { useState, useEffect, useCallback } from 'react';

const BRAND = '#00B5FE';
const sevColor: Record<string, string> = { high: '#ef4444', medium: '#f97316', low: '#6b7280' };
const sevLabel: Record<string, string> = { high: 'דחוף', medium: 'מומלץ', low: 'אופציונלי' };

interface Reco {
  id: string; severity: 'high' | 'medium' | 'low';
  category?: 'audience' | 'creative' | 'budget' | 'ab_test';
  title: string; reason: string; expectedImpact: string;
  apply: { kind: string; objectName: string };
}

const CAT_LABEL: Record<string, string> = { audience: '🎯 קהל', creative: '🎨 קריאייטיב', budget: '💰 תקציב', ab_test: '🧪 בדיקת A/B' };

/**
 * Modal listing optimization recommendations. Each has an "אשר ובצע" button that
 * applies the action on Meta automatically.
 */
export default function RecommendationsModal({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const [recos, setRecos] = useState<Reco[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/meta-business/recommendations?clientId=${encodeURIComponent(clientId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה');
      setRecos(data.recommendations || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה');
    } finally { setLoading(false); }
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const apply = async (r: Reco) => {
    setBusyId(r.id);
    try {
      const res = await fetch('/api/meta-business/recommendations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, action: r.apply }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.error || 'הפעולה נכשלה');
      setDoneIds((prev) => new Set(prev).add(r.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'הפעולה נכשלה');
    } finally { setBusyId(null); }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div dir="rtl" onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: 'min(680px, 92vw)', maxHeight: '85vh', overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>המלצות לייעול הקמפיינים</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer', color: '#6b7280' }}>×</button>
        </div>
        <p style={{ color: '#6b7280', fontSize: 13, marginTop: 0 }}>המלצות להגדלת לידים — הרחבת קהלים, רענון קריאייטיב, הסטת תקציב ובדיקות A/B. לחיצה על &quot;אשר ובצע&quot; יוצרת/מעדכנת ב-Meta (פריטים חדשים נוצרים מושהים).</p>

        {loading ? <div style={{ color: '#6b7280', padding: 16 }}>מנתח קמפיינים...</div>
          : error ? <div style={{ color: '#ef4444', padding: 12, background: 'rgba(239,68,68,0.08)', borderRadius: 8 }}>{error}</div>
          : recos.length === 0 ? <div style={{ color: '#16a34a', padding: 16 }}>✅ לא נמצאו בעיות — הקמפיינים נראים תקינים בטווח הנוכחי.</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recos.map((r) => {
                const done = doneIds.has(r.id);
                return (
                  <div key={r.id} style={{ border: '1px solid #e5e7eb', borderRight: `4px solid ${sevColor[r.severity]}`, borderRadius: 8, padding: 14, opacity: done ? 0.6 : 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{r.category ? `${CAT_LABEL[r.category]} · ` : ''}{r.title}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: sevColor[r.severity] }}>{sevLabel[r.severity]}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: '#4b5563', marginTop: 4 }}>{r.reason}</div>
                    <div style={{ fontSize: 12.5, color: '#16a34a', marginTop: 2 }}>💡 {r.expectedImpact}</div>
                    <div style={{ marginTop: 10 }}>
                      {done ? (
                        <span style={{ color: '#16a34a', fontWeight: 700, fontSize: 13 }}>✅ בוצע</span>
                      ) : (
                        <button onClick={() => apply(r)} disabled={busyId === r.id}
                          style={{ background: BRAND, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: busyId === r.id ? 0.6 : 1 }}>
                          {busyId === r.id ? 'מבצע...' : '✓ אשר ובצע'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </div>
    </div>
  );
}
