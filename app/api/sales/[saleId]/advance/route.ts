import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { sales, inventory } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';
import { scopedTo } from '@/lib/authz';

export async function POST(req: Request, { params }: { params: { saleId: string } }) {
    try {
        const caller = await getCaller();
        if (!caller) {
            return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
        }

        const { new_status, used_materials } = await req.json();

        const advanced = await db.update(sales).set({ status: new_status })
            .where(scopedTo(caller, sales.organizationId, eq(sales.id, params.saleId)))
            .returning({ id: sales.id });
        if (advanced.length === 0) {
            return NextResponse.json({ error: 'Não encontrado.' }, { status: 404 });
        }

        if (used_materials && used_materials.length > 0) {
            for (const material of used_materials) {
                const [inv] = await db.select({ quantity: inventory.quantity })
                    .from(inventory)
                    .where(scopedTo(caller, inventory.organizationId, eq(inventory.id, material.inventory_id)))
                    .limit(1);
                if (inv) {
                    const new_qty = Math.max(0, Number(inv.quantity) - material.quantity_used);
                    await db.update(inventory).set({ quantity: String(new_qty) })
                        .where(scopedTo(caller, inventory.organizationId, eq(inventory.id, material.inventory_id)));
                }
            }
        }

        return NextResponse.json({
            message: `Obra avançada para ${new_status} com sucesso e estoque atualizado.`,
        });
    } catch (error: any) {
        return apiError(error);
    }
}
