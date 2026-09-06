import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import type { ObjectStore, PresignedUpload } from "./types";

/**
 * Storage on this machine, with the same contract as R2.
 *
 * Not a stub. The URLs it hands out are genuinely signed and genuinely
 * verified: the client PUTs bytes to a real endpoint, an HMAC over the key,
 * method and expiry is checked, and a tampered or expired URL is refused. That
 * matters because the point of testing the upload path is to test the *path* —
 * a mock that resolves `{ ok: true }` proves only that the mock is agreeable.
 *
 * What it does not prove is that R2 behaves as documented. That needs real
 * credentials and is stage 13.
 *
 * It also makes Photobooth and Snap Hunt work in local development with no
 * Cloudflare account, which is the same reason `LocalRoomTransport` exists.
 */

const ROOT = process.env.LOCAL_STORAGE_DIR ?? join(tmpdir(), "together-media");

function signingKey(): Buffer {
  // Falls back to the session secret so local development needs one variable
  // fewer; a deployment that uses this adapter at all is not production.
  const secret = process.env.STORAGE_SIGNING_SECRET ?? process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "Local object storage needs SESSION_SECRET (or STORAGE_SIGNING_SECRET) set to 32+ characters.",
    );
  }
  return Buffer.from(secret, "utf8");
}

function sign(key: string, method: "PUT" | "GET", expiresAt: number): string {
  return createHmac("sha256", signingKey())
    .update(`${method}\n${key}\n${expiresAt}`)
    .digest("base64url");
}

/**
 * Confirms a signature without leaking timing, and refuses anything expired.
 *
 * Exported because the route that serves these URLs is the other half of the
 * adapter and must apply exactly the same rule.
 */
export function verifyLocalSignature(
  key: string,
  method: "PUT" | "GET",
  expiresAt: number,
  signature: string,
): boolean {
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const expected = Buffer.from(sign(key, method, expiresAt));
  const given = Buffer.from(String(signature ?? ""));
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
}

/**
 * Resolves a key to a path, refusing anything that escapes the root.
 *
 * Keys are server-generated, so this should never trigger — which is exactly
 * why it is here. A traversal check that only exists where traversal is
 * expected is a check that was never needed.
 */
function pathFor(key: string): string {
  const full = resolve(ROOT, key);
  const root = resolve(ROOT);
  if (full !== root && !full.startsWith(root + sep)) {
    throw new Error("Refused an object key that escapes the storage root.");
  }
  return full;
}

export class LocalObjectStore implements ObjectStore {
  readonly kind = "local" as const;

  constructor(private readonly origin = "") {}

  async presignUpload(key: string, contentType: string): Promise<PresignedUpload> {
    const expiresAt = Date.now() + 300_000;
    const signature = sign(key, "PUT", expiresAt);
    return {
      url:
        `${this.origin}/api/media/blob?key=${encodeURIComponent(key)}` +
        `&expires=${expiresAt}&sig=${signature}`,
      headers: { "content-type": contentType },
      expiresAt,
    };
  }

  async presignDownload(key: string, ttlSeconds: number): Promise<string> {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    const signature = sign(key, "GET", expiresAt);
    return (
      `${this.origin}/api/media/blob?key=${encodeURIComponent(key)}` +
      `&expires=${expiresAt}&sig=${signature}`
    );
  }

  async head(key: string, prefixBytes: number) {
    try {
      const path = pathFor(key);
      const info = await stat(path);
      const handle = await readFile(path);
      return {
        object: { bytes: info.size, contentType: "application/octet-stream" },
        prefix: new Uint8Array(handle.subarray(0, prefixBytes)),
      };
    } catch {
      return null;
    }
  }

  async remove(keys: string[]): Promise<void> {
    await Promise.all(
      keys.map(async (key) => {
        try {
          await rm(pathFor(key), { force: true });
        } catch {
          /* already gone */
        }
      }),
    );
  }

  // --- the endpoint half ----------------------------------------------------

  async put(key: string, body: Uint8Array): Promise<void> {
    const path = pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      return new Uint8Array(await readFile(pathFor(key)));
    } catch {
      return null;
    }
  }
}
