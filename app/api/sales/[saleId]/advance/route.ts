import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { sales, inventory } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';

export async function POST(req: Request, { params }: { params: { saleId: string } }) {
    try {
        const caller = await getCaller();
        if (!caller) {
            return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
        }

        const { new_status, used_materials } = await req.json();

        await db.update(sales).set({ status: new_status }).where(eq(sales.id, params.saleId));

        if (used_materials && used_materials.length > 0) {
            for (const material of used_materials) {
                const [inv] = await db.select({ quantity: inventory.quantity })
                    .from(inventory).where(eq(inventory.id, material.inventory_id)).limit(1);
                if (inv) {
                    const new_qty = Math.max(0, Number(inv.quantity) - material.quantity_used);
                    await db.update(inventory).set({ quantity: String(new_qty) })
                        .where(eq(inventory.id, material.inventory_id));
                }
            }
        }

        return NextResponse.json({
            message: `Obra avançada para ${new_status} com sucesso e estoque atualizado.`,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
