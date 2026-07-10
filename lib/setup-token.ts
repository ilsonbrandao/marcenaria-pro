import crypto from 'crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { passwordSetupTokens } from '@/lib/db/schema';

const TOKEN_TTL_HOURS = 48;

// O token vai por e-mail/link; o banco guarda só o SHA-256 dele. Vazou o banco,
// os links continuam inúteis.
function hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
}

export async function createSetupToken(userId: string): Promise<string> {
    // Invalida tokens anteriores do mesmo usuário: só o último link vale.
    await db.delete(passwordSetupTokens).where(eq(passwordSetupTokens.userId, userId));

    const raw = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 3600 * 1000).toISOString();

    await db.insert(passwordSetupTokens).values({
        userId,
        tokenHash: hashToken(raw),
        expiresAt,
    });

    return raw;
}

// Consome o token e devolve o userId, ou null se inválido/expirado/já usado.
export async function consumeSetupToken(raw: string): Promise<string | null> {
    if (!raw) return null;

    const now = new Date().toISOString();
    const [row] = await db.select({ id: passwordSetupTokens.id, userId: passwordSetupTokens.userId })
        .from(passwordSetupTokens)
        .where(and(
            eq(passwordSetupTokens.tokenHash, hashToken(raw)),
            isNull(passwordSetupTokens.usedAt),
            gt(passwordSetupTokens.expiresAt, now),
        ))
        .limit(1);

    if (!row) return null;

    // Marca como usado condicionando a `used_at is null`: duas requisições
    // simultâneas com o mesmo token, só uma vence.
    const claimed = await db.update(passwordSetupTokens)
        .set({ usedAt: now })
        .where(and(eq(passwordSetupTokens.id, row.id), isNull(passwordSetupTokens.usedAt)))
        .returning({ id: passwordSetupTokens.id });

    return claimed.length > 0 ? row.userId : null;
}

export function setupLink(appUrl: string, rawToken: string): string {
    return `${appUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
}

export const SETUP_TOKEN_TTL_HOURS = TOKEN_TTL_HOURS;
