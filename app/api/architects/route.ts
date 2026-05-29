import { NextResponse } from 'next/server';
import { and, eq, asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { architects, sales } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';
import { snakeRows } from '@/lib/case';

export async function GET() {
    try {
        const caller = await getCaller();
        if (!caller) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

        const orgCond = caller.role === 'sysadmin' ? undefined : eq(architects.organizationId, caller.organizationId!);
        const rows = await db.select().from(architects).where(orgCond).orderBy(asc(architects.name));

        const salesCond = caller.role === 'sysadmin' ? undefined : eq(sales.organizationId, caller.organizationId!);
        const salesRows = await db
            .select({ architectId: sales.architectId, totalValue: sales.totalValue, rtPercent: sales.rtArchitectPercent })
            .from(sales).where(salesCond);

        const salesData: Record<string, { count: number; totalRT: number }> = {};
        for (const s of salesRows) {
            if (!s.architectId) continue;
            if (!salesData[s.architectId]) salesData[s.architectId] = { count: 0, totalRT: 0 };
            salesData[s.architectId].count += 1;
            salesData[s.architectId].totalRT += (Number(s.totalValue) * Number(s.rtPercent || 0)) / 100;
        }

        return NextResponse.json({
            architects: snakeRows(rows).map((a) => ({ ...a, default_rt_percent: Number(a.default_rt_percent) })),
            salesData,
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller || !['sysadmin', 'owner', 'office'].includes(caller.role)) {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }
        const b = await req.json();
        if (!b.name?.trim()) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });

        const [data] = await db.insert(architects).values({
            organizationId: caller.organizationId!,
            name: b.name.trim(),
            phone: b.phone || null,
            email: b.email || null,
            defaultRtPercent: String(b.default_rt_percent ?? 5),
            notes: b.notes || null,
        }).returning({ id: architects.id });
        return NextResponse.json({ id: data.id }, { status: 201 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller || !['sysadmin', 'owner', 'office'].includes(caller.role)) {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }
        const b = await req.json();
        if (!b.id) return NextResponse.json({ error: 'ID é obrigatório.' }, { status: 400 });

        const updates: Record<string, any> = {};
        if (b.name !== undefined) updates.name = b.name.trim();
        if (b.phone !== undefined) updates.phone = b.phone;
        if (b.email !== undefined) updates.email = b.email;
        if (b.default_rt_percent !== undefined) updates.defaultRtPercent = String(b.default_rt_percent);
        if (b.notes !== undefined) updates.notes = b.notes;

        const cond = caller.role === 'sysadmin'
            ? eq(architects.id, b.id)
            : and(eq(architects.id, b.id), eq(architects.organizationId, caller.organizationId!));
        await db.update(architects).set(updates).where(cond);
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller || !['sysadmin', 'owner', 'office'].includes(caller.role)) {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }
        const id = new URL(req.url).searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID não fornecido.' }, { status: 400 });

        const cond = caller.role === 'sysadmin'
            ? eq(architects.id, id)
            : and(eq(architects.id, id), eq(architects.organizationId, caller.organizationId!));
        await db.delete(architects).where(cond);
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
