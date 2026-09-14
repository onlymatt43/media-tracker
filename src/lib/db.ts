// Shared Turso client factory. Credentials come from the environment; this is
// the single place the media-tracker builds its libSQL client.
const REQUIRED_ENV = ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'] as const;

// Names of the required database variables that are unset or blank.
export function missingDbEnv(): string[] {
  return REQUIRED_ENV.filter((name) => !process.env[name]?.trim());
}

// Throws naming every missing variable (never its value) instead of handing
// libSQL an undefined URL, whose error says nothing about the configuration.
export async function getDb() {
  const missing = missingDbEnv();
  if (missing.length) {
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
  }
  const { createClient } = await import('@libsql/client');
  return createClient({
    url: process.env.TURSO_DATABASE_URL!.trim(),
    authToken: process.env.TURSO_AUTH_TOKEN!.trim(),
  });
}
