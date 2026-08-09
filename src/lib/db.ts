// Shared Turso client factory. Credentials come from the environment; this is
// the single place the media-tracker builds its libSQL client.
const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

export async function getDb() {
  const { createClient } = await import('@libsql/client');
  return createClient({ url: TURSO_URL!, authToken: TURSO_TOKEN });
}
