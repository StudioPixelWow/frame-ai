import { NextRequest, NextResponse } from 'next/server';
import { aiSettings } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function POST(request: NextRequest) {
  ensureSeeded();

  try {
    // Accept provider and apiKey from request body (sent by settings page)
    const body = await request.json().catch(() => ({}));
    const provider = body.provider as string | undefined;
    const apiKey = body.apiKey as string | undefined;

    const settings = aiSettings.getAll();
    const current = settings[0];

    // Determine which provider to test
    const testProvider = provider || current?.provider;
    const testKey = apiKey || (testProvider === 'assemblyai' ? current?.assemblyaiApiKey : current?.apiKey);

    if (!testKey) {
      return NextResponse.json({
        status: 'missing_key',
        message: 'מפתח API חסר'
      });
    }

    const now = new Date().toISOString();

    // Test OpenAI
    if (testProvider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${testKey}`,
        },
      });

      if (response.ok) {
        if (current) {
          aiSettings.update(current.id, {
            connectionStatus: 'connected',
            lastTestedAt: now
          });
        }
        return NextResponse.json({
          status: 'connected',
          message: 'החיבור תקין — OpenAI פעיל'
        });
      } else {
        const error = await response.json().catch(() => ({}));
        if (current) {
          aiSettings.update(current.id, {
            connectionStatus: 'invalid_key',
            lastTestedAt: now
          });
        }
        return NextResponse.json({
          status: 'invalid_key',
          message: `מפתח שגוי: ${error?.error?.message || response.statusText}`
        });
      }
    }

    // Test Anthropic
    if (testProvider === 'anthropic') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': testKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5-20250514',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'test' }]
        }),
      });

      if (response.ok || response.status === 200) {
        if (current) {
          aiSettings.update(current.id, {
            connectionStatus: 'connected',
            lastTestedAt: now
          });
        }
        return NextResponse.json({
          status: 'connected',
          message: 'החיבור תקין — Anthropic פעיל'
        });
      } else {
        const error = await response.json().catch(() => ({}));
        if (current) {
          aiSettings.update(current.id, {
            connectionStatus: 'invalid_key',
            lastTestedAt: now
          });
        }
        return NextResponse.json({
          status: 'invalid_key',
          message: `מפתח שגוי: ${error?.error?.message || response.statusText}`
        });
      }
    }

    // Test AssemblyAI
    if (testProvider === 'assemblyai') {
      const response = await fetch('https://api.assemblyai.com/v2/transcript?limit=1', {
        headers: {
          'Authorization': testKey,
        },
      });

      if (response.ok) {
        if (current) {
          aiSettings.update(current.id, {
            assemblyaiConnectionStatus: 'connected',
            assemblyaiLastTestedAt: now,
            assemblyaiLastTestError: ''
          });
        }
        return NextResponse.json({
          status: 'connected',
          message: 'החיבור תקין — AssemblyAI פעיל'
        });
      } else {
        const error = await response.json().catch(() => ({}));
        const errorMsg = error?.error || response.statusText || 'Unknown error';
        if (current) {
          aiSettings.update(current.id, {
            assemblyaiConnectionStatus: 'invalid_key',
            assemblyaiLastTestedAt: now,
            assemblyaiLastTestError: errorMsg
          });
        }
        return NextResponse.json({
          status: 'invalid_key',
          message: `מפתח שגוי: ${errorMsg}`
        });
      }
    }

    return NextResponse.json({ status: 'untested', message: 'ספק לא מוגדר' });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: `שגיאת חיבור: ${error.message}`
    }, { status: 500 });
  }
}
