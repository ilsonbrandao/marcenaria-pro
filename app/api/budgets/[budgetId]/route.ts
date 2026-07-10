import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { and, eq, asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { budgets, budgetEnvironments, budgetItems, profiles, sales } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';
import { scopedTo } from '@/lib/authz';
import { snakeKeys, snakeRows } from '@/lib/case';
import { recalcTotals } from '@/lib/budget-recalc';

export async function GET(req: Request, { params }: { params: { budgetId: string } }) {
    try {
        const caller = await getCaller();
        if (!caller || caller.role === 'carpenter') {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }

        const [budget] = await db.select().from(budgets).where(eq(budgets.id, params.budgetId)).limit(1);
        if (!budget) return NextResponse.json({ error: 'Orçamento não encontrado.' }, { status: 404 });
        if (caller.role !== 'sysadmin' && budget.organizationId !== caller.organizationId) {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }

        const environments = await db.select().from(budgetEnvironments)
            .where(eq(budgetEnvironments.budgetId, params.budgetId))
            .orderBy(asc(budgetEnvironments.position));

        const items = await db.select().from(budgetItems)
            .where(eq(budgetItems.budgetId, params.budgetId))
            .orderBy(asc(budgetItems.position));

        let createdByName: string | null = null;
        if (budget.createdBy) {
            const [creator] = await db.select({ fullName: profiles.fullName })
                .from(profiles).where(eq(profiles.id, budget.createdBy)).limit(1);
            createdByName = creator?.fullName || null;
        }

        return NextResponse.json({
            ...snakeKeys(budget),
            created_by_name: createdByName,
            environments: environments.map((env) => ({
                ...snakeKeys(env),
                items: snakeRows(items.filter((i) => i.environmentId === env.id)),
            })),
        });
    } catch (e: any) {
        return apiError(e);
    }
}

export async function PUT(req: Request, { params }: { params: { budgetId: string } }) {
    try {
        const caller = await getCaller();
        if (!caller || caller.role === 'carpenter') {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }

        const body = await req.json();
        // `saleId` não é atribuível pelo cliente: só o próprio handler o define
        // ao aprovar o orçamento (abaixo).
        const map: Record<string, string> = {
            client_name: 'clientName', client_address: 'clientAddress', payment_type: 'paymentType',
            prazo_entry_percent: 'prazoEntryPercent', prazo_installments: 'prazoInstallments',
            avista_discount_percent: 'avistaDiscountPercent', avista_entry_percent: 'avistaEntryPercent',
            observations: 'observations', status: 'status',
        };
        const numeric = new Set(['prazo_entry_percent', 'avista_discount_percent', 'avista_entry_percent']);
        const updates: Record<string, any> = { updatedAt: new Date().toISOString() };
        for (const key of Object.keys(map)) {
            if (body[key] !== undefined) updates[map[key]] = numeric.has(key) ? String(body[key]) : body[key];
        }

        if (body.status === 'approved') {
            const [existing] = await db
                .select({ saleId: budgets.saleId, clientName: budgets.clientName, totalPrazo: budgets.totalPrazo })
                .from(budgets)
                .where(scopedTo(caller, budgets.organizationId, eq(budgets.id, params.budgetId)))
                .limit(1);
            if (!existing) {
                return NextResponse.json({ error: 'Orçamento não encontrado.' }, { status: 404 });
            }

            if (!existing.saleId) {
                const [sale] = await db.insert(sales).values({
                    organizationId: caller.organizationId!,
                    clientName: existing.clientName,
                    totalValue: existing.totalPrazo ?? '0',
                    status: 'Orçamento',
                    sellerId: caller.id,
                }).returning({ id: sales.id });
                if (sale) updates.saleId = sale.id;
            }
        }

        const [data] = await db.update(budgets).set(updates)
            .where(scopedTo(caller, budgets.organizationId, eq(budgets.id, params.budgetId)))
            .returning();
        if (!data) {
            return NextResponse.json({ error: 'Orçamento não encontrado.' }, { status: 404 });
        }

        if (body.avista_discount_percent !== undefined) {
            await recalcTotals(params.budgetId);
            const [refreshed] = await db.select().from(budgets).where(eq(budgets.id, params.budgetId)).limit(1);
            return NextResponse.json(snakeKeys(refreshed ?? data));
        }

        return NextResponse.json(snakeKeys(data));
    } catch (e: any) {
        return apiError(e);
    }
}

export async function DELETE(req: Request, { params }: { params: { budgetId: string } }) {
    try {
        const caller = await getCaller();
        if (!caller || !['sysadmin', 'owner', 'office'].includes(caller.role)) {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }

        const cond = caller.role === 'sysadmin'
            ? eq(budgets.id, params.budgetId)
            : and(eq(budgets.id, params.budgetId), eq(budgets.organizationId, caller.organizationId!));
        await db.delete(budgets).where(cond);
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return apiError(e);
    }
}
