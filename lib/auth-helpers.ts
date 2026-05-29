import { auth } from '@/auth';

export interface Caller {
    id: string;
    email: string | null;
    role: string;
    organizationId: string | null;
    fullName: string | null;
}

// Identifica o usuário chamador via sessão (cookie). Substitui o antigo
// getCallerProfile baseado em Bearer token do Supabase.
export async function getCaller(): Promise<Caller | null> {
    const session = await auth();
    if (!session?.user?.id) return null;
    return {
        id: session.user.id,
        email: session.user.email ?? null,
        role: session.user.role,
        organizationId: session.user.organizationId,
        fullName: session.user.fullName,
    };
}
