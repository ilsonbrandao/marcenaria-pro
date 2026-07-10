import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { authConfig } from './auth.config';
import { db } from '@/lib/db';
import { users, profiles } from '@/lib/db/schema';
import { DUMMY_HASH, hashPassword, needsRehash, withLoginFloor } from '@/lib/password';
import { rateLimit, rateLimitReset, clientIp } from '@/lib/rate-limit';

const LOGIN_MAX_ATTEMPTS = 8;
const LOGIN_WINDOW_MS = 10 * 60 * 1000; // 10 min

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            credentials: {
                email: { label: 'E-mail', type: 'email' },
                password: { label: 'Senha', type: 'password' },
            },
            authorize(credentials, request) {
                return withLoginFloor(async () => {
                    const email = (credentials?.email as string)?.trim().toLowerCase();
                    const password = credentials?.password as string;
                    if (!email || !password) return null;

                    // Limita por IP+e-mail (trava o alvo) e por IP (trava a varredura).
                    const ip = clientIp(request as Request);
                    const perTarget = rateLimit(`login:${ip}:${email}`, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS);
                    const perIp = rateLimit(`login:${ip}`, LOGIN_MAX_ATTEMPTS * 4, LOGIN_WINDOW_MS);
                    if (!perTarget.ok || !perIp.ok) return null;

                    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

                    // Compara contra um hash descartável quando o e-mail não existe,
                    // para que o caminho de código não encurte quando não há usuário.
                    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
                    if (!user || !user.passwordHash || !ok) return null;

                    // Promove hashes legados (cost < 12) agora que temos a senha em claro.
                    if (needsRehash(user.passwordHash)) {
                        await db.update(users)
                            .set({ passwordHash: await hashPassword(password) })
                            .where(eq(users.id, user.id));
                    }

                    const [profile] = await db
                        .select({
                            role: profiles.role,
                            organizationId: profiles.organizationId,
                            fullName: profiles.fullName,
                            tokenVersion: profiles.tokenVersion,
                        })
                        .from(profiles)
                        .where(eq(profiles.id, user.id))
                        .limit(1);

                    rateLimitReset(`login:${ip}:${email}`);

                    return {
                        id: user.id,
                        email: user.email,
                        role: profile?.role ?? 'carpenter',
                        organizationId: profile?.organizationId ?? null,
                        fullName: profile?.fullName ?? user.email.split('@')[0],
                        tokenVersion: profile?.tokenVersion ?? 0,
                    };
                });
            },
        }),
    ],
});
