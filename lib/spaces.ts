import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// DigitalOcean Spaces é compatível com S3.
// Env: SPACES_ENDPOINT (ex: https://nyc3.digitaloceanspaces.com), SPACES_REGION (ex: nyc3),
//      SPACES_BUCKET, SPACES_KEY, SPACES_SECRET, e opcional SPACES_PUBLIC_BASE.
const endpoint = process.env.SPACES_ENDPOINT || '';
const region = process.env.SPACES_REGION || 'us-east-1';
const bucket = process.env.SPACES_BUCKET || '';

export const spaces = new S3Client({
    endpoint,
    region,
    credentials: {
        accessKeyId: process.env.SPACES_KEY || '',
        secretAccessKey: process.env.SPACES_SECRET || '',
    },
    forcePathStyle: false,
});

export const SPACES_BUCKET = bucket;

// URL pública (objetos com ACL public-read). Deriva de SPACES_PUBLIC_BASE ou do endpoint+bucket.
export function publicUrl(key: string): string {
    if (process.env.SPACES_PUBLIC_BASE) return `${process.env.SPACES_PUBLIC_BASE}/${key}`;
    // endpoint = https://<region>.digitaloceanspaces.com → https://<bucket>.<region>.digitaloceanspaces.com/<key>
    const host = endpoint.replace(/^https?:\/\//, '');
    return `https://${bucket}.${host}/${key}`;
}

export async function uploadObject(key: string, body: Buffer | Uint8Array, contentType: string, isPublic = false) {
    await spaces.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ACL: isPublic ? 'public-read' : 'private',
    }));
}

export async function deleteObject(key: string) {
    await spaces.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export async function signedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    return getSignedUrl(spaces, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn });
}
