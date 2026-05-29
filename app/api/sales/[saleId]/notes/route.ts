import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { sales } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';

export async function PATCH(req: Request, { params }: { params: { saleId: string } }) {
    try {
        const caller = await getCaller();
        if (!caller) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

        const { notes } = await req.json();
        await db.update(sales).set({ notes }).where(eq(sales.id, params.saleId));

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
