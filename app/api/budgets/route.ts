import { NextResponse } from 'next/server';
import { and, eq, ilike, desc, count } from 'drizzle-orm';
import { db } from '@/lib/db';
import { budgets, profiles } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';

export async function GET(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller || caller.role === 'carpenter') {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }

        const url = new URL(req.url);
        const status = url.searchParams.get('status');
        const search = url.searchParams.get('search');
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = 20;
        const offset = (page - 1) * limit;

        const conds = [];
        if (caller.role !== 'sysadmin') conds.push(eq(budgets.organizationId, caller.organizationId!));
        if (status) conds.push(eq(budgets.status, status));
        if (search) conds.push(ilike(budgets.clientName, `%${search}%`));
        const where = conds.length ? and(...conds) : undefined;

        const rows = await db
            .select({
                id: budgets.id,
                client_name: budgets.clientName,
                client_address: budgets.clientAddress,
                budget_number: budgets.budgetNumber,
                payment_type: budgets.paymentType,
                total_prazo: budgets.totalPrazo,
                total_avista: budgets.totalAvista,
                status: budgets.status,
                created_at: budgets.createdAt,
                updated_at: budgets.updatedAt,
                created_by: budgets.createdBy,
                full_name: profiles.fullName,
            })
            .from(budgets)
            .leftJoin(profiles, eq(profiles.id, budgets.createdBy))
            .where(where)
            .orderBy(desc(budgets.createdAt))
            .limit(limit)
            .offset(offset);

        const [{ value: total }] = await db.select({ value: count() }).from(budgets).where(where);

        const data = rows.map(({ full_name, ...b }) => ({ ...b, profiles: { full_name } }));
        return NextResponse.json({ data, total, page, limit });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller || caller.role === 'carpenter') {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }

        const body = await req.json();
        const {
            client_id, client_name, client_address,
            payment_type, prazo_entry_percent, prazo_installments,
            avista_discount_percent, avista_entry_percent, observations,
        } = body;

        if (!client_name?.trim()) return NextResponse.json({ error: 'Nome do cliente é obrigatório.' }, { status: 400 });

        const orgId = caller.organizationId!;
        const year = new Date().getFullYear();
        const [{ value: existing }] = await db
            .select({ value: count() })
            .from(budgets)
            .where(eq(budgets.organizationId, orgId));

        const budgetNumber = `ORÇ-${year}-${String((existing ?? 0) + 1).padStart(3, '0')}`;

        const [data] = await db.insert(budgets).values({
            organizationId: orgId,
            clientId: client_id || null,
            clientName: client_name.trim(),
            clientAddress: client_address || null,
            budgetNumber,
            paymentType: payment_type || 'both',
            prazoEntryPercent: String(prazo_entry_percent ?? 30),
            prazoInstallments: prazo_installments ?? 12,
            avistaDiscountPercent: String(avista_discount_percent ?? 10),
            avistaEntryPercent: String(avista_entry_percent ?? 50),
            observations: observations || null,
            createdBy: caller.id,
        }).returning();

        return NextResponse.json(data, { status: 201 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
