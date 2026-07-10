import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { and, eq, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { stockMovements, inventory } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';
import { scopedTo, ownsSale } from '@/lib/authz';

export async function GET(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
        const saleId = new URL(req.url).searchParams.get('saleId');
        if (!saleId) return NextResponse.json({ error: 'saleId é obrigatório.' }, { status: 400 });

        const rows = await db
            .select({
                id: stockMovements.id, inventory_id: stockMovements.inventoryId,
                movement_type: stockMovements.movementType, quantity: stockMovements.quantity,
                notes: stockMovements.notes, created_at: stockMovements.createdAt,
                inv_category: inventory.category, inv_brand: inventory.brand,
                inv_name_or_color: inventory.nameOrColor, inv_thickness: inventory.thickness,
            })
            .from(stockMovements)
            .leftJoin(inventory, eq(inventory.id, stockMovements.inventoryId))
            .where(scopedTo(caller, stockMovements.organizationId, eq(stockMovements.saleId, saleId)))
            .orderBy(desc(stockMovements.createdAt));

        return NextResponse.json(rows.map((r) => ({
            id: r.id, inventory_id: r.inventory_id, movement_type: r.movement_type,
            quantity: Number(r.quantity), notes: r.notes, created_at: r.created_at,
            inventory: r.inv_name_or_color ? {
                id: r.inventory_id, category: r.inv_category, brand: r.inv_brand,
                name_or_color: r.inv_name_or_color, thickness: r.inv_thickness === null ? null : Number(r.inv_thickness),
            } : null,
        })));
    } catch (e: any) {
        return apiError(e);
    }
}

// Registra saída (OUT) de material para um projeto e decrementa o estoque.
export async function POST(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller || caller.role === 'carpenter') return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        const b = await req.json();
        const qty = Number(b.quantity) || 0;
        if (qty <= 0) return NextResponse.json({ error: 'Quantidade inválida.' }, { status: 400 });

        if (b.sale_id && !(await ownsSale(caller, b.sale_id))) {
            return NextResponse.json({ error: 'Venda não encontrada.' }, { status: 404 });
        }

        const [item] = await db.select({ quantity: inventory.quantity }).from(inventory)
            .where(scopedTo(caller, inventory.organizationId, eq(inventory.id, b.inventory_id)))
            .limit(1);
        if (!item) return NextResponse.json({ error: 'Item não encontrado.' }, { status: 404 });
        if (Number(item.quantity) < qty) {
            return NextResponse.json({ error: `Estoque insuficiente. Disponível: ${Number(item.quantity)}` }, { status: 400 });
        }

        await db.insert(stockMovements).values({
            organizationId: caller.organizationId!,
            inventoryId: b.inventory_id,
            saleId: b.sale_id,
            movementType: 'OUT',
            quantity: String(qty),
            notes: b.notes || null,
        });
        await db.update(inventory).set({ quantity: String(Number(item.quantity) - qty) })
            .where(scopedTo(caller, inventory.organizationId, eq(inventory.id, b.inventory_id)));

        return NextResponse.json({ ok: true }, { status: 201 });
    } catch (e: any) {
        return apiError(e);
    }
}
