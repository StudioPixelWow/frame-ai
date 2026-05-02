'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth, type AppRole } from '@/lib/auth/auth-context';

interface Employee { id: string; name: string }
interface ClientItem { id: string; name: string }

const ROLES: { value: AppRole; label: string; icon: string; color: string }[] = [
  { value: 'admin', label: 'מנהל', icon: '👑', color: '#f59e0b' },
  { value: 'employee', label: 'עובד', icon: '👤', color: '#6366f1' },
  { value: 'client', label: 'לקוח', icon: '🏢', color: '#22c55e' },
];

export function RoleSwitcher() {
  const { role, setRole, employeeId, setEmployeeId, clientId, setClientId } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [showPicker, setShowPicker] = useState<'employee' | 'client' | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowPicker(null);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [isOpen]);

  // Fetch employees/clients when dropdown opens
  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/data/employees', { headers: { 'x-app-role': 'admin' } })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setEmployees(data); })
      .catch(() => {});
    fetch('/api/data/clients', { headers: { 'x-app-role': 'admin' } })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setClients(data); })
      .catch(() => {});
  }, [isOpen]);

  const current = ROLES.find(r => r.value === role) || ROLES[0];

  const handleRoleSelect = (r: AppRole) => {
    if (r === 'employee') {
      setShowPicker('employee');
    } else if (r === 'client') {
      setShowPicker('client');
    } else {
      setRole(r);
      setEmployeeId(null);
      setClientId(null);
      setIsOpen(false);
      setShowPicker(null);
    }
  };

  const handleEmployeePick = (emp: Employee) => {
    setRole('employee');
    setEmployeeId(emp.id);
    setClientId(null);
    setIsOpen(false);
    setShowPicker(null);
  };

  const handleClientPick = (cli: ClientItem) => {
    setRole('client');
    setClientId(cli.id);
    setEmployeeId(null);
    setIsOpen(false);
    setShowPicker(null);
  };

  // Find current names for display
  const empName = employees.find(e => e.id === employeeId)?.name;
  const cliName = clients.find(c => c.id === clientId)?.name;
  const subLabel = role === 'employee' && empName ? ` (${empName})` :
                   role === 'client' && cliName ? ` (${cliName})` : '';

  return (
    <div ref={ref} style={{ position: 'relative', direction: 'rtl' }}>
      <button
        onClick={() => { setIsOpen(!isOpen); setShowPicker(null); }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: '8px',
          border: `1px solid ${current.color}30`,
          background: `${current.color}10`,
          color: current.color,
          fontSize: '12px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s',
          maxWidth: '220px',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}
      >
        <span>{current.icon}</span>
        <span>{current.label}{subLabel}</span>
        <span style={{ fontSize: '10px', opacity: 0.6 }}>▼</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            background: '#1a1a2e',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px',
            padding: '6px',
            zIndex: 100,
            boxShadow: '0 12px 24px rgba(0,0,0,0.4)',
            minWidth: '180px',
            maxHeight: '320px',
            overflowY: 'auto',
          }}
        >
          {/* Role list */}
          {!showPicker && ROLES.map(r => (
            <button
              key={r.value}
              onClick={() => handleRoleSelect(r.value)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                borderRadius: '6px',
                background: role === r.value ? `${r.color}15` : 'transparent',
                color: role === r.value ? r.color : '#94a3b8',
                fontSize: '13px',
                fontWeight: role === r.value ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
                textAlign: 'right',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = `${r.color}10`; }}
              onMouseLeave={e => { e.currentTarget.style.background = role === r.value ? `${r.color}15` : 'transparent'; }}
            >
              <span>{r.icon}</span>
              <span>{r.label}</span>
              {role === r.value && <span style={{ marginRight: 'auto', fontSize: '10px' }}>✓</span>}
            </button>
          ))}

          {/* Employee picker */}
          {showPicker === 'employee' && (
            <div>
              <div style={{ padding: '8px 12px', fontSize: '11px', color: '#64748b', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                בחר עובד:
              </div>
              {employees.length === 0 && (
                <div style={{ padding: '12px', fontSize: '12px', color: '#475569', textAlign: 'center' }}>טוען...</div>
              )}
              {employees.map(emp => (
                <button
                  key={emp.id}
                  onClick={() => handleEmployeePick(emp)}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 12px',
                    border: 'none',
                    borderRadius: '6px',
                    background: employeeId === emp.id ? '#6366f115' : 'transparent',
                    color: employeeId === emp.id ? '#6366f1' : '#94a3b8',
                    fontSize: '13px',
                    cursor: 'pointer',
                    textAlign: 'right',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#6366f110'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = employeeId === emp.id ? '#6366f115' : 'transparent'; }}
                >
                  {emp.name || emp.id}
                </button>
              ))}
              <button
                onClick={() => setShowPicker(null)}
                style={{
                  display: 'block', width: '100%', padding: '6px 12px', border: 'none',
                  borderRadius: '6px', background: 'transparent', color: '#64748b',
                  fontSize: '11px', cursor: 'pointer', marginTop: '4px', textAlign: 'right',
                }}
              >
                ← חזור
              </button>
            </div>
          )}

          {/* Client picker */}
          {showPicker === 'client' && (
            <div>
              <div style={{ padding: '8px 12px', fontSize: '11px', color: '#64748b', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                בחר לקוח:
              </div>
              {clients.length === 0 && (
                <div style={{ padding: '12px', fontSize: '12px', color: '#475569', textAlign: 'center' }}>טוען...</div>
              )}
              {clients.map(cli => (
                <button
                  key={cli.id}
                  onClick={() => handleClientPick(cli)}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 12px',
                    border: 'none',
                    borderRadius: '6px',
                    background: clientId === cli.id ? '#22c55e15' : 'transparent',
                    color: clientId === cli.id ? '#22c55e' : '#94a3b8',
                    fontSize: '13px',
                    cursor: 'pointer',
                    textAlign: 'right',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#22c55e10'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = clientId === cli.id ? '#22c55e15' : 'transparent'; }}
                >
                  {cli.name || cli.id}
                </button>
              ))}
              <button
                onClick={() => setShowPicker(null)}
                style={{
                  display: 'block', width: '100%', padding: '6px 12px', border: 'none',
                  borderRadius: '6px', background: 'transparent', color: '#64748b',
                  fontSize: '11px', cursor: 'pointer', marginTop: '4px', textAlign: 'right',
                }}
              >
                ← חזור
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
