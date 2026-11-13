# KidLog

A co-parenting app. Parents and caregivers log a child's activities, expenses
and routines in seconds, and everyone in the child's circle sees one shared
timeline.

- **Quick-add**: type or say "Took Maya to swimming, paid $40". Claude turns it
  into an activity and an expense, you confirm with one tap.
- **Receipts**: snap a photo, Claude reads the merchant, amount, date and category.
- **Routines**: today's routines (Bedtime, Homework, Meds) are one-tap buttons.
- **Timeline**: newest first, filter by person and type. Every edit is recorded
  and shown.
- **Simple mode**: a per-person setting that shows only a huge microphone and
  the routine buttons.

Stack: Next.js 16 (App Router, TypeScript), Tailwind 4, Supabase (Postgres,
Auth, Storage, Row Level Security, Realtime), Claude API. Installable PWA.

## Setup

You need Node 20+, a Supabase project (local or hosted) and an Anthropic API key.

### 1. Install

```bash
npm install
cp .env.example .env.local
```

### 2. Database

**Local Supabase** (needs Docker):

```bash
npx supabase init      # creates supabase/config.toml; keeps the existing migrations and seed
npx supabase start     # prints the API URL and anon key for .env.local
npx supabase db reset  # runs supabase/migrations/*.sql, then supabase/seed.sql
```

**Hosted Supabase**:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

To load the demo data on a hosted project, paste `supabase/seed.sql` into the
SQL editor. Skip it for a real deployment.

### 3. Auth settings

In the Supabase dashboard under Authentication > URL Configuration (or in
`supabase/config.toml` under `[auth]` for local):

- Site URL: your app URL, for example `http://localhost:3000`
- Redirect URLs: add `http://localhost:3000/auth/callback`

Sign-in is by email magic link. With the default email template the link must
be opened in the same browser that asked for it. To allow opening it on another
device, change the Magic Link template to point at
`{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email`; the
callback route handles both forms.

### 4. Environment variables

| Variable | Required | What it is |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase anon (publishable) key |
| `NEXT_PUBLIC_SITE_URL` | yes | Where the app is served; used in magic links and invite links |
| `ANTHROPIC_API_KEY` | yes | Claude API key. Server-side only, never sent to the browser |
| `KIDLOG_PARSE_MODEL` | no | Model for parsing. Default `claude-fable-5-2` |
| `KIDLOG_PARSE_EFFORT` | no | `low` (default), `medium`, `high`, `xhigh` or `max` |
| `NEXT_PUBLIC_DEFAULT_CURRENCY` | no | Currency when a note doesn't name one. Default `USD` |

The app needs no service-role key. Every read and write goes through Row Level
Security as the signed-in user.

Claude Fable 5.2 requires an Anthropic organization with 30-day data retention
(it isn't available under zero data retention). If the key's organization
doesn't qualify, set `KIDLOG_PARSE_MODEL` to another model such as
`claude-opus-5-5`.

### 5. Run

```bash
npm run dev          # http://localhost:3000
```

With the seed loaded, sign in as one of these (locally the emails arrive in the
Supabase mail catcher at http://localhost:54324):

| Email | Role | Permission |
|---|---|---|
| `alex@kidlog.test` | parent | full |
| `sam@kidlog.test` | parent | full |
| `rosa@kidlog.test` | grandparent | log only, simple mode on |

The seed has 2 children (Maya, Leo), 5 routines and 20 entries, 2 of them edited.

The microphone uses the Web Speech API, which works in Chrome, Edge and Safari
and needs HTTPS (or localhost). Where it isn't available the text field still
works, and simple mode shows a large text field instead.

## Tests

```bash
npm test             # RLS policies + parsing
npm run typecheck
```

- `tests/rls.test.ts` runs the real migration files in an embedded Postgres
  (PGlite, no Docker) and checks the access rules as each kind of member:
  full, view_expenses, log_only, outsider and signed-out. It also checks that
  edits always produce history, invite rules, receipt storage rules, and that
  the seed loads. `tests/helpers/supabase-shim.sql` provides the few Supabase
  objects the migrations rely on (`auth.users`, `auth.uid()`, roles, storage tables).
- `tests/parse.test.ts` covers the parsing function with a stand-in Claude
  client: one sentence into two entries, child matching, local-time handling,
  missing amounts, refusals and malformed output, and receipts.

## How access works

Access is enforced in the database (`supabase/migrations/0002_rls.sql`), not in
the UI.

| Permission | Can do |
|---|---|
| `log_only` | Log entries. See activities and routines, and their own expenses and receipts |
| `view_expenses` | Also see everyone's expenses and receipts |
| `full` | Also edit anyone's entries, invite and remove people, manage routines and the child's details |

- Roles (parent, grandparent, caregiver) are labels. Permissions decide access.
- A child is created with `create_child()`, which makes the creator a parent
  with full access. People join only through `accept_invite()` with a
  single-use link that expires after 7 days.
- A circle always keeps at least one person with full access.
- Entries are never changed silently. A database trigger writes every change to
  `entry_edits` (who, when, before, after), and clients cannot write to that
  table. Entries can't be hard-deleted: removing one sets `deleted_at`, which is
  itself recorded as an edit. Removed entries stay in the timeline, struck
  through. The one exception is an entry undone within two minutes of logging,
  which is hidden from the feed (its history is still kept).

## How parsing works

`POST /api/parse` and `POST /api/parse-receipt` call Claude with a JSON schema
(structured outputs), so the reply always has the expected shape. The server
builds the context (the user's children, their routines, the local time) from
the database, then `src/lib/parse/normalize.ts` turns the reply into drafts:
only expenses carry an amount, names map to real children, relative times
become instants, and an activity plus its expense share a `group_id`.

Logging never depends on the parser. If Claude is slow, down or declines, the
confirm card opens with the words as typed so they can still be saved.

## Project layout

```
supabase/migrations/   schema, RLS policies, storage buckets
supabase/seed.sql      demo data
src/proxy.ts           session refresh and sign-in redirect
src/app/               routes (timeline at /c/[childId], circle, routines, invite, me, api)
src/components/        Home, SimpleHome, QuickAdd, ConfirmCard, RoutineButtons, Timeline, EntrySheet, ...
src/lib/parse/         Claude prompts, schema, normalisation
src/lib/useTimeline.ts optimistic entries and realtime refresh
tests/                 RLS and parsing tests
```

## Not built yet

Analytics and fairness reports, expense splitting and settle-up, messaging,
calendar sync, location nudges, PDF export, WhatsApp/SMS bot. The schema leaves
room for them: `amount` + `currency` + `author_id` (the payer) + `group_id` for
splitting, `entries.source` for new input channels, `routines.schedule` as JSON
for calendar rules.
