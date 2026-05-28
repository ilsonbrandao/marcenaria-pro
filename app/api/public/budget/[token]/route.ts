import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { token: string } }) {
    noStore();
    try {
        const { data: budget, error } = await supabaseAdmin
            .from('budgets')
            .select('id, organization_id, created_by, client_name, client_address, budget_number, payment_type, total_prazo, total_avista, prazo_entry_percent, prazo_installments, avista_discount_percent, avista_entry_percent, observations, status, created_at, updated_at')
            .eq('public_token', params.token)
            .single();

        if (error || !budget) {
            return NextResponse.json({ error: 'Orçamento não encontrado.' }, { status: 404 });
        }

        // Busca dados da organização para exibir no cabeçalho
        const { data: org } = await supabaseAdmin
            .from('organizations')
            .select('name, company_name, cnpj, phone, email, address, owner_name, logo_url, budget_validity_days')
            .eq('id', (budget as any).organization_id)
            .single();

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

        const { data: environments } = await supabaseAdmin
            .from('budget_environments')
            .select('*')
            .eq('budget_id', budget.id)
            .order('position');

        const { data: items } = await supabaseAdmin
            .from('budget_items')
            .select('id, environment_id, description, qty, alt_cm, larg_cm, prof_cm, price_prazo_m2, price_avista_m2, value_prazo, value_avista, is_active, position')
            .eq('budget_id', budget.id)
            .order('position');

        return NextResponse.json({
            ...budget,
            org: org || null,
            created_by_name: createdByName,
            environments: (environments || []).map(env => ({
                ...env,
                items: (items || []).filter(i => i.environment_id === env.id),
            })),
        }, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate',
                'Pragma': 'no-cache',
                'Surrogate-Control': 'no-store',
            },
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
