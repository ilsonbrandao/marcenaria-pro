import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { unstable_noStore as noStore } from 'next/cache';
import { eq, asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { budgets, budgetEnvironments, budgetItems, organizations, profiles } from '@/lib/db/schema';
import { isUuid } from '@/lib/authz';
import { snakeKeys, snakeRows } from '@/lib/case';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { token: string } }) {
    noStore();
    try {
        if (!isUuid(params.token)) {
            return NextResponse.json({ error: 'Orçamento não encontrado.' }, { status: 404 });
        }

        const [budget] = await db
            .select({
                id: budgets.id,
                organization_id: budgets.organizationId,
                created_by: budgets.createdBy,
                client_name: budgets.clientName,
                client_address: budgets.clientAddress,
                budget_number: budgets.budgetNumber,
                payment_type: budgets.paymentType,
                total_prazo: budgets.totalPrazo,
                total_avista: budgets.totalAvista,
                prazo_entry_percent: budgets.prazoEntryPercent,
                prazo_installments: budgets.prazoInstallments,
                avista_discount_percent: budgets.avistaDiscountPercent,
                avista_entry_percent: budgets.avistaEntryPercent,
                observations: budgets.observations,
                status: budgets.status,
                created_at: budgets.createdAt,
                updated_at: budgets.updatedAt,
            })
            .from(budgets)
            .where(eq(budgets.publicToken, params.token))
            .limit(1);

        if (!budget) {
            return NextResponse.json({ error: 'Orçamento não encontrado.' }, { status: 404 });
        }

        const [org] = await db
            .select({
                name: organizations.name,
                company_name: organizations.companyName,
                cnpj: organizations.cnpj,
                phone: organizations.phone,
                email: organizations.email,
                address: organizations.address,
                owner_name: organizations.ownerName,
                logo_url: organizations.logoUrl,
                budget_validity_days: organizations.budgetValidityDays,
            })
            .from(organizations)
            .where(eq(organizations.id, budget.organization_id))
            .limit(1);

        let createdByName: string | null = null;
        if (budget.created_by) {
            const [creator] = await db.select({ fullName: profiles.fullName })
                .from(profiles).where(eq(profiles.id, budget.created_by)).limit(1);
            createdByName = creator?.fullName || null;
        }

        const environments = await db.select().from(budgetEnvironments)
            .where(eq(budgetEnvironments.budgetId, budget.id))
            .orderBy(asc(budgetEnvironments.position));

        const items = await db
            .select({
                id: budgetItems.id,
                environment_id: budgetItems.environmentId,
                description: budgetItems.description,
                qty: budgetItems.qty,
                alt_cm: budgetItems.altCm,
                larg_cm: budgetItems.largCm,
                prof_cm: budgetItems.profCm,
                price_prazo_m2: budgetItems.pricePrazoM2,
                price_avista_m2: budgetItems.priceAvistaM2,
                value_prazo: budgetItems.valuePrazo,
                value_avista: budgetItems.valueAvista,
                is_active: budgetItems.isActive,
                position: budgetItems.position,
            })
            .from(budgetItems)
            .where(eq(budgetItems.budgetId, budget.id))
            .orderBy(asc(budgetItems.position));

        return NextResponse.json({
            ...budget,
            org: org || null,
            created_by_name: createdByName,
            environments: environments.map((env) => ({
                ...snakeKeys(env),
                items: items.filter((i) => i.environment_id === env.id),
            })),
        }, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate',
                'Pragma': 'no-cache',
                'Surrogate-Control': 'no-store',
            },
        });
    } catch (e: any) {
        return apiError(e);
    }
}
