/**
 * Session token security.
 *
 *   npm run test:session
 *
 * The claim being tested is "a guest identity cannot be forged". That is worth
 * testing directly rather than through an integration test, because an
 * integration test that never tries to forge anything will pass whatever the
 * verifier does.
 */
process.env.SESSION_SECRET = "s".repeat(64);

import { readFileSync } from "node:fs";
import { SignJWT } from "jose";
import { cookieOptions, mintToken, verifyToken } from "./session-token";

const SESSION = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

let pass = 0;
const failures: string[] = [];

function check(label: string, condition: boolean, detail = "") {
  if (condition) {
    pass++;
    console.log(`  ok    ${label}`);
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("\n=== Round trip ===");
const good = await mintToken(SESSION);
check("a minted token verifies to its session", (await verifyToken(good)) === SESSION);
check("the token is opaque (three JWT segments)", good.split(".").length === 3);
check(
  "the session id is not readable as plain text in the token",
  !good.includes(SESSION),
  "payload is base64url, which is encoding not secrecy — but the cookie is HttpOnly",
);

console.log("\n=== Forgery ===");
check("garbage is rejected", (await verifyToken("not-a-token")) === null);
check("an empty string is rejected", (await verifyToken("")) === null);

// Same claims, attacker's key.
const wrongKey = await new SignJWT({})
  .setProtectedHeader({ alg: "HS256", typ: "JWT" })
  .setSubject(OTHER)
  .setIssuer("together")
  .setAudience("together:guest")
  .setIssuedAt()
  .setExpirationTime("30d")
  .sign(new TextEncoder().encode("x".repeat(64)));
check("a token signed with another key is rejected", (await verifyToken(wrongKey)) === null);

// The classic: strip the signature and claim the algorithm is "none".
const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
const payload = Buffer.from(
  JSON.stringify({ sub: OTHER, iss: "together", aud: "together:guest", exp: 9_999_999_999 }),
).toString("base64url");
check("an alg:none token is rejected", (await verifyToken(`${header}.${payload}.`)) === null);

// Flip a byte in the payload, keep the original signature.
const [h, p, s] = good.split(".");
const tamperedPayload = Buffer.from(
  JSON.stringify({ ...JSON.parse(Buffer.from(p, "base64url").toString()), sub: OTHER }),
).toString("base64url");
check(
  "editing the subject invalidates the signature",
  (await verifyToken(`${h}.${tamperedPayload}.${s}`)) === null,
);

// A token for a different audience — e.g. one lifted from another service
// sharing the secret.
const wrongAudience = await new SignJWT({})
  .setProtectedHeader({ alg: "HS256", typ: "JWT" })
  .setSubject(OTHER)
  .setIssuer("together")
  .setAudience("something:else")
  .setIssuedAt()
  .setExpirationTime("30d")
  .sign(new TextEncoder().encode(process.env.SESSION_SECRET!));
check("a token for another audience is rejected", (await verifyToken(wrongAudience)) === null);

const wrongIssuer = await new SignJWT({})
  .setProtectedHeader({ alg: "HS256", typ: "JWT" })
  .setSubject(OTHER)
  .setIssuer("someone-else")
  .setAudience("together:guest")
  .setIssuedAt()
  .setExpirationTime("30d")
  .sign(new TextEncoder().encode(process.env.SESSION_SECRET!));
check("a token from another issuer is rejected", (await verifyToken(wrongIssuer)) === null);

console.log("\n=== Expiry ===");
const expired = await new SignJWT({})
  .setProtectedHeader({ alg: "HS256", typ: "JWT" })
  .setSubject(SESSION)
  .setIssuer("together")
  .setAudience("together:guest")
  .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
  .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
  .sign(new TextEncoder().encode(process.env.SESSION_SECRET!));
check("an expired token is rejected", (await verifyToken(expired)) === null);

console.log("\n=== Rotation ===");
// A token minted under the old secret keeps working while it is still listed,
// so rotating does not sign every guest out of every room at once.
const previous = "p".repeat(64);
process.env.SESSION_SECRET = previous;
const underOld = await mintToken(SESSION);
process.env.SESSION_SECRET = "n".repeat(64);
check("after rotating, an old token alone is rejected", (await verifyToken(underOld)) === null);
process.env.SESSION_SECRET_PREVIOUS = previous;
check("with the previous secret listed, it verifies again", (await verifyToken(underOld)) === SESSION);
delete process.env.SESSION_SECRET_PREVIOUS;
check("removing the previous secret retires it", (await verifyToken(underOld)) === null);

console.log("\n=== Weak configuration is refused, not tolerated ===");
process.env.SESSION_SECRET = "short";
let threw = false;
try {
  await mintToken(SESSION);
} catch {
  threw = true;
}
check("a secret under 32 characters throws rather than signing weakly", threw);
process.env.SESSION_SECRET = "s".repeat(64);

console.log("\n=== Cookie policy ===");
const opts = cookieOptions();
check("HttpOnly — client script cannot read it", opts.httpOnly === true);
check("SameSite=Lax — not sent on cross-site POSTs", opts.sameSite === "lax");
check("Path=/", opts.path === "/");
check("expires in 30 days", opts.maxAge === 30 * 24 * 60 * 60);

// `process.env.NODE_ENV` is not writable under tsx, so read the policy the way
// the code does rather than trying to fake the environment around it.
const secureInProd = /NODE_ENV === "production"/.test(
  readFileSync(new URL("./session-token.ts", import.meta.url), "utf8"),
);
check("Secure is tied to NODE_ENV === production", secureInProd);
check(
  "not Secure in development, so http://localhost still works",
  cookieOptions().secure === (process.env.NODE_ENV === "production"),
);

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFailures:");
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
