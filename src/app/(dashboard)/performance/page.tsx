'use client';

export const dynamic = "force-dynamic";

import React from 'react';

export default function PerformancePage() {
  const kpis = [
    { label: 'צפיות', value: '24K', color: '#a5b4fc' },
    { label: 'מעורבות', value: '8.2%', color: '#34d399' },
    { label: 'השלמה', value: '72%', color: '#fbbf24' },
    { label: 'CTA', value: '3.4%', color: '#f87171' },
    { label: 'סרטונים', value: '12', color: '#9ca3af' },
  ];

  const insights = [
    {
      id: 1,
      icon: '📌',
      title: 'Hook הטוב ביותר',
      text: 'סרטונים המתחילים ב-3 שניות ראשונות עם שאלה קולעת מקבלים 45% יותר צפיות',
    },
    {
      id: 2,
      icon: '⏱️',
      title: 'משך אופטימלי',
      text: 'סרטונים בין 45-90 שניות יש השלמה גבוהה ביותר (78%)',
    },
    {
      id: 3,
      icon: '🎯',
      title: 'CTA בזמן הנכון',
      text: 'קריאה לפעולה בשניה ה-30 מקבלת תגובה הטובה ביותר',
    },
    {
      id: 4,
      icon: '✨',
      title: 'סגנון ויזואלי',
      text: 'תמונות בהירות וטקסט בולט - מעורבות גבוהה 34% יותר',
    },
  ];

  const presetPerformance = [
    { name: 'ניקוד במהלך', percentage: 82 },
    { name: 'סרטון בחזיתה', percentage: 75 },
    { name: 'כותרת מדהימה', percentage: 68 },
    { name: 'קול ברור', percentage: 85 },
  ];

  const hookStyles = [
    { name: 'שאלה', percentage: 88 },
    { name: 'סטטיסטיקה', percentage: 76 },
    { name: 'טוויסט', percentage: 79 },
    { name: 'טוען', percentage: 71 },
  ];

  const videos = [
    {
      id: 1,
      title: 'סרטון פרסום Q1',
      views: '5.2K',
      engagement: '9.3%',
      completion: '74%',
    },
    {
      id: 2,
      title: 'סרטון טוטוריאל',
      views: '3.8K',
      engagement: '7.1%',
      completion: '68%',
    },
    {
      id: 3,
      title: 'כתיבת בדיקה',
      views: '2.1K',
      engagement: '6.5%',
      completion: '62%',
    },
  ];

  return (
    <div dir="rtl" className="perf-page">
      <h1 className="mod-page-title">📈 Performance AI</h1>
      <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
        ניתוח ביצועי סרטונים קודמים — למד מה עובד ויצר תוכן טוב יותר
      </p>

      <div className="vs-perf-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {kpis.map((kpi) => (
          <div key={kpi.label} className="vs-perf-kpi" style={{ backgroundColor: kpi.color + '20', borderLeft: `4px solid ${kpi.color}` }}>
            <div className="vs-perf-kpi-val" style={{ color: kpi.color }}>{kpi.value}</div>
            <div className="vs-perf-kpi-label">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="agd-card" style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.125rem', marginBottom: '1.5rem' }}>תובנות AI</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          {insights.map((insight) => (
            <div key={insight.id} className="vs-perf-insight">
              <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{insight.icon}</p>
              <h3 style={{ fontWeight: '600', marginBottom: '0.5rem' }}>{insight.title}</h3>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', lineHeight: '1.4' }}>{insight.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="agd-card">
          <h3 style={{ fontSize: '1rem', marginBottom: '1rem', fontWeight: '600' }}>ביצוע תבניות</h3>
          {presetPerformance.map((item) => (
            <div key={item.name} style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span className="vs-perf-bar-label">{item.name}</span>
                <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>{item.percentage}%</span>
              </div>
              <div className="vs-perf-bar-track">
                <div className="vs-perf-bar-fill" style={{ width: `${item.percentage}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="agd-card">
          <h3 style={{ fontSize: '1rem', marginBottom: '1rem', fontWeight: '600' }}>סגנונות Hook</h3>
          {hookStyles.map((item) => (
            <div key={item.name} style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span className="vs-perf-bar-label">{item.name}</span>
                <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>{item.percentage}%</span>
              </div>
              <div className="vs-perf-bar-track">
                <div className="vs-perf-bar-fill" style={{ width: `${item.percentage}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="agd-card">
        <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>סרטונים אחרונים</h2>
        <div className="pay-table">
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'right', paddingBottom: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>כותרת</th>
                <th style={{ textAlign: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>צפיות</th>
                <th style={{ textAlign: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>מעורבות</th>
                <th style={{ textAlign: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>השלמה</th>
              </tr>
            </thead>
            <tbody>
              {videos.map((video) => (
                <tr key={video.id}>
                  <td style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem' }}>{video.title}</td>
                  <td style={{ textAlign: 'center', paddingTop: '0.75rem', paddingBottom: '0.75rem' }}>{video.views}</td>
                  <td style={{ textAlign: 'center', paddingTop: '0.75rem', paddingBottom: '0.75rem' }}>{video.engagement}</td>
                  <td style={{ textAlign: 'center', paddingTop: '0.75rem', paddingBottom: '0.75rem' }}>{video.completion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
