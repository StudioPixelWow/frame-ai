import { NextRequest, NextResponse } from 'next/server';
import { podcastStrategies } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET(request: NextRequest) {
  try {
    ensureSeeded();

    const searchParams = request.nextUrl.searchParams;
    const strategyId = searchParams.get('strategyId');

    if (!strategyId) {
      return NextResponse.json(
        { error: 'strategyId query parameter is required' },
        { status: 400 }
      );
    }

    const strategies = await podcastStrategies.getAllAsync();
    const strategy = strategies.find((s) => s.id === strategyId);

    if (!strategy) {
      return NextResponse.json(
        { error: 'Strategy not found' },
        { status: 404 }
      );
    }

    // Build HTML for PDF
    const segmentsList = strategy.episodeStructure?.segments
      ?.map((seg) => `<li dir="rtl"><strong>${seg.title}</strong> - ${seg.description}</li>`)
      .join('')
      || '';

    const questionsList = strategy.questions
      ?.filter((q) => q.selected)
      ?.map((q) => {
        const typeBadge = {
          hook: 'hook',
          story: 'story',
          authority: 'authority',
          objection: 'objection',
          cta: 'cta',
        }[q.type] || 'hook';
        return `<li dir="rtl"><strong>${q.text}</strong> <span class="badge badge-${typeBadge}">${typeBadge}</span></li>`;
      })
      .join('')
      || '';

    const clipsList = strategy.clipIdeas
      ?.map(
        (clip) =>
          `<li dir="rtl">
        <strong>${clip.clipTitle}</strong>
        <p>${clip.hookLine}</p>
        <p><em>${clip.captionIdea}</em></p>
        <p>Platforms: ${clip.platformFit.join(', ')}</p>
      </li>`
      )
      .join('')
      || '';

    const html = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>אסטרטגיית פודקאסט - ${strategy.clientName}</title>
  <style>
    :root {
      color-scheme: light;
      --primary: #1a1a1a;
      --text: #333;
      --light-bg: #f5f5f5;
      --border: #ddd;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: var(--text);
      background: white;
      padding: 2rem;
      direction: rtl;
    }
    .header {
      margin-bottom: 2rem;
      padding-bottom: 1.5rem;
      border-bottom: 2px solid var(--primary);
    }
    .client-info {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 1rem;
    }
    .client-info h1 {
      font-size: 1.8rem;
      color: var(--primary);
    }
    .episode-type-badge {
      display: inline-block;
      padding: 0.4rem 0.8rem;
      background: var(--light-bg);
      border: 1px solid var(--border);
      border-radius: 4px;
      font-size: 0.9rem;
      color: var(--text);
    }
    h2 {
      font-size: 1.3rem;
      margin-top: 1.5rem;
      margin-bottom: 0.8rem;
      color: var(--primary);
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--light-bg);
    }
    .section {
      margin-bottom: 1.5rem;
    }
    .opening-hook, .closing-cta {
      background: var(--light-bg);
      padding: 1rem;
      border-radius: 4px;
      border-right: 3px solid var(--primary);
      margin-bottom: 1rem;
    }
    ul {
      list-style-position: inside;
      margin-right: 1rem;
    }
    li {
      margin-bottom: 0.8rem;
      padding-right: 1rem;
    }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.6rem;
      border-radius: 3px;
      font-size: 0.75rem;
      font-weight: 600;
      margin-right: 0.5rem;
      background: var(--light-bg);
      border: 1px solid var(--border);
      color: var(--text);
    }
    .badge-hook { background: #e3f2fd; border-color: #90caf9; color: #0d47a1; }
    .badge-story { background: #f3e5f5; border-color: #ce93d8; color: #4a148c; }
    .badge-authority { background: #e8f5e9; border-color: #81c784; color: #1b5e20; }
    .badge-objection { background: #fff3e0; border-color: #ffb74d; color: #e65100; }
    .badge-cta { background: #fce4ec; border-color: #f48fb1; color: #880e4f; }
    .clip-idea {
      background: var(--light-bg);
      padding: 1rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      border-right: 3px solid var(--primary);
    }
    .clip-idea strong {
      display: block;
      margin-bottom: 0.5rem;
      color: var(--primary);
    }
    .clip-idea p {
      margin-bottom: 0.5rem;
      font-size: 0.95rem;
    }
    .segment {
      margin-bottom: 1rem;
      padding: 1rem;
      background: var(--light-bg);
      border-radius: 4px;
    }
    .segment strong {
      display: block;
      margin-bottom: 0.3rem;
      color: var(--primary);
    }
    .segment em {
      font-size: 0.9rem;
      color: #666;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="client-info">
      <div>
        <h1>${strategy.clientName}</h1>
        <p style="margin-top: 0.5rem; color: #666;">אסטרטגיית פודקאסט</p>
      </div>
      <span class="episode-type-badge">${strategy.episodeType}</span>
    </div>
  </div>

  <div class="section">
    <h2>מבנה הפרק</h2>
    <div class="opening-hook">
      <strong>opening hook:</strong>
      <p>${strategy.episodeStructure?.openingHook || 'לא צוין'}</p>
    </div>
    <h3 style="font-size: 1rem; margin-top: 1rem; margin-bottom: 0.5rem;">Segments:</h3>
    <ul style="list-style: none;">
      ${segmentsList || '<li>אין segments</li>'}
    </ul>
    <div class="closing-cta" style="margin-top: 1rem;">
      <strong>closing CTA:</strong>
      <p>${strategy.episodeStructure?.closingCTA || 'לא צוין'}</p>
    </div>
  </div>

  <div class="section">
    <h2>שאלות נבחרות</h2>
    <ul>
      ${questionsList || '<li>אין שאלות נבחרות</li>'}
    </ul>
  </div>

  <div class="section">
    <h2>רעיונות קטעים (Clip Ideas)</h2>
    ${
      clipsList
        ? `<div>${clipsList.split('<li').map((item, idx) => idx === 0 ? item : `<div class="clip-idea">${item.replace('</li>', '').replace(/^[>]+/, '')}</div>`).join('')}</div>`
        : '<p>אין רעיונות קטעים</p>'
    }
  </div>

  <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--border); text-align: center; font-size: 0.85rem; color: #999;">
    <p>צור בתאריך: ${new Date(strategy.createdAt).toLocaleDateString('he-IL')}</p>
  </div>
</body>
</html>
    `;

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': 'inline; filename="podcast-strategy.html"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
