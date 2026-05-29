import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { authConfig } from './auth.config';
import { db } from '@/lib/db';
import { users, profiles } from '@/lib/db/schema';

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            credentials: {
                email: { label: 'E-mail', type: 'email' },
                password: { label: 'Senha', type: 'password' },
            },
            async authorize(credentials) {
                const email = (credentials?.email as string)?.trim().toLowerCase();
                const password = credentials?.password as string;
                if (!email || !password) return null;

                const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
                if (!user || !user.passwordHash) return null;

                const ok = await bcrypt.compare(password, user.passwordHash);
                if (!ok) return null;

                const [profile] = await db
                    .select({ role: profiles.role, organizationId: profiles.organizationId, fullName: profiles.fullName })
                    .from(profiles)
                    .where(eq(profiles.id, user.id))
                    .limit(1);

                return {
                    id: user.id,
                    email: user.email,
                    role: profile?.role ?? 'carpenter',
                    organizationId: profile?.organizationId ?? null,
                    fullName: profile?.fullName ?? user.email.split('@')[0],
                };
            },
        }),
    ],
});
