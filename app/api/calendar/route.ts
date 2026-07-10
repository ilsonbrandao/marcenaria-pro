import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { and, eq, gte, lte, or, asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { calendarEvents, profiles, sales } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';

const MANAGER = ['sysadmin', 'owner', 'office'];

export async function GET(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

        const url = new URL(req.url);
        const from = url.searchParams.get('from')!;
        const to = url.searchParams.get('to')!;

        const conds = [
            eq(calendarEvents.organizationId, caller.organizationId!),
            gte(calendarEvents.eventDate, from),
            lte(calendarEvents.eventDate, to),
        ];
        if (!MANAGER.includes(caller.role)) {
            conds.push(or(eq(calendarEvents.isPrivate, false), eq(calendarEvents.createdBy, caller.id))!);
        }

        const rows = await db
            .select({
                id: calendarEvents.id, title: calendarEvents.title, description: calendarEvents.description,
                event_type: calendarEvents.eventType, event_date: calendarEvents.eventDate, event_time: calendarEvents.eventTime,
                is_private: calendarEvents.isPrivate, color: calendarEvents.color, sale_id: calendarEvents.saleId,
                created_by: calendarEvents.createdBy, p_full_name: profiles.fullName, s_client_name: sales.clientName,
            })
            .from(calendarEvents)
            .leftJoin(profiles, eq(profiles.id, calendarEvents.createdBy))
            .leftJoin(sales, eq(sales.id, calendarEvents.saleId))
            .where(and(...conds))
            .orderBy(asc(calendarEvents.eventDate));

        return NextResponse.json(rows.map((r) => ({
            id: r.id, title: r.title, description: r.description, event_type: r.event_type,
            event_date: r.event_date, event_time: r.event_time, is_private: r.is_private, color: r.color,
            sale_id: r.sale_id, created_by: r.created_by,
            profiles: r.p_full_name ? { full_name: r.p_full_name } : null,
            sales: r.s_client_name ? { client_name: r.s_client_name } : null,
        })));
    } catch (e: any) {
        return apiError(e);
    }
}

export async function POST(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
        const b = await req.json();
        if (!b.title?.trim() || !b.event_date) return NextResponse.json({ error: 'Título e data são obrigatórios.' }, { status: 400 });

        const [data] = await db.insert(calendarEvents).values({
            organizationId: caller.organizationId!,
            createdBy: caller.id,
            title: b.title.trim(),
            description: b.description || null,
            eventType: b.event_type || 'delivery',
            eventDate: b.event_date,
            eventTime: b.event_time || null,
            isPrivate: !!b.is_private,
            color: b.color || '#6366f1',
            saleId: b.sale_id || null,
        }).returning({ id: calendarEvents.id });
        return NextResponse.json({ id: data.id }, { status: 201 });
    } catch (e: any) {
        return apiError(e);
    }
}

export async function PUT(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
        const b = await req.json();
        if (!b.id) return NextResponse.json({ error: 'ID é obrigatório.' }, { status: 400 });

        const updates: Record<string, any> = {};
        if (b.title !== undefined) updates.title = b.title;
        if (b.description !== undefined) updates.description = b.description;
        if (b.event_type !== undefined) updates.eventType = b.event_type;
        if (b.event_date !== undefined) updates.eventDate = b.event_date;
        if (b.event_time !== undefined) updates.eventTime = b.event_time || null;
        if (b.is_private !== undefined) updates.isPrivate = b.is_private;
        if (b.color !== undefined) updates.color = b.color;

        await db.update(calendarEvents).set(updates)
            .where(and(eq(calendarEvents.id, b.id), eq(calendarEvents.organizationId, caller.organizationId!)));
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return apiError(e);
    }
}

export async function DELETE(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
        const id = new URL(req.url).searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID não fornecido.' }, { status: 400 });

        await db.delete(calendarEvents)
            .where(and(eq(calendarEvents.id, id), eq(calendarEvents.organizationId, caller.organizationId!)));
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return apiError(e);
    }
}
