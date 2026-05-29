import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error('DATABASE_URL não configurada.');
}

const globalForDb = globalThis as unknown as { pool?: Pool };

const pool =
    globalForDb.pool ??
    new Pool({
        connectionString,
        ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
    });

if (process.env.NODE_ENV !== 'production') globalForDb.pool = pool;

export const db = drizzle(pool, { schema });
