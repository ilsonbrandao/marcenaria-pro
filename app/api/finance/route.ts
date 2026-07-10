import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { and, eq, gte, lte, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { expenses, sales } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';

export async function GET(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
        const orgId = caller.organizationId!;

        const url = new URL(req.url);
        const from = url.searchParams.get('from')!;
        const to = url.searchParams.get('to')!;

        const expRows = await db
            .select({
                id: expenses.id,
                description: expenses.description,
                amount: expenses.amount,
                expense_type: expenses.expenseType,
                date_incurred: expenses.dateIncurred,
                sale_id: expenses.saleId,
                sale_client_name: sales.clientName,
            })
            .from(expenses)
            .leftJoin(sales, eq(sales.id, expenses.saleId))
            .where(and(eq(expenses.organizationId, orgId), gte(expenses.dateIncurred, from), lte(expenses.dateIncurred, to)))
            .orderBy(desc(expenses.dateIncurred));

        const salesRows = await db
            .select()
            .from(sales)
            .where(and(eq(sales.organizationId, orgId), gte(sales.createdAt, from), lte(sales.createdAt, to + 'T23:59:59')))
            .orderBy(desc(sales.createdAt));

        return NextResponse.json({
            expenses: expRows.map(({ sale_client_name, ...e }) => ({
                ...e,
                amount: Number(e.amount),
                sales: sale_client_name ? { client_name: sale_client_name } : null,
            })),
            sales: salesRows.map((s) => ({
                id: s.id,
                client_name: s.clientName,
                total_value: Number(s.totalValue),
                received_value: Number(s.receivedValue),
                status: s.status,
                created_at: s.createdAt,
            })),
        });
    } catch (e: any) {
        return apiError(e);
    }
}

export async function POST(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller || !['sysadmin', 'owner', 'office'].includes(caller.role)) {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }
        const b = await req.json();
        const amount = Number(b.amount) || 0;
        if (amount <= 0) return NextResponse.json({ error: 'Valor inválido.' }, { status: 400 });

        await db.insert(expenses).values({
            organizationId: caller.organizationId!,
            description: (b.description || '').trim(),
            amount: String(amount),
            expenseType: b.expense_type,
            saleId: b.sale_id || null,
            dateIncurred: new Date().toISOString().split('T')[0],
        });
        return NextResponse.json({ ok: true }, { status: 201 });
    } catch (e: any) {
        return apiError(e);
    }
}

export async function DELETE(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller || !['sysadmin', 'owner', 'office'].includes(caller.role)) {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }
        const id = new URL(req.url).searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID não fornecido.' }, { status: 400 });

        await db.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.organizationId, caller.organizationId!)));
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return apiError(e);
    }
}
