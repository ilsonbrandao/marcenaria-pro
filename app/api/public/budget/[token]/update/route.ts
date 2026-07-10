import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { budgets, budgetItems } from '@/lib/db/schema';
import { recalcTotals } from '@/lib/budget-recalc';
import { rateLimit, clientIp, tooManyRequests } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: { token: string } }) {
    try {
        // Endpoint público: limita por token e por IP antes de tocar o banco.
        const perToken = rateLimit(`pubbudget:${params.token}`, 30, 10 * 60 * 1000);
        const perIp = rateLimit(`pubbudget:ip:${clientIp(req)}`, 60, 10 * 60 * 1000);
        if (!perToken.ok) return tooManyRequests(perToken.retryAfterSeconds);
        if (!perIp.ok) return tooManyRequests(perIp.retryAfterSeconds);

        const [budget] = await db.select({ id: budgets.id, status: budgets.status })
            .from(budgets).where(eq(budgets.publicToken, params.token)).limit(1);

        if (!budget) {
            return NextResponse.json({ error: 'Orçamento não encontrado.' }, { status: 404 });
        }

        const body = await req.json();
        const { action, item_id, is_active, qty, status, chosen_payment_type } = body;

        // Esta rota é PÚBLICA (autenticada só pelo token do orçamento). O cliente
        // pode aceitar/reabrir e escolher itens — nunca definir descontos, entradas
        // ou parcelas, que alterariam os totais a seu favor.
        if (action === 'set_status' && status) {
            const ALLOWED_TRANSITIONS: Record<string, readonly string[]> = {
                draft: ['approved'],
                sent: ['approved'],
                approved: ['sent'],   // reabertura pelo cliente
            };
            if (!ALLOWED_TRANSITIONS[budget.status ?? '']?.includes(status)) {
                return NextResponse.json({ error: 'Operação inválida.' }, { status: 409 });
            }
            if (chosen_payment_type && !['prazo', 'avista'].includes(chosen_payment_type)) {
                return NextResponse.json({ error: 'Condição de pagamento inválida.' }, { status: 400 });
            }

            const updates: Record<string, any> = { status, updatedAt: new Date().toISOString() };
            if (chosen_payment_type) updates.paymentType = chosen_payment_type;
            else if (status === 'sent') updates.paymentType = 'both';

            const rows = await db.update(budgets).set(updates).where(eq(budgets.id, budget.id)).returning({ id: budgets.id });
            if (rows.length === 0) {
                return NextResponse.json({ error: 'Nenhuma linha atualizada.' }, { status: 500 });
            }
            return NextResponse.json({ ok: true });
        }

        if (item_id) {
            // Um orçamento já aprovado não é mais editável pelo cliente.
            if (budget.status === 'approved') {
                return NextResponse.json({ error: 'Orçamento já aprovado.' }, { status: 409 });
            }
            const itemUpdates: Record<string, any> = {};
            if (is_active !== undefined) {
                if (typeof is_active !== 'boolean') {
                    return NextResponse.json({ error: 'Valor inválido.' }, { status: 400 });
                }
                itemUpdates.isActive = is_active;
            }
            if (qty !== undefined) {
                const n = Number(qty);
                if (!Number.isFinite(n) || n <= 0 || n > 9999) {
                    return NextResponse.json({ error: 'Quantidade inválida.' }, { status: 400 });
                }
                itemUpdates.qty = String(n);
            }
            if (Object.keys(itemUpdates).length === 0) {
                return NextResponse.json({ error: 'Nada a atualizar.' }, { status: 400 });
            }

            await db.update(budgetItems).set(itemUpdates)
                .where(and(eq(budgetItems.id, item_id), eq(budgetItems.budgetId, budget.id)));

            await recalcTotals(budget.id);

            const [updated] = await db.select({ total_prazo: budgets.totalPrazo, total_avista: budgets.totalAvista })
                .from(budgets).where(eq(budgets.id, budget.id)).limit(1);

            return NextResponse.json({ ok: true, totals: updated });
        }

        return NextResponse.json({ error: 'Nenhuma ação reconhecida.' }, { status: 400 });
    } catch (e: any) {
        return apiError(e);
    }
}
