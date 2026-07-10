import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { eq, count } from 'drizzle-orm';
import { db } from '@/lib/db';
import { budgetEnvironments } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';
import { ownsBudget } from '@/lib/authz';
import { snakeKeys } from '@/lib/case';

export async function POST(req: Request, { params }: { params: { budgetId: string } }) {
    try {
        const caller = await getCaller();
        if (!caller || caller.role === 'carpenter') {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }

        const { name } = await req.json();
        if (!name?.trim()) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });

        if (!(await ownsBudget(caller, params.budgetId))) {
            return NextResponse.json({ error: 'Orçamento não encontrado.' }, { status: 404 });
        }

        const [{ value: position }] = await db.select({ value: count() })
            .from(budgetEnvironments).where(eq(budgetEnvironments.budgetId, params.budgetId));

        const [data] = await db.insert(budgetEnvironments).values({
            budgetId: params.budgetId,
            name: name.trim(),
            position: position ?? 0,
        }).returning();

        return NextResponse.json({ ...snakeKeys(data), items: [] }, { status: 201 });
    } catch (e: any) {
        return apiError(e);
    }
}
