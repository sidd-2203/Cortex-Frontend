# Cortex — Frontend

The chat UI for Cortex, an agent chat application. Backend (API,
orchestration, Trigger.dev tasks) lives in a separate repo —
[cortex-backend](https://github.com/sidd-2203/Cortex-Backend).

**Live**: https://cortex-frontend-kohl.vercel.app

## Stack

pnpm · Next.js 16 (App Router) · TypeScript strict · Clerk · Zustand ·
TanStack Query · Zod · shadcn/ui (Base UI + Nova preset) + Tailwind ·
`@trigger.dev/react-hooks`

## Setup

```bash
pnpm install
cp .env.example .env.local   # fill in the values below
pnpm dev                      # http://localhost:3001 (backend expects 3000 by default)
```

| Var | Where it comes from |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk dashboard — same app as the backend |
| `NEXT_PUBLIC_API_URL` | the backend's origin (`http://localhost:3000` locally) |

## Architecture

### Auth: resource-based, Bearer token to the backend

`src/proxy.ts` is just `clerkMiddleware()` with no route matching — Clerk
now recommends against gating by path in middleware (it can diverge from how
Next.js actually routes a request). The page itself
(`src/app/page.tsx`) calls `auth.protect()` directly.

The frontend and backend are separate origins with no shared cookie jar, so
every API call carries a Clerk session token as `Authorization: Bearer
<token>` (`src/lib/api-client.ts`, fetched fresh per call via
`useAuth().getToken()`) rather than relying on cookies.

### State: TanStack Query for server state, Zustand for the live stream

Persisted messages/chats are TanStack Query's job (`src/hooks/use-chat-
queries.ts`) — cached, invalidated on mutation, backed by the server as
source of truth. The token stream currently arriving is a different kind of
state entirely (ephemeral, client-only, resets on completion), which is
exactly what `useChatUiStore` (`src/stores/chat-ui-store.ts`) is for —
avoids prop-drilling the in-flight text between the composer and message
list without conflating it with persisted history.

### Streaming: direct to Trigger.dev, not through the backend

`useSendTurn` (`src/hooks/use-send-turn.ts`) POSTs to send-turn and gets
back almost immediately — `{ runId, triggerRunId, publicAccessToken }`, not
a stream. The actual token-by-token response is read by
`useAgentRunSubscription` (`src/hooks/use-agent-run-subscription.ts`) via
`@trigger.dev/react-hooks`' `useRealtimeStream`/`useRealtimeRun`, talking to
Trigger.dev's API directly with that run-scoped `publicAccessToken`. The
backend is only ever in the request path for dispatch, never for the
duration of the LLM response — that's what keeps its route handler well
inside Vercel's serverless function time limit regardless of how long a
completion takes.

That same hook handles reload recovery: on mount (or switching chats), it
calls `GET /api/chats/:id/active-run` — if there's an in-flight run, the
backend mints a fresh `publicAccessToken` for it and the hook resumes
watching, instead of the response silently vanishing because the tab
refreshed mid-stream.

### Contracts

`src/contracts/*.ts` is a flagged, temporary verbatim copy of the backend's
Zod schemas (see the banner comment at the top of each file) — there's no
monorepo linking the two repos yet, so this is the current shortcut for
"the frontend never redefines a type." Edit the backend copy first.

## Trade-offs / what's next

- **No pin/search/delete UI yet** — the sidebar lists and switches chats,
  but pin/search/safe-delete (all already supported by the backend API)
  don't have UI yet.
- **Contracts duplication** — see above; would become a published package or
  generated client with more time.
- **No cloning-fidelity pass yet** — this is currently a functional-but-plain
  shell, not yet compared screen-by-screen against the Galaxy Agent Chat
  reference product.
- **No attachments/media picker, plan mode, or interrupt/stop** in the
  composer yet.

## Next.js 16 / React 19.2

Both are recent major releases with real breaking changes from earlier
versions — `middleware.ts` became `proxy.ts` (named export, not default;
Node-only runtime now), among others. Verified against the bundled docs
(`node_modules/next/dist/docs`) rather than assumed where behavior looked
unfamiliar.
