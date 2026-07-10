# RLS multi-tenant no Fresa — procedimento (NÃO aplicado)

> **Status: escrito e testado no banco de dev, deliberadamente NÃO habilitado.**
> Ligar a RLS hoje seria um **placebo**: a aplicação conecta como `marcenaria_user`,
> que é `SUPERUSER` com `rolbypassrls = true` — e superusuário **ignora toda policy**.

## A prova (rodada no banco de dev, dentro de uma transação revertida)

Com RLS habilitada em `clients` e uma policy exigindo `app.current_org`:

```
superuser (bypassrls): 12 de 12 linhas visíveis SEM app.current_org
papel comum:            0 linhas visíveis SEM app.current_org
```

Ou seja: enquanto o app conectar como `marcenaria_user`, habilitar RLS **não muda nada**,
e ainda cria a impressão perigosa de que o multi-tenant está protegido no banco.

## Os dois pré-requisitos

### 1. Um papel de aplicação sem superpoderes

```sql
CREATE ROLE fresa_app LOGIN PASSWORD '<senha forte>' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
GRANT USAGE ON SCHEMA public TO fresa_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO fresa_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO fresa_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fresa_app;
```

E então `DATABASE_URL` passa a usar `fresa_app`. **`marcenaria_user` continua sendo o dono**
das tabelas e o usuário das migrations (`db:push`) — quem roda migration precisa contornar a RLS.

### 2. Toda query precisa carregar a organização

A policy lê `current_setting('app.current_org')`. Esse GUC é **por conexão**, e o `pg.Pool`
reaproveita conexões entre requisições — logo, não basta setar no `connect`. Cada requisição
precisaria rodar dentro de uma transação:

```ts
await db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL app.current_org = ${caller.organizationId}`);
    // ...todas as queries da requisição usando `tx`
});
```

Hoje os handlers usam `db` diretamente, fora de transação. Migrar todos exige tocar cada rota
e revalidar o comportamento — é a razão de isto não ter sido feito junto com o resto da
remediação: aplicar a RLS sem esse passo faz **toda query retornar zero linhas** (fail-closed),
derrubando o sistema inteiro.

## A migration (quando os dois pré-requisitos estiverem prontos)

18 tabelas têm `organization_id`:
`architects`, `audit_logs`, `budgets`, `calendar_events`, `clients`, `commissions`, `expenses`,
`installments`, `inventory`, `kanban_stages`, `price_table_items`, `profiles`, `project_files`,
`project_messages`, `purchases`, `sales`, `stock_movements`, `suppliers`.

```sql
-- Para cada tabela com organization_id:
ALTER TABLE <tabela> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <tabela> FORCE ROW LEVEL SECURITY;  -- aplica até ao dono da tabela

CREATE POLICY org_isolation ON <tabela>
    USING (organization_id::text = current_setting('app.current_org', true))
    WITH CHECK (organization_id::text = current_setting('app.current_org', true));
```

`budget_environments` e `budget_items` **não têm** `organization_id`: a policy precisa navegar
até `budgets`.

```sql
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON budget_items
    USING (EXISTS (
        SELECT 1 FROM budgets b
        WHERE b.id = budget_items.budget_id
          AND b.organization_id::text = current_setting('app.current_org', true)
    ));
```

O `sysadmin` (que hoje enxerga todas as organizações) precisaria de um GUC próprio,
ex.: `current_setting('app.is_sysadmin', true) = 'on'` como cláusula alternativa na policy.

## Enquanto isso

A autorização está garantida na aplicação por `lib/authz.ts` (`scopedTo`, `ownsSale`,
`ownsBudget`), aplicado nas 17 rotas que vazavam. A RLS seria a **segunda** camada — a que
transforma um esquecimento futuro em "nenhuma linha" em vez de vazamento cross-tenant.
Continua sendo o item de maior valor estrutural pendente.
