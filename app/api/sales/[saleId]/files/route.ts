import { NextResponse } from 'next/server';
import { and, eq, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projectFiles, profiles } from '@/lib/db/schema';
import { getCaller } from '@/lib/auth-helpers';
import { uploadObject, deleteObject, signedDownloadUrl } from '@/lib/spaces';

export async function GET(req: Request, { params }: { params: { saleId: string } }) {
    try {
        const caller = await getCaller();
        if (!caller) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

        const rows = await db
            .select({
                id: projectFiles.id, file_name: projectFiles.fileName, file_path: projectFiles.filePath,
                file_type: projectFiles.fileType, created_at: projectFiles.createdAt,
                p_full_name: profiles.fullName,
            })
            .from(projectFiles)
            .leftJoin(profiles, eq(profiles.id, projectFiles.uploadedBy))
            .where(eq(projectFiles.saleId, params.saleId))
            .orderBy(desc(projectFiles.createdAt));

        const files = await Promise.all(rows.map(async (f) => ({
            id: f.id, file_name: f.file_name, file_path: f.file_path, file_type: f.file_type,
            created_at: f.created_at, profiles: f.p_full_name ? { full_name: f.p_full_name } : null,
            signed_url: await signedDownloadUrl(f.file_path, 3600).catch(() => null),
        })));

        return NextResponse.json(files);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request, { params }: { params: { saleId: string } }) {
    try {
        const caller = await getCaller();
        if (!caller) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        if (!file) return NextResponse.json({ error: 'Arquivo não enviado.' }, { status: 400 });

        const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
        const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const key = `project-files/${caller.organizationId || 'global'}/${params.saleId}/${safeName}`;

        const bytes = Buffer.from(await file.arrayBuffer());
        await uploadObject(key, bytes, file.type, false);

        const fileType = file.type.startsWith('image/') ? 'image' : ext === 'pdf' ? 'pdf' : 'other';
        const [inserted] = await db.insert(projectFiles).values({
            organizationId: caller.organizationId!,
            saleId: params.saleId,
            fileName: file.name,
            filePath: key,
            fileType,
            uploadedBy: caller.id,
        }).returning({ id: projectFiles.id, fileName: projectFiles.fileName, filePath: projectFiles.filePath, fileType: projectFiles.fileType, createdAt: projectFiles.createdAt });

        return NextResponse.json({
            id: inserted.id, file_name: inserted.fileName, file_path: inserted.filePath,
            file_type: inserted.fileType, created_at: inserted.createdAt,
            profiles: { full_name: caller.fullName },
            signed_url: await signedDownloadUrl(key, 3600).catch(() => null),
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: { saleId: string } }) {
    try {
        const caller = await getCaller();
        if (!caller || !['sysadmin', 'owner', 'office'].includes(caller.role)) {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }

        const fileId = new URL(req.url).searchParams.get('fileId');
        if (!fileId) return NextResponse.json({ error: 'fileId é obrigatório.' }, { status: 400 });

        const [file] = await db.select({ filePath: projectFiles.filePath })
            .from(projectFiles).where(eq(projectFiles.id, fileId)).limit(1);
        if (!file) return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 404 });

        await deleteObject(file.filePath).catch(() => {});
        await db.delete(projectFiles).where(eq(projectFiles.id, fileId));

        return NextResponse.json({ message: 'Arquivo removido.' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
