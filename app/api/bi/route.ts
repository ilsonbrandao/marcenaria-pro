import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { sales, expenses } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';

const MANAGER = ['sysadmin', 'owner', 'office'];

export async function GET() {
    try {
        const caller = await getCaller();
        if (!caller || !MANAGER.includes(caller.role)) {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }
        const orgScope = caller.role !== 'sysadmin';

        const s = await db
            .select({
                id: sales.id, client_name: sales.clientName, total_value: sales.totalValue,
                received_value: sales.receivedValue, raw_material_cost: sales.rawMaterialCost,
                freight_cost: sales.freightCost, meals_cost: sales.mealsCost,
                commission_seller_percent: sales.commissionSellerPercent,
                commission_carpenter_percent: sales.commissionCarpenterPercent,
                rt_architect_percent: sales.rtArchitectPercent, status: sales.status,
            })
            .from(sales)
            .where(orgScope ? eq(sales.organizationId, caller.organizationId!) : undefined);

        const e = await db
            .select({ amount: expenses.amount, expense_type: expenses.expenseType })
            .from(expenses)
            .where(orgScope ? eq(expenses.organizationId, caller.organizationId!) : undefined);

        const num = (v: any) => Number(v) || 0;
        return NextResponse.json({
            projects: s.map((p) => ({
                ...p,
                total_value: num(p.total_value), received_value: num(p.received_value),
                raw_material_cost: num(p.raw_material_cost), freight_cost: num(p.freight_cost),
                meals_cost: num(p.meals_cost), commission_seller_percent: num(p.commission_seller_percent),
                commission_carpenter_percent: num(p.commission_carpenter_percent), rt_architect_percent: num(p.rt_architect_percent),
            })),
            expenses: e.map((x) => ({ amount: num(x.amount), expense_type: x.expense_type })),
        });
    } catch (e: any) {
        return apiError(e);
    }
}
