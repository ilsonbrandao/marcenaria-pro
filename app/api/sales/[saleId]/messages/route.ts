import { NextResponse } from 'next/server';
import { eq, asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projectMessages, profiles } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';
import { snakeKeys } from '@/lib/case';

function reshape(row: any) {
    const { p_id, p_full_name, p_avatar_url, p_role, ...msg } = row;
    return {
        ...snakeKeys(msg),
        profiles: p_id ? { id: p_id, full_name: p_full_name, avatar_url: p_avatar_url, role: p_role } : null,
    };
}

const baseSelect = {
    id: projectMessages.id,
    organizationId: projectMessages.organizationId,
    saleId: projectMessages.saleId,
    profileId: projectMessages.profileId,
    message: projectMessages.message,
    createdAt: projectMessages.createdAt,
    p_id: profiles.id,
    p_full_name: profiles.fullName,
    p_avatar_url: profiles.avatarUrl,
    p_role: profiles.role,
};

export async function GET(req: Request, { params }: { params: { saleId: string } }) {
    try {
        const caller = await getCaller();
        if (!caller) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

        const rows = await db.select(baseSelect)
            .from(projectMessages)
            .leftJoin(profiles, eq(profiles.id, projectMessages.profileId))
            .where(eq(projectMessages.saleId, params.saleId))
            .orderBy(asc(projectMessages.createdAt));

        return NextResponse.json(rows.map(reshape));
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request, { params }: { params: { saleId: string } }) {
    try {
        const caller = await getCaller();
        if (!caller) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

        const { message } = await req.json();
        if (!message?.trim()) return NextResponse.json({ error: 'Mensagem vazia.' }, { status: 400 });

        const [inserted] = await db.insert(projectMessages).values({
            organizationId: caller.organizationId!,
            saleId: params.saleId,
            profileId: caller.id,
            message: message.trim(),
        }).returning({ id: projectMessages.id });

        const [row] = await db.select(baseSelect)
            .from(projectMessages)
            .leftJoin(profiles, eq(profiles.id, projectMessages.profileId))
            .where(eq(projectMessages.id, inserted.id))
            .limit(1);

        return NextResponse.json(reshape(row));
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
