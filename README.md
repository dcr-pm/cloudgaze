# Kin — a co-parenting activity tracker

A shared record of what's happening with the kids, for two parents who don't
live together. One parent logs something; the other sees it.

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/dcr-pm/cloudgaze)

> The button deploys this repo's **default branch** and **clones** it into your
> Git account. If `main` isn't current, or you want to deploy this repo rather
> than a copy of it, use [the manual import](#deploying) instead — it lets you
> pick a branch.

Three sections, all views over one shared log:

- **📅 Calendar** — one-off plans. Camping trips, doctor's appointments, school
  events, handoffs. Multi-day events span the days they cover. Locations open in
  Maps with a tap.
- **🔁 Activities** — the recurring stuff. Soccer on Tuesdays and Thursdays,
  swimming on Saturdays. Season start and end, so it stops cluttering the
  calendar in the off-season.
- **💰 Expenses** — what gets spent on the kids, who paid, and how it splits.
  A running balance sits at the top, and everything exports to CSV.

There is **no chat and no comments**, on purpose. Co-parenting tools that add
messaging turn into argument surfaces. This is a factual record.

---

## Running it

```bash
npm install
cp .env.example .env      # then fill in FAMILY_CODE_PEPPER (see below)
npm run dev               # netlify dev, on http://localhost:8888
```

`npm run dev` uses `netlify dev` via `npx`, because that's what serves the
functions under `/api/*` alongside Vite. Plain `npm run dev:vite` gives you the
frontend on :5173 but every API call will 404.

```bash
npm run build       # tsc -b && vite build
npm run typecheck   # all four tsconfig projects
npm test            # vitest
```

### Deploying

Netlify, from `netlify.toml` as committed — build command, publish directory and
functions directory are all already set, so there's nothing to configure by
hand. Two routes:

**The deploy button** (top of this file). Clones the repo into your Git account,
deploys the default branch, and prompts for `FAMILY_CODE_PEPPER` during setup.
Good for handing someone their own copy. Only useful once `main` holds the code
you actually want.

**Manual import**, which is the right one for deploying *this* repo:

1. **Add new site → Import an existing project** → pick the repo and branch
2. Leave the build settings alone
3. **Site configuration → Environment variables** → add `FAMILY_CODE_PEPPER`

Either way, that variable is not optional:

| Variable | Value |
| --- | --- |
| `FAMILY_CODE_PEPPER` | 64 random hex characters |

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The functions refuse to derive blob keys without it, so the site will build but
every API call will fail until it's set. Use the **same value** locally and in
Netlify. Changing it after launch makes every existing family code stop
resolving — treat it as permanent.

---

## How it works

### Storage

One blob per family in [Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/),
holding the household, every entry, and the audit log.

Blobs has no multi-key transaction, so a single document means a single ETag,
which means a commit is genuinely atomic. It also means one `GET` returns the
whole app state — every filter, search, balance calculation and CSV export runs
in the browser with no round trip. A realistic worst case (two parents, three
kids, five years) is around 1.3 MB.

Writes are compare-and-swap: read with the ETag, apply, write back with
`onlyIfMatch`, retry on a lost race. Simultaneous writes to *different* entries
both land. Simultaneous edits to the *same* entry are last-writer-wins on that
entry only, never a whole-document clobber.

`shared/ops.ts` holds the one reducer that both sides run — the server inside
the CAS loop, the client for its optimistic update — so the two cannot disagree
about what a change means.

### Offline

The client applies every change locally first and queues the request. If the
network is gone, the entry is still there, `localStorage` keeps it across a
reload, and it sends itself when the device reconnects. Client-generated UUIDs
make replay idempotent, so a batch that partially landed is safe to resend.

This matters because the actual use case is a parent in a school pickup line or
at a campsite with one bar of signal.

---

## Three footguns, written down

**1. `getStore`, never `getDeployStore`.** Deploy-scoped stores are garbage
collected with the deploy that created them. Switching to one would wipe every
family's data on every push, silently, with no error anywhere.

**2. Never add `force = true` to the SPA redirect** in `netlify.toml`. Netlify
redirects are fallbacks by default; forcing the `/*` → `/index.html` rule makes
it shadow every `/api/*` function and takes the whole backend down. It's a
common "fix" when a deep link 404s. It isn't one.

**3. A rejected conditional write resolves, it doesn't throw.** `setJSON` with
`onlyIfMatch` returns `{ modified: false }` when it loses the race. Wrapping it
in a bare `try/catch` would swallow every lost write and report success.

Relatedly: use relative imports for `shared/`, not a path alias. Vite resolves
aliases from `vite.config.ts`; Netlify's esbuild function bundler doesn't read
that file, so an alias builds locally and breaks on deploy.

---

## What this doesn't do

Worth being straight about, because someone may be relying on it in a genuinely
difficult situation.

- **The family code is the entire security model.** No accounts, no passwords.
  Anyone holding the code has full read and write access to your kids'
  schedules and locations. It's 12 characters from a 30-symbol alphabet
  (~2⁵⁹ combinations), stored server-side only as a peppered SHA-256 hash, and
  the join endpoint is rate limited to 5 attempts a minute per IP. That makes it
  unguessable. It does not make it un-shareable.

- **There is no recovery if the code is lost.** No email, no reset, no support
  channel. The JSON backup in Settings is the only safety net.

- **"Added by" is self-declared.** Each device simply states which parent it is.
  Nothing verifies it, and either parent can edit or delete the other's entries.
  The append-only audit log and soft deletes make changes *visible*, which is
  the most that's achievable without accounts — but it is not tamper-proof.

- **Not a legal record.** If you need something that stands up in a custody
  dispute, this isn't it.

- **Timezones are display-only.** The household's zone formats what you see, but
  the calendar's date arithmetic uses the device's zone. Two parents in
  different timezones may see a date-boundary event differently.

---

## Known gaps

- **No custody schedule.** The "who has the kids" banner is derived from 🏠
  Handoff entries — whoever received them at the most recent handoff. A real
  rotation (week-on/week-off, 2-2-3) is the most obvious next feature.
- **No "edit just this one occurrence"** of a recurring activity. You can skip a
  date, edit the whole series, or end the season.
- No notifications, no photo or receipt uploads.

---

## Layout

```
shared/     types · schema (zod) · ops (the shared reducer) · constants
            imported by BOTH the browser app and the functions
netlify/functions/
            _lib/{store,familyCode,http} · household-create · household-join
            · state · mutate
src/
  state/    AppStateProvider · api · localCache · useHashRoute
  lib/      dates · recurrence · money · balance · custody · agenda · csv · maps
  components/  shell · ui · setup · calendar · activities · expenses · settings
```

Unit tests cover the three pieces most likely to be quietly wrong: the reducer,
recurrence expansion (including DST boundaries in zones where midnight doesn't
exist), and the money and balance arithmetic.
