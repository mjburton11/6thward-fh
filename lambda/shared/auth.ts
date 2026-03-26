import * as jwt from 'jsonwebtoken';
import { getSecrets } from './secrets';

export interface JWTPayload {
  authorized: boolean;
  iat?: number;
  exp?: number;
}

/**
 * Generate a JWT token
 */
export async function generateToken(): Promise<string> {
  const secrets = await getSecrets();
  const payload: JWTPayload = {
    authorized: true,
  };

  return jwt.sign(payload, secrets.jwtSecret, {
    expiresIn: '24h',
  });
}

/**
 * Verify and decode JWT token
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const secrets = await getSecrets();
    const decoded = jwt.verify(token, secrets.jwtSecret) as JWTPayload;
    return decoded;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

/**
 * Extract token from Authorization header
 */
export function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Get CORS headers
 */
export function getCorsHeaders(allowedOrigin: string = '*'): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Auth-Token,HX-Request,HX-Trigger,HX-Target,HX-Current-URL,HX-Boosted,HX-Prompt',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Expose-Headers': 'X-Auth-Token',
  };
}
