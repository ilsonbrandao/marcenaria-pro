import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { budgets, budgetItems } from '@/lib/db/schema';
import { recalcTotals } from '@/lib/budget-recalc';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: { token: string } }) {
    try {
        const [budget] = await db.select({ id: budgets.id, status: budgets.status })
            .from(budgets).where(eq(budgets.publicToken, params.token)).limit(1);

        if (!budget) {
            return NextResponse.json({ error: 'Orçamento não encontrado.' }, { status: 404 });
        }

        const body = await req.json();
        const { action, item_id, is_active, qty, status, chosen_payment_type,
                prazo_entry_percent, prazo_installments,
                avista_discount_percent, avista_entry_percent } = body;

        if (action === 'set_status' && status) {
            const updates: Record<string, any> = { status, updatedAt: new Date().toISOString() };
            if (chosen_payment_type) updates.paymentType = chosen_payment_type;
            else if (status === 'sent') updates.paymentType = 'both';

            const rows = await db.update(budgets).set(updates).where(eq(budgets.id, budget.id)).returning({ id: budgets.id });
            if (rows.length === 0) {
                return NextResponse.json({ error: 'Nenhuma linha atualizada.' }, { status: 500 });
            }
            return NextResponse.json({ ok: true });
        }

        if (action === 'update_payment') {
            const updates: Record<string, any> = { updatedAt: new Date().toISOString() };
            if (prazo_entry_percent !== undefined) updates.prazoEntryPercent = String(prazo_entry_percent);
            if (prazo_installments !== undefined) updates.prazoInstallments = prazo_installments;
            if (avista_discount_percent !== undefined) updates.avistaDiscountPercent = String(avista_discount_percent);
            if (avista_entry_percent !== undefined) updates.avistaEntryPercent = String(avista_entry_percent);
            await db.update(budgets).set(updates).where(eq(budgets.id, budget.id));
            return NextResponse.json({ ok: true });
        }

        if (item_id) {
            const itemUpdates: Record<string, any> = {};
            if (is_active !== undefined) itemUpdates.isActive = is_active;
            if (qty !== undefined) itemUpdates.qty = String(qty);

            await db.update(budgetItems).set(itemUpdates)
                .where(and(eq(budgetItems.id, item_id), eq(budgetItems.budgetId, budget.id)));

            await recalcTotals(budget.id);

            const [updated] = await db.select({ total_prazo: budgets.totalPrazo, total_avista: budgets.totalAvista })
                .from(budgets).where(eq(budgets.id, budget.id)).limit(1);

            return NextResponse.json({ ok: true, totals: updated });
        }

        return NextResponse.json({ error: 'Nenhuma ação reconhecida.' }, { status: 400 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
