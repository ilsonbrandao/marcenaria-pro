import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { profiles } from '@/lib/db/schema';

export interface Caller {
    id: string;
    email: string | null;
    role: string;
    organizationId: string | null;
    fullName: string | null;
}

// Identifica o usuário chamador via sessão (cookie).
//
// O JWT é stateless, então não confiamos no `role`/`organizationId` que ele carrega:
// relemos do banco a cada chamada. Isso resolve dois problemas de uma vez —
//  1. um usuário rebaixado deixaria de sê-lo só quando o token expirasse;
//  2. um token roubado continuaria válido mesmo após a vítima trocar a senha.
// O `tokenVersion` é incrementado na troca de senha; se não bater, a sessão morreu.
//
// Não dá para fazer isso no callback `jwt`: ele também roda no middleware (edge),
// onde não há acesso ao banco.
export async function getCaller(): Promise<Caller | null> {
    const session = await auth();
    if (!session?.user?.id) return null;

    const [profile] = await db
        .select({
            role: profiles.role,
            organizationId: profiles.organizationId,
            fullName: profiles.fullName,
            tokenVersion: profiles.tokenVersion,
            isActive: profiles.isActive,
        })
        .from(profiles)
        .where(eq(profiles.id, session.user.id))
        .limit(1);

    if (!profile) return null;
    if (profile.isActive === false) return null;

    const tokenVersion = (session.user as any).tokenVersion ?? 0;
    if (profile.tokenVersion !== tokenVersion) return null;

    return {
        id: session.user.id,
        email: session.user.email ?? null,
        role: profile.role,
        organizationId: profile.organizationId,
        fullName: profile.fullName,
    };
}
