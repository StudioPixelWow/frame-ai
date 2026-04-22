'use client';

export const dynamic = "force-dynamic";

import React from 'react';

export default function InsightsPage() {
  const insights = [
    {
      id: 1,
      icon: '👥',
      title: 'נטיות לקוחות',
      body: 'לקוחות בתיקייה המערבית מבקשים בעיקר סרטוני פרסום בתבנית ריל שעובדים ב-TikTok ו-Instagram.',
      confidence: 87,
    },
    {
      id: 2,
      icon: '⚙️',
      title: 'בקעתות ייצור',
      body: 'זמן העריכה ממוצע הוא 4.5 ימים. אפשר לשפר את הזרימה בין שלבי העריכה.',
      confidence: 72,
    },
    {
      id: 3,
      icon: '📈',
      title: 'יתרון תחרותי',
      body: 'קצב הייצור שלנו 2.3x יותר מהר מן התחרות, זה נותן לנו יתרון זמן שוק חזק.',
      confidence: 94,
    },
    {
      id: 4,
      icon: '⚡',
      title: 'סיכון שוק',
      body: 'אם TikTok הולך למטה בארה"ב, קחי תלות תוכן משמעותית בפלטפורמה אחת.',
      confidence: 65,
    },
    {
      id: 5,
      icon: '💰',
      title: 'הזדמנות הכנסה',
      body: 'סרטונים בעלי עלות נמוכה (תבניות, כלים) עשויים להיות מודל SaaS טוב.',
      confidence: 78,
    },
    {
      id: 6,
      icon: '🎯',
      title: 'צפיפות לקוח',
      body: '3 לקוחות אחרים דומים לסטודיו יוצרים - הזדמנות לשיתוף פעולה או חבילות.',
      confidence: 81,
    },
  ];

  return (
    <div dir="rtl" className="ins-page">
      <h1 className="mod-page-title">תובנות AI</h1>

      <div className="ins-grid">
        {insights.map((insight) => (
          <div key={insight.id} className="ins-card">
            <span className="ins-card-icon">{insight.icon}</span>
            <h3 className="ins-card-title">{insight.title}</h3>
            <p className="ins-card-body">{insight.body}</p>
            <div className="ins-score">
              <div className="ins-score-bar">
                <div
                  className="ins-score-fill"
                  style={{ width: `${insight.confidence}%` }}
                />
              </div>
              <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                {insight.confidence}% ודאות
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
