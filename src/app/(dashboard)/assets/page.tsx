'use client';

export const dynamic = "force-dynamic";

import React, { useState } from 'react';

export default function AssetsPage() {
  const [filter, setFilter] = useState('הכל');
  const [search, setSearch] = useState('');

  const filters = ['הכל', 'וידאו', 'תמונות', 'מסמכים'];

  const assets = [
    {
      id: 1,
      name: 'סרטון פרסום Q1',
      client: 'דני מודעות',
      type: 'וידאו',
      tags: ['פרסום', 'Q1', 'ברור'],
    },
    {
      id: 2,
      name: 'תמונת כותר',
      client: 'סטודיו יוצרים',
      type: 'תמונות',
      tags: ['כותר', 'פרקטי'],
    },
    {
      id: 3,
      name: 'סרטון טוטוריאל',
      client: 'טק סולושנס',
      type: 'וידאו',
      tags: ['הדרכה', 'מורחב'],
    },
    {
      id: 4,
      name: 'ברושור עיצוב',
      client: 'דני מודעות',
      type: 'מסמכים',
      tags: ['עיצוב', 'ברושור'],
    },
    {
      id: 5,
      name: 'צילום מוצר',
      client: 'סטודיו יוצרים',
      type: 'תמונות',
      tags: ['מוצר', 'צילום'],
    },
    {
      id: 6,
      name: 'סרטון בדיקה',
      client: 'טק סולושנס',
      type: 'וידאו',
      tags: ['בדיקה', 'קצר'],
    },
    {
      id: 7,
      name: 'מסמך פטנט',
      client: 'דני מודעות',
      type: 'מסמכים',
      tags: ['חוקי', 'פטנט'],
    },
    {
      id: 8,
      name: 'תמונת רקע',
      client: 'סטודיו יוצרים',
      type: 'תמונות',
      tags: ['רקע', 'ממלא'],
    },
  ];

  const filteredAssets = assets.filter((asset) => {
    const matchesFilter = filter === 'הכל' || asset.type === filter;
    const matchesSearch = asset.name.includes(search) || asset.client.includes(search);
    return matchesFilter && matchesSearch;
  });

  return (
    <div dir="rtl" className="ast-page">
      <h1 className="mod-page-title">ניהול נכסים</h1>

      <div className="ast-toolbar">
        <input
          type="text"
          placeholder="חיפוש..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ast-search"
        />
        <button className="ast-upload-btn">+ הוסף נכס</button>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: filter === f ? '#4f46e5' : '#e5e7eb',
              color: filter === f ? 'white' : '#1f2937',
              fontWeight: filter === f ? '600' : '400',
              transition: 'all 0.2s',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="ast-grid">
        {filteredAssets.map((asset) => (
          <div key={asset.id} className="ast-card">
            <div className="ast-thumb" style={{ backgroundColor: '#dbeafe' }}>
              {asset.type === 'וידאו' && <span style={{ fontSize: '2rem' }}>▶️</span>}
              {asset.type === 'תמונות' && <span style={{ fontSize: '2rem' }}>🖼️</span>}
              {asset.type === 'מסמכים' && <span style={{ fontSize: '2rem' }}>📄</span>}
            </div>
            <div className="ast-card-info">
              <h3 className="ast-card-name">{asset.name}</h3>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                {asset.client}
              </p>
              <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                {asset.tags.map((tag) => (
                  <span key={tag} className="ast-tag">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
