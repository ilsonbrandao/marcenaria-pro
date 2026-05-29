import { NextResponse } from 'next/server';
import { and, eq, asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';
import { snakeRows } from '@/lib/case';

const MANAGER = ['sysadmin', 'owner', 'office', 'seller'];

function mapFields(b: any) {
    const out: Record<string, any> = {};
    for (const k of ['name', 'cpf', 'phone', 'email', 'address', 'notes']) {
        if (b[k] !== undefined) out[k] = b[k];
    }
    return out;
}

export async function GET() {
    try {
        const caller = await getCaller();
        if (!caller || caller.role === 'carpenter') return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

        const rows = caller.role === 'sysadmin'
            ? await db.select().from(clients).orderBy(asc(clients.name))
            : await db.select().from(clients).where(eq(clients.organizationId, caller.organizationId!)).orderBy(asc(clients.name));
        return NextResponse.json(snakeRows(rows));
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller || !MANAGER.includes(caller.role)) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        const b = await req.json();
        if (!b.name?.trim()) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });

        const [data] = await db.insert(clients).values({
            ...mapFields(b), name: b.name.trim(), organizationId: caller.organizationId!,
        } as any).returning({ id: clients.id });
        return NextResponse.json({ id: data.id }, { status: 201 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller || !MANAGER.includes(caller.role)) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        const b = await req.json();
        if (!b.id) return NextResponse.json({ error: 'ID é obrigatório.' }, { status: 400 });

        const cond = caller.role === 'sysadmin'
            ? eq(clients.id, b.id)
            : and(eq(clients.id, b.id), eq(clients.organizationId, caller.organizationId!));
        await db.update(clients).set(mapFields(b)).where(cond);
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller || !MANAGER.includes(caller.role)) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        const id = new URL(req.url).searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID não fornecido.' }, { status: 400 });

        const cond = caller.role === 'sysadmin'
            ? eq(clients.id, id)
            : and(eq(clients.id, id), eq(clients.organizationId, caller.organizationId!));
        await db.delete(clients).where(cond);
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
