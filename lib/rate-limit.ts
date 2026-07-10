// Rate limit em memória, por processo.
//
// Serve para a topologia atual do Fresa: um único container no Coolify. Se um dia
// houver mais de uma instância, cada uma terá seu próprio contador e o limite
// efetivo será N vezes maior — nesse dia, trocar por um store compartilhado (Redis).

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Evita crescimento sem limite da Map em processos longos.
const MAX_KEYS = 10_000;

function sweep(now: number) {
    if (buckets.size < MAX_KEYS) return;
    Array.from(buckets.entries()).forEach(([key, b]) => {
        if (b.resetAt <= now) buckets.delete(key);
    });
}

export interface RateLimitResult {
    ok: boolean;
    remaining: number;
    retryAfterSeconds: number;
}

/**
 * Consome uma unidade da cota de `key`. Janela fixa.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    sweep(now);

    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
    }

    bucket.count += 1;
    if (bucket.count > limit) {
        return { ok: false, remaining: 0, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
    }
    return { ok: true, remaining: limit - bucket.count, retryAfterSeconds: 0 };
}

// Zera a cota após uma ação bem-sucedida (ex.: login válido).
export function rateLimitReset(key: string) {
    buckets.delete(key);
}

// O Coolify/Traefik põe o IP real em x-forwarded-for. Sem proxy confiável isso é
// falsificável, então serve para limitar abuso casual, não um atacante determinado
// — por isso as chaves de login combinam IP **e** e-mail.
export function clientIp(req: Request): string {
    const fwd = req.headers.get('x-forwarded-for');
    if (fwd) return fwd.split(',')[0].trim();
    return req.headers.get('x-real-ip') ?? 'unknown';
}

export function tooManyRequests(retryAfterSeconds: number) {
    return Response.json(
        { error: 'Muitas tentativas. Tente novamente em instantes.' },
        { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
    );
}
