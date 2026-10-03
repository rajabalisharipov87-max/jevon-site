import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
process.chdir(projectRoot);
if (existsSync('.env.local')) process.loadEnvFile('.env.local');
export function databaseUrl() {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in the environment or .env.local');
  return process.env.DATABASE_URL;
}
