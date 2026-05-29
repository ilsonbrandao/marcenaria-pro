import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { budgets } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function GET(req: Request, { params }: { params: { budgetId: string } }) {
    try {
        const caller = await getCaller();
        if (!caller || caller.role === 'carpenter') {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }

        const [data] = await db.select({ publicToken: budgets.publicToken })
            .from(budgets).where(eq(budgets.id, params.budgetId)).limit(1);
        if (!data) return NextResponse.json({ error: 'Orçamento não encontrado.' }, { status: 404 });

        return NextResponse.json({
            public_token: data.publicToken,
            public_url: `${appUrl}/orcamento/${data.publicToken}`,
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req: Request, { params }: { params: { budgetId: string } }) {
    try {
        const caller = await getCaller();
        if (!caller || caller.role === 'carpenter') {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }

        const [data] = await db.update(budgets).set({ publicToken: crypto.randomUUID() })
            .where(eq(budgets.id, params.budgetId)).returning({ publicToken: budgets.publicToken });

        return NextResponse.json({
            public_token: data.publicToken,
            public_url: `${appUrl}/orcamento/${data.publicToken}`,
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
