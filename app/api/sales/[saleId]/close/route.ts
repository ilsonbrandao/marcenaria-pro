import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { sales, commissions } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';

export async function POST(req: Request, { params }: { params: { saleId: string } }) {
    try {
        const caller = await getCaller();
        if (!caller || !['sysadmin', 'owner', 'office'].includes(caller.role)) {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }

        const {
            total_value, received_value,
            commission_carpenter_percent, commission_seller_percent, rt_architect_percent,
            freight_cost, meals_cost, raw_material_cost,
            seller_id, carpenter_id,
        } = await req.json();

        const rt_value = total_value * (rt_architect_percent / 100);
        const commission_seller_value = total_value * (commission_seller_percent / 100);
        const commission_carpenter_value = total_value * (commission_carpenter_percent / 100);

        const total_deductions =
            rt_value + commission_seller_value + commission_carpenter_value +
            freight_cost + meals_cost + raw_material_cost;

        const gross_profit = total_value - total_deductions;
        const balance_to_receive = total_value - received_value;
        const gross_margin_percent = total_value > 0 ? (gross_profit / total_value) * 100 : 0;

        const [saleData] = await db.select({ organizationId: sales.organizationId })
            .from(sales).where(eq(sales.id, params.saleId)).limit(1);
        const orgId = saleData?.organizationId;

        await db.update(sales).set({ status: 'Concluído', receivedValue: String(received_value) })
            .where(eq(sales.id, params.saleId));

        const commissionsToInsert: any[] = [];
        if (seller_id && commission_seller_percent > 0) {
            commissionsToInsert.push({
                organizationId: orgId, saleId: params.saleId, profileId: seller_id,
                commissionType: 'seller', baseAmount: String(total_value),
                percent: String(commission_seller_percent), amount: String(commission_seller_value), status: 'pending',
            });
        }
        if (carpenter_id && commission_carpenter_percent > 0) {
            commissionsToInsert.push({
                organizationId: orgId, saleId: params.saleId, profileId: carpenter_id,
                commissionType: 'carpenter', baseAmount: String(total_value),
                percent: String(commission_carpenter_percent), amount: String(commission_carpenter_value), status: 'pending',
            });
        }

        if (commissionsToInsert.length > 0) {
            await db.delete(commissions).where(eq(commissions.saleId, params.saleId));
            await db.insert(commissions).values(commissionsToInsert);
        }

        return NextResponse.json({
            sale_id: params.saleId,
            balance_to_receive: Math.round(balance_to_receive * 100) / 100,
            total_deductions: Math.round(total_deductions * 100) / 100,
            gross_profit: Math.round(gross_profit * 100) / 100,
            gross_margin_percent: Math.round(gross_margin_percent * 100) / 100,
            commissions_created: commissionsToInsert.length,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
