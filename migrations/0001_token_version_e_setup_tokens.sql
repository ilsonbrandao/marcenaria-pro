-- Migration para PRODUÇÃO — pré-requisito da branch `seguranca/remediacao-owasp`.
--
-- Sem isto, o código novo quebra no login: `getCaller()` e o provider Credentials
-- leem `profiles.token_version`.
--
-- É aditiva e idempotente: só cria coluna e tabela novas, com DEFAULT. Não altera
-- nem apaga dado existente. Pode rodar com a aplicação no ar (a ordem correta é
-- migration ANTES do deploy).
--
-- Aplicar (do droplet):
--   docker exec -i <container-fresa-db> psql -U marcenaria_user -d marcenaria -v ON_ERROR_STOP=1 < este_arquivo.sql

BEGIN;

-- 1) Revogação de sessão: incrementado a cada troca de senha. Sessões com um
--    token_version antigo são rejeitadas por getCaller().
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;

-- 2) Convite / redefinição por link de uso único. Guardamos só o SHA-256 do
--    token: vazou o banco, os links continuam inúteis.
CREATE TABLE IF NOT EXISTS password_setup_tokens (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     uuid NOT NULL,
    token_hash  text NOT NULL,
    expires_at  timestamptz NOT NULL,
    used_at     timestamptz,
    created_at  timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT password_setup_tokens_token_hash_key UNIQUE (token_hash),
    CONSTRAINT password_setup_tokens_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_password_setup_tokens_user
    ON password_setup_tokens USING btree (user_id);

COMMIT;

-- Verificação (deve devolver as duas linhas):
--   SELECT 'token_version' FROM information_schema.columns
--    WHERE table_name='profiles' AND column_name='token_version'
--   UNION ALL
--   SELECT 'password_setup_tokens' FROM information_schema.tables
--    WHERE table_name='password_setup_tokens';
