# Churrasco Nobre — sistema de gestão

Sistema online (computador e celular) para o **Churrasco Nobre**: lançamento de receitas e despesas, fluxo de caixa,
dashboard, compras que alimentam o estoque, consumo de estoque, cadastro de itens/valores e lançamento de pedidos
pelo celular. Instalação única (um restaurante por instalação), instalável como app (PWA).

## O que tem

| Módulo | O que faz |
|---|---|
| **Início** | Faturado, gasto e saldo (hoje, mês atual, mês anterior ou período), atalhos de lançamento e alertas. |
| **Financeiro** | Receitas e despesas (pagas ou a pagar/receber), filtros rápidos de período, baixa, cancelamento, **fluxo de caixa** diário com saldo acumulado e previsto, exportação CSV. |
| **Dashboard** | Receitas × despesas, categorias, formas de pagamento, itens mais vendidos, vendas por tipo de pedido, compras por fornecedor, estoque em alerta, comparação com o período anterior. |
| **Compras** | Registra o que foi comprado: **entra no estoque**, atualiza o último custo do item e **gera a despesa** (paga ou a pagar). Cancelar estorna estoque e despesa. |
| **Estoque** | Saldo por item (mínimo, valor), **consumo**, perdas, ajuste de inventário e histórico imutável de movimentações. Vendas dão baixa automática. |
| **Pedidos** | Mesa, balcão, delivery e encomenda, com seletor de itens feito para o celular. Fechar o pedido gera a receita e baixa o estoque. |
| **Cadastros** | Itens para compra e venda com valores, categorias financeiras, formas de pagamento, fornecedores e clientes (desativar em vez de excluir quando há histórico). |
| **Administração** | Usuários, perfis de acesso por módulo (sem acesso / consulta / edita), auditoria completa. |
| **Console do fornecedor** | Login e sessão separados, vários administradores, bloquear/liberar o cliente, vencimento com bloqueio automático, módulos liberados, histórico de eventos. |

## Stack

Next.js 16 (App Router + Server Actions) · TypeScript · PostgreSQL · Prisma 7 (migrations SQL versionadas) · Zod · Tailwind 4 ·
Vitest · Docker. Sem bibliotecas de gráfico: os gráficos são SVG/CSS próprios.

Dinheiro é guardado em **centavos** e quantidades em **milésimos** da unidade (1,5 kg = 1500), sempre inteiros.

---

## Instalação no Easypanel (passo a passo)

> Pré-requisitos: um servidor com Easypanel, um domínio apontando para ele (ex.: `nobre.seudominio.com.br`) e este repositório no GitHub.

### 1. Crie o projeto e o banco
1. No Easypanel, **Create Project** (ex.: `churrasco-nobre`).
2. Dentro do projeto: **+ Service → Postgres**. Nome: `db`. Defina uma senha forte para o usuário `postgres` e anote.
3. Anote a **Internal Connection URL** (algo como `postgres://postgres:SENHA@churrasco-nobre_db:5432/churrasco-nobre`)
   — vamos usá-la em `DATABASE_URL`. (Use `postgresql://` no início se o painel mostrar `postgres://`; os dois funcionam.)

### 2. Crie o app
1. **+ Service → App**. Nome: `app`.
2. **Source → Github**: informe `ThiagoIL/churrasco-nobre`, branch `main` (conecte o GitHub ao Easypanel se pedir).
3. **Build → Dockerfile** (caminho `Dockerfile`, na raiz). Não precisa de nenhum comando extra.
4. **Domains & Proxy**: adicione o domínio, porta do app **3000**, HTTPS ligado (Let's Encrypt automático).
5. **Environment**: cole as variáveis abaixo (ajuste os valores):

```env
DATABASE_URL=postgresql://postgres:SENHA@churrasco-nobre_db:5432/churrasco-nobre
APP_URL=https://nobre.seudominio.com.br

# Administrador da empresa (criado só no primeiro start; senha provisória, troca exigida no 1º acesso)
ADMIN_NAME=Administrador
ADMIN_EMAIL=dono@seudominio.com.br
ADMIN_PASSWORD=UmaSenhaProvisoria1

# Console do fornecedor (conta master)
PLATFORM_ADMIN_PATH=/sistema-admin-xxxx
PLATFORM_ADMIN_NAME=Fornecedor
PLATFORM_ADMIN_EMAIL=suporte@seudominio.com.br
PLATFORM_ADMIN_PASSWORD=OutraSenhaProvisoria1

# Atrás do Easypanel (Traefik): usar o IP real do cliente
TRUST_PROXY=true
TRUST_PROXY_HOPS=1

# E-mail da recuperação de senha (opcional, mas recomendado)
SMTP_HOST=smtp.seuprovedor.com
SMTP_PORT=587
SMTP_USER=usuario
SMTP_PASS=senha
SMTP_FROM=Churrasco Nobre <nao-responder@seudominio.com.br>

TZ=America/Sao_Paulo
```

6. Clique em **Deploy**. No primeiro start o container:
   1. aplica as **migrations** (se alguma falhar, o container **não sobe** — veja o log);
   2. cria a configuração do sistema, categorias, formas de pagamento, o administrador e a conta master.
7. Confira `https://nobre.seudominio.com.br/api/health` → `{"status":"ok"}` (testa o banco).

### 3. Primeiro acesso
- Sistema: `https://nobre.seudominio.com.br` → entre com `ADMIN_EMAIL` / `ADMIN_PASSWORD`. O sistema **exige trocar a senha** na hora.
- Console do fornecedor: `https://nobre.seudominio.com.br/sistema-admin-xxxx` (o valor de `PLATFORM_ADMIN_PATH`) → entre com a conta master e troque a senha.
  Escolha um caminho pouco óbvio. `PLATFORM_ADMIN_PATH=off` desativa o console por caminho; `PLATFORM_ADMIN_HOSTS=admin.seudominio.com.br`
  usa um domínio dedicado (adicione o domínio ao app no Easypanel).
- Depois do primeiro acesso você pode **remover `ADMIN_PASSWORD` e `PLATFORM_ADMIN_PASSWORD`** das variáveis (só são lidas quando ainda não há contas).

### 4. Atualizar
Faça push no `main` e clique em **Deploy** (ou ative o deploy automático por webhook do GitHub). As migrations novas rodam sozinhas.
**Nunca edite uma migration já aplicada**: crie uma nova em `prisma/migrations`.

### 5. Backups (importante)
O banco guarda tudo, então o backup precisa **sair do servidor**:
- No serviço `db` do Easypanel, ligue **Backups** e aponte para um armazenamento externo S3 (Backblaze B2, Wasabi, AWS S3…), com agenda diária.
- Teste a restauração de vez em quando em um banco de teste. Guarde também as variáveis de ambiente (sem elas o app não sobe).

### Problemas comuns
| Sintoma | Causa provável |
|---|---|
| Container reinicia em loop | Migration falhou (veja o log) ou `DATABASE_URL` errada. |
| Login "recusa" sempre, de qualquer IP | `TRUST_PROXY=false` atrás do proxy: todos parecem o mesmo IP e o limite de tentativas dispara. Use `true`. |
| Link de recuperação de senha não chega | `SMTP_*` ausente: o link só aparece no log do app. Configure o SMTP. |
| Cookie não grava | O acesso precisa ser por **HTTPS** (cookie `__Host-` exige `Secure`). |

---

## Variáveis de ambiente

Veja [`.env.example`](.env.example) (todas comentadas). Resumo:

| Variável | Obrigatória | Para quê |
|---|---|---|
| `DATABASE_URL` | sim | PostgreSQL |
| `APP_URL` | sim | Endereço público (links dos e-mails) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | 1º start | Administrador inicial (senha provisória) |
| `PLATFORM_ADMIN_EMAIL`, `PLATFORM_ADMIN_PASSWORD`, `PLATFORM_ADMIN_NAME` | 1º start | Conta master do console |
| `PLATFORM_ADMIN_PATH` / `PLATFORM_ADMIN_HOSTS` | não | Onde o console responde |
| `SMTP_HOST/PORT/USER/PASS/FROM` | recomendado | Recuperação de senha por e-mail |
| `TRUST_PROXY`, `TRUST_PROXY_HOPS` | recomendado | IP real do cliente atrás do proxy |
| `TZ` | não | Fuso (padrão `America/Sao_Paulo`) |

Senhas precisam ter **10+ caracteres com maiúscula, minúscula e número**.

---

## Desenvolvimento local

```bash
cp .env.example .env          # ajuste DATABASE_URL
docker compose up -d db       # PostgreSQL local (porta 5432)
npm install
npm run db:deploy             # aplica as migrations
npm run dev                   # http://localhost:3000
```

Sem Docker, use qualquer PostgreSQL 15+ e aponte `DATABASE_URL` para ele.

```bash
npm run lint        # checagem de tipos (tsc)
npm test            # testes unitários das regras puras
npm run test:db     # regras do banco (triggers/CHECKs); exige TEST_DATABASE_URL de um banco DESCARTÁVEL com as migrations aplicadas
npm run build       # build de produção
```

Para testar a imagem de produção: `docker compose --profile app up --build`.

---

## Segurança (resumo)

- **Senhas**: bcrypt (custo 12), hash fictício para usuário inexistente (tempo igual), erro de login sempre genérico, política 10+ com maiúscula/minúscula/número, senha provisória com troca obrigatória.
- **Tentativas**: limite por IP e por conta guardado no banco; **5 erros seguidos bloqueiam a conta por 15 minutos**.
- **Sessão**: token aleatório de 256 bits (no banco só o SHA-256), expira em **12 h** ou **120 min sem uso**, cookie `__Host-` `HttpOnly` `Secure` `SameSite=Lax`, revogada ao trocar a senha, desativar o usuário ou bloquear o sistema. Sessões do sistema e do console são separadas.
- **Permissões**: por módulo (sem acesso / consulta / edita), conferidas no proxy (telas) e em cada ação do servidor. O fornecedor pode desligar módulos.
- **Regras também no banco** (migrations `business_rules` e `system_categories_guard`): sempre ao menos 1 administrador ativo, ninguém desativa/rebaixa/exclui a si mesmo, conta master protegida, estoque nunca negativo por consumo/perda/ajuste, movimentações e auditoria imutáveis, pedido pago/cancelado e compra cancelada não mudam, categorias do sistema protegidas, valores positivos.
- **Cabeçalhos**: CSP com nonce por requisição, HSTS, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy e COOP.
- **Auditoria** de tudo, inclusive logins e falhas (IP, usuário, ação, dados), em Administração › Auditoria.
- **Bloqueio por vencimento**: defina a data no console; depois dela o acesso fecha sozinho.

## App instalável (PWA)

Manifest, ícones 192/512 (inclusive *maskable*) e ícone do iPhone, botão **Instalar app**, aviso de **nova versão** e página de **sem conexão**.
O service worker guarda apenas o “casco” (página offline, ícones e arquivos estáticos versionados): **nunca dados do restaurante**.
No celular o menu vira gaveta, as tabelas viram cartões, alvos de toque têm 44 px, campos 16 px, e há um botão **+** de lançamento rápido.

## Estrutura

```
prisma/               schema e migrations SQL (init, business_rules, system_categories_guard)
src/app/(app)/        telas do sistema (financeiro, compras, estoque, pedidos, dashboard, cadastros, usuários…)
src/app/platform/     console do fornecedor (alcançado pelo proxy em /sistema-admin)
src/lib/rules/        regras puras (senha, bloqueio, sessão, usuários, estoque) — testadas
src/lib/              auth, sessão, acesso, auditoria, consultas, helpers
src/proxy.ts          sessão, bloqueio, permissão por módulo, CSP
tests/unit, tests/db  testes
```
