# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Environment and commands

- Runtime is Node `24.18.0` (see `.nvmrc`); use pnpm.
- Copy `.env.example` to `.env` and provide the database, JWT, Qiniu, and optional LLM-provider settings before running the application or integration tests.

```bash
pnpm install
pnpm dev                    # nodemon + tsx, serving src/server.ts
pnpm build                  # tsc to dist/, then tsc-alias rewrites @/* imports
pnpm start                  # run compiled dist/server.js

pnpm lint
pnpm lint:fix
pnpm test                   # Vitest watch mode
pnpm test:run               # one non-watch test run
pnpm exec vitest run tests/auth.test.ts        # one test file
pnpm exec vitest run tests/auth.test.ts -t "登录成功"  # one named test

pnpm db:dev                 # create/apply a development Prisma migration
pnpm db:prod                # deploy existing migrations
pnpm db:generate            # generate Prisma client into src/generated/prisma
pnpm db:seed                # seed the built-in admin account
```

`DATABASE_URL` is required by Prisma CLI configuration even for `pnpm db:generate`. `src/generated/` is generated and ignored, so regenerate it after schema changes or a fresh checkout. Tests use Vitest's Node environment and `tests/setup.ts` loads `.env`; API tests use Supertest against the Express app and therefore may require the configured MySQL data.

## Application architecture

This is an Express 5 REST API in TypeScript, backed by MySQL through Prisma 7 and a MariaDB adapter.

- `src/server.ts` is the process entry point; `src/app.ts` constructs the app. The middleware order is global rate limiting, HTTP logging, Helmet, CORS, JSON parsing, routes, then the global error handler. Mount new API routers from `app.ts` under `/api` (authentication is mounted at `/api/auth`).
- Feature requests follow **route → controller → service → infrastructure/config**. Routes apply `authenticate` where required. Controllers validate request input, delegate business logic, and format responses; services own domain rules and Prisma calls; `infrastructure/` wraps external providers such as Qiniu storage and LLM providers.
- Controllers should use `asyncHandler`, `validate`, and `success`/`fail` from `src/utils`. Successful JSON responses are `{ code, message, data }`; regular validation/service errors become 400 responses through `asyncHandler`, while errors passed to Express reach `errorHandler` and become logged 500 responses.
- Input schemas live in `src/validators` and TypeScript request/domain types in `src/types`. `validate()` returns the parsed Zod value, so validate params, query strings, and bodies at the controller boundary rather than casting them. JWT middleware writes `req.userId`, declared in `src/types/express.d.ts`.
- Database models are split across `prisma/schema/*.prisma`, with `prisma.config.ts` pointing Prisma at that directory and `prisma/migrations/` holding migration history. Import the singleton Prisma client from `@/config/database`; use transactions for coordinated multi-table mutations.
- Authentication is JWT Bearer auth; authorization-sensitive user/menu queries respect `user.isSystem` and role/menu join tables. Preserve that distinction when changing permission behavior.
- Uploads use Multer memory storage and pass buffers to `src/infrastructure/storage/qiniuStorage.ts`; files are not stored locally by the API.

## LLM integration

The AI endpoints are authenticated `/api/ai/models` and `/api/ai/chat`. `aiController` returns JSON when `stream: false` and otherwise emits SSE events (`reasoning`, `text`, `done`, and `[DONE]`). It aborts upstream work when the HTTP client disconnects.

Provider-neutral request/result types and the `LLMProvider` contract live in `src/infrastructure/llm/types.ts`. `aiService` validates model selection through the registry in `src/config/llm.ts`, lazily caches one provider adapter per configured provider, and delegates streaming/non-streaming calls. Add a provider by implementing `LLMProvider` and registering it; OpenAI-compatible providers are registry/config additions, while Anthropic uses its official SDK adapter. Keep provider-specific response shapes out of controllers and services.

## Build, hooks, and deployment

- TypeScript path imports use `@/*` for `src/*`; `tsc-alias` is required after compilation so compiled CommonJS code can resolve them.
- The pre-commit hook runs `lint-staged` (`eslint --fix` for staged `.ts` files); commit messages are checked by Commitlint. Use `pnpm commit` for the configured Commitizen flow when needed.
- GitHub Actions deploys pushes to `main`: it installs dependencies, generates Prisma Client with a placeholder database URL, builds, sends `dist`, Prisma schema/migrations, and package manifests to the server, then runs `pnpm db:prod` and restarts PM2 process `server`. Production `.env`, `logs/`, and `node_modules/` remain server-owned.
