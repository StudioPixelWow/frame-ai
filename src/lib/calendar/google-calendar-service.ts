/**
 * Google Calendar API v3 integration (REST, no SDK).
 * Provides OAuth flow, event CRUD, and one-way sync from meetings → Google Calendar.
 */

import type { Meeting } from '@/lib/db/schema';

// ===== Types =====

export interface GoogleCalendarConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  calendarId: string; // default 'primary'
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface GoogleEventResource {
  id?: string;
  summary: string;
  description: string;
  location: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  status: string;
}

// ===== Constants =====

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';
const SCOPES = 'https://www.googleapis.com/auth/calendar';
const TIMEZONE = 'Asia/Jerusalem';

function getClientId(): string {
  return process.env.GOOGLE_CALENDAR_CLIENT_ID || '';
}

function getClientSecret(): string {
  return process.env.GOOGLE_CALENDAR_CLIENT_SECRET || '';
}

function getRedirectUri(): string {
  return process.env.GOOGLE_CALENDAR_REDIRECT_URI || '';
}

// ===== OAuth Flow =====

/**
 * Build the Google OAuth consent URL for calendar access.
 */
export function getAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange an authorization code for access + refresh tokens.
 */
export async function exchangeCode(code: string): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      redirect_uri: getRedirectUri(),
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`שגיאה בהחלפת קוד: ${err}`);
  }

  const data: GoogleTokenResponse = await res.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || '',
  };
}

/**
 * Get a fresh access token from a refresh token.
 */
export async function getAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`שגיאה בקבלת טוקן: ${err}`);
  }

  const data: GoogleTokenResponse = await res.json();
  return data.access_token;
}

// ===== Helpers =====

/**
 * Convert a Meeting into a Google Calendar event resource.
 */
function meetingToEvent(meeting: Meeting): GoogleEventResource {
  // Build ISO datetime strings: YYYY-MM-DDTHH:MM:00
  const startDateTime = `${meeting.date}T${meeting.startTime}:00`;
  const endDateTime = `${meeting.date}T${meeting.endTime}:00`;

  let statusStr = 'confirmed';
  if (meeting.status === 'cancelled') statusStr = 'cancelled';

  return {
    summary: meeting.title,
    description: meeting.description || '',
    location: meeting.location || '',
    start: { dateTime: startDateTime, timeZone: TIMEZONE },
    end: { dateTime: endDateTime, timeZone: TIMEZONE },
    status: statusStr,
  };
}

// ===== Event CRUD =====

/**
 * Create a new event in Google Calendar. Returns the event ID.
 */
export async function createCalendarEvent(
  meeting: Meeting,
  accessToken: string,
  calendarId: string = 'primary'
): Promise<{ eventId: string }> {
  const event = meetingToEvent(meeting);

  const res = await fetch(`${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`שגיאה ביצירת אירוע בגוגל: ${err}`);
  }

  const data = await res.json();
  return { eventId: data.id };
}

/**
 * Update an existing event in Google Calendar.
 */
export async function updateCalendarEvent(
  eventId: string,
  meeting: Meeting,
  accessToken: string,
  calendarId: string = 'primary'
): Promise<void> {
  const event = meetingToEvent(meeting);

  const res = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`שגיאה בעדכון אירוע בגוגל: ${err}`);
  }
}

/**
 * Delete an event from Google Calendar.
 */
export async function deleteCalendarEvent(
  eventId: string,
  accessToken: string,
  calendarId: string = 'primary'
): Promise<void> {
  const res = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok && res.status !== 404) {
    const err = await res.text();
    throw new Error(`שגיאה במחיקת אירוע מגוגל: ${err}`);
  }
}

// ===== Sync =====

/**
 * One-way push: sync an array of Meeting objects to Google Calendar.
 * Creates new events for each meeting. Returns summary.
 */
export async function syncMeetingsToCalendar(
  meetings: Meeting[],
  accessToken: string,
  calendarId: string = 'primary'
): Promise<{ synced: number; errors: string[] }> {
  let synced = 0;
  const errors: string[] = [];

  for (const meeting of meetings) {
    // Skip cancelled meetings
    if (meeting.status === 'cancelled') continue;

    try {
      await createCalendarEvent(meeting, accessToken, calendarId);
      synced++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`פגישה "${meeting.title}" (${meeting.id}): ${msg}`);
    }
  }

  return { synced, errors };
}
