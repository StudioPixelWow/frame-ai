'use client';

import { useEffect } from 'react';

// ==================== TYPES ====================
export interface EvidenceItem {
  source_url: string;
  extracted_text_snippet: string;
  confidence: number;
  data_type: 'real' | 'simulated' | 'manual' | 'unavailable';
}

export interface EvidenceDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  evidence: EvidenceItem[];
}

// ==================== COLORS ====================
const COLORS = {
  primary: '#00B5FE',
  accent: '#E8F401',
  background: '#F7F9FC',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#666666',
  border: '#E8E8E8',
  green: '#22C55E',
  orange: '#FF9933',
  red: '#FF6B6B',
  yellow: '#FFC107',
};

// ==================== CONFIDENCE COLOR HELPER ====================
function getConfidenceColor(confidence: number): { bg: string; text: string; label: string } {
  if (confidence >= 70) {
    return { bg: '#E8F5E9', text: '#22C55E', label: `${confidence}% Confident` };
  }
  if (confidence >= 40) {
    return { bg: '#FFF3E0', text: '#FF9933', label: `${confidence}% Confident` };
  }
  return { bg: '#FFEBEE', text: '#FF6B6B', label: `${confidence}% Confident` };
}

// ==================== DATA TYPE BADGE HELPER ====================
function getDataTypeStyle(dataType: string): { bg: string; text: string; label: string } {
  switch (dataType) {
    case 'real':
      return { bg: '#E8F5E9', text: '#22C55E', label: 'Real Data' };
    case 'simulated':
      return { bg: '#FFF3E0', text: '#FF9933', label: 'Simulated' };
    case 'manual':
      return { bg: '#E3F2FD', text: '#0066FF', label: 'Manual Entry' };
    case 'unavailable':
      return { bg: '#F5F5F5', text: '#999999', label: 'Unavailable' };
    default:
      return { bg: '#F5F5F5', text: '#999999', label: dataType };
  }
}

// ==================== MAIN COMPONENT ====================
export function EvidenceDrawer({ open, onClose, title, evidence }: EvidenceDrawerProps) {
  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };

    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          zIndex: 999,
        }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: '480px',
          maxWidth: '90vw',
          backgroundColor: COLORS.card,
          boxShadow: '-4px 0 16px rgba(0, 0, 0, 0.15)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideIn 0.3s ease-out',
        }}
      >
        <style>{`
          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
          .evidence-quote {
            background: ${COLORS.background};
            border-left: 4px solid ${COLORS.primary};
            padding: 16px;
            border-radius: 8px;
            font-style: italic;
            font-size: 14px;
            color: ${COLORS.text};
            line-height: 1.6;
            margin: 12px 0;
          }
          .evidence-item {
            padding: 20px;
            border-bottom: 1px solid ${COLORS.border};
          }
          .evidence-item:last-of-type {
            border-bottom: none;
          }
          .evidence-link {
            color: ${COLORS.primary};
            text-decoration: none;
            word-break: break-all;
            font-size: 13px;
            margin: 12px 0;
            display: inline-block;
          }
          .evidence-link:hover {
            text-decoration: underline;
          }
          .badge {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 600;
            margin: 4px 4px 4px 0;
          }
        `}</style>

        {/* Header */}
        <div
          style={{
            padding: '20px',
            borderBottom: `1px solid ${COLORS.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: COLORS.text, margin: 0 }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: COLORS.textMuted,
              padding: '4px 8px',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            paddingBottom: '20px',
          }}
        >
          {evidence.length === 0 ? (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: COLORS.textMuted,
              }}
            >
              <p style={{ margin: 0 }}>No evidence available</p>
            </div>
          ) : (
            evidence.map((item, idx) => {
              const confidenceStyle = getConfidenceColor(item.confidence);
              const dataTypeStyle = getDataTypeStyle(item.data_type);

              return (
                <div key={idx} className="evidence-item">
                  {/* Source URL */}
                  <a
                    href={item.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="evidence-link"
                    title={item.source_url}
                  >
                    🔗 {item.source_url}
                  </a>

                  {/* Extracted Text Snippet */}
                  <div className="evidence-quote">
                    "{item.extracted_text_snippet}"
                  </div>

                  {/* Badges */}
                  <div style={{ marginTop: '12px' }}>
                    <div
                      className="badge"
                      style={{ background: confidenceStyle.bg, color: confidenceStyle.text }}
                    >
                      {confidenceStyle.label}
                    </div>
                    <div
                      className="badge"
                      style={{ background: dataTypeStyle.bg, color: dataTypeStyle.text }}
                    >
                      {dataTypeStyle.label}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: `1px solid ${COLORS.border}`,
            backgroundColor: COLORS.background,
            fontSize: '12px',
            color: COLORS.textMuted,
            flexShrink: 0,
          }}
        >
          Evidence is extracted from website scans and verified data sources.
        </div>
      </div>
    </>
  );
}
