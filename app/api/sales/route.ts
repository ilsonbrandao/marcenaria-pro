import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { and, eq, desc, sum } from 'drizzle-orm';
import { db } from '@/lib/db';
import { sales, architects, stockMovements, expenses } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';
import { snakeKeys } from '@/lib/case';

const NUMERIC_SALE = ['total_value', 'received_value', 'commission_carpenter_percent', 'commission_seller_percent',
    'rt_architect_percent', 'freight_cost', 'meals_cost', 'raw_material_cost'];
const FIELD_MAP: Record<string, string> = {
    client_name: 'clientName', total_value: 'totalValue', received_value: 'receivedValue', status: 'status',
    commission_carpenter_percent: 'commissionCarpenterPercent', commission_seller_percent: 'commissionSellerPercent',
    rt_architect_percent: 'rtArchitectPercent', freight_cost: 'freightCost', meals_cost: 'mealsCost',
    raw_material_cost: 'rawMaterialCost', client_id: 'clientId', architect_id: 'architectId',
    seller_id: 'sellerId', carpenter_id: 'carpenterId', delivery_date: 'deliveryDate',
    kanban_stage_id: 'kanbanStageId', notes: 'notes',
};

function numify(row: any) {
    const out = snakeKeys(row);
    for (const k of NUMERIC_SALE) if (out[k] !== undefined && out[k] !== null) out[k] = Number(out[k]);
    return out;
}

function scope(caller: any) {
    if (caller.role === 'sysadmin') return undefined;
    const base = eq(sales.organizationId, caller.organizationId!);
    if (caller.role === 'seller') return and(base, eq(sales.sellerId, caller.id));
    if (caller.role === 'carpenter') return and(base, eq(sales.carpenterId, caller.id));
    return base;
}

export async function GET(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

        const id = new URL(req.url).searchParams.get('id');
        if (id) {
            const [row] = await db.select().from(sales).where(eq(sales.id, id)).limit(1);
            if (!row) return NextResponse.json({ error: 'Não encontrado.' }, { status: 404 });
            if (caller.role !== 'sysadmin' && row.organizationId !== caller.organizationId) {
                return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
            }
            return NextResponse.json(numify(row));
        }

        const rows = await db.select().from(sales).where(scope(caller)).orderBy(desc(sales.createdAt));
        return NextResponse.json(rows.map(numify));
    } catch (e: any) {
        return apiError(e);
    }
}

export async function POST(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller || caller.role === 'carpenter') return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        const b = await req.json();
        if (!b.client_name?.trim()) return NextResponse.json({ error: 'Nome do cliente é obrigatório.' }, { status: 400 });

        const values: Record<string, any> = {
            organizationId: caller.organizationId!,
            clientName: b.client_name.trim(),
            totalValue: String(b.total_value || 0),
            status: b.status || 'Orçamento',
            notes: b.notes || null,
        };
        if (b.client_id) values.clientId = b.client_id;
        if (b.architect_id) {
            values.architectId = b.architect_id;
            const [arch] = await db.select({ rt: architects.defaultRtPercent }).from(architects).where(eq(architects.id, b.architect_id)).limit(1);
            if (arch) values.rtArchitectPercent = String(arch.rt);
        }

        const [data] = await db.insert(sales).values(values as any).returning({ id: sales.id });
        return NextResponse.json({ id: data.id }, { status: 201 });
    } catch (e: any) {
        return apiError(e);
    }
}

export async function PATCH(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
        const b = await req.json();
        if (!b.id) return NextResponse.json({ error: 'ID é obrigatório.' }, { status: 400 });

        const updates: Record<string, any> = {};
        for (const key of Object.keys(FIELD_MAP)) {
            if (b[key] !== undefined) updates[FIELD_MAP[key]] = NUMERIC_SALE.includes(key) ? String(b[key]) : b[key];
        }

        const cond = caller.role === 'sysadmin'
            ? eq(sales.id, b.id)
            : and(eq(sales.id, b.id), eq(sales.organizationId, caller.organizationId!));
        await db.update(sales).set(updates).where(cond);

        // Informações auxiliares para os toasts do Kanban ao mudar status
        const extra: Record<string, any> = {};
        if (b.status === 'Produção') {
            const mv = await db.select({ inventoryId: stockMovements.inventoryId })
                .from(stockMovements)
                .where(and(eq(stockMovements.saleId, b.id), eq(stockMovements.movementType, 'OUT')));
            extra.linked_materials_count = mv.length;
        }
        if (b.status === 'Concluído') {
            const [r] = await db.select({ total: sum(expenses.amount) })
                .from(expenses)
                .where(and(eq(expenses.saleId, b.id), eq(expenses.expenseType, 'Direct')));
            extra.total_direct_expenses = Number(r?.total || 0);
        }
        return NextResponse.json({ ok: true, ...extra });
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

        const cond = caller.role === 'sysadmin'
            ? eq(sales.id, id)
            : and(eq(sales.id, id), eq(sales.organizationId, caller.organizationId!));
        await db.delete(sales).where(cond);
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return apiError(e);
    }
}
