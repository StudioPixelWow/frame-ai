import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'frameai-dev-secret-change-in-production-2026';
const TOKEN_EXPIRY_HOURS = 24;

interface JWTPayload {
  userId: string;
  email: string;
  role: 'admin' | 'employee' | 'client';
  clientId?: string | null;
  employeeId?: string | null;
  iat: number;
  exp: number;
}

function base64url(input: string | Buffer): string {
  const b = typeof input === 'string' ? Buffer.from(input) : input;
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(input: string): string {
  const padded = input + '='.repeat((4 - input.length % 4) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
}

/** Sign a JWT token. */
export function signToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + TOKEN_EXPIRY_HOURS * 3600,
  };

  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(fullPayload));
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest();

  return `${header}.${body}.${base64url(signature)}`;
}

/** Verify and decode a JWT token. Returns null if invalid or expired. */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, sig] = parts;
    const expectedSig = base64url(
      crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest()
    );

    if (sig !== expectedSig) return null;

    const payload: JWTPayload = JSON.parse(base64urlDecode(body));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}
