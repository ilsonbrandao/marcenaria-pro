import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { budgetItems, budgets } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';
import { ownsBudget } from '@/lib/authz';
import { snakeKeys } from '@/lib/case';

// Recalcula somando value_prazo e value_avista por item (sem desconto).
async function recalcTotals(budgetId: string) {
    const items = await db
        .select({ valuePrazo: budgetItems.valuePrazo, valueAvista: budgetItems.valueAvista })
        .from(budgetItems)
        .where(and(eq(budgetItems.budgetId, budgetId), eq(budgetItems.isActive, true)));

    const total_prazo = items.reduce((s, i) => s + Number(i.valuePrazo || 0), 0);
    const total_avista = items.reduce((s, i) => s + Number(i.valueAvista || 0), 0);

    await db.update(budgets).set({
        totalPrazo: String(Math.round(total_prazo * 100) / 100),
        totalAvista: String(Math.round(total_avista * 100) / 100),
        updatedAt: new Date().toISOString(),
    }).where(eq(budgets.id, budgetId));
}

export async function PUT(req: Request, { params }: { params: { budgetId: string; itemId: string } }) {
    try {
        const caller = await getCaller();
        if (!caller || caller.role === 'carpenter') {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }

        if (!(await ownsBudget(caller, params.budgetId))) {
            return NextResponse.json({ error: 'Orçamento não encontrado.' }, { status: 404 });
        }

        const body = await req.json();
        const map: Record<string, string> = {
            description: 'description', qty: 'qty', alt_cm: 'altCm', larg_cm: 'largCm', prof_cm: 'profCm',
            price_prazo_m2: 'pricePrazoM2', price_avista_m2: 'priceAvistaM2', is_active: 'isActive', position: 'position',
        };
        const numeric = new Set(['qty', 'alt_cm', 'larg_cm', 'prof_cm', 'price_prazo_m2', 'price_avista_m2']);
        const updates: Record<string, any> = {};
        for (const key of Object.keys(map)) {
            if (body[key] !== undefined) updates[map[key]] = numeric.has(key) ? String(body[key]) : body[key];
        }

        const [data] = await db.update(budgetItems).set(updates)
            .where(and(eq(budgetItems.id, params.itemId), eq(budgetItems.budgetId, params.budgetId)))
            .returning();

        await recalcTotals(params.budgetId);
        return NextResponse.json(snakeKeys(data));
    } catch (e: any) {
        return apiError(e);
    }
}

export async function DELETE(req: Request, { params }: { params: { budgetId: string; itemId: string } }) {
    try {
        const caller = await getCaller();
        if (!caller || caller.role === 'carpenter') {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }

        if (!(await ownsBudget(caller, params.budgetId))) {
            return NextResponse.json({ error: 'Orçamento não encontrado.' }, { status: 404 });
        }

        await db.delete(budgetItems)
            .where(and(eq(budgetItems.id, params.itemId), eq(budgetItems.budgetId, params.budgetId)));

        await recalcTotals(params.budgetId);
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return apiError(e);
    }
}
