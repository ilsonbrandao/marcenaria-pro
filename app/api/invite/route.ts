import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { profiles, users } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';

// Sem SMTP no ambiente: em vez de enviar convite por e-mail, criamos o usuário
// com uma senha temporária aleatória e a retornamos para o admin repassar.
export async function POST(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }
        if (!['sysadmin', 'owner', 'office'].includes(caller.role)) {
            return NextResponse.json({ error: 'Apenas administradores podem convidar usuários.' }, { status: 403 });
        }

        const { email, fullName, role } = await req.json();
        if (!email || !role) {
            return NextResponse.json({ error: 'E-mail e Perfil são obrigatórios' }, { status: 400 });
        }

        const normalizedEmail = String(email).trim().toLowerCase();
        const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, normalizedEmail)).limit(1);
        if (existing) {
            return NextResponse.json({ error: 'Este e-mail já está cadastrado.' }, { status: 400 });
        }

        const tempPassword = crypto.randomBytes(6).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
        const passwordHash = await bcrypt.hash(tempPassword, 10);

        const [newUser] = await db.insert(users).values({
            email: normalizedEmail,
            passwordHash,
            emailVerified: new Date().toISOString(),
        }).returning({ id: users.id });

        await db.insert(profiles).values({
            id: newUser.id,
            organizationId: caller.organizationId,
            role,
            fullName: fullName || normalizedEmail.split('@')[0],
        });

        return NextResponse.json({
            success: true,
            message: 'Usuário criado. Repasse a senha temporária ao novo usuário.',
            temp_password: tempPassword,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
    }
}
