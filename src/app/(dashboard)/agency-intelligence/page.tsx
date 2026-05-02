'use client';

import { useState, useEffect } from 'react';

// ── Types ──

interface CalibrationData {
  id: string;
  idealCplPerIndustry: Record<string, number>;
  acceptableCtrRange: { min: number; max: number };
  highPerformanceThreshold: number;
  lowPerformanceThreshold: number;
  preferredCreativeStyles: string[];
  preferredHooks: string[];
  toneOfVoice: string;
  campaignStrategyPreferences: Record<string, string>;
  riskToleranceLevel: string;
  scalingRules: { condition: string; action: string; description: string }[];
  updatedAt: string;
}

interface PlaybookData {
  id: string;
  industry: string;
  name: string;
  description: string;
  painPoints: string[];
  hooks: { text: string; type: string; notes?: string }[];
  angles: string[];
  ctas: { text: string; type: string }[];
  audienceStrategy: string;
  campaignStructure: string;
  contentIdeas: string[];
  whatToAvoid: string[];
}

interface TemplateData {
  campaigns: { id: string; industry: string; name: string; objective: string; structure: string }[];
  ads: { id: string; industry: string; name: string; hookText: string; structure: string }[];
  content: { id: string; industry: string; name: string; videoIdea: string; format: string }[];
}

interface SuggestionData {
  id: string;
  industry: string;
  type: string;
  text: string;
  reason: string;
  confidence: number;
  source: string;
  status: string;
  createdAt: string;
}

// ── Constants ──

const INDUSTRY_LABELS: Record<string, string> = {
  real_estate: 'נדל"ן',
  restaurants: 'מסעדות',
  lawyers: 'עורכי דין',
  aesthetics: 'אסתטיקה',
  ecommerce: 'אי-קומרס',
  education: 'חינוך',
  fitness: 'כושר',
  saas: 'SaaS',
  general: 'כללי',
};

const HOOK_TYPE_LABELS: Record<string, string> = {
  fear: 'פחד',
  curiosity: 'סקרנות',
  social_proof: 'הוכחה חברתית',
  urgency: 'דחיפות',
  benefit: 'תועלת',
  emotion: 'רגש',
};

const CTA_TYPE_LABELS: Record<string, string> = {
  soft: 'רך',
  direct: 'ישיר',
  urgency: 'דחיפות',
  value: 'ערך',
};

const SUGGESTION_TYPE_LABELS: Record<string, string> = {
  hook: 'הוק',
  cta: 'CTA',
  angle: 'זווית',
  content_idea: 'רעיון תוכן',
  what_to_avoid: 'להימנע',
};

const RISK_LABELS: Record<string, string> = {
  conservative: 'שמרני',
  moderate: 'מאוזן',
  aggressive: 'אגרסיבי',
};

const TAB_ITEMS = [
  { id: 'calibration', label: 'כיול' },
  { id: 'playbooks', label: 'פלייבוקים' },
  { id: 'templates', label: 'תבניות' },
  { id: 'learning', label: 'למידה' },
  { id: 'performance', label: 'ביצועים' },
];

// ── Page ──

export default function AgencyIntelligencePage() {
  const [activeTab, setActiveTab] = useState('calibration');
  const [calibration, setCalibration] = useState<CalibrationData | null>(null);
  const [playbooks, setPlaybooks] = useState<PlaybookData[]>([]);
  const [templates, setTemplates] = useState<TemplateData>({ campaigns: [], ads: [], content: [] });
  const [suggestions, setSuggestions] = useState<SuggestionData[]>([]);
  const [stats, setStats] = useState({ totalPlaybooks: 0, totalCampaignTemplates: 0, totalAdTemplates: 0, totalContentTemplates: 0, pendingSuggestionsCount: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedPlaybook, setSelectedPlaybook] = useState<string | null>(null);
  const [analyzeIndustry, setAnalyzeIndustry] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const res = await fetch('/api/data/agency-intelligence');
      if (res.ok) {
        const data = await res.json();
        setCalibration(data.calibration);
        setPlaybooks(data.playbooks || []);
        setTemplates(data.templates || { campaigns: [], ads: [], content: [] });
        setSuggestions(data.pendingSuggestions || []);
        setStats(data.stats || stats);
      }
    } catch { /* silent */ }
    setLoading(false);
  }

  async function handleSuggestionAction(id: string, status: 'accepted' | 'rejected') {
    try {
      await fetch('/api/data/agency-intelligence/learning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id, status }),
      });
      setSuggestions(prev => prev.filter(s => s.id !== id));
    } catch { /* silent */ }
  }

  async function handleAnalyze() {
    if (!analyzeIndustry) return;
    try {
      const res = await fetch('/api/data/agency-intelligence/learning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze', industry: analyzeIndustry }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.suggestions) {
          setSuggestions(prev => [...data.suggestions, ...prev]);
        }
      }
    } catch { /* silent */ }
  }

  async function handleSeedPlaybooks() {
    try {
      await fetch('/api/data/agency-intelligence/playbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed' }),
      });
      fetchData();
    } catch { /* silent */ }
  }

  async function handleSeedTemplates() {
    try {
      await fetch('/api/data/agency-intelligence/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed' }),
      });
      fetchData();
    } catch { /* silent */ }
  }

  if (loading) {
    return (
      <div dir="rtl" style={{ padding: 32 }}>
        <div style={{ textAlign: 'center', padding: 64, color: '#64748b' }}>טוען נתוני אינטליגנציה...</div>
      </div>
    );
  }

  const currentPlaybook = selectedPlaybook ? playbooks.find(p => p.id === selectedPlaybook) : null;

  return (
    <div dir="rtl" style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0 }}>🧠 Agency Intelligence</h1>
        <p style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>כיול, פלייבוקים, תבניות ולמידה — המוח הפנימי של הסוכנות</p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
        <KPICard label="פלייבוקים" value={stats.totalPlaybooks} color="#6366f1" />
        <KPICard label="תבניות קמפיין" value={stats.totalCampaignTemplates} color="#0ea5e9" />
        <KPICard label="תבניות מודעה" value={stats.totalAdTemplates} color="#10b981" />
        <KPICard label="תבניות תוכן" value={stats.totalContentTemplates} color="#f59e0b" />
        <KPICard label="הצעות ממתינות" value={stats.pendingSuggestionsCount} color={stats.pendingSuggestionsCount > 0 ? '#ef4444' : '#94a3b8'} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
        {TAB_ITEMS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: activeTab === tab.id ? 600 : 400,
              background: activeTab === tab.id ? '#6366f1' : 'transparent',
              color: activeTab === tab.id ? '#fff' : '#64748b',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'calibration' && calibration && <CalibrationTab calibration={calibration} />}
      {activeTab === 'playbooks' && (
        <PlaybooksTab
          playbooks={playbooks}
          selectedPlaybook={selectedPlaybook}
          currentPlaybook={currentPlaybook}
          onSelect={setSelectedPlaybook}
          onSeed={handleSeedPlaybooks}
        />
      )}
      {activeTab === 'templates' && <TemplatesTab templates={templates} onSeed={handleSeedTemplates} />}
      {activeTab === 'learning' && (
        <LearningTab
          suggestions={suggestions}
          analyzeIndustry={analyzeIndustry}
          onAnalyzeIndustryChange={setAnalyzeIndustry}
          onAnalyze={handleAnalyze}
          onAction={handleSuggestionAction}
        />
      )}
      {activeTab === 'performance' && calibration && <PerformanceTab calibration={calibration} />}
    </div>
  );
}

// ── KPI Card ──

function KPICard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      padding: 16,
      border: '1px solid #e2e8f0',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{label}</div>
    </div>
  );
}

// ── Calibration Tab ──

function CalibrationTab({ calibration }: { calibration: CalibrationData }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      {/* CPL per Industry */}
      <div style={{ ...cardStyle }}>
        <h3 style={cardTitleStyle}>💰 CPL אידיאלי לפי תעשייה</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.entries(calibration.idealCplPerIndustry).map(([industry, cpl]) => (
            <div key={industry} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 14, color: '#334155' }}>{INDUSTRY_LABELS[industry] || industry}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>₪{cpl}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTR Thresholds */}
      <div style={{ ...cardStyle }}>
        <h3 style={cardTitleStyle}>📊 סף ביצועים CTR</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, color: '#334155' }}>טווח מקובל</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{calibration.acceptableCtrRange.min}% – {calibration.acceptableCtrRange.max}%</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, color: '#10b981' }}>סף ביצועים גבוהים</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#10b981' }}>{calibration.highPerformanceThreshold}%+</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, color: '#ef4444' }}>סף ביצועים נמוכים</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#ef4444' }}>&lt;{calibration.lowPerformanceThreshold}%</span>
          </div>
        </div>
      </div>

      {/* Scaling Rules */}
      <div style={{ ...cardStyle }}>
        <h3 style={cardTitleStyle}>⚡ חוקי scaling</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {calibration.scalingRules.map((rule, i) => (
            <div key={i} style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 8, fontSize: 13 }}>
              <div style={{ fontWeight: 600, color: '#334155', marginBottom: 2 }}>{rule.description}</div>
              <div style={{ color: '#94a3b8', fontSize: 11 }}>{rule.condition} → {rule.action}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Preferences */}
      <div style={{ ...cardStyle }}>
        <h3 style={cardTitleStyle}>🎨 העדפות</h3>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>טון דיבור</div>
          <div style={{ fontSize: 14, color: '#334155', fontWeight: 500 }}>{calibration.toneOfVoice}</div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>רמת סיכון</div>
          <span style={{ fontSize: 13, padding: '4px 12px', borderRadius: 16, background: '#f0f9ff', color: '#0369a1' }}>
            {RISK_LABELS[calibration.riskToleranceLevel] || calibration.riskToleranceLevel}
          </span>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>סגנונות קריאייטיב מועדפים</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {calibration.preferredCreativeStyles.map((s, i) => (
              <span key={i} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 12, background: '#ede9fe', color: '#6366f1' }}>{s}</span>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>הוקים מועדפים</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {calibration.preferredHooks.map((h, i) => (
              <div key={i} style={{ fontSize: 13, color: '#334155' }}>• {h}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Playbooks Tab ──

function PlaybooksTab({
  playbooks,
  selectedPlaybook,
  currentPlaybook,
  onSelect,
  onSeed,
}: {
  playbooks: PlaybookData[];
  selectedPlaybook: string | null;
  currentPlaybook: PlaybookData | null | undefined;
  onSelect: (id: string | null) => void;
  onSeed: () => void;
}) {
  if (playbooks.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 64 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
        <div style={{ fontSize: 16, color: '#64748b', marginBottom: 16 }}>אין פלייבוקים עדיין</div>
        <button onClick={onSeed} style={primaryBtnStyle}>טען ברירות מחדל</button>
      </div>
    );
  }

  return (
    <div>
      {/* Playbook Selector */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {playbooks.map(pb => (
          <button
            key={pb.id}
            onClick={() => onSelect(pb.id === selectedPlaybook ? null : pb.id)}
            style={{
              padding: '10px 20px',
              borderRadius: 10,
              border: pb.id === selectedPlaybook ? '2px solid #6366f1' : '1px solid #e2e8f0',
              background: pb.id === selectedPlaybook ? '#eef2ff' : '#fff',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: pb.id === selectedPlaybook ? 600 : 400,
              color: pb.id === selectedPlaybook ? '#4f46e5' : '#334155',
            }}
          >
            {pb.name}
          </button>
        ))}
      </div>

      {/* Playbook Detail */}
      {currentPlaybook && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Pain Points */}
          <div style={{ ...cardStyle }}>
            <h3 style={cardTitleStyle}>😰 נקודות כאב</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {currentPlaybook.painPoints.map((p, i) => (
                <div key={i} style={{ fontSize: 14, color: '#334155', padding: '6px 0', borderBottom: '1px solid #f8fafc' }}>• {p}</div>
              ))}
            </div>
          </div>

          {/* Hooks */}
          <div style={{ ...cardStyle }}>
            <h3 style={cardTitleStyle}>🪝 הוקים</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {currentPlaybook.hooks.map((h, i) => (
                <div key={i} style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#0f172a' }}>{h.text}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: '#ede9fe', color: '#6366f1' }}>
                      {HOOK_TYPE_LABELS[h.type] || h.type}
                    </span>
                    {h.notes && <span style={{ fontSize: 11, color: '#94a3b8' }}>{h.notes}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTAs */}
          <div style={{ ...cardStyle }}>
            <h3 style={cardTitleStyle}>📣 קריאות לפעולה</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {currentPlaybook.ctas.map((c, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
                  <span style={{ fontSize: 14, color: '#334155' }}>{c.text}</span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: '#f0fdf4', color: '#16a34a' }}>
                    {CTA_TYPE_LABELS[c.type] || c.type}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Angles */}
          <div style={{ ...cardStyle }}>
            <h3 style={cardTitleStyle}>🎯 זוויות</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {currentPlaybook.angles.map((a, i) => (
                <span key={i} style={{ fontSize: 13, padding: '6px 14px', borderRadius: 16, background: '#f0f9ff', color: '#0369a1' }}>{a}</span>
              ))}
            </div>
          </div>

          {/* Audience + Structure */}
          <div style={{ ...cardStyle }}>
            <h3 style={cardTitleStyle}>👥 אסטרטגיית קהל</h3>
            <p style={{ fontSize: 14, color: '#334155', lineHeight: 1.6 }}>{currentPlaybook.audienceStrategy}</p>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>מבנה קמפיין</div>
              <p style={{ fontSize: 14, color: '#334155', lineHeight: 1.6 }}>{currentPlaybook.campaignStructure}</p>
            </div>
          </div>

          {/* Content Ideas + Avoid */}
          <div style={{ ...cardStyle }}>
            <h3 style={cardTitleStyle}>💡 רעיונות תוכן</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
              {currentPlaybook.contentIdeas.map((c, i) => (
                <div key={i} style={{ fontSize: 13, color: '#334155' }}>✦ {c}</div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>⛔ מה להימנע ממנו</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {currentPlaybook.whatToAvoid.map((w, i) => (
                <div key={i} style={{ fontSize: 13, color: '#ef4444' }}>✗ {w}</div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Templates Tab ──

function TemplatesTab({ templates, onSeed }: { templates: TemplateData; onSeed: () => void }) {
  const total = templates.campaigns.length + templates.ads.length + templates.content.length;
  if (total === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 64 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
        <div style={{ fontSize: 16, color: '#64748b', marginBottom: 16 }}>אין תבניות עדיין</div>
        <button onClick={onSeed} style={primaryBtnStyle}>טען ברירות מחדל</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Campaign Templates */}
      <div style={{ ...cardStyle }}>
        <h3 style={cardTitleStyle}>📋 תבניות קמפיין ({templates.campaigns.length})</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {templates.campaigns.map(t => (
            <div key={t.id} style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{t.name}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{t.structure}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: '#ede9fe', color: '#6366f1' }}>
                  {INDUSTRY_LABELS[t.industry] || t.industry}
                </span>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: '#f0fdf4', color: '#16a34a' }}>
                  {t.objective}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ad Templates */}
      <div style={{ ...cardStyle }}>
        <h3 style={cardTitleStyle}>🎨 תבניות מודעה ({templates.ads.length})</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {templates.ads.map(t => (
            <div key={t.id} style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{t.name}</div>
              <div style={{ fontSize: 13, color: '#334155', marginTop: 4 }}>"{t.hookText}"</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: '#ede9fe', color: '#6366f1' }}>
                  {INDUSTRY_LABELS[t.industry] || t.industry}
                </span>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: '#fef3c7', color: '#92400e' }}>
                  {t.structure}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Content Templates */}
      <div style={{ ...cardStyle }}>
        <h3 style={cardTitleStyle}>🎬 תבניות תוכן ({templates.content.length})</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {templates.content.map(t => (
            <div key={t.id} style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{t.name}</div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{t.videoIdea}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: '#ede9fe', color: '#6366f1' }}>
                  {INDUSTRY_LABELS[t.industry] || t.industry}
                </span>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: '#fce7f3', color: '#be185d' }}>
                  {t.format}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Learning Tab ──

function LearningTab({
  suggestions,
  analyzeIndustry,
  onAnalyzeIndustryChange,
  onAnalyze,
  onAction,
}: {
  suggestions: SuggestionData[];
  analyzeIndustry: string;
  onAnalyzeIndustryChange: (v: string) => void;
  onAnalyze: () => void;
  onAction: (id: string, status: 'accepted' | 'rejected') => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Analyze Controls */}
      <div style={{ ...cardStyle }}>
        <h3 style={cardTitleStyle}>🔍 ניתוח ביצועים</h3>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <select
            value={analyzeIndustry}
            onChange={e => onAnalyzeIndustryChange(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14 }}
          >
            <option value="">בחר תעשייה</option>
            {Object.entries(INDUSTRY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <button onClick={onAnalyze} disabled={!analyzeIndustry} style={{ ...primaryBtnStyle, opacity: analyzeIndustry ? 1 : 0.5 }}>
            נתח ביצועים
          </button>
        </div>
      </div>

      {/* Pending Suggestions */}
      <div style={{ ...cardStyle }}>
        <h3 style={cardTitleStyle}>📝 הצעות ממתינות ({suggestions.length})</h3>
        {suggestions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✨</div>
            אין הצעות ממתינות — הפעל ניתוח כדי ליצור
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {suggestions.map(s => (
              <div key={s.id} style={{ padding: 16, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{s.text}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{s.reason}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: '#ede9fe', color: '#6366f1' }}>
                      {SUGGESTION_TYPE_LABELS[s.type] || s.type}
                    </span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: '#f0f9ff', color: '#0369a1' }}>
                      {INDUSTRY_LABELS[s.industry] || s.industry}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.source}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#64748b' }}>ביטחון: {s.confidence}%</span>
                    <button
                      onClick={() => onAction(s.id, 'accepted')}
                      style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer', fontSize: 12 }}
                    >
                      ✓ אשר
                    </button>
                    <button
                      onClick={() => onAction(s.id, 'rejected')}
                      style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: 12 }}
                    >
                      ✗ דחה
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Performance Tab ──

function PerformanceTab({ calibration }: { calibration: CalibrationData }) {
  const [testIndustry, setTestIndustry] = useState('real_estate');
  const [testCPL, setTestCPL] = useState('100');
  const [testCTR, setTestCTR] = useState('2.5');
  const [result, setResult] = useState<{ verdict: string; label: string; suggestions: string[] } | null>(null);

  function evaluate() {
    const cpl = parseFloat(testCPL) || 0;
    const ctr = parseFloat(testCTR) || 0;
    const idealCPL = calibration.idealCplPerIndustry[testIndustry] || 100;
    const cplRatio = cpl / idealCPL;

    const suggestions: string[] = [];
    let verdict: string;
    let label: string;

    if (cplRatio <= 0.7) suggestions.push(`CPL מצוין (₪${Math.round(cpl)}) — מתחת ל-70% מהאידיאל`);
    else if (cplRatio > 2.0) suggestions.push(`CPL קריטי (₪${Math.round(cpl)}) — כפול מהאידיאל (₪${idealCPL})`);
    else if (cplRatio > 1.3) suggestions.push(`CPL גבוה (₪${Math.round(cpl)}) — מעל האידיאל (₪${idealCPL})`);

    if (ctr >= calibration.highPerformanceThreshold) suggestions.push(`CTR מצוין (${ctr.toFixed(1)}%)`);
    else if (ctr <= calibration.lowPerformanceThreshold) suggestions.push(`CTR נמוך (${ctr.toFixed(1)}%)`);

    if (cplRatio <= 0.7 && ctr >= calibration.highPerformanceThreshold) { verdict = 'excellent'; label = 'ביצועים מצוינים'; }
    else if (cplRatio <= 1.0 && ctr >= calibration.acceptableCtrRange.min) { verdict = 'good'; label = 'ביצועים טובים'; }
    else if (cplRatio <= 1.5 && ctr >= calibration.lowPerformanceThreshold) { verdict = 'average'; label = 'ביצועים סבירים'; }
    else if (cplRatio > 2.0 || ctr < calibration.lowPerformanceThreshold) { verdict = 'critical'; label = 'ביצועים קריטיים'; }
    else { verdict = 'poor'; label = 'ביצועים חלשים'; }

    setResult({ verdict, label, suggestions });
  }

  const verdictColors: Record<string, string> = {
    excellent: '#10b981',
    good: '#22c55e',
    average: '#f59e0b',
    poor: '#f97316',
    critical: '#ef4444',
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      {/* Test Performance */}
      <div style={{ ...cardStyle }}>
        <h3 style={cardTitleStyle}>🧪 בדיקת ביצועים</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>תעשייה</label>
            <select
              value={testIndustry}
              onChange={e => setTestIndustry(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14 }}
            >
              {Object.entries(INDUSTRY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>CPL (₪)</label>
              <input
                type="number"
                value={testCPL}
                onChange={e => setTestCPL(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>CTR (%)</label>
              <input
                type="number"
                value={testCTR}
                onChange={e => setTestCTR(e.target.value)}
                step="0.1"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14 }}
              />
            </div>
          </div>
          <button onClick={evaluate} style={primaryBtnStyle}>בדוק</button>
        </div>
      </div>

      {/* Result */}
      <div style={{ ...cardStyle }}>
        <h3 style={cardTitleStyle}>📊 תוצאה</h3>
        {!result ? (
          <div style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>
            הזן CPL ו-CTR ולחץ "בדוק"
          </div>
        ) : (
          <div>
            <div style={{
              textAlign: 'center',
              padding: 24,
              borderRadius: 12,
              background: `${verdictColors[result.verdict]}15`,
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: verdictColors[result.verdict] }}>{result.label}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{result.verdict.toUpperCase()}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {result.suggestions.map((s, i) => (
                <div key={i} style={{ fontSize: 13, color: '#334155', padding: '6px 0', borderBottom: '1px solid #f8fafc' }}>• {s}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared Styles ──

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  padding: 20,
  border: '1px solid #e2e8f0',
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: '#0f172a',
  margin: '0 0 16px 0',
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: 8,
  border: 'none',
  background: '#6366f1',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 500,
};
