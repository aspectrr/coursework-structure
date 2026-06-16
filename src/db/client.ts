import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const url = process.env.DATABASE_URL ?? 'postgres://coursework:coursework@localhost:5432/coursework';

// Strip sslmode params that don't matter for local
const pool = new Pool({ connectionString: url });

export const db = drizzle(pool, { schema });
export { schema };
