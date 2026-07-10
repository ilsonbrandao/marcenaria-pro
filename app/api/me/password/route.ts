import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users, profiles } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';
import { hashPassword, MIN_PASSWORD_LENGTH } from '@/lib/password';
import { rateLimit, clientIp, tooManyRequests } from '@/lib/rate-limit';

export async function POST(req: Request) {
    const caller = await getCaller();
    if (!caller) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const limit = rateLimit(`pwd:${clientIp(req)}:${caller.id}`, 5, 10 * 60 * 1000);
    if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

    const { currentPassword, password } = await req.json();
    if (!password || typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
        return NextResponse.json({ error: `A senha deve ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.` }, { status: 400 });
    }
    if (!currentPassword || typeof currentPassword !== 'string') {
        return NextResponse.json({ error: 'Informe a senha atual.' }, { status: 400 });
    }

    // Reautenticação: uma sessão roubada não deve conseguir trocar a senha.
    const [user] = await db.select({ passwordHash: users.passwordHash })
        .from(users).where(eq(users.id, caller.id)).limit(1);
    if (!user?.passwordHash || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
        return NextResponse.json({ error: 'Senha atual incorreta.' }, { status: 403 });
    }

    const passwordHash = await hashPassword(password);
    await db.update(users).set({ passwordHash }).where(eq(users.id, caller.id));

    // Derruba todas as sessões emitidas antes desta troca — inclusive a atual.
    await db.update(profiles)
        .set({ tokenVersion: sql`${profiles.tokenVersion} + 1` })
        .where(eq(profiles.id, caller.id));

    return NextResponse.json({ ok: true, reauth: true });
}
