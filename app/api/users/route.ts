import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { and, eq, asc, sql } from 'drizzle-orm';
import { hashPassword } from '@/lib/password';
import { db } from '@/lib/db';
import { profiles, users, organizations } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';

const MANAGER_ROLES = ['sysadmin', 'owner', 'office'];

export async function GET() {
    try {
        const caller = await getCaller();
        if (!caller || !MANAGER_ROLES.includes(caller.role)) {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }

        const rows = await db
            .select({
                id: profiles.id,
                full_name: profiles.fullName,
                role: profiles.role,
                organization_id: profiles.organizationId,
                address: profiles.address,
                city: profiles.city,
                state: profiles.state,
                cpf: profiles.cpf,
                phone: profiles.phone,
                notes: profiles.notes,
                is_active: profiles.isActive,
                org_name: organizations.name,
                email: users.email,
            })
            .from(profiles)
            .leftJoin(organizations, eq(organizations.id, profiles.organizationId))
            .leftJoin(users, eq(users.id, profiles.id))
            .where(caller.role === 'sysadmin' ? undefined : eq(profiles.organizationId, caller.organizationId!))
            .orderBy(asc(profiles.fullName));

        const data = rows.map(({ org_name, ...p }) => ({ ...p, organizations: { name: org_name } }));
        return NextResponse.json(data);
    } catch (error: any) {
        return apiError(error);
    }
}

export async function POST(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller || !MANAGER_ROLES.includes(caller.role)) {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }

        const { email, password, full_name, role, organization_id,
            address, city, state, cpf, phone, notes, is_active } = await req.json();

        if (!email || !password || !full_name || !role) {
            return NextResponse.json({ error: 'Preencha todos os campos obrigatórios.' }, { status: 400 });
        }

        let targetOrgId = organization_id;
        if (caller.role !== 'sysadmin') {
            if (role === 'sysadmin') {
                return NextResponse.json({ error: 'Somente Super Admins podem criar Super Admins.' }, { status: 403 });
            }
            targetOrgId = caller.organizationId;
        }

        const normalizedEmail = String(email).trim().toLowerCase();
        const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, normalizedEmail)).limit(1);
        if (existing) {
            return NextResponse.json({ error: 'Este e-mail já está cadastrado.' }, { status: 400 });
        }

        const passwordHash = await hashPassword(password);
        const [newUser] = await db.insert(users).values({
            email: normalizedEmail,
            passwordHash,
            emailVerified: new Date().toISOString(),
        }).returning({ id: users.id });

        try {
            await db.insert(profiles).values({
                id: newUser.id,
                organizationId: targetOrgId || null,
                role,
                fullName: full_name,
                address: address || null,
                city: city || null,
                state: state || null,
                cpf: cpf || null,
                phone: phone || null,
                notes: notes || null,
                isActive: is_active !== undefined ? is_active : true,
            });
        } catch (e) {
            await db.delete(users).where(eq(users.id, newUser.id));
            throw e;
        }

        return NextResponse.json({ message: 'Usuário criado com sucesso', id: newUser.id }, { status: 201 });
    } catch (error: any) {
        return apiError(error);
    }
}

export async function PUT(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller || !MANAGER_ROLES.includes(caller.role)) {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }

        const { id, full_name, role, organization_id, password,
            address, city, state, cpf, phone, notes, is_active } = await req.json();

        if (!id) return NextResponse.json({ error: 'ID do usuário é obrigatório.' }, { status: 400 });

        if (caller.role !== 'sysadmin') {
            if (role === 'sysadmin') return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
            const [target] = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
            if (!target) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
            if (target.role === 'sysadmin') return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
            if (target.organizationId !== caller.organizationId) {
                return NextResponse.json({ error: 'Você não tem permissão para editar este usuário.' }, { status: 403 });
            }
        }

        const updateData: Record<string, any> = {
            fullName: full_name,
            role,
            address: address !== undefined ? address : null,
            city: city !== undefined ? city : null,
            state: state !== undefined ? state : null,
            cpf: cpf !== undefined ? cpf : null,
            phone: phone !== undefined ? phone : null,
            notes: notes !== undefined ? notes : null,
            isActive: is_active !== undefined ? is_active : true,
        };
        if (caller.role === 'sysadmin' && organization_id !== undefined) {
            updateData.organizationId = organization_id || null;
        }

        await db.update(profiles).set(updateData).where(eq(profiles.id, id));

        if (password && password.trim() !== '') {
            const passwordHash = await hashPassword(password);
            await db.update(users).set({ passwordHash }).where(eq(users.id, id));
            // Senha redefinida por um admin: derruba as sessões abertas do usuário.
            await db.update(profiles)
                .set({ tokenVersion: sql`${profiles.tokenVersion} + 1` })
                .where(eq(profiles.id, id));
        }

        return NextResponse.json({ message: 'Usuário atualizado com sucesso' });
    } catch (error: any) {
        return apiError(error);
    }
}

export async function DELETE(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller || !MANAGER_ROLES.includes(caller.role)) {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }

        const url = new URL(req.url);
        const id = url.searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID não fornecido.' }, { status: 400 });
        if (id === caller.id) return NextResponse.json({ error: 'Você não pode excluir a si mesmo.' }, { status: 400 });

        if (caller.role !== 'sysadmin') {
            const [target] = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
            if (!target) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
            if (target.role === 'sysadmin') return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
            if (target.organizationId !== caller.organizationId) {
                return NextResponse.json({ error: 'Você não tem permissão para excluir este usuário.' }, { status: 403 });
            }
        }

        // CASCADE em profiles.id -> users.id remove o perfil junto.
        await db.delete(users).where(eq(users.id, id));
        return NextResponse.json({ message: 'Usuário removido com sucesso' });
    } catch (error: any) {
        return apiError(error);
    }
}
