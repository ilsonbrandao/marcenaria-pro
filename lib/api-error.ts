import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Devolver `e.message` ao cliente vaza nomes de coluna, constraints e estrutura
// interna do Postgres. Logamos o erro completo no servidor e devolvemos só um id
// para correlacionar com o log.
export function apiError(error: unknown, status = 500): NextResponse {
    // O Next sinaliza "esta rota é dinâmica" lançando um erro durante o
    // prerender. Engoli-lo faz a rota virar um 500 em vez de dinâmica.
    const digest = (error as { digest?: string })?.digest;
    if (typeof digest === 'string' && digest.startsWith('DYNAMIC_SERVER_USAGE')) {
        throw error;
    }

    const requestId = crypto.randomUUID();
    console.error(`[${requestId}]`, error);
    return NextResponse.json({ error: 'Erro interno no servidor.', requestId }, { status });
}
