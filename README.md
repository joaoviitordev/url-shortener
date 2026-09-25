# URL Shortener

API de encurtamento de URLs construída com **Fastify**, **MongoDB**, **Redis** e **Hashids** (alfabeto base62). Roda localmente com Docker e tem deploy gratuito no **Render**, usando **MongoDB Atlas** e **Upstash Redis** nos planos free.

## Sumário

- [Stack](#stack)
- [Como funciona](#como-funciona)
- [Endpoints](#endpoints)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Rodando localmente](#rodando-localmente)
- [Scripts](#scripts)
- [Testes](#testes)
- [CI](#ci)
- [Docker](#docker)
- [Frontend (`web/`)](#frontend-web)
- [Deploy gratuito (Render + Atlas + Upstash)](#deploy-gratuito-render--atlas--upstash)
- [Observações](#observações)

## Stack

| Camada | Tecnologia |
| --- | --- |
| Runtime | Node.js 24 (ESM) |
| Linguagem | TypeScript 7 (`strict`, `module: nodenext`) |
| HTTP | Fastify 5 + `@fastify/cors` + `@fastify/rate-limit` + `@fastify/helmet` |
| Validação | Zod 4 + `fastify-type-provider-zod` |
| Documentação | `@fastify/swagger` (OpenAPI) + Scalar (`/docs`) |
| Banco de dados | MongoDB (driver oficial 7) |
| Contador de IDs e cache | Redis (ioredis) |
| Códigos curtos | Hashids com alfabeto base62 |
| Configuração | `--env-file-if-exists` do Node + validação com Zod |
| Testes | Vitest + `mongodb-memory-server` + `ioredis-mock` |
| CI | GitHub Actions |
| Hospedagem | Render (Docker, plano free) |
| Gerenciador de pacotes | pnpm 12.5.1 |

## Como funciona

### Encurtar (`POST /api/shorten`)

1. O corpo é validado com Zod: a URL precisa ser `http` ou `https`, é normalizada e tem no máximo 2048 caracteres.
2. URLs cujo host é o do próprio `BASE_URL` são recusadas com `400 ALREADY_SHORTENED`, o que evita links que redirecionam para si mesmos.
3. O Redis gera um ID numérico único e sequencial com `INCR url:counter`.
4. O ID é convertido em um código curto com Hashids (alfabeto `0-9a-zA-Z` + salt secreto), o que ofusca a sequência.
5. O documento é salvo na coleção `urls` do MongoDB, usando o próprio ID numérico como `_id`.
6. A resposta retorna `201` com `shortCode`, `shortUrl` (`BASE_URL/shortCode`) e `longUrl`.

### Redirecionar (`GET /:shortCode`)

1. O código é decodificado com Hashids de volta para o ID numérico. Códigos inválidos, com múltiplos números ou fora do intervalo de inteiros seguros retornam `404` sem consultar o banco.
2. A URL original é buscada no cache do Redis (chave `url:<id>`).
3. Em caso de cache miss, o MongoDB é consultado pelo `_id` (busca pela chave primária, sem índice extra) e o resultado é gravado no cache com TTL de `URL_CACHE_TTL_SECONDS` (padrão 24 h).
4. Se encontrada, responde `301` com o header `Location` apontando para a URL original; caso contrário, `404`.

Falhas de leitura ou escrita no cache são apenas logadas: o redirecionamento continua funcionando direto pelo MongoDB.

### Contador inicial

Na inicialização, `syncCounter` busca o maior `_id` salvo no MongoDB e, com um script Lua atômico, eleva `url:counter` para `max(maior _id, 238327)` quando o valor atual é menor. Em banco vazio o primeiro ID gerado é `238328` (= 62³), o que garante que os códigos já nasçam com pelo menos 4 caracteres.

Com a API rodando, dois casos são cobertos:

- **Contador perdido** (Redis zerado): o `INCR` recomeça em `1`. Todo ID abaixo de `238328` é descartado, o contador é ressincronizado e um novo `INCR` é feito.
- **Contador atrasado** (ex.: restaurado de um backup antigo): o `insertOne` falha com chave duplicada, o contador é ressincronizado e a inserção é refeita uma vez com um novo ID.

### Rate limiting

Feito com `@fastify/rate-limit` em memória, por IP, em janelas de 1 minuto:

| Escopo | Limite padrão | Variável |
| --- | --- | --- |
| Todas as rotas (exceto o health check `/`) | 100 req/min | `RATE_LIMIT_MAX` |
| `POST /api/shorten` | 10 req/min | `SHORTEN_RATE_LIMIT_MAX` |

Ao exceder, a API responde `429` com `code: "RATE_LIMITED"` e o header `retry-after`. Em produção o Fastify usa `trustProxy`, para que o IP considerado seja o do cliente e não o do proxy do Render. Como o contador fica em memória, cada instância tem seus próprios limites, o que basta para a instância única do plano free.

### Modelo do documento

```ts
interface UrlDocument {
  _id: number;
  shortCode: string;
  longUrl: string;
  createdAt: Date;
}
```

## Endpoints

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/` | Liveness: responde enquanto o processo estiver de pé, sem tocar em MongoDB ou Redis (usado pelo health check do Render) |
| `GET` | `/api/health` | Readiness: faz ping no MongoDB e no Redis (timeout de 2 s) e responde `200` ou `503` com `{ status, mongo, redis }` |
| `POST` | `/api/shorten` | Cria uma URL curta |
| `GET` | `/:shortCode` | Redireciona (301) para a URL original |
| `GET` | `/docs` | Referência interativa da API (Scalar) |
| `GET` | `/swagger.json` | Especificação OpenAPI (oculta da documentação) |

### Exemplo

```bash
curl -X POST http://localhost:3333/api/shorten \
  -H "Content-Type: application/json" \
  -d '{ "url": "https://example.com/um/caminho/bem/longo" }'
```

```json
{
  "shortCode": "aB3x",
  "shortUrl": "http://localhost:3333/aB3x",
  "longUrl": "https://example.com/um/caminho/bem/longo"
}
```

### Formato de erro

Todas as respostas de erro seguem o mesmo formato:

```json
{ "error": "mensagem", "code": "CODIGO" }
```

| Status | `code` | Quando |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Falha na validação do Zod (body/params) |
| `400` | `ALREADY_SHORTENED` | A URL enviada já é do próprio encurtador |
| `4xx` | código do erro ou `BAD_REQUEST` | Outros erros de cliente lançados pelo Fastify |
| `404` | `NOT_FOUND` | Código curto inválido ou inexistente |
| `429` | `RATE_LIMITED` | Limite de requisições por IP excedido |
| `500` | `INTERNAL_SERVER_ERROR` | Erro não tratado (é logado; detalhes não são expostos) |

## Estrutura do projeto

```
.
├── src/
│   ├── app.ts             # buildApp(): instância do Fastify com plugins, error handler e rotas
│   ├── index.ts           # Bootstrap: conexões, sincronização do contador, listen e shutdown
│   ├── lib/
│   │   ├── counter.ts     # Contador de IDs: INCR, sincronização com o MongoDB e detecção de chave duplicada
│   │   ├── env.ts         # Valida as variáveis de ambiente com Zod
│   │   ├── hashids.ts     # encodeId / decodeShortCode com alfabeto base62
│   │   ├── mongo.ts       # MongoClient, coleção `urls` e tipo UrlDocument
│   │   ├── redis.ts       # Cliente Redis
│   │   └── url-cache.ts   # Cache das URLs originais no Redis
│   ├── routes/
│   │   ├── health.ts      # GET / (liveness) e GET /api/health (readiness)
│   │   └── urls.ts        # POST /api/shorten e GET /:shortCode
│   └── schemas/
│       └── index.ts       # Schemas Zod de body, params, resposta, health e erro
├── test/                  # Testes de integração com Vitest (app.inject)
├── web/                   # Frontend React + Vite + TanStack Query
│   └── src/
│       ├── App.tsx        # Tela única: título, descrição, formulário e resultado
│       ├── env.d.ts       # Tipagem de import.meta.env (VITE_API_URL)
│       ├── hooks/
│       │   └── use-shorten-url.ts  # useMutation que chama POST /api/shorten
│       └── lib/
│           └── api.ts     # Cliente HTTP, tipos e mensagens de erro amigáveis
├── docker-compose.yml     # MongoDB 8 e Redis 8 locais
├── .github/workflows/
│   └── ci.yml             # Typecheck, testes, build, lint do web e smoke test da imagem
├── Dockerfile             # Imagem multi-stage da aplicação (Node 24 slim)
├── vitest.config.ts       # Configuração e variáveis de ambiente dos testes
├── render.yaml            # Blueprint de deploy no Render
├── .env.example
└── CLAUDE.md              # Regras de código do repositório
```

## Variáveis de ambiente

Lidas do ambiente do processo e validadas em `src/lib/env.ts`. Os scripts `dev` e `start` carregam o `.env`, se existir, com a flag nativa `--env-file-if-exists` do Node; a imagem Docker não usa `.env`. Se algum valor for inválido, a aplicação imprime os erros formatados pelo Zod e encerra com código `1`.

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `production` ou `test` |
| `HOST` | `0.0.0.0` | Interface em que o servidor escuta |
| `PORT` | `3333` | Porta HTTP (o Render define automaticamente) |
| `BASE_URL` | obrigatório* | URL pública usada para montar `shortUrl` (barra final é removida) |
| `MONGO_URL` | obrigatório | String de conexão do MongoDB |
| `MONGO_DB_NAME` | `url_shortener` | Nome do banco |
| `MONGO_MAX_POOL_SIZE` | `100` | Tamanho máximo do pool do MongoDB |
| `REDIS_URL` | obrigatório | URL do Redis (`redis://` sem TLS ou `rediss://` com TLS) |
| `HASHIDS_SALT` | obrigatório | Salt do Hashids (mudar invalida todos os códigos existentes) |
| `HASHIDS_MIN_LENGTH` | `7` | Validado, mas atualmente não usado (ver [Observações](#observações)) |
| `CORS_ORIGIN` | `http://localhost:3000` | Origens liberadas no CORS, separadas por vírgula (barra final é removida) |
| `RATE_LIMIT_MAX` | `100` | Requisições por minuto por IP em todas as rotas |
| `SHORTEN_RATE_LIMIT_MAX` | `10` | Requisições por minuto por IP em `POST /api/shorten` |
| `URL_CACHE_TTL_SECONDS` | `86400` | Tempo que uma URL fica no cache do Redis depois de acessada |

\* No Render, se `BASE_URL` não for definida, é usada a `RENDER_EXTERNAL_URL` que a plataforma fornece.

Em desenvolvimento os logs usam `pino-pretty`, em produção são JSON puro e em testes ficam desligados. O CORS aceita apenas as origens de `CORS_ORIGIN`. O `@fastify/helmet` adiciona headers de segurança a todas as respostas, com a Content Security Policy desligada para não quebrar a página do Scalar em `/docs`.

## Rodando localmente

Pré-requisitos: Node.js 24, pnpm 12.5.1 (via Corepack) e Docker.

```bash
corepack enable
pnpm install
cp .env.example .env
docker compose up -d
pnpm dev
```

Troque o `HASHIDS_SALT` do `.env` por um valor aleatório, por exemplo:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

A API sobe em `http://localhost:3333` e a documentação fica em `http://localhost:3333/docs`.

## Scripts

| Script | Comando | Descrição |
| --- | --- | --- |
| `dev` | `tsx --env-file-if-exists=.env --watch src/index.ts` | Desenvolvimento com reload |
| `build` | `tsc` | Compila para `dist/` |
| `start` | `node --env-file-if-exists=.env dist/index.js` | Executa a versão compilada |
| `test` | `vitest run` | Roda os testes uma vez |
| `test:watch` | `vitest` | Roda os testes em modo watch |
| `typecheck` | `tsc --noEmit` | Verificação de tipos |

## Testes

Testes de integração em `test/`, que sobem o app com `buildApp()` e fazem requisições com `app.inject()`, sem abrir porta. Não precisam de Docker:

- o MongoDB roda em memória com `mongodb-memory-server` (o binário é baixado na primeira execução e fica em cache);
- o módulo `src/lib/redis.ts` é substituído por `ioredis-mock`, que também executa o script Lua do contador.

As variáveis de ambiente dos testes ficam em `vitest.config.ts`, e o `.env` nunca é lido. Cobrem criação e redirecionamento, validação, bloqueio de URLs do próprio encurtador, cache e fallback para o MongoDB, recuperação do contador, rate limit, CORS, headers de segurança, health checks e a documentação.

```bash
pnpm test
```

## CI

O workflow `.github/workflows/ci.yml` roda em todo pull request e em push na `main`, com três jobs:

| Job | O que faz |
| --- | --- |
| API | `pnpm typecheck`, `pnpm test` e `pnpm build` |
| Web | `pnpm lint` e `pnpm build` em `web/` |
| Docker image | Builda a imagem, sobe o container contra MongoDB e Redis reais, espera o `/api/health` responder e testa o fluxo de encurtar e redirecionar com `curl` |

Os dois serviços do `render.yaml` usam `autoDeployTrigger: checksPass`, então o Render só faz deploy de um commit na `main` depois que o CI passa.

## Docker

### Serviços locais (`docker-compose.yml`)

| Serviço | Imagem | Porta | Volume |
| --- | --- | --- | --- |
| `mongo` | `mongo:8` | `27017` | `mongo_data` |
| `redis` | `redis:8-alpine` | `6379` | `redis_data` (AOF, `fsync` a cada segundo) |

Ambos têm healthcheck (`mongosh ping` e `redis-cli ping`) e os dados persistem nos volumes entre reinicializações.

```bash
docker compose up -d
docker compose ps
docker compose down
```

### Imagem da aplicação (`Dockerfile`)

Multi-stage sobre `node:24-slim`:

1. `build`: instala todas as dependências com `pnpm install --frozen-lockfile` e compila o TypeScript.
2. `production-deps`: instala só as dependências de produção.
3. `runtime`: copia `dist/` e `node_modules/` de produção e roda `node dist/index.js` com o usuário sem privilégios `node`.

É a imagem usada pelo Render e testada no CI.

## Frontend (`web/`)

Tela única feita com **React 19**, **Vite 8**, **Tailwind CSS 4**, **TanStack Query 5** e **TypeScript 7** (mesma versão da API, com dependências em versões exatas). O envio do formulário dispara um `useMutation` que chama `POST /api/shorten` e exibe a URL curta com botão de copiar. URLs digitadas sem protocolo (ex.: `exemplo.com`) recebem `https://` automaticamente.

Se o navegador bloquear a área de transferência (permissão negada ou página sem HTTPS), o link curto é selecionado e uma mensagem orienta a copiar com Ctrl+C.

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `VITE_API_URL` | `http://localhost:3333` no `pnpm dev` | URL base da API, embutida no bundle em tempo de build |

O `pnpm build` falha se `VITE_API_URL` não estiver definida ou não for uma URL absoluta, o que impede publicar um frontend apontando para a API errada. A variável é tipada em `web/src/env.d.ts`.

```bash
cd web
cp .env.example .env
pnpm install
pnpm dev
```

O dev server roda em `http://localhost:3000`, que é o valor padrão de `CORS_ORIGIN` na API. O `.env.example` já aponta para a API local; para usar a API publicada, troque `VITE_API_URL` no `web/.env`.

## Deploy gratuito (Render + Atlas + Upstash)

### 1. MongoDB Atlas

1. Crie um cluster **M0 (Free)** em [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Em **Database Access**, crie um usuário com senha.
3. Em **Network Access**, libere `0.0.0.0/0` (o plano free do Render não tem IP fixo).
4. Copie a connection string `mongodb+srv://...`: ela vai na variável `MONGO_URL`.

### 2. Upstash Redis

1. Crie um banco Redis gratuito em [upstash.com](https://upstash.com), na região mais próxima do serviço do Render.
2. Copie a URL `rediss://default:<senha>@<host>:6379`: ela vai na variável `REDIS_URL`.

### 3. Render

1. Suba o repositório para o GitHub.
2. No [Render](https://render.com), clique em **New > Blueprint** e selecione o repositório. O `render.yaml` cria dois serviços no plano free:
   - **`url-shortener`** (API, Docker): `NODE_ENV=production`, `MONGO_DB_NAME` e `MONGO_MAX_POOL_SIZE` fixos; `HASHIDS_SALT` gerado automaticamente; `MONGO_URL`, `REDIS_URL` e `CORS_ORIGIN` solicitados na criação; health check em `/`; deploy só depois do CI passar; mudanças apenas em `web/` ou em arquivos `.md` não disparam deploy.
   - **`url-shortener-web`** (frontend, static site): build com `corepack pnpm build` a partir de `web/` (mesmo pnpm 12.5.1 do `packageManager`), publica `web/dist` na CDN do Render com headers de segurança e cache longo para `/assets/*`; `VITE_API_URL` solicitado na criação; só faz deploy quando algo em `web/` muda.
3. Preencha as variáveis e confirme:
   - `MONGO_URL` e `REDIS_URL`: strings de conexão do Atlas e do Upstash;
   - `CORS_ORIGIN`: URL do frontend, ex.: `https://url-shortener-web.onrender.com`;
   - `VITE_API_URL`: URL da API, ex.: `https://url-shortener.onrender.com`.

O Render pode acrescentar um sufixo ao subdomínio (ex.: `url-shortener-lchk.onrender.com`). Depois da primeira criação, confira as URLs reais no painel e, se forem diferentes, corrija `CORS_ORIGIN` na API e `VITE_API_URL` no frontend. Essa última é embutida no build, então exige um novo deploy do static site. Para usar um domínio próprio, configure-o no Render e defina `BASE_URL` com ele.

### Limitações do plano free

- O serviço do Render **hiberna após ~15 minutos sem requisições**; a primeira requisição depois disso demora de 30 a 60 segundos.
- Atlas M0 e Upstash free têm limites de armazenamento e de requisições, suficientes para uso pessoal e estudo.

## Observações

- **Salt**: trocar o `HASHIDS_SALT` depois de haver URLs cadastradas quebra todos os links existentes. Guarde o valor gerado pelo Render.
- **Contador**: o `url:counter` se recupera sozinho se o Redis for zerado (ver [Contador inicial](#contador-inicial)), às custas de uma consulta extra ao MongoDB na inicialização ou na primeira colisão.
- **`HASHIDS_MIN_LENGTH`**: é validado em `env.ts`, mas `hashids.ts` fixa o tamanho mínimo em `0`. O tamanho dos códigos é controlado pelo valor inicial do contador.
- **Regras de código**: conforme o `CLAUDE.md`, o código não deve conter comentários.
