import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { db } from '@/lib/db';
import { expenses } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';
import { ownsSale } from '@/lib/authz';

export async function POST(req: Request, { params }: { params: { saleId: string } }) {
    try {
        const caller = await getCaller();
        if (!caller) {
            return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
        }

        const { message } = await req.json();
        if (!message?.trim()) {
            return NextResponse.json({ error: 'Mensagem não pode ser vazia.' }, { status: 400 });
        }

        if (!(await ownsSale(caller, params.saleId))) {
            return NextResponse.json({ error: 'Não encontrado.' }, { status: 404 });
        }

        await db.insert(expenses).values({
            organizationId: caller.organizationId!,
            saleId: params.saleId,
            description: `⚠️ Relato de ${caller.fullName || 'marceneiro'}: ${message.trim()}`,
            amount: '0',
            expenseType: 'Direct',
        });

        return NextResponse.json({ message: 'Relato registrado com sucesso.' });
    } catch (error: any) {
        return apiError(error);
    }
}
