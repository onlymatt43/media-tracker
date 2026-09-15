import { generateKeyPairSync, randomBytes, randomUUID, sign, type KeyObject } from 'node:crypto';

// Test helpers. Every secret and key is generated for the test run.

export const randomHexSecret = (bytes = 32) => randomBytes(bytes).toString('hex');

export function passKeys(): { privateKey: KeyObject; publicKeyBase64: string } {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    privateKey,
    publicKeyBase64: publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
  };
}

/** A pass in the portal's format: v1.<base64url payload>.<base64url Ed25519 signature of "v1.<payload>">. */
export function mintPass(privateKey: KeyObject, payload: Record<string, unknown>): string {
  const body = `v1.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
  return `${body}.${sign(null, Buffer.from(body), privateKey).toString('base64url')}`;
}

export function passPayload(audience: string, ttlMs: number, extra: Record<string, unknown> = {}, now = Date.now()) {
  return { aud: audience, iat: now, exp: now + ttlMs, jti: randomUUID(), ...extra };
}

/** Removes the given variables, restoring whatever was there before the tests. */
export function envSnapshot(names: string[]): () => void {
  const saved = Object.fromEntries(names.map((n) => [n, process.env[n]]));
  return () => {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  };
}
