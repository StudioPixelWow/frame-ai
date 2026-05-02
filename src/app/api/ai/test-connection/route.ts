import { NextRequest, NextResponse } from 'next/server';

interface TestConnectionBody {
  provider: 'openai' | 'anthropic';
  apiKey: string;
  model: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: TestConnectionBody = await req.json();
    const { provider, apiKey, model } = body;

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Missing API key' },
        { status: 400 }
      );
    }

    if (provider === 'openai') {
      try {
        const response = await fetch('https://api.openai.com/v1/models', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        });

        if (response.ok) {
          return NextResponse.json(
            {
              success: true,
              message: 'Connected to OpenAI',
            },
            { status: 200 }
          );
        } else if (response.status === 401) {
          return NextResponse.json(
            { success: false, error: 'Invalid API key for OpenAI' },
            { status: 401 }
          );
        } else {
          return NextResponse.json(
            { success: false, error: `OpenAI API error: ${response.statusText}` },
            { status: response.status }
          );
        }
      } catch (err) {
        return NextResponse.json(
          { success: false, error: 'Failed to connect to OpenAI API' },
          { status: 500 }
        );
      }
    } else if (provider === 'anthropic') {
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: model || 'claude-3-5-sonnet-20241022',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'test' }],
          }),
        });

        if (response.ok) {
          return NextResponse.json(
            {
              success: true,
              message: 'Connected to Anthropic',
            },
            { status: 200 }
          );
        } else if (response.status === 401) {
          return NextResponse.json(
            { success: false, error: 'Invalid API key for Anthropic' },
            { status: 401 }
          );
        } else {
          return NextResponse.json(
            { success: false, error: `Anthropic API error: ${response.statusText}` },
            { status: response.status }
          );
        }
      } catch (err) {
        return NextResponse.json(
          { success: false, error: 'Failed to connect to Anthropic API' },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'Unsupported provider' },
        { status: 400 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Invalid request' },
      { status: 400 }
    );
  }
}
