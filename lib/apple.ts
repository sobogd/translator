// Sign in with Apple helpers (ported from iq-factura-api/src/auth/apple-auth.ts):
// ES256 client-secret JWT + code exchange + id_token verification against
// Apple's public JWKS. Env: APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_SERVICES_ID
// (Services ID = client_id), APPLE_PRIVATE_KEY (PKCS#8, may be single-line
// with literal \n sequences).
import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from "jose";

export interface AppleConfig {
  teamId: string;
  keyId: string;
  servicesId: string;
  privateKey: string;
}

export function appleConfigured(): boolean {
  return Boolean(
    process.env.APPLE_TEAM_ID &&
      process.env.APPLE_KEY_ID &&
      process.env.APPLE_SERVICES_ID &&
      process.env.APPLE_PRIVATE_KEY,
  );
}

export function appleConfig(): AppleConfig {
  return {
    teamId: process.env.APPLE_TEAM_ID || "",
    keyId: process.env.APPLE_KEY_ID || "",
    servicesId: process.env.APPLE_SERVICES_ID || "",
    privateKey: process.env.APPLE_PRIVATE_KEY || "",
  };
}

/** Short-lived ES256 client secret (5 min) signed with the team's key. */
export async function appleClientSecret(): Promise<string> {
  const cfg = appleConfig();
  const pem = cfg.privateKey.replace(/\\n/g, "\n");
  const key = await importPKCS8(pem, "ES256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: cfg.keyId })
    .setIssuer(cfg.teamId)
    .setAudience("https://appleid.apple.com")
    .setSubject(cfg.servicesId)
    .setIssuedAt()
    .setExpirationTime("300s")
    .sign(key);
}

const appleJwks = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

export async function exchangeAuthCode(code: string, redirectUri: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: appleConfig().servicesId,
    client_secret: await appleClientSecret(),
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });
  const res = await fetch("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error("apple_token_exchange_failed");
  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token) throw new Error("apple_missing_id_token");
  return data.id_token;
}

export interface AppleIdentity {
  sub: string;
  email?: string;
  emailVerified: boolean;
}

/** Verifies the id_token against Apple's JWKS and returns the identity. */
export async function verifyAppleIdToken(idToken: string): Promise<AppleIdentity> {
  const { payload } = await jwtVerify(idToken, appleJwks, {
    issuer: "https://appleid.apple.com",
    audience: appleConfig().servicesId,
  });
  const email = typeof payload.email === "string" ? payload.email : undefined;
  const verified =
    payload.email_verified === true ||
    payload.email_verified === "true" ||
    payload.is_private_email === "true";
  return {
    sub: String(payload.sub),
    email,
    emailVerified: email ? verified : false,
  };
}
