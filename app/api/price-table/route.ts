import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { eq, asc, count } from 'drizzle-orm';
import { db } from '@/lib/db';
import { priceTableItems } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';
import { snakeRows, snakeKeys } from '@/lib/case';

export async function GET() {
    try {
        const caller = await getCaller();
        if (!caller) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

        const rows = caller.role === 'sysadmin'
            ? await db.select().from(priceTableItems).orderBy(asc(priceTableItems.position))
            : await db.select().from(priceTableItems)
                .where(eq(priceTableItems.organizationId, caller.organizationId!))
                .orderBy(asc(priceTableItems.position));

        return NextResponse.json(snakeRows(rows));
    } catch (e: any) {
        return apiError(e);
    }
}

export async function POST(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller || !['sysadmin', 'owner', 'office'].includes(caller.role)) {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }

        const { name, price_prazo, price_avista, is_active } = await req.json();
        if (!name?.trim()) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });

        const orgId = caller.organizationId!;
        const [{ value: position }] = await db.select({ value: count() })
            .from(priceTableItems).where(eq(priceTableItems.organizationId, orgId));

        const [data] = await db.insert(priceTableItems).values({
            organizationId: orgId,
            name: name.trim(),
            pricePrazo: String(price_prazo || 0),
            priceAvista: String(price_avista || 0),
            isActive: is_active !== false,
            position: position ?? 0,
        }).returning();

        return NextResponse.json(snakeKeys(data), { status: 201 });
    } catch (e: any) {
        return apiError(e);
    }
}
