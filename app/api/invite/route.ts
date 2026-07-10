import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { profiles, users } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';
import { createSetupToken, setupLink, SETUP_TOKEN_TTL_HOURS } from '@/lib/setup-token';

const ALLOWED_ROLES = ['owner', 'office', 'seller', 'carpenter'] as const;

// Ninguém convida acima do próprio nível, e `sysadmin` nunca é concedido aqui.
const GRANTABLE: Record<string, readonly string[]> = {
    sysadmin: ALLOWED_ROLES,
    owner: ['office', 'seller', 'carpenter'],
    office: ['seller', 'carpenter'],
};

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Sem SMTP no ambiente: criamos o usuário SEM senha e devolvemos um link de uso
// único para ele definir a própria senha. Nenhuma senha trafega ou é logada.
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

        if (!GRANTABLE[caller.role]?.includes(role)) {
            return NextResponse.json({ error: 'Perfil inválido para o seu nível.' }, { status: 403 });
        }

        const normalizedEmail = String(email).trim().toLowerCase();
        const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, normalizedEmail)).limit(1);
        if (existing) {
            return NextResponse.json({ error: 'Este e-mail já está cadastrado.' }, { status: 400 });
        }

        // `passwordHash` nulo: a conta não loga até o link ser usado.
        const [newUser] = await db.insert(users).values({
            email: normalizedEmail,
            passwordHash: null,
            emailVerified: null,
        }).returning({ id: users.id });

        await db.insert(profiles).values({
            id: newUser.id,
            organizationId: caller.organizationId,
            role,
            fullName: fullName || normalizedEmail.split('@')[0],
        });

        const rawToken = await createSetupToken(newUser.id);

        return NextResponse.json({
            success: true,
            message: `Usuário criado. Envie o link abaixo — ele vale ${SETUP_TOKEN_TTL_HOURS}h e só pode ser usado uma vez.`,
            setup_url: setupLink(appUrl, rawToken),
            expires_in_hours: SETUP_TOKEN_TTL_HOURS,
        });
    } catch (error: any) {
        return apiError(error);
    }
}
