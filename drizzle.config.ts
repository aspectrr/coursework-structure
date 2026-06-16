import { defineConfig } from 'drizzle-kit';

const url = process.env.DATABASE_URL ?? 'postgres://coursework:coursework@localhost:5432/coursework';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
  verbose: true,
  strict: true,
});
