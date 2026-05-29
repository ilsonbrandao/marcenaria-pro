// Migração de dados: Supabase -> Coolify Postgres (marcenaria)
// Uso: node scripts/migrate-data.mjs
import { readFileSync } from 'node:fs';
import pg from 'pg';

const { Client } = pg;

function loadEnv(path) {
    const env = {};
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m) env[m[1]] = m[2];
    }
    return env;
}

const env = loadEnv('.env.local');
const SOURCE = env.SUPABASE_DB_URL;
const TARGET = env.DATABASE_URL;
if (!SOURCE || !TARGET) throw new Error('SUPABASE_DB_URL ou DATABASE_URL ausente em .env.local');

// Ordem segura de FKs
const ORDER = [
    'organizations',
    'profiles',
    'clients', 'architects', 'suppliers', 'inventory', 'kanban_stages', 'price_table_items',
    'sales',
    'budgets', 'budget_environments', 'budget_items',
    'installments', 'stock_movements', 'expenses', 'commissions', 'purchases',
    'project_messages', 'project_files', 'calendar_events', 'audit_logs',
];

const src = new Client({ connectionString: SOURCE, ssl: { rejectUnauthorized: false } });
const tgt = new Client({ connectionString: TARGET, ssl: false });

function encode(v) {
    if (v !== null && typeof v === 'object' && !(v instanceof Date) && !Buffer.isBuffer(v)) {
        return JSON.stringify(v); // jsonb / arrays
    }
    return v;
}

async function targetColumns(table) {
    const r = await tgt.query(
        `select column_name from information_schema.columns
         where table_schema='public' and table_name=$1 and is_generated='NEVER'
         order by ordinal_position`, [table]);
    return r.rows.map(x => x.column_name);
}

async function copyTable(table) {
    const cols = await targetColumns(table);
    const colList = cols.map(c => `"${c}"`).join(', ');
    const srcRows = await src.query(`SELECT ${colList} FROM public."${table}"`);
    if (srcRows.rows.length === 0) { console.log(`  ${table}: 0 linhas`); return; }

    const BATCH = 200;
    let inserted = 0;
    for (let i = 0; i < srcRows.rows.length; i += BATCH) {
        const slice = srcRows.rows.slice(i, i + BATCH);
        const values = [];
        const params = [];
        let p = 1;
        for (const row of slice) {
            const ph = cols.map(() => `$${p++}`);
            values.push(`(${ph.join(', ')})`);
            for (const c of cols) params.push(encode(row[c]));
        }
        await tgt.query(
            `INSERT INTO public."${table}" (${colList}) VALUES ${values.join(', ')} ON CONFLICT DO NOTHING`,
            params);
        inserted += slice.length;
    }
    console.log(`  ${table}: ${inserted} linhas`);
}

async function copyUsers() {
    // auth.users (Supabase) -> public.users (Auth.js)
    const r = await src.query(
        `SELECT id, email, encrypted_password, email_confirmed_at, created_at FROM auth.users`);
    let n = 0;
    for (const u of r.rows) {
        await tgt.query(
            `INSERT INTO public.users (id, email, password_hash, email_verified, created_at)
             VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
            [u.id, u.email, u.encrypted_password, u.email_confirmed_at, u.created_at]);
        n++;
    }
    console.log(`  users: ${n} linhas (de auth.users)`);
}

(async () => {
    await src.connect();
    await tgt.connect();
    console.log('Conectado. Limpando tabelas alvo...');
    await tgt.query(`TRUNCATE ${['users', ...ORDER].map(t => `public."${t}"`).join(', ')} RESTART IDENTITY CASCADE`);

    console.log('Copiando users...');
    await copyUsers();
    console.log('Copiando tabelas...');
    for (const t of ORDER) await copyTable(t);

    await src.end();
    await tgt.end();
    console.log('Concluído.');
})().catch(e => { console.error('FALHA:', e.message); process.exit(1); });
