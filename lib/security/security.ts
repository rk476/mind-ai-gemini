import { NextRequest } from 'next/server';
import { config } from '@/lib/config';

// ─── URL Validation ────────────────────────────────────────────────────

const BLOCKED_PATTERNS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^169\.254\.\d+\.\d+$/,
  /^\[::1\]$/,
  /^0\.0\.0\.0$/,
];

export function validateTargetUrl(urlStr: string): { valid: boolean; reason?: string } {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return { valid: false, reason: 'Invalid URL format' };
  }

  if (parsed.protocol === 'file:') {
    return { valid: false, reason: 'file:// protocol is not allowed' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, reason: `Protocol ${parsed.protocol} is not allowed` };
  }

  const hostname = parsed.hostname;

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(hostname)) {
      return { valid: false, reason: `Blocked hostname: ${hostname}` };
    }
  }

  if (config.domainAllowlist.length > 0) {
    const allowed = config.domainAllowlist.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );
    if (!allowed) {
      return { valid: false, reason: `Domain ${hostname} is not in allowlist` };
    }
  }

  return { valid: true };
}

// ─── Rate Limiting ─────────────────────────────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(ip: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + config.rateLimit.windowMs });
    return { allowed: true };
  }

  if (entry.count >= config.rateLimit.maxRequests) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true };
}

// ─── Auth Middleware ────────────────────────────────────────────────────

export function validateAuth(req: NextRequest): boolean {
  if (config.app.nodeEnv === 'development') return true;
  // Also allow if it's localhost (server-to-server or local client without NODE_ENV set perfectly)
  const host = req.headers.get('host') || '';
  if (host.includes('localhost') || host.includes('127.0.0.1')) return true;

  const authHeader = req.headers.get('authorization');
  if (!authHeader) return false;

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return false;

  return token === config.app.apiSecret;
}

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}
