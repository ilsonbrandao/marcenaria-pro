import { NextResponse } from 'next/server';
import { eq, count } from 'drizzle-orm';
import { db } from '@/lib/db';
import { budgetItems } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';
import { snakeKeys } from '@/lib/case';
import { recalcTotals } from '@/lib/budget-recalc';

export async function POST(req: Request, { params }: { params: { budgetId: string } }) {
    try {
        const caller = await getCaller();
        if (!caller || caller.role === 'carpenter') {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }

        const body = await req.json();
        const {
            environment_id, price_table_item_id, description,
            qty, alt_cm, larg_cm, prof_cm, price_prazo_m2, price_avista_m2,
        } = body;

        if (!environment_id || !description?.trim()) {
            return NextResponse.json({ error: 'Ambiente e descrição são obrigatórios.' }, { status: 400 });
        }

        const [{ value: position }] = await db.select({ value: count() })
            .from(budgetItems).where(eq(budgetItems.environmentId, environment_id));

        const [data] = await db.insert(budgetItems).values({
            budgetId: params.budgetId,
            environmentId: environment_id,
            priceTableItemId: price_table_item_id || null,
            description: description.trim(),
            qty: String(qty || 1),
            altCm: String(alt_cm || 0),
            largCm: String(larg_cm || 0),
            profCm: String(prof_cm || 0),
            pricePrazoM2: String(price_prazo_m2 || 0),
            priceAvistaM2: String(price_avista_m2 || 0),
            position: position ?? 0,
        }).returning();

        await recalcTotals(params.budgetId);
        return NextResponse.json(snakeKeys(data), { status: 201 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
