import { NextResponse } from 'next/server';
import { eq, count } from 'drizzle-orm';
import { db } from '@/lib/db';
import { profiles, sales } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';

export async function GET(req: Request, { params }: { params: { orgId: string } }) {
    try {
        const caller = await getCaller();
        if (!caller || caller.role !== 'sysadmin') {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }
        const [[u], [s]] = await Promise.all([
            db.select({ value: count() }).from(profiles).where(eq(profiles.organizationId, params.orgId)),
            db.select({ value: count() }).from(sales).where(eq(sales.organizationId, params.orgId)),
        ]);
        return NextResponse.json({ users: u.value, sales: s.value });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
