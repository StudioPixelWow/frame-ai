/**
 * Agency Intelligence — Migration
 * POST: Create all required tables
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);

export async function POST() {
  const results: Record<string, string> = {};

  const tables = [
    {
      name: 'agency_calibration',
      sql: `CREATE TABLE IF NOT EXISTS agency_calibration (
        id TEXT PRIMARY KEY DEFAULT 'default',
        ideal_cpl_per_industry JSONB DEFAULT '{}',
        acceptable_ctr_range JSONB DEFAULT '{"min":1.5,"max":5.0}',
        high_performance_threshold NUMERIC DEFAULT 3.0,
        low_performance_threshold NUMERIC DEFAULT 1.0,
        preferred_creative_styles JSONB DEFAULT '[]',
        preferred_hooks JSONB DEFAULT '[]',
        tone_of_voice TEXT DEFAULT '',
        campaign_strategy_preferences JSONB DEFAULT '{}',
        risk_tolerance_level TEXT DEFAULT 'moderate',
        scaling_rules JSONB DEFAULT '[]',
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    },
    {
      name: 'agency_playbooks',
      sql: `CREATE TABLE IF NOT EXISTS agency_playbooks (
        id TEXT PRIMARY KEY,
        industry TEXT NOT NULL,
        name TEXT DEFAULT '',
        description TEXT DEFAULT '',
        pain_points JSONB DEFAULT '[]',
        hooks JSONB DEFAULT '[]',
        angles JSONB DEFAULT '[]',
        ctas JSONB DEFAULT '[]',
        audience_strategy TEXT DEFAULT '',
        campaign_structure TEXT DEFAULT '',
        content_ideas JSONB DEFAULT '[]',
        what_to_avoid JSONB DEFAULT '[]',
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    },
    {
      name: 'agency_campaign_templates',
      sql: `CREATE TABLE IF NOT EXISTS agency_campaign_templates (
        id TEXT PRIMARY KEY,
        industry TEXT NOT NULL,
        name TEXT DEFAULT '',
        objective TEXT DEFAULT 'leads',
        structure TEXT DEFAULT '',
        ad_set_presets JSONB DEFAULT '[]',
        budget_logic TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    },
    {
      name: 'agency_ad_templates',
      sql: `CREATE TABLE IF NOT EXISTS agency_ad_templates (
        id TEXT PRIMARY KEY,
        industry TEXT NOT NULL,
        name TEXT DEFAULT '',
        hook_text TEXT DEFAULT '',
        body_text TEXT DEFAULT '',
        cta_text TEXT DEFAULT '',
        structure TEXT DEFAULT 'image',
        notes TEXT DEFAULT '',
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    },
    {
      name: 'agency_content_templates',
      sql: `CREATE TABLE IF NOT EXISTS agency_content_templates (
        id TEXT PRIMARY KEY,
        industry TEXT NOT NULL,
        name TEXT DEFAULT '',
        video_idea TEXT DEFAULT '',
        hook_angle TEXT DEFAULT '',
        format TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    },
    {
      name: 'agency_learning_suggestions',
      sql: `CREATE TABLE IF NOT EXISTS agency_learning_suggestions (
        id TEXT PRIMARY KEY,
        industry TEXT NOT NULL,
        type TEXT DEFAULT 'hook',
        text TEXT DEFAULT '',
        reason TEXT DEFAULT '',
        confidence NUMERIC DEFAULT 0,
        source TEXT DEFAULT '',
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    },
  ];

  for (const table of tables) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: table.sql });
      if (error) {
        // Try direct insert to check if table already exists
        const { error: checkError } = await supabase.from(table.name).select('*').limit(1);
        if (checkError) {
          results[table.name] = `error: ${error.message}`;
        } else {
          results[table.name] = 'already_exists';
        }
      } else {
        results[table.name] = 'created';
      }
    } catch (e) {
      // Try to check if table exists
      try {
        const { error: checkError } = await supabase.from(table.name).select('*').limit(1);
        results[table.name] = checkError ? `error: ${String(e)}` : 'already_exists';
      } catch {
        results[table.name] = `error: ${String(e)}`;
      }
    }
  }

  return NextResponse.json({
    message: 'Agency Intelligence migration complete',
    tables: results,
  });
}
