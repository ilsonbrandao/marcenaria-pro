import { and, eq, sql, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { db } from '@/lib/db';
import { sales, budgets, inventory } from '@/lib/db/schema';
import type { Caller } from '@/lib/auth-helpers';

// Predicado de escopo por organização. `sysadmin` enxerga todas as orgs; um
// caller sem organizationId não enxerga nada (em vez de casar com NULL).
export function orgFilter(caller: Caller, column: PgColumn): SQL {
    if (caller.role === 'sysadmin') return sql`true`;
    if (!caller.organizationId) return sql`false`;
    return eq(column, caller.organizationId);
}

// Combina condições de negócio com o escopo de organização. Use sempre que
// o recurso for endereçado por um id vindo do path/query.
export function scopedTo(caller: Caller, column: PgColumn, ...conds: (SQL | undefined)[]): SQL {
    return and(...conds, orgFilter(caller, column))!;
}

// Confirma a posse de um recurso-pai antes de mutar sub-recursos que não
// carregam organization_id (budget_environments, budget_items).
export async function ownsBudget(caller: Caller, budgetId: string): Promise<boolean> {
    const [row] = await db.select({ id: budgets.id }).from(budgets)
        .where(scopedTo(caller, budgets.organizationId, eq(budgets.id, budgetId)))
        .limit(1);
    return !!row;
}

export async function ownsSale(caller: Caller, saleId: string): Promise<boolean> {
    const [row] = await db.select({ id: sales.id }).from(sales)
        .where(scopedTo(caller, sales.organizationId, eq(sales.id, saleId)))
        .limit(1);
    return !!row;
}

export async function ownsInventoryItem(caller: Caller, inventoryId: string): Promise<boolean> {
    const [row] = await db.select({ id: inventory.id }).from(inventory)
        .where(scopedTo(caller, inventory.organizationId, eq(inventory.id, inventoryId)))
        .limit(1);
    return !!row;
}

// 404 em vez de 403: não confirma a existência do recurso para quem não é dono.
export const notFound = () =>
    Response.json({ error: 'Não encontrado.' }, { status: 404 });
