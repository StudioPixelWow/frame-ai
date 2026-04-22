'use client';

export const dynamic = "force-dynamic";

import React, { useState } from 'react';

export default function ViralPage() {
  const [platform, setPlatform] = useState('TikTok');
  const [selectedTrend, setSelectedTrend] = useState<number | null>(null);

  const platforms = ['TikTok', 'Instagram', 'YouTube'];

  const trends = [
    { id: 1, topic: 'טיפולי יופי שגויים', score: 92, platform: 'TikTok' },
    { id: 2, topic: 'בחורות קטנות משחקות', score: 88, platform: 'TikTok' },
    { id: 3, topic: 'תרופות DIY', score: 85, platform: 'TikTok' },
    { id: 4, topic: 'טיפים להוטל חדש', score: 79, platform: 'TikTok' },
    { id: 5, topic: 'קריאה מחדש ישנה', score: 76, platform: 'TikTok' },
    { id: 6, topic: 'בחורות שחקניות ירושלים', score: 73, platform: 'TikTok' },
  ];

  const instagramTrends = [
    { id: 7, topic: 'סדנת יוגה + קפה', score: 84, platform: 'Instagram' },
    { id: 8, topic: 'אופנה לקהילה', score: 81, platform: 'Instagram' },
    { id: 9, topic: 'חיי מעצבים', score: 78, platform: 'Instagram' },
  ];

  const youtubeTrends = [
    { id: 10, topic: 'סדרות דקומנטציה קצרות', score: 87, platform: 'YouTube' },
    { id: 11, topic: 'הדרכה טכנולוגית עמוקה', score: 82, platform: 'YouTube' },
    { id: 12, topic: 'בדיקה מוצר פרטנית', score: 79, platform: 'YouTube' },
  ];

  const allTrends = [...trends, ...instagramTrends, ...youtubeTrends];
  const filteredTrends = allTrends.filter((t) => t.platform === platform);

  const selectedTrendData = allTrends.find((t) => t.id === selectedTrend);

  const ideaOutputs = selectedTrendData
    ? [
        {
          id: 1,
          hook: `"אתה עשוי לעשות זאת בצורה שגויה: ${selectedTrendData.topic}"`,
        },
        {
          id: 2,
          hook: `"רוב האנשים לא יודעים: ${selectedTrendData.topic}"`,
        },
        {
          id: 3,
          hook: `"זה החסר ב ${selectedTrendData.topic}"`,
        },
      ]
    : [];

  return (
    <div dir="rtl" className="vrl-page">
      <h1 className="mod-page-title">מצב ויראלי</h1>

      <div className="vrl-platform-tabs">
        {platforms.map((p) => (
          <button
            key={p}
            onClick={() => {
              setPlatform(p);
              setSelectedTrend(null);
            }}
            className={`vrl-platform-tab ${platform === p ? 'active' : ''}`}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '6px 6px 0 0',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: platform === p ? 'white' : '#f3f4f6',
              borderBottom: platform === p ? '2px solid #4f46e5' : '1px solid #e5e7eb',
              fontWeight: platform === p ? '600' : '400',
              marginRight: '0.5rem',
            }}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="vrl-trend-grid">
        {filteredTrends.map((trend) => (
          <button
            key={trend.id}
            onClick={() => setSelectedTrend(trend.id)}
            className="vrl-trend-card"
            style={{
              padding: '1.5rem',
              borderRadius: '8px',
              border: selectedTrend === trend.id ? '2px solid #4f46e5' : '1px solid #e5e7eb',
              backgroundColor: selectedTrend === trend.id ? '#eef2ff' : 'white',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <h3 className="vrl-trend-topic">{trend.topic}</h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <div className="vrl-score-ring" style={{ position: 'relative', width: '60px', height: '60px' }}>
                <svg width="60" height="60" style={{ transform: 'rotate(-90deg)' }}>
                  <circle
                    cx="30"
                    cy="30"
                    r="25"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="4"
                  />
                  <circle
                    cx="30"
                    cy="30"
                    r="25"
                    fill="none"
                    stroke="#4f46e5"
                    strokeWidth="4"
                    strokeDasharray={`${(trend.score / 100) * (2 * Math.PI * 25)} ${2 * Math.PI * 25}`}
                  />
                </svg>
                <div
                  className="vrl-score-label"
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    fontSize: '1.25rem',
                    fontWeight: '700',
                  }}
                >
                  {trend.score}
                </div>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>ויראליות</span>
            </div>
          </button>
        ))}
      </div>

      {selectedTrendData && (
        <div style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>
            אפשרויות תוכן: {selectedTrendData.topic}
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1rem',
            }}
          >
            {ideaOutputs.map((idea) => (
              <div key={idea.id} className="vrl-output-card" style={{ padding: '1.5rem', borderRadius: '8px', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}>
                <h3 style={{ fontSize: '0.875rem', color: '#9ca3af', marginBottom: '0.75rem' }}>
                  Hook אפשרות {idea.id}
                </h3>
                <p className="vrl-idea-hook" style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem' }}>
                  {idea.hook}
                </p>
                <details style={{ fontSize: '0.875rem' }}>
                  <summary style={{ cursor: 'pointer', color: '#4f46e5' }}>
                    צפה בתסריט השלם
                  </summary>
                  <p className="vrl-idea-script" style={{ marginTop: '0.75rem', color: '#6b7280' }}>
                    תסריט לדוגמא: התחל עם ה-hook, הוסף 3 נקודות עיקריות, סיים עם CTA
                  </p>
                </details>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
