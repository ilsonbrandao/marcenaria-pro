import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { organizations } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';
import { snakeKeys } from '@/lib/case';

export async function GET() {
    const caller = await getCaller();
    if (!caller) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

    const [data] = await db
        .select({
            name: organizations.name,
            company_name: organizations.companyName,
            cnpj: organizations.cnpj,
            state_registration: organizations.stateRegistration,
            phone: organizations.phone,
            email: organizations.email,
            address: organizations.address,
            owner_name: organizations.ownerName,
            owner_cpf: organizations.ownerCpf,
            owner_phone: organizations.ownerPhone,
            logo_url: organizations.logoUrl,
            budget_validity_days: organizations.budgetValidityDays,
            default_payment_type: organizations.defaultPaymentType,
            default_prazo_entry_percent: organizations.defaultPrazoEntryPercent,
            default_prazo_installments: organizations.defaultPrazoInstallments,
            default_avista_discount_percent: organizations.defaultAvistaDiscountPercent,
            default_avista_entry_percent: organizations.defaultAvistaEntryPercent,
            default_budget_observations: organizations.defaultBudgetObservations,
        })
        .from(organizations)
        .where(eq(organizations.id, caller.organizationId!))
        .limit(1);

    return NextResponse.json(data ?? null);
}

export async function PUT(req: Request) {
    const caller = await getCaller();
    if (!caller) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    if (!['owner', 'office', 'sysadmin'].includes(caller.role)) {
        return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
    }

    const body = await req.json();
    const map: Record<string, string> = {
        name: 'name', company_name: 'companyName', cnpj: 'cnpj', state_registration: 'stateRegistration',
        phone: 'phone', email: 'email', address: 'address',
        owner_name: 'ownerName', owner_cpf: 'ownerCpf', owner_phone: 'ownerPhone',
        budget_validity_days: 'budgetValidityDays',
        default_payment_type: 'defaultPaymentType', default_prazo_entry_percent: 'defaultPrazoEntryPercent',
        default_prazo_installments: 'defaultPrazoInstallments', default_avista_discount_percent: 'defaultAvistaDiscountPercent',
        default_avista_entry_percent: 'defaultAvistaEntryPercent', default_budget_observations: 'defaultBudgetObservations',
    };
    const numeric = new Set(['default_prazo_entry_percent', 'default_avista_discount_percent', 'default_avista_entry_percent']);
    const updates: Record<string, any> = {};
    for (const key of Object.keys(map)) {
        if (body[key] !== undefined) updates[map[key]] = numeric.has(key) ? String(body[key]) : body[key];
    }

    await db.update(organizations).set(updates).where(eq(organizations.id, caller.organizationId!));
    return NextResponse.json({ ok: true });
}
