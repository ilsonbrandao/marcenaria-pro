import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { and, eq, asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { kanbanStages } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';
import { snakeRows } from '@/lib/case';

const MANAGER = ['sysadmin', 'owner', 'office'];

export async function GET() {
    try {
        const caller = await getCaller();
        if (!caller) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

        const rows = caller.role === 'sysadmin'
            ? await db.select().from(kanbanStages).orderBy(asc(kanbanStages.position))
            : await db.select().from(kanbanStages).where(eq(kanbanStages.organizationId, caller.organizationId!)).orderBy(asc(kanbanStages.position));
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

        const [data] = await db.insert(kanbanStages).values({
            organizationId: caller.organizationId!,
            kanbanType: b.kanban_type,
            name: b.name.trim(),
            color: b.color || '#6366f1',
            position: b.position ?? 0,
            isFinal: !!b.is_final,
        }).returning({ id: kanbanStages.id });
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

        const updates: Record<string, any> = {};
        if (b.name !== undefined) updates.name = b.name;
        if (b.color !== undefined) updates.color = b.color;
        if (b.is_final !== undefined) updates.isFinal = b.is_final;
        if (b.position !== undefined) updates.position = b.position;

        const cond = caller.role === 'sysadmin'
            ? eq(kanbanStages.id, b.id)
            : and(eq(kanbanStages.id, b.id), eq(kanbanStages.organizationId, caller.organizationId!));
        await db.update(kanbanStages).set(updates).where(cond);
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return apiError(e);
    }
}

// Reordenação em lote: body { order: [{ id, position }] }
export async function PATCH(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller || !MANAGER.includes(caller.role)) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        const { order } = await req.json();
        if (!Array.isArray(order)) return NextResponse.json({ error: 'order inválido.' }, { status: 400 });

        for (const { id, position } of order) {
            const cond = caller.role === 'sysadmin'
                ? eq(kanbanStages.id, id)
                : and(eq(kanbanStages.id, id), eq(kanbanStages.organizationId, caller.organizationId!));
            await db.update(kanbanStages).set({ position }).where(cond);
        }
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
            ? eq(kanbanStages.id, id)
            : and(eq(kanbanStages.id, id), eq(kanbanStages.organizationId, caller.organizationId!));
        await db.delete(kanbanStages).where(cond);
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return apiError(e);
    }
}
