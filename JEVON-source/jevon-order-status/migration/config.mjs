import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
process.chdir(projectRoot);
if (existsSync('.env')) process.loadEnvFile('.env');
export function databaseUrl() {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in .env or the server environment');
  return process.env.DATABASE_URL;
}
