import type { NextAuthConfig } from 'next-auth';

// Config edge-safe (sem DB/bcrypt) — usada pelo middleware.
// Páginas que exigem mais que "estar logado". A autorização definitiva continua
// em cada route handler; isto evita que um perfil sem permissão sequer abra a tela.
const ROLE_GATED_PREFIXES: Array<{ prefix: string; roles: readonly string[] }> = [
    { prefix: '/dashboard/admin', roles: ['sysadmin'] },
    { prefix: '/dashboard/organizations', roles: ['sysadmin'] },
    { prefix: '/dashboard/users', roles: ['sysadmin', 'owner', 'office'] },
    { prefix: '/dashboard/settings', roles: ['sysadmin', 'owner', 'office'] },
    { prefix: '/dashboard/audit', roles: ['sysadmin', 'owner', 'office'] },
    { prefix: '/dashboard/bi', roles: ['sysadmin', 'owner', 'office'] },
    { prefix: '/dashboard/reports', roles: ['sysadmin', 'owner', 'office'] },
    { prefix: '/dashboard/finance', roles: ['sysadmin', 'owner', 'office'] },
    { prefix: '/dashboard/price-table', roles: ['sysadmin', 'owner', 'office'] },
];
// `/dashboard/commissions` fica de fora de propósito: todos os perfis (inclusive
// `carpenter`) veem as próprias comissões na sidebar.

export const authConfig = {
    pages: {
        signIn: '/login',
    },
    session: {
        strategy: 'jwt',
        maxAge: 60 * 60 * 8,   // 8h — era o default de 30 dias
        updateAge: 60 * 60,
    },
    // Sem HTTPS o cookie não pode ser `Secure`; ativar junto com o TLS.
    useSecureCookies: process.env.NODE_ENV === 'production' && !!process.env.AUTH_URL?.startsWith('https://'),
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
            if (isOnDashboard) {
                if (!isLoggedIn) return false; // redireciona p/ login

                const role = (auth!.user as any)?.role as string | undefined;
                const gate = ROLE_GATED_PREFIXES.find((g) => nextUrl.pathname.startsWith(g.prefix));
                if (gate && (!role || !gate.roles.includes(role))) {
                    return Response.redirect(new URL('/dashboard', nextUrl));
                }
                return true;
            }
            if (isLoggedIn && nextUrl.pathname === '/login') {
                return Response.redirect(new URL('/dashboard', nextUrl));
            }
            return true;
        },
        // Roda também no middleware (edge): nada de acesso ao banco aqui.
        // A validação de `tokenVersion` e o role fresco ficam em `getCaller()`.
        jwt({ token, user }) {
            if (user) {
                token.id = user.id as string;
                token.role = (user as any).role;
                token.organizationId = (user as any).organizationId;
                token.fullName = (user as any).fullName;
                token.tokenVersion = (user as any).tokenVersion ?? 0;
            }
            return token;
        },
        session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                session.user.role = token.role as string;
                session.user.organizationId = token.organizationId as string | null;
                session.user.fullName = token.fullName as string | null;
                (session.user as any).tokenVersion = (token.tokenVersion as number) ?? 0;
            }
            return session;
        },
    },
    providers: [], // preenchido em auth.ts (Node)
} satisfies NextAuthConfig;
