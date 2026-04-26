'use client';

import { useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useClientFiles } from '@/lib/api/use-entity';

type FileCategory = 'all' | 'approved_final' | 'branding' | 'general' | 'social_media';

const categoryLabels: Record<FileCategory, string> = {
  all: 'כל הקבצים',
  approved_final: 'תוכן מאושר',
  branding: 'מיתוג',
  general: 'פרויקטים',
  social_media: 'מסמכים',
};

const getFileTypeIcon = (fileType: string): string => {
  const iconMap: Record<string, string> = {
    video: '🎬',
    image: '🖼️',
    document: '📄',
    pdf: '📋',
    draft: '📝',
    other: '📎',
  };
  return iconMap[fileType] || '📎';
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

function FilesContentInner() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get('clientId');

  const { data: files } = useClientFiles();

  const [selectedCategory, setSelectedCategory] = useState<FileCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter by clientId and exclude accountant category
  const clientFiles = useMemo(() => {
    return files.filter(f => f.clientId === clientId && f.category !== 'accountant');
  }, [files, clientId]);

  // Filter by category and search query
  const filteredFiles = useMemo(() => {
    let result = clientFiles;

    // Filter by category
    if (selectedCategory !== 'all') {
      result = result.filter(f => f.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(f => f.fileName.toLowerCase().includes(query));
    }

    // Sort by createdAt descending
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [clientFiles, selectedCategory, searchQuery]);

  const getCategoryBadgeColor = (category: string): string => {
    const colorMap: Record<string, string> = {
      approved_final: '#22c55e',
      branding: '#3b82f6',
      general: '#0092cc',
      social_media: '#f59e0b',
      agreements: '#06b6d4',
    };
    return colorMap[category] || '#a1a1aa';
  };

  return (
    <div style={{ direction: 'rtl' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
          קבצים
        </h1>
        <p style={{ fontSize: '1rem', color: 'var(--foreground-muted)', margin: 0 }}>
          {filteredFiles.length} קבצים זמינים
        </p>
      </div>

      {/* Category Filter Tabs */}
      <div style={{ marginBottom: '2rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            minWidth: 'max-content',
          }}
        >
          {(Object.entries(categoryLabels) as [FileCategory, string][]).map(([category, label]) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              style={{
                padding: '0.75rem 1.25rem',
                backgroundColor: selectedCategory === category ? 'var(--accent)' : 'var(--surface)',
                color: selectedCategory === category ? '#000' : 'var(--foreground)',
                border: selectedCategory === category ? 'none' : `1px solid var(--border)`,
                borderRadius: '0.5rem',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 250ms ease',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => {
                if (selectedCategory !== category) {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-raised)';
                }
              }}
              onMouseLeave={e => {
                if (selectedCategory !== category) {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface)';
                }
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: '2rem' }}>
        <input
          type="text"
          placeholder="חפש בקבצים..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            backgroundColor: 'var(--surface)',
            border: `1px solid var(--border)`,
            borderRadius: '0.5rem',
            fontSize: '1rem',
            color: 'var(--foreground)',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
            transition: 'all 250ms ease',
          }}
          onFocus={e => {
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.backgroundColor = 'var(--surface-raised)';
          }}
          onBlur={e => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.backgroundColor = 'var(--surface)';
          }}
        />
      </div>

      {/* Files Grid */}
      {filteredFiles.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1.5rem',
          }}
        >
          {filteredFiles.map(file => (
            <a
              key={file.id}
              href={file.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                backgroundColor: 'var(--surface)',
                border: `1px solid var(--border)`,
                borderRadius: '0.75rem',
                padding: '1.5rem',
                textDecoration: 'none',
                color: 'inherit',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                transition: 'all 250ms ease',
              }}
              onMouseEnter={e => {
                const elem = e.currentTarget as HTMLElement;
                elem.style.borderColor = 'var(--accent)';
                elem.style.backgroundColor = 'var(--surface-raised)';
                elem.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                const elem = e.currentTarget as HTMLElement;
                elem.style.borderColor = 'var(--border)';
                elem.style.backgroundColor = 'var(--surface)';
                elem.style.transform = 'translateY(0)';
              }}
            >
              {/* File Icon and Type */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    fontSize: '2rem',
                    flexShrink: 0,
                    width: '3rem',
                    height: '3rem',
                    borderRadius: '0.5rem',
                    backgroundColor: 'var(--accent-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {getFileTypeIcon(file.fileType)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: '0.875rem',
                      color: 'var(--foreground-muted)',
                      margin: '0 0 0.25rem 0',
                    }}
                  >
                    {file.fileType === 'video'
                      ? 'וידאו'
                      : file.fileType === 'image'
                      ? 'תמונה'
                      : file.fileType === 'document'
                      ? 'מסמך'
                      : file.fileType === 'pdf'
                      ? 'PDF'
                      : 'קובץ'}
                  </p>
                  <p
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--foreground-subtle)',
                      margin: 0,
                    }}
                  >
                    {formatFileSize(file.fileSize)}
                  </p>
                </div>
              </div>

              {/* File Name */}
              <div>
                <h3
                  style={{
                    fontSize: '1rem',
                    fontWeight: 600,
                    margin: '0 0 0.5rem 0',
                    wordBreak: 'break-word',
                    color: 'var(--foreground)',
                  }}
                >
                  {file.fileName}
                </h3>
              </div>

              {/* Category Badge and Date */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    padding: '0.375rem 0.875rem',
                    backgroundColor: `${getCategoryBadgeColor(file.category)}20`,
                    color: getCategoryBadgeColor(file.category),
                    borderRadius: '0.375rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {categoryLabels[file.category as FileCategory] || file.category}
                </span>
                <p
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--foreground-muted)',
                    margin: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatDate(file.createdAt)}
                </p>
              </div>

              {/* Notes intentionally hidden from client portal — may contain internal staff notes */}

              {/* Download indicator */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  marginTop: '0.5rem',
                  padding: '0.75rem',
                  backgroundColor: 'var(--accent-muted)',
                  borderRadius: '0.375rem',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: 'var(--accent)',
                  transition: 'all 250ms ease',
                }}
              >
                <span>הורדה</span>
                <span>↓</span>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: `1px solid var(--border)`,
            borderRadius: '0.75rem',
            padding: '3rem 1.5rem',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--foreground)', margin: '0 0 0.5rem 0' }}>
            {searchQuery.trim() ? 'לא נמצאו קבצים' : 'אין קבצים בקטגוריה זו'}
          </p>
          <p style={{ color: 'var(--foreground-muted)', fontSize: '1rem', margin: 0 }}>
            {searchQuery.trim()
              ? 'נסה לחפש בקטגוריה אחרת או חפש בשם אחר'
              : 'בקרוב יהיו קבצים זמינים'}
          </p>
        </div>
      )}
    </div>
  );
}

export default function FilesContent() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>...טוען</div>}>
      <FilesContentInner />
    </Suspense>
  );
}
