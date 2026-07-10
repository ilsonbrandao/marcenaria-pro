import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users, profiles } from '@/lib/db/schema';
import { hashPassword, MIN_PASSWORD_LENGTH } from '@/lib/password';
import { consumeSetupToken } from '@/lib/setup-token';
import { rateLimit, clientIp, tooManyRequests } from '@/lib/rate-limit';
import { apiError } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

// Define a senha a partir de um token de convite/redefinição. Público por
// natureza: a autenticação é a posse do token de uso único.
export async function POST(req: Request) {
    try {
        const limit = rateLimit(`setpwd:${clientIp(req)}`, 10, 10 * 60 * 1000);
        if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

        const { token, password } = await req.json();
        if (!password || typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
            return NextResponse.json({ error: `A senha deve ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.` }, { status: 400 });
        }

        const userId = await consumeSetupToken(typeof token === 'string' ? token : '');
        if (!userId) {
            return NextResponse.json({ error: 'Link inválido ou expirado. Peça um novo ao administrador.' }, { status: 400 });
        }

        await db.update(users)
            .set({ passwordHash: await hashPassword(password), emailVerified: new Date().toISOString() })
            .where(eq(users.id, userId));

        // Invalida qualquer sessão anterior desse usuário.
        await db.update(profiles)
            .set({ tokenVersion: sql`${profiles.tokenVersion} + 1` })
            .where(eq(profiles.id, userId));

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        return apiError(error);
    }
}
