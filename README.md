# Cortex — Frontend

The chat UI for Cortex, an agent chat application. Backend (API,
orchestration, Trigger.dev tasks) lives in a separate repo —
[cortex-backend](https://github.com/sidd-2203/Cortex-Backend).

> **Status:** Day 1 of a 3-day build — one implicit chat per visit, send →
> stream → persist works end-to-end. Chat list/switching, skills, tool UI,
> attachments, and pixel-fidelity polish against the Galaxy Agent Chat
> reference come next.

## Stack

pnpm · Next.js 16 (App Router) · TypeScript strict · Clerk · Zustand ·
TanStack Query · Zod · shadcn/ui (Base UI + Nova preset) + Tailwind

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
source of truth. The token stream currently arriving over SSE is a
different kind of state entirely (ephemeral, client-only, resets on
completion), which is exactly what `useChatUiStore`
(`src/stores/chat-ui-store.ts`) is for — avoids prop-drilling the in-flight
text between the composer and message list without conflating it with
persisted history.

### Streaming

`EventSource` can't be used for the send-turn call — it's GET-only and can't
carry an `Authorization` header. `useSendTurn` (`src/hooks/use-send-
turn.ts`) reads the `fetch()` response body stream directly and parses the
same `event: ...\ndata: ...\n\n` framing the backend writes.

### Contracts

`src/contracts/*.ts` is a **flagged, temporary** verbatim copy of the
backend's Zod schemas (see the banner comment at the top of each file) —
there's no monorepo linking the two repos yet, so this is the current
shortcut for "the frontend never redefines a type." Edit the backend copy
first.

## Trade-offs / what I'd improve with more time

- **One implicit chat per visit** — no chat list, switching, search, pin, or
  delete yet in the UI (the backend API already supports all of this).
- **Contracts duplication** — see above; would become a published package or
  generated client with more time.
- **No cloning-fidelity pass yet** — this is currently a functional-but-plain
  shell, not yet compared screen-by-screen against the Galaxy Agent Chat
  reference product.
- **No attachments/media picker, plan mode, or interrupt/stop** in the
  composer yet.

## Next.js 16 / React 19.2 note

Both are newer than typical training data cutoffs — `middleware.ts` became
`proxy.ts` (named export, not default; Node-only runtime now), among other
changes. Verified against the bundled docs
(`node_modules/next/dist/docs`) rather than assumed where behavior looked
unfamiliar.
