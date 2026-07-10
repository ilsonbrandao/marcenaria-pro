import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { and, eq, gte, lte, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { sales, expenses } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';

const MANAGER = ['sysadmin', 'owner', 'office'];

export async function GET(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller || !MANAGER.includes(caller.role)) {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }
        const orgScope = caller.role !== 'sysadmin';
        const orgId = caller.organizationId!;

        const url = new URL(req.url);
        const from = url.searchParams.get('from')!;
        const to = url.searchParams.get('to')!;

        const salesConds = [gte(sales.createdAt, from), lte(sales.createdAt, to + 'T23:59:59')];
        if (orgScope) salesConds.push(eq(sales.organizationId, orgId));

        const num = (v: any) => Number(v) || 0;
        const sRows = await db.select().from(sales).where(and(...salesConds)).orderBy(desc(sales.createdAt));

        const expConds = [eq(expenses.expenseType, 'Direct')];
        if (orgScope) expConds.push(eq(expenses.organizationId, orgId));
        const eRows = await db.select({ saleId: expenses.saleId, amount: expenses.amount }).from(expenses).where(and(...expConds));

        const expMap: Record<string, number> = {};
        for (const e of eRows) if (e.saleId) expMap[e.saleId] = (expMap[e.saleId] || 0) + num(e.amount);

        return NextResponse.json({
            sales: sRows.map((s) => ({
                id: s.id, client_name: s.clientName, status: s.status,
                total_value: num(s.totalValue), received_value: num(s.receivedValue),
                raw_material_cost: num(s.rawMaterialCost), freight_cost: num(s.freightCost),
                commission_carpenter_percent: num(s.commissionCarpenterPercent),
                commission_seller_percent: num(s.commissionSellerPercent),
                rt_architect_percent: num(s.rtArchitectPercent), created_at: s.createdAt,
            })),
            expenses: expMap,
        });
    } catch (e: any) {
        return apiError(e);
    }
}
