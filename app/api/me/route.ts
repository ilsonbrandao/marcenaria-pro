import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { profiles, users } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';

// Perfil completo do usuário logado (consumido pelo RBACProvider no client).
// Usa `getCaller()` (e não `auth()`) para que uma sessão revogada — troca de
// senha, usuário desativado — seja rejeitada aqui também.
export async function GET() {
    const caller = await getCaller();
    if (!caller) {
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
        .where(eq(profiles.id, caller.id))
        .limit(1);

    if (!profile) {
        return NextResponse.json({
            id: caller.id,
            organization_id: caller.organizationId,
            role: caller.role,
            full_name: caller.fullName,
        });
    }

    return NextResponse.json(profile);
}

export async function PATCH(req: Request) {
    const caller = await getCaller();
    if (!caller) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const body = await req.json();
    const updates: Record<string, unknown> = {};
    if (body.full_name !== undefined) updates.fullName = body.full_name;
    if (body.avatar_url !== undefined) updates.avatarUrl = body.avatar_url;
    if (body.color_theme !== undefined) updates.colorTheme = body.color_theme;
    if (body.phone !== undefined) updates.phone = body.phone;
    if (body.address !== undefined) updates.address = body.address;
    if (body.city !== undefined) updates.city = body.city;
    if (body.state !== undefined) updates.state = body.state;
    if (body.cpf !== undefined) updates.cpf = body.cpf;

    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 });
    }

    await db.update(profiles).set(updates).where(eq(profiles.id, caller.id));
    return NextResponse.json({ ok: true });
}
