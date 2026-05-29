import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { password } = await req.json();
    if (!password || typeof password !== 'string' || password.length < 6) {
        return NextResponse.json({ error: 'A senha deve ter ao menos 6 caracteres.' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await db.update(users).set({ passwordHash }).where(eq(users.id, session.user.id));
    return NextResponse.json({ ok: true });
}
