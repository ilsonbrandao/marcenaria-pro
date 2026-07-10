# PROMPT DE AUDITORIA E HARDENING — FRESA
### Personalizado a partir de `prompt-seguranca-web.md` para a realidade atual do Fresa (2026-07)
> Base: OWASP Top 10:2025 (Web) + OWASP API Security Top 10 + LGPD. **Sem seção mobile e sem seção IA/LLM** (o sistema não é app nativo nem usa LLM). Foco no que este stack realmente expõe.

---

## COMO USAR

1. Cole este arquivo inteiro no **Claude Code** apontado para `C:\Users\ilson\proj\fresa`.
2. Modo padrão: **[C] AMBOS** — audita o existente e entrega o blueprint do que falta.
3. Para profundidade, rode **por camada** (uma rodada só de API/BOLA, outra só de infra/segredos) — ou dispare os **agentes da seção 8** em paralelo.
4. Regra de ouro: **provar com evidência** (`arquivo:linha`, requisição, cenário), classificar por severidade e entregar **correção pronta pra colar** no stack.

---

## 1. PAPEL

Você é engenheiro sênior de AppSec (ofensivo + defensivo), domina OWASP, LGPD, Next.js/Auth.js, Drizzle/Postgres, Docker/Coolify e segurança de segredos/backup. Encontre, priorize e corrija fraquezas reais. Não assuma que algo é seguro por "funcionar": prove.

---

## 2. CONTEXTO DO SISTEMA (Fresa — já preenchido)

- **Nome:** Fresa (ex-"Marcenaria Pro"). Gestão de marcenaria: orçamentos, vendas, estoque, financeiro, comissões.
- **Tipo:** Web responsivo (SaaS multi-organização, single-DB).
- **Front:** Next.js 14.2 (App Router) + React 18 + TypeScript.
- **Back:** Next.js Route Handlers (`app/api/**`).
- **Banco:** PostgreSQL (imagem `pgvector/pgvector:pg17`) + Drizzle ORM 0.45 + `pg` (Pool). pgvector presente mas **não usado** (sem colunas `vector`).
- **Auth:** Auth.js v5 **beta** (`next-auth ^5.0.0-beta.31`), provider **Credentials**, senha com **bcryptjs**, sessão **JWT** (cookie httpOnly), roles: `sysadmin`/`owner`/`office`/`seller`/`carpenter`.
- **Infra/Deploy:** DigitalOcean droplet `174.138.37.200` + Docker + **Coolify v4.1.1** + build **Nixpacks** (Node 20), push na `main` → rebuild automático. **Sem Dockerfile** no repo.
- **Storage:** DigitalOcean Spaces (S3) `apps-storage` — **bucket compartilhado entre os 4 produtos do droplet**.
- **IA/LLM:** **Não usa.**
- **Dados sensíveis (LGPD):** CPF/CNPJ, telefone, email, endereço de clientes/organizações/perfis/fornecedores; preços, comissões, financeiro. **Sem dados de menores/saúde/pagamento com cartão.**
- **Exposição:** Internet pública. Banco de prod **privado** (sem porta pública). Banco de **dev local** na porta **5435** (`docker-compose.dev.yml`, credenciais `dev_local` hardcoded — só local).
- **Domínio:** ainda em `http://fresa.174.138.37.200.sslip.io` — **HTTP, sem HTTPS/domínio próprio ainda**.
- **Backup:** cron diário no droplet (`03:20`) → `s3://fresa-backups` (nyc3, privado), retenção 7d local / 30d remota.

---

## 3. MODO: [C] AMBOS (auditar existente + blueprint do que falta).

---

## 4. ESCOPO — priorizado para o Fresa

Para cada item: **OK / Vulnerável / Não verificável** + (se vulnerável) **impacto + correção pronta pra colar**.

### 4.1 — A01 Broken Access Control / API BOLA *(PRIORIDADE MÁXIMA neste sistema)*
Sistema é **multi-tenant por `organizationId` com scoping MANUAL em cada query** (sem RLS no Postgres) → toda rota que consulta por ID de path precisa confirmar que o objeto pertence à org do caller. Verifique **cada** handler em `app/api/**`:
- **Middleware só cobre páginas** (`matcher: ['/dashboard/:path*','/login']`) — **NÃO cobre `/api/*`**. Cada rota depende do próprio `getCaller()` (`lib/auth-helpers.ts`). Confirme que **toda** rota chama e valida.
- **Suspeitos já mapeados de IDOR cross-tenant** (validar e corrigir): `sales/[saleId]/{files,advance,notes,close}`, `budgets/[budgetId]/items` — mutam/leem por ID de path **sem checar `organizationId`**.
- **Endpoints públicos sem sessão** (por design, mas revisar): `api/public/budget/[token]` (GET) e **`api/public/budget/[token]/update` (PATCH que MUTA sem auth)** — só o token UUID. Avaliar: rate limit, escopo mínimo do que o PATCH pode alterar, expiração/revogação do token.
- IDOR clássico, escalonamento horizontal/vertical, rotas `sysadmin` (`admin/stats`, `organizations/[orgId]/counts`), SSRF.

### 4.2 — A05 Injection / XSS
- Drizzle parametrizado em toda a app (bom). Confirme que não surgiu `sql.raw`/concatenação com input.
- XSS: sem `dangerouslySetInnerHTML` hoje — garanta que continue; revise saída de PDF/relatórios (`jspdf`, `reports`, `bi`).

### 4.3 — A07 Authentication Failures
- **`next-auth` em BETA** — avaliar risco/plano de pin/upgrade.
- Sessão JWT **sem `maxAge` explícito** (usa 30 dias default) → definir expiração adequada.
- **Troca de senha (`api/me/password`) NÃO exige senha antiga** e aceita mínimo 6 chars → corrigir.
- **`api/invite` retorna a senha temporária em TEXTO CLARO no JSON** → repensar fluxo (link de definição de senha).
- Rate limit / lockout em login, reset e no PATCH público (hoje inexistente). Enumeração de usuário na mensagem de login.
- Política de senha (hoje 6 chars) e bcrypt cost (hoje 10) — avaliar.

### 4.4 — A02/4.7 Misconfiguration, Segredos, Infra, Backup, Domínio
- **`next.config.js` sem NENHUM header de segurança** (sem CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) e sem `images.remotePatterns` → entregar bloco `headers()` pronto.
- **Domínio em HTTP `*.sslip.io`** → blueprint: domínio próprio + HTTPS Let's Encrypt no Coolify, redirect 80→443, HSTS. (TODO já aberto em `docs/marcenaria-pro-deploy-coolify.md`.)
- **TLS do Postgres com `rejectUnauthorized:false`** (`lib/db/index.ts`) → avaliar validação de cert.
- **Segredos:** varrer histórico do Git (`git log -p | grep`) por `AUTH_SECRET`/`SPACES_SECRET`/senha de banco; confirmar `.gitignore` (`.env*`, `*.secret.md`, `backups/`, `*.dump`, `*.sql`). **`build_error.log` NÃO está coberto** (`.gitignore` só pega `build_out*.log`) e há `out.txt`/logs de build no working tree → checar se vazam segredos e ignorar/remover.
- **`docs/marcenaria-pro-deploy-coolify.md` versionado** cita IP, portas (80/443/8000/6001/6002), webhook GitHub→Coolify, project ref Supabase legado → revisar o que é sensível num repo **público** (`github.com/ilsonbrandao/marcenaria-pro`).
- **Storage compartilhado** (`apps-storage` entre 4 produtos): checar isolamento por prefixo (`{orgId}/...`, `logos/{orgId}/...`) e ACL — um produto não deve ler/apagar objeto de outro.
- **Backup:** validar que o cron `03:20` roda e sobe (log `fim OK`, ~58KB; **~400B = alerta de banco vazio**), restauração testada, bucket privado. **Pendência real: rotacionar a chave `fresa-backups-rw`** (a secret transitou por sessão do assistente) — ver `acessos.secret.md §10`.
- **Banco dev local (5435):** credenciais `dev_local` hardcoded no `docker-compose.dev.yml` versionado — confirmar que só serve local e que `.env.local` (com `SPACES_*` reais) **não** aponta ações destrutivas ao bucket de prod.
- **CI/CD Coolify:** push na `main` rebuilda direto em prod (sem staging/branch protection) → avaliar branch protection e ambiente de staging.

### 4.5 — A09 Logging / A10 Exceptional Conditions
- Handlers retornam **`e.message` cru ao cliente** em vários `catch` (ex.: `public/budget/[token]/route.ts:104`, `clients`) → padronizar erro genérico + log server-side.
- `auditLogs` guarda `oldData/newData/ipAddress/userId` — confirmar que eventos de auth/permissão são logados e que não grava segredo.

### 4.6 — LGPD (proteção de dados)
- Cifra em trânsito (resolver HTTP→HTTPS acima) e acesso mínimo ao banco.
- Vazamento por caminhos indiretos: logs de build, respostas de API (`invite`, `e.message`), URLs assinadas do Spaces, backups.
- Direitos do titular (acesso/exclusão) e retenção — mapear onde CPF/CNPJ é exposto (o endpoint público de orçamento devolve CNPJ/endereço/telefone da organização).

---

## 5. METODOLOGIA
Reconhecimento → análise por camada → priorização (Crítica/Alta/Média/Baixa × facilidade) → remediação concreta → defesa em profundidade.

## 6. FORMATO DE SAÍDA
**A)** Resumo executivo (3–5 linhas + contagem por severidade). **B)** Tabela de achados (`# | Sev | OWASP | arquivo/endpoint | descrição | como explorar | correção`). **C)** Correções detalhadas dos Crítico/Alto com trecho pronto pra colar (Next.js/Auth.js/Drizzle/Coolify). **D)** Checklist `[ ]` de hardening por prioridade. **E)** Quick wins (3–5 de maior impacto e menor esforço hoje).

## 7. REGRAS
Só defensivo; sem exploit ofensivo pronto. Sem teste destrutivo em produção (sugerir no banco dev local/staging). Faltou dado → "**Não verificável — preciso de X**". Específico ao stack. Prioridade: o que expõe mais com menor esforço de correção vem primeiro.

---

## 8. AGENTES PARA ACELERAR (rodar em paralelo)

Definições em `.claude/agents/` (criadas junto). Dispare os 4 de reconhecimento em paralelo; cada um devolve **só fatos com `arquivo:linha`**, depois você consolida o relatório da seção 6.

| Agente | Foco | Entregável |
|---|---|---|
| `fresa-sec-access` | A01/BOLA: varre `app/api/**`, confirma `getCaller()` + scoping `organizationId` em cada handler | Matriz rota × (auth? role? scoping org?) + lista de IDOR |
| `fresa-sec-secrets` | Segredos/infra: histórico do Git, `.gitignore`, logs de build, docs versionadas, backup, domínio | Lista de segredos expostos + gaps de infra |
| `fresa-sec-authcrypto` | Auth/sessão/cripto: `auth.ts`/`auth.config.ts`, maxAge, troca de senha, invite, bcrypt, TLS do Postgres | Achados de autenticação/cripto |
| `fresa-sec-headers` | Config/headers/XSS/LGPD: `next.config.js`, CSP/headers, `e.message` vazando, exposição de PII | Gaps de config + pontos de vazamento |

> Todos são **read-only de reconhecimento** (não corrigem). A correção você entrega no relatório final, com aprovação humana antes de qualquer mudança em produção.

---
## FIM
