'use client';

import { useState, useEffect, useCallback } from 'react';

const DOC_TYPE_LABELS: Record<number, string> = {
  10: 'הצעת מחיר',
  20: 'הזמנה',
  30: 'תעודת משלוח',
  100: 'חשבונית עסקה',
  200: 'חשבונית מס',
  210: 'חשבונית מס/קבלה',
  300: 'קבלה',
  400: 'חשבון עסקה',
  405: 'חשבונית ביטול',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'טיוטה', color: 'bg-gray-500/20 text-gray-300' },
  issued: { label: 'הופקה', color: 'bg-blue-500/20 text-blue-300' },
  paid: { label: 'שולמה', color: 'bg-green-500/20 text-green-300' },
  cancelled: { label: 'בוטלה', color: 'bg-red-500/20 text-red-300' },
  overdue: { label: 'חורגת', color: 'bg-orange-500/20 text-orange-300' },
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'מזומן',
  cheque: 'צ\'ק',
  bank_transfer: 'העברה בנקאית',
  credit_card: 'כרטיס אשראי',
  bit: 'ביט',
  paybox: 'פייבוקס',
  other: 'אחר',
};

export default function InvoicingPage() {
  const [invoicesList, setInvoicesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Create form state
  const [form, setForm] = useState({
    clientId: '',
    clientName: '',
    docType: 210,
    description: '',
    remarks: '',
    paymentMethod: 'bank_transfer',
    items: [{ description: '', quantity: 1, unitPrice: 0, vatType: 1 as 0 | 1 }],
  });

  // Settings form
  const [settingsForm, setSettingsForm] = useState({
    apiId: '',
    apiSecret: '',
    sandbox: true,
    businessName: '',
    businessTaxId: '',
    autoIssueOnPayment: false,
  });

  const loadInvoices = useCallback(async () => {
    try {
      const res = await fetch('/api/invoicing');
      if (res.ok) {
        const data = await res.json();
        setInvoicesList(data);
      }
    } catch { }
    setLoading(false);
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/invoicing/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        if (data) {
          setSettingsForm(prev => ({
            ...prev,
            apiId: data.apiId || '',
            apiSecret: '',
            sandbox: data.sandbox ?? true,
            businessName: data.businessName || '',
            businessTaxId: data.businessTaxId || '',
            autoIssueOnPayment: data.autoIssueOnPayment || false,
          }));
        }
      }
    } catch { }
  }, []);

  useEffect(() => {
    loadInvoices();
    loadSettings();
  }, [loadInvoices, loadSettings]);

  const handleCreateInvoice = async () => {
    if (!form.clientName || form.items.some(i => !i.description || i.unitPrice <= 0)) return;

    try {
      const res = await fetch('/api/invoicing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowCreate(false);
        setForm({
          clientId: '', clientName: '', docType: 210, description: '', remarks: '',
          paymentMethod: 'bank_transfer',
          items: [{ description: '', quantity: 1, unitPrice: 0, vatType: 1 }],
        });
        loadInvoices();
      }
    } catch { }
  };

  const handleIssue = async (invoiceId: string) => {
    try {
      const res = await fetch('/api/invoicing/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId }),
      });
      const data = await res.json();
      if (data.success) {
        loadInvoices();
      } else {
        alert(data.error || 'שגיאה בהפקת חשבונית');
        if (data.setupRequired) setShowSettings(true);
      }
    } catch { }
  };

  const handleSaveSettings = async () => {
    try {
      const res = await fetch('/api/invoicing/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsForm),
      });
      const data = await res.json();
      if (data.success) {
        setShowSettings(false);
        loadSettings();
      } else {
        alert(data.error || 'שגיאה בשמירת הגדרות');
      }
    } catch { }
  };

  const filtered = filter === 'all'
    ? invoicesList
    : invoicesList.filter(inv => inv.status === filter);

  const totalRevenue = invoicesList
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + (inv.total || 0), 0);

  const totalPending = invoicesList
    .filter(inv => inv.status === 'issued' || inv.status === 'draft')
    .reduce((sum, inv) => sum + (inv.total || 0), 0);

  const addItem = () => setForm(prev => ({
    ...prev,
    items: [...prev.items, { description: '', quantity: 1, unitPrice: 0, vatType: 1 as 0 | 1 }],
  }));

  const updateItem = (idx: number, field: string, value: any) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === idx ? { ...item, [field]: value } : item),
    }));
  };

  const removeItem = (idx: number) => {
    if (form.items.length <= 1) return;
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  };

  const subtotal = form.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const vatAmount = form.items.reduce((sum, item) =>
    sum + (item.vatType === 1 ? item.unitPrice * item.quantity * 0.18 : 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">חשבוניות</h1>
          <p className="text-sm text-white/50 mt-1">ניהול חשבוניות — חיבור ל-Green Invoice (חשבונית ירוקה)</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowSettings(true)}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg text-sm transition-colors"
          >
            ⚙️ הגדרות Green Invoice
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            + חשבונית חדשה
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="text-sm text-white/50">סה&quot;כ חשבוניות</div>
          <div className="text-2xl font-bold text-white mt-1">{invoicesList.length}</div>
        </div>
        <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/20">
          <div className="text-sm text-green-300/70">הכנסות שנגבו</div>
          <div className="text-2xl font-bold text-green-300 mt-1">₪{totalRevenue.toLocaleString()}</div>
        </div>
        <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
          <div className="text-sm text-blue-300/70">ממתין לגבייה</div>
          <div className="text-2xl font-bold text-blue-300 mt-1">₪{totalPending.toLocaleString()}</div>
        </div>
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="text-sm text-white/50">חיבור Green Invoice</div>
          <div className="text-lg font-medium mt-1">
            {settings?.connected ? (
              <span className="text-green-400">✓ מחובר</span>
            ) : (
              <span className="text-orange-400">לא מחובר</span>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {['all', 'draft', 'issued', 'paid', 'cancelled', 'overdue'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm transition-colors ${filter === f
              ? 'bg-blue-600 text-white'
              : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            {f === 'all' ? 'הכל' : STATUS_LABELS[f]?.label || f}
          </button>
        ))}
      </div>

      {/* Invoice List */}
      {loading ? (
        <div className="text-center text-white/40 py-20">טוען חשבוניות...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-4xl mb-4">📄</div>
          <p className="text-white/50">אין חשבוניות עדיין</p>
          <button onClick={() => setShowCreate(true)} className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm">
            צור חשבונית ראשונה
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((inv: any) => (
            <div key={inv.id} className="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-white/20 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <div className="font-medium text-white">{inv.clientName}</div>
                    <div className="text-sm text-white/50">
                      {DOC_TYPE_LABELS[inv.docType] || 'חשבונית'}
                      {inv.greenInvoiceNumber && ` #${inv.greenInvoiceNumber}`}
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs ${STATUS_LABELS[inv.status]?.color || 'bg-gray-500/20 text-gray-300'}`}>
                    {STATUS_LABELS[inv.status]?.label || inv.status}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-left">
                    <div className="text-lg font-bold text-white">₪{(inv.total || 0).toLocaleString()}</div>
                    <div className="text-xs text-white/40">
                      {inv.paymentMethod && PAYMENT_METHOD_LABELS[inv.paymentMethod]}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {inv.status === 'draft' && !inv.greenInvoiceDocId && (
                      <button
                        onClick={() => handleIssue(inv.id)}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs rounded-lg transition-colors"
                      >
                        הפק ב-Green Invoice
                      </button>
                    )}
                    {inv.greenInvoicePdfUrl && (
                      <a
                        href={inv.greenInvoicePdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg transition-colors"
                      >
                        📥 PDF
                      </a>
                    )}
                  </div>
                </div>
              </div>
              {inv.description && (
                <div className="text-sm text-white/40 mt-2">{inv.description}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1f2e] rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/10">
            <h2 className="text-xl font-bold text-white mb-6">חשבונית חדשה</h2>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-sm text-white/60 block mb-1">שם לקוח</label>
                <input
                  value={form.clientName}
                  onChange={e => setForm(prev => ({ ...prev, clientName: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="שם הלקוח"
                />
              </div>
              <div>
                <label className="text-sm text-white/60 block mb-1">סוג מסמך</label>
                <select
                  value={form.docType}
                  onChange={e => setForm(prev => ({ ...prev, docType: Number(e.target.value) }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                >
                  {Object.entries(DOC_TYPE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-sm text-white/60 block mb-1">תיאור</label>
                <input
                  value={form.description}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="תיאור כללי"
                />
              </div>
              <div>
                <label className="text-sm text-white/60 block mb-1">אמצעי תשלום</label>
                <select
                  value={form.paymentMethod}
                  onChange={e => setForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                >
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Items */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-white/60">פריטים</label>
                <button onClick={addItem} className="text-xs text-blue-400 hover:text-blue-300">+ הוסף פריט</button>
              </div>
              {form.items.map((item, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <input
                    value={item.description}
                    onChange={e => updateItem(idx, 'description', e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                    placeholder="תיאור פריט"
                  />
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={e => updateItem(idx, 'quantity', Number(e.target.value))}
                    className="w-20 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                    placeholder="כמות"
                    min={1}
                  />
                  <input
                    type="number"
                    value={item.unitPrice || ''}
                    onChange={e => updateItem(idx, 'unitPrice', Number(e.target.value))}
                    className="w-28 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                    placeholder="מחיר ₪"
                  />
                  <select
                    value={item.vatType}
                    onChange={e => updateItem(idx, 'vatType', Number(e.target.value))}
                    className="w-24 bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-white text-xs"
                  >
                    <option value={1}>+ מע&quot;מ</option>
                    <option value={0}>ללא מע&quot;מ</option>
                  </select>
                  {form.items.length > 1 && (
                    <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-300 px-2">✕</button>
                  )}
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="bg-white/5 rounded-lg p-4 mb-6 text-sm">
              <div className="flex justify-between text-white/60 mb-1">
                <span>סכום לפני מע&quot;מ</span>
                <span>₪{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-white/60 mb-1">
                <span>מע&quot;מ (18%)</span>
                <span>₪{Math.round(vatAmount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-white font-bold text-base border-t border-white/10 pt-2 mt-2">
                <span>סה&quot;כ</span>
                <span>₪{Math.round(subtotal + vatAmount).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-5 py-2 bg-white/10 text-white rounded-lg text-sm">ביטול</button>
              <button onClick={handleCreateInvoice} className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium">
                צור חשבונית
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1f2e] rounded-2xl p-6 w-full max-w-lg border border-white/10">
            <h2 className="text-xl font-bold text-white mb-6">הגדרות Green Invoice</h2>
            <p className="text-sm text-white/50 mb-4">
              חבר את חשבון Green Invoice שלך כדי להפיק חשבוניות מס אוטומטית.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-white/60 block mb-1">API ID</label>
                <input
                  value={settingsForm.apiId}
                  onChange={e => setSettingsForm(prev => ({ ...prev, apiId: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="מ-Green Invoice → הגדרות → API"
                />
              </div>
              <div>
                <label className="text-sm text-white/60 block mb-1">API Secret</label>
                <input
                  type="password"
                  value={settingsForm.apiSecret}
                  onChange={e => setSettingsForm(prev => ({ ...prev, apiSecret: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="סיסמת API"
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settingsForm.sandbox}
                  onChange={e => setSettingsForm(prev => ({ ...prev, sandbox: e.target.checked }))}
                  className="rounded"
                />
                <label className="text-sm text-white/60">מצב Sandbox (לבדיקות)</label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settingsForm.autoIssueOnPayment}
                  onChange={e => setSettingsForm(prev => ({ ...prev, autoIssueOnPayment: e.target.checked }))}
                  className="rounded"
                />
                <label className="text-sm text-white/60">הפק חשבונית אוטומטית בקבלת תשלום</label>
              </div>
            </div>

            {settings?.connected && (
              <div className="mt-4 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                <span className="text-green-400 text-sm">✓ מחובר — {settings.businessName}</span>
              </div>
            )}

            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setShowSettings(false)} className="px-5 py-2 bg-white/10 text-white rounded-lg text-sm">ביטול</button>
              <button onClick={handleSaveSettings} className="px-5 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium">
                שמור וחבר
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
