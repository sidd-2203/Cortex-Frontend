---
name: design-system
description: >
  Cortex's visual design language — color tokens and what they mean, component
  conventions (composer, sidebar, buttons, cards), spacing/radius rules, and
  what NOT to do (no gradient washes, no colored primary buttons). Load this
  before writing or changing any UI: a new component, a restyle, a new page,
  or anything touching globals.css, composer.tsx, chat-sidebar.tsx, or
  chat-workspace.tsx. The goal is that every future session produces UI that
  looks like it came from the same designer, without re-deriving the palette
  from scratch or guessing at a different one.
type: core
---

# Cortex design system

Visual model: **Magica's dashboard** (magica.com — screenshots reviewed
2026-09-06, not a live fetch since that app 403s to any bot). Neutral,
high-whitespace, near-monochrome SaaS look. Cortex is a chat app, not a
multi-tool workspace, so only the parts that transfer are adopted below —
don't invent Tasks/Projects/Library-style sections that don't exist in this
product just because Magica has them.

## Color tokens — what each one means

All tokens live in `src/app/globals.css` as CSS custom properties, mapped
into Tailwind via `@theme inline`. Both a light (`:root`) and dark (`.dark`)
value exist for every token — **never hardcode a hex/oklch color in a
component**; always reach for the token so dark mode stays correct for free.

| Token | Meaning | What it looks like |
|---|---|---|
| `background` / `foreground` | Page base | Near-white / near-black (inverted in dark) — **not** tinted, no gradient wash |
| `primary` / `primary-foreground` | The one CTA color | Near-black button, white text (inverted in dark: near-white button, black text). This is monochrome on purpose — Magica's "Add Credits" button and its selected filter pill are both solid black, never colored |
| `brand` / `brand-foreground` | The **one** reserved spot of actual color (indigo/violet) | Use only for: the logo mark, and sparing small accents (e.g. an icon highlight). **Never** for buttons, backgrounds, or borders — if you're reaching for `brand` on anything bigger than an icon or a few characters of text, stop and use `primary` instead |
| `secondary` / `muted` / `accent` | Neutral grays, several shades | Card backgrounds, hover states, subtle fills — all still grayscale, no hue |
| `border` / `input` | Hairline dividers | Very light gray, barely visible — Magica's panels are separated by whitespace more than by visible borders |
| `sidebar*` | Sidebar-specific variants of the above | Sidebar background is effectively the same near-white as the page — don't make it a visibly different shade |
| `destructive` | Errors, delete actions | The only other hue allowed besides `brand` |

**The rule in one sentence:** buttons and backgrounds are grayscale;
`brand` is a single small accent, not a theme color.

## Component conventions

- **Composer**: a seamless rounded bar, not a bordered card with a separate
  button beside it. Icons (attach, send) sit flush *inside* it at each end.
  Send is a filled circular `primary`-colored icon button embedded in its
  right edge. **`rounded-3xl`, not `rounded-full`** — this box's height is
  not fixed (a multi-line paste grows it up to a capped max-height, then
  scrolls), and `rounded-full` only looks like a pill at one specific
  height; at the tall end it turns into an exaggerated oval. Found this by
  shipping it wrong first — don't reintroduce it on a future "make it look
  more like a pill" pass.
- **Sidebar top**: nav-style rows (icon + label, no button chrome) — "+ New
  chat" reads like a nav item, not a bordered/filled `Button` component.
- **Sidebar footer**: this is where account-adjacent chrome lives — credits
  balance, theme toggle, user info. Keep the main content area's header
  minimal to nonexistent; Magica has no persistent top bar in the content
  pane, just small floating pills top-right when something needs to be
  there.
- **Empty state**: centered icon + short heading + subtext, generous
  vertical whitespace, composer positioned centered rather than pinned to
  the bottom when there's no active content yet (chat with no messages,
  landing states). Once there's content, the composer moves to its normal
  pinned-bottom position.
- **Radius**: large and consistent — `--radius: 0.9rem` as the base.
  `rounded-full` only for elements with a genuinely fixed height (small
  chips/badges, circular icon buttons) — anything that can grow taller with
  its content (the composer) needs a fixed radius like `rounded-3xl`
  instead, for the reason above. Don't mix in sharp corners anywhere.
- **No gradient washes, no colored page backgrounds.** An earlier pass on
  this project used a radial-gradient indigo wash on `body` — that was
  wrong and has been removed. Flat `background` only.

## Layout invariant — the app shell is exactly one viewport tall

This cost real debugging time once; don't undo it. The chat shell is a
fixed-height app, not a scrolling document: the **page** never scrolls, only
the message list does.

- `src/app/page.tsx` wraps everything in `h-screen overflow-hidden`, and
  **deliberately has no `flex-1`**. `flex-1` sets `flex-basis: 0%`, which
  overrides `h-screen` as the sizing basis, and flex's default
  `min-height: auto` then lets the box grow past the viewport.
- `chat-workspace.tsx`'s root is `flex h-screen overflow-hidden` — stated in
  viewport units rather than `h-full` so it doesn't depend on an unbroken
  percentage chain through `<body>`.
- Every flex child between that shell and the actual scrolling element needs
  **`min-h-0`** alongside `flex-1` (the content column, and `MessageList`'s
  own root). Without it, a long assistant reply grows its container instead
  of scrolling inside it.

Symptom if this regresses: the whole page gets a scrollbar, the composer
scrolls off the bottom, and the sidebar stops at its content height instead
of reaching the bottom of the screen (its `flex-1` spacer stops expanding —
that's the tell that a percentage height above it resolved to `auto`).

## Before you change any of this

If a change would add a new hue, a gradient, or a colored button, that's a
deviation from this system — flag it as a deliberate choice in your
response rather than silently drifting the palette. If you have real
reference screenshots for a specific view this doc doesn't cover, ask for
them rather than guessing; don't invent new tokens without updating this
file to match.
