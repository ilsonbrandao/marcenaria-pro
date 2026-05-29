import { NextResponse } from 'next/server';
import { and, eq, asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { suppliers } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';
import { snakeRows } from '@/lib/case';

function mapFields(b: any) {
    const out: Record<string, any> = {};
    if (b.name !== undefined) out.name = b.name;
    if (b.cnpj_cpf !== undefined) out.cnpjCpf = b.cnpj_cpf;
    if (b.phone !== undefined) out.phone = b.phone;
    if (b.email !== undefined) out.email = b.email;
    if (b.address !== undefined) out.address = b.address;
    if (b.contact_name !== undefined) out.contactName = b.contact_name;
    if (b.notes !== undefined) out.notes = b.notes;
    if (b.is_active !== undefined) out.isActive = b.is_active;
    return out;
}

export async function GET() {
    try {
        const caller = await getCaller();
        if (!caller) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

        const rows = caller.role === 'sysadmin'
            ? await db.select().from(suppliers).orderBy(asc(suppliers.name))
            : await db.select().from(suppliers)
                .where(eq(suppliers.organizationId, caller.organizationId!))
                .orderBy(asc(suppliers.name));

        return NextResponse.json(snakeRows(rows));
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller || !['sysadmin', 'owner', 'office'].includes(caller.role)) {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }
        const b = await req.json();
        if (!b.name?.trim()) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });

        const [data] = await db.insert(suppliers).values({
            ...mapFields(b),
            organizationId: caller.organizationId!,
        } as any).returning({ id: suppliers.id });
        return NextResponse.json({ id: data.id }, { status: 201 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller || !['sysadmin', 'owner', 'office'].includes(caller.role)) {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }
        const b = await req.json();
        if (!b.id) return NextResponse.json({ error: 'ID é obrigatório.' }, { status: 400 });

        const cond = caller.role === 'sysadmin'
            ? eq(suppliers.id, b.id)
            : and(eq(suppliers.id, b.id), eq(suppliers.organizationId, caller.organizationId!));
        await db.update(suppliers).set(mapFields(b)).where(cond);
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
