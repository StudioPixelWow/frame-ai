'use client';

import { useState } from 'react';

const TYPES = [
  { value: 'social', label: 'סושיאל' },
  { value: 'website', label: 'אתר' },
  { value: 'campaign', label: 'קמפיין' },
  { value: 'design', label: 'עיצוב גרפי' },
  { value: 'video', label: 'וידאו' },
  { value: 'content', label: 'תוכן' },
  { value: 'other', label: 'אחר' },
];

export default function PortalTaskRequest({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('social');
  const [desc, setDesc] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [files, setFiles] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');

  const reset = () => { setTitle(''); setType('social'); setDesc(''); setDueDate(''); setFiles([]); setMsg(''); };

  const addFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setMsg('');
    try {
      const sign = await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: file.name, contentType: file.type, fileSize: file.size }) });
      const s = await sign.json().catch(() => ({}));
      if (!sign.ok || !s.uploadUrl) throw new Error(s.error || `שרת ההעלאה החזיר שגיאה (${sign.status})`);
      const put = await fetch(s.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
      if (!put.ok) throw new Error(`העלאת הקובץ נכשלה (${put.status})`);
      setFiles((f) => [...f, `${file.name}|${s.publicUrl}`]);
    } catch (err) {
      setMsg(`⚠️ ${err instanceof Error ? err.message : 'שגיאה בהעלאת הקובץ'} — אפשר לשלוח את הבקשה גם בלי הקובץ ולצרף אותו בהמשך.`);
    } finally { setUploading(false); e.target.value = ''; }
  };

  const send = async () => {
    if (!title.trim()) { setMsg('הזן כותרת למשימה'); return; }
    setSending(true); setMsg('');
    try {
      const res = await fetch('/api/portal/task-request', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-app-role': 'client', 'x-app-client-id': clientId },
        body: JSON.stringify({ clientId, title: title.trim(), type, description: desc, files, dueDate }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'שגיאה');
      setMsg('✅ הבקשה נשלחה! המנהל קיבל התראה והמשימה נוספה ללוח.');
      setTimeout(() => { setOpen(false); reset(); }, 1600);
    } catch (e) { setMsg(e instanceof Error ? e.message : 'שגיאה'); } finally { setSending(false); }
  };

  const lbl: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: 'var(--foreground-muted,#6b7280)', display: 'block', marginBottom: 5 };

  return (
    <>
      <button onClick={() => setOpen(true)}
        style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#00B5FE,#0066FF)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', marginBottom: '1rem', boxShadow: '0 4px 14px rgba(0,102,255,0.25)' }}>
        📋 הגש משימה לביצוע
      </button>

      {open && (
        <div onClick={() => !sending && setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} dir="rtl" style={{ background: 'var(--surface,#fff)', borderRadius: 18, padding: '1.5rem', maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>📋 הגשת משימה לביצוע</h2>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888' }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={lbl}>כותרת המשימה *</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="למשל: פוסט להשקת מבצע" style={inp} /></div>
              <div><label style={lbl}>סוג משימה</label>
                <select value={type} onChange={(e) => setType(e.target.value)} style={inp}>
                  {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div><label style={lbl}>תיאור המשימה</label><textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} placeholder="פרט מה תרצה שנכין…" style={{ ...inp, resize: 'vertical' }} /></div>
              <div><label style={lbl}>תאריך הגשה רצוי</label><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} dir="ltr" style={inp} /></div>
              <div>
                <label style={lbl}>קבצים מצורפים</label>
                <input type="file" onChange={addFile} disabled={uploading} style={{ fontSize: 13 }} />
                {uploading && <div style={{ fontSize: 12, color: '#0066FF', marginTop: 4 }}>⏳ מעלה…</div>}
                {files.length > 0 && (
                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {files.map((f, i) => <div key={i} style={{ fontSize: 12, color: '#16a34a' }}>✓ {f.split('|')[0]}</div>)}
                  </div>
                )}
              </div>

              {msg && <div style={{ fontSize: 13, fontWeight: 600, color: msg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{msg}</div>}

              <button onClick={send} disabled={sending || uploading}
                style={{ padding: '0.8rem', borderRadius: 12, border: 'none', background: '#10b981', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', opacity: sending || uploading ? 0.6 : 1 }}>
                {sending ? '⏳ שולח…' : '📤 שלח משימה'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const inp: React.CSSProperties = { width: '100%', padding: '0.6rem 0.75rem', borderRadius: 10, border: '1px solid var(--border,#e5e7eb)', background: 'var(--surface-raised,#fafafa)', color: 'var(--foreground,#111)', fontSize: 14, boxSizing: 'border-box' };
