'use client';

import { useState, useEffect } from 'react';
import { useAISettings } from '@/lib/api/use-entity';

interface AISettings {
  id: string;
  provider: 'openai' | 'anthropic';
  apiKey: string;
  defaultModel: string;
  connectionStatus: 'connected' | 'invalid_key' | 'missing_key' | 'untested';
  lastTestedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TestConnectionResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export default function AISettingsPage() {
  const { data: aiSettingsList, loading, update, create } = useAISettings();

  const [provider, setProvider] = useState<'openai' | 'anthropic'>('openai');
  const [apiKey, setApiKey] = useState('');
  const [defaultModel, setDefaultModel] = useState('gpt-4.1');
  const [showApiKey, setShowApiKey] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'invalid_key' | 'missing_key' | 'untested'>('untested');
  const [lastTestedAt, setLastTestedAt] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testMessage, setTestMessage] = useState('');
  const [testError, setTestError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (aiSettingsList && aiSettingsList.length > 0) {
      const settings = aiSettingsList[0];
      setProvider(settings.provider);
      setApiKey(settings.apiKey);
      setDefaultModel(settings.defaultModel);
      setConnectionStatus(settings.connectionStatus);
      setLastTestedAt(settings.lastTestedAt);
    }
  }, [aiSettingsList]);

  const handleTestConnection = async () => {
    if (!apiKey) {
      setTestError('חסר מפתח API');
      setConnectionStatus('missing_key');
      return;
    }

    setTestingConnection(true);
    setTestMessage('');
    setTestError('');

    try {
      const res = await fetch('/api/ai/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey,
          model: defaultModel,
        }),
      });

      const data: TestConnectionResponse = await res.json();

      if (data.success) {
        setConnectionStatus('connected');
        setTestMessage(data.message || 'החיבור בוצע בהצלחה');
        setLastTestedAt(new Date().toISOString());
      } else {
        setTestError(data.error || 'שגיאה בחיבור');
        setConnectionStatus('invalid_key');
      }
    } catch (err) {
      setTestError('שגיאה בבדיקת החיבור');
      setConnectionStatus('invalid_key');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey) {
      alert('יש להזין מפתח API');
      return;
    }

    setSaving(true);
    try {
      const settingsData: Partial<AISettings> = {
        provider,
        apiKey,
        defaultModel,
        connectionStatus,
        lastTestedAt,
      };

      if (aiSettingsList && aiSettingsList.length > 0) {
        await update(aiSettingsList[0].id, settingsData);
      } else {
        await create(settingsData);
      }

      alert('ההגדרות נשמרו בהצלחה');
    } catch (err) {
      alert('שגיאה בשמירת ההגדרות');
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'connected':
        return '#10B981';
      case 'invalid_key':
        return '#EF4444';
      case 'missing_key':
        return '#FBBF24';
      default:
        return '#9CA3AF';
    }
  };

  const getStatusBadgeText = (status: string) => {
    switch (status) {
      case 'connected':
        return 'מחובר';
      case 'invalid_key':
        return 'מפתח לא תקין';
      case 'missing_key':
        return 'חסר מפתח';
      default:
        return 'לא נבדק';
    }
  };

  return (
    <div style={{ direction: 'rtl', padding: '2rem', backgroundColor: 'var(--surface-raised)', borderRadius: '0.5rem' }}>
      <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--foreground)' }}>
        הגדרות AI
      </h1>
      <p style={{ color: 'var(--foreground-muted)', marginBottom: '2rem' }}>
        הגדרות אלה משמשות ליצירת דיאגרמות Gantt, הצעות תוכן, הערות על לקוחות, והצעות לקהל יעד.
      </p>

      {/* Provider Selection */}
      <div style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'block', marginBottom: '1rem', color: 'var(--foreground)', fontWeight: '500' }}>
          ספק API:
        </label>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="radio"
              name="provider"
              value="openai"
              checked={provider === 'openai'}
              onChange={(e) => setProvider(e.target.value as 'openai' | 'anthropic')}
            />
            <span>OpenAI</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="radio"
              name="provider"
              value="anthropic"
              checked={provider === 'anthropic'}
              onChange={(e) => setProvider(e.target.value as 'openai' | 'anthropic')}
            />
            <span>Anthropic</span>
          </label>
        </div>
      </div>

      {/* API Key Input */}
      <div style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--foreground)', fontWeight: '500' }}>
          מפתח API:
        </label>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type={showApiKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="form-input"
            style={{
              flex: 1,
              padding: '0.5rem 0.75rem',
              border: `1px solid var(--border)`,
              borderRadius: '0.375rem',
              backgroundColor: 'var(--surface-raised)',
              color: 'var(--foreground)',
            }}
          />
          <button
            onClick={() => setShowApiKey(!showApiKey)}
            style={{
              padding: '0.5rem 0.75rem',
              backgroundColor: 'var(--surface-raised)',
              border: `1px solid var(--border)`,
              borderRadius: '0.375rem',
              cursor: 'pointer',
              color: 'var(--foreground)',
            }}
          >
            {showApiKey ? 'הסתר' : 'הצג'}
          </button>
        </div>
      </div>

      {/* Default Model Input */}
      <div style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--foreground)', fontWeight: '500' }}>
          מודל ברירת מחדל:
        </label>
        <input
          type="text"
          value={defaultModel}
          onChange={(e) => setDefaultModel(e.target.value)}
          placeholder="gpt-4.1"
          className="form-input"
          style={{
            width: '100%',
            padding: '0.5rem 0.75rem',
            border: `1px solid var(--border)`,
            borderRadius: '0.375rem',
            backgroundColor: 'var(--surface-raised)',
            color: 'var(--foreground)',
          }}
        />
      </div>

      {/* Connection Status */}
      <div style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--foreground)', fontWeight: '500' }}>
          סטטוס חיבור:
        </label>
        <div
          style={{
            display: 'inline-block',
            padding: '0.375rem 0.75rem',
            backgroundColor: getStatusBadgeColor(connectionStatus),
            color: 'white',
            borderRadius: '0.25rem',
            fontSize: '0.875rem',
            fontWeight: '500',
          }}
        >
          {getStatusBadgeText(connectionStatus)}
        </div>
      </div>

      {/* Last Tested Display */}
      {lastTestedAt && (
        <div style={{ marginBottom: '2rem', fontSize: '0.875rem', color: 'var(--foreground-muted)' }}>
          בדוק לאחרונה: {new Date(lastTestedAt).toLocaleString('he-IL')}
        </div>
      )}

      {/* Test Message/Error */}
      {testMessage && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            backgroundColor: '#D1FAE5',
            color: '#065F46',
            borderRadius: '0.375rem',
            fontSize: '0.875rem',
          }}
        >
          {testMessage}
        </div>
      )}
      {testError && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            backgroundColor: '#FEE2E2',
            color: '#7F1D1D',
            borderRadius: '0.375rem',
            fontSize: '0.875rem',
          }}
        >
          {testError}
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-start' }}>
        <button
          onClick={handleTestConnection}
          disabled={testingConnection || !apiKey}
          className="mod-btn-ghost"
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'transparent',
            border: `1px solid var(--border)`,
            color: 'var(--foreground)',
            borderRadius: '0.375rem',
            cursor: testingConnection || !apiKey ? 'not-allowed' : 'pointer',
            opacity: testingConnection || !apiKey ? 0.5 : 1,
          }}
        >
          {testingConnection ? 'בודק...' : 'בדוק חיבור'}
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !apiKey}
          className="mod-btn-primary"
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'var(--accent)',
            color: 'white',
            borderRadius: '0.375rem',
            border: 'none',
            cursor: saving || !apiKey ? 'not-allowed' : 'pointer',
            opacity: saving || !apiKey ? 0.5 : 1,
            fontWeight: '500',
          }}
        >
          {saving ? 'שומר...' : 'שמור'}
        </button>
      </div>

      {/* Info Box */}
      <div
        style={{
          marginTop: '2rem',
          padding: '1rem',
          backgroundColor: '#EFF6FF',
          border: `1px solid var(--border)`,
          borderRadius: '0.375rem',
          color: '#003366',
          fontSize: '0.875rem',
          lineHeight: '1.5',
        }}
      >
        <strong>מידע:</strong> הגדרות אלה משמשות לתכניות דינמיות, הצעות תוכן חכמות, ניתוח לקוחות, והמלצות קהל.
      </div>
    </div>
  );
}
