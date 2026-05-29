import type { NextAuthConfig } from 'next-auth';

// Config edge-safe (sem DB/bcrypt) — usada pelo middleware.
export const authConfig = {
    pages: {
        signIn: '/login',
    },
    session: { strategy: 'jwt' },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
            if (isOnDashboard) {
                return isLoggedIn; // redireciona p/ login se não autenticado
            }
            if (isLoggedIn && nextUrl.pathname === '/login') {
                return Response.redirect(new URL('/dashboard', nextUrl));
            }
            return true;
        },
        jwt({ token, user }) {
            if (user) {
                token.id = user.id as string;
                token.role = (user as any).role;
                token.organizationId = (user as any).organizationId;
                token.fullName = (user as any).fullName;
            }
            return token;
        },
        session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                session.user.role = token.role as string;
                session.user.organizationId = token.organizationId as string | null;
                session.user.fullName = token.fullName as string | null;
            }
            return session;
        },
    },
    providers: [], // preenchido em auth.ts (Node)
} satisfies NextAuthConfig;
