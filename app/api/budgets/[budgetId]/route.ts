import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { recalcTotals } from '@/lib/budget-recalc';

async function getCallerProfile(req: Request) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return null;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) return null;
    const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', user.id).single();
    return profile;
}

export async function GET(req: Request, { params }: { params: { budgetId: string } }) {
    try {
        const caller = await getCallerProfile(req);
        if (!caller || caller.role === 'carpenter') {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }

        const { data: budget, error } = await supabaseAdmin
            .from('budgets')
            .select('*')
            .eq('id', params.budgetId)
            .single();
        if (error) throw error;

        const { data: environments } = await supabaseAdmin
            .from('budget_environments')
            .select('*')
            .eq('budget_id', params.budgetId)
            .order('position');

        const { data: items } = await supabaseAdmin
            .from('budget_items')
            .select('*')
            .eq('budget_id', params.budgetId)
            .order('position');

        // Nome do usuário que elaborou o orçamento (responsável)
        let createdByName: string | null = null;
        if ((budget as any).created_by) {
            const { data: creator } = await supabaseAdmin
                .from('profiles')
                .select('full_name')
                .eq('id', (budget as any).created_by)
                .single();
            createdByName = creator?.full_name || null;
        }

        return NextResponse.json({
            ...budget,
            created_by_name: createdByName,
            environments: (environments || []).map(env => ({
                ...env,
                items: (items || []).filter(i => i.environment_id === env.id),
            })),
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function PUT(req: Request, { params }: { params: { budgetId: string } }) {
    try {
        const caller = await getCallerProfile(req);
        if (!caller || caller.role === 'carpenter') {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }

        const body = await req.json();
        const allowed = [
            'client_name', 'client_address', 'payment_type',
            'prazo_entry_percent', 'prazo_installments',
            'avista_discount_percent', 'avista_entry_percent',
            'observations', 'status', 'sale_id',
        ];
        const updates: any = { updated_at: new Date().toISOString() };
        for (const key of allowed) {
            if (body[key] !== undefined) updates[key] = body[key];
        }

        // Se aprovado, criar sale vinculada (se não tiver)
        if (body.status === 'approved') {
            const { data: existing } = await supabaseAdmin
                .from('budgets').select('sale_id, client_name, total_prazo').eq('id', params.budgetId).single();

            if (existing && !existing.sale_id) {
                const { data: sale } = await supabaseAdmin.from('sales').insert({
                    organization_id: caller.organization_id,
                    client_name:     existing.client_name,
                    total_value:     existing.total_prazo,
                    status:          'Orçamento',
                    seller_id:       caller.id,
                }).select('id').single();

                if (sale) updates.sale_id = sale.id;
            }
        }

        const { data, error } = await supabaseAdmin
            .from('budgets')
            .update(updates)
            .eq('id', params.budgetId)
            .select().single();

        if (error) throw error;

        // Recalcula totais se o desconto à vista mudou
        if (body.avista_discount_percent !== undefined) {
            await recalcTotals(params.budgetId);
            const { data: refreshed } = await supabaseAdmin
                .from('budgets').select('*').eq('id', params.budgetId).single();
            return NextResponse.json(refreshed ?? data);
        }

        return NextResponse.json(data);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: { budgetId: string } }) {
    try {
        const caller = await getCallerProfile(req);
        if (!caller || !['sysadmin', 'owner', 'office'].includes(caller.role)) {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }

        const { error } = await supabaseAdmin.from('budgets').delete().eq('id', params.budgetId);
        if (error) throw error;
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
