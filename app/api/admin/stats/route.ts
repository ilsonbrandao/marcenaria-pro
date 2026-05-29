import { NextResponse } from 'next/server';
import { count, gte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { organizations, profiles } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';

export async function GET() {
    try {
        const caller = await getCaller();
        if (!caller || caller.role !== 'sysadmin') {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }

        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);

        const [[orgs], [users], [recent]] = await Promise.all([
            db.select({ value: count() }).from(organizations),
            db.select({ value: count() }).from(profiles),
            db.select({ value: count() }).from(organizations).where(gte(organizations.createdAt, lastWeek.toISOString())),
        ]);

        return NextResponse.json({
            totalOrgs: orgs.value,
            totalUsers: users.value,
            recentOrgs: recent.value,
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
