import type { Config } from 'drizzle-kit';

export default {
    schema: './lib/db/schema.ts',
    out: './drizzle',
    dialect: 'postgresql',
    schemaFilter: ['public'],
    dbCredentials: {
        url: process.env.DATABASE_URL!,
        ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
    },
    verbose: true,
    strict: true,
} satisfies Config;
