import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { and, eq, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLogs, profiles } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';

const MANAGER = ['sysadmin', 'owner', 'office'];
const PAGE_SIZE = 30;

export async function GET(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller || !MANAGER.includes(caller.role)) {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }

        const url = new URL(req.url);
        const table = url.searchParams.get('table');
        const action = url.searchParams.get('action');
        const page = parseInt(url.searchParams.get('page') || '0');

        const conds = [];
        if (caller.role !== 'sysadmin') conds.push(eq(auditLogs.organizationId, caller.organizationId!));
        if (table && table !== 'all') conds.push(eq(auditLogs.tableName, table));
        if (action && action !== 'all') conds.push(eq(auditLogs.action, action));

        const rows = await db
            .select({
                id: auditLogs.id, table_name: auditLogs.tableName, record_id: auditLogs.recordId,
                action: auditLogs.action, old_data: auditLogs.oldData, new_data: auditLogs.newData,
                created_at: auditLogs.createdAt, p_full_name: profiles.fullName,
            })
            .from(auditLogs)
            .leftJoin(profiles, eq(profiles.id, auditLogs.userId))
            .where(conds.length ? and(...conds) : undefined)
            .orderBy(desc(auditLogs.createdAt))
            .limit(PAGE_SIZE)
            .offset(page * PAGE_SIZE);

        return NextResponse.json(rows.map((r) => ({
            id: r.id, table_name: r.table_name, record_id: r.record_id, action: r.action,
            old_data: r.old_data, new_data: r.new_data, created_at: r.created_at,
            profiles: r.p_full_name ? { full_name: r.p_full_name } : null,
        })));
    } catch (e: any) {
        return apiError(e);
    }
}
