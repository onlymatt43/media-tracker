// Required configuration, read per call so `next build` never needs runtime
// secrets. A missing or malformed value throws with the variable's name (never
// its value) instead of falling back to a baked-in default.

export function requireEnv(name: string, value: string | undefined = process.env[name]): string {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(`Missing env variable: ${name}`);
  return trimmed;
}

export function requirePositiveIntEnv(name: string): number {
  const raw = requireEnv(name);
  if (!/^\d+$/.test(raw)) throw new Error(`Env variable ${name} must be a positive integer`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Env variable ${name} must be a positive integer`);
  }
  return value;
}
