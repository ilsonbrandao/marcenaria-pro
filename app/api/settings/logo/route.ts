import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { organizations } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';
import { uploadObject, publicUrl } from '@/lib/spaces';

export async function POST(req: Request) {
    const caller = await getCaller();
    if (!caller) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    if (!['owner', 'office', 'sysadmin'].includes(caller.role)) {
        return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 400 });

    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const key = `logos/${caller.organizationId}/logo.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    try {
        await uploadObject(key, bytes, file.type, true);
    } catch (e: any) {
        return apiError(e);
    }

    const logo_url = `${publicUrl(key)}?t=${Date.now()}`;
    await db.update(organizations).set({ logoUrl: logo_url }).where(eq(organizations.id, caller.organizationId!));

    return NextResponse.json({ logo_url });
}
