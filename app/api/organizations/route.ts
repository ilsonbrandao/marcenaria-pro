import { NextResponse } from 'next/server';
import { eq, asc, count } from 'drizzle-orm';
import { db } from '@/lib/db';
import { organizations, profiles } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';
import { snakeKeys, snakeRows } from '@/lib/case';

function mapFields(b: any) {
    const m: Record<string, string> = {
        name: 'name', cnpj: 'cnpj', phone: 'phone', email: 'email', address: 'address',
        city: 'city', state: 'state', company_name: 'companyName', state_registration: 'stateRegistration',
        owner_name: 'ownerName', owner_cpf: 'ownerCpf', owner_phone: 'ownerPhone',
        plan: 'plan', is_active: 'isActive', budget_validity_days: 'budgetValidityDays',
    };
    const out: Record<string, any> = {};
    for (const k of Object.keys(m)) if (b[k] !== undefined) out[m[k]] = b[k];
    return out;
}

export async function GET(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

        const id = new URL(req.url).searchParams.get('id');
        if (id) {
            if (caller.role !== 'sysadmin' && caller.organizationId !== id) {
                return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
            }
            const [org] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
            return NextResponse.json(org ? snakeKeys(org) : null);
        }

        const rows = caller.role === 'sysadmin'
            ? await db.select().from(organizations).orderBy(asc(organizations.name))
            : await db.select().from(organizations).where(eq(organizations.id, caller.organizationId!));

        const counts = await db
            .select({ orgId: profiles.organizationId, value: count() })
            .from(profiles)
            .groupBy(profiles.organizationId);
        const countMap = new Map(counts.map((c) => [c.orgId, c.value]));

        return NextResponse.json(snakeRows(rows).map((o) => ({ ...o, member_count: countMap.get(o.id) ?? 0 })));
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller || caller.role !== 'sysadmin') {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }
        const b = await req.json();
        if (!b.name?.trim()) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });

        const [data] = await db.insert(organizations).values(mapFields(b) as any).returning({ id: organizations.id });
        return NextResponse.json({ id: data.id }, { status: 201 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
        const b = await req.json();
        if (!b.id) return NextResponse.json({ error: 'ID é obrigatório.' }, { status: 400 });

        if (caller.role !== 'sysadmin') {
            if (!['owner', 'office'].includes(caller.role) || caller.organizationId !== b.id) {
                return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
            }
        }
        await db.update(organizations).set(mapFields(b)).where(eq(organizations.id, b.id));
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller || caller.role !== 'sysadmin') {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }
        const id = new URL(req.url).searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID não fornecido.' }, { status: 400 });

        await db.delete(organizations).where(eq(organizations.id, id));
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
