'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/toast';
import { useAISettings, useEmployees, useGmailSettings } from '@/lib/api/use-entity';
import type { GmailConnectionStatus } from '@/lib/db/schema';

type Section = 'general' | 'ai' | 'email' | 'gmail' | 'whatsapp' | 'notifications' | 'appearance' | 'automation' | 'team' | 'integrations' | 'stockmedia';

interface GeneralSettings {
  studioName: string;
  businessPhone: string;
  businessEmail: string;
  defaultLanguage: 'he' | 'en';
  defaultCurrency: 'ILS' | 'USD' | 'EUR';
  timezone: string;
}

interface EmailSettings {
  senderName: string;
  senderEmail: string;
  replyToEmail: string;
  approvalEmails: boolean;
  paymentReminders: boolean;
  weeklyClientMailing: boolean;
  accountantExport: boolean;
}

interface WhatsAppSettings {
  providerName: string;
  senderNumber: string;
  isConnected: boolean;
  isEnabled: boolean;
}

interface NotificationSettings {
  inAppNotifications: boolean;
  emailNotifications: boolean;
  soundNotifications: boolean;
  soundVolume: number;
  approvalNotifications: boolean;
  paymentNotifications: boolean;
  ganttAlerts: boolean;
  leadFollowups: boolean;
  employeeTaskNotifications: boolean;
}

interface AutomationSettings {
  followUpTiming: '1_day' | '2_days' | '3_days' | '1_week';
  approvalNotificationEnabled: boolean;
  approvalNotificationTiming: '0_hours' | '2_hours' | '4_hours' | '1_day';
  ganttAlertTiming: '1_week' | '3_days' | '1_day';
  weeklyMailingDay: 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri';
  weeklyMailingTime: string;
  paymentReminderTiming: '3_days' | '1_day' | 'on_due' | '1_day_after';
}

const WHATSAPP_TEMPLATES = [
  { id: 1, name: 'אישור קבלת הודעה', category: 'אישורים' },
  { id: 2, name: 'תזכורת תשלום', category: 'תשלומים' },
  { id: 3, name: 'עדכון סטטוס פרויקט', category: 'פרויקטים' },
  { id: 4, name: 'זימון לישיבת ייעוץ', category: 'פגישות' },
  { id: 5, name: 'הודעת סיום', category: 'סיום' },
];

const ROLE_COLORS: Record<string, string> = {
  admin: '#ef4444',
  manager: '#3b82f6',
  employee: '#22c55e',
  viewer: '#94a3b8',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'אדמין',
  manager: 'מנהל',
  employee: 'עובד',
  viewer: 'צופה',
};

export default function SettingsPage() {
  const toast = useToast();
  const [activeSection, setActiveSection] = useState<Section>('general');
  const [theme, setTheme] = useState<'dark' | 'light' | 'auto'>('auto');

  const aiSettings = useAISettings();
  const employees = useEmployees();
  const gmailSettingsHook = useGmailSettings();

  // Gmail state
  const [gmailStatus, setGmailStatus] = useState<GmailConnectionStatus>('not_connected');
  const [gmailEmail, setGmailEmail] = useState('');
  const [gmailSenderName, setGmailSenderName] = useState('Studio Pixel');
  const [gmailReplyTo, setGmailReplyTo] = useState('');
  const [gmailSignature, setGmailSignature] = useState('');
  const [gmailLastSync, setGmailLastSync] = useState<string | null>(null);
  const [gmailLastError, setGmailLastError] = useState('');
  const [gmailConnecting, setGmailConnecting] = useState(false);
  const [gmailTesting, setGmailTesting] = useState(false);
  const [gmailSetupError, setGmailSetupError] = useState('');
  const [gmailConfigStatus, setGmailConfigStatus] = useState<{
    configured: boolean;
    vars: { GOOGLE_CLIENT_ID: boolean; GOOGLE_CLIENT_SECRET: boolean; GOOGLE_REDIRECT_URI: boolean };
    redirectUri: string;
    isLocalhost: boolean;
    clientIdPreview: string | null;
  } | null>(null);
  const [showSetupHelp, setShowSetupHelp] = useState(false);

  // Local state for all settings
  const [general, setGeneral] = useState<GeneralSettings>({
    studioName: 'Studio Pixel',
    businessPhone: '',
    businessEmail: '',
    defaultLanguage: 'he',
    defaultCurrency: 'ILS',
    timezone: 'Asia/Jerusalem',
  });

  const [email, setEmail] = useState<EmailSettings>({
    senderName: '',
    senderEmail: '',
    replyToEmail: '',
    approvalEmails: true,
    paymentReminders: true,
    weeklyClientMailing: true,
    accountantExport: false,
  });

  const [whatsapp, setWhatsapp] = useState<WhatsAppSettings>({
    providerName: 'WhatsApp Business API',
    senderNumber: '+972',
    isConnected: false,
    isEnabled: true,
  });

  const [notifications, setNotifications] = useState<NotificationSettings>({
    inAppNotifications: true,
    emailNotifications: true,
    soundNotifications: false,
    soundVolume: 70,
    approvalNotifications: true,
    paymentNotifications: true,
    ganttAlerts: true,
    leadFollowups: true,
    employeeTaskNotifications: true,
  });

  const [automation, setAutomation] = useState<AutomationSettings>({
    followUpTiming: '3_days',
    approvalNotificationEnabled: true,
    approvalNotificationTiming: '2_hours',
    ganttAlertTiming: '3_days',
    weeklyMailingDay: 'sun',
    weeklyMailingTime: '09:00',
    paymentReminderTiming: '3_days',
  });

  // OpenAI / Whisper state
  const [aiProvider, setAiProvider] = useState<'openai' | 'anthropic'>('openai');
  const [aiApiKey, setAiApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [aiModel, setAiModel] = useState('gpt-4o');
  const [aiConnectionStatus, setAiConnectionStatus] = useState<'connected' | 'invalid_key' | 'missing_key' | 'untested'>('untested');
  const [aiLastTestedAt, setAiLastTestedAt] = useState<string | null>(null);
  const [aiLastTestError, setAiLastTestError] = useState('');
  // AssemblyAI state
  const [assemblyaiApiKey, setAssemblyaiApiKey] = useState('');
  const [showAssemblyaiKey, setShowAssemblyaiKey] = useState(false);
  const [assemblyaiConnectionStatus, setAssemblyaiConnectionStatus] = useState<'connected' | 'invalid_key' | 'missing_key' | 'untested'>('untested');
  const [assemblyaiLastTestedAt, setAssemblyaiLastTestedAt] = useState<string | null>(null);
  const [assemblyaiLastTestError, setAssemblyaiLastTestError] = useState('');
  // Transcription priority
  const [primaryTranscription, setPrimaryTranscription] = useState<'assemblyai' | 'whisper'>('assemblyai');
  const [fallbackTranscription, setFallbackTranscription] = useState<'assemblyai' | 'whisper' | 'none'>('whisper');
  const [aiTestLoading, setAiTestLoading] = useState(false);
  const [assemblyaiTestLoading, setAssemblyaiTestLoading] = useState(false);

  // Stock media providers
  const [pexelsApiKey, setPexelsApiKey] = useState('');
  const [pexelsEnabled, setPexelsEnabled] = useState(false);
  const [pexelsStatus, setPexelsStatus] = useState<'connected' | 'untested' | 'error'>('untested');
  const [pexelsTestLoading, setPexelsTestLoading] = useState(false);
  const [showPexelsKey, setShowPexelsKey] = useState(false);

  const [pixabayApiKey, setPixabayApiKey] = useState('');
  const [pixabayEnabled, setPixabayEnabled] = useState(false);
  const [pixabayStatus, setPixabayStatus] = useState<'connected' | 'untested' | 'error'>('untested');
  const [pixabayTestLoading, setPixabayTestLoading] = useState(false);
  const [showPixabayKey, setShowPixabayKey] = useState(false);

  const [shutterstockApiKey, setShutterstockApiKey] = useState('');
  const [shutterstockApiSecret, setShutterstockApiSecret] = useState('');
  const [shutterstockEnabled, setShutterstockEnabled] = useState(false);
  const [shutterstockStatus, setShutterstockStatus] = useState<'connected' | 'untested' | 'error'>('untested');
  const [shutterstockTestLoading, setShutterstockTestLoading] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedGeneral = localStorage.getItem('settings_general');
    if (savedGeneral) setGeneral(JSON.parse(savedGeneral));

    const savedEmail = localStorage.getItem('settings_email');
    if (savedEmail) setEmail(JSON.parse(savedEmail));

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) setTheme(savedTheme as any);

    const savedAutomation = localStorage.getItem('settings_automation');
    if (savedAutomation) setAutomation(JSON.parse(savedAutomation));
  }, []);

  // Load AI settings from store
  useEffect(() => {
    const s = aiSettings.data?.[0];
    if (s) {
      setAiProvider(s.provider || 'openai');
      setAiApiKey(s.apiKey || '');
      setAiModel(s.defaultModel || 'gpt-4.1');
      setAiConnectionStatus(s.connectionStatus || 'untested');
      setAiLastTestedAt(s.lastTestedAt || null);
      setAiLastTestError(s.lastTestError || '');
      setAssemblyaiApiKey(s.assemblyaiApiKey || '');
      setAssemblyaiConnectionStatus(s.assemblyaiConnectionStatus || 'untested');
      setAssemblyaiLastTestedAt(s.assemblyaiLastTestedAt || null);
      setAssemblyaiLastTestError(s.assemblyaiLastTestError || '');
      setPrimaryTranscription(s.primaryTranscriptionProvider || 'assemblyai');
      setFallbackTranscription(s.fallbackTranscriptionProvider || 'whisper');
    }
  }, [aiSettings.data]);

  // Load Gmail settings from store
  useEffect(() => {
    const g = gmailSettingsHook.data?.[0];
    if (g) {
      setGmailStatus(g.connectionStatus || 'not_connected');
      setGmailEmail(g.connectedEmail || '');
      setGmailSenderName(g.senderDisplayName || 'Studio Pixel');
      setGmailReplyTo(g.replyToEmail || '');
      setGmailSignature(g.defaultSignature || '');
      setGmailLastSync(g.lastSyncAt || null);
      setGmailLastError(g.lastError || '');
    }
  }, [gmailSettingsHook.data]);

  // Pre-check Gmail OAuth availability & config status
  useEffect(() => {
    // Always fetch config status for dev info
    fetch('/api/auth/gmail/status').then(r => r.json()).then(data => {
      setGmailConfigStatus(data);
      if (!data.configured) {
        setGmailSetupError('חסרים משתני סביבה נדרשים לחיבור Gmail');
      } else {
        setGmailSetupError('');
      }
    }).catch(() => {});

    if (gmailStatus === 'not_connected') {
      fetch('/api/auth/gmail/url').then(async r => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          const err = data.error || '';
          if (err.includes('GOOGLE_CLIENT_ID') || err.includes('הגדרות השרת')) {
            setGmailSetupError(err);
          }
        }
      }).catch(() => {});
    }
  }, [gmailStatus]);

  // Load stock media settings on mount
  useEffect(() => {
    fetch('/api/stock-search/settings').then(r => r.json()).then(data => {
      if (data.pexels) { setPexelsApiKey(data.pexels.apiKey || ''); setPexelsEnabled(data.pexels.enabled ?? false); if (data.pexels.apiKey) setPexelsStatus('connected'); }
      if (data.pixabay) { setPixabayApiKey(data.pixabay.apiKey || ''); setPixabayEnabled(data.pixabay.enabled ?? false); if (data.pixabay.apiKey) setPixabayStatus('connected'); }
      if (data.shutterstock) { setShutterstockApiKey(data.shutterstock.apiKey || ''); setShutterstockApiSecret(data.shutterstock.apiSecret || ''); setShutterstockEnabled(data.shutterstock.enabled ?? false); }
    }).catch(() => {});
  }, []);

  // Gmail actions
  const handleGmailConnect = async () => {
    setGmailConnecting(true);
    try {
      // 1. Get the Google OAuth URL from our API
      const urlRes = await fetch('/api/auth/gmail/url');
      const urlData = await urlRes.json();
      if (!urlRes.ok || !urlData.url) {
        const errMsg = urlData.error || 'שגיאה בהתחלת חיבור Gmail';
        toast(errMsg, 'error');
        // Persist setup error for inline display
        if (errMsg.includes('GOOGLE_CLIENT_ID') || errMsg.includes('הגדרות השרת')) {
          setGmailSetupError(errMsg);
        }
        setGmailConnecting(false);
        return;
      }
      // Clear any previous setup error on successful URL fetch
      setGmailSetupError('');

      // 2. Open Google OAuth in a popup window
      const width = 520;
      const height = 640;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      const popup = window.open(
        urlData.url,
        'gmail-oauth',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`
      );

      if (!popup) {
        // Popup blocked — fallback to redirect
        toast('חלון הקופץ נחסם. מפנה לדף ההתחברות...', 'error');
        window.location.href = urlData.url;
        return;
      }

      // 3. Listen for the OAuth success message from the popup
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'gmail-oauth-success') {
          window.removeEventListener('message', handleMessage);
          clearInterval(pollTimer);
          setGmailStatus('connected');
          setGmailEmail(event.data.email || '');
          setGmailLastSync(new Date().toISOString());
          setGmailLastError('');
          toast('Gmail חובר בהצלחה', 'success');
          gmailSettingsHook.refetch();
          setGmailConnecting(false);
        }
      };
      window.addEventListener('message', handleMessage);

      // 4. Poll to detect if popup was closed without completing
      const pollTimer = setInterval(() => {
        if (popup.closed) {
          clearInterval(pollTimer);
          window.removeEventListener('message', handleMessage);
          // Check if we got connected (the message handler may have fired)
          gmailSettingsHook.refetch();
          setGmailConnecting(false);
        }
      }, 500);

    } catch (err: any) {
      console.error('[Gmail OAuth] Error:', err);
      toast('שגיאה בחיבור Gmail', 'error');
      setGmailConnecting(false);
    }
  };

  const handleGmailDisconnect = async () => {
    setGmailConnecting(true);
    try {
      const res = await fetch('/api/settings/gmail/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      });
      const data = await res.json();
      if (data.status === 'not_connected') {
        setGmailStatus('not_connected');
        setGmailEmail('');
        setGmailLastSync(null);
        setGmailLastError('');
        toast('Gmail נותק בהצלחה', 'success');
        gmailSettingsHook.refetch();
      }
    } catch {
      toast('שגיאה בניתוק Gmail', 'error');
    } finally {
      setGmailConnecting(false);
    }
  };

  const handleGmailReconnect = async () => {
    // Reconnect uses the same OAuth flow as connect
    await handleGmailConnect();
  };

  const handleGmailTest = async () => {
    setGmailTesting(true);
    try {
      const res = await fetch('/api/settings/gmail/test', { method: 'POST' });
      const data = await res.json();
      if (data.status === 'connected') {
        setGmailStatus('connected');
        setGmailLastSync(new Date().toISOString());
        setGmailLastError('');
        toast('בדיקת חיבור Gmail — תקין', 'success');
      } else {
        setGmailStatus(data.status === 'error' ? 'error' : 'not_connected');
        setGmailLastError(data.message || '');
        toast(data.message || 'שגיאה בבדיקת החיבור', 'error');
      }
    } catch {
      toast('שגיאה בבדיקת חיבור Gmail', 'error');
    } finally {
      setGmailTesting(false);
    }
  };

  const saveGmailSettings = async () => {
    const g = gmailSettingsHook.data?.[0];
    if (!g) return;
    try {
      await gmailSettingsHook.update(g.id, {
        senderDisplayName: gmailSenderName,
        replyToEmail: gmailReplyTo,
        defaultSignature: gmailSignature,
        updatedAt: new Date().toISOString(),
      });
      toast('הגדרות Gmail נשמרו בהצלחה', 'success');
    } catch {
      toast('שגיאה בשמירת הגדרות Gmail', 'error');
    }
  };

  // Save general settings
  const saveGeneralSettings = async () => {
    localStorage.setItem('settings_general', JSON.stringify(general));
    toast('הגדרות כלליות נשמרו בהצלחה', 'success');
  };

  // Test OpenAI / Whisper connection
  const testAiConnection = async () => {
    if (!aiApiKey) {
      setAiConnectionStatus('missing_key');
      toast('הזן מפתח API של OpenAI', 'error');
      return;
    }
    setAiTestLoading(true);
    try {
      const response = await fetch('/api/settings/test-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'openai', apiKey: aiApiKey }),
      });
      const result = await response.json();
      const now = new Date().toISOString();
      setAiLastTestedAt(now);
      if (result.status === 'connected') {
        setAiConnectionStatus('connected');
        setAiLastTestError('');
        toast('חיבור OpenAI תקין', 'success');
      } else {
        setAiConnectionStatus(result.status === 'missing_key' ? 'missing_key' : 'invalid_key');
        setAiLastTestError(result.message || 'שגיאה לא ידועה');
        toast(result.message || 'מפתח API שגוי', 'error');
      }
    } catch (error: any) {
      setAiConnectionStatus('invalid_key');
      setAiLastTestError(error.message || 'שגיאת רשת');
      toast('שגיאה בבדיקת החיבור', 'error');
    }
    setAiTestLoading(false);
  };

  // Test AssemblyAI connection
  const testAssemblyaiConnection = async () => {
    if (!assemblyaiApiKey) {
      setAssemblyaiConnectionStatus('missing_key');
      toast('הזן מפתח API של AssemblyAI', 'error');
      return;
    }
    setAssemblyaiTestLoading(true);
    try {
      const response = await fetch('/api/settings/test-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'assemblyai', apiKey: assemblyaiApiKey }),
      });
      const result = await response.json();
      const now = new Date().toISOString();
      setAssemblyaiLastTestedAt(now);
      if (result.status === 'connected') {
        setAssemblyaiConnectionStatus('connected');
        setAssemblyaiLastTestError('');
        toast('חיבור AssemblyAI תקין', 'success');
      } else {
        setAssemblyaiConnectionStatus(result.status === 'missing_key' ? 'missing_key' : 'invalid_key');
        setAssemblyaiLastTestError(result.message || 'שגיאה לא ידועה');
        toast(result.message || 'מפתח API שגוי', 'error');
      }
    } catch (error: any) {
      setAssemblyaiConnectionStatus('invalid_key');
      setAssemblyaiLastTestError(error.message || 'שגיאת רשת');
      toast('שגיאה בבדיקת החיבור', 'error');
    }
    setAssemblyaiTestLoading(false);
  };

  // Save all AI settings
  const saveAiSettings = async () => {
    try {
      const payload = {
        provider: aiProvider,
        apiKey: aiApiKey,
        defaultModel: aiModel,
        connectionStatus: aiConnectionStatus,
        lastTestedAt: aiLastTestedAt,
        lastTestError: aiLastTestError,
        assemblyaiApiKey,
        assemblyaiConnectionStatus,
        assemblyaiLastTestedAt,
        assemblyaiLastTestError,
        primaryTranscriptionProvider: primaryTranscription,
        fallbackTranscriptionProvider: fallbackTranscription,
        updatedAt: new Date().toISOString(),
      };
      const currentSettings = aiSettings.data?.[0];
      if (currentSettings) {
        await aiSettings.update(currentSettings.id, payload);
      } else {
        await aiSettings.create({
          ...payload,
          createdAt: new Date().toISOString(),
        } as any);
      }
      toast('כל הגדרות AI נשמרו בהצלחה', 'success');
    } catch (error) {
      toast('שגיאה בשמירה', 'error');
    }
  };

  // Save email settings
  const saveEmailSettings = async () => {
    localStorage.setItem('settings_email', JSON.stringify(email));
    toast('הגדרות אימייל נשמרו בהצלחה', 'success');
  };

  // Save WhatsApp settings
  const saveWhatsappSettings = async () => {
    localStorage.setItem('settings_whatsapp', JSON.stringify(whatsapp));
    toast('הגדרות WhatsApp נשמרו בהצלחה', 'success');
  };

  // Save notification settings
  const saveNotificationSettings = async () => {
    localStorage.setItem('settings_notifications', JSON.stringify(notifications));
    toast('הגדרות התראות נשמרו בהצלחה', 'success');
  };

  // Save automation settings
  const saveAutomationSettings = async () => {
    localStorage.setItem('settings_automation', JSON.stringify(automation));
    toast('ברירות מחדל אוטומציה נשמרו בהצלחה', 'success');
  };

  // Save stock media settings
  const saveStockSettings = async () => {
    try {
      await fetch('/api/stock-search/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pexels: { apiKey: pexelsApiKey, enabled: pexelsEnabled },
          pixabay: { apiKey: pixabayApiKey, enabled: pixabayEnabled },
          shutterstock: { apiKey: shutterstockApiKey, apiSecret: shutterstockApiSecret, enabled: shutterstockEnabled },
        }),
      });
      toast('הגדרות Stock Media נשמרו בהצלחה', 'success');
    } catch { toast('שגיאה בשמירת הגדרות', 'error'); }
  };

  const testStockProvider = async (provider: 'pexels' | 'pixabay' | 'shutterstock') => {
    const setLoading = provider === 'pexels' ? setPexelsTestLoading : provider === 'pixabay' ? setPixabayTestLoading : setShutterstockTestLoading;
    const setStatus = provider === 'pexels' ? setPexelsStatus : provider === 'pixabay' ? setPixabayStatus : setShutterstockStatus;
    const apiKey = provider === 'pexels' ? pexelsApiKey : provider === 'pixabay' ? pixabayApiKey : shutterstockApiKey;

    setLoading(true);
    try {
      const res = await fetch('/api/stock-search/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey, ...(provider === 'shutterstock' ? { apiSecret: shutterstockApiSecret } : {}) }),
      });
      const data = await res.json();
      setStatus(data.connected ? 'connected' : 'error');
      toast(data.connected ? `${provider} מחובר בהצלחה` : `שגיאה: ${data.error}`, data.connected ? 'success' : 'error');
    } catch { setStatus('error'); toast('שגיאה בבדיקת חיבור', 'error'); }
    setLoading(false);
  };

  // Handle theme change
  const handleThemeChange = (newTheme: 'dark' | 'light' | 'auto') => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    toast('הנושא שונה בהצלחה', 'success');
  };

  // Update employee role
  const updateEmployeeRole = async (employeeId: string, newRole: string) => {
    try {
      await employees.update(employeeId, {
        role: newRole as any,
      });
      toast('תפקיד העובד עודכן', 'success');
    } catch (error) {
      toast('שגיאה בעדכון תפקיד', 'error');
    }
  };

  const getAiConnectionStatusColor = () => {
    switch (aiConnectionStatus) {
      case 'connected':
        return '#22c55e';
      case 'invalid_key':
        return '#ef4444';
      case 'missing_key':
        return '#ef4444';
      default:
        return '#94a3b8';
    }
  };

  const getAiConnectionStatusText = () => {
    switch (aiConnectionStatus) {
      case 'connected':
        return 'מחובר';
      case 'invalid_key':
        return 'מפתח שגוי';
      case 'missing_key':
        return 'חסר מפתח';
      default:
        return 'לא נבדק';
    }
  };

  // Styles
  const mainContainerStyle: React.CSSProperties = {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: 'var(--surface)',
    direction: 'rtl',
  };

  const sidebarStyle: React.CSSProperties = {
    width: '250px',
    backgroundColor: 'var(--surface-raised)',
    borderLeft: '1px solid var(--border)',
    padding: '2rem 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    overflowY: 'auto',
    order: 2, // RTL: right side
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    padding: '2rem',
    overflowY: 'auto',
    order: 1, // RTL: left side
  };

  const navItemStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '0.75rem 1rem',
    marginRight: '0.5rem',
    marginLeft: '0.5rem',
    borderRadius: '8px',
    cursor: 'pointer',
    backgroundColor: isActive ? 'rgba(0, 181, 254, 0.15)' : 'transparent',
    color: isActive ? 'var(--accent)' : 'var(--foreground)',
    fontSize: '0.875rem',
    fontWeight: isActive ? 600 : 500,
    border: isActive ? '1px solid var(--accent)' : '1px solid transparent',
    transition: 'all 150ms ease',
    textAlign: 'right',
  });

  const sectionHeaderStyle: React.CSSProperties = {
    fontSize: '1.875rem',
    fontWeight: 700,
    color: 'var(--foreground)',
    marginBottom: '2rem',
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--surface-raised)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '1.5rem',
    marginBottom: '1.5rem',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--foreground)',
    marginBottom: '0.5rem',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    color: 'var(--foreground)',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '10px 16px',
    backgroundColor: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 150ms ease',
  };

  const secondaryButtonStyle: React.CSSProperties = {
    padding: '10px 16px',
    backgroundColor: 'transparent',
    color: 'var(--foreground)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 150ms ease',
  };

  const toggleStyle = (isOn: boolean): React.CSSProperties => ({
    width: '44px',
    height: '24px',
    borderRadius: '12px',
    backgroundColor: isOn ? 'var(--accent)' : '#d1d5db',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px',
    transition: 'background-color 200ms ease',
    border: 'none',
  });

  const toggleCircleStyle = (isOn: boolean): React.CSSProperties => ({
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: 'white',
    transition: 'transform 200ms ease',
    transform: isOn ? 'translateX(20px)' : 'translateX(0)',
  });

  const formGroupStyle: React.CSSProperties = {
    marginBottom: '1.5rem',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1.5rem',
  };

  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    color: 'var(--foreground)',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    cursor: 'pointer',
  };

  const infoBoxStyle: React.CSSProperties = {
    backgroundColor: 'rgba(0, 181, 254, 0.1)',
    border: '1px solid rgba(0, 181, 254, 0.3)',
    borderRadius: '8px',
    padding: '1rem',
    fontSize: '0.875rem',
    color: 'var(--foreground)',
    marginTop: '1rem',
    lineHeight: '1.5',
  };

  // Render sections
  const renderGeneralSection = () => (
    <div>
      <h2 style={sectionHeaderStyle}>כללי</h2>
      <div style={cardStyle}>
        <div style={formGroupStyle}>
          <div>
            <label style={labelStyle}>שם סטודיו</label>
            <input
              type="text"
              value={general.studioName}
              onChange={(e) => setGeneral({ ...general, studioName: e.target.value })}
              style={inputStyle}
              placeholder="Studio Pixel"
            />
          </div>
          <div>
            <label style={labelStyle}>טלפון עסקי</label>
            <input
              type="text"
              value={general.businessPhone}
              onChange={(e) => setGeneral({ ...general, businessPhone: e.target.value })}
              style={inputStyle}
              placeholder="+972..."
            />
          </div>
        </div>

        <div style={formGroupStyle}>
          <div>
            <label style={labelStyle}>אימייל עסקי</label>
            <input
              type="email"
              value={general.businessEmail}
              onChange={(e) => setGeneral({ ...general, businessEmail: e.target.value })}
              style={inputStyle}
              placeholder="info@studio.com"
            />
          </div>
          <div>
            <label style={labelStyle}>שפה ברירת מחדל</label>
            <select
              value={general.defaultLanguage}
              onChange={(e) => setGeneral({ ...general, defaultLanguage: e.target.value as any })}
              style={selectStyle}
            >
              <option value="he">עברית</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>

        <div style={formGroupStyle}>
          <div>
            <label style={labelStyle}>מטבע ברירת מחדל</label>
            <select
              value={general.defaultCurrency}
              onChange={(e) => setGeneral({ ...general, defaultCurrency: e.target.value as any })}
              style={selectStyle}
            >
              <option value="ILS">₪ ILS</option>
              <option value="USD">$ USD</option>
              <option value="EUR">€ EUR</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>אזור זמן</label>
            <select
              value={general.timezone}
              onChange={(e) => setGeneral({ ...general, timezone: e.target.value })}
              style={selectStyle}
            >
              <option value="Asia/Jerusalem">Asia/Jerusalem</option>
              <option value="Europe/London">Europe/London</option>
              <option value="America/New_York">America/New_York</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
        </div>

        <button style={buttonStyle} onClick={saveGeneralSettings}>
          שמור
        </button>
      </div>
    </div>
  );

  const statusDot = (status: string) => ({
    width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0 as const,
    backgroundColor: status === 'connected' ? '#22c55e' : status === 'invalid_key' ? '#ef4444' : status === 'missing_key' ? '#f59e0b' : '#94a3b8',
  });
  const statusLabel = (status: string) =>
    status === 'connected' ? 'מחובר' : status === 'invalid_key' ? 'מפתח שגוי' : status === 'missing_key' ? 'חסר מפתח' : 'לא נבדק';

  const formatTestTime = (iso: string | null) => {
    if (!iso) return null;
    try { return new Date(iso).toLocaleString('he-IL'); } catch { return iso; }
  };

  const renderAiSection = () => (
    <div>
      <h2 style={sectionHeaderStyle}>AI / מפתחות API</h2>

      {/* Provider Status Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.25rem' }}>
          <div style={statusDot(aiConnectionStatus)} />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--foreground)' }}>OpenAI / Whisper</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>{statusLabel(aiConnectionStatus)}</div>
          </div>
        </div>
        <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.25rem' }}>
          <div style={statusDot(assemblyaiConnectionStatus)} />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--foreground)' }}>AssemblyAI</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>{statusLabel(assemblyaiConnectionStatus)}</div>
          </div>
        </div>
      </div>

      {/* OpenAI / Whisper Card */}
      <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)' }}>OpenAI / Whisper</h3>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: 'var(--foreground-muted)' }}>
              יצירת AI, גאנט, תובנות, רעיונות תוכן — וכן תמלול גיבוי (Whisper)
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={statusDot(aiConnectionStatus)} />
            <span style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)' }}>{statusLabel(aiConnectionStatus)}</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <label style={labelStyle}>ספק AI</label>
            <select value={aiProvider} onChange={(e) => setAiProvider(e.target.value as any)} style={selectStyle}>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>מודל ברירת מחדל</label>
            <select value={aiModel} onChange={(e) => setAiModel(e.target.value)} style={selectStyle}>
              {aiProvider === 'openai' ? (
                <>
                  <option value="gpt-4.1">gpt-4.1</option>
                  <option value="gpt-4o">gpt-4o</option>
                  <option value="gpt-5.4">gpt-5.4</option>
                </>
              ) : (
                <>
                  <option value="claude-sonnet-4-5">claude-sonnet-4-5</option>
                  <option value="claude-opus-4">claude-opus-4</option>
                </>
              )}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: '1.25rem' }}>
          <label style={labelStyle}>מפתח API</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showApiKey ? 'text' : 'password'}
              value={aiApiKey}
              onChange={(e) => setAiApiKey(e.target.value)}
              style={{ ...inputStyle, paddingLeft: '44px' }}
              placeholder="sk-..."
            />
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--foreground-muted)', fontSize: '0.9rem' }}
            >
              {showApiKey ? '🙈' : '👁'}
            </button>
          </div>
        </div>

        <div style={{ marginBottom: '1.25rem' }}>
          <label style={labelStyle}>שימושים עיקריים</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.4rem' }}>
            {['יצירת גאנט', 'תובנות AI', 'רעיונות תוכן', 'המלצות שבועיות', 'תמלול גיבוי (Whisper)'].map((u) => (
              <span key={u} style={{ fontSize: '0.7rem', padding: '3px 10px', borderRadius: '12px', background: 'var(--accent-muted)', color: 'var(--accent)' }}>{u}</span>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button style={buttonStyle} onClick={testAiConnection} disabled={aiTestLoading}>
            {aiTestLoading ? '⏳ בודק...' : 'בדוק חיבור'}
          </button>
        </div>
      </div>

      {/* AssemblyAI Card */}
      <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)' }}>AssemblyAI</h3>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: 'var(--foreground-muted)' }}>
              ספק תמלול ראשי — דיוק גבוה, זיהוי דוברים, עברית
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={statusDot(assemblyaiConnectionStatus)} />
            <span style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)' }}>{statusLabel(assemblyaiConnectionStatus)}</span>
          </div>
        </div>

        <div style={{ marginBottom: '1.25rem' }}>
          <label style={labelStyle}>מפתח API</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showAssemblyaiKey ? 'text' : 'password'}
              value={assemblyaiApiKey}
              onChange={(e) => setAssemblyaiApiKey(e.target.value)}
              style={{ ...inputStyle, paddingLeft: '44px' }}
              placeholder="..."
            />
            <button
              onClick={() => setShowAssemblyaiKey(!showAssemblyaiKey)}
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--foreground-muted)', fontSize: '0.9rem' }}
            >
              {showAssemblyaiKey ? '🙈' : '👁'}
            </button>
          </div>
        </div>

        <div style={{ marginBottom: '1.25rem' }}>
          <label style={labelStyle}>שימוש עיקרי</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.4rem' }}>
            <span style={{ fontSize: '0.7rem', padding: '3px 10px', borderRadius: '12px', background: 'rgba(139,92,246,0.15)', color: '#0092cc' }}>ספק תמלול ראשי</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button style={buttonStyle} onClick={testAssemblyaiConnection} disabled={assemblyaiTestLoading}>
            {assemblyaiTestLoading ? '⏳ בודק...' : 'בדוק חיבור'}
          </button>
        </div>
      </div>

      {/* Transcription Priority */}
      <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)' }}>סדר עדיפויות תמלול</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <label style={labelStyle}>ספק תמלול ראשי</label>
            <select value={primaryTranscription} onChange={(e) => setPrimaryTranscription(e.target.value as any)} style={selectStyle}>
              <option value="assemblyai">AssemblyAI</option>
              <option value="whisper">Whisper (OpenAI)</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>ספק תמלול גיבוי</label>
            <select value={fallbackTranscription} onChange={(e) => setFallbackTranscription(e.target.value as any)} style={selectStyle}>
              <option value="whisper">Whisper (OpenAI)</option>
              <option value="assemblyai">AssemblyAI</option>
              <option value="none">ללא גיבוי</option>
            </select>
          </div>
        </div>

        <div style={{ ...infoBoxStyle, marginBottom: 0 }}>
          <strong style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--foreground)' }}>מידע על הספקים:</strong>
          <div style={{ lineHeight: 1.8, fontSize: '0.8rem' }}>
            <strong>AssemblyAI</strong> — ספק תמלול ראשי. דיוק גבוה, זיהוי דוברים, תמיכה בעברית.<br />
            <strong>Whisper (OpenAI)</strong> — תמלול גיבוי / חלופי. משתמש באותו מפתח API של OpenAI.<br />
            <strong>OpenAI</strong> — משמש גם ליצירת גאנט, תובנות AI, רעיונות תוכן, והמלצות שבועיות.
          </div>
        </div>
      </div>

      {/* Audit / Debug */}
      <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)' }}>יומן בדיקות חיבור</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--foreground)' }}>OpenAI / Whisper</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--foreground-muted)', lineHeight: 1.8 }}>
              בדיקה אחרונה: {formatTestTime(aiLastTestedAt) || 'טרם נבדק'}<br />
              {aiLastTestError && (
                <span style={{ color: '#ef4444' }}>שגיאה אחרונה: {aiLastTestError}</span>
              )}
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--foreground)' }}>AssemblyAI</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--foreground-muted)', lineHeight: 1.8 }}>
              בדיקה אחרונה: {formatTestTime(assemblyaiLastTestedAt) || 'טרם נבדק'}<br />
              {assemblyaiLastTestError && (
                <span style={{ color: '#ef4444' }}>שגיאה אחרונה: {assemblyaiLastTestError}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Save All */}
      <button style={{ ...buttonStyle, width: '100%', padding: '12px', fontSize: '1rem' }} onClick={saveAiSettings}>
        שמור את כל הגדרות AI
      </button>
    </div>
  );

  const renderGmailSection = () => {
    const statusConfig: Record<GmailConnectionStatus, { label: string; color: string; icon: string }> = {
      connected: { label: 'מחובר', color: '#22c55e', icon: '✅' },
      not_connected: { label: 'לא מחובר', color: '#6b7280', icon: '⚪' },
      error: { label: 'שגיאת חיבור', color: '#ef4444', icon: '❌' },
      reconnecting: { label: 'מתחבר מחדש...', color: '#f59e0b', icon: '🔄' },
    };
    const currentStatus = statusConfig[gmailStatus] || statusConfig.not_connected;

    return (
      <div>
        <h2 style={sectionHeaderStyle}>Gmail Integration</h2>

        {/* Connection Status Card */}
        <div style={{ ...cardStyle, border: `1px solid ${currentStatus.color}30`, marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: `${currentStatus.color}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.5rem',
              }}>
                {currentStatus.icon}
              </div>
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)' }}>סטטוס חיבור Gmail</div>
                <div style={{ fontSize: '0.85rem', color: currentStatus.color, fontWeight: 600, marginTop: 2 }}>
                  {currentStatus.label}
                </div>
              </div>
            </div>
            <div style={{
              padding: '0.35rem 0.75rem', borderRadius: 8,
              background: `${currentStatus.color}15`, color: currentStatus.color,
              fontSize: '0.8rem', fontWeight: 600, border: `1px solid ${currentStatus.color}30`,
            }}>
              {currentStatus.label}
            </div>
          </div>

          {/* Connected details */}
          {gmailStatus === 'connected' && (
            <div style={{
              background: 'var(--surface)', borderRadius: 8, padding: '0.75rem 1rem',
              border: '1px solid var(--border)', marginBottom: '1rem',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: 'var(--foreground-muted)' }}>חשבון מחובר:</span>
                  <span style={{ color: 'var(--foreground)', fontWeight: 600, marginRight: 6 }}>{gmailEmail}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--foreground-muted)' }}>סנכרון אחרון:</span>
                  <span style={{ color: 'var(--foreground)', fontWeight: 600, marginRight: 6 }}>
                    {gmailLastSync ? new Date(gmailLastSync).toLocaleString('he-IL') : 'לא בוצע'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Error display */}
          {gmailStatus === 'error' && gmailLastError && (
            <div style={{
              background: '#ef444410', borderRadius: 8, padding: '0.75rem 1rem',
              border: '1px solid #ef444430', marginBottom: '1rem',
              fontSize: '0.85rem', color: '#ef4444',
            }}>
              {gmailLastError}
            </div>
          )}

          {/* Developer config status panel */}
          {gmailConfigStatus && (
            <div style={{
              background: gmailConfigStatus.configured ? '#22c55e08' : '#f59e0b10',
              borderRadius: 8, padding: '0.85rem 1rem',
              border: `1px solid ${gmailConfigStatus.configured ? '#22c55e30' : '#f59e0b30'}`,
              marginBottom: '1rem',
            }}>
              {/* Config status header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: gmailConfigStatus.configured ? '#22c55e' : '#f59e0b' }}>
                  {gmailConfigStatus.configured ? '✅ הגדרות OAuth תקינות' : '⚠️ הגדרת Google OAuth חסרה'}
                </div>
                <button onClick={() => setShowSetupHelp(!showSetupHelp)} style={{
                  background: 'transparent', border: '1px solid var(--border)', borderRadius: 6,
                  padding: '0.25rem 0.6rem', fontSize: '0.72rem', cursor: 'pointer',
                  color: 'var(--foreground-muted)',
                }}>
                  {showSetupHelp ? 'הסתר מדריך' : '🔧 מדריך הגדרה'}
                </button>
              </div>

              {/* Env var status indicators */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.78rem', marginBottom: showSetupHelp ? '0.75rem' : 0 }}>
                {([
                  { key: 'GOOGLE_CLIENT_ID', label: 'Client ID', set: gmailConfigStatus.vars.GOOGLE_CLIENT_ID },
                  { key: 'GOOGLE_CLIENT_SECRET', label: 'Client Secret', set: gmailConfigStatus.vars.GOOGLE_CLIENT_SECRET },
                  { key: 'GOOGLE_REDIRECT_URI', label: 'Redirect URI', set: gmailConfigStatus.vars.GOOGLE_REDIRECT_URI },
                ] as const).map(v => (
                  <div key={v.key} style={{
                    display: 'flex', gap: '0.3rem', alignItems: 'center',
                    padding: '0.2rem 0.5rem', borderRadius: 4,
                    background: v.set ? '#22c55e10' : '#ef444410',
                    border: `1px solid ${v.set ? '#22c55e25' : '#ef444425'}`,
                  }}>
                    <span style={{ color: v.set ? '#22c55e' : '#ef4444', fontSize: '0.72rem' }}>
                      {v.set ? '●' : '○'}
                    </span>
                    <code style={{ fontSize: '0.7rem', color: 'var(--foreground)', fontFamily: 'monospace' }}>{v.key}</code>
                    <span style={{ fontSize: '0.65rem', color: 'var(--foreground-muted)' }}>
                      {v.set ? (v.key === 'GOOGLE_CLIENT_ID' && gmailConfigStatus.clientIdPreview ? gmailConfigStatus.clientIdPreview : '✓') : 'חסר'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Redirect URI info */}
              {gmailConfigStatus.configured && (
                <div style={{ fontSize: '0.72rem', color: 'var(--foreground-muted)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span>Redirect URI:</span>
                  <code style={{ fontSize: '0.68rem', background: 'var(--surface)', padding: '0.1rem 0.35rem', borderRadius: 3, fontFamily: 'monospace' }}>
                    {gmailConfigStatus.redirectUri}
                  </code>
                  {gmailConfigStatus.isLocalhost && (
                    <span style={{ color: '#3b82f6', fontSize: '0.65rem' }}>🏠 localhost</span>
                  )}
                </div>
              )}

              {/* Expandable setup help */}
              {showSetupHelp && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--foreground)' }}>
                    📋 מדריך הגדרה מהיר
                  </div>

                  {/* Step 1 */}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '0.25rem' }}>
                      1. צור פרויקט ב-Google Cloud Console
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', lineHeight: 1.6 }}>
                      {'עבור ל-'}{' '}
                      <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer"
                        style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
                        Google Cloud Console → Credentials
                      </a>
                      {' '}{'וצור OAuth 2.0 Client ID מסוג "Web application".'}
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '0.25rem' }}>
                      2. הגדר Authorized redirect URIs
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', lineHeight: 1.6 }}>
                      הוסף את הכתובת הבאה ל-Authorized redirect URIs:
                    </div>
                    <code style={{
                      display: 'block', background: 'var(--surface)', borderRadius: 4, padding: '0.35rem 0.5rem',
                      fontSize: '0.72rem', color: 'var(--accent)', marginTop: '0.25rem', direction: 'ltr', textAlign: 'left',
                      border: '1px solid var(--border)', fontFamily: 'monospace',
                    }}>
                      http://localhost:3000/auth/gmail/callback
                    </code>
                  </div>

                  {/* Step 3 */}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '0.25rem' }}>
                      3. צור קובץ <code style={{ fontSize: '0.72rem', background: 'var(--surface-raised)', padding: '0.1rem 0.3rem', borderRadius: 3 }}>.env.local</code> בתיקיית הפרויקט
                    </div>
                    <pre style={{
                      background: '#1a1a2e', borderRadius: 6, padding: '0.65rem 0.75rem',
                      fontSize: '0.72rem', color: '#e2e8f0', marginTop: '0.25rem',
                      border: '1px solid #334155', overflowX: 'auto', direction: 'ltr', textAlign: 'left',
                      fontFamily: 'monospace', lineHeight: 1.7,
                    }}>
{`GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/gmail/callback`}
                    </pre>
                  </div>

                  {/* Step 4 */}
                  <div style={{ marginBottom: '0.5rem' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '0.25rem' }}>
                      4. הפעל מחדש את שרת הפיתוח
                    </div>
                    <code style={{
                      display: 'block', background: '#1a1a2e', borderRadius: 4, padding: '0.35rem 0.5rem',
                      fontSize: '0.72rem', color: '#e2e8f0', direction: 'ltr', textAlign: 'left',
                      border: '1px solid #334155', fontFamily: 'monospace',
                    }}>
                      npm run dev
                    </code>
                  </div>

                  {/* Localhost note */}
                  <div style={{
                    marginTop: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: 6,
                    background: '#3b82f608', border: '1px solid #3b82f620',
                    fontSize: '0.72rem', color: '#3b82f6', lineHeight: 1.6,
                  }}>
                    💡 <strong>פיתוח מקומי:</strong> Google OAuth תומך ב-localhost ללא HTTPS.
                    ודא שה-redirect URI בקונסול תואם בדיוק לכתובת ב-<code style={{ fontSize: '0.68rem' }}>.env.local</code>.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fallback: setup error without config status (API failed) */}
          {gmailSetupError && !gmailConfigStatus && (
            <div style={{
              background: '#f59e0b10', borderRadius: 8, padding: '1rem',
              border: '1px solid #f59e0b30', marginBottom: '1rem',
            }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f59e0b', marginBottom: '0.5rem' }}>
                ⚠️ הגדרת Google OAuth חסרה
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--foreground-muted)', lineHeight: 1.6 }}>
                {gmailSetupError}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {gmailStatus === 'not_connected' && (
              <button
                className="mod-btn"
                onClick={handleGmailConnect}
                disabled={gmailConnecting || (gmailConfigStatus !== null && !gmailConfigStatus.configured)}
                title={gmailConfigStatus && !gmailConfigStatus.configured ? 'יש להגדיר משתני סביבה לפני חיבור Gmail — ראה מדריך הגדרה למעלה' : undefined}
                style={{
                  background: (gmailConfigStatus && !gmailConfigStatus.configured) ? '#9ca3af' : '#ea4335',
                  color: '#fff', padding: '0.5rem 1.25rem',
                  borderRadius: 8, fontSize: '0.85rem', fontWeight: 600, border: 'none',
                  cursor: (gmailConfigStatus && !gmailConfigStatus.configured) ? 'not-allowed' : 'pointer',
                  opacity: gmailConnecting ? 0.7 : 1,
                }}
              >
                {gmailConnecting ? 'מתחבר...' : (gmailConfigStatus && !gmailConfigStatus.configured) ? '⚠️ הגדרה חסרה' : 'חבר Gmail'}
              </button>
            )}
            {gmailStatus === 'connected' && (
              <>
                <button
                  className="mod-btn-ghost"
                  onClick={handleGmailTest}
                  disabled={gmailTesting}
                  style={{ padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.85rem' }}
                >
                  {gmailTesting ? 'בודק...' : 'בדיקת חיבור'}
                </button>
                <button
                  className="mod-btn-ghost"
                  onClick={handleGmailReconnect}
                  disabled={gmailConnecting}
                  style={{ padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.85rem' }}
                >
                  {gmailConnecting ? 'מתחבר מחדש...' : 'חבר מחדש'}
                </button>
                <button
                  className="mod-btn-ghost"
                  onClick={handleGmailDisconnect}
                  disabled={gmailConnecting}
                  style={{ padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.85rem', color: '#ef4444' }}
                >
                  נתק Gmail
                </button>
              </>
            )}
            {gmailStatus === 'error' && (
              <>
                <button
                  className="mod-btn"
                  onClick={handleGmailReconnect}
                  disabled={gmailConnecting}
                  style={{
                    background: '#ea4335', color: '#fff', padding: '0.5rem 1.25rem',
                    borderRadius: 8, fontSize: '0.85rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                  }}
                >
                  {gmailConnecting ? 'מתחבר...' : 'חבר מחדש'}
                </button>
                <button
                  className="mod-btn-ghost"
                  onClick={handleGmailDisconnect}
                  disabled={gmailConnecting}
                  style={{ padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.85rem', color: '#ef4444' }}
                >
                  נתק Gmail
                </button>
              </>
            )}
          </div>
        </div>

        {/* Sender Settings Card */}
        <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '1rem' }}>
            הגדרות שולח
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={formGroupStyle}>
              <label style={labelStyle}>שם תצוגה</label>
              <input
                className="form-input"
                value={gmailSenderName}
                onChange={(e) => setGmailSenderName(e.target.value)}
                placeholder="Studio Pixel"
                style={{ width: '100%' }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', marginTop: 4 }}>
                השם שיופיע כשולח בכל האימיילים שנשלחים מהפלטפורמה
              </span>
            </div>
            <div style={formGroupStyle}>
              <label style={labelStyle}>Reply-To אימייל</label>
              <input
                className="form-input"
                type="email"
                value={gmailReplyTo}
                onChange={(e) => setGmailReplyTo(e.target.value)}
                placeholder={gmailEmail || 'email@example.com'}
                style={{ width: '100%' }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', marginTop: 4 }}>
                השאר ריק כדי להשתמש בכתובת Gmail המחוברת
              </span>
            </div>
            <div style={formGroupStyle}>
              <label style={labelStyle}>חתימת ברירת מחדל</label>
              <textarea
                className="form-input"
                value={gmailSignature}
                onChange={(e) => setGmailSignature(e.target.value)}
                placeholder="בברכה, סטודיו פיקסל"
                rows={4}
                style={{ width: '100%', resize: 'vertical' }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', marginTop: 4 }}>
                חתימה שתתווסף לתחתית כל אימייל שנשלח מהפלטפורמה (תומך HTML)
              </span>
            </div>
          </div>
          <button
            className="mod-btn"
            onClick={saveGmailSettings}
            style={{
              marginTop: '1rem', background: 'var(--accent)', color: '#fff',
              padding: '0.5rem 1.5rem', borderRadius: 8, fontSize: '0.85rem',
              fontWeight: 600, border: 'none', cursor: 'pointer',
            }}
          >
            שמור הגדרות שולח
          </button>
        </div>

        {/* Email Workflows Card */}
        <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '1rem' }}>
            מקורות שליחת אימייל
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--foreground-muted)', marginBottom: '1rem', lineHeight: 1.7 }}>
            {gmailStatus === 'connected'
              ? `כל האימיילים נשלחים דרך ${gmailEmail}. חשבון Gmail זה משמש כמקור האימייל הראשי עבור:`
              : 'חבר חשבון Gmail כדי שכל האימיילים הבאים יישלחו ממנו:'}
          </p>
          {[
            { label: 'אימייל אישור גאנט', desc: 'שליחת תוכן לאישור לקוח' },
            { label: 'אימייל אישור משימה', desc: 'עדכון לקוח על סטטוס משימה' },
            { label: 'תזכורת תשלום', desc: 'תזכורת חודשית על תשלום' },
            { label: 'מעקב הצעת מחיר', desc: 'פולו-אפ אחרי שליחת הצעה' },
            { label: 'הסכם פודקאסט', desc: 'שליחת הסכם הקלטה ללקוח' },
            { label: 'חומרים סופיים', desc: 'שליחת תוצרים סופיים ללקוח' },
            { label: 'דיוור שבועי', desc: 'עדכון שבועי לכל הלקוחות' },
          ].map((workflow) => (
            <div
              key={workflow.label}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.6rem 0', borderBottom: '1px solid var(--border)',
                fontSize: '0.85rem',
              }}
            >
              <div>
                <div style={{ color: 'var(--foreground)', fontWeight: 600 }}>{workflow.label}</div>
                <div style={{ color: 'var(--foreground-muted)', fontSize: '0.78rem' }}>{workflow.desc}</div>
              </div>
              <div style={{
                padding: '0.2rem 0.5rem', borderRadius: 6,
                fontSize: '0.75rem', fontWeight: 600,
                background: gmailStatus === 'connected' ? '#22c55e15' : '#6b728015',
                color: gmailStatus === 'connected' ? '#22c55e' : '#6b7280',
                border: `1px solid ${gmailStatus === 'connected' ? '#22c55e30' : '#6b728030'}`,
              }}>
                {gmailStatus === 'connected' ? 'פעיל' : 'לא מחובר'}
              </div>
            </div>
          ))}
        </div>

        {/* Info note */}
        <div style={{
          background: 'var(--accent)08', border: '1px solid var(--accent)20',
          borderRadius: 10, padding: '1rem', fontSize: '0.82rem', color: 'var(--foreground-muted)',
          lineHeight: 1.7,
        }}>
          <strong style={{ color: 'var(--foreground)' }}>שים לב:</strong>{' '}
          חיבור Gmail משתמש ב-OAuth 2.0 של Google ומאפשר לפלטפורמה לשלוח ולקרוא אימיילים בשמך.
          אין אחסון של סיסמאות — רק טוקן גישה מאובטח.
          ניתן לנתק בכל עת.
        </div>
      </div>
    );
  };

  const renderEmailSection = () => (
    <div>
      <h2 style={sectionHeaderStyle}>אימייל</h2>
      <div style={cardStyle}>
        <div style={formGroupStyle}>
          <div>
            <label style={labelStyle}>שם השולח</label>
            <input
              type="text"
              value={email.senderName}
              onChange={(e) => setEmail({ ...email, senderName: e.target.value })}
              style={inputStyle}
              placeholder="Studio Pixel"
            />
          </div>
          <div>
            <label style={labelStyle}>אימייל השולח</label>
            <input
              type="email"
              value={email.senderEmail}
              onChange={(e) => setEmail({ ...email, senderEmail: e.target.value })}
              style={inputStyle}
              placeholder="noreply@studio.com"
            />
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={labelStyle}>אימייל Reply-To</label>
          <input
            type="email"
            value={email.replyToEmail}
            onChange={(e) => setEmail({ ...email, replyToEmail: e.target.value })}
            style={inputStyle}
            placeholder="reply@studio.com"
          />
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '1rem' }}>
            הגדרות אימייל
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.875rem', color: 'var(--foreground)' }}>אימיילי אישור</label>
              <button
                style={toggleStyle(email.approvalEmails)}
                onClick={() => setEmail({ ...email, approvalEmails: !email.approvalEmails })}
              >
                <div style={toggleCircleStyle(email.approvalEmails)} />
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.875rem', color: 'var(--foreground)' }}>תזכורות תשלום</label>
              <button
                style={toggleStyle(email.paymentReminders)}
                onClick={() => setEmail({ ...email, paymentReminders: !email.paymentReminders })}
              >
                <div style={toggleCircleStyle(email.paymentReminders)} />
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.875rem', color: 'var(--foreground)' }}>דיוור שבועי ללקוחות</label>
              <button
                style={toggleStyle(email.weeklyClientMailing)}
                onClick={() => setEmail({ ...email, weeklyClientMailing: !email.weeklyClientMailing })}
              >
                <div style={toggleCircleStyle(email.weeklyClientMailing)} />
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.875rem', color: 'var(--foreground)' }}>אימייל לרואה חשבון</label>
              <button
                style={toggleStyle(email.accountantExport)}
                onClick={() => setEmail({ ...email, accountantExport: !email.accountantExport })}
              >
                <div style={toggleCircleStyle(email.accountantExport)} />
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <button style={secondaryButtonStyle} onClick={() => toast('בקרוב', 'info')}>
            פתח ניהול תבניות
          </button>
          <button style={buttonStyle} onClick={saveEmailSettings}>
            שמור
          </button>
        </div>
      </div>
    </div>
  );

  const renderWhatsappSection = () => (
    <div>
      <h2 style={sectionHeaderStyle}>וואטסאפ</h2>
      <div style={cardStyle}>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={labelStyle}>שם הספק</label>
          <input
            type="text"
            value={whatsapp.providerName}
            onChange={(e) => setWhatsapp({ ...whatsapp, providerName: e.target.value })}
            style={inputStyle}
            placeholder="WhatsApp Business API"
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={labelStyle}>מספר השולח</label>
          <input
            type="text"
            value={whatsapp.senderNumber}
            onChange={(e) => setWhatsapp({ ...whatsapp, senderNumber: e.target.value })}
            style={inputStyle}
            placeholder="+972..."
          />
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '0.875rem', color: 'var(--foreground)', fontWeight: 600 }}>
              אפשר שימוש בוואטסאפ
            </label>
            <button
              style={toggleStyle(whatsapp.isEnabled)}
              onClick={() => setWhatsapp({ ...whatsapp, isEnabled: !whatsapp.isEnabled })}
            >
              <div style={toggleCircleStyle(whatsapp.isEnabled)} />
            </button>
          </div>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <label style={labelStyle}>סטטוס חיבור</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: whatsapp.isConnected ? '#22c55e' : '#94a3b8',
              }}
            />
            <span style={{ color: 'var(--foreground-muted)', fontSize: '0.875rem' }}>
              {whatsapp.isConnected ? 'מחובר' : 'לא מחובר'}
            </span>
          </div>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '1rem' }}>
            תבניות זמינות
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            {WHATSAPP_TEMPLATES.map((template) => (
              <div
                key={template.id}
                style={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '1rem',
                }}
              >
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)' }}>
                  {template.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', marginTop: '0.5rem' }}>
                  {template.category}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <button style={secondaryButtonStyle} onClick={() => toast('בדיקה בוואטסאפ', 'info')}>
            בדוק חיבור
          </button>
          <button style={buttonStyle} onClick={saveWhatsappSettings}>
            שמור
          </button>
        </div>
      </div>
    </div>
  );

  const renderNotificationsSection = () => (
    <div>
      <h2 style={sectionHeaderStyle}>התראות</h2>
      <div style={cardStyle}>
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '1rem' }}>
            ערוצי התראה
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.875rem', color: 'var(--foreground)' }}>התראות בתוך האפליקציה</label>
              <button
                style={toggleStyle(notifications.inAppNotifications)}
                onClick={() => setNotifications({ ...notifications, inAppNotifications: !notifications.inAppNotifications })}
              >
                <div style={toggleCircleStyle(notifications.inAppNotifications)} />
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.875rem', color: 'var(--foreground)' }}>התראות בדוא"ל</label>
              <button
                style={toggleStyle(notifications.emailNotifications)}
                onClick={() => setNotifications({ ...notifications, emailNotifications: !notifications.emailNotifications })}
              >
                <div style={toggleCircleStyle(notifications.emailNotifications)} />
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.875rem', color: 'var(--foreground)' }}>התראות קוליות</label>
              <button
                style={toggleStyle(notifications.soundNotifications)}
                onClick={() => setNotifications({ ...notifications, soundNotifications: !notifications.soundNotifications })}
              >
                <div style={toggleCircleStyle(notifications.soundNotifications)} />
              </button>
            </div>
          </div>
        </div>

        {notifications.soundNotifications && (
          <div style={{ marginBottom: '2rem' }}>
            <label style={labelStyle}>עוצמת קול ({notifications.soundVolume}%)</label>
            <input
              type="range"
              min="0"
              max="100"
              value={notifications.soundVolume}
              onChange={(e) => setNotifications({ ...notifications, soundVolume: parseInt(e.target.value) })}
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>
        )}

        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '1rem' }}>
            סוגי התראה
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.875rem', color: 'var(--foreground)' }}>אישורים</label>
              <button
                style={toggleStyle(notifications.approvalNotifications)}
                onClick={() => setNotifications({ ...notifications, approvalNotifications: !notifications.approvalNotifications })}
              >
                <div style={toggleCircleStyle(notifications.approvalNotifications)} />
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.875rem', color: 'var(--foreground)' }}>תשלומים</label>
              <button
                style={toggleStyle(notifications.paymentNotifications)}
                onClick={() => setNotifications({ ...notifications, paymentNotifications: !notifications.paymentNotifications })}
              >
                <div style={toggleCircleStyle(notifications.paymentNotifications)} />
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.875rem', color: 'var(--foreground)' }}>התראות גאנט</label>
              <button
                style={toggleStyle(notifications.ganttAlerts)}
                onClick={() => setNotifications({ ...notifications, ganttAlerts: !notifications.ganttAlerts })}
              >
                <div style={toggleCircleStyle(notifications.ganttAlerts)} />
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.875rem', color: 'var(--foreground)' }}>מעקב לידים</label>
              <button
                style={toggleStyle(notifications.leadFollowups)}
                onClick={() => setNotifications({ ...notifications, leadFollowups: !notifications.leadFollowups })}
              >
                <div style={toggleCircleStyle(notifications.leadFollowups)} />
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.875rem', color: 'var(--foreground)' }}>משימות עובדים</label>
              <button
                style={toggleStyle(notifications.employeeTaskNotifications)}
                onClick={() => setNotifications({ ...notifications, employeeTaskNotifications: !notifications.employeeTaskNotifications })}
              >
                <div style={toggleCircleStyle(notifications.employeeTaskNotifications)} />
              </button>
            </div>
          </div>
        </div>

        <button style={buttonStyle} onClick={saveNotificationSettings}>
          שמור
        </button>
      </div>
    </div>
  );

  const renderAppearanceSection = () => (
    <div>
      <h2 style={sectionHeaderStyle}>מראה</h2>
      <div style={cardStyle}>
        <label style={labelStyle}>בחר נושא</label>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '1rem', marginBottom: '2rem' }}>
          {/* Dark Theme Card */}
          <div
            onClick={() => handleThemeChange('dark')}
            style={{
              padding: '1.5rem',
              borderRadius: '12px',
              border: theme === 'dark' ? '2px solid var(--accent)' : '1px solid var(--border)',
              backgroundColor: '#1a1a1a',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 150ms ease',
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🌙</div>
            <div style={{ color: '#fff', fontSize: '0.875rem', fontWeight: 600 }}>Dark</div>
          </div>

          {/* Light Theme Card */}
          <div
            onClick={() => handleThemeChange('light')}
            style={{
              padding: '1.5rem',
              borderRadius: '12px',
              border: theme === 'light' ? '2px solid var(--accent)' : '1px solid var(--border)',
              backgroundColor: '#ffffff',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 150ms ease',
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>☀️</div>
            <div style={{ color: '#000', fontSize: '0.875rem', fontWeight: 600 }}>Light</div>
          </div>

          {/* Auto Theme Card */}
          <div
            onClick={() => handleThemeChange('auto')}
            style={{
              padding: '1.5rem',
              borderRadius: '12px',
              border: theme === 'auto' ? '2px solid var(--accent)' : '1px solid var(--border)',
              background: 'linear-gradient(135deg, #1a1a1a 0%, #ffffff 100%)',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 150ms ease',
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔄</div>
            <div style={{ color: 'var(--foreground)', fontSize: '0.875rem', fontWeight: 600 }}>Auto</div>
          </div>
        </div>

        <div style={infoBoxStyle}>
          הנושא מוחל על כל הפלטפורמה
        </div>
      </div>
    </div>
  );

  const renderAutomationSection = () => (
    <div>
      <h2 style={sectionHeaderStyle}>ברירות מחדל אוטומציה</h2>
      <div style={cardStyle}>
        <div style={formGroupStyle}>
          <div>
            <label style={labelStyle}>תזכורת מעקב</label>
            <select
              value={automation.followUpTiming}
              onChange={(e) => setAutomation({ ...automation, followUpTiming: e.target.value as any })}
              style={selectStyle}
            >
              <option value="1_day">1 יום</option>
              <option value="2_days">2 ימים</option>
              <option value="3_days">3 ימים</option>
              <option value="1_week">שבועה</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>התראות אישור</label>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <button
                style={toggleStyle(automation.approvalNotificationEnabled)}
                onClick={() => setAutomation({ ...automation, approvalNotificationEnabled: !automation.approvalNotificationEnabled })}
              >
                <div style={toggleCircleStyle(automation.approvalNotificationEnabled)} />
              </button>
            </div>
          </div>
        </div>

        {automation.approvalNotificationEnabled && (
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={labelStyle}>תזמון התראת אישור</label>
            <select
              value={automation.approvalNotificationTiming}
              onChange={(e) => setAutomation({ ...automation, approvalNotificationTiming: e.target.value as any })}
              style={selectStyle}
            >
              <option value="0_hours">מיידי</option>
              <option value="2_hours">2 שעות</option>
              <option value="4_hours">4 שעות</option>
              <option value="1_day">יום אחד</option>
            </select>
          </div>
        )}

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={labelStyle}>תזמון התראת גאנט</label>
          <select
            value={automation.ganttAlertTiming}
            onChange={(e) => setAutomation({ ...automation, ganttAlertTiming: e.target.value as any })}
            style={selectStyle}
          >
            <option value="1_week">שבועה לפני</option>
            <option value="3_days">3 ימים לפני</option>
            <option value="1_day">יום אחד לפני</option>
          </select>
        </div>

        <div style={formGroupStyle}>
          <div>
            <label style={labelStyle}>יום דיוור שבועי</label>
            <select
              value={automation.weeklyMailingDay}
              onChange={(e) => setAutomation({ ...automation, weeklyMailingDay: e.target.value as any })}
              style={selectStyle}
            >
              <option value="sun">ראשון</option>
              <option value="mon">שני</option>
              <option value="tue">שלישי</option>
              <option value="wed">רביעי</option>
              <option value="thu">חמישי</option>
              <option value="fri">שישי</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>שעת דיוור שבועי</label>
            <input
              type="time"
              value={automation.weeklyMailingTime}
              onChange={(e) => setAutomation({ ...automation, weeklyMailingTime: e.target.value })}
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={labelStyle}>תזמון תזכורת תשלום</label>
          <select
            value={automation.paymentReminderTiming}
            onChange={(e) => setAutomation({ ...automation, paymentReminderTiming: e.target.value as any })}
            style={selectStyle}
          >
            <option value="3_days">3 ימים לפני</option>
            <option value="1_day">יום אחד לפני</option>
            <option value="on_due">ביום היעד</option>
            <option value="1_day_after">יום אחד אחרי</option>
          </select>
        </div>

        <button style={buttonStyle} onClick={saveAutomationSettings}>
          שמור
        </button>
      </div>
    </div>
  );

  const renderTeamSection = () => {
    const employeeList = employees.data || [];

    return (
      <div>
        <h2 style={sectionHeaderStyle}>צוות והרשאות</h2>
        <div style={cardStyle}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'right', padding: '1rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground-muted)' }}>
                    שם
                  </th>
                  <th style={{ textAlign: 'right', padding: '1rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground-muted)' }}>
                    אימייל
                  </th>
                  <th style={{ textAlign: 'right', padding: '1rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground-muted)' }}>
                    תפקיד
                  </th>
                  <th style={{ textAlign: 'right', padding: '1rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground-muted)' }}>
                    פעולות
                  </th>
                </tr>
              </thead>
              <tbody>
                {employeeList.map((emp) => (
                  <tr key={emp.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '1rem', color: 'var(--foreground)' }}>
                      {emp.name}
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--foreground-muted)', fontSize: '0.875rem' }}>
                      {emp.email}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <select
                        value={emp.role}
                        onChange={(e) => updateEmployeeRole(emp.id, e.target.value)}
                        style={{
                          ...selectStyle,
                          backgroundColor: `${ROLE_COLORS[emp.role]}15`,
                          borderColor: ROLE_COLORS[emp.role],
                          color: ROLE_COLORS[emp.role],
                          fontWeight: 600,
                        }}
                      >
                        <option value="admin">אדמין</option>
                        <option value="manager">מנהל</option>
                        <option value="employee">עובד</option>
                        <option value="viewer">צופה</option>
                      </select>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <button
                        onClick={() => toast('בקרוב', 'info')}
                        style={{
                          ...secondaryButtonStyle,
                          fontSize: '0.75rem',
                          padding: '6px 12px',
                        }}
                      >
                        מחק
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {employeeList.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--foreground-muted)' }}>
              אין עובדים להצגה
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderStockMediaSection = () => (
    <div>
      <h2 style={sectionHeaderStyle}>Stock Media — ספריות וידאו</h2>
      <p style={{ fontSize: '0.85rem', color: 'var(--foreground-muted)', marginBottom: '1.5rem' }}>
        הגדר ספריות וידאו חיצוניות לחיפוש B-Roll אוטומטי.
      </p>
      <div style={{ ...cardStyle, textAlign: 'center', padding: '2.5rem 1.5rem' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🎬</div>
        <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--foreground)' }}>הגדרות מדיה עברו לעמוד ייעודי</div>
        <p style={{ fontSize: '0.85rem', color: 'var(--foreground-muted)', marginBottom: '1.25rem' }}>
          חבר Pexels, Pixabay ו-Shutterstock, בדוק חיבור, ונהל את ספריות הווידאו שלך.
        </p>
        <a
          href="/settings/media"
          style={{ ...buttonStyle, display: 'inline-block', textDecoration: 'none', padding: '12px 28px', fontSize: '0.95rem' }}
        >
          פתח הגדרות מדיה →
        </a>
      </div>
    </div>
  );

  const renderIntegrationsSection = () => (
    <div>
      <h2 style={sectionHeaderStyle}>אינטגרציות</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
        {/* OpenAI / Whisper Integration */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
                OpenAI / Whisper
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', margin: '0.5rem 0 0 0' }}>
                AI + תמלול גיבוי
              </p>
            </div>
            <div style={{ fontSize: '1.5rem' }}>🤖</div>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: aiConnectionStatus === 'connected' ? '#22c55e' : aiConnectionStatus === 'invalid_key' ? '#ef4444' : '#94a3b8' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>{statusLabel(aiConnectionStatus)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setActiveSection('ai')} style={{ ...buttonStyle, flex: 1, padding: '8px 12px', fontSize: '0.75rem' }}>הגדר</button>
            <button onClick={testAiConnection} style={{ ...secondaryButtonStyle, flex: 1, padding: '8px 12px', fontSize: '0.75rem' }}>בדוק</button>
          </div>
        </div>

        {/* AssemblyAI Integration */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
                AssemblyAI
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', margin: '0.5rem 0 0 0' }}>
                ספק תמלול ראשי
              </p>
            </div>
            <div style={{ fontSize: '1.5rem' }}>🎙️</div>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: assemblyaiConnectionStatus === 'connected' ? '#22c55e' : assemblyaiConnectionStatus === 'invalid_key' ? '#ef4444' : '#94a3b8' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>{statusLabel(assemblyaiConnectionStatus)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setActiveSection('ai')} style={{ ...buttonStyle, flex: 1, padding: '8px 12px', fontSize: '0.75rem' }}>הגדר</button>
            <button onClick={testAssemblyaiConnection} style={{ ...secondaryButtonStyle, flex: 1, padding: '8px 12px', fontSize: '0.75rem' }}>בדוק</button>
          </div>
        </div>

        {/* Gmail Integration */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
                Gmail
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', margin: '0.5rem 0 0 0' }}>
                שליחה וקבלת אימייל
              </p>
            </div>
            <div style={{ fontSize: '1.5rem' }}>📧</div>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: gmailStatus === 'connected' ? '#22c55e' : gmailStatus === 'error' ? '#ef4444' : '#94a3b8' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>
                {gmailStatus === 'connected' ? `מחובר — ${gmailEmail}` : gmailStatus === 'error' ? 'שגיאת חיבור' : 'לא מחובר'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setActiveSection('gmail')} style={{ ...buttonStyle, flex: 1, padding: '8px 12px', fontSize: '0.75rem' }}>הגדר</button>
            {gmailStatus === 'not_connected' ? (
              <button onClick={handleGmailConnect} style={{ ...secondaryButtonStyle, flex: 1, padding: '8px 12px', fontSize: '0.75rem' }}>חבר</button>
            ) : gmailStatus === 'connected' ? (
              <button onClick={handleGmailTest} style={{ ...secondaryButtonStyle, flex: 1, padding: '8px 12px', fontSize: '0.75rem' }}>בדוק</button>
            ) : (
              <button onClick={handleGmailReconnect} style={{ ...secondaryButtonStyle, flex: 1, padding: '8px 12px', fontSize: '0.75rem' }}>חבר מחדש</button>
            )}
          </div>
        </div>

        {/* WhatsApp Integration */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
                WhatsApp
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', margin: '0.5rem 0 0 0' }}>
                שלח הודעות ללקוחות
              </p>
            </div>
            <div style={{ fontSize: '1.5rem' }}>💬</div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: whatsapp.isConnected ? '#22c55e' : '#94a3b8',
                }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>
                {whatsapp.isConnected ? 'מחובר' : 'לא מחובר'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setActiveSection('whatsapp')}
              style={{
                ...buttonStyle,
                flex: 1,
                padding: '8px 12px',
                fontSize: '0.75rem',
              }}
            >
              הגדר
            </button>
            <button
              onClick={() => toast('בקרוב', 'info')}
              style={{
                ...secondaryButtonStyle,
                flex: 1,
                padding: '8px 12px',
                fontSize: '0.75rem',
              }}
            >
              בדוק
            </button>
          </div>
        </div>

        {/* Email Integration */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
                דוא"ל
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', margin: '0.5rem 0 0 0' }}>
                שליחת דוא"ל משותף
              </p>
            </div>
            <div style={{ fontSize: '1.5rem' }}>📧</div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: email.senderEmail ? '#22c55e' : '#94a3b8',
                }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>
                {email.senderEmail ? 'מוגדר' : 'לא מוגדר'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setActiveSection('email')}
              style={{
                ...buttonStyle,
                flex: 1,
                padding: '8px 12px',
                fontSize: '0.75rem',
              }}
            >
              הגדר
            </button>
            <button
              onClick={() => toast('בקרוב', 'info')}
              style={{
                ...secondaryButtonStyle,
                flex: 1,
                padding: '8px 12px',
                fontSize: '0.75rem',
              }}
            >
              בדוק
            </button>
          </div>
        </div>

        {/* Facebook API */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
                Facebook
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', margin: '0.5rem 0 0 0' }}>
                ניהול דפים עסקיים
              </p>
            </div>
            <div style={{ fontSize: '1.5rem' }}>f</div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#94a3b8',
                }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>
                לא מחובר
              </span>
            </div>
          </div>

          <button
            onClick={() => toast('בקרוב', 'info')}
            style={{ ...buttonStyle, width: '100%', padding: '8px 12px', fontSize: '0.75rem' }}
          >
            התחבר
          </button>
        </div>

        {/* Instagram API */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
                Instagram
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', margin: '0.5rem 0 0 0' }}>
                פרסום תוכן וניתוח
              </p>
            </div>
            <div style={{ fontSize: '1.5rem' }}>📷</div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#94a3b8',
                }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>
                לא מחובר
              </span>
            </div>
          </div>

          <button
            onClick={() => toast('בקרוב', 'info')}
            style={{ ...buttonStyle, width: '100%', padding: '8px 12px', fontSize: '0.75rem' }}
          >
            התחבר
          </button>
        </div>

        {/* TikTok API */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
                TikTok
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', margin: '0.5rem 0 0 0' }}>
                פרסום וניתוח וידאו
              </p>
            </div>
            <div style={{ fontSize: '1.5rem' }}>🎵</div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#94a3b8',
                }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>
                לא מחובר
              </span>
            </div>
          </div>

          <button
            onClick={() => toast('בקרוב', 'info')}
            style={{ ...buttonStyle, width: '100%', padding: '8px 12px', fontSize: '0.75rem' }}
          >
            התחבר
          </button>
        </div>

        {/* Pexels Stock Video */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>Pexels</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', margin: '0.5rem 0 0 0' }}>ספריית וידאו Stock חינמית</p>
            </div>
            <div style={{ fontSize: '1.5rem' }}>🎬</div>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: pexelsStatus === 'connected' ? '#22c55e' : pexelsStatus === 'error' ? '#ef4444' : '#94a3b8' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>{pexelsStatus === 'connected' ? 'מחובר' : pexelsStatus === 'error' ? 'שגיאה' : 'לא מוגדר'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setActiveSection('stockmedia')} style={{ ...buttonStyle, flex: 1, padding: '8px 12px', fontSize: '0.75rem' }}>הגדר</button>
            <button onClick={() => testStockProvider('pexels')} disabled={pexelsTestLoading} style={{ ...secondaryButtonStyle, flex: 1, padding: '8px 12px', fontSize: '0.75rem' }}>{pexelsTestLoading ? '⏳' : 'בדוק'}</button>
          </div>
        </div>

        {/* Pixabay Stock Video */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>Pixabay</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', margin: '0.5rem 0 0 0' }}>ספריית מדיה חינמית</p>
            </div>
            <div style={{ fontSize: '1.5rem' }}>📹</div>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: pixabayStatus === 'connected' ? '#22c55e' : pixabayStatus === 'error' ? '#ef4444' : '#94a3b8' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>{pixabayStatus === 'connected' ? 'מחובר' : pixabayStatus === 'error' ? 'שגיאה' : 'לא מוגדר'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setActiveSection('stockmedia')} style={{ ...buttonStyle, flex: 1, padding: '8px 12px', fontSize: '0.75rem' }}>הגדר</button>
            <button onClick={() => testStockProvider('pixabay')} disabled={pixabayTestLoading} style={{ ...secondaryButtonStyle, flex: 1, padding: '8px 12px', fontSize: '0.75rem' }}>{pixabayTestLoading ? '⏳' : 'בדוק'}</button>
          </div>
        </div>

        {/* Shutterstock (Future) */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>Shutterstock</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', margin: '0.5rem 0 0 0' }}>ספריית Stock מקצועית (בקרוב)</p>
            </div>
            <div style={{ fontSize: '1.5rem' }}>🖼️</div>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: shutterstockStatus === 'connected' ? '#22c55e' : shutterstockStatus === 'error' ? '#ef4444' : '#94a3b8' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>{shutterstockStatus === 'connected' ? 'מחובר' : shutterstockStatus === 'error' ? 'שגיאה' : 'לא מוגדר'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setActiveSection('stockmedia')} style={{ ...buttonStyle, flex: 1, padding: '8px 12px', fontSize: '0.75rem' }}>הגדר</button>
            <button onClick={() => testStockProvider('shutterstock')} disabled={shutterstockTestLoading} style={{ ...secondaryButtonStyle, flex: 1, padding: '8px 12px', fontSize: '0.75rem' }}>{shutterstockTestLoading ? '⏳' : 'בדוק'}</button>
          </div>
        </div>
      </div>
    </div>
  );

  // Main render
  return (
    <div style={mainContainerStyle}>
      {/* Sidebar Navigation */}
      <nav style={sidebarStyle}>
        {[
          { id: 'general' as Section, label: 'כללי' },
          { id: 'ai' as Section, label: 'AI / מפתחות API' },
          { id: 'email' as Section, label: 'אימייל' },
          { id: 'gmail' as Section, label: 'Gmail' },
          { id: 'whatsapp' as Section, label: 'וואטסאפ' },
          { id: 'notifications' as Section, label: 'התראות' },
          { id: 'appearance' as Section, label: 'מראה' },
          { id: 'automation' as Section, label: 'ברירות מחדל אוטומציה' },
          { id: 'team' as Section, label: 'צוות והרשאות' },
          { id: 'integrations' as Section, label: 'אינטגרציות' },
          { id: 'stockmedia' as Section, label: 'הגדרות מדיה' },
        ].map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            style={navItemStyle(activeSection === section.id)}
            onMouseEnter={(e) => {
              if (activeSection !== section.id) {
                (e.target as HTMLElement).style.backgroundColor = 'var(--surface)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeSection !== section.id) {
                (e.target as HTMLElement).style.backgroundColor = 'transparent';
              }
            }}
          >
            {section.label}
          </button>
        ))}
      </nav>

      {/* Content Area */}
      <main style={contentStyle}>
        {activeSection === 'general' && renderGeneralSection()}
        {activeSection === 'ai' && renderAiSection()}
        {activeSection === 'email' && renderEmailSection()}
        {activeSection === 'gmail' && renderGmailSection()}
        {activeSection === 'whatsapp' && renderWhatsappSection()}
        {activeSection === 'notifications' && renderNotificationsSection()}
        {activeSection === 'appearance' && renderAppearanceSection()}
        {activeSection === 'automation' && renderAutomationSection()}
        {activeSection === 'team' && renderTeamSection()}
        {activeSection === 'integrations' && renderIntegrationsSection()}
        {activeSection === 'stockmedia' && renderStockMediaSection()}
      </main>
    </div>
  );
}
