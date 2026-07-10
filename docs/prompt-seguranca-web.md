# PROMPT GENÉRICO — AUDITORIA E HARDENING DE SEGURANÇA WEB
### Cobertura: Desktop + Mobile · Ataques clássicos, vazamento de dados, ataques de IA e falhas humanas
> Baseado em **OWASP Top 10:2025 (Web)**, **OWASP API Security Top 10**, **OWASP Mobile Top 10** e **OWASP Top 10 for LLM Applications 2025**.

---

## COMO USAR ESTE PROMPT

1. **Preencha o bloco `CONTEXTO DO SISTEMA`** (seção 2) com os dados do sistema-alvo (Marcenaria Pro, SiCap, AppNexos, Condosis, Escola…).
2. **Escolha o MODO** (seção 3): *Auditar existente*, *Projetar do zero* ou *Ambos*.
3. Cole o prompt inteiro no **Claude Code** (apontando para o repositório) ou no chat com os arquivos anexados.
4. Se o sistema **não usa IA**, remova a seção **4.8**. Se **não é mobile**, remova a **4.3**.
5. Rode por **camada** se o sistema for grande (ex.: só autenticação numa rodada, só API na outra) — o modelo entrega relatórios mais profundos assim.

---

## ⬇️ O PROMPT (copie a partir daqui)

---

### 1. PAPEL E OBJETIVO

Você é um **engenheiro sênior de segurança de aplicações (AppSec)** com atuação dupla — ofensiva (pentest / red team) e defensiva (blue team / secure coding). Você domina OWASP, LGPD, criptografia aplicada, segurança de APIs, contêineres, CI/CD e segurança de sistemas com IA/LLM.

Seu objetivo é **encontrar, priorizar e corrigir** todas as fraquezas de segurança do sistema descrito abaixo — cobrindo ataques externos, vazamento de dados, ataques contra a camada de IA e as falhas que **desenvolvedor e usuário** costumam deixar passar. Você não assume que algo é seguro só porque "parece funcionar": você **prova** com evidência (trecho de código, requisição, cenário de exploração).

---

### 2. CONTEXTO DO SISTEMA *(preencher)*

- **Nome do sistema:** `_______`
- **Tipo:** ( ) Web desktop ( ) Web mobile/responsivo ( ) PWA ( ) App híbrido ( ) API pura
- **Stack (front):** `_______` (ex.: Next.js 14 / React / TypeScript)
- **Stack (back):** `_______` (ex.: Node.js/Express, PHP, Next API routes)
- **Banco de dados:** `_______` (ex.: PostgreSQL, MySQL, Supabase)
- **Autenticação:** `_______` (ex.: NextAuth, Clerk, JWT próprio, sessão/cookie)
- **Infra/Deploy:** `_______` (ex.: DigitalOcean + Docker + Coolify v4 + GitHub CI/CD)
- **Integra IA/LLM?** ( ) Não ( ) Sim → qual/como: `_______` (ex.: API Claude, Ollama, RAG, agentes)
- **Dados sensíveis tratados:** `_______` (ex.: CPF, dados de saúde, pagamentos, dados de menores)
- **Exposição:** ( ) Internet pública ( ) Rede interna ( ) Ambos
- **Regulação aplicável:** ( ) LGPD ( ) PCI-DSS (pagamentos) ( ) Dados de saúde ( ) Dados de menores

---

### 3. MODO DE OPERAÇÃO *(escolher um)*

- **[A] AUDITAR EXISTENTE** — analise o código/config fornecidos, aponte vulnerabilidades reais com localização (arquivo:linha) e entregue a correção.
- **[B] PROJETAR DO ZERO** — proponha a arquitetura de segurança completa (controles, bibliotecas, configs, checklist de implementação) para este stack.
- **[C] AMBOS** — audite o que existe **e** entregue o blueprint do que falta implementar.

---

### 4. ESCOPO DA ANÁLISE

Percorra **todas** as categorias abaixo aplicáveis. Para cada item: diga se está **OK / Vulnerável / Não verificável**, e se vulnerável, entregue **impacto + correção**.

#### 4.1 — OWASP Top 10:2025 (Web) — núcleo obrigatório
- **A01 Broken Access Control** — checagem de autorização em **todo** endpoint; IDOR / acesso a objeto de outro usuário (`/pedido/123` → consigo ver o 124?); escalonamento horizontal e vertical; **SSRF** (agora dentro desta categoria); rotas admin sem verificação de papel; controle de acesso feito só no front.
- **A02 Security Misconfiguration** — headers de segurança ausentes (CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy); modo debug/stack trace em produção; painéis/rotas default expostos; permissões amplas em storage/bucket; CORS permissivo (`*` com credenciais); portas e serviços desnecessários abertos.
- **A03 Software Supply Chain Failures** — dependências desatualizadas/vulneráveis (`npm audit`, `composer audit`); pacotes de origem duvidosa (typosquatting); ausência de lockfile; imagens Docker base sem versão fixada; ausência de verificação de integridade no build.
- **A04 Cryptographic Failures** — dado sensível trafegando/armazenado sem cifra; TLS < 1.2; hashes fracos (MD5/SHA1) para senha; senha sem `bcrypt`/`argon2`; chaves/segredos hardcoded; gerador aleatório fraco para tokens; JWT sem assinatura forte.
- **A05 Injection** — SQL/NoSQL injection (queries concatenadas em vez de parametrizadas/ORM); command injection; **XSS** (refletido, armazenado, DOM); template injection; LDAP/header injection; validação e *escaping* de entrada.
- **A06 Insecure Design** — ausência de threat modeling; falta de limites de negócio (ex.: sacar mais do que tem); fluxos sensíveis sem defesa em profundidade; confiança implícita entre serviços.
- **A07 Authentication Failures** — força bruta sem rate limit/bloqueio; **enumeração de usuário** (mensagem diferente para "e-mail não existe"); política de senha fraca; ausência de MFA em contas críticas; fluxo de "esqueci a senha" inseguro; sessão que não expira.
- **A08 Software & Data Integrity Failures** — update/deploy sem verificação de integridade; deserialização insegura; CI/CD que executa código não confiável; dependência de CDN sem SRI.
- **A09 Security Logging & Alerting Failures** — eventos de segurança não logados (login, falha de auth, mudança de permissão); logs sem alerta/monitoramento; **log gravando dado sensível** (senha, token, CPF); ausência de trilha de auditoria.
- **A10 Mishandling of Exceptional Conditions** *(novo em 2025)* — erros que "falham aberto" (liberam acesso ao dar erro); tratamento de exceção que vaza informação; estados inesperados não tratados; em APIs, falha em cascata entre serviços.

#### 4.2 — OWASP API Security Top 10 (se houver API/backend)
- **BOLA / Object Level Auth** — o usuário só acessa **os próprios** objetos? (a falha nº1 de API).
- **Broken Authentication** — tokens previsíveis, sem expiração, aceitos após logout.
- **Broken Object Property Level Auth** — *excessive data exposure* (endpoint devolve campos a mais: hash de senha, flags internas) e *mass assignment* (usuário injeta `isAdmin:true` no body).
- **Unrestricted Resource Consumption** — sem rate limit / paginação / limite de payload → DoS e custo.
- **Broken Function Level Auth** — endpoints administrativos acessíveis por usuário comum.
- **SSRF, config incorreta, versionamento inseguro de API** (endpoints v1 antigos e vulneráveis ainda no ar).

#### 4.3 — OWASP Mobile Top 10 (se for mobile / PWA / híbrido)
- Armazenamento inseguro no dispositivo (token/PII em `localStorage`/SQLite sem cifra).
- Comunicação insegura (sem *certificate pinning* onde faz sentido, HTTP misto).
- Criptografia insuficiente e chaves embutidas no bundle.
- Autenticação/autorização feita no cliente; código sensível no front visível via *reverse engineering*.
- Segredos/API keys embarcados no app (extraíveis do bundle).

#### 4.4 — Frontend / Client-side
- **CSP** definida e restritiva; **XSS** via `dangerouslySetInnerHTML`/`v-html`/`innerHTML`.
- **CSRF** — proteção (token/SameSite) em ações que mudam estado.
- **Clickjacking** — `X-Frame-Options`/`frame-ancestors`.
- **Segredos no front** — API keys, tokens ou endpoints internos no JS empacotado.
- Dado sensível em `localStorage`/`sessionStorage` (acessível por qualquer XSS).
- **CORS** correto; **SRI** em scripts de terceiros; dependências front vulneráveis.

#### 4.5 — Autenticação, Sessão e Identidade
- Hash de senha com `argon2id` ou `bcrypt` (custo adequado) + política de senha razoável.
- **MFA/2FA** disponível para contas sensíveis.
- Cookies de sessão `HttpOnly` + `Secure` + `SameSite`; rotação de sessão no login; expiração e logout que invalida de fato.
- **JWT**: algoritmo fixo (bloquear `alg:none`/confusão RS/HS), expiração curta, refresh seguro, armazenamento correto (cookie HttpOnly > localStorage).
- Rate limit e *lockout* em login, reset de senha e OTP; proteção contra enumeração; reset de senha com token de uso único e expiração.
- OAuth/SSO com `state`/PKCE e validação de `redirect_uri`.

#### 4.6 — Proteção de Dados e Vazamento (foco LGPD)
- **Cifra em trânsito** (TLS 1.2+) e **em repouso** para dados sensíveis (PII, credenciais, saúde, pagamento).
- **Minimização**: coleta e retenção só do necessário; política de retenção/expurgo; anonimização/pseudonimização onde couber.
- **Controle de acesso ao banco** por menor privilégio; sem conta única "root" para tudo.
- **Vazamento por caminhos indiretos**: logs, mensagens de erro, respostas de API, backups, exportações, headers, URLs com token, cache.
- **Backups** cifrados e com acesso restrito; restauração testada.
- **LGPD**: base legal do tratamento; consentimento; atendimento a direitos do titular (acesso/exclusão); **cuidado redobrado com dados de menores** e de saúde; registro de incidentes/plano de resposta.
- Segredos **fora do código** (`.env` não versionado, cofre/secret manager); rotação de credenciais; nada de chave em repositório (varrer histórico do Git).

#### 4.7 — Segredos, Infraestrutura e CI/CD
- `.env`/segredos ausentes do Git (varrer histórico: `git log -p | grep`), com `.gitignore` correto e *secret scanning* ativo.
- **Docker**: não rodar como root; imagens base fixadas e atualizadas; sem segredo em `ENV`/layer; superfície mínima.
- **Coolify / reverse proxy**: HTTPS forçado, redirecionamento 80→443, headers de segurança no proxy, painel de admin protegido (não exposto à internet aberta).
- **CI/CD (GitHub)**: segredos em *secrets* (não em YAML); *branch protection*; workflows não executam PR de terceiros com acesso a segredos; dependências pinadas.
- Firewall/portas: só o necessário exposto; banco **não** acessível pela internet; SSH com chave (sem senha) e porta restrita.
- Atualização de SO/pacotes do host; monitoramento e alertas.

#### 4.8 — Segurança de IA / LLM (OWASP Top 10 for LLM Apps 2025) — *só se o sistema usa IA*
- **LLM01 Prompt Injection** — entrada do usuário (ou conteúdo externo: PDF, e-mail, página) consegue **sobrescrever suas instruções**? Separe claramente instrução de dado; marque conteúdo não confiável; nunca confie cegamente no que o modelo devolve.
- **LLM02 Sensitive Information Disclosure** — o sistema envia PII/segredo/dado de outro cliente para o modelo? Há **redação/máscara antes** de mandar ao LLM? A resposta pode vazar dado de treino/contexto/outro tenant?
- **LLM03 Supply Chain** — modelos, bibliotecas de IA e pesos de origem confiável; dependência de LLM de terceiros avaliada.
- **LLM04 Data & Model Poisoning** — se há fine-tuning/RAG com dado do usuário, ele pode envenenar o comportamento? Valide e isole as fontes.
- **LLM05 Improper Output Handling** — **saída do modelo é tratada como código/HTML/SQL/comando sem validação?** Isso vira XSS/SSRF/RCE. Trate a saída do LLM como entrada **não confiável**.
- **LLM06 Excessive Agency** — se o LLM chama ferramentas/APIs/banco (agente): menor privilégio nas ferramentas, **aprovação humana para ações irreversíveis**, escopo limitado (o agente com acesso a e-mail não pode virar spammer; com acesso a banco não pode deletar registros).
- **LLM07 System Prompt Leakage** — o prompt de sistema pode ser extraído? Não coloque segredo/regra de negócio sensível dentro do system prompt.
- **LLM08 Vector & Embedding Weaknesses** *(RAG)* — controle de acesso na base vetorial (um tenant não recupera dado de outro); envenenamento do índice.
- **LLM09 Misinformation** — resposta do modelo tratada como verdade em decisão crítica; alucinação sem *human-in-the-loop*.
- **LLM10 Unbounded Consumption** — **rate limit e teto de custo por usuário** (Denial-of-Wallet: abusar da sua API de IA e estourar sua conta); timeout em operações caras; monitorar padrão de uso.
- **Extra prático**: a **chave da API de IA** está no backend (nunca no front)? Há limite de tokens/gasto? Entrada do usuário é higienizada antes de compor o prompt?

#### 4.9 — Erros comuns do DESENVOLVEDOR (checar explicitamente)
- Confiar só na validação do **front** (repetir tudo no back).
- **Segredo hardcoded** ou commitado no Git.
- Mensagem de erro verbosa vazando stack/estrutura/versão.
- `debug=true`/console em produção; endpoints de teste no ar.
- Controle de acesso esquecido em endpoint novo.
- Dependência desatualizada; copiar código inseguro de tutorial/Stack Overflow/IA sem revisar.
- CORS `*`, cookie sem flags, ausência de rate limit por "não dar tempo".
- Deletar/atualizar sem *soft delete*/backup; migração destrutiva sem revisão.

#### 4.10 — Erros comuns do USUÁRIO / fator humano (o sistema precisa mitigar)
- Senha fraca/reutilizada → **exigir** política + oferecer MFA + checar contra listas de senhas vazadas.
- Phishing / engenharia social → e-mails do sistema com padrão claro; nunca pedir senha por e-mail; alerta de login novo.
- Compartilhar link com token na URL → tokens curtos, de uso único, que expiram.
- Sessão aberta em dispositivo compartilhado → timeout + logout de todas as sessões.
- Upload de arquivo malicioso → validar tipo/tamanho, varrer, não executar, servir de domínio isolado.
- Permissão excessiva concedida a colegas → papéis mínimos + revisão periódica de acessos.

---

### 5. METODOLOGIA

1. **Reconhecimento** — mapeie superfície de ataque: rotas, endpoints, entradas, integrações, onde entram dados e onde saem.
2. **Análise por camada** — percorra as seções da parte 4 aplicáveis.
3. **Priorização** — classifique por **severidade (Crítica / Alta / Média / Baixa)** e **facilidade de exploração**, considerando o impacto real neste sistema.
4. **Remediação** — para cada achado, entregue a **correção concreta** (código/config), não só a teoria.
5. **Defesa em profundidade** — nunca dependa de um único controle; combine validação de entrada, autorização, saída segura e monitoramento.

---

### 6. FORMATO DE SAÍDA

Entregue nesta ordem:

**A) Resumo executivo** — postura geral de segurança em 3–5 linhas + contagem de achados por severidade.

**B) Tabela de achados:**

| # | Severidade | Categoria (OWASP) | Onde (arquivo/endpoint) | Descrição | Como explorar | Correção |
|---|-----------|-------------------|-------------------------|-----------|---------------|----------|

**C) Correções detalhadas** — para cada achado Crítico/Alto: explicação + **trecho de código corrigido** pronto para colar (no meu stack).

**D) Checklist de hardening** — lista `[ ]` acionável do que implementar/ativar, ordenada por prioridade.

**E) Quick wins** — as 3–5 correções de maior impacto e menor esforço para fazer **hoje**.

---

### 7. REGRAS E LIMITES

- **Somente defensivo.** O objetivo é proteger. Descreva vetores de ataque apenas no nível necessário para corrigir — sem entregar exploit pronto para uso ofensivo contra terceiros.
- **Não execute testes destrutivos** contra ambiente de produção; sugira testes seguros em staging.
- Se faltar informação para avaliar um item, marque como **"Não verificável — preciso de X"** em vez de supor que está seguro.
- Seja **específico e prático** ao meu stack; nada de recomendação genérica solta.
- Priorize sempre: **o que me expõe mais, com menos esforço para corrigir, vem primeiro.**

---
## ⬆️ FIM DO PROMPT

---

## DICA DE USO NO SEU CONTEXTO

- **Marcenaria Pro / Escola (Next.js + PostgreSQL):** foco em A01 (autorização por rota nas API routes), A05 (XSS/SQLi), 4.5 (NextAuth/Clerk + JWT em cookie HttpOnly) e 4.6 (LGPD — Escola trata **dados de menores**, atenção máxima).
- **SiCap / AppNexos (Node/Express):** reforce **4.2 (API Security — BOLA)** e 4.7 (Docker/Coolify).
- **Condosis (PHP/MySQL em hospedagem compartilhada):** prioridade em A03 (dependências), A05 (SQLi com queries parametrizadas/PDO) e 4.7 (segredos e superfície da hospedagem).
- **Integrações com IA (API Claude / Ollama / Power Automate):** a seção **4.8** é a mais importante — principalmente **chave no backend**, **teto de custo/rate limit** (Denial-of-Wallet) e **tratar a saída do modelo como entrada não confiável**.
- Para varrer segredos já commitados no histórico: rode uma ferramenta de *secret scanning* no repositório antes de tornar qualquer repo público.
