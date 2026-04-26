'use client';

import { useSearchParams } from 'next/navigation';
import { usePodcastStrategies, usePodcastSessions } from '@/lib/api/use-entity';
import { Suspense, useState } from 'react';
import type { PodcastStrategy } from '@/lib/db/schema';

function PodcastContentInner() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get('clientId');
  const { data: strategies } = usePodcastStrategies();
  const { data: sessions } = usePodcastSessions();
  const [approvingId, setApprovingId] = useState<string | null>(null);

  if (!clientId) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
        Client ID not found.
      </div>
    );
  }

  const clientStrategies = strategies.filter(
    (s) => s.clientId === clientId && (s.status === 'ready' || s.status === 'completed')
  );

  const handleApprove = async (strategyId: string) => {
    setApprovingId(strategyId);
    try {
      const response = await fetch('/api/data/podcast-strategies/' + strategyId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientApproved: true,
          clientApprovedAt: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        // Refetch strategies (in a real app, you'd use SWR refetch or similar)
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to approve:', error);
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div style={{ direction: 'rtl', minHeight: '100vh' }}>
      {clientStrategies.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '3rem 2rem',
            background: 'var(--background)',
            borderRadius: '8px',
            color: 'var(--foreground)',
            opacity: 0.6,
          }}
        >
          <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
            אין פרקי פודקאסט ממתינים
          </p>
          <p style={{ fontSize: '0.95rem', color: 'rgba(0,0,0,0.4)' }}>
            כשיהיה פרק פודקאסט מוכן לאישור, הוא יופיע כאן
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {clientStrategies.map((strategy) => (
            <StrategyCard
              key={strategy.id}
              strategy={strategy}
              isApproving={approvingId === strategy.id}
              onApprove={handleApprove}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StrategyCard({
  strategy,
  isApproving,
  onApprove,
}: {
  strategy: PodcastStrategy;
  isApproving: boolean;
  onApprove: (id: string) => void;
}) {
  const segmentTitles =
    strategy.episodeStructure?.segments?.map((s) => s.title).join(', ') || 'לא צוין';

  return (
    <div
      style={{
        direction: 'rtl',
        border: '1px solid rgba(0, 0, 0, 0.1)',
        borderRadius: '8px',
        padding: '1.5rem',
        background: 'white',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        transition: 'box-shadow 200ms ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow =
          '0 4px 12px rgba(0, 0, 0, 0.1)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow =
          '0 1px 3px rgba(0, 0, 0, 0.05)';
      }}
    >
      {/* Header with title and badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ fontSize: '1.2rem', color: '#1a1a1a', marginBottom: '0.3rem' }}>
            🎙️ פרק הפודקאסט שלך מוכן
          </h3>
          <p style={{ fontSize: '0.9rem', color: 'rgba(0,0,0,0.5)' }}>
            אורח: {strategy.clientName}
          </p>
        </div>
        <span
          style={{
            display: 'inline-block',
            padding: '0.4rem 0.8rem',
            background: 'rgba(0, 0, 0, 0.05)',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            borderRadius: '4px',
            fontSize: '0.85rem',
            fontWeight: 500,
            color: '#1a1a1a',
            whiteSpace: 'nowrap',
          }}
        >
          {strategy.episodeType === 'deep_interview'
            ? 'ראיון עמוק'
            : strategy.episodeType === 'sales'
            ? 'מכירות'
            : strategy.episodeType === 'educational'
            ? 'חינוכי'
            : strategy.episodeType === 'viral_short'
            ? 'קצר ווירלי'
            : 'סמכות'}
        </span>
      </div>

      {/* Episode structure summary */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.8rem', color: '#333' }}>
          מבנה הפרק
        </h4>
        <div style={{ background: 'rgba(0, 0, 0, 0.02)', padding: '1rem', borderRadius: '4px', borderRight: '3px solid #1a1a1a' }}>
          <p style={{ fontSize: '0.9rem', marginBottom: '0.6rem' }}>
            <strong>Opening Hook:</strong> {strategy.episodeStructure?.openingHook || 'לא צוין'}
          </p>
          <p style={{ fontSize: '0.9rem', marginBottom: '0.6rem' }}>
            <strong>Segments:</strong> {segmentTitles}
          </p>
          <p style={{ fontSize: '0.9rem' }}>
            <strong>CTA:</strong> {strategy.episodeStructure?.closingCTA || 'לא צוין'}
          </p>
        </div>
      </div>

      {/* Selected questions */}
      {strategy.questions && strategy.questions.some((q) => q.selected) && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.8rem', color: '#333' }}>
            שאלות נבחרות
          </h4>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {strategy.questions
              .filter((q) => q.selected)
              .map((q) => (
                <li
                  key={q.id}
                  style={{
                    padding: '0.6rem 0',
                    fontSize: '0.9rem',
                    borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
                    direction: 'rtl',
                  }}
                >
                  <span style={{ marginRight: '0.5rem' }}>•</span>
                  {q.text}
                  {q.labels && q.labels.length > 0 && (
                    <span style={{ marginRight: '0.5rem', fontSize: '0.8rem', color: 'rgba(0,0,0,0.5)' }}>
                      ({q.labels.join(', ')})
                    </span>
                  )}
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-start' }}>
        <button
          onClick={() => onApprove(strategy.id)}
          disabled={isApproving || strategy.clientApproved}
          style={{
            padding: '0.7rem 1.4rem',
            background: strategy.clientApproved ? '#4caf50' : '#1a1a1a',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '0.95rem',
            fontWeight: 500,
            cursor: isApproving ? 'not-allowed' : 'pointer',
            transition: 'background 200ms ease',
            opacity: isApproving ? 0.6 : 1,
          }}
          onMouseEnter={(e) => {
            if (!isApproving && !strategy.clientApproved) {
              (e.currentTarget as HTMLButtonElement).style.background = '#333';
            }
          }}
          onMouseLeave={(e) => {
            if (!isApproving && !strategy.clientApproved) {
              (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a';
            }
          }}
        >
          {strategy.clientApproved ? '✓ אושר' : isApproving ? '...שולח' : 'אשר'}
        </button>
        <a
          href={`/api/podcast-strategy-pdf?strategyId=${strategy.id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: '0.7rem 1.4rem',
            background: 'rgba(0, 0, 0, 0.05)',
            color: '#1a1a1a',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            borderRadius: '4px',
            fontSize: '0.95rem',
            fontWeight: 500,
            textDecoration: 'none',
            cursor: 'pointer',
            transition: 'background 200ms ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background =
              'rgba(0, 0, 0, 0.08)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background =
              'rgba(0, 0, 0, 0.05)';
          }}
        >
          📄 הדפס / PDF
        </a>
      </div>

      {strategy.clientApproved && strategy.clientApprovedAt && (
        <p
          style={{
            marginTop: '1rem',
            fontSize: '0.85rem',
            color: 'rgba(0, 0, 0, 0.4)',
            textAlign: 'right',
          }}
        >
          אושר בתאריך: {new Date(strategy.clientApprovedAt).toLocaleDateString('he-IL')}
        </p>
      )}
    </div>
  );
}

export default function PodcastContent() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(0,0,0,0.5)' }}>
          ...טוען פרקי פודקאסט
        </div>
      }
    >
      <PodcastContentInner />
    </Suspense>
  );
}
