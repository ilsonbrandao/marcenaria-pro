// Migração de arquivos: Supabase Storage -> DigitalOcean Spaces
// Uso: node scripts/migrate-storage.mjs   (requer SPACES_* preenchidas em .env.local)
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const { Client } = pg;

function loadEnv(path) {
    const env = {};
    try {
        for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
            const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
            if (m) env[m[1]] = m[2];
        }
    } catch {}
    return env;
}

const env = { ...loadEnv('.env'), ...loadEnv('.env.local') };
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const DB = env.DATABASE_URL;
const BUCKET = env.SPACES_BUCKET;
if (!SUPA_URL || !SERVICE_KEY) throw new Error('Faltam NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY em .env');
if (!BUCKET || !env.SPACES_KEY) throw new Error('Faltam credenciais SPACES_* em .env.local');

const s3 = new S3Client({
    endpoint: env.SPACES_ENDPOINT,
    region: env.SPACES_REGION || 'us-east-1',
    credentials: { accessKeyId: env.SPACES_KEY, secretAccessKey: env.SPACES_SECRET },
    forcePathStyle: false,
});

function publicUrl(key) {
    if (env.SPACES_PUBLIC_BASE) return `${env.SPACES_PUBLIC_BASE}/${key}`;
    const host = (env.SPACES_ENDPOINT || '').replace(/^https?:\/\//, '');
    return `https://${BUCKET}.${host}/${key}`;
}

async function downloadFromSupabase(bucket, path) {
    const url = `${SUPA_URL}/storage/v1/object/${bucket}/${path}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${SERVICE_KEY}` } });
    if (!res.ok) throw new Error(`download falhou (${res.status}) ${bucket}/${path}`);
    const buf = Buffer.from(await res.arrayBuffer());
    return { buf, contentType: res.headers.get('content-type') || 'application/octet-stream' };
}

async function upload(key, buf, contentType, isPublic) {
    await s3.send(new PutObjectCommand({
        Bucket: BUCKET, Key: key, Body: buf, ContentType: contentType,
        ACL: isPublic ? 'public-read' : 'private',
    }));
}

const c = new Client({ connectionString: DB, ssl: false });

(async () => {
    await c.connect();

    // 1) project_files (privados) — key = file_path
    const files = (await c.query('select file_path from project_files')).rows;
    console.log(`project_files: ${files.length}`);
    for (const f of files) {
        try {
            const { buf, contentType } = await downloadFromSupabase('project-files', f.file_path);
            await upload(f.file_path, buf, contentType, false);
            console.log('  ok', f.file_path);
        } catch (e) { console.error('  ERRO', f.file_path, e.message); }
    }

    // 2) logos (públicos) — key = logos/<orgId>/logo.<ext>; atualiza logo_url
    const orgs = (await c.query("select id, logo_url from organizations where logo_url is not null and logo_url <> ''")).rows;
    console.log(`logos: ${orgs.length}`);
    for (const o of orgs) {
        try {
            // extrai o path relativo ao bucket org-logos da URL antiga do Supabase
            const m = o.logo_url.match(/org-logos\/([^?]+)/);
            if (!m) { console.error('  pulei (url inesperada)', o.id); continue; }
            const supaPath = decodeURIComponent(m[1]); // <orgId>/logo.png
            const ext = supaPath.split('.').pop().toLowerCase();
            const { buf, contentType } = await downloadFromSupabase('org-logos', supaPath);
            const key = `logos/${o.id}/logo.${ext}`;
            await upload(key, buf, contentType, true);
            const newUrl = `${publicUrl(key)}?t=${Date.now()}`;
            await c.query('update organizations set logo_url=$1 where id=$2', [newUrl, o.id]);
            console.log('  ok', o.id, '->', key);
        } catch (e) { console.error('  ERRO logo', o.id, e.message); }
    }

    await c.end();
    console.log('Concluído.');
})().catch(e => { console.error('FALHA:', e.message); process.exit(1); });
