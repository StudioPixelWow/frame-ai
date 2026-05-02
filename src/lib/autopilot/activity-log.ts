/**
 * Autopilot Activity Log
 *
 * Tracks everything:
 * - scan started/completed
 * - opportunity detected
 * - decision made
 * - action created/approved/rejected/executed/failed
 * - learning updated
 * - mode changes
 */

import { createClient } from '@supabase/supabase-js';
import type { ActivityType } from './types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);

export interface LogActivityInput {
  runId: string | null;
  clientId: string | null;
  actionId: string | null;
  activityType: ActivityType;
  title: string;
  details: string;
  metadata: Record<string, unknown>;
}

export const ACTIVITY_TYPE_META: Record<ActivityType, { label: string; icon: string; color: string }> = {
  scan_started: { label: 'סריקה החלה', icon: '🔍', color: '#2563eb' },
  scan_completed: { label: 'סריקה הושלמה', icon: '✅', color: '#16a34a' },
  opportunity_detected: { label: 'הזדמנות זוהתה', icon: '💡', color: '#ca8a04' },
  decision_made: { label: 'החלטה התקבלה', icon: '🧠', color: '#7c3aed' },
  action_created: { label: 'פעולה נוצרה', icon: '📋', color: '#2563eb' },
  approval_requested: { label: 'בקשת אישור', icon: '⏳', color: '#ca8a04' },
  approved: { label: 'אושר', icon: '✅', color: '#16a34a' },
  rejected: { label: 'נדחה', icon: '❌', color: '#dc2626' },
  executed: { label: 'בוצע', icon: '🎯', color: '#16a34a' },
  execution_failed: { label: 'ביצוע נכשל', icon: '⚠️', color: '#dc2626' },
  learning_updated: { label: 'למידה עודכנה', icon: '📊', color: '#7c3aed' },
  autopilot_paused: { label: 'אוטופיילוט הושהה', icon: '⏸️', color: '#6b7280' },
  autopilot_resumed: { label: 'אוטופיילוט חודש', icon: '▶️', color: '#16a34a' },
  mode_changed: { label: 'מצב שונה', icon: '🔄', color: '#2563eb' },
};

export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    await supabase.from('autopilot_activity_log').insert({
      id: `apl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      run_id: input.runId,
      client_id: input.clientId,
      action_id: input.actionId,
      activity_type: input.activityType,
      title: input.title,
      details: input.details,
      metadata: input.metadata,
      created_at: new Date().toISOString(),
    });
  } catch {
    // best effort — don't crash the loop for logging
  }
}
