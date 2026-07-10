import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { priceTableItems } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';
import { scopedTo } from '@/lib/authz';
import { snakeKeys } from '@/lib/case';

export async function PUT(req: Request, { params }: { params: { itemId: string } }) {
    try {
        const caller = await getCaller();
        if (!caller || !['sysadmin', 'owner', 'office'].includes(caller.role)) {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }

        const body = await req.json();
        const updates: Record<string, any> = {};
        if (body.name !== undefined) updates.name = body.name;
        if (body.price_prazo !== undefined) updates.pricePrazo = String(body.price_prazo);
        if (body.price_avista !== undefined) updates.priceAvista = String(body.price_avista);
        if (body.is_active !== undefined) updates.isActive = body.is_active;
        if (body.position !== undefined) updates.position = body.position;

        const [data] = await db.update(priceTableItems).set(updates)
            .where(scopedTo(caller, priceTableItems.organizationId, eq(priceTableItems.id, params.itemId)))
            .returning();
        if (!data) return NextResponse.json({ error: 'Item não encontrado.' }, { status: 404 });

        return NextResponse.json(snakeKeys(data));
    } catch (e: any) {
        return apiError(e);
    }
}

export async function DELETE(req: Request, { params }: { params: { itemId: string } }) {
    try {
        const caller = await getCaller();
        if (!caller || !['sysadmin', 'owner', 'office'].includes(caller.role)) {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }

        await db.delete(priceTableItems)
            .where(scopedTo(caller, priceTableItems.organizationId, eq(priceTableItems.id, params.itemId)));
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return apiError(e);
    }
}
