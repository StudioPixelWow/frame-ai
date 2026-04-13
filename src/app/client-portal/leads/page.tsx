'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useMemo } from 'react';
import { useLeads } from '@/lib/api/use-entity';
import type { LeadStatus, LeadInterestType } from '@/lib/db/schema';

const STATUSES: { id: LeadStatus; label: string; color: string }[] = [
  { id: 'new', label: 'חדש', color: '#3b82f6' },
  { id: 'contacted', label: 'נוצר קשר', color: '#f59e0b' },
  { id: 'proposal_sent', label: 'נשלחה הצעה', color: '#a855f7' },
  { id: 'negotiation', label: 'במו"מ', color: '#f97316' },
  { id: 'won', label: 'נסגר', color: '#22c55e' },
  { id: 'not_relevant', label: 'לא רלוונטי', color: '#6b7280' },
];

const SOURCE_OPTIONS = [
  'קמפיין מיוחד',
  'המלצה',
  'אתר אינטרנט',
  'רשתות חברתיות',
  'ישירות',
  'אירוע',
  'LinkedIn',
  'פייסבוק',
];

type TableSortBy = 'name' | 'phone' | 'created' | 'status';
type SortDirection = 'asc' | 'desc';

export default function ClientPortalLeadsPage() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get('clientId');
  const { data: allLeads, loading } = useLeads();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [tableSortBy, setTableSortBy] = useState<TableSortBy>('created');
  const [tableSortDir, setTableSortDir] = useState<SortDirection>('desc');

  // Filter leads by client - for client portal, show leads linked to this client
  const clientLeads = useMemo(() => {
    if (!clientId) return [];
    // Filter leads that are converted to this client or explicitly linked
    return allLeads.filter(
      (lead) => lead.convertedClientId === clientId || (lead.clientId && lead.clientId === clientId)
    );
  }, [allLeads, clientId]);

  // Further filter based on search and status
  const filteredLeads = useMemo(() => {
    let result = [...clientLeads];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (lead) =>
          lead.fullName.toLowerCase().includes(q) ||
          lead.email.toLowerCase().includes(q) ||
          (lead.phone && lead.phone.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (filterStatus !== 'all') {
      result = result.filter((lead) => lead.status === filterStatus);
    }

    // Source filter
    if (filterSource !== 'all') {
      result = result.filter((lead) => lead.source === filterSource);
    }

    // Sort
    result.sort((a, b) => {
      let aVal: any = null;
      let bVal: any = null;

      switch (tableSortBy) {
        case 'name':
          aVal = a.fullName;
          bVal = b.fullName;
          break;
        case 'phone':
          aVal = a.phone || '';
          bVal = b.phone || '';
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        case 'created':
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
      }

      if (typeof aVal === 'string') {
        const cmp = aVal.localeCompare(bVal, 'he');
        return tableSortDir === 'asc' ? cmp : -cmp;
      } else {
        return tableSortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
    });

    return result;
  }, [clientLeads, searchQuery, filterStatus, filterSource, tableSortBy, tableSortDir]);

  // Summary stats
  const stats = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    return {
      total: clientLeads.length,
      newThisWeek: clientLeads.filter((l) => new Date(l.createdAt) > weekAgo).length,
      contacted: clientLeads.filter((l) => l.status === 'contacted').length,
    };
  }, [clientLeads]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('he-IL', { year: '2-digit', month: '2-digit', day: '2-digit' });
  };

  const getStatusLabel = (status: LeadStatus) => {
    return STATUSES.find((s) => s.id === status)?.label || status;
  };

  const getStatusColor = (status: LeadStatus) => {
    return STATUSES.find((s) => s.id === status)?.color || '#6b7280';
  };

  const handleColumnSort = (column: TableSortBy) => {
    if (tableSortBy === column) {
      setTableSortDir(tableSortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setTableSortBy(column);
      setTableSortDir('asc');
    }
  };

  if (loading) {
    return (
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem 0' }}>
          <p style={{ color: 'var(--foreground-muted)' }}>טוען לידים...</p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '0' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Header */}
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--foreground)', margin: 0 }}>
            לידים מקמפיינים
          </h1>
          <p style={{ color: 'var(--foreground-muted)', fontSize: '0.92rem', marginTop: '0.25rem' }}>
            צפה בלידים שהתקבלו מהקמפיינים שלך
          </p>
        </div>

        {/* Summary Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
          }}
        >
          {/* Total Leads */}
          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '0.75rem',
              padding: '1.5rem',
            }}
          >
            <p style={{ color: 'var(--foreground-muted)', fontSize: '0.85rem', margin: 0, marginBottom: '0.5rem' }}>
              סה״כ לידים
            </p>
            <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--foreground)', margin: 0 }}>
              {stats.total}
            </p>
          </div>

          {/* New This Week */}
          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '0.75rem',
              padding: '1.5rem',
            }}
          >
            <p style={{ color: 'var(--foreground-muted)', fontSize: '0.85rem', margin: 0, marginBottom: '0.5rem' }}>
              חדשים בשבוע
            </p>
            <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#3b82f6', margin: 0 }}>
              {stats.newThisWeek}
            </p>
          </div>

          {/* Contacted */}
          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '0.75rem',
              padding: '1.5rem',
            }}
          >
            <p style={{ color: 'var(--foreground-muted)', fontSize: '0.85rem', margin: 0, marginBottom: '0.5rem' }}>
              בקשר
            </p>
            <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#f59e0b', margin: 0 }}>
              {stats.contacted}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '0.75rem',
            backgroundColor: 'var(--surface)',
            padding: '1rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--border)',
          }}
        >
          <input
            type="text"
            placeholder="חפש לפי שם, אימייל או טלפון..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              gridColumn: '1 / -1',
              padding: '0.75rem',
              backgroundColor: 'var(--surface-raised)',
              border: '1px solid var(--border)',
              borderRadius: '0.5rem',
              color: 'var(--foreground)',
              fontSize: '0.9rem',
            }}
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              padding: '0.75rem',
              backgroundColor: 'var(--surface-raised)',
              border: '1px solid var(--border)',
              borderRadius: '0.5rem',
              color: 'var(--foreground)',
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            <option value="all">כל הסטטוסים</option>
            {STATUSES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            style={{
              padding: '0.75rem',
              backgroundColor: 'var(--surface-raised)',
              border: '1px solid var(--border)',
              borderRadius: '0.5rem',
              color: 'var(--foreground)',
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            <option value="all">כל המקורות</option>
            {SOURCE_OPTIONS.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '0.75rem',
            overflow: 'hidden',
          }}
        >
          {filteredLeads.length === 0 ? (
            <div
              style={{
                padding: '3rem 1.5rem',
                textAlign: 'center',
                color: 'var(--foreground-muted)',
              }}
            >
              {clientLeads.length === 0
                ? 'אין לידים עדיין'
                : 'לא נמצאו לידים התואמים לחיפוש'}
            </div>
          ) : (
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
              }}
            >
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th
                    onClick={() => handleColumnSort('name')}
                    style={{
                      padding: '1rem',
                      textAlign: 'right',
                      fontWeight: 600,
                      color: tableSortBy === 'name' ? 'var(--accent)' : 'var(--foreground)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      transition: 'color 150ms ease',
                      fontSize: '0.9rem',
                    }}
                  >
                    שם {tableSortBy === 'name' && (tableSortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => handleColumnSort('phone')}
                    style={{
                      padding: '1rem',
                      textAlign: 'right',
                      fontWeight: 600,
                      color: tableSortBy === 'phone' ? 'var(--accent)' : 'var(--foreground)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      transition: 'color 150ms ease',
                      fontSize: '0.9rem',
                    }}
                  >
                    טלפון {tableSortBy === 'phone' && (tableSortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    style={{
                      padding: '1rem',
                      textAlign: 'right',
                      fontWeight: 600,
                      color: 'var(--foreground)',
                      fontSize: '0.9rem',
                    }}
                  >
                    אימייל
                  </th>
                  <th
                    style={{
                      padding: '1rem',
                      textAlign: 'right',
                      fontWeight: 600,
                      color: 'var(--foreground)',
                      fontSize: '0.9rem',
                    }}
                  >
                    מקור
                  </th>
                  <th
                    onClick={() => handleColumnSort('status')}
                    style={{
                      padding: '1rem',
                      textAlign: 'right',
                      fontWeight: 600,
                      color: tableSortBy === 'status' ? 'var(--accent)' : 'var(--foreground)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      transition: 'color 150ms ease',
                      fontSize: '0.9rem',
                    }}
                  >
                    סטטוס {tableSortBy === 'status' && (tableSortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => handleColumnSort('created')}
                    style={{
                      padding: '1rem',
                      textAlign: 'right',
                      fontWeight: 600,
                      color: tableSortBy === 'created' ? 'var(--accent)' : 'var(--foreground)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      transition: 'color 150ms ease',
                      fontSize: '0.9rem',
                    }}
                  >
                    תאריך {tableSortBy === 'created' && (tableSortDir === 'asc' ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead, idx) => (
                  <tr
                    key={lead.id}
                    style={{
                      borderBottom: idx !== filteredLeads.length - 1 ? '1px solid var(--border)' : 'none',
                      backgroundColor: idx % 2 === 0 ? 'transparent' : 'var(--surface-raised)',
                      transition: 'background-color 150ms ease',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        idx % 2 === 0 ? 'var(--surface-raised)' : 'var(--surface)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        idx % 2 === 0 ? 'transparent' : 'var(--surface-raised)';
                    }}
                  >
                    <td style={{ padding: '1rem', color: 'var(--foreground)', fontSize: '0.9rem' }}>
                      {lead.fullName}
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--foreground)', fontSize: '0.9rem' }}>
                      {lead.phone || '—'}
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--foreground)', fontSize: '0.9rem' }}>
                      {lead.email}
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--foreground-muted)', fontSize: '0.9rem' }}>
                      {lead.source || '—'}
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.9rem' }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.35rem 0.75rem',
                          backgroundColor: getStatusColor(lead.status) + '15',
                          color: getStatusColor(lead.status),
                          borderRadius: '0.35rem',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <div
                          style={{
                            width: '0.4rem',
                            height: '0.4rem',
                            borderRadius: '50%',
                            backgroundColor: getStatusColor(lead.status),
                          }}
                        />
                        {getStatusLabel(lead.status)}
                      </div>
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--foreground-muted)', fontSize: '0.9rem' }}>
                      {formatDate(lead.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
