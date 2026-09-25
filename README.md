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
- [Docker](#docker)
- [Deploy gratuito (Render + Atlas + Upstash)](#deploy-gratuito-render--atlas--upstash)
- [Observações](#observações)

## Stack

| Camada | Tecnologia |
| --- | --- |
| Runtime | Node.js 24 (ESM) |
| Linguagem | TypeScript 7 (`strict`, `module: nodenext`) |
| HTTP | Fastify 5 + `@fastify/cors` |
| Validação | Zod 4 + `fastify-type-provider-zod` |
| Documentação | `@fastify/swagger` (OpenAPI) + Scalar (`/docs`) |
| Banco de dados | MongoDB (driver oficial 7) |
| Contador de IDs | Redis (ioredis) |
| Códigos curtos | Hashids com alfabeto base62 |
| Configuração | `dotenv` + validação com Zod |
| Hospedagem | Render (Docker, plano free) |
| Gerenciador de pacotes | pnpm 12.5.1 |

## Como funciona

### Encurtar (`POST /api/shorten`)

1. O corpo é validado com Zod: a URL precisa ser `http` ou `https`, é normalizada e tem no máximo 2048 caracteres.
2. O Redis gera um ID numérico único e sequencial com `INCR url:counter`.
3. O ID é convertido em um código curto com Hashids (alfabeto `0-9a-zA-Z` + salt secreto), o que ofusca a sequência.
4. O documento é salvo na coleção `urls` do MongoDB, usando o próprio ID numérico como `_id`.
5. A resposta retorna `201` com `shortCode`, `shortUrl` (`BASE_URL/shortCode`) e `longUrl`.

### Redirecionar (`GET /:shortCode`)

1. O código é decodificado com Hashids de volta para o ID numérico. Códigos inválidos, com múltiplos números ou fora do intervalo de inteiros seguros retornam `404` sem consultar o banco.
2. O MongoDB é consultado pelo `_id` (busca pela chave primária, sem índice extra).
3. Se encontrado, responde `301` com o header `Location` apontando para a URL original; caso contrário, `404`.

### Contador inicial

Na inicialização, `connectRedis` executa `SET url:counter 238327 NX`, ou seja, só define o valor se a chave ainda não existir. O primeiro ID gerado é `238328` (= 62³), o que garante que os códigos já nasçam com pelo menos 4 caracteres.

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
| `GET` | `/` | Health check, retorna `{ "message": "Hello World" }` |
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
| `4xx` | código do erro ou `BAD_REQUEST` | Outros erros de cliente lançados pelo Fastify |
| `404` | `NOT_FOUND` | Código curto inválido ou inexistente |
| `500` | `INTERNAL_SERVER_ERROR` | Erro não tratado (é logado; detalhes não são expostos) |

## Estrutura do projeto

```
.
├── src/
│   ├── index.ts           # Bootstrap do Fastify, plugins, error handler, health check e shutdown
│   ├── lib/
│   │   ├── env.ts         # Carrega o .env e valida as variáveis com Zod
│   │   ├── hashids.ts     # encodeId / decodeShortCode com alfabeto base62
│   │   ├── mongo.ts       # MongoClient, coleção `urls` e tipo UrlDocument
│   │   └── redis.ts       # Cliente Redis, chave e valor inicial do contador
│   ├── routes/
│   │   └── urls.ts        # POST /api/shorten e GET /:shortCode
│   └── schemas/
│       └── index.ts       # Schemas Zod de body, params, resposta e erro
├── docker-compose.yml     # MongoDB 8 e Redis 8 locais
├── Dockerfile             # Imagem da aplicação (Node 24)
├── render.yaml            # Blueprint de deploy no Render
├── .env.example
└── CLAUDE.md              # Regras de código do repositório
```

## Variáveis de ambiente

Carregadas do `.env` (via `dotenv`) ou do ambiente do processo e validadas em `src/lib/env.ts`. Se algum valor for inválido, a aplicação imprime os erros formatados pelo Zod e encerra com código `1`.

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

\* No Render, se `BASE_URL` não for definida, é usada a `RENDER_EXTERNAL_URL` que a plataforma fornece.

Em desenvolvimento os logs usam `pino-pretty`; em produção são JSON puro. O CORS aceita apenas `http://localhost:3000` (com credentials).

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
| `dev` | `tsx --watch src/index.ts` | Desenvolvimento com reload |
| `build` | `tsc` | Compila para `dist/` |
| `start` | `node dist/index.js` | Executa a versão compilada |
| `typecheck` | `tsc --noEmit` | Verificação de tipos |

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

Baseada em `node:24`: instala as dependências com pnpm, roda o build e inicia com `node dist/index.js`. É a imagem usada pelo Render.

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
2. No [Render](https://render.com), clique em **New > Blueprint** e selecione o repositório. O `render.yaml` cria um web service Docker no plano free com:
   - `NODE_ENV=production`, `MONGO_DB_NAME` e `MONGO_MAX_POOL_SIZE` fixos;
   - `HASHIDS_SALT` gerado automaticamente;
   - `MONGO_URL` e `REDIS_URL` solicitados na criação;
   - health check em `/` e deploy automático a cada push.
3. Preencha `MONGO_URL` e `REDIS_URL` e confirme.

A API fica em `https://<nome-do-serviço>.onrender.com`. Para usar um domínio próprio, configure-o no Render e defina `BASE_URL` com ele.

### Limitações do plano free

- O serviço do Render **hiberna após ~15 minutos sem requisições**; a primeira requisição depois disso demora de 30 a 60 segundos.
- Atlas M0 e Upstash free têm limites de armazenamento e de requisições, suficientes para uso pessoal e estudo.

## Observações

- **Salt**: trocar o `HASHIDS_SALT` depois de haver URLs cadastradas quebra todos os links existentes. Guarde o valor gerado pelo Render.
- **Contador**: o `url:counter` precisa persistir. Se o Redis for zerado, o contador volta para `238327` e as próximas inserções colidem com `_id` já existentes no MongoDB.
- **`HASHIDS_MIN_LENGTH`**: é validado em `env.ts`, mas `hashids.ts` fixa o tamanho mínimo em `0`. O tamanho dos códigos é controlado pelo valor inicial do contador.
- **Regras de código**: conforme o `CLAUDE.md`, o código não deve conter comentários.
