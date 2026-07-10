import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { sales } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';
import { scopedTo } from '@/lib/authz';

export async function PATCH(req: Request, { params }: { params: { saleId: string } }) {
    try {
        const caller = await getCaller();
        if (!caller) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

        const { notes } = await req.json();
        const updated = await db.update(sales).set({ notes })
            .where(scopedTo(caller, sales.organizationId, eq(sales.id, params.saleId)))
            .returning({ id: sales.id });
        if (updated.length === 0) {
            return NextResponse.json({ error: 'Não encontrado.' }, { status: 404 });
        }

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        return apiError(error);
    }
}
