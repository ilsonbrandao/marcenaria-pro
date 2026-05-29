import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { profiles, users } from '@/lib/db/schema';

// Perfil completo do usuário logado (consumido pelo RBACProvider no client).
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const [profile] = await db
        .select({
            id: profiles.id,
            organization_id: profiles.organizationId,
            role: profiles.role,
            full_name: profiles.fullName,
            avatar_url: profiles.avatarUrl,
            color_theme: profiles.colorTheme,
            address: profiles.address,
            city: profiles.city,
            state: profiles.state,
            cpf: profiles.cpf,
            phone: profiles.phone,
            notes: profiles.notes,
            is_active: profiles.isActive,
            email: users.email,
        })
        .from(profiles)
        .leftJoin(users, eq(users.id, profiles.id))
        .where(eq(profiles.id, session.user.id))
        .limit(1);

    if (!profile) {
        return NextResponse.json({
            id: session.user.id,
            organization_id: session.user.organizationId,
            role: session.user.role,
            full_name: session.user.fullName,
        });
    }

    return NextResponse.json(profile);
}

export async function PATCH(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const body = await req.json();
    const updates: Record<string, unknown> = {};
    if (body.full_name !== undefined) updates.fullName = body.full_name;
    if (body.avatar_url !== undefined) updates.avatarUrl = body.avatar_url;
    if (body.color_theme !== undefined) updates.colorTheme = body.color_theme;
    if (body.phone !== undefined) updates.phone = body.phone;

    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 });
    }

    await db.update(profiles).set(updates).where(eq(profiles.id, session.user.id));
    return NextResponse.json({ ok: true });
}
