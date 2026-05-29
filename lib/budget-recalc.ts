import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { budgetItems, budgets } from '@/lib/db/schema';

export async function recalcTotals(budgetId: string) {
    const [items, budgetRow] = await Promise.all([
        db.select({ valuePrazo: budgetItems.valuePrazo })
            .from(budgetItems)
            .where(and(eq(budgetItems.budgetId, budgetId), eq(budgetItems.isActive, true))),
        db.select({ avistaDiscountPercent: budgets.avistaDiscountPercent })
            .from(budgets)
            .where(eq(budgets.id, budgetId))
            .limit(1),
    ]);

    const total_prazo = items.reduce((s, i) => s + Number(i.valuePrazo || 0), 0);
    const discount = Number(budgetRow[0]?.avistaDiscountPercent ?? 0);
    const total_avista = total_prazo * (1 - discount / 100);

    await db.update(budgets).set({
        totalPrazo: String(Math.round(total_prazo * 100) / 100),
        totalAvista: String(Math.round(total_avista * 100) / 100),
        updatedAt: new Date().toISOString(),
    }).where(eq(budgets.id, budgetId));
}
