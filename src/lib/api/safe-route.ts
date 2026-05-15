import { NextRequest, NextResponse } from 'next/server';

/**
 * API route wrapper — catches all errors, returns structured JSON.
 * Usage:
 *   export const GET = safeRoute(async (req) => { ... return data; });
 */
export function safeRoute<T = any>(
  handler: (req: NextRequest, ctx?: any) => Promise<T>
) {
  return async (req: NextRequest, ctx?: any) => {
    try {
      const result = await handler(req, ctx);
      // If handler already returned a NextResponse, pass through
      if (result instanceof NextResponse) return result;
      return NextResponse.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      const stack = process.env.NODE_ENV === 'development' && error instanceof Error
        ? error.stack : undefined;

      console.error(`[API ERROR] ${req.method} ${req.nextUrl.pathname}:`, message);

      return NextResponse.json(
        { error: message, ...(stack ? { stack } : {}) },
        { status: 500 }
      );
    }
  };
}

/**
 * Validates required fields in a request body
 */
export function validateRequired(body: Record<string, any>, fields: string[]): string | null {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return `Missing required field: ${field}`;
    }
  }
  return null;
}
