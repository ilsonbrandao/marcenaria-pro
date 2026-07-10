import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { and, eq, asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';
import { scopedTo } from '@/lib/authz';
import { snakeRows } from '@/lib/case';

const MANAGER = ['sysadmin', 'owner', 'office', 'seller'];

function mapFields(b: any) {
    const out: Record<string, any> = {};
    for (const k of ['name', 'cpf', 'phone', 'email', 'address', 'notes']) {
        if (b[k] !== undefined) out[k] = b[k];
    }
    return out;
}

// Teto de linhas por resposta. Mantém o formato de array (o front espera isso),
// mas impede que uma organização grande devolva a tabela inteira de uma vez.
const MAX_LIMIT = 500;

export async function GET(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller || caller.role === 'carpenter') return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

        const url = new URL(req.url);
        const limit = Math.min(Number(url.searchParams.get('limit')) || MAX_LIMIT, MAX_LIMIT);
        const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);

        const rows = await db.select().from(clients)
            .where(scopedTo(caller, clients.organizationId))
            .orderBy(asc(clients.name))
            .limit(limit)
            .offset(offset);
        return NextResponse.json(snakeRows(rows));
    } catch (e: any) {
        return apiError(e);
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
        return apiError(e);
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
        return apiError(e);
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
        return apiError(e);
    }
}
