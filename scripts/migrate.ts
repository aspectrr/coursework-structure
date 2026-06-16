import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'node:path';

const url = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString: url });
const db = drizzle(pool);

migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') })
  .then(() => {
    console.log('[migrate] done');
    pool.end();
  })
  .catch((e) => {
    console.error('[migrate] failed:', e);
    pool.end();
    process.exit(1);
  });
