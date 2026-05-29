// Converte as chaves de TOPO de um objeto de camelCase -> snake_case.
// Usado para manter o contrato das APIs (frontend espera snake_case) ao
// retornar linhas do Drizzle (que vêm em camelCase). Não recursa nos valores
// (preserva jsonb e dados arbitrários intactos).
function camelToSnake(key: string): string {
    return key.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
}

export function snakeKeys<T extends Record<string, any>>(row: T): Record<string, any> {
    const out: Record<string, any> = {};
    for (const k of Object.keys(row)) {
        out[camelToSnake(k)] = row[k];
    }
    return out;
}

export function snakeRows<T extends Record<string, any>>(rows: T[]): Record<string, any>[] {
    return rows.map(snakeKeys);
}
