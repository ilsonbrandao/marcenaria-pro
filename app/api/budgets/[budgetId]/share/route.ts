import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { budgets } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';
import { scopedTo } from '@/lib/authz';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function GET(req: Request, { params }: { params: { budgetId: string } }) {
    try {
        const caller = await getCaller();
        if (!caller || caller.role === 'carpenter') {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }

        const [data] = await db.select({ publicToken: budgets.publicToken })
            .from(budgets)
            .where(scopedTo(caller, budgets.organizationId, eq(budgets.id, params.budgetId)))
            .limit(1);
        if (!data) return NextResponse.json({ error: 'Orçamento não encontrado.' }, { status: 404 });

        return NextResponse.json({
            public_token: data.publicToken,
            public_url: `${appUrl}/orcamento/${data.publicToken}`,
        });
    } catch (e: any) {
        return apiError(e);
    }
}

export async function POST(req: Request, { params }: { params: { budgetId: string } }) {
    try {
        const caller = await getCaller();
        if (!caller || caller.role === 'carpenter') {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }

        const [data] = await db.update(budgets).set({ publicToken: crypto.randomUUID() })
            .where(scopedTo(caller, budgets.organizationId, eq(budgets.id, params.budgetId)))
            .returning({ publicToken: budgets.publicToken });
        if (!data) return NextResponse.json({ error: 'Orçamento não encontrado.' }, { status: 404 });

        return NextResponse.json({
            public_token: data.publicToken,
            public_url: `${appUrl}/orcamento/${data.publicToken}`,
        });
    } catch (e: any) {
        return apiError(e);
    }
}
