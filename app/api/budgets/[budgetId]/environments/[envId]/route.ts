import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { budgetEnvironments } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';
import { snakeKeys } from '@/lib/case';

export async function PUT(req: Request, { params }: { params: { budgetId: string; envId: string } }) {
    try {
        const caller = await getCaller();
        if (!caller || caller.role === 'carpenter') {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }

        const body = await req.json();
        const updates: Record<string, any> = {};
        if (body.name !== undefined) updates.name = body.name;
        if (body.position !== undefined) updates.position = body.position;

        const [data] = await db.update(budgetEnvironments).set(updates)
            .where(and(eq(budgetEnvironments.id, params.envId), eq(budgetEnvironments.budgetId, params.budgetId)))
            .returning();

        return NextResponse.json(snakeKeys(data));
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: { budgetId: string; envId: string } }) {
    try {
        const caller = await getCaller();
        if (!caller || caller.role === 'carpenter') {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }

        await db.delete(budgetEnvironments)
            .where(and(eq(budgetEnvironments.id, params.envId), eq(budgetEnvironments.budgetId, params.budgetId)));

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
