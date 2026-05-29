import { NextResponse } from 'next/server';
import { and, eq, asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { installments, sales } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';

// Recalcula received_value da venda = soma das parcelas pagas.
async function recomputeReceived(saleId: string) {
    const rows = await db.select({ amount: installments.amount, paid: installments.paid })
        .from(installments).where(eq(installments.saleId, saleId));
    const totalPaid = rows.filter((i) => i.paid).reduce((s, i) => s + Number(i.amount || 0), 0);
    await db.update(sales).set({ receivedValue: String(totalPaid) }).where(eq(sales.id, saleId));
}

export async function GET(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
        const saleId = new URL(req.url).searchParams.get('saleId');
        if (!saleId) return NextResponse.json({ error: 'saleId é obrigatório.' }, { status: 400 });

        const rows = await db.select().from(installments)
            .where(eq(installments.saleId, saleId)).orderBy(asc(installments.dueDate));
        return NextResponse.json(rows.map((r) => ({
            id: r.id, sale_id: r.saleId, description: r.description, amount: Number(r.amount),
            due_date: r.dueDate, paid: r.paid, paid_at: r.paidAt,
        })));
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller || caller.role === 'carpenter') return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        const b = await req.json();

        await db.insert(installments).values({
            organizationId: caller.organizationId!,
            saleId: b.sale_id,
            description: b.description || 'Parcela',
            amount: String(b.amount || 0),
            dueDate: b.due_date,
        });
        await recomputeReceived(b.sale_id);
        return NextResponse.json({ ok: true }, { status: 201 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller || caller.role === 'carpenter') return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        const b = await req.json();
        if (!b.id) return NextResponse.json({ error: 'ID é obrigatório.' }, { status: 400 });

        const updates: Record<string, any> = {};
        if (b.description !== undefined) updates.description = b.description || 'Parcela';
        if (b.amount !== undefined) updates.amount = String(b.amount);
        if (b.due_date !== undefined) updates.dueDate = b.due_date;
        if (b.paid !== undefined) {
            updates.paid = b.paid;
            updates.paidAt = b.paid ? new Date().toISOString() : null;
        }

        const [row] = await db.update(installments).set(updates).where(eq(installments.id, b.id)).returning({ saleId: installments.saleId });
        if (row) await recomputeReceived(row.saleId!);
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller || caller.role === 'carpenter') return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        const id = new URL(req.url).searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID não fornecido.' }, { status: 400 });

        const [row] = await db.delete(installments).where(eq(installments.id, id)).returning({ saleId: installments.saleId });
        if (row) await recomputeReceived(row.saleId!);
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
