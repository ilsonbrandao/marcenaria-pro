import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { and, eq, gte, lte, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { commissions, profiles, sales } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';

const MANAGER = ['sysadmin', 'owner', 'office'];

export async function GET(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

        const url = new URL(req.url);
        const status = url.searchParams.get('status');
        const type = url.searchParams.get('type');
        const month = url.searchParams.get('month');

        const conds = [];
        if (caller.role !== 'sysadmin') conds.push(eq(commissions.organizationId, caller.organizationId!));
        if (!MANAGER.includes(caller.role)) conds.push(eq(commissions.profileId, caller.id));
        if (status && status !== 'all') conds.push(eq(commissions.status, status));
        if (type && type !== 'all') conds.push(eq(commissions.commissionType, type));
        if (month && month !== 'all') {
            const [y, m] = month.split('-');
            const from = `${y}-${m}-01`;
            const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
            const to = `${y}-${m}-${lastDay}T23:59:59`;
            conds.push(gte(commissions.createdAt, from));
            conds.push(lte(commissions.createdAt, to));
        }

        const rows = await db
            .select({
                id: commissions.id,
                sale_id: commissions.saleId,
                profile_id: commissions.profileId,
                commission_type: commissions.commissionType,
                base_amount: commissions.baseAmount,
                percent: commissions.percent,
                amount: commissions.amount,
                status: commissions.status,
                paid_at: commissions.paidAt,
                notes: commissions.notes,
                created_at: commissions.createdAt,
                p_full_name: profiles.fullName,
                p_role: profiles.role,
                s_client_name: sales.clientName,
                s_total_value: sales.totalValue,
            })
            .from(commissions)
            .leftJoin(profiles, eq(profiles.id, commissions.profileId))
            .leftJoin(sales, eq(sales.id, commissions.saleId))
            .where(conds.length ? and(...conds) : undefined)
            .orderBy(desc(commissions.createdAt));

        const data = rows.map((r) => ({
            id: r.id, sale_id: r.sale_id, profile_id: r.profile_id, commission_type: r.commission_type,
            base_amount: Number(r.base_amount), percent: Number(r.percent), amount: Number(r.amount),
            status: r.status, paid_at: r.paid_at, notes: r.notes, created_at: r.created_at,
            profiles: { full_name: r.p_full_name, role: r.p_role },
            sales: { client_name: r.s_client_name, total_value: Number(r.s_total_value) },
        }));
        return NextResponse.json(data);
    } catch (e: any) {
        return apiError(e);
    }
}

export async function PATCH(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller || !MANAGER.includes(caller.role)) {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }
        const { id } = await req.json();
        if (!id) return NextResponse.json({ error: 'ID é obrigatório.' }, { status: 400 });

        const cond = caller.role === 'sysadmin'
            ? eq(commissions.id, id)
            : and(eq(commissions.id, id), eq(commissions.organizationId, caller.organizationId!));
        await db.update(commissions).set({ status: 'paid', paidAt: new Date().toISOString() }).where(cond);
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return apiError(e);
    }
}
