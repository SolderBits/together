/**
 * Session tokens: signing, verification and cookie policy.
 *
 * Deliberately free of any Next.js import, so the security properties claimed
 * for it — a forged token is rejected, an altered one is rejected, an expired
 * one is rejected, `alg: none` is rejected — can be tested directly rather than
 * inferred from an integration test that could pass for the wrong reason.
 *
 * `session.ts` composes this with the request plumbing.
 */
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const COOKIE = "together_session";
const ISSUER = "together";
const AUDIENCE = "together:guest";
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function secretFrom(value: string | undefined, name: string): Uint8Array {
  if (!value || value.length < 32) {
    throw new Error(
      `${name} must be set to at least 32 characters. Generate one with: openssl rand -hex 32`,
    );
  }
  return new TextEncoder().encode(value);
}

function signingKey() {
  return secretFrom(process.env.SESSION_SECRET, "SESSION_SECRET");
}

/**
 * Keys a token may have been signed with: the current one, and the previous one
 * during a rotation. Without this, rotating the secret would sign every guest
 * out of every room at once.
 */
function verificationKeys(): Uint8Array[] {
  const keys = [signingKey()];
  const previous = process.env.SESSION_SECRET_PREVIOUS;
  if (previous && previous.length >= 32) keys.push(new TextEncoder().encode(previous));
  return keys;
}

export interface SessionToken extends JWTPayload {
  sub: string;
}

export async function mintToken(sessionId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(sessionId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(signingKey());
}

/**
 * Signature check only. Says the token is ours and unaltered; says nothing
 * about whether the session behind it still exists.
 */
export async function verifyToken(token: string): Promise<string | null> {
  for (const key of verificationKeys()) {
    try {
      const { payload } = await jwtVerify(token, key, {
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithms: ["HS256"], // pinned: an unpinned verifier accepts `alg: none`
      });
      if (typeof payload.sub === "string" && payload.sub) return payload.sub;
    } catch {
      // Try the next key; a failure here is an ordinary bad cookie.
    }
  }
  return null;
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}

export const SESSION_COOKIE = COOKIE;
