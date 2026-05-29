import { NextResponse } from 'next/server';
import { and, eq, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { budgets, sales } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
    try {
        const caller = await getCaller();
        if (!caller || caller.role === 'carpenter') return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        const orgScope = caller.role !== 'sysadmin';

        const budgetRows = await db
            .select({
                id: budgets.id, budget_number: budgets.budgetNumber, created_at: budgets.createdAt,
                status: budgets.status, total_prazo: budgets.totalPrazo, total_avista: budgets.totalAvista,
            })
            .from(budgets)
            .where(orgScope
                ? and(eq(budgets.clientId, params.clientId), eq(budgets.organizationId, caller.organizationId!))
                : eq(budgets.clientId, params.clientId))
            .orderBy(desc(budgets.createdAt));

        const saleRows = await db
            .select({ id: sales.id, created_at: sales.createdAt, status: sales.status, total_value: sales.totalValue })
            .from(sales)
            .where(orgScope
                ? and(eq(sales.clientId, params.clientId), eq(sales.organizationId, caller.organizationId!))
                : eq(sales.clientId, params.clientId))
            .orderBy(desc(sales.createdAt));

        return NextResponse.json({
            budgets: budgetRows.map((b) => ({ ...b, total_prazo: Number(b.total_prazo), total_avista: Number(b.total_avista) })),
            sales: saleRows.map((s) => ({ ...s, total_value: s.total_value === null ? null : Number(s.total_value) })),
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
