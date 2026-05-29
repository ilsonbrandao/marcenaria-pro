import { NextResponse } from 'next/server';
import { and, eq, asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { inventory, stockMovements, expenses } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';

export async function GET() {
    try {
        const caller = await getCaller();
        if (!caller) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

        const rows = caller.role === 'sysadmin'
            ? await db.select().from(inventory).orderBy(asc(inventory.category))
            : await db.select().from(inventory)
                .where(eq(inventory.organizationId, caller.organizationId!))
                .orderBy(asc(inventory.category));

        const data = rows.map((r) => ({
            id: r.id,
            category: r.category,
            brand: r.brand,
            name_or_color: r.nameOrColor,
            thickness: r.thickness === null ? null : Number(r.thickness),
            quantity: Number(r.quantity),
            cost_per_unit: Number(r.costPerUnit),
        }));
        return NextResponse.json(data);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller || !['sysadmin', 'owner', 'office'].includes(caller.role)) {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }
        const orgId = caller.organizationId;
        if (!orgId) return NextResponse.json({ error: 'Organização não encontrada.' }, { status: 400 });

        const b = await req.json();
        const quantity = Number(b.quantity) || 0;
        const costPerUnit = Number(b.cost_per_unit) || 0;

        const [item] = await db.insert(inventory).values({
            organizationId: orgId,
            category: b.category,
            brand: (b.brand || '').trim(),
            nameOrColor: (b.name_or_color || '').trim(),
            thickness: b.category === 'MDF' && b.thickness ? String(b.thickness) : null,
            quantity: String(quantity),
            costPerUnit: String(costPerUnit),
        }).returning({ id: inventory.id });

        if (quantity > 0) {
            await db.insert(stockMovements).values({
                organizationId: orgId,
                inventoryId: item.id,
                movementType: 'IN',
                quantity: String(quantity),
                notes: `Entrada inicial: ${(b.brand || '').trim()} ${(b.name_or_color || '').trim()}`,
            });
        }

        if (b.generate_expense && costPerUnit > 0 && quantity > 0) {
            await db.insert(expenses).values({
                organizationId: orgId,
                description: `Compra de Estoque: ${b.category} - ${b.brand} ${b.name_or_color}`,
                amount: String(quantity * costPerUnit),
                expenseType: 'Fixed',
                dateIncurred: new Date().toISOString().split('T')[0],
            });
        }

        return NextResponse.json({ id: item.id }, { status: 201 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
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

        const cond = caller.role === 'sysadmin'
            ? eq(inventory.id, id)
            : and(eq(inventory.id, id), eq(inventory.organizationId, caller.organizationId!));
        await db.delete(inventory).where(cond);
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
