import bcrypt from 'bcryptjs';

// Custo único para todo hash novo. Hashes legados (cost 10) são promovidos
// no primeiro login bem-sucedido — ver `needsRehash` em auth.ts.
export const BCRYPT_COST = 12;

export const MIN_PASSWORD_LENGTH = 10;

export function hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_COST);
}

// Hash de uma senha aleatória, no mesmo custo dos hashes reais. Comparar contra
// ele quando o e-mail não existe iguala o tempo de resposta e impede enumeração
// de usuários por timing.
export const DUMMY_HASH = '$2b$12$FFjHCqvedfaRiDUoZ4ITser4wDftk5.UvN8vA7YBfnxALo9MsVQS6';

// `$2b$12$...` -> 12
export function hashCost(hash: string): number {
    const parts = hash.split('$');
    return Number(parts[2]) || 0;
}

export function needsRehash(hash: string): boolean {
    return hashCost(hash) < BCRYPT_COST;
}

// Piso de duração do login. Só igualar o custo do bcrypt não basta: hashes
// legados (cost 10) são mais rápidos que o DUMMY_HASH (cost 12), e a diferença
// volta a revelar quais e-mails existem. Segurar toda tentativa por um tempo
// fixo elimina o canal, independentemente do custo do hash.
const LOGIN_FLOOR_MS = 700;

export async function withLoginFloor<T>(fn: () => Promise<T>): Promise<T> {
    const started = Date.now();
    try {
        return await fn();
    } finally {
        const remaining = LOGIN_FLOOR_MS - (Date.now() - started);
        if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
    }
}
